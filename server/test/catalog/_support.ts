/**
 * 🔴 RED (packet 11) — test-side helpers for the catalog suite. This file lives INSIDE the frozen
 * test dir (NFR-MNT-08 fingerprints the whole directory), never in server/test/support.
 *
 * ⛔ NOTHING HERE IS CATALOG LOGIC. It is the suite's own combinatorics (the dietary powerset, the
 * calorie sweep), its own definition of the ±10% boundary (`withinTolerance`), and a day-plan
 * ASSEMBLER that only SPLITS a target and DELEGATES to `Catalog.findMeals` — it selects no meal by
 * dietary flag or calorie, so it is not the meal-planning algorithm FR-REC-10 (cut) would need.
 */
import type { DietaryFlag, Meal, MealType } from '@capstone/shared';

import type { Catalog } from '../../src/catalog/Catalog';

// ── The dietary universe (FR-REC-05 / FR-LIB-07) ──────────────────────────────────────────────

/** Every dietary flag the contract defines — the universe the exhaustive sweeps range over. */
export const ALL_DIETARY_FLAGS: readonly DietaryFlag[] = [
  'VEGETARIAN',
  'VEGAN',
  'GLUTEN_FREE',
  'DAIRY_FREE',
  'NUT_FREE',
];

/**
 * All 2^5 = 32 subsets of the dietary flags — every "dietary preference combination offered"
 * (FR-LIB-07) and every restriction the hard-constraint invariant (FR-REC-05, FR-LIB-08) must hold
 * across. Pure combinatorics; deterministic order.
 */
export function dietaryPowerset(): readonly (readonly DietaryFlag[])[] {
  const out: DietaryFlag[][] = [[]];
  for (const flag of ALL_DIETARY_FLAGS) {
    for (const subset of [...out]) {
      out.push([...subset, flag]);
    }
  }
  return out;
}

/** A human-readable label for a dietary combination, for test names. `∅` is the unrestricted set. */
export function comboLabel(combo: readonly DietaryFlag[]): string {
  return combo.length === 0 ? '∅ (no restriction)' : combo.join('+');
}

/** A meal "satisfies" a dietary combination iff it carries EVERY requested flag (subset check). */
export function satisfiesDietary(meal: Meal, combo: readonly DietaryFlag[]): boolean {
  return combo.every((flag) => meal.dietaryFlags.includes(flag));
}

// ── The FR-REC-08 calorie sweep (FR-LIB-07) ───────────────────────────────────────────────────
//
// ⚠️ RED-AUTHORED SPEC DECISION — owner to ratify before freeze (see report). The SRS bounds
// NEITHER end of FR-REC-08's target (target = baseline + active calories; the baseline is arbitrary
// user input, FR-REC-09). [1500, 4000] kcal in 250-kcal steps is the realistic daily range the §6
// demonstration exercises (UC-08's canonical 2,850 sits inside it). Whatever range this sweep
// asserts, 11b must cover — so the value is load-bearing and is surfaced, not buried.

export const CALORIE_SWEEP_MIN = 1500;
export const CALORIE_SWEEP_MAX = 4000;
export const CALORIE_SWEEP_STEP = 250;

/** The daily targets swept, inclusive of both bounds. */
export function calorieSweep(): readonly number[] {
  const out: number[] = [];
  for (let t = CALORIE_SWEEP_MIN; t <= CALORIE_SWEEP_MAX; t += CALORIE_SWEEP_STEP) {
    out.push(t);
  }
  return out;
}

// ── The ±10% boundary (FR-LIB-07 / NFR-COR-04) ────────────────────────────────────────────────

/** FR-LIB-07's tolerance: ±10%. */
export const TOLERANCE = 0.1;

/** The CLOSED band `[0.9 * target, 1.1 * target]`. Inclusive at both ends (NFR-COR-04). */
export function toleranceBand(target: number): { readonly lo: number; readonly hi: number } {
  return { lo: (1 - TOLERANCE) * target, hi: (1 + TOLERANCE) * target };
}

/** Whether `value` is within ±10% of `target`, inclusive of both boundaries. */
export function withinTolerance(value: number, target: number): boolean {
  const { lo, hi } = toleranceBand(target);
  return value >= lo && value <= hi;
}

// ── The day-plan assembler (FR-LIB-07) ────────────────────────────────────────────────────────
//
// A day plan is BREAKFAST + LUNCH + DINNER. The daily target is split in FIXED proportions and
// each slot is found INDEPENDENTLY within ±10% of its OWN slot target. If every slot lands in its
// band, the sum lands in [0.9 * T, 1.1 * T] by construction — so the assembler needs no
// cross-slot optimisation and is deliberately NOT a planner. It selects from what `findMeals`
// already filtered; it never filters by dietary flag or calorie itself.

export const DAY_PLAN_SPLIT: Readonly<Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>> = {
  BREAKFAST: 0.3,
  LUNCH: 0.35,
  DINNER: 0.35,
};

export interface AssembledDayPlan {
  /** The meal chosen for each slot, in `[breakfast, lunch, dinner]` order. */
  readonly meals: readonly Meal[];
  /** The summed calories of the chosen meals. */
  readonly totalCalories: number;
  /** True iff every slot found a meal within ±10% of its own slot target. */
  readonly assembled: boolean;
}

/**
 * Assemble a day plan for `dailyTarget` under `dietaryPrefs` by querying `catalog.findMeals` once
 * per slot. For each slot it takes the returned meal CLOSEST to the slot target and keeps it only
 * if within the slot's ±10% band. `assembled` is true iff all three slots did so.
 *
 * In RED this THROWS the moment it calls `findMeals` (the stub throws) — the FR-LIB-07 tests fail
 * because the catalog is unimplemented, not vacuously.
 */
export function assembleDayPlan(
  catalog: Pick<Catalog, 'findMeals'>,
  dailyTarget: number,
  dietaryPrefs: readonly DietaryFlag[],
): AssembledDayPlan {
  const slots: readonly (keyof typeof DAY_PLAN_SPLIT)[] = ['BREAKFAST', 'LUNCH', 'DINNER'];
  const chosen: Meal[] = [];
  let assembled = true;

  for (const slot of slots) {
    const slotTarget = DAY_PLAN_SPLIT[slot] * dailyTarget;
    const result = catalog.findMeals(slotTarget, dietaryPrefs, slot as MealType);
    const best = closestTo(result.items, slotTarget);
    if (best === undefined || !withinTolerance(best.calories, slotTarget)) {
      assembled = false;
      continue;
    }
    chosen.push(best);
  }

  const totalCalories = chosen.reduce((sum, m) => sum + m.calories, 0);
  return { meals: chosen, totalCalories, assembled };
}

/** The meal whose calories are nearest `target`, or `undefined` if there are none. */
function closestTo(meals: readonly Meal[], target: number): Meal | undefined {
  let best: Meal | undefined;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const meal of meals) {
    const gap = Math.abs(meal.calories - target);
    if (gap < bestGap) {
      best = meal;
      bestGap = gap;
    }
  }
  return best;
}
