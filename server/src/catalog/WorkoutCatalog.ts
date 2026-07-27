/**
 * 🟢 GREEN (packet 11b) — the workout library behind `Catalog` (FR-LIB-03/04/05/08, FR-REC-03).
 *
 * `seedWorkouts` performs the FR-LIB-03 one-time seed from `free-exercise-db` (decision A), read
 * from a VENDORED local JSON committed to the repo — never fetched at runtime (FR-LIB-02, which
 * packet 16b guards). `WorkoutCatalog.findWorkouts` is the FR-LIB-01 seam: it returns the bare
 * contract `Workout`, applies the HARD intensity ceiling (never a workout above the warranted tier)
 * and the SOFT equipment relaxation (report `WORKOUT_PREFERENCE`, still never above the ceiling).
 *
 * The seed pairs each `Workout` with the `WorkoutSourceRecord` it was derived from (`SeededWorkout`)
 * so FR-LIB-04's own verification clause — "every seeded workout resolves to exactly one tier" — is
 * checkable. That provenance is a SERVER-LOCAL type; it never leaves this module (FR-LIB-01).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { IntensityTier, Workout } from '@capstone/shared';

import type { Catalog, CatalogResult, RelaxedConstraint, WorkoutPreferences } from './Catalog';
import { resolveIntensityTier } from './intensityTier';

export interface WorkoutSourceRecord {
  readonly category: string;
  readonly level: string;
}

/** A seeded workout paired with its source provenance, for FR-LIB-04's per-item verification. */
export interface SeededWorkout {
  readonly workout: Workout;
  readonly source: WorkoutSourceRecord;
}

/** FR-LIB-03 decision C: typical duration in minutes, keyed off the resolved tier. */
const DURATION_FOR_TIER: Readonly<Record<IntensityTier, number>> = {
  LOW: 20,
  MODERATE: 30,
  HIGH: 45,
};

/** Ordering of the three tiers, so the ceiling can be compared numerically. */
const TIER_RANK: Readonly<Record<IntensityTier, number>> = { LOW: 0, MODERATE: 1, HIGH: 2 };

/**
 * One raw `free-exercise-db` record, restricted to the fields the seed reads. `equipment` is the
 * source's single string — `null` or `"body only"` for a bodyweight exercise, which becomes an
 * empty `equipment` array (no sentinel is fabricated).
 */
interface RawExercise {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly level: string;
  readonly equipment: string | null;
  readonly primaryMuscles: readonly string[];
}

/**
 * The vendored dataset, read from disk once and memoised. Reading via `fs` (not the network) is
 * what keeps the recommendation path offline (FR-LIB-02). The file is a curated subset of the real
 * `free-exercise-db`, committed under `data/` and attributed in `attribution.ts` (FR-LIB-10).
 */
let cachedRaw: readonly RawExercise[] | undefined;

function loadRawExercises(): readonly RawExercise[] {
  if (cachedRaw === undefined) {
    const path = join(__dirname, 'data', 'free-exercise-db.subset.json');
    cachedRaw = JSON.parse(readFileSync(path, 'utf-8')) as RawExercise[];
  }
  return cachedRaw;
}

/** Map a source `equipment` string to the contract's `equipment` array (empty for bodyweight). */
function toEquipment(raw: string | null): readonly string[] {
  // `null` and "body only" are free-exercise-db's two bodyweight markers — no equipment required.
  if (raw === null || raw === 'body only') return [];
  return [raw];
}

/** FR-LIB-03: the target area, derived from primary muscles, falling back to the activity category. */
function toTargetArea(record: RawExercise): string {
  const muscles = record.primaryMuscles.filter((m) => m.trim().length > 0);
  return muscles.length > 0 ? muscles.join(', ') : record.category;
}

let cachedSeed: readonly SeededWorkout[] | undefined;

/**
 * FR-LIB-03: the one-time seeding of the workout library from the vendored `free-exercise-db`
 * subset. Each source record becomes a contract `Workout` (its tier resolved by decision B, its
 * duration by decision C) paired with the `{category, level}` it was derived from.
 */
export function seedWorkouts(): readonly SeededWorkout[] {
  if (cachedSeed === undefined) {
    cachedSeed = loadRawExercises().map((record) => {
      const intensityTier = resolveIntensityTier(record.category, record.level);
      const workout: Workout = {
        id: record.id,
        name: record.name,
        intensityTier,
        typicalDurationMinutes: DURATION_FOR_TIER[intensityTier],
        equipment: toEquipment(record.equipment),
        targetArea: toTargetArea(record),
      };
      const source: WorkoutSourceRecord = { category: record.category, level: record.level };
      return { workout, source };
    });
  }
  return cachedSeed;
}

/** A workout's equipment is satisfied iff every required item is in the available set. */
function equipmentSatisfied(workout: Workout, available: readonly string[] | undefined): boolean {
  // An omitted `availableEquipment` is the default (unrestricted) set — everything matches.
  if (available === undefined) return true;
  return workout.equipment.every((item) => available.includes(item));
}

/** Take up to `n` distinct-by-id workouts, preserving seed order. */
function takeDistinct(workouts: readonly Workout[], n: number): Workout[] {
  const seen = new Set<string>();
  const out: Workout[] = [];
  for (const w of workouts) {
    if (out.length >= n) break;
    if (!seen.has(w.id)) {
      seen.add(w.id);
      out.push(w);
    }
  }
  return out;
}

export class WorkoutCatalog implements Pick<Catalog, 'findWorkouts'> {
  private readonly seeded: readonly Workout[] = seedWorkouts().map((s) => s.workout);

  findWorkouts(tier: IntensityTier, prefs: WorkoutPreferences, n: number): CatalogResult<Workout> {
    const available = prefs.availableEquipment;

    // Full constraint set: exactly at `tier` AND satisfying the equipment preference.
    const atTierMatching = this.seeded.filter(
      (w) => w.intensityTier === tier && equipmentSatisfied(w, available),
    );
    if (atTierMatching.length > 0) {
      const relaxed: readonly RelaxedConstraint[] = [];
      return { items: takeDistinct(atTierMatching, n), relaxed, satisfiable: true };
    }

    // FR-LIB-08: no at-tier workout satisfies the equipment preference — relax WORKOUT_PREFERENCE.
    // The intensity ceiling stays HARD: only at-or-below-tier workouts are offered, never above.
    const atOrBelow = this.seeded.filter((w) => TIER_RANK[w.intensityTier] <= TIER_RANK[tier]);
    const relaxed: readonly RelaxedConstraint[] = ['WORKOUT_PREFERENCE'];
    if (atOrBelow.length > 0) {
      return { items: takeDistinct(atOrBelow, n), relaxed, satisfiable: true };
    }
    // "Say so plainly": nothing at or below the tier fits — no candidate, never a ceiling violation.
    return { items: [], relaxed, satisfiable: false };
  }
}
