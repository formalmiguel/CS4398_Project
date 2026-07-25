/**
 * 🔴 RED STUB (packet 09). Every method throws — carries NO logic. Packet 10 (GREEN) derives
 * the computation from the frozen tests.
 *
 * FR-REC-08: computes the daily calorie target as baseline + active calories for the date, and
 * produces a `CALORIE_TARGET` decision. The baseline is constructor state — a user preference
 * (FR-REC-09), NOT a metric; the System asks for it and never estimates it (CON-05, §4.9).
 * FR-REC-06 documented default when activeCalories is unavailable: the baseline target.
 */
import type { CalorieTarget, DailyMetricSet, Decision } from '@capstone/shared';

import type { RecommendationRule } from './RecommendationRule';

export class CaloriesToTargetRule implements RecommendationRule {
  constructor(private readonly baseline: CalorieTarget) {}

  requiredMetrics(): string[] {
    throw new Error('not implemented');
  }

  fallback(): Decision {
    throw new Error('not implemented');
  }

  apply(_metrics: DailyMetricSet): Decision {
    throw new Error('not implemented');
  }
}
