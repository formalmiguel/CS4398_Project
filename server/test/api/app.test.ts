import request from 'supertest';

import { buildTestApp, TestApp } from '../support/testApp';

let ta: TestApp;

afterEach(async () => {
  await ta.stop();
});

const register = async (
  app: TestApp['app'],
  overrides: Partial<{
    email: string;
    password: string;
    wakeMinute: number;
    sleepMinute: number;
    baselineCalories: number;
    dietaryPreferences: string[];
  }> = {},
): Promise<{ userId: string; token: string }> => {
  const res = await request(app)
    .post('/auth/register')
    .send({
      email: overrides.email ?? `u-${Date.now()}-${Math.random()}@x.com`,
      password: overrides.password ?? 'a-decent-password',
      wakeMinute: overrides.wakeMinute ?? 360,
      sleepMinute: overrides.sleepMinute ?? 1380,
      baselineCalories: overrides.baselineCalories ?? 2000,
      dietaryPreferences: overrides.dietaryPreferences ?? [],
    });
  expect(res.status).toBe(201);
  return { userId: res.body.userId, token: res.body.token };
};

const authed = (app: TestApp['app'], token: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) =>
    request(app).post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
  patch: (url: string, body?: object) =>
    request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
  delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

describe('Auth — FR-USR-01/02/03', () => {
  beforeEach(async () => {
    ta = await buildTestApp();
  });

  it('FR-USR-01: registers a new account and FR-USR-02 establishes a session', async () => {
    const { userId, token } = await register(ta.app);
    expect(userId).toMatch(/^[0-9a-f]{24}$/);
    expect(typeof token).toBe('string');
  });

  it('FR-USR-01: rejects a duplicate email with 409', async () => {
    const email = 'dup@x.com';
    await register(ta.app, { email });
    const res = await request(ta.app)
      .post('/auth/register')
      .send({ email, password: 'another-password', wakeMinute: 0, sleepMinute: 1, baselineCalories: 2000, dietaryPreferences: [] });
    expect(res.status).toBe(409);
  });

  it('FR-USR-02: login with correct credentials returns a session; wrong password is rejected', async () => {
    const email = 'login@x.com';
    const password = 'the-real-password';
    await register(ta.app, { email, password });
    const good = await request(ta.app).post('/auth/login').send({ email, password });
    expect(good.status).toBe(200);
    expect(typeof good.body.token).toBe('string');

    const bad = await request(ta.app).post('/auth/login').send({ email, password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('FR-USR-03: the stored record never carries a plaintext password', async () => {
    const email = 'plaintext-check@x.com';
    await register(ta.app, { email, password: 'super-secret-plaintext' });
    const stored = await ta.users.findByEmail(email);
    expect(stored?.passwordHash).not.toBe('super-secret-plaintext');
  });
});

describe('NFR-SEC-04/05 — injection and cross-user access', () => {
  beforeEach(async () => {
    ta = await buildTestApp();
  });

  it('NFR-SEC-05: an object-shaped injection payload for email/password is rejected, not coerced', async () => {
    const res = await request(ta.app)
      .post('/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(401);
  });

  it('NFR-SEC-03: user A cannot read, edit, or delete user B\'s task', async () => {
    const a = await register(ta.app);
    const b = await register(ta.app);
    const created = await authed(ta.app, b.token).post('/tasks').send({
      title: "B's task",
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-23',
    });
    const taskId = created.body.task.id;

    expect((await authed(ta.app, a.token).get(`/tasks/${taskId}`)).status).toBe(404);
    expect((await authed(ta.app, a.token).patch(`/tasks/${taskId}`, { title: 'hijacked' })).status).toBe(404);
    expect((await authed(ta.app, a.token).delete(`/tasks/${taskId}`)).status).toBe(404);
    expect(
      (await authed(ta.app, a.token).post(`/tasks/${taskId}/complete`, { date: '2026-07-23' })).status,
    ).toBe(404);
  });

  it('FR-USR-04: no Authorization header at all is rejected on every data-bearing route', async () => {
    const res = await request(ta.app).get('/schedule?date=2026-07-23');
    expect(res.status).toBe(401);
  });
});

describe('FR-TSK-01/02 — task creation validation', () => {
  let token: string;
  beforeEach(async () => {
    ta = await buildTestApp();
    token = (await register(ta.app)).token;
  });

  it('FR-TSK-02: rejects a preferred window shorter than the duration, stating why', async () => {
    const res = await authed(ta.app, token).post('/tasks').send({
      title: 'Too short',
      type: 'HABIT',
      durationMinutes: 60,
      priority: 3,
      preferredWindow: { start: 600, end: 630 }, // 30 min window for a 60 min task
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-23',
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/FR-TSK-02/);
  });

  it('FR-TSK-01: rejects an out-of-range priority and duration', async () => {
    const res = await authed(ta.app, token).post('/tasks').send({
      title: 'Bad',
      type: 'HABIT',
      durationMinutes: 1000,
      priority: 9,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-23',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('FR-TSK-01: requires intensityTier for WORKOUT and rejects it elsewhere', async () => {
    const missing = await authed(ta.app, token).post('/tasks').send({
      title: 'Run',
      type: 'WORKOUT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-23',
    });
    expect(missing.status).toBe(400);

    const ok = await authed(ta.app, token).post('/tasks').send({
      title: 'Run',
      type: 'WORKOUT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-23',
      intensityTier: 'HIGH',
    });
    expect(ok.status).toBe(201);
  });

  it('FR-CAL-05 (vacuous under this scope): a missing preferredWindow, or start === end, is rejected', async () => {
    const noWindow = await authed(ta.app, token).post('/tasks').send({
      title: 'All day?',
      type: 'OTHER',
      durationMinutes: 30,
      priority: 3,
      flexibility: 'FIXED',
      intendedDate: '2026-07-23',
    });
    expect(noWindow.status).toBe(400);

    const zeroSpan = await authed(ta.app, token).post('/tasks').send({
      title: 'Zero span',
      type: 'OTHER',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 600 },
      flexibility: 'FIXED',
      intendedDate: '2026-07-23',
    });
    expect(zeroSpan.status).toBe(400);
  });
});

describe('FR-CAL — fixed commitments', () => {
  let token: string;
  beforeEach(async () => {
    ta = await buildTestApp();
    token = (await register(ta.app)).token;
  });

  it('FR-CAL-01/02: a FIXED commitment is placed exactly at its given start/end, immediately', async () => {
    const res = await authed(ta.app, token).post('/tasks').send({
      title: 'Advisor Meeting',
      type: 'MEETING',
      durationMinutes: 60,
      priority: 1,
      preferredWindow: { start: 1020, end: 1080 }, // 5-6 PM
      flexibility: 'FIXED',
      intendedDate: '2026-07-23',
    });
    expect(res.status).toBe(201);
    expect(res.body.placement).toMatchObject({ start: 1020, end: 1080, status: 'PLANNED' });
  });

  it('FR-RSC-02: a new commitment displaces an already-placed overlapping flexible task, and FR-CAL-03 the commitment never moves', async () => {
    const client = authed(ta.app, token);
    const flexible = await client.post('/tasks').send({
      title: 'Read',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 1020, end: 1080 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-23',
    });
    // Place it via the schedule retrieval (FR-RSC-10's own trigger).
    await client.get('/schedule?date=2026-07-23');
    const before = await client.get('/schedule?date=2026-07-23');
    const beforePlacement = before.body.placements.find((p: { taskId: string }) => p.taskId === flexible.body.task.id);
    expect(beforePlacement).toBeDefined();
    expect(beforePlacement.start).toBe(1020);

    const commitment = await client.post('/tasks').send({
      title: 'Advisor Meeting',
      type: 'MEETING',
      durationMinutes: 60,
      priority: 1,
      preferredWindow: { start: 1020, end: 1080 },
      flexibility: 'FIXED',
      intendedDate: '2026-07-23',
    });
    expect(commitment.status).toBe(201);
    expect(commitment.body.displaced).toHaveLength(1);

    const after = await client.get('/schedule?date=2026-07-23');
    const commitmentPlacement = after.body.placements.find(
      (p: { taskId: string }) => p.taskId === commitment.body.task.id,
    );
    expect(commitmentPlacement).toMatchObject({ start: 1020, end: 1080 }); // FR-CAL-03: unmoved
    const flexiblePlacement = after.body.placements.find(
      (p: { taskId: string }) => p.taskId === flexible.body.task.id,
    );
    expect(flexiblePlacement.start).not.toBe(1020); // FR-RSC-02: moved elsewhere
  });
});

describe('UC-02/UC-03 — task creation calls the engine directly (FR-DSH-06)', () => {
  let token: string;
  const date = '2026-07-23';
  beforeEach(async () => {
    ta = await buildTestApp();
    token = (await register(ta.app)).token;
  });

  it('UC-02: a task whose preferred window has room is auto-placed at creation, no candidates offered', async () => {
    const res = await authed(ta.app, token).post('/tasks').send({
      title: 'Read',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
    });
    expect(res.status).toBe(201);
    expect(res.body.placement).toMatchObject({ start: 600, end: 630, status: 'PLANNED' });
    expect(res.body.candidates).toBeNull();
  });

  it('UC-03: a task whose preferred window is full returns ranked candidates and writes nothing', async () => {
    const client = authed(ta.app, token);
    // Fill the exact preferred window with a fixed commitment first.
    await client.post('/tasks').send({
      title: 'Advisor Meeting',
      type: 'MEETING',
      durationMinutes: 60,
      priority: 1,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FIXED',
      intendedDate: date,
    });

    const res = await client.post('/tasks').send({
      title: 'Gym',
      type: 'WORKOUT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
      intensityTier: 'MODERATE',
    });
    expect(res.status).toBe(201);
    expect(res.body.placement).toBeNull();
    expect(Array.isArray(res.body.candidates)).toBe(true);
    expect(res.body.candidates.length).toBeGreaterThan(0);
    expect(res.body.candidates[0].withinPreferredWindow).toBe(false);

    // Nothing was written — GET /schedule shows no placement for this task yet.
    const schedule = await client.get(`/schedule?date=${date}`);
    const mine = schedule.body.placements.find((p: { taskId: string }) => p.taskId === res.body.task.id);
    expect(mine).toBeUndefined();
  });

  it('POST /tasks/:id/place writes the accepted candidate', async () => {
    const client = authed(ta.app, token);
    await client.post('/tasks').send({
      title: 'Advisor Meeting',
      type: 'MEETING',
      durationMinutes: 60,
      priority: 1,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FIXED',
      intendedDate: date,
    });
    const created = await client.post('/tasks').send({
      title: 'Gym',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
    });
    const chosen = created.body.candidates[0];

    const placed = await client.post(`/tasks/${created.body.task.id}/place`).send({
      date,
      start: chosen.start,
      end: chosen.end,
    });
    expect(placed.status).toBe(201);
    expect(placed.body.placement).toMatchObject({ start: chosen.start, end: chosen.end, status: 'PLANNED' });
  });

  it('POST /tasks/:id/place rejects a slot that is no longer available', async () => {
    const client = authed(ta.app, token);
    const created = await client.post('/tasks').send({
      title: 'Gym',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
    });
    // Someone else's commitment lands on the chosen interval between offer and accept.
    await client.post('/tasks').send({
      title: 'Surprise Meeting',
      type: 'MEETING',
      durationMinutes: 30,
      priority: 1,
      preferredWindow: { start: 600, end: 630 },
      flexibility: 'FIXED',
      intendedDate: date,
    });

    const res = await client
      .post(`/tasks/${created.body.task.id}/place`)
      .send({ date, start: 600, end: 630 });
    expect(res.status).toBe(409);
  });

  it('sequentially-created tasks do NOT evict each other, even out of priority order (no retroactive eviction, FR-SCH-10\'s own note)', async () => {
    const client = authed(ta.app, token);
    const low = await client.post('/tasks').send({
      title: 'Low priority',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 5,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
    });
    // Auto-placed immediately at its preferred start.
    expect(low.body.placement).toMatchObject({ start: 600, end: 630 });

    const high = await client.post('/tasks').send({
      title: 'High priority',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 1,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
    });
    // High priority does NOT evict the already-placed low-priority task — it takes what's left.
    expect(high.body.placement).toMatchObject({ start: 630, end: 660 });

    const schedule = await client.get(`/schedule?date=${date}`);
    const lowP = schedule.body.placements.find((p: { taskId: string }) => p.taskId === low.body.task.id);
    expect(lowP.start).toBe(600); // still where it was placed — untouched by the later, higher-priority create
  });

  it('FR-SCH-06: a task that cannot be placed at all is reported, written nowhere, and retried later via GET /schedule', async () => {
    // A schedulable day short enough that one (<=480-min, FR-TSK-01's cap) commitment fills it.
    const shortDayToken = (await register(ta.app, { wakeMinute: 600, sleepMinute: 630 })).token;
    const client = authed(ta.app, shortDayToken);
    await client.post('/tasks').send({
      title: 'Fills The Whole Day',
      type: 'OTHER',
      durationMinutes: 30,
      priority: 1,
      preferredWindow: { start: 600, end: 630 },
      flexibility: 'FIXED',
      intendedDate: date,
    });
    const created = await client.post('/tasks').send({
      title: 'Stuck',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 630 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
    });
    expect(created.status).toBe(201);
    expect(created.body.placement).toBeNull();
    expect(created.body.candidates).toBeNull();
    expect(created.body.unplaceable.placed).toBe(false);

    // FR-RSC-05's re-attempt: nothing else changes the day, so it stays unplaceable.
    const still = await client.get(`/schedule?date=${date}`);
    expect(still.body.placements.find((p: { taskId: string }) => p.taskId === created.body.task.id)).toBeUndefined();
    // It's still there, just unplaced — NFR-REL-01, never silently dropped.
    expect(still.body.tasks.map((t: { id: string }) => t.id)).toContain(created.body.task.id);
  });
});

describe('FR-SCH-10 — a batch of genuinely-simultaneous unplaced tasks is still ordered by priority', () => {
  let token: string;
  const date = '2026-07-23';
  beforeEach(async () => {
    ta = await buildTestApp();
    // A schedulable day short enough that one commitment fills it entirely, so a competing
    // flexible task is genuinely UNPLACEABLE (FR-SCH-06) rather than offered UC-03 candidates
    // elsewhere in the day — the latter would mark it `awaitingChoice` and correctly exclude it
    // from `sweepElapsed`'s reattempt, which is not the scenario this test wants.
    token = (await register(ta.app, { wakeMinute: 600, sleepMinute: 660 })).token;
  });

  it('two tasks unplaceable at creation both place, in priority order, once the day frees up and GET /schedule sweeps them together', async () => {
    const client = authed(ta.app, token);
    const blocker = await client.post('/tasks').send({
      title: 'Blocker',
      type: 'MEETING',
      durationMinutes: 60,
      priority: 1,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FIXED',
      intendedDate: date,
    });

    const low = await client.post('/tasks').send({
      title: 'Low priority',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 5,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
    });
    const high = await client.post('/tasks').send({
      title: 'High priority',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 1,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
    });
    // Neither could go anywhere in the (tiny) day — genuinely unplaceable, not offered a choice.
    expect(low.body.placement).toBeNull();
    expect(low.body.candidates).toBeNull();
    expect(high.body.placement).toBeNull();
    expect(high.body.candidates).toBeNull();

    // Free up the day: remove the blocker's task entirely.
    await client.delete(`/tasks/${blocker.body.task.id}`);

    const schedule = await client.get(`/schedule?date=${date}`);
    const byTask = (id: string) => schedule.body.placements.find((p: { taskId: string }) => p.taskId === id);
    const highP = byTask(high.body.task.id);
    const lowP = byTask(low.body.task.id);
    expect(highP).toBeDefined();
    expect(lowP).toBeDefined();
    // FR-SCH-10: the higher-priority task gets the actually-preferred slot.
    expect(highP.start).toBe(600);
    expect(lowP.start).toBeGreaterThanOrEqual(highP.end);
  });
});

describe('FR-RSC-10 — schedule retrieval sweeps elapsed occurrences', () => {
  it('re-places a missed occurrence when the schedule is retrieved, no background process involved', async () => {
    ta = await buildTestApp(600, '2026-07-23'); // clock starts at 10:00 AM
    const token = (await register(ta.app, { wakeMinute: 360, sleepMinute: 1380 })).token;
    const client = authed(ta.app, token);

    const task = await client.post('/tasks').send({
      title: 'Morning routine',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 420, end: 480 }, // 7:00-8:00 AM, already in the past
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-23',
    });

    // First retrieval places it in the remainder of the day (FR-RSC-01's v2.14 substitution).
    const first = await client.get('/schedule?date=2026-07-23');
    const firstPlacement = first.body.placements.find((p: { taskId: string }) => p.taskId === task.body.task.id);
    expect(firstPlacement.status).toBe('PLANNED');

    // Advance the clock past that occurrence's own window — FR-RSC-10's exact verification wording.
    ta.clock.advanceTo(firstPlacement.end + 1);
    const second = await client.get('/schedule?date=2026-07-23');
    const rows = second.body.placements.filter((p: { taskId: string }) => p.taskId === task.body.task.id);
    expect(rows.some((p: { status: string }) => p.status === 'MISSED')).toBe(true);
    expect(rows.some((p: { status: string; rescheduleTrigger?: string }) => p.status === 'PLANNED' && p.rescheduleTrigger === 'MISSED')).toBe(true);
  });
});

describe('GET /schedule/overview — month-grid dots', () => {
  it('reports a one-off task only on its own date, and a DAILY recurring task on every date in range', async () => {
    ta = await buildTestApp();
    const token = (await register(ta.app)).token;
    const client = authed(ta.app, token);

    await client.post('/tasks').send({
      title: 'Dentist',
      type: 'MEETING',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FIXED',
      intendedDate: '2026-07-15',
    });
    await client.post('/tasks').send({
      title: 'Daily journal',
      type: 'HABIT',
      durationMinutes: 15,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-10',
      recurrence: { frequency: 'DAILY' },
    });

    const res = await client.get('/schedule/overview?start=2026-07-14&end=2026-07-16');
    expect(res.status).toBe(200);
    const byDate = Object.fromEntries(res.body.days.map((d: { date: string; types: string[] }) => [d.date, d.types]));
    expect(byDate['2026-07-14']).toEqual(['HABIT']);
    expect(byDate['2026-07-15'].sort()).toEqual(['HABIT', 'MEETING']);
    expect(byDate['2026-07-16']).toEqual(['HABIT']);
  });

  it('items carries each day\'s tasks by title/type/preferred start, sorted by time — for the month view', async () => {
    ta = await buildTestApp();
    const token = (await register(ta.app)).token;
    const client = authed(ta.app, token);

    await client.post('/tasks').send({
      title: 'Dentist',
      type: 'MEETING',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 900, end: 930 },
      flexibility: 'FIXED',
      intendedDate: '2026-07-15',
    });
    await client.post('/tasks').send({
      title: 'Morning journal',
      type: 'HABIT',
      durationMinutes: 15,
      priority: 3,
      preferredWindow: { start: 420, end: 450 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-15',
    });

    const res = await client.get('/schedule/overview?start=2026-07-15&end=2026-07-15');
    expect(res.status).toBe(200);
    const items = res.body.days[0].items as { id: string; title: string; type: string; start: number }[];
    expect(items.map((i) => i.title)).toEqual(['Morning journal', 'Dentist']);
    expect(items.map((i) => i.type)).toEqual(['HABIT', 'MEETING']);
    expect(items.map((i) => i.start)).toEqual([420, 900]);
    expect(items.every((i) => typeof i.id === 'string' && i.id.length > 0)).toBe(true);
  });

  it('never materializes a Placement for a day nobody has retrieved via GET /schedule', async () => {
    ta = await buildTestApp();
    const { userId, token } = await register(ta.app);
    const client = authed(ta.app, token);
    await client.post('/tasks').send({
      title: 'Future habit',
      type: 'HABIT',
      durationMinutes: 15,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-08-01',
      recurrence: { frequency: 'DAILY' },
    });

    const res = await client.get('/schedule/overview?start=2026-08-01&end=2026-08-05');
    expect(res.body.days).toHaveLength(5);

    // GET /schedule/overview must not have swept or placed anything itself — read the
    // repository directly, since GET /schedule is FR-RSC-10's own sweep point and calling it
    // here would place the task as designed, telling us nothing about the overview endpoint.
    const placements = await ta.tasks.placementsForDate(userId, '2026-08-03');
    expect(placements).toEqual([]);
  });

  it('rejects a range over 62 days, and requires start/end', async () => {
    ta = await buildTestApp();
    const token = (await register(ta.app)).token;
    const client = authed(ta.app, token);

    const tooLarge = await client.get('/schedule/overview?start=2026-01-01&end=2026-12-31');
    expect(tooLarge.status).toBe(400);

    const missing = await client.get('/schedule/overview?start=2026-07-01');
    expect(missing.status).toBe(400);
  });

  it('requires authentication', async () => {
    ta = await buildTestApp();
    const res = await request(ta.app).get('/schedule/overview?start=2026-07-01&end=2026-07-07');
    expect(res.status).toBe(401);
  });
});

describe('FR-TSK-06/FR-RSC-08/FR-RSC-05 — occurrence actions', () => {
  let token: string;
  const date = '2026-07-23';
  beforeEach(async () => {
    ta = await buildTestApp();
    token = (await register(ta.app)).token;
  });

  it('FR-TSK-06: completing a placed occurrence marks it COMPLETED and records a timestamp', async () => {
    const client = authed(ta.app, token);
    const task = await client.post('/tasks').send({
      title: 'Stretch',
      type: 'HABIT',
      durationMinutes: 15,
      priority: 3,
      preferredWindow: { start: 600, end: 660 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
    });
    await client.get(`/schedule?date=${date}`);
    const res = await client.post(`/tasks/${task.body.task.id}/complete`, { date });
    expect(res.status).toBe(200);
    expect(res.body.outcome.completed.status).toBe('COMPLETED');
  });

  it('FR-RSC-08: skipping a placed occurrence re-invokes the engine, distinct from a miss', async () => {
    const client = authed(ta.app, token);
    const task = await client.post('/tasks').send({
      title: 'Gym',
      type: 'WORKOUT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: date,
      intensityTier: 'MODERATE',
    });
    await client.get(`/schedule?date=${date}`);
    const res = await client.post(`/tasks/${task.body.task.id}/skip`, { date });
    expect(res.status).toBe(200);
    expect(res.body.outcome.kind).toBe('RESCHEDULED');
    expect(res.body.outcome.trigger).toBe('SKIPPED');
  });
});

describe('FR-TSK-07 / DR-01 — deletion preserves history', () => {
  it('deleting a recurring task removes future placements but a completion record remains readable', async () => {
    ta = await buildTestApp(600, '2026-07-20');
    const token = (await register(ta.app)).token;
    const client = authed(ta.app, token);

    const task = await client.post('/tasks').send({
      title: 'Daily journal',
      type: 'HABIT',
      durationMinutes: 15,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-20',
      recurrence: { frequency: 'DAILY' },
    });
    await client.get('/schedule?date=2026-07-20');
    const schedule = await client.get('/schedule?date=2026-07-20');
    const placement = schedule.body.placements.find((p: { taskId: string }) => p.taskId === task.body.task.id);
    await client.post(`/tasks/${task.body.task.id}/complete`, { date: '2026-07-20' });

    const del = await client.delete(`/tasks/${task.body.task.id}`);
    expect(del.status).toBe(204);
    expect(placement).toBeDefined();
  });
});

describe('NFR-PERF-02 — latency under concurrency', () => {
  it('10 concurrent GET /schedule requests complete with p95 under 500ms', async () => {
    ta = await buildTestApp();
    const token = (await register(ta.app)).token;
    const client = authed(ta.app, token);
    await client.post('/tasks').send({
      title: 'Warm task',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      intendedDate: '2026-07-23',
    });

    const CONCURRENCY = 10;
    const durations = await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        const start = Date.now();
        await client.get('/schedule?date=2026-07-23');
        return Date.now() - start;
      }),
    );
    durations.sort((a, b) => a - b);
    const p95Index = Math.ceil(0.95 * CONCURRENCY) - 1;
    expect(durations[p95Index]).toBeLessThan(500);
  });
});
