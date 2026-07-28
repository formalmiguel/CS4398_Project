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
import type { IsoDate, Placement, PlacementStatus } from '@capstone/shared';

export interface HabitAnalytics {
  /** FR-ANL-01: consecutive completed occurrences ending at the most recent resolved occurrence. */
  readonly streak: number;
  /** FR-ANL-02 numerator: distinct dates in the period whose occurrence resolved COMPLETED. */
  readonly completed: number;
  /**
   * FR-ANL-02 denominator: distinct dates in the period whose occurrence has RESOLVED as of `asOf` —
   * a date is resolved if it carries a terminal outcome (COMPLETED / MISSED / SKIPPED) OR is a
   * still-PLANNED date whose window has already ELAPSED (v2.31). A not-yet-elapsed PLANNED date is
   * excluded (it has not happened); an elapsed-but-not-yet-swept PLANNED date is a miss and IS counted.
   */
  readonly scheduled: number;
  /** completed / scheduled; exactly 0 when scheduled === 0 (never NaN). */
  readonly completionRate: number;
}

/**
 * Analyze ONE recurring habit from all of its placements (every date, every status) over an inclusive
 * period, as observed at the instant `asOf`. Pure and total. 15b GREEN implements; this stub throws.
 *
 * `asOf` is the reference "now" for FR-ANL-02's "window has ELAPSED" test. It is PASSED IN and never
 * read from a clock — the same purity discipline as `schedulableDay` and `Task.createdAt` (§4.7). It
 * exists because FR-RSC-10 sweeps elapsed occurrences to MISSED only on retrieval, so a day the user
 * never opened is still PLANNED; without `asOf` the function could not tell that elapsed miss from a
 * genuinely future occurrence, and would understate the denominator (overstating the rate — OPEN-27's
 * shape, one layer down).
 */
export function analyzeHabit(
  placements: readonly Placement[],
  period: { readonly start: IsoDate; readonly end: IsoDate },
  asOf: IsoDate,
): HabitAnalytics {
  // FOLD: one entry per calendar date in the period, carrying the set of statuses seen on it.
  // The date — not the placement — is the unit of a streak and a completion rate, so an original
  // and its reschedule (and any withdrawn/superseded rows) collapse onto a single date here.
  // Dates are `YYYY-MM-DD`, so lexical comparison is calendar comparison — no clock, no parsing.
  const statusesByDate = new Map<IsoDate, Set<PlacementStatus>>();
  for (const placement of placements) {
    if (placement.date < period.start || placement.date > period.end) continue;
    const seen = statusesByDate.get(placement.date) ?? new Set<PlacementStatus>();
    seen.add(placement.status);
    statusesByDate.set(placement.date, seen);
  }

  // RESOLVE each date to exactly one outcome, then keep only the resolved ones in date order. An
  // UNRESOLVED date (a not-yet-elapsed PLANNED, or a CANCELLED/SUPERSEDED-only date) is absent
  // from the walk entirely: it neither counts toward a rate nor breaks a streak.
  const resolvedInOrder = [...statusesByDate.entries()]
    .map(([date, statuses]) => ({ date, resolution: resolveDate(statuses, date < asOf) }))
    .filter((entry): entry is ResolvedDate => entry.resolution !== 'UNRESOLVED')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const scheduled = resolvedInOrder.length;
  const completed = resolvedInOrder.filter((entry) => entry.resolution === 'COMPLETED').length;
  // Guarded so an empty period yields 0, never 0/0 = NaN (FR-ANL-02).
  const completionRate = scheduled === 0 ? 0 : completed / scheduled;

  // STREAK: from the latest resolved occurrence backward, count consecutive COMPLETED until the
  // first NOT_COMPLETED. The walk is over resolved *occurrences*, not calendar days — a weekly
  // habit has no occurrence on the six intervening days, so nothing there can break the run
  // (FR-ANL-01 read with FR-ANL-07).
  let streak = 0;
  for (const entry of [...resolvedInOrder].reverse()) {
    if (entry.resolution !== 'COMPLETED') break;
    streak++;
  }

  return { streak, completed, scheduled, completionRate };
}

type DateResolution = 'COMPLETED' | 'NOT_COMPLETED' | 'UNRESOLVED';
interface ResolvedDate {
  readonly date: IsoDate;
  readonly resolution: 'COMPLETED' | 'NOT_COMPLETED';
}

/**
 * Fold one date's statuses to a single outcome. The ladder is strict and its order is the whole
 * of FR-ANL-03/06 + FR-RSC-09 + FR-ANL-07:
 *   COMPLETED wins over everything (a rescheduled-then-completed date is completed; a withdrawn
 *   CANCELLED next to it cannot un-complete it) → else a terminal MISSED/SKIPPED is a miss → else
 *   a PLANNED whose window has ELAPSED as of `asOf` is a miss even if FR-RSC-10 has not swept it
 *   → else UNRESOLVED. CANCELLED and SUPERSEDED never appear here, so they are inert: they can
 *   neither add a scheduled date nor change one's outcome.
 */
const resolveDate = (statuses: ReadonlySet<PlacementStatus>, elapsed: boolean): DateResolution => {
  if (statuses.has('COMPLETED')) return 'COMPLETED';
  if (statuses.has('MISSED') || statuses.has('SKIPPED')) return 'NOT_COMPLETED';
  if (statuses.has('PLANNED') && elapsed) return 'NOT_COMPLETED';
  return 'UNRESOLVED';
};
