/**
 * 🔌 Packet 17d — the OPEN-28 reconciliation between two interfaces that were both named `Catalog`.
 *
 * `RecommendationScheduler` (packet 17a's frozen surface) needs only "give me `n` workouts at this
 * tier". Packet 11's real `Catalog` offers far more — a preference argument and FR-LIB-08's
 * relaxation report. They are not the same interface, and the narrow one CANNOT be widened:
 * `server/test/acceptance/support/harness.ts` is FROZEN at `8809158`, imports the name `Catalog`
 * from `RecommendationScheduler`, and implements the two-argument form. Widening it breaks a frozen
 * suite at compile time — §8.3 forbids it and `guard:tests-frozen` catches it.
 *
 * So the narrow port is RENAMED `WorkoutSource` (what it actually is — a source of workouts, not
 * the whole library seam), `RecommendationScheduler` keeps `export type Catalog = WorkoutSource`
 * as a REQUIRED alias so the frozen import still resolves, and the real catalog is ADAPTED to it
 * here. No behaviour moves; this is a shape change and an adapter.
 */
import type { IntensityTier, Workout } from '@capstone/shared';

import type { Catalog as LibraryCatalog, WorkoutPreferences } from '../catalog/Catalog';

/**
 * The workout half of §3.6's `Catalog`, as `RecommendationScheduler` consumes it. Deliberately
 * narrow: the scheduler asks for workouts at a tier and places one. It has no opinion about
 * equipment, dietary flags, or meals, and giving it one would put library knowledge inside the
 * class that does the FR-REC-04 wiring.
 */
export interface WorkoutSource {
  /** Up to `count` workouts at the warranted tier (FR-REC-03's "three options"; FR-LIB-05). */
  findWorkouts(tier: IntensityTier, count: number): readonly Workout[];
}

/**
 * FR-LIB-05's DEFAULT preference set: no equipment restriction. The apply-workout path exercises
 * no user equipment preference (FR-REC-05 is out of scope for it), so the adapter passes the
 * default rather than inventing one.
 */
const DEFAULT_WORKOUT_PREFERENCES: WorkoutPreferences = {};

/**
 * Adapts packet 11's real `Catalog` to the narrow `WorkoutSource` the scheduler consumes.
 *
 * ⚠️ FR-LIB-08 GAP, recorded rather than hidden (see `docs/P17D-REPORT.md`). The real catalog
 * reports WHICH soft constraints it relaxed and WHETHER the query was satisfiable at all. The
 * narrow port returns a bare array and has nowhere to put either fact, so the adapter LOGS them
 * and they do not reach the caller. This is a real gap in the apply-workout path only:
 * `GET /wellness` already surfaces `relaxed` and `satisfiable` for meals and `satisfiable` for
 * workouts, and is another owner's file. Closing it here would mean widening the frozen port.
 */
export const workoutSourceFrom = (catalog: LibraryCatalog): WorkoutSource => ({
  findWorkouts: (tier: IntensityTier, count: number): readonly Workout[] => {
    const result = catalog.findWorkouts(tier, DEFAULT_WORKOUT_PREFERENCES, count);

    // FR-LIB-08: "report what it relaxed". The port cannot carry it; dropping it silently would
    // make a requirement disappear at a type boundary, so it is at least stated where an operator
    // running the §6 demonstration can see it.
    if (!result.satisfiable) {
      // eslint-disable-next-line no-console
      console.warn(
        `[catalog] no ${tier} workout satisfies even the relaxed constraint set (FR-LIB-08: unsatisfiable)`,
      );
    } else if (result.relaxed.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[catalog] relaxed ${result.relaxed.join(', ')} to find a ${tier} workout (FR-LIB-08)`);
    }

    return result.items;
  },
});
