/**
 * POST /wearable/metrics — runtime enforcement of the `Metric` union (FR-WER-06, NFR-ROB-01).
 *
 * NOT a frozen suite, and it guards this route's own validation rather than a (T) requirement
 * another packet owns — the same standing as the packet 14a wellness tests beside it.
 *
 * ⚠️ WHY THIS EXISTS. `Metric` is a discriminated union so that no reader can consult `value`
 * without first checking `isAvailable`. That is a COMPILE-TIME guarantee, and this route's body
 * arrives from the network as `unknown`, where it buys nothing. Before this validation,
 * `{"sleepScore": 40}` — a bare number where a `Metric` belongs — was accepted with a 204, stored,
 * and read back as `isAvailable: false`. A malformed payload silently became "the watch was on the
 * nightstand": the exact absent-vs-measured collapse FR-WER-06 forbids, with nothing failing.
 *
 * Each test below therefore asserts BOTH halves — the 400, and that the read surface was not
 * polluted. A 400 alone would not prove the bad value never landed.
 */
import request from 'supertest';

import { GarminExportAdapter } from '../../src/wearable/GarminExportAdapter';
import { loadGarminExport } from '../wearable/wearableFixtures';
import { buildTestApp, TestApp } from '../support/testApp';

let ta: TestApp;
const DATE = '2026-07-23';

const registerAndToken = async (): Promise<string> => {
  const res = await request(ta.app)
    .post('/auth/register')
    .send({
      email: `mv-${Date.now()}-${Math.random()}@x.com`,
      password: 'a-decent-password',
      wakeMinute: 360,
      sleepMinute: 1380,
      baselineCalories: 2000,
      dietaryPreferences: [],
    });
  expect(res.status).toBe(201);
  return res.body.token as string;
};

const authed = (token: string) => ({
  get: (url: string) => request(ta.app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) =>
    request(ta.app).post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
});

/** The field paths a rejection reported, e.g. `metrics.sleepScore.value`. */
const fields = (res: { body: { errors?: { field: string }[] } }): string[] =>
  (res.body.errors ?? []).map((e) => e.field);

beforeEach(async () => {
  ta = await buildTestApp(600, DATE);
});

afterEach(async () => {
  await ta.stop();
});

describe('POST /wearable/metrics — the envelope', () => {
  it('rejects a non-object body', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', [] as unknown as object);
    expect(res.status).toBe(400);
  });

  it('rejects a missing or malformed date', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', { date: '23-07-2026', metrics: {} });
    expect(res.status).toBe(400);
    expect(fields(res)).toContain('date');
  });

  it('rejects metrics that is an array rather than a name-keyed object', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', { date: DATE, metrics: [] });
    expect(res.status).toBe(400);
    expect(fields(res)).toContain('metrics');
  });
});

describe('POST /wearable/metrics — the Metric union (FR-WER-06)', () => {
  it('⛔ REGRESSION: a bare number is rejected, and does NOT land as an unavailable metric', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: { sleepScore: 40 },
    });

    expect(res.status).toBe(400);
    expect(fields(res)).toContain('metrics.sleepScore');

    // The half that matters: nothing was stored. Previously this read back as
    // `{isAvailable: false}` — indistinguishable from a night the watch was not worn.
    const wellness = await authed(token).get(`/wellness?date=${DATE}`);
    expect(wellness.status).toBe(200);
    expect(wellness.body.metrics.metrics.sleepScore).toBeUndefined();
  });

  it('rejects an available metric whose value is missing', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: { sleepScore: { name: 'sleepScore', unit: 'score', origin: 'INJECTED', isAvailable: true } },
    });
    expect(res.status).toBe(400);
    expect(fields(res)).toContain('metrics.sleepScore.value');
  });

  it('rejects an available metric whose value is a numeric STRING rather than a number', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        sleepScore: { name: 'sleepScore', unit: 'score', origin: 'INJECTED', isAvailable: true, value: '40' },
      },
    });
    expect(res.status).toBe(400);
    expect(fields(res)).toContain('metrics.sleepScore.value');
  });

  it('rejects an UNAVAILABLE metric that still carries a value — the union has no such branch', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        activeCalories: {
          name: 'activeCalories',
          unit: 'kcal',
          origin: 'INJECTED',
          isAvailable: false,
          value: 0,
        },
      },
    });
    expect(res.status).toBe(400);
    expect(fields(res)).toContain('metrics.activeCalories.value');
  });

  it('rejects a metric whose name disagrees with its key — MetricStore keys on the KEY', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        sleepScore: { name: 'activeCalories', unit: 'score', origin: 'INJECTED', isAvailable: true, value: 40 },
      },
    });
    expect(res.status).toBe(400);
    expect(fields(res)).toContain('metrics.sleepScore.name');
  });

  it('rejects an unknown origin', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        sleepScore: { name: 'sleepScore', unit: 'score', origin: 'GUESSED', isAvailable: true, value: 40 },
      },
    });
    expect(res.status).toBe(400);
    expect(fields(res)).toContain('metrics.sleepScore.origin');
  });

  it('rejects a non-boolean isAvailable rather than coercing it (NFR-SEC-05)', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        sleepScore: { name: 'sleepScore', unit: 'score', origin: 'INJECTED', isAvailable: 'true', value: 40 },
      },
    });
    expect(res.status).toBe(400);
    expect(fields(res)).toContain('metrics.sleepScore.isAvailable');
  });

  it('reports EVERY offending field at once, not just the first', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: 'nonsense',
      metrics: {
        sleepScore: { name: 'sleepScore', unit: 'score', origin: 'NOPE', isAvailable: true },
      },
    });
    expect(res.status).toBe(400);
    expect(fields(res)).toEqual(
      expect.arrayContaining(['date', 'metrics.sleepScore.origin', 'metrics.sleepScore.value']),
    );
  });
});

