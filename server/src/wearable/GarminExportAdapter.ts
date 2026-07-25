/**
 * 🔴 RED STUB (packet 08). Every method THROWS. 08b GREEN derives the real body from the
 * frozen tests in `server/test/wearable/GarminExportAdapter.test.ts` — it does not exist yet.
 *
 * ⚠️ A stub returns nothing and computes nothing. If a method here parses JSON, joins the two
 * source arrays, or decides availability, it is the IMPLEMENTATION and this packet is
 * compromised (CLAUDE.md §8.3). The whole point of RED is that the answer lives in the tests,
 * not here.
 *
 * The raw `Garmin*` types below are SOURCE-SPECIFIC and live HERE, behind the adapter, on
 * purpose (FR-WER-05): they are the only place in the System that knows the Garmin export's
 * shape. Nothing downstream imports them — downstream sees `DailyMetricSet` only. They are
 * type declarations, not logic, so they are allowed in RED.
 */
import type { DailyMetricSet, IsoDate, Metric } from '@capstone/shared';

import type { WearableAdapter } from './WearableAdapter';

// ─── The two Garmin source files' relevant keys (OPEN-01/02/20) ──────────────
//
// Real files: `DI-Connect-Aggregator/UDSFile_*.json` (activity) and
// `DI-Connect-Wellness/…_sleepData.json` (sleep), joined on `calendarDate`.
// The real export never enters the repo (§8.4); fixtures are DERIVED from these shapes.

/** One daily aggregator record. */
export interface GarminActivityRecord {
  /** `YYYY-MM-DD` — already the contract's `IsoDate` form. */
  readonly calendarDate: string;
  readonly activeKilocalories: number;
  /**
   * OPEN-20 discriminator: PRESENCE of this key decides whether `activeKilocalories: 0` is a
   * measured zero (present) or unavailable (absent). Its VALUE is not the signal — presence is.
   */
  readonly totalSteps?: number;
  /**
   * ⛔ NOT the discriminator. It carries 721 kcal with `false` on a real 2026-02-13 record — it
   * tracks something else. OPEN-20 is a team decision; an agent must not substitute this for
   * `totalSteps`.
   */
  readonly includesActivityData?: boolean;
  /**
   * ⛔ CON-05 / §4.9: the System ASKS the user for a calorie baseline; it is not a medical
   * device. `bmrKilocalories` is in the export and must NEVER seed a metric. Present in the
   * type only so a test can prove the adapter ignores it.
   */
  readonly bmrKilocalories?: number;
}

export interface GarminSleepScores {
  /**
   * Integer 0–100. Present only when the night was scored. On an unscored night the KEY is
   * ABSENT (never `null` — the real export does not emit a null score), and `sleepScores`
   * carries feedback/insight instead. Availability therefore gates on `'overallScore' in
   * sleepScores`, NOT on `!= null` (OPEN-26). This holds even on an `ENHANCED_CONFIRMED_FINAL`
   * record — a confirmed-final night can still be unscored.
   */
  readonly overallScore?: number;
  readonly feedback?: string;
  readonly insight?: string;
}

/** One nightly sleep record. */
export interface GarminSleepRecord {
  readonly calendarDate: string;
  readonly sleepScores: GarminSleepScores;
  /** e.g. `ENHANCED_CONFIRMED_FINAL`. Carried for fidelity; availability keys on the score key, not this. */
  readonly sleepResultType?: string;
}

/** The derived export bundle: the two source files' relevant records. */
export interface GarminExport {
  readonly activity: readonly GarminActivityRecord[];
  readonly sleep: readonly GarminSleepRecord[];
}

export class GarminExportAdapter implements WearableAdapter {
  constructor(private readonly source: GarminExport) {}

  /**
   * Parse the whole export into one `DailyMetricSet` per `calendarDate` (the union of dates
   * across both sources). FR-WER-02/03/06, DR-02. This is the ingestion path — the caller hands
   * the result to `MetricStore.ingest`.
   */
  toMetricSets(): DailyMetricSet[] {
    // The union of dates across both sources (FR-WER-02). A date in only one source still
    // yields BOTH metrics — the missing side is recorded unavailable, never fabricated
    // (FR-WER-06). Grouping by date is also what collapses a stray duplicate calendarDate to a
    // single set (OPEN-26); which record wins is deliberately not resolved (`find` takes the
    // first), because the store's upsert — not the adapter — owns last-write-wins.
    const dates = new Set<string>();
    for (const record of this.source.activity) dates.add(record.calendarDate);
    for (const record of this.source.sleep) dates.add(record.calendarDate);

    return [...dates].map((date) => ({
      date,
      metrics: {
        activeCalories: this.activeCaloriesFor(date),
        sleepScore: this.sleepScoreFor(date),
      },
    }));
  }

  /**
   * OPEN-20: availability is the PRESENCE of `totalSteps`, not its value and not
   * `includesActivityData`. Present → available (a real `0` is a measured zero); absent →
   * unavailable. `bmrKilocalories` is never read (CON-05 / §4.9).
   */
  private activeCaloriesFor(date: string): Metric {
    const record = this.source.activity.find((a) => a.calendarDate === date);
    if (record !== undefined && 'totalSteps' in record) {
      return {
        name: 'activeCalories',
        unit: 'kcal',
        origin: 'EXPORT',
        isAvailable: true,
        value: record.activeKilocalories,
      };
    }
    return { name: 'activeCalories', unit: 'kcal', origin: 'EXPORT', isAvailable: false };
  }

  /**
   * Availability gates on `'overallScore' in sleepScores` (FR-WER-06 / DR-02), NOT on `!= null`:
   * an unscored night carries a present `sleepScores` object with feedback/insight and no score
   * key, and the real export never emits a null score.
   */
  private sleepScoreFor(date: string): Metric {
    const record = this.source.sleep.find((s) => s.calendarDate === date);
    if (record !== undefined && 'overallScore' in record.sleepScores) {
      return {
        name: 'sleepScore',
        unit: 'score',
        origin: 'EXPORT',
        isAvailable: true,
        value: record.sleepScores.overallScore,
      };
    }
    return { name: 'sleepScore', unit: 'score', origin: 'EXPORT', isAvailable: false };
  }

  /**
   * FR-WER-01: resolve one date to its normalized set. Source-indifference is structural — the
   * caller holds a `WearableAdapter` and cannot tell Garmin from a live API.
   */
  async fetch(_userId: string, date: IsoDate): Promise<DailyMetricSet> {
    const set = this.toMetricSets().find((s) => s.date === date);
    if (set === undefined) throw new Error(`no DailyMetricSet for ${date}`);
    return set;
  }
}
