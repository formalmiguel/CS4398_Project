/**
 * 🟢 GREEN (packet 10). Computes the daily calorie target as baseline + active calories for the
 * date (FR-REC-08), producing a `CALORIE_TARGET` decision. The baseline is constructor state — a
 * user preference (FR-REC-09), NOT a metric; the System asks for it and never estimates it
 * (CON-05, §4.9). FR-REC-06 documented default when activeCalories is unavailable: the baseline
 * target. A MEASURED zero (a real rest day) yields the baseline exactly — a real result, distinct
 * from the unavailable fallback, which the engine labels differently (DR-02).
 */
import type { CalorieTarget, DailyMetricSet, Decision } from '@capstone/shared';

import type { RecommendationRule } from './RecommendationRule';

const ACTIVE_CALORIES = 'activeCalories';

export class CaloriesToTargetRule implements RecommendationRule {
  constructor(private readonly baseline: CalorieTarget) {}

  requiredMetrics(): string[] {
    return [ACTIVE_CALORIES];
  }

  fallback(): Decision {
    return { kind: 'CALORIE_TARGET', calorieTarget: this.baseline };
  }

  apply(metrics: DailyMetricSet): Decision {
    const metric = metrics.metrics[ACTIVE_CALORIES];
    // The engine only calls apply when the metric is available; narrowing keeps the union honest
    // (NFR-ROB-01) rather than reading a value the unavailable branch does not carry.
    if (metric?.isAvailable !== true) {
      return this.fallback();
    }
    return { kind: 'CALORIE_TARGET', calorieTarget: this.baseline + metric.value };
  }
}
