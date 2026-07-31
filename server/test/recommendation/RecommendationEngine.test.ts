/**
 * 🔴 RED (packet 09) — FR-REC-06 (documented fallback + "no current data" label), FR-REC-11
 * (independent registered rules; engine evaluates them content-agnostically), FR-REC-13 (reason
 * naming metric + value), NFR-ROB-01 (missing data never silently substituted; absent vs measured
 * zero stay distinguishable).
 *
 * These tests fail because `RecommendationEngine`'s `register`/`recommend` THROW — the RED
 * contract. Packet 10 (GREEN) derives the behavior from exactly these assertions.
 *
 * THE DIVISION OF LABOR UNDER TEST (packet 09): a RULE owns `apply` and its fallback VALUE; the
 * ENGINE owns availability-checking and reason-building. It inspects `requiredMetrics()` against
 * the set, calls `apply` when all are available (reason: usedFallback false, the driving
 * metricName/metricValue) or `fallback` when any is not (reason: usedFallback true,
 * metricValue null), and bundles each `Decision` with its `RecommendationReason`.
 *
 * SCOPE NOTE (a judgment call, reported to Ryan): `RecommendationReason` carries a SINGLE
 * metricName/metricValue while `requiredMetrics()` is an array. Which metric drives the reason
 * for a MULTI-metric rule is unspecified by FR-REC-13, so this suite exercises only single-metric
 * rules (both real rules, and the dummy, declare exactly one) — it does not invent a
 * multi-metric reason rule.
 *
 * Recommendations are read via `recs[0]?.` after an explicit `toHaveLength` — the root tsconfig's
 * noUncheckedIndexedAccess types an indexed element as possibly-undefined, and this matches the
 * sibling MetricStore.test.ts idiom while keeping each assertion strong (an empty result fails the
 * optional-chained toEqual).
 */
import type { DailyMetricSet, Decision, Metric } from '@capstone/shared';

import { RecommendationEngine } from '../../src/recommendation/RecommendationEngine';
import { RecommendationRule } from '../../src/recommendation/RecommendationRule';
import { SleepToIntensityRule } from '../../src/recommendation/SleepToIntensityRule';
import { CaloriesToTargetRule } from '../../src/recommendation/CaloriesToTargetRule';

const BASELINE = 2000;

const available = (name: string, unit: string, value: number): Metric => ({
  name,
  unit,
  origin: 'EXPORT',
  isAvailable: true,
  value,
});

const unavailable = (name: string, unit: string): Metric => ({
  name,
  unit,
  origin: 'EXPORT',
  isAvailable: false,
});

const setOf = (date: string, metrics: Record<string, Metric>): DailyMetricSet => ({ date, metrics });

/**
 * A TEST DOUBLE — not the System's logic. It returns CANNED decisions and declares a metric no
 * real rule uses ('stressLevel'). Its only job is to prove FR-REC-11: an arbitrary rule the
 * engine has never seen flows through `recommend` unchanged, with no edit to the engine. This is
 * the property packet 16b's guard later enforces by inspection.
 */
class DummyStressRule implements RecommendationRule {
  static readonly APPLIED: Decision = { kind: 'CALORIE_TARGET', calorieTarget: 12345 };
  static readonly FALLEN_BACK: Decision = { kind: 'CALORIE_TARGET', calorieTarget: -1 };

  requiredMetrics(): string[] {
    return ['stressLevel'];
  }
  fallback(): Decision {
    return DummyStressRule.FALLEN_BACK;
  }
  apply(_metrics: DailyMetricSet): Decision {
    return DummyStressRule.APPLIED;
  }
}

