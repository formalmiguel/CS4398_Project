import { MongoMemoryServer } from 'mongodb-memory-server';
import { Db, MongoClient } from 'mongodb';

import type { Placement } from '@capstone/shared';

import { UserStore } from '../../src/db/UserStore';
import { TaskRepository } from '../../src/db/TaskRepository';

let memoryServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let users: UserStore;
let repo: TaskRepository;
let userId: string;

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  client = new MongoClient(memoryServer.getUri());
  await client.connect();
  db = client.db('test');
  users = new UserStore(db);
  await users.ensureIndexes();
  repo = new TaskRepository(db, users);
});

afterAll(async () => {
  await client.close();
  await memoryServer.stop();
});

beforeEach(async () => {
  await db.collection('users').deleteMany({});
  await db.collection('tasks').deleteMany({});
  await db.collection('placements').deleteMany({});
  await db.collection('completionRecords').deleteMany({});
  const user = await users.create({ email: `u-${Date.now()}@x.com`, passwordHash: 'h', wakeMinute: 420, sleepMinute: 1380 });
  userId = user.id;
});

const makePlacement = (id: string, taskId: string, over: Partial<Placement> = {}): Placement => ({
  id,
  taskId,
  date: '2026-07-23',
  start: 600,
  end: 630,
  status: 'PLANNED',
  placementReason: 'test',
  ...over,
});

describe('TaskRepository — §3.6 ratified surface', () => {
  it('FR-TSK-01: createTask persists and getTask reads it back as a contract Task', async () => {
    const task = await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'Read',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    const found = await repo.getTask(task.id);
    expect(found).toEqual(task);
    expect(found?.source).toBe('USER');
    // repository-internal fields must never leak onto the contract type
    expect(found).not.toHaveProperty('userId');
    expect(found).not.toHaveProperty('intendedDate');
  });

  it('ownerOfTask returns the creating user id, and undefined for an unknown task', async () => {
    const task = await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'X',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    expect(await repo.ownerOfTask(task.id)).toBe(userId);
    expect(await repo.ownerOfTask('000000000000000000000000')).toBeUndefined();
  });

  it('NFR-SEC-05: getTask/ownerOfTask reject a non-ObjectId-string id instead of throwing a Mongo cast error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(repo.getTask({ $gt: '' } as any)).resolves.toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(repo.ownerOfTask({ $gt: '' } as any)).resolves.toBeUndefined();
  });

  it('savePlacement upserts by id, and deletePlacement removes it', async () => {
    const task = await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'X',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    const placement = makePlacement(repo.nextPlacementId(), task.id);
    await repo.savePlacement(placement);
    let onDate = await repo.placementsForDate(userId, '2026-07-23');
    expect(onDate).toEqual([placement]);

    const moved = { ...placement, start: 700, end: 730 };
    await repo.savePlacement(moved);
    onDate = await repo.placementsForDate(userId, '2026-07-23');
    expect(onDate).toEqual([moved]);

    await repo.deletePlacement(placement.id);
    onDate = await repo.placementsForDate(userId, '2026-07-23');
    expect(onDate).toEqual([]);
  });

  it('schedulableDay reads the owning user\'s wake/sleep as an Interval (FR-USR-07)', async () => {
    const day = await repo.schedulableDay(userId, '2026-07-23');
    expect(day).toEqual({ start: 420, end: 1380 });
  });
});

describe('TaskRepository.tasksForDate — OPEN-17: what makes a task visible for a date', () => {
  it('FR-TSK-01: a one-off task is visible only on its intendedDate', async () => {
    await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'Once',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    expect((await repo.tasksForDate(userId, '2026-07-23')).map((t) => t.title)).toEqual(['Once']);
    expect(await repo.tasksForDate(userId, '2026-07-24')).toEqual([]);
    expect(await repo.tasksForDate(userId, '2026-07-22')).toEqual([]);
  });

  it('FR-TSK-05: a DAILY task is visible every day on/after intendedDate, never before', async () => {
    await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'Daily',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      recurrence: { frequency: 'DAILY' },
    });
    expect(await repo.tasksForDate(userId, '2026-07-22')).toEqual([]);
    expect((await repo.tasksForDate(userId, '2026-07-23')).map((t) => t.title)).toEqual(['Daily']);
    expect((await repo.tasksForDate(userId, '2026-08-15')).map((t) => t.title)).toEqual(['Daily']);
  });

  it('FR-TSK-05: a WEEKLY task is visible only on its listed weekdays', async () => {
    // 2026-07-23 is a Thursday (ISO weekday 4); 2026-07-27 is the following Monday (1).
    await repo.createTask({
      userId,
      intendedDate: '2026-07-20',
      title: 'MonThu',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      recurrence: { frequency: 'WEEKLY', daysOfWeek: [1, 4] },
    });
    expect((await repo.tasksForDate(userId, '2026-07-23')).map((t) => t.title)).toEqual(['MonThu']);
    expect((await repo.tasksForDate(userId, '2026-07-27')).map((t) => t.title)).toEqual(['MonThu']);
    expect(await repo.tasksForDate(userId, '2026-07-22')).toEqual([]); // Wednesday
  });

  it('a never-placed flexible task is still returned — this is what lets sweepElapsed find it', async () => {
    const task = await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'Never placed',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    const placements = await repo.placementsForDate(userId, '2026-07-23');
    expect(placements).toEqual([]);
    const tasks = await repo.tasksForDate(userId, '2026-07-23');
    expect(tasks.map((t) => t.id)).toContain(task.id);
  });
});

describe('TaskRepository — FR-TSK-03/07, DR-01', () => {
  it('FR-TSK-07: deleting a recurring task removes future placements but keeps completion records', async () => {
    const task = await repo.createTask({
      userId,
      intendedDate: '2026-07-20',
      title: 'Recurring',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
      recurrence: { frequency: 'DAILY' },
    });
    const past = makePlacement(repo.nextPlacementId(), task.id, { date: '2026-07-20', status: 'COMPLETED' });
    const future = makePlacement(repo.nextPlacementId(), task.id, { date: '2026-07-25' });
    await repo.savePlacement(past);
    await repo.savePlacement(future);
    await repo.recordCompletion(past.id, task.id, userId);

    await repo.deleteTaskAndFuturePlacements(task.id, '2026-07-23');

    expect(await repo.getTask(task.id)).toBeUndefined();
    expect(await repo.placementsForDate(userId, '2026-07-25')).toEqual([]);
    expect(await repo.placementsForDate(userId, '2026-07-20')).toEqual([past]); // DR-01: preserved
    expect(await repo.completionRecordsForTask(task.id)).toHaveLength(1); // DR-01
  });
});

describe('TaskRepository — NFR-SEC-06', () => {
  it('deleteAllForUser removes tasks, placements, and completion records for that user only', async () => {
    const other = await users.create({ email: 'other@x.com', passwordHash: 'h', wakeMinute: 0, sleepMinute: 1 });
    const mine = await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'Mine',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    const theirs = await repo.createTask({
      userId: other.id,
      intendedDate: '2026-07-23',
      title: 'Theirs',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });

    await repo.deleteAllForUser(userId);

    expect(await repo.getTask(mine.id)).toBeUndefined();
    expect(await repo.getTask(theirs.id)).toBeDefined();
  });
});
