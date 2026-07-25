/**
 * 🔴 RED STUB (packet 09). Every method throws — carries NO logic. Packet 10 (GREEN) derives
 * the mapping from the frozen tests.
 *
 * FR-REC-01: maps sleep score to a `WORKOUT_INTENSITY` intensity tier. FR-REC-06 documented
 * default when sleepScore is unavailable: MODERATE (the rule owns the VALUE; the engine owns
 * WHEN it is used).
 */
import type { DailyMetricSet, Decision } from '@capstone/shared';

import type { RecommendationRule } from './RecommendationRule';

export class SleepToIntensityRule implements RecommendationRule {
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
