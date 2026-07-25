/**
 * 🟢 GREEN (packet 10). Maps sleep score to a `WORKOUT_INTENSITY` intensity tier (FR-REC-01),
 * with the documented MODERATE fallback (FR-REC-06). The rule owns the pure mapping and the
 * fallback VALUE; the engine owns WHEN the fallback is used.
 *
 * FR-REC-01 boundaries are EXACT (NFR-COR-04): 0–49 → LOW, 50–74 → MODERATE, 75–100 → HIGH.
 */
import type { DailyMetricSet, Decision } from '@capstone/shared';

import type { RecommendationRule } from './RecommendationRule';

const SLEEP_SCORE = 'sleepScore';

export class SleepToIntensityRule implements RecommendationRule {
  requiredMetrics(): string[] {
    return [SLEEP_SCORE];
  }

  fallback(): Decision {
    return { kind: 'WORKOUT_INTENSITY', tier: 'MODERATE' };
  }

  apply(metrics: DailyMetricSet): Decision {
    const metric = metrics.metrics[SLEEP_SCORE];
    // The engine only calls apply when the metric is available; narrowing keeps the union honest
    // (NFR-ROB-01) and falls back defensively rather than reading a value that cannot exist.
    if (metric?.isAvailable !== true) {
      return this.fallback();
    }
    const tier =
      metric.value <= 49 ? 'LOW' : metric.value <= 74 ? 'MODERATE' : 'HIGH';
    return { kind: 'WORKOUT_INTENSITY', tier };
  }
}
