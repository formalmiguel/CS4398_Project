/**
 * 🔴 RED (packet 11) — the workout library behind `Catalog` (FR-LIB-03/04/05/08, FR-REC-03).
 *
 * Every method and loader here THROWS. Packet 11b (GREEN) implements `findWorkouts` and SEEDS the
 * library from `free-exercise-db` (decision A); no seed literal and no selection logic exists in
 * this file.
 *
 * ⚠️ SEED-LOADER SHAPE (RED-authored refinement — see report). §3.6 and the packet sketch
 * `seedWorkouts(): Workout[]`, but the contract `Workout` carries no source `category`/`level`, so
 * a bare `Workout[]` cannot satisfy FR-LIB-04's OWN verification clause ("every seeded workout
 * resolves to exactly one tier" — checkable only as `w.intensityTier === resolveIntensityTier(cat,
 * level)`). The loader therefore pairs each seeded `Workout` with the source record it was derived
 * from (`SeededWorkout`). This is a SERVER-LOCAL type, like `CatalogResult` — NOT a contract
 * change (§4.7). The PUBLIC seam (`findWorkouts`) still returns the bare contract `Workout`, so
 * FR-LIB-01's "no seed-shape leak" holds; provenance is visible only to the seeding/verification
 * path.
 */
import type { IntensityTier, Workout } from '@capstone/shared';

import type { Catalog, CatalogResult, WorkoutPreferences } from './Catalog';

/**
 * The fields of a `free-exercise-db` record the tier mapping reads (decision A). Kept to what
 * FR-LIB-04 consumes — a `category` and a `level`, both raw source strings.
 */
export interface WorkoutSourceRecord {
  readonly category: string;
  readonly level: string;
}

/** A seeded workout paired with its source provenance, for FR-LIB-04's per-item verification. */
export interface SeededWorkout {
  readonly workout: Workout;
  readonly source: WorkoutSourceRecord;
}

/**
 * FR-LIB-03: the one-time seeding of the workout library. Returns every seeded workout with the
 * source record it came from. THROWS in RED — 11b derives the seed from `free-exercise-db`.
 */
export function seedWorkouts(): readonly SeededWorkout[] {
  throw new Error('not implemented');
}

export class WorkoutCatalog implements Pick<Catalog, 'findWorkouts'> {
  findWorkouts(
    _tier: IntensityTier,
    _prefs: WorkoutPreferences,
    _n: number,
  ): CatalogResult<Workout> {
    throw new Error('not implemented');
  }
}
