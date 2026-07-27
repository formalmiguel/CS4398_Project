/**
 * 🔴 RED STUB (packet 15a). Every path THROWS. 15b GREEN derives the real body from the frozen
 * tests in `server/test/analytics/HabitAnalytics.test.ts`.
 *
 * PURE, like the engine (FR-SCH-05's discipline applied to analytics): no clock, no DB, no I/O.
 * It reads only the `Placement` rows it is handed, so FR-ANL-01/02/03/06 are property-testable over
 * in-memory data with no Mongo (§4.8). The GREEN session may add private helpers here but MUST NOT
 * touch the test suite (§4.6).
 *
 * ⚠️ The load-bearing logic is the PER-DATE FOLD: one calendar date may carry several placements (an
 * original plus a reschedule, a withdrawn CANCELLED reschedule, a SUPERSEDED replacement). The date —
 * not the placement — is the unit of a streak and of a completion rate. Getting that fold right is
 * the whole of FR-ANL-03/06 and FR-RSC-09, and it is exactly what the frozen suite pins.
 */
import type { IsoDate, Placement } from '@capstone/shared';

export interface HabitAnalytics {
  /** FR-ANL-01: consecutive completed occurrences ending at the most recent resolved occurrence. */
  readonly streak: number;
  /** FR-ANL-02 numerator: distinct dates in the period whose occurrence resolved COMPLETED. */
  readonly completed: number;
  /** FR-ANL-02 denominator: distinct dates in the period whose occurrence RESOLVED (done or not). */
  readonly scheduled: number;
  /** completed / scheduled; exactly 0 when scheduled === 0 (never NaN). */
  readonly completionRate: number;
}

/**
 * Analyze ONE recurring habit from all of its placements (every date, every status) over an inclusive
 * period. Pure and total. 15b GREEN implements; this stub throws.
 */
export function analyzeHabit(
  _placements: readonly Placement[],
  _period: { readonly start: IsoDate; readonly end: IsoDate },
): HabitAnalytics {
  throw new Error('15b');
}
