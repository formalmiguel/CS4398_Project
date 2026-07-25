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
import type { Db } from 'mongodb';

import type { DailyMetricSet, IsoDate } from '@capstone/shared';

export class MetricStore {
  constructor(_db: Db) {}

  /** The unique index that makes ingestion idempotent (FR-WER-09): `(userId, date, name)`. */
  ensureIndexes(): Promise<void> {
    throw new Error('MetricStore.ensureIndexes: not implemented (08b GREEN)');
  }

  /**
   * FR-WER-09: idempotent. Upsert one document per metric in the set, keyed on
   * `(userId, date, name)`. Re-ingesting a date updates the existing documents; it never
   * duplicates. DR-04: each document records the metric's origin.
   */
  ingest(_userId: string, _set: DailyMetricSet): Promise<void> {
    throw new Error('MetricStore.ingest: not implemented (08b GREEN)');
  }

  /** Read the per-metric documents for a date back into a single `DailyMetricSet`. */
  getDailyMetricSet(_userId: string, _date: IsoDate): Promise<DailyMetricSet> {
    throw new Error('MetricStore.getDailyMetricSet: not implemented (08b GREEN)');
  }
}
