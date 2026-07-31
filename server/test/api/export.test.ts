import request from 'supertest';

import { buildTestApp, TestApp } from '../support/testApp';

let ta: TestApp;

afterEach(async () => {
  await ta.stop();
});

const register = async (): Promise<{ userId: string; token: string }> => {
  const res = await request(ta.app)
    .post('/auth/register')
    .send({
      email: `u-${Date.now()}-${Math.random()}@x.com`,
      password: 'a-decent-password',
      wakeMinute: 360,
      sleepMinute: 1380,
      baselineCalories: 2000,
      dietaryPreferences: [],
    });
  expect(res.status).toBe(201);
  return { userId: res.body.userId, token: res.body.token };
};

const authedGet = (token: string, url: string) =>
  request(ta.app).get(url).set('Authorization', `Bearer ${token}`);

describe('GET /schedule/export — FR-CAL-07 / SI-06', () => {
  beforeEach(async () => {
    ta = await buildTestApp();
  });

  it('requires authentication', async () => {
    const res = await request(ta.app).get('/schedule/export?start=2026-07-20&end=2026-07-21');
    expect(res.status).toBe(401);
  });

  it('requires both start and end', async () => {
    const { token } = await register();
    const res = await authedGet(token, '/schedule/export?start=2026-07-20');
    expect(res.status).toBe(400);
  });

  it('rejects an end date before start', async () => {
    const { token } = await register();
    const res = await authedGet(token, '/schedule/export?start=2026-07-20&end=2026-07-10');
    expect(res.status).toBe(400);
  });

  it('rejects a range over the maximum span', async () => {
    const { token } = await register();
    const res = await authedGet(token, '/schedule/export?start=2020-01-01&end=2026-07-24');
    expect(res.status).toBe(400);
  });

  it('exports a FIXED commitment as a VEVENT with the correct times and title', async () => {
    const { token } = await register();
    const created = await request(ta.app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Dentist',
        type: 'MEETING',
        durationMinutes: 30,
        priority: 1,
        preferredWindow: { start: 600, end: 630 },
        flexibility: 'FIXED',
        intendedDate: '2026-07-25',
      });
    expect(created.status).toBe(201);

    const res = await authedGet(token, '/schedule/export?start=2026-07-25&end=2026-07-25');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('SUMMARY:Dentist\r\n');
    expect(res.text).toContain('DTSTART:20260725T100000\r\n');
    expect(res.text).toContain('DTEND:20260725T103000\r\n');
  });

  it('excludes placements outside the requested range', async () => {
    const { token } = await register();
    await request(ta.app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Out Of Range',
        type: 'MEETING',
        durationMinutes: 30,
        priority: 1,
        preferredWindow: { start: 600, end: 630 },
        flexibility: 'FIXED',
        intendedDate: '2026-08-01',
      });

    const res = await authedGet(token, '/schedule/export?start=2026-07-25&end=2026-07-25');

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Out Of Range');
  });

  it('never exports another user\'s placements', async () => {
    const mine = await register();
    const theirs = await register();
    await request(ta.app)
      .post('/tasks')
      .set('Authorization', `Bearer ${theirs.token}`)
      .send({
        title: 'Not Yours',
        type: 'MEETING',
        durationMinutes: 30,
        priority: 1,
        preferredWindow: { start: 600, end: 630 },
        flexibility: 'FIXED',
        intendedDate: '2026-07-25',
      });

    const res = await authedGet(mine.token, '/schedule/export?start=2026-07-25&end=2026-07-25');

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Not Yours');
  });
});
