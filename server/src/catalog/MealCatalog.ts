/**
 * 🔴 RED (packet 11) — the meal library behind `Catalog` (FR-LIB-06/07/08, FR-REC-05).
 *
 * Every method and loader here THROWS. Packet 11b (GREEN) implements `findMeals` and hand-authors
 * the meal library (§4.2 — meals are hand-authored, so no dataset-license question arises). No
 * meal literal and no filtering/relaxation logic exists in this file.
 *
 * The seed loader returns the bare contract `Meal[]` — unlike `seedWorkouts`, no source provenance
 * is needed: FR-LIB-06's fields (name, meal type, calories, dietary flags) all live on `Meal`
 * itself, and a hand-authored library has no source dataset to attribute (FR-LIB-10 is a
 * workout-dataset obligation).
 */
import type { DietaryFlag, Meal, MealType } from '@capstone/shared';

import type { Catalog, CatalogResult } from './Catalog';

/**
 * FR-LIB-06: the one-time seeding of the meal library. THROWS in RED — 11b hand-authors the meals
 * with the calorie distribution FR-LIB-07 demands.
 */
export function seedMeals(): readonly Meal[] {
  throw new Error('not implemented');
}

export class MealCatalog implements Pick<Catalog, 'findMeals'> {
  findMeals(
    _calorieTarget: number,
    _dietaryPrefs: readonly DietaryFlag[],
    _mealType?: MealType,
  ): CatalogResult<Meal> {
    throw new Error('not implemented');
  }
}
