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
  const user = await users.create({ email: `u-${Date.now()}@x.com`, passwordHash: 'h', wakeMinute: 420, sleepMinute: 1380, baselineCalories: 2000, dietaryPreferences: [] });
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

describe('TaskRepository — UC-03/FR-DSH-06: awaitingChoice visibility', () => {
  it('setAwaitingChoice(true) excludes the task from tasksForDate but not from allTasksForDate', async () => {
    const task = await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'Picking',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    await repo.setAwaitingChoice(task.id, true);

    expect(await repo.tasksForDate(userId, '2026-07-23')).toEqual([]);
    expect((await repo.allTasksForDate(userId, '2026-07-23')).map((t) => t.id)).toContain(task.id);
  });

  it('awaitingChoiceTaskIds returns the id only on the matching date, and clears once setAwaitingChoice(false)', async () => {
    const task = await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'Picking',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    await repo.setAwaitingChoice(task.id, true);

    // Regression: a prior projection bug (`{ _id: 1 }`) stripped the fields matchesDate needs,
    // so this always returned []. Asserting a non-empty, date-matched result pins the fix.
    expect(await repo.awaitingChoiceTaskIds(userId, '2026-07-23')).toEqual([task.id]);
    expect(await repo.awaitingChoiceTaskIds(userId, '2026-07-24')).toEqual([]);

    await repo.setAwaitingChoice(task.id, false);
    expect(await repo.awaitingChoiceTaskIds(userId, '2026-07-23')).toEqual([]);
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
    const other = await users.create({ email: 'other@x.com', passwordHash: 'h', wakeMinute: 0, sleepMinute: 1, baselineCalories: 2000, dietaryPreferences: [] });
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

describe('TaskRepository — FR-CAL-07 export support', () => {
  it('placementsInRange returns every placement with a date in [start, end], inclusive, for that user only', async () => {
    const other = await users.create({ email: 'range-other@x.com', passwordHash: 'h', wakeMinute: 0, sleepMinute: 1, baselineCalories: 2000, dietaryPreferences: [] });
    const task = await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'Ranged',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    await repo.savePlacement(makePlacement('before', task.id, { date: '2026-07-09' }));
    await repo.savePlacement(makePlacement('start-edge', task.id, { date: '2026-07-10' }));
    await repo.savePlacement(makePlacement('inside', task.id, { date: '2026-07-15' }));
    await repo.savePlacement(makePlacement('end-edge', task.id, { date: '2026-07-20' }));
    await repo.savePlacement(makePlacement('after', task.id, { date: '2026-07-21' }));
    const otherTask = await repo.createTask({
      userId: other.id,
      intendedDate: '2026-07-15',
      title: 'Not mine',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });
    await repo.savePlacement(makePlacement('other-user', otherTask.id, { date: '2026-07-15' }));

    const found = await repo.placementsInRange(userId, '2026-07-10', '2026-07-20');

    expect(new Set(found.map((p) => p.id))).toEqual(new Set(['start-edge', 'inside', 'end-edge']));
  });

  it('getTasksByIds returns a map keyed by id, skipping ids that do not exist', async () => {
    const task = await repo.createTask({
      userId,
      intendedDate: '2026-07-23',
      title: 'Lookup Me',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: 600, end: 700 },
      flexibility: 'FLEXIBLE',
    });

    const found = await repo.getTasksByIds([task.id, '000000000000000000000000', 'not-an-object-id']);

    expect(found.size).toBe(1);
    expect(found.get(task.id)?.title).toBe('Lookup Me');
  });
});
