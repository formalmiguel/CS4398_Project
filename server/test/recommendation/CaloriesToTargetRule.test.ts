/**
 * 🔴 RED (packet 09) — FR-REC-08 (daily calorie target = baseline + active calories), FR-REC-13
 * (reason substrate), NFR-COR-04 (correct at the boundary), DR-02 (the measured zero).
 *
 * These tests fail because `CaloriesToTargetRule`'s methods THROW — the RED contract. Packet 10
 * (GREEN) derives the computation from exactly these assertions.
 *
 * DIVISION OF LABOR: this rule owns the pure `apply` arithmetic and its fallback VALUE. The
 * ENGINE owns whether a fallback was used and records it in the reason (usedFallback / metricValue
 * null-vs-zero) — that measured-zero-vs-unavailable DISTINCTION is asserted in
 * RecommendationEngine.test.ts, because DR-02 is a fact about the reason, not the number. Here the
 * measured zero is pinned only as an `apply` arithmetic case (target moves by exactly 0).
 *
 * The baseline is CONSTRUCTOR state — a user preference (FR-REC-09), not a metric. The rule
 * receives it and never asks for or stores it (CON-05, §4.9).
 */
import type { DailyMetricSet, Metric } from '@capstone/shared';

import { CaloriesToTargetRule } from '../../src/recommendation/CaloriesToTargetRule';

const activeCalories = (value: number): Metric => ({
  name: 'activeCalories',
  unit: 'kcal',
  origin: 'EXPORT',
  isAvailable: true,
  value,
});

const dayWithCalories = (value: number): DailyMetricSet => ({
  date: '2026-03-10',
  metrics: { activeCalories: activeCalories(value) },
});

describe('CaloriesToTargetRule', () => {
  const BASELINE = 2000;
  const rule = new CaloriesToTargetRule(BASELINE);

  // FR-REC-08 / NFR-COR-04 — the target is baseline + active calories, EXACTLY. Each case
  // asserts the target moved by exactly the injected amount.
  const cases: ReadonlyArray<readonly [number, number]> = [
    [850, BASELINE + 850],
    [1200, BASELINE + 1200],
    [1, BASELINE + 1],
  ];

  it.each(cases)(
    'FR-REC-08: %i active calories moves the target to exactly %i',
    (burned, expected) => {
      expect(rule.apply(dayWithCalories(burned))).toEqual({
        kind: 'CALORIE_TARGET',
        calorieTarget: expected,
      });
    },
  );

  it('FR-REC-08 / DR-02: a MEASURED zero (a real rest day) moves the target by exactly 0', () => {
    // A genuine apply() result — active calories were recorded and happened to be 0. This is NOT
    // the unavailable case (that is the engine's fallback, asserted in the engine suite). The
    // number equals the baseline here, but the REASON will differ from unavailable — that is the
    // whole point of DR-02.
    expect(rule.apply(dayWithCalories(0))).toEqual({
      kind: 'CALORIE_TARGET',
      calorieTarget: BASELINE,
    });
  });

  it('FR-REC-08: apply produces a CALORIE_TARGET decision (the kind, not just the number)', () => {
    expect(rule.apply(dayWithCalories(500)).kind).toBe('CALORIE_TARGET');
  });

  it('FR-REC-11: the rule declares the single metric it consumes', () => {
    expect(rule.requiredMetrics()).toEqual(['activeCalories']);
  });

  it('FR-REC-06: the documented fallback is the baseline target unchanged', () => {
    // The VALUE only — the engine decides WHEN this is used, when activeCalories is unavailable.
    expect(rule.fallback()).toEqual({ kind: 'CALORIE_TARGET', calorieTarget: BASELINE });
  });
});
