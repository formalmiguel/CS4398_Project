/**
 * 🔴 RED (packet 11) — FR-LIB-04 (deterministic, total tier mapping) and FR-LIB-03 (per-tier
 * duration + required fields). Every test fails because `resolveIntensityTier` and `seedWorkouts`
 * THROW; 11b (GREEN) derives the mapping and the seed from these assertions.
 *
 * The mapping under test is decision B (SRS v2.29 / decision log 27 Jul), transcribed VERBATIM —
 * not re-derived here:
 *   1. category === 'stretching'   → LOW
 *   2. else category === 'plyometrics' → HIGH
 *   3. else by level: beginner → LOW, intermediate → MODERATE, expert → HIGH
 * and decision C for duration: LOW = 20, MODERATE = 30, HIGH = 45 minutes.
 */
import type { IntensityTier } from '@capstone/shared';

import { resolveIntensityTier } from '../../src/catalog/intensityTier';
import { seedWorkouts } from '../../src/catalog/WorkoutCatalog';

// The six source categories and three levels of free-exercise-db (decision A).
const CATEGORIES = [
  'strength',
  'stretching',
  'plyometrics',
  'cardio',
  'powerlifting',
  'strongman',
] as const;
const LEVELS = ['beginner', 'intermediate', 'expert'] as const;

const VALID_TIERS: readonly IntensityTier[] = ['LOW', 'MODERATE', 'HIGH'];

// The FULL truth table for decision B, total over every category × level (18 rows). This is the
// pinned mapping — a run may NOT author its own (§0.1).
const MAPPING: ReadonlyArray<readonly [(typeof CATEGORIES)[number], (typeof LEVELS)[number], IntensityTier]> = [
  ['strength', 'beginner', 'LOW'],
  ['strength', 'intermediate', 'MODERATE'],
  ['strength', 'expert', 'HIGH'],
  ['stretching', 'beginner', 'LOW'],
  ['stretching', 'intermediate', 'LOW'],
  ['stretching', 'expert', 'LOW'],
  ['plyometrics', 'beginner', 'HIGH'],
  ['plyometrics', 'intermediate', 'HIGH'],
  ['plyometrics', 'expert', 'HIGH'],
  ['cardio', 'beginner', 'LOW'],
  ['cardio', 'intermediate', 'MODERATE'],
  ['cardio', 'expert', 'HIGH'],
  ['powerlifting', 'beginner', 'LOW'],
  ['powerlifting', 'intermediate', 'MODERATE'],
  ['powerlifting', 'expert', 'HIGH'],
  ['strongman', 'beginner', 'LOW'],
  ['strongman', 'intermediate', 'MODERATE'],
  ['strongman', 'expert', 'HIGH'],
];

const DURATION_FOR_TIER: Readonly<Record<IntensityTier, number>> = {
  LOW: 20,
  MODERATE: 30,
  HIGH: 45,
};

describe('resolveIntensityTier — FR-LIB-04 (documented, deterministic, total)', () => {
  // The representative-item-per-category cases the SRS verification clause names explicitly.
  it('FR-LIB-04: a beginner stretching exercise resolves to LOW', () => {
    expect(resolveIntensityTier('stretching', 'beginner')).toBe('LOW');
  });
  it('FR-LIB-04: an expert stretching exercise resolves to LOW (stretching overrides level)', () => {
    expect(resolveIntensityTier('stretching', 'expert')).toBe('LOW');
  });
  it('FR-LIB-04: a beginner strength exercise resolves to LOW', () => {
    expect(resolveIntensityTier('strength', 'beginner')).toBe('LOW');
  });
  it('FR-LIB-04: an intermediate cardio exercise resolves to MODERATE', () => {
    expect(resolveIntensityTier('cardio', 'intermediate')).toBe('MODERATE');
  });
  it('FR-LIB-04: an expert strength exercise resolves to HIGH', () => {
    expect(resolveIntensityTier('strength', 'expert')).toBe('HIGH');
  });
  it('FR-LIB-04: a beginner plyometrics exercise resolves to HIGH (plyometrics overrides level)', () => {
    expect(resolveIntensityTier('plyometrics', 'beginner')).toBe('HIGH');
  });
  it('FR-LIB-04: an intermediate powerlifting exercise resolves to MODERATE', () => {
    expect(resolveIntensityTier('powerlifting', 'intermediate')).toBe('MODERATE');
  });
  it('FR-LIB-04: an expert strongman exercise resolves to HIGH', () => {
    expect(resolveIntensityTier('strongman', 'expert')).toBe('HIGH');
  });

  // The mapping is TOTAL: every category × level resolves, and to exactly the decision-B tier.
  it.each(MAPPING)(
    'FR-LIB-04: (%s, %s) resolves to %s — the mapping is total over every category × level',
    (category, level, expected) => {
      expect(resolveIntensityTier(category, level)).toBe(expected);
    },
  );

  it.each(MAPPING)(
    'FR-LIB-04: (%s, %s) resolves to exactly one of the three tier values',
    (category, level) => {
      expect(VALID_TIERS).toContain(resolveIntensityTier(category, level));
    },
  );
});

describe('the seeded workout library — FR-LIB-04 / FR-LIB-03', () => {
  // FR-LIB-04 verification clause: EVERY seeded workout resolves to exactly one tier, and its
  // stored tier equals the mapping applied to its own source record. RED because seedWorkouts throws.
  it('FR-LIB-04: every seeded workout has a stored tier equal to resolveIntensityTier of its source', () => {
    const seeded = seedWorkouts();
    expect(seeded.length).toBeGreaterThan(0);
    for (const { workout, source } of seeded) {
      expect(VALID_TIERS).toContain(workout.intensityTier);
      expect(workout.intensityTier).toBe(resolveIntensityTier(source.category, source.level));
    }
  });

  // FR-LIB-03 typical duration (decision C), keyed off the resolved tier.
  it('FR-LIB-03: every seeded workout has the typical duration for its tier (LOW 20 / MODERATE 30 / HIGH 45)', () => {
    const seeded = seedWorkouts();
    expect(seeded.length).toBeGreaterThan(0);
    for (const { workout } of seeded) {
      expect(workout.typicalDurationMinutes).toBe(DURATION_FOR_TIER[workout.intensityTier]);
    }
  });

  // FR-LIB-03 required fields: name, intensity tier, typical duration, equipment, target area —
  // each PRESENT. Name / target area / duration must additionally be non-empty; `equipment` is
  // asserted present (an array) but NOT non-empty, because a bodyweight exercise legitimately
  // requires no equipment (free-exercise-db's "body only" / null case) and forcing a sentinel
  // there would fabricate data. (Deliberate narrowing of the packet's "non-empty" wording for
  // this one field — flagged in the report; the SRS asks the field be carried, not be non-empty.)
  it('FR-LIB-03: every seeded workout carries name, tier, duration, equipment, and target area', () => {
    const seeded = seedWorkouts();
    expect(seeded.length).toBeGreaterThan(0);
    for (const { workout } of seeded) {
      expect(workout.id).toBeTruthy();
      expect(workout.name.trim().length).toBeGreaterThan(0);
      expect(VALID_TIERS).toContain(workout.intensityTier);
      expect(workout.typicalDurationMinutes).toBeGreaterThan(0);
      expect(Array.isArray(workout.equipment)).toBe(true);
      expect(workout.targetArea.trim().length).toBeGreaterThan(0);
    }
  });
});
