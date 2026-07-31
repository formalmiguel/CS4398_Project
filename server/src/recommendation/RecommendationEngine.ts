/**
 * 🟢 GREEN (packet 10). The server-local engine that evaluates registered rules WITHOUT knowledge
 * of any rule's content (FR-REC-11). Structured like `server/src/reschedule/`. Per §3.6 it exposes
 * exactly `register` and `recommend`; its `Catalog`/`SchedulingEngine` collaborators ("draws from",
 * "places via") are OUT of this packet's scope — that is FR-REC-03 (packet 11) and FR-REC-04
 * (packet 17). This builds only `recommend`/`register` over rules.
 *
 * ⚠️ The engine owns availability-checking and reason-building (FR-REC-06/13, NFR-ROB-01): for
 * each registered rule it inspects `requiredMetrics()` against the set, calls `apply` when all
 * are available or `fallback` when any is not, and attaches the `RecommendationReason` recording
 * whether a fallback was used and the driving metric name/value.
 *
 * ⛔ FR-REC-11 content-agnostic: `recommend` calls ONLY the interface methods — it never branches
 * on a rule's identity or concrete type. A rule the engine has never seen flows through unchanged,
 * which is what makes "adding a metric is two additions, no modifications" true (packet 16b guard).
 */
import type {
  DailyMetricSet,
  Recommendation,
  RecommendationReason,
} from '@capstone/shared';

import type { RecommendationRule } from './RecommendationRule';

export class RecommendationEngine {
  private readonly rules: RecommendationRule[] = [];

  register(rule: RecommendationRule): void {
    this.rules.push(rule);
  }

  recommend(metrics: DailyMetricSet): Recommendation[] {
    return this.rules.map((rule) => {
      const required = rule.requiredMetrics();
      // FR-REC-13's reason substrate names a SINGLE driving metric; every rule in this release
      // declares exactly one (the suite exercises only single-metric rules).
      const metricName = required[0] ?? '';
      const allAvailable = required.every(
        (name) => metrics.metrics[name]?.isAvailable === true,
      );

      if (allAvailable) {
        const driver = metrics.metrics[metricName];
        const metricValue =
          driver?.isAvailable === true ? driver.value : null;
        const reason: RecommendationReason = {
          metricName,
          metricValue, // a measured 0 is preserved here — the DR-02 distinction from null
          usedFallback: false,
        };
        return { decision: rule.apply(metrics), reason };
      }

      const reason: RecommendationReason = {
        metricName,
        metricValue: null, // absent, NOT zero (NFR-ROB-01) — the "no current data" label
        usedFallback: true,
      };
      return { decision: rule.fallback(), reason };
    });
  }
}
