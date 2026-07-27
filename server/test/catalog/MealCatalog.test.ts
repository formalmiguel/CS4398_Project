/**
 * 🔴 RED (packet 11) — the meal side of the `Catalog` seam.
 *   FR-LIB-06  every seeded meal carries name, meal type, a positive calorie count, dietary flags.
 *   FR-REC-05  a returned meal NEVER lacks a requested dietary flag — the absolute negative,
 *   FR-LIB-08  asserted exhaustively over all 32 dietary combinations and the full calorie range.
 *   FR-LIB-07  a day's plan is assemblable within ±10% for every combination across the range.
 *   FR-LIB-08  the SOFT relaxation order (meal type before calorie tolerance) and the "say so
 *              plainly" terminus (satisfiable: false, items: []) — never a violating meal.
 *   FR-LIB-01  the caller sees only the contract `Meal`.
 *   NFR-COR-04 the ±10% band is the CLOSED interval, asserted at the boundary.
 *
 * Every test fails because `MealCatalog.findMeals` / `seedMeals` THROW. 11b (GREEN) hand-authors
 * the library and implements selection against exactly these assertions.
 */
import type { DietaryFlag } from '@capstone/shared';

import { MealCatalog, seedMeals } from '../../src/catalog/MealCatalog';
import type { RelaxedConstraint } from '../../src/catalog/Catalog';
import {
  calorieSweep,
  comboLabel,
  dietaryPowerset,
  assembleDayPlan,
  satisfiesDietary,
  withinTolerance,
} from './_support';

const POWERSET = dietaryPowerset();
const SWEEP = calorieSweep();

/** The canonical soft-relaxation order (decision D). Meals never relax WORKOUT_PREFERENCE. */
const CANONICAL_ORDER: readonly RelaxedConstraint[] = ['MEAL_TYPE', 'WORKOUT_PREFERENCE', 'CALORIE_TOLERANCE'];

/** True iff `reported` appears in the same relative order as `canonical` (a subsequence). */
function isOrderedSubsequence(
  reported: readonly RelaxedConstraint[],
  canonical: readonly RelaxedConstraint[],
): boolean {
  let i = 0;
  for (const c of canonical) {
    if (i < reported.length && reported[i] === c) i += 1;
  }
  return i === reported.length;
}

describe('the seeded meal library — FR-LIB-06', () => {
  it('FR-LIB-06: the library is non-empty and every meal carries name, type, positive calories, and flags', () => {
    const meals = seedMeals();
    expect(meals.length).toBeGreaterThan(0);
    for (const meal of meals) {
      expect(meal.id).toBeTruthy();
      expect(meal.name.trim().length).toBeGreaterThan(0);
      expect(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).toContain(meal.mealType);
      expect(meal.calories).toBeGreaterThan(0);
      expect(Array.isArray(meal.dietaryFlags)).toBe(true);
    }
  });
});

describe('MealCatalog — FR-REC-05 / FR-LIB-08 (the hard dietary constraint, exhaustive negative)', () => {
  // For EVERY dietary combination and EVERY target across the full range, no returned meal — from
  // any meal type, satisfiable or not, relaxed or not — ever lacks a requested flag. The single
  // worst behaviour this System could have, pinned as zero violations. RED because findMeals throws.
  it.each(POWERSET.map((combo) => [comboLabel(combo), combo] as const))(
    'FR-REC-05: findMeals never returns a meal lacking a requested flag — combination %s, full calorie range',
    (_label, combo) => {
      const catalog = new MealCatalog();
      for (const target of SWEEP) {
        for (const mealType of ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const) {
          const result = catalog.findMeals(target, combo, mealType);
          for (const meal of result.items) {
            expect(satisfiesDietary(meal, combo)).toBe(true);
          }
        }
        // and with no meal-type constraint
        const untyped = catalog.findMeals(target, combo);
        for (const meal of untyped.items) {
          expect(satisfiesDietary(meal, combo)).toBe(true);
        }
      }
    },
  );

  // The dietary constraint is never among the relaxable ones: `RelaxedConstraint` has no dietary
  // member by construction, and even under full relaxation the returned set still satisfies it.
  it('FR-LIB-08: dietary flags are a HARD constraint — the returned set satisfies them even under relaxation', () => {
    const catalog = new MealCatalog();
    const combo: readonly DietaryFlag[] = ['VEGAN', 'GLUTEN_FREE', 'NUT_FREE'];
    // A target extreme enough to force whatever soft relaxation the catalog can do.
    const result = catalog.findMeals(50, combo, 'SNACK');
    for (const meal of result.items) {
      expect(satisfiesDietary(meal, combo)).toBe(true);
    }
  });
});

