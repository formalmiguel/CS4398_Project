/**
 * 🔴 RED (packet 11) — the workout side of the `Catalog` seam.
 *   FR-LIB-05  ≥5 distinct workouts per tier under the default preference set.
 *   FR-REC-03  three distinct at-tier options per tier.
 *   FR-LIB-08  the HARD intensity ceiling (never a workout above the warranted tier) and the SOFT
 *              equipment relaxation (report WORKOUT_PREFERENCE; still never above the ceiling).
 *   FR-LIB-01  the caller sees only the contract `Workout`; no seed shape leaks.
 *
 * Every test fails because `WorkoutCatalog.findWorkouts` / `seedWorkouts` THROW. 11b (GREEN)
 * implements them against exactly these assertions.
 */
import type { IntensityTier, Workout } from '@capstone/shared';

import { WorkoutCatalog, seedWorkouts } from '../../src/catalog/WorkoutCatalog';
import type { WorkoutPreferences } from '../../src/catalog/Catalog';

const TIERS: readonly IntensityTier[] = ['LOW', 'MODERATE', 'HIGH'];
const TIER_RANK: Readonly<Record<IntensityTier, number>> = { LOW: 0, MODERATE: 1, HIGH: 2 };

/** The default (unrestricted) preference set — FR-LIB-05's "satisfying the default preference set". */
const DEFAULT_PREFS: WorkoutPreferences = {};

/** A distinct-by-id count. */
function distinctIds(workouts: readonly Workout[]): number {
  return new Set(workouts.map((w) => w.id)).size;
}

describe('WorkoutCatalog — FR-LIB-05 / FR-REC-03 (supply)', () => {
  // FR-LIB-05: the seeded library holds ≥5 distinct workouts at EACH tier under the default set,
  // so FR-REC-03 can always offer three. RED because seedWorkouts throws.
  it.each(TIERS)(
    'FR-LIB-05: the seeded library holds at least five distinct %s workouts',
    (tier) => {
      const atTier = seedWorkouts()
        .map((s) => s.workout)
        .filter((w) => w.intensityTier === tier);
      expect(distinctIds(atTier)).toBeGreaterThanOrEqual(5);
    },
  );

  // FR-REC-03: findWorkouts(tier, {}, 3) returns exactly three DISTINCT workouts, ALL at tier, and
  // — the default set being satisfiable — with nothing relaxed.
  it.each(TIERS)(
    'FR-REC-03: findWorkouts(%s, {}, 3) returns three distinct options, all at that tier, nothing relaxed',
    (tier) => {
      const catalog = new WorkoutCatalog();
      const result = catalog.findWorkouts(tier, DEFAULT_PREFS, 3);
      expect(result.satisfiable).toBe(true);
      expect(result.relaxed).toEqual([]);
      expect(result.items).toHaveLength(3);
      expect(distinctIds(result.items)).toBe(3);
      expect(result.items.every((w) => w.intensityTier === tier)).toBe(true);
    },
  );
});

describe('WorkoutCatalog — FR-LIB-08 (the hard intensity ceiling)', () => {
  // The ceiling is absolute: under ANY preference and ANY n, no returned workout is above the
  // warranted tier. Asserted for every tier and for a restrictive preference that forces relaxation.
  it.each(TIERS)(
    'FR-LIB-08: findWorkouts(%s, ...) never returns a workout above that tier, under any preference or n',
    (tier) => {
      const catalog = new WorkoutCatalog();
      const restrictive: WorkoutPreferences = { availableEquipment: ['__none_such__'] };
      for (const prefs of [DEFAULT_PREFS, restrictive]) {
        for (const n of [1, 3, 50]) {
          const result = catalog.findWorkouts(tier, prefs, n);
          expect(
            result.items.every((w) => TIER_RANK[w.intensityTier] <= TIER_RANK[tier]),
          ).toBe(true);
        }
      }
    },
  );

  // Concretely for LOW — the tightest ceiling — no MODERATE and no HIGH workout may ever appear.
  it('FR-LIB-08: findWorkouts at LOW never returns a MODERATE or HIGH workout', () => {
    const catalog = new WorkoutCatalog();
    const restrictive: WorkoutPreferences = { availableEquipment: ['__none_such__'] };
    const result = catalog.findWorkouts('LOW', restrictive, 50);
    expect(result.items.some((w) => w.intensityTier === 'MODERATE')).toBe(false);
    expect(result.items.some((w) => w.intensityTier === 'HIGH')).toBe(false);
  });
});

describe('WorkoutCatalog — FR-LIB-08 (soft equipment relaxation)', () => {
  // A restrictive availableEquipment no at-tier workout satisfies is relaxed: the result reports
  // WORKOUT_PREFERENCE and its items are still at or below the tier (never above — the ceiling is
  // hard even under relaxation). Where even full relaxation supplies nothing, satisfiable is false
  // — NOT a ceiling violation.
  it('FR-LIB-08: a restrictive equipment preference relaxes WORKOUT_PREFERENCE, never the ceiling', () => {
    const catalog = new WorkoutCatalog();
    const restrictive: WorkoutPreferences = { availableEquipment: ['__none_such__'] };
    const result = catalog.findWorkouts('MODERATE', restrictive, 3);

    if (result.satisfiable) {
      expect(result.relaxed).toContain('WORKOUT_PREFERENCE');
      expect(result.items.every((w) => TIER_RANK[w.intensityTier] <= TIER_RANK.MODERATE)).toBe(true);
    } else {
      // "Say so plainly": nothing at or below the tier fits — the answer is no candidate, never a
      // workout above the ceiling.
      expect(result.items).toEqual([]);
      expect(result.items.every((w) => TIER_RANK[w.intensityTier] <= TIER_RANK.MODERATE)).toBe(true);
    }
  });
});

describe('WorkoutCatalog — FR-LIB-01 (the seam hides population)', () => {
  // The caller receives the contract `Workout` and nothing about how the library was populated:
  // no source category/level (the SeededWorkout provenance) leaks into a findWorkouts item.
  it('FR-LIB-01: findWorkouts returns the contract Workout shape, with no seed-source fields', () => {
    const catalog = new WorkoutCatalog();
    const result = catalog.findWorkouts('LOW', DEFAULT_PREFS, 3);
    for (const item of result.items) {
      const keys = Object.keys(item).sort();
      expect(keys).toEqual(
        ['equipment', 'id', 'intensityTier', 'name', 'targetArea', 'typicalDurationMinutes'].sort(),
      );
    }
  });
});
