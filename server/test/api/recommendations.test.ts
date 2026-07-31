/**
 * Packet 17d — TRANSPORT tests for `POST /recommendations/apply-workout` and the composition that
 * makes it reachable. NOT a frozen suite.
 *
 * ⛔ READ THIS BEFORE ADDING AN ASSERTION. These tests assert that the ROUTE exposes the
 * scheduler — auth, ownership, validation, the response shape, and that the wiring is connected at
 * all. They deliberately do NOT assert WHAT the recommendation should be: the tier mapping, the
 * replacement policy, the reason text and the placement are pinned clean-room by the FROZEN
 * `server/test/acceptance/` (`8809158`) and `server/test/replacement/` (`47bb301`) suites, written
 * before any of this wiring existed. §4.6 normally forbids one agent writing both a test and the
 * code it tests; the narrow exemption here (packet 17d, and packet 12's precedent for transport
 * tests) holds only while that line is respected. An assertion about recommendation BEHAVIOUR in
 * this file would be a test of code its own author just wrote — put it in the frozen suite instead.
 */
import request from 'supertest';

import { buildTestApp, TestApp } from '../support/testApp';

let ta: TestApp;
const DATE = '2026-07-23';
/** 10:00. Leaves the 17:00 run's window comfortably ahead of `now` (FR-REC-07). */
const NOW_MINUTE = 600;

const registerBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  email: `rec-${Date.now()}-${Math.random()}@x.com`,
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

/** A DailyMetricSet as `POST /wearable/metrics` takes it — FR-WER-07's injection path. */
const metricSet = (date: string, values: { sleepScore?: number; activeCalories?: number }) => ({
  date,
  metrics: Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      {
        name,
        unit: name === 'sleepScore' ? 'SCORE' : 'KCAL',
        origin: 'INJECTED',
        isAvailable: true,
        value,
      },
    ]),
  ),
});

/** §6's spine: a HIGH-intensity run at 17:00, above the tier a poor night warrants. */
const highIntensityRun = {
  title: 'Evening run',
  type: 'WORKOUT',
  durationMinutes: 60,
  priority: 2,
  preferredWindow: { start: 1020, end: 1080 },
  flexibility: 'FLEXIBLE',
  intensityTier: 'HIGH',
  intendedDate: DATE,
};

/**
 * The titles that are actually ON the calendar for the day, from `GET /schedule`'s
 * `{ tasks, placements }`. Only PLANNED placements count: a SUPERSEDED row is still returned (it
 * stays distinguishable from one that never happened — DR-06) but it is no longer scheduled, and
 * that distinction is exactly what these tests are checking.
 */
type ScheduleResponse = {
  body: {
    tasks: { id: string; title: string }[];
    placements: { taskId: string; status: string }[];
  };
};

const plannedTitles = (res: ScheduleResponse): string[] => {
  const titleById = new Map(res.body.tasks.map((t) => [t.id, t.title]));
  return res.body.placements
    .filter((p) => p.status === 'PLANNED')
    .map((p) => titleById.get(p.taskId) ?? '(unknown)')
    .sort();
};

beforeEach(async () => {
  ta = await buildTestApp(NOW_MINUTE, DATE);
});

afterEach(async () => {
  await ta.stop();
});

describe('POST /recommendations/apply-workout — transport (NFR-SEC-03/05)', () => {
  it('requires authentication', async () => {
    const res = await request(ta.app).post('/recommendations/apply-workout').send({ date: DATE });
    expect(res.status).toBe(401);
  });

  it('409s with an explanation when there is no above-tier workout to replace', async () => {
    const token = await registerAndToken();
    await authed(token).post('/wearable/metrics', metricSet(DATE, { sleepScore: 40 }));

    // No workout on the calendar at all — the request is well-formed and there is simply nothing
    // to replace. That is a conflict, not a fault, and must not surface as a 500.
    const res = await authed(token).post('/recommendations/apply-workout', { date: DATE });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no workout above/i);
  });

  it('is scoped to the caller: one user cannot apply against another user\'s calendar', async () => {
    const owner = await registerAndToken();
    const stranger = await registerAndToken();

    await authed(owner).post('/tasks', highIntensityRun);
    await authed(owner).post('/wearable/metrics', metricSet(DATE, { sleepScore: 40 }));
    // The stranger injects their own poor sleep, so the only thing separating them from a
    // successful apply is ownership of the run.
    await authed(stranger).post('/wearable/metrics', metricSet(DATE, { sleepScore: 40 }));

    const res = await authed(stranger).post('/recommendations/apply-workout', { date: DATE });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no workout above/i);
  });
});

describe('POST /recommendations/apply-workout — §6 through HTTP (FR-REC-04)', () => {
  it('injecting a poor sleep score replaces the run with a placed SYSTEM WORKOUT task', async () => {
    const token = await registerAndToken();

    const created = await authed(token).post('/tasks', highIntensityRun);
    expect(created.status).toBe(201);

    // FR-WER-07: the injection means, through the route packet 14a already provides.
    const injected = await authed(token).post(
      '/wearable/metrics',
      metricSet(DATE, { sleepScore: 40, activeCalories: 850 }),
    );
    expect(injected.status).toBe(204);

    const applied = await authed(token).post('/recommendations/apply-workout', { date: DATE });
    expect(applied.status).toBe(200);

    // The response is the frozen `WorkoutRecommendationResult`, serialized — not reshaped.
    // FR-REC-04: created as a task, SYSTEM-authored, and PLACED.
    expect(applied.body.task.source).toBe('SYSTEM');
    expect(applied.body.task.type).toBe('WORKOUT');
    expect(applied.body.placement.status).toBe('PLANNED');
    expect(typeof applied.body.placement.start).toBe('number');
    // FR-REC-03: three options offered. FR-REC-13: a reason came through.
    expect(applied.body.options.length).toBeGreaterThan(0);
    expect(applied.body.reason).toBeDefined();

    // …and it is on the real calendar, via the ordinary schedule route the dashboard already uses.
    const schedule = await authed(token).get(`/schedule?date=${DATE}`);
    expect(schedule.status).toBe(200);
    expect(plannedTitles(schedule)).toContain(applied.body.task.title);
    expect(plannedTitles(schedule)).not.toContain('Evening run');
  });

  it('the replacement survives a second retrieval (OPEN-27 / FR-RSC-06) through HTTP', async () => {
    const token = await registerAndToken();
    await authed(token).post('/tasks', highIntensityRun);
    await authed(token).post('/wearable/metrics', metricSet(DATE, { sleepScore: 40 }));

    const applied = await authed(token).post('/recommendations/apply-workout', { date: DATE });
    expect(applied.status).toBe(200);

    // Two sweeps. FR-RSC-10 evaluates the day on every retrieval, so this is where a replacement
    // that was merely CANCELLED would resurrect the run beside the recovery session.
    const first = await authed(token).get(`/schedule?date=${DATE}`);
    const second = await authed(token).get(`/schedule?date=${DATE}`);

    expect(plannedTitles(first)).toEqual(plannedTitles(second));
    expect(plannedTitles(second)).not.toContain('Evening run');
    expect(plannedTitles(second)).toContain(applied.body.task.title);
  });
});