describe('MealCatalog — FR-LIB-07 (±10% day-plan coverage across every combination)', () => {
  // The library-richness property: for every offered dietary combination and every daily target in
  // the FR-REC-08 range, a BREAKFAST+LUNCH+DINNER plan assembles within ±10% WITHOUT relaxation.
  it.each(POWERSET.map((combo) => [comboLabel(combo), combo] as const))(
    'FR-LIB-07: a day plan assembles within ±10% for combination %s across the full calorie range',
    (_label, combo) => {
      const catalog = new MealCatalog();
      for (const target of SWEEP) {
        const plan = assembleDayPlan(catalog, target, combo);
        expect(plan.assembled).toBe(true);
        expect(withinTolerance(plan.totalCalories, target)).toBe(true);
        // and — being assemblable at the full constraint set — the dietary flags always hold.
        for (const meal of plan.meals) {
          expect(satisfiesDietary(meal, combo)).toBe(true);
        }
      }
    },
  );

  // The named UC-08 canonical target, for the moderately-restrictive combination in the packet's
  // own example. A focused, human-readable checkpoint of the sweep above.
  it('FR-LIB-07: a day plan is assemblable within ±10% for the VEGAN+GLUTEN_FREE combination at 2,850 kcal', () => {
    const catalog = new MealCatalog();
    const plan = assembleDayPlan(catalog, 2850, ['VEGAN', 'GLUTEN_FREE']);
    expect(plan.assembled).toBe(true);
    expect(withinTolerance(plan.totalCalories, 2850)).toBe(true);
  });

  // The most restrictive combination the library must still cover (the packet's flagged scope
  // risk) — all five flags, at the canonical target.
  it('FR-LIB-07: a day plan is assemblable within ±10% for the all-five-flags combination at 2,850 kcal', () => {
    const catalog = new MealCatalog();
    const plan = assembleDayPlan(catalog, 2850, [
      'VEGETARIAN',
      'VEGAN',
      'GLUTEN_FREE',
      'DAIRY_FREE',
      'NUT_FREE',
    ]);
    expect(plan.assembled).toBe(true);
    expect(withinTolerance(plan.totalCalories, 2850)).toBe(true);
  });
});

describe('NFR-COR-04 — the ±10% band is the closed interval [0.9T, 1.1T]', () => {
  // The band membership is asserted AGAINST THE CATALOG, not against the test-side helper (a test
  // of the helper would be circular and would pass in GREEN untouched). The exact at-boundary
  // injection NFR-COR-04 describes — a meal sitting precisely at 1.1T accepted, one at 1.1T+1
  // rejected — needs seed data to place a meal on the boundary, which is 11b's (RED authors no
  // seed). RED pins the safety direction that does not need seed control: whenever the catalog did
  // NOT relax the calorie tolerance, every returned meal sits within the CLOSED band — nothing
  // outside ±10% slips in unreported. `withinTolerance` is the closed-interval oracle (inclusive
  // at both ends), defined in _support.ts and frozen with the suite.
  it('NFR-COR-04: with the calorie tolerance unrelaxed, every returned meal is within the closed ±10% band', () => {
    const catalog = new MealCatalog();
    for (const target of SWEEP) {
      const result = catalog.findMeals(target, []);
      if (!result.relaxed.includes('CALORIE_TOLERANCE')) {
        for (const meal of result.items) {
          expect(withinTolerance(meal.calories, target)).toBe(true);
        }
      }
    }
  });
});

describe('MealCatalog — FR-LIB-08 (documented soft-relaxation order + say so plainly)', () => {
  // The ordering invariant: whatever the catalog relaxes, it reports in the fixed canonical order,
  // and never reports the meal-only queries' WORKOUT_PREFERENCE. Holds for any query.
  it('FR-LIB-08: relaxed constraints are always reported in the documented, fixed order (meal type before calorie tolerance)', () => {
    const catalog = new MealCatalog();
    const combo: readonly DietaryFlag[] = ['VEGETARIAN'];
    // Sample a spread of queries, including extreme targets that force relaxation.
    for (const target of [50, 1800, 2850, 100000]) {
      const result = catalog.findMeals(target, combo, 'SNACK');
      expect(isOrderedSubsequence(result.relaxed, CANONICAL_ORDER)).toBe(true);
      expect(result.relaxed).not.toContain('WORKOUT_PREFERENCE');
    }
  });

  // Calorie tolerance relaxes LAST: if it was relaxed and a meal type was requested, meal type was
  // relaxed first (decision D — tolerance is only widened after meal type has been relaxed).
  it('FR-LIB-08: calorie tolerance is only relaxed after meal type (tolerance last)', () => {
    const catalog = new MealCatalog();
    const result = catalog.findMeals(50, ['VEGETARIAN'], 'SNACK');
    if (result.relaxed.includes('CALORIE_TOLERANCE')) {
      expect(result.relaxed).toContain('MEAL_TYPE');
      expect(result.relaxed.indexOf('MEAL_TYPE')).toBeLessThan(
        result.relaxed.indexOf('CALORIE_TOLERANCE'),
      );
    }
  });

  // "Say so plainly": a target no meal can meet even after full soft relaxation returns
  // satisfiable: false with items: [] — never a hard-constraint-violating meal.
  it('FR-LIB-08: an unsatisfiable query says so plainly — satisfiable false, items empty, no violating meal', () => {
    const catalog = new MealCatalog();
    const result = catalog.findMeals(1_000_000, ['VEGAN']);
    expect(result.satisfiable).toBe(false);
    expect(result.items).toEqual([]);
  });
});

describe('MealCatalog — FR-LIB-01 (the seam hides population)', () => {
  it('FR-LIB-01: findMeals returns the contract Meal shape, with no seed-internal fields', () => {
    const catalog = new MealCatalog();
    const result = catalog.findMeals(2850, []);
    for (const item of result.items) {
      const keys = Object.keys(item).sort();
      expect(keys).toEqual(['calories', 'dietaryFlags', 'id', 'mealType', 'name'].sort());
    }
  });
});