describe('POST /wearable/metrics — well-formed payloads still pass', () => {
  it('accepts both branches of the union and round-trips them intact', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        sleepScore: { name: 'sleepScore', unit: 'score', origin: 'INJECTED', isAvailable: true, value: 40 },
        activeCalories: { name: 'activeCalories', unit: 'kcal', origin: 'INJECTED', isAvailable: false },
      },
    });
    expect(res.status).toBe(204);

    const wellness = await authed(token).get(`/wellness?date=${DATE}`);
    expect(wellness.body.metrics.metrics.sleepScore).toMatchObject({ isAvailable: true, value: 40 });
    expect(wellness.body.metrics.metrics.activeCalories).toMatchObject({ isAvailable: false });
    // FR-WER-06's whole purpose: the unavailable branch persists WITHOUT a value.
    expect(wellness.body.metrics.metrics.activeCalories.value).toBeUndefined();
  });

  it('accepts a MEASURED ZERO — distinct from unavailable, and the reason the union exists', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        activeCalories: { name: 'activeCalories', unit: 'kcal', origin: 'EXPORT', isAvailable: true, value: 0 },
      },
    });
    expect(res.status).toBe(204);

    const wellness = await authed(token).get(`/wellness?date=${DATE}`);
    expect(wellness.body.metrics.metrics.activeCalories).toMatchObject({ isAvailable: true, value: 0 });
  });

  /**
   * ⚠️ THE COMPATIBILITY TEST THAT MATTERS. `ingestGarminExport.ts` POSTs each `DailyMetricSet`
   * from `GarminExportAdapter.toMetricSets()` to this exact route, unmodified. Tightening the
   * validation could therefore have broken the real ingestion path — the one that demonstrates
   * FR-WER-10, the midpoint gate — and no frozen suite would have caught it, because the frozen
   * wearable tests exercise the adapter WITHOUT the route.
   *
   * The fixture is the derived one (§8.4), so this runs offline and touches nobody's health data.
   */
  it('FR-WER-08/10: every set the Garmin adapter produces is still accepted by this route', async () => {
    const token = await registerAndToken();
    const sets = new GarminExportAdapter(loadGarminExport('garmin-export.json')).toMetricSets();
    expect(sets.length).toBeGreaterThan(0);

    for (const set of sets) {
      const res = await authed(token).post('/wearable/metrics', set);
      expect([res.status, set.date]).toEqual([204, set.date]);
    }

    // The unavailable branch survives the round trip — 2024-01-11 has an unscored night, which is
    // the case that would break if validation forced a `value` onto every metric.
    const unscored = await authed(token).get('/wellness?date=2024-01-11');
    expect(unscored.body.metrics.metrics.sleepScore).toMatchObject({ isAvailable: false });
  });

  it('DR-05/FR-WER-04: validates a metric it has never heard of, with no edit to the route', async () => {
    const token = await registerAndToken();
    const res = await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        stressLevel: { name: 'stressLevel', unit: 'score', origin: 'EXPORT', isAvailable: true, value: 31 },
      },
    });
    expect(res.status).toBe(204);

    const wellness = await authed(token).get(`/wellness?date=${DATE}`);
    expect(wellness.body.metrics.metrics.stressLevel).toMatchObject({ isAvailable: true, value: 31 });
  });
});
