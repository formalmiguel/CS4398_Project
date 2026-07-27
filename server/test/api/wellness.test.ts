/**
 * Packet 14a — the wellness read surface (FR-WEL-01…05) and the UC-01 registration capture
 * (FR-REC-09/FR-REC-05). NOT a frozen suite: FR-WEL is (D), verified by demonstration; these
 * tests guard the wiring this packet adds (its own new code), never a (T) requirement another
 * packet owns.
 */
import request from 'supertest';

import { buildTestApp, TestApp } from '../support/testApp';

let ta: TestApp;
const DATE = '2026-07-23';

const registerBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  email: `wel-${Date.now()}-${Math.random()}@x.com`,
  password: 'a-decent-password',
  wakeMinute: 360,
  sleepMinute: 1380,
  baselineCalories: 2000,
  dietaryPreferences: [],
  ...overrides,
});

const registerAndToken = async (overrides: Record<string, unknown> = {}): Promise<string> => {
  const res = await request(ta.app).post('/auth/register').send(registerBody(overrides));
  expect(res.status).toBe(201);
  return res.body.token as string;
};

const authed = (token: string) => ({
  get: (url: string) => request(ta.app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) =>
    request(ta.app).post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
});

const metric = (name: string, unit: string, value: number) => ({
  name,
  unit,
  origin: 'INJECTED',
  isAvailable: true,
  value,
});

beforeEach(async () => {
  ta = await buildTestApp(600, DATE);
});

afterEach(async () => {
  await ta.stop();
});

describe('UC-01 registration capture — FR-REC-09 / FR-REC-05', () => {
  it('FR-REC-09: records the baseline calorie target and returns it', async () => {
    const res = await request(ta.app).post('/auth/register').send(registerBody({ baselineCalories: 2200 }));
    expect(res.status).toBe(201);
    expect(res.body.baselineCalories).toBe(2200);
    expect(res.body.dietaryPreferences).toEqual([]);
  });

  it('FR-REC-05: records dietary preferences and rejects an unknown flag', async () => {
    const ok = await request(ta.app).post('/auth/register').send(registerBody({ dietaryPreferences: ['VEGETARIAN', 'NUT_FREE'] }));
    expect(ok.status).toBe(201);
    expect(ok.body.dietaryPreferences).toEqual(['VEGETARIAN', 'NUT_FREE']);

    const bad = await request(ta.app).post('/auth/register').send(registerBody({ dietaryPreferences: ['PALEO'] }));
    expect(bad.status).toBe(400);
  });

  it('FR-REC-09 (§4.9 asks, never estimates): a missing or absurd baseline is rejected', async () => {
    const missing = await request(ta.app).post('/auth/register').send(registerBody({ baselineCalories: undefined }));
    expect(missing.status).toBe(400);
    const absurd = await request(ta.app).post('/auth/register').send(registerBody({ baselineCalories: 50 }));
    expect(absurd.status).toBe(400);
  });

  it('carries the profile through /user/me on session restore', async () => {
    const token = await registerAndToken({ baselineCalories: 2100, dietaryPreferences: ['VEGAN'] });
    const me = await authed(token).get('/user/me');
    expect(me.status).toBe(200);
    expect(me.body.baselineCalories).toBe(2100);
    expect(me.body.dietaryPreferences).toEqual(['VEGAN']);
  });
});

describe('GET /wellness — FR-WEL-01…05', () => {
  it('composes metrics, workout (tier + 2 alternatives), and meals with baseline/activity split', async () => {
    const token = await registerAndToken({ baselineCalories: 2000 });
    await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        sleepScore: metric('sleepScore', 'score', 42),
        activeCalories: metric('activeCalories', 'kcal', 850),
      },
    });

    const res = await authed(token).get('/wellness');
    expect(res.status).toBe(200);

    // FR-WEL-01: the metric set for the date, rendered by whatever it contains.
    expect(res.body.metrics.date).toBe(DATE);
    expect(res.body.metrics.metrics.sleepScore).toMatchObject({ isAvailable: true, value: 42 });

    // FR-WEL-02: today's recommended workout at the warranted tier + the two alternatives.
    expect(res.body.workout.tier).toBe('LOW'); // 42 ≤ 49 → LOW (FR-REC-01)
    expect(res.body.workout.recommended).not.toBeNull();
    expect(res.body.workout.recommended.intensityTier).toBe('LOW');
    expect(res.body.workout.alternatives.length).toBeLessThanOrEqual(2);
    expect(res.body.workout.reason.metricName).toBe('sleepScore');

    // FR-WEL-03: baseline and activity contribution shown SEPARATELY.
    expect(res.body.meals.baseline).toBe(2000);
    expect(res.body.meals.activity).toBe(850);
    expect(res.body.meals.target).toBe(2850);
    expect(res.body.meals.madeWithoutCurrentData).toBe(false);
    // FR-WEL-03: a real BREAKFAST+LUNCH+DINNER plan, not an empty list — the day target is split
    // per slot (0.30/0.35/0.35), so each slot must find a real meal for a 2,850 kcal vegetarian day.
    expect(res.body.meals.plan.map((s: { mealType: string }) => s.mealType)).toEqual([
      'BREAKFAST',
      'LUNCH',
      'DINNER',
    ]);
    expect(res.body.meals.plan.every((s: { meal: unknown }) => s.meal !== null)).toBe(true);
    expect(res.body.meals.planTotalCalories).toBeGreaterThan(2565); // ≥ 0.9 × 2850, the ±10% floor
    expect(res.body.meals.planTotalCalories).toBeLessThan(3135); // ≤ 1.1 × 2850

    // FR-WEL-04: the 7-day history includes the date.
    expect(res.body.history.some((d: { date: string }) => d.date === DATE)).toBe(true);
  });

  it('FR-WEL-05 / FR-REC-06: unavailable active calories → target is the baseline, flagged, never a fabricated figure', async () => {
    const token = await registerAndToken({ baselineCalories: 2000 });
    await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: {
        sleepScore: metric('sleepScore', 'score', 42),
        activeCalories: { name: 'activeCalories', unit: 'kcal', origin: 'INJECTED', isAvailable: false },
      },
    });

    const res = await authed(token).get('/wellness');
    expect(res.status).toBe(200);
    expect(res.body.meals.target).toBe(2000); // falls back to the baseline
    expect(res.body.meals.activity).toBe(0); // never a fabricated activity figure
    expect(res.body.meals.madeWithoutCurrentData).toBe(true);
  });

  it('is READ ONLY: opening the wellness view never mutates the schedule (FR-REC-02 is a write path, not this)', async () => {
    const token = await registerAndToken();
    await authed(token).post('/wearable/metrics', {
      date: DATE,
      metrics: { sleepScore: metric('sleepScore', 'score', 42), activeCalories: metric('activeCalories', 'kcal', 850) },
    });

    await authed(token).get('/wellness');
    await authed(token).get('/wellness');

    const schedule = await authed(token).get(`/schedule?date=${DATE}`);
    expect(schedule.status).toBe(200);
    expect(schedule.body.placements).toHaveLength(0);
    expect(schedule.body.tasks).toHaveLength(0);
  });
});
