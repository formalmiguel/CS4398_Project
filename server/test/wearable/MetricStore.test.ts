/**
 * 🔴 RED (packet 08) — FR-WER-09 (idempotent ingestion), DR-05 (one document per metric per
 * date), DR-02/DR-04 (the availability branch and origin survive a persist/read round trip), and
 * the FR-WER-07 note that the store must not PREVENT an INJECTED origin.
 *
 * These tests run against `mongodb-memory-server` (OPEN-19), exactly like `UserStore.test.ts`.
 * They fail because `MetricStore`'s methods throw — the RED contract. The store is source-
 * agnostic by design (FR-WER-05): it persists the CONTRACT's `DailyMetricSet`, never a Garmin
 * shape, so these tests build metric sets by hand rather than through the adapter.
 *
 * RED convention this suite establishes for 08b: the collection is `metrics`, one document per
 * metric, and the metric NAME is a stored VALUE (`name`), never a column.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Db, MongoClient } from 'mongodb';

import type { DailyMetricSet, Metric, MetricOrigin } from '@capstone/shared';

import { MetricStore } from '../../src/db/MetricStore';

let memoryServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let store: MetricStore;

const USER = '507f1f77bcf86cd799439011';
const OTHER_USER = '507f191e810c19729de860ea';

// ─── Metric builders (contract literals — the store is source-agnostic) ──────

const available = (
  name: string,
  unit: string,
  value: number,
  origin: MetricOrigin = 'EXPORT',
): Metric => ({ name, unit, origin, isAvailable: true, value });

const unavailable = (name: string, unit: string, origin: MetricOrigin = 'EXPORT'): Metric => ({
  name,
  unit,
  origin,
  isAvailable: false,
});

const dayWithBoth = (date: string, sleep: number, calories: number): DailyMetricSet => ({
  date,
  metrics: {
    sleepScore: available('sleepScore', 'score', sleep),
    activeCalories: available('activeCalories', 'kcal', calories),
  },
});

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  client = new MongoClient(memoryServer.getUri());
  await client.connect();
  db = client.db('test');
  store = new MetricStore(db);
  await store.ensureIndexes();
});

afterAll(async () => {
  await client.close();
  await memoryServer.stop();
});

afterEach(async () => {
  await db.collection('metrics').deleteMany({});
});

describe('MetricStore', () => {
  it('DR-05: persisting a DailyMetricSet writes one document per metric per date', async () => {
    await store.ingest(USER, dayWithBoth('2026-03-10', 82, 540));
    const count = await db.collection('metrics').countDocuments({ userId: USER, date: '2026-03-10' });
    expect(count).toBe(2);
  });

  it('DR-05: no stored document carries more than one metric (name is a value, not a column)', async () => {
    await store.ingest(USER, dayWithBoth('2026-03-10', 82, 540));
    const docs = await db.collection('metrics').find({ userId: USER, date: '2026-03-10' }).toArray();

    expect(docs.map((d) => d.name).sort()).toEqual(['activeCalories', 'sleepScore']);
    for (const doc of docs) {
      const keys = Object.keys(doc);
      // Metric names must be VALUES of `name`, never columns — the DR-05 shape that keeps a
      // third metric an ADDITION rather than a schema change (§4.4).
      expect(keys).not.toContain('sleepScore');
      expect(keys).not.toContain('activeCalories');
    }
  });

  it('DR-05: the upsert key includes userId — two users do not collide on the same date/metric', async () => {
    await store.ingest(USER, dayWithBoth('2026-03-10', 82, 540));
    await store.ingest(OTHER_USER, dayWithBoth('2026-03-10', 70, 300));
    expect(await db.collection('metrics').countDocuments({ date: '2026-03-10' })).toBe(4);
    expect(await db.collection('metrics').countDocuments({ userId: USER, date: '2026-03-10' })).toBe(2);
  });

  it('FR-WER-09: ingesting the same set twice does not duplicate documents', async () => {
    await store.ingest(USER, dayWithBoth('2026-03-10', 82, 540));
    await store.ingest(USER, dayWithBoth('2026-03-10', 82, 540));
    const count = await db.collection('metrics').countDocuments({ userId: USER, date: '2026-03-10' });
    expect(count).toBe(2);
  });

  it('FR-WER-09: re-ingesting a date with a changed value updates rather than duplicates (last-write-wins)', async () => {
    // This upsert IS FR-WER-09's mechanism (OPEN-26): the adapter needs nothing special for
    // re-ingest — the store's (userId, date, name) upsert makes the latest write win.
    await store.ingest(USER, dayWithBoth('2026-03-10', 82, 300));
    await store.ingest(USER, dayWithBoth('2026-03-10', 82, 350));

    const count = await db.collection('metrics').countDocuments({ userId: USER, date: '2026-03-10' });
    expect(count).toBe(2);

    const readBack = await store.getDailyMetricSet(USER, '2026-03-10');
    const cal = readBack.metrics['activeCalories'];
    expect(cal?.isAvailable).toBe(true);
    if (cal?.isAvailable) expect(cal.value).toBe(350);
  });

  it('FR-WER-09 / round trip: reading back yields the DailyMetricSet that was written', async () => {
    const written = dayWithBoth('2026-03-10', 82, 540);
    await store.ingest(USER, written);
    const readBack = await store.getDailyMetricSet(USER, '2026-03-10');
    expect(readBack).toEqual(written);
  });

  it('FR-WER-06 / DR-02: the unavailable branch survives a persist/read round trip', async () => {
    const set: DailyMetricSet = {
      date: '2024-01-11',
      metrics: {
        sleepScore: unavailable('sleepScore', 'score'),
        activeCalories: available('activeCalories', 'kcal', 300),
      },
    };
    await store.ingest(USER, set);

    const readBack = await store.getDailyMetricSet(USER, '2024-01-11');
    const sleep = readBack.metrics['sleepScore'];
    expect(sleep?.isAvailable).toBe(false);
    expect(sleep !== undefined && 'value' in sleep).toBe(false);

    const cal = readBack.metrics['activeCalories'];
    expect(cal?.isAvailable).toBe(true);
    if (cal?.isAvailable) expect(cal.value).toBe(300);
  });

  it('DR-04 / FR-WER-07: the store records origin and does not prevent an INJECTED value', async () => {
    const set: DailyMetricSet = {
      date: '2026-03-11',
      metrics: {
        sleepScore: available('sleepScore', 'score', 90, 'INJECTED'),
        activeCalories: available('activeCalories', 'kcal', 400, 'EXPORT'),
      },
    };
    await store.ingest(USER, set);

    const readBack = await store.getDailyMetricSet(USER, '2026-03-11');
    expect(readBack.metrics['sleepScore']?.origin).toBe('INJECTED');
    expect(readBack.metrics['activeCalories']?.origin).toBe('EXPORT');
  });
});
