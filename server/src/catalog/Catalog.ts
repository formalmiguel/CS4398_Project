/**
 * 🔴 RED (packet 11) — the server-local content seam of §3.6's `Catalog`.
 *
 * §3.6 draws `Catalog` with `+findWorkouts(tier, prefs, n) Workout[]` and
 * `+findMeals(calorieTarget, prefs) Meal[]`. That bare-array return is refined here with a
 * `CatalogResult<T>` wrapper because FR-LIB-08 requires the catalog to also REPORT which
 * constraints it relaxed and whether the query was satisfiable at all — the diagram shows the
 * items, the requirement asks for the report. Because `Catalog` is server-local (like
 * `RescheduleService` and `RecommendationEngine`), this refinement is NOT a contract change
 * (§4.7); every DOMAIN type below is imported from the frozen contract, never redefined.
 *
 * INTERFACES AND TYPES ONLY — no implementation lives in this file. The two library classes
 * (`WorkoutCatalog`, `MealCatalog`) and the seed loaders are packet 11b's (GREEN).
 */
import type { DietaryFlag, IntensityTier, Meal, MealType, Workout } from '@capstone/shared';

/**
 * FR-LIB-08 (decision D): the SOFT constraints, in the fixed order they relax —
 * (1) meal type → (2) equipment / workout preference → (3) calorie tolerance (widened last).
 * The two HARD constraints (a meal's dietary flags, a workout's intensity ceiling) never relax
 * and so have no member here: a value a caller could pass to "relax the dietary flag" must not
 * exist.
 */
export type RelaxedConstraint = 'MEAL_TYPE' | 'WORKOUT_PREFERENCE' | 'CALORIE_TOLERANCE';

/**
 * What a catalog query returns. FR-LIB-01: `items` are the contract type (`Workout` / `Meal`),
 * so no seed-shape leaks to the caller. FR-LIB-08: `relaxed` records which soft constraints were
 * relaxed to produce `items` (`[]` when the full constraint set was satisfied), and `satisfiable`
 * is `false` when even full soft relaxation yields no hard-constraint-respecting candidate — the
 * "say so plainly" terminus, where `items` may be `[]`.
 */
export interface CatalogResult<T> {
  readonly items: readonly T[];
  readonly relaxed: readonly RelaxedConstraint[];
  readonly satisfiable: boolean;
}

/**
 * The workout-side soft preference. Omitting `availableEquipment` is the DEFAULT preference set
 * (FR-LIB-05) — no equipment restriction. A restrictive value is what exercises FR-LIB-08's
 * equipment relaxation.
 */
export interface WorkoutPreferences {
  readonly availableEquipment?: readonly string[];
}

/**
 * The single seam both libraries sit behind (FR-LIB-01). The recommendation engine queries ONLY
 * through this and never learns how a library was populated.
 */
export interface Catalog {
  /**
   * FR-REC-03 / FR-LIB-05: up to `n` distinct workouts AT the warranted tier. FR-LIB-08: never a
   * workout ABOVE `tier` (the intensity ceiling is hard), under any `prefs` or any `n`.
   */
  findWorkouts(tier: IntensityTier, prefs: WorkoutPreferences, n: number): CatalogResult<Workout>;
  /**
   * FR-REC-08 / FR-LIB-07 / FR-LIB-08: meals near `calorieTarget`. `dietaryPrefs` is HARD — a
   * returned meal ALWAYS carries every requested flag (FR-REC-05). `mealType`, when given, is a
   * SOFT constraint that relaxes before the calorie tolerance (decision D).
   */
  findMeals(
    calorieTarget: number,
    dietaryPrefs: readonly DietaryFlag[],
    mealType?: MealType,
  ): CatalogResult<Meal>;
}
