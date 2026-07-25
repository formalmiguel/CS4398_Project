/**
 * The server-local recommendation abstraction (§3.6 class diagram). A `RecommendationRule` is
 * ONE independent, registered mapping from metrics to a decision (FR-REC-11). It is a TYPE, not
 * an implementation — declaring the seam is allowed in a RED packet, exactly as packet 08
 * declared `WearableAdapter`.
 *
 * ⚠️ Division of labor (this is what makes FR-REC-06/11/13 testable in isolation, per packet 09):
 * a rule owns the PURE mapping (`apply`) and its own documented fallback VALUE (`fallback`). It
 * does NOT decide WHEN the fallback is used — the `RecommendationEngine` does, by checking
 * `requiredMetrics()` against the set and calling `apply` or `fallback` accordingly, then
 * attaching the reason. `apply → Decision` stays exactly as §3.6 draws it.
 */
import type { DailyMetricSet, Decision } from '@capstone/shared';

export interface RecommendationRule {
  /**
   * The metric names this rule consumes (FR-REC-11: a rule DECLARES the metrics it needs). The
   * engine reads this to decide availability — it never inspects the rule's content.
   */
  requiredMetrics(): string[];

  /**
   * The documented default decision, used by the engine when any required metric is unavailable
   * (FR-REC-06). This is a VALUE the rule owns; the engine owns the decision to use it.
   */
  fallback(): Decision;

  /**
   * The pure mapping from a Daily Metric Set to a decision, called by the engine only when every
   * required metric is available.
   */
  apply(metrics: DailyMetricSet): Decision;
}
