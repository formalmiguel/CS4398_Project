/**
 * 🔴 RED STUB (packet 09). Throws — carries NO logic. Packet 10 (GREEN) implements it.
 *
 * The server-local engine that evaluates registered rules WITHOUT knowledge of any rule's
 * content (FR-REC-11). Structured like `server/src/reschedule/`. Per §3.6 it exposes exactly
 * `register` and `recommend`; its `Catalog`/`SchedulingEngine` collaborators ("draws from",
 * "places via") are OUT of this packet's scope — that is FR-REC-03 (packet 11) and FR-REC-04
 * (packet 17). This builds only `recommend`/`register` over rules.
 *
 * ⚠️ The engine owns availability-checking and reason-building (FR-REC-06/13, NFR-ROB-01): for
 * each registered rule it inspects `requiredMetrics()` against the set, calls `apply` when all
 * are available or `fallback` when any is not, and attaches the `RecommendationReason` recording
 * whether a fallback was used and the driving metric name/value.
 */
import type { DailyMetricSet, Recommendation } from '@capstone/shared';

import type { RecommendationRule } from './RecommendationRule';

export class RecommendationEngine {
  register(_rule: RecommendationRule): void {
    throw new Error('not implemented');
  }

  recommend(_metrics: DailyMetricSet): Recommendation[] {
    throw new Error('not implemented');
  }
}
