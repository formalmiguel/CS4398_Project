/**
 * 🔴 RED STUB (packet 08). Every method THROWS. 08b GREEN derives the real body from the
 * frozen tests in `server/test/wearable/MetricStore.test.ts`.
 *
 * Persistence for the Daily Metric Set. Constructed from a `Db`, mirroring `UserStore` /
 * `TaskRepository` in this directory.
 *
 * ⛔ THE STORED SHAPE IS THE REQUIREMENT (DR-05): ONE document per metric per date, keyed on
 * `(userId, date, metricName)` — NEVER one document with a `sleepScore` field and an
 * `activeCalories` field. A schema-free store happily accepts the wrong shape; the tests, not
 * Mongo, forbid it (CLAUDE.md §4.4). Adding a third metric must then be an ADDITION — a new
 * document — with no change to the stored shape and no change to any existing reader.
 *
 * ⚠️ A stub returns nothing and computes nothing. If a method here upserts, dedupes, or maps a
 * metric to a document, it is the IMPLEMENTATION and this packet is compromised (§8.3).
 */
import { Collection, Db } from 'mongodb';

import type { DailyMetricSet, IsoDate, Metric, MetricOrigin } from '@capstone/shared';

/**
 * One stored document per metric per date (DR-05). The metric NAME is a stored VALUE (`name`),
 * never a column — that is the shape that keeps a third metric an ADDITION (§4.4). `value` is
 * present ONLY on the available branch (DR-02): its absence, not a sentinel, is "no data".
 */
interface MetricDocument {
  readonly userId: string;
  readonly date: IsoDate;
  readonly name: string;
  readonly unit: string;
  readonly origin: MetricOrigin;
  readonly isAvailable: boolean;
  readonly value?: number;
}

const toMetric = (doc: MetricDocument): Metric =>
  doc.isAvailable && doc.value !== undefined
    ? { name: doc.name, unit: doc.unit, origin: doc.origin, isAvailable: true, value: doc.value }
    : { name: doc.name, unit: doc.unit, origin: doc.origin, isAvailable: false };

export class MetricStore {
  private readonly metrics: Collection<MetricDocument>;

  constructor(db: Db) {
    this.metrics = db.collection<MetricDocument>('metrics');
  }

  /** The unique index that makes ingestion idempotent (FR-WER-09): `(userId, date, name)`. */
  async ensureIndexes(): Promise<void> {
    await this.metrics.createIndex({ userId: 1, date: 1, name: 1 }, { unique: true });
  }

  /**
   * FR-WER-09: idempotent. Upsert one document per metric in the set, keyed on
   * `(userId, date, name)`. Re-ingesting a date updates the existing documents in place (the
   * upsert IS last-write-wins); it never duplicates. DR-04: each document records the metric's
   * origin, including `INJECTED`. DR-02: the unavailable branch is persisted WITHOUT a `value`,
   * and a metric that becomes unavailable has any prior `value` unset rather than left stale.
   */
  async ingest(userId: string, set: DailyMetricSet): Promise<void> {
    for (const [name, metric] of Object.entries(set.metrics)) {
      const key = { userId, date: set.date, name };
      const base = { ...key, unit: metric.unit, origin: metric.origin, isAvailable: metric.isAvailable };
      if (metric.isAvailable) {
        await this.metrics.updateOne(key, { $set: { ...base, value: metric.value } }, { upsert: true });
      } else {
        await this.metrics.updateOne(key, { $set: base, $unset: { value: '' } }, { upsert: true });
      }
    }
  }

  /** Read the per-metric documents for a date back into a single `DailyMetricSet`. */
  async getDailyMetricSet(userId: string, date: IsoDate): Promise<DailyMetricSet> {
    const docs = await this.metrics.find({ userId, date }).toArray();
    const metrics: Record<string, Metric> = {};
    for (const doc of docs) metrics[doc.name] = toMetric(doc);
    return { date, metrics };
  }

  /**
   * FR-WEL-04: the stored metrics across the inclusive `[start, end]` date range, one
   * `DailyMetricSet` per date that HAS at least one record — built in a single query rather than
   * N single-date round trips. A date with no metric document is simply ABSENT from the result
   * (FR-WEL-05 / NFR-ROB-01: no record is "no data", never a fabricated zero — the caller must
   * decide how to present a gap, and cannot mistake absence for a measured value). Ascending by
   * date, so the caller renders a left-to-right 7-day series without re-sorting. The DR-05 stored
   * shape is untouched — this only reads it.
   */
  async getMetricsInRange(
    userId: string,
    start: IsoDate,
    end: IsoDate,
  ): Promise<readonly DailyMetricSet[]> {
    const docs = await this.metrics
      .find({ userId, date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .toArray();
    const byDate = new Map<IsoDate, Record<string, Metric>>();
    for (const doc of docs) {
      const metrics = byDate.get(doc.date) ?? {};
      metrics[doc.name] = toMetric(doc);
      byDate.set(doc.date, metrics);
    }
    return [...byDate.entries()].map(([date, metrics]) => ({ date, metrics }));
  }
}