describe('RecommendationEngine', () => {
  it('FR-REC-11: recommend returns exactly one recommendation per registered rule', () => {
    const engine = new RecommendationEngine();
    engine.register(new SleepToIntensityRule());
    engine.register(new CaloriesToTargetRule(BASELINE));

    const recs = engine.recommend(
      setOf('2026-03-10', {
        sleepScore: available('sleepScore', 'score', 80),
        activeCalories: available('activeCalories', 'kcal', 500),
      }),
    );
    expect(recs).toHaveLength(2);
  });

  it('FR-REC-13: every recommendation bundles a decision and a reason naming the metric', () => {
    const engine = new RecommendationEngine();
    engine.register(new SleepToIntensityRule());

    const recs = engine.recommend(
      setOf('2026-03-10', { sleepScore: available('sleepScore', 'score', 42) }),
    );
    expect(recs).toHaveLength(1);
    expect(recs[0]?.decision).toEqual({ kind: 'WORKOUT_INTENSITY', tier: 'LOW' });
    expect(recs[0]?.reason).toEqual({ metricName: 'sleepScore', metricValue: 42, usedFallback: false });
  });

  it('FR-REC-06 / NFR-ROB-01: an available metric makes the engine use apply and label usedFallback false', () => {
    const engine = new RecommendationEngine();
    engine.register(new SleepToIntensityRule());

    const recs = engine.recommend(
      setOf('2026-03-10', { sleepScore: available('sleepScore', 'score', 42) }),
    );
    expect(recs[0]?.reason.usedFallback).toBe(false);
    expect(recs[0]?.reason.metricValue).toBe(42);
  });

  it('FR-REC-06 / NFR-ROB-01: an unavailable metric makes the engine use the fallback and say so (usedFallback true, metricValue null)', () => {
    const engine = new RecommendationEngine();
    engine.register(new SleepToIntensityRule());

    const recs = engine.recommend(
      setOf('2026-03-10', { sleepScore: unavailable('sleepScore', 'score') }),
    );
    // Fallback VALUE is the rule's MODERATE default (FR-REC-06); the "no current data" LABEL is
    // the engine's usedFallback flag with a null metricValue.
    expect(recs[0]?.decision).toEqual({ kind: 'WORKOUT_INTENSITY', tier: 'MODERATE' });
    expect(recs[0]?.reason).toEqual({ metricName: 'sleepScore', metricValue: null, usedFallback: true });
  });

  it('FR-REC-06: a rule whose metric is unavailable still yields a recommendation — never an error or an empty slot', () => {
    const engine = new RecommendationEngine();
    engine.register(new SleepToIntensityRule());

    const recs = engine.recommend(
      setOf('2026-03-10', { sleepScore: unavailable('sleepScore', 'score') }),
    );
    expect(recs).toHaveLength(1); // not [], and recommend did not throw for want of a metric
  });

  it('DR-02 / NFR-ROB-01: a measured zero and an unavailable metric yield the SAME target but DIFFERENT reasons', () => {
    const engine = new RecommendationEngine();
    engine.register(new CaloriesToTargetRule(BASELINE));

    const measuredZero = engine.recommend(
      setOf('2026-03-10', { activeCalories: available('activeCalories', 'kcal', 0) }),
    );
    const absent = engine.recommend(
      setOf('2026-03-11', { activeCalories: unavailable('activeCalories', 'kcal') }),
    );

    // Same number...
    expect(measuredZero[0]?.decision).toEqual({ kind: 'CALORIE_TARGET', calorieTarget: BASELINE });
    expect(absent[0]?.decision).toEqual({ kind: 'CALORIE_TARGET', calorieTarget: BASELINE });

    // ...different reason. This distinction is the whole point of DR-02: a real rest day is not a
    // watch left on the nightstand.
    expect(measuredZero[0]?.reason).toEqual({
      metricName: 'activeCalories',
      metricValue: 0,
      usedFallback: false,
    });
    expect(absent[0]?.reason).toEqual({
      metricName: 'activeCalories',
      metricValue: null,
      usedFallback: true,
    });
  });

  it('FR-REC-11: a rule the engine has never seen flows through recommend unchanged (content-agnostic)', () => {
    const engine = new RecommendationEngine();
    engine.register(new DummyStressRule());

    const recs = engine.recommend(
      setOf('2026-03-10', { stressLevel: available('stressLevel', 'index', 30) }),
    );
    // The engine returned the dummy's OWN apply() decision without branching on the rule's
    // identity — adding a rule was register() only, no engine edit.
    expect(recs[0]?.decision).toEqual(DummyStressRule.APPLIED);
    expect(recs[0]?.reason).toEqual({ metricName: 'stressLevel', metricValue: 30, usedFallback: false });
  });

  it('FR-REC-11: the same unseen rule falls back content-agnostically when its metric is absent', () => {
    const engine = new RecommendationEngine();
    engine.register(new DummyStressRule());

    const recs = engine.recommend(
      setOf('2026-03-10', { stressLevel: unavailable('stressLevel', 'index') }),
    );
    expect(recs[0]?.decision).toEqual(DummyStressRule.FALLEN_BACK);
    expect(recs[0]?.reason).toEqual({ metricName: 'stressLevel', metricValue: null, usedFallback: true });
  });
});
