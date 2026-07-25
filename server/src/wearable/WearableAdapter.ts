/**
 * THE wearable adapter port. FR-WER-05: "All data sources shall sit behind a single adapter
 * interface whose output is the Daily Metric Set. No component downstream shall reference a
 * source-specific field, file format, or API response shape."
 *
 * This is a TYPE, not an implementation — declaring the seam is allowed in a RED packet (08).
 * The Garmin export adapter (08b) and, later, a live-API adapter (FR-WER-11) both implement it,
 * and downstream code depends on THIS, never on either implementer. FR-WER-01's "indifferent to
 * which source supplied it" is exactly this indirection: a caller holds a `WearableAdapter` and
 * asks for a date; it cannot tell Garmin from a live API from an injected value.
 */
import type { DailyMetricSet, IsoDate } from '@capstone/shared';

export interface WearableAdapter {
  /**
   * FR-WER-01: obtain the user's health data for one date, already normalized into the
   * Daily Metric Set (FR-WER-02) — the ONLY representation any downstream component sees.
   */
  fetch(userId: string, date: IsoDate): Promise<DailyMetricSet>;
}
