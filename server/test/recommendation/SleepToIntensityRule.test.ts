/**
 * 🔴 RED (packet 09) — FR-REC-01 (sleep score → intensity tier), FR-REC-13 (reason substrate),
 * NFR-COR-04 (correct AT THE BOUNDARIES).
 *
 * These tests fail because `SleepToIntensityRule`'s methods THROW — the RED contract. Packet 10
 * (GREEN) derives the mapping from exactly these assertions, and the freeze makes them permanent:
 * an off-by-one here becomes a permanent green off-by-one in the rule (packet 09 ATTENTION
 * ANCHOR). The four boundary values 49/50/74/75 are therefore asserted explicitly by value.
 *
 * The rule owns the pure mapping (`apply`) and its fallback VALUE (`fallback`); the ENGINE owns
 * WHEN the fallback is used and builds the reason — see RecommendationEngine.test.ts. So this
 * suite asserts `apply` against an AVAILABLE metric only, plus the fallback value in isolation.
 *
 * Metric builders are inlined (matching the sibling MetricStore.test.ts) so the whole suite lives
 * under the frozen path server/test/recommendation.
 */
import type { DailyMetricSet, IntensityTier, Metric } from '@capstone/shared';

import { SleepToIntensityRule } from '../../src/recommendation/SleepToIntensityRule';

const sleepMetric = (value: number): Metric => ({
  name: 'sleepScore',
  unit: 'score',
  origin: 'EXPORT',
  isAvailable: true,
  value,
});

const dayWithSleep = (value: number): DailyMetricSet => ({
  date: '2024-01-11',
  metrics: { sleepScore: sleepMetric(value) },
});

describe('SleepToIntensityRule', () => {
  const rule = new SleepToIntensityRule();

  // FR-REC-01 / NFR-COR-04 — the boundaries are EXACT: 49→LOW, 50→MODERATE, 74→MODERATE,
  // 75→HIGH. The endpoints 0/100 and one interior value per tier round out the table.
  const cases: ReadonlyArray<readonly [number, IntensityTier]> = [
    [0, 'LOW'],
    [25, 'LOW'],
    [49, 'LOW'],
    [50, 'MODERATE'],
    [60, 'MODERATE'],
    [74, 'MODERATE'],
    [75, 'HIGH'],
    [90, 'HIGH'],
    [100, 'HIGH'],
  ];

  it.each(cases)(
    'FR-REC-01: a sleep score of %i warrants the %s intensity tier',
    (score, tier) => {
      expect(rule.apply(dayWithSleep(score))).toEqual({ kind: 'WORKOUT_INTENSITY', tier });
    },
  );

  it('FR-REC-01: apply produces a WORKOUT_INTENSITY decision (the kind, not just the tier)', () => {
    expect(rule.apply(dayWithSleep(80)).kind).toBe('WORKOUT_INTENSITY');
  });

  it('FR-REC-11: the rule declares the single metric it consumes', () => {
    expect(rule.requiredMetrics()).toEqual(['sleepScore']);
  });

  it('FR-REC-06: the documented fallback is the MODERATE intensity decision', () => {
    // The VALUE only — the engine decides WHEN this is used (RecommendationEngine.test.ts).
    expect(rule.fallback()).toEqual({ kind: 'WORKOUT_INTENSITY', tier: 'MODERATE' });
  });
});
