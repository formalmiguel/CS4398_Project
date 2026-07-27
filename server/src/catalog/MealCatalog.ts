/**
 * 🟢 GREEN (packet 11b) — the meal library behind `Catalog` (FR-LIB-06/07/08, FR-REC-05).
 *
 * `seedMeals` returns the hand-authored library (`mealLibrary.ts`). `MealCatalog.findMeals` is the
 * FR-LIB-01 seam and enforces the constraint hierarchy:
 *
 *   HARD  — dietary flags. A returned meal ALWAYS carries every requested flag (FR-REC-05). This is
 *           applied first as a filter and never relaxed; `RelaxedConstraint` has no dietary member.
 *   SOFT  — decision D order: (1) MEAL_TYPE, then (2) CALORIE_TOLERANCE (widened last). Each
 *           relaxation is REPORTED in `relaxed`, in that canonical order.
 *   TERMINUS — where even full soft relaxation yields no dietary-respecting meal, "say so plainly":
 *           `satisfiable: false`, `items: []` — never a hard-constraint-violating meal.
 *
 * The ±10% band is the CLOSED interval `[0.9·target, 1.1·target]` (NFR-COR-04). Relaxing the
 * calorie tolerance widens that band to `RELAXED_TOLERANCE`; a target no meal can meet even then is
 * the terminus, which is why an astronomically large target is correctly unsatisfiable.
 */
import type { DietaryFlag, Meal, MealType } from '@capstone/shared';

import type { Catalog, CatalogResult, RelaxedConstraint } from './Catalog';
import { MEAL_LIBRARY } from './mealLibrary';

/** FR-LIB-07 / NFR-COR-04: the default ±10% closed band. */
const TOLERANCE = 0.1;

/**
 * The widened band used when CALORIE_TOLERANCE is relaxed (decision D — the last soft relaxation).
 * It is bounded, not infinite: an impossible target (e.g. 1,000,000 kcal) stays unsatisfiable, so
 * the "say so plainly" terminus is reachable rather than papered over with a distant meal.
 */
const RELAXED_TOLERANCE = 0.25;

export function seedMeals(): readonly Meal[] {
  return MEAL_LIBRARY;
}

/** A meal satisfies a dietary combination iff it carries every requested flag (subset check). */
function satisfiesDietary(meal: Meal, prefs: readonly DietaryFlag[]): boolean {
  return prefs.every((flag) => meal.dietaryFlags.includes(flag));
}

/** Whether `calories` sits within `tolerance` of `target`, inclusive of both boundaries. */
function withinBand(calories: number, target: number, tolerance: number): boolean {
  return calories >= (1 - tolerance) * target && calories <= (1 + tolerance) * target;
}

export class MealCatalog implements Pick<Catalog, 'findMeals'> {
  private readonly meals: readonly Meal[] = seedMeals();

  findMeals(
    calorieTarget: number,
    dietaryPrefs: readonly DietaryFlag[],
    mealType?: MealType,
  ): CatalogResult<Meal> {
    // HARD constraint first: only dietary-respecting meals are ever eligible, at any relaxation.
    const eligible = this.meals.filter((m) => satisfiesDietary(m, dietaryPrefs));

    const inDefaultBand = (m: Meal): boolean => withinBand(m.calories, calorieTarget, TOLERANCE);
    const inWidenedBand = (m: Meal): boolean =>
      withinBand(m.calories, calorieTarget, RELAXED_TOLERANCE);

    // Attempt the full constraint set: matching meal type (when given) AND within the ±10% band.
    if (mealType !== undefined) {
      const full = eligible.filter((m) => m.mealType === mealType && inDefaultBand(m));
      if (full.length > 0) return this.result(full, []);

      // Relax MEAL_TYPE (decision D step 1): any meal type, still within the ±10% band.
      const typeRelaxed = eligible.filter(inDefaultBand);
      if (typeRelaxed.length > 0) return this.result(typeRelaxed, ['MEAL_TYPE']);

      // Relax CALORIE_TOLERANCE (decision D step 3): widen the band, meal type already relaxed.
      const bothRelaxed = eligible.filter(inWidenedBand);
      const order: readonly RelaxedConstraint[] = ['MEAL_TYPE', 'CALORIE_TOLERANCE'];
      if (bothRelaxed.length > 0) return this.result(bothRelaxed, order);

      // Terminus: nothing dietary-respecting fits even the widened band.
      return { items: [], relaxed: order, satisfiable: false };
    }

    // No meal type requested — only the calorie tolerance is soft here.
    const banded = eligible.filter(inDefaultBand);
    if (banded.length > 0) return this.result(banded, []);

    const widened = eligible.filter(inWidenedBand);
    if (widened.length > 0) return this.result(widened, ['CALORIE_TOLERANCE']);

    return { items: [], relaxed: ['CALORIE_TOLERANCE'], satisfiable: false };
  }

  private result(items: readonly Meal[], relaxed: readonly RelaxedConstraint[]): CatalogResult<Meal> {
    return { items, relaxed, satisfiable: true };
  }
}
