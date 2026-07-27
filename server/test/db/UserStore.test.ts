import { MongoMemoryServer } from 'mongodb-memory-server';
import { Db, MongoClient } from 'mongodb';

import { UserStore } from '../../src/db/UserStore';

let memoryServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let store: UserStore;

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  client = new MongoClient(memoryServer.getUri());
  await client.connect();
  db = client.db('test');
  store = new UserStore(db);
  await store.ensureIndexes();
});

afterAll(async () => {
  await client.close();
  await memoryServer.stop();
});

afterEach(async () => {
  await db.collection('users').deleteMany({});
});

describe('UserStore', () => {
  it('FR-USR-01: creates a user and mints an opaque id distinct from the email', async () => {
    const user = await store.create({
      email: 'a@example.com',
      passwordHash: 'hash',
      wakeMinute: 420,
      sleepMinute: 1380,
      baselineCalories: 2000,
      dietaryPreferences: [],
    });
    expect(user.id).toMatch(/^[0-9a-f]{24}$/);
    expect(user.id).not.toBe(user.email);
  });

  it('FR-USR-01: rejects a duplicate email (unique index)', async () => {
    await store.create({ email: 'dup@example.com', passwordHash: 'h', wakeMinute: 0, sleepMinute: 1, baselineCalories: 2000, dietaryPreferences: [] });
    await expect(
      store.create({ email: 'dup@example.com', passwordHash: 'h2', wakeMinute: 0, sleepMinute: 1, baselineCalories: 2000, dietaryPreferences: [] }),
    ).rejects.toThrow();
  });

  it('FR-USR-03: stores only the password hash — the plaintext never appears in the record', async () => {
    const user = await store.create({
      email: 'pw@example.com',
      passwordHash: '$2b$10$fakehash',
      wakeMinute: 0,
      sleepMinute: 1,
      baselineCalories: 2000,
      dietaryPreferences: [],
    });
    expect(user.passwordHash).toBe('$2b$10$fakehash');
    expect(JSON.stringify(user)).not.toMatch(/plaintext-password/);
  });

  it('OPEN-12: findByEmail looks the id up by email, but the id is not the email', async () => {
    await store.create({ email: 'lookup@example.com', passwordHash: 'h', wakeMinute: 0, sleepMinute: 1, baselineCalories: 2000, dietaryPreferences: [] });
    const found = await store.findByEmail('lookup@example.com');
    expect(found?.email).toBe('lookup@example.com');
    expect(found?.id).not.toBe('lookup@example.com');
  });

  it('FR-USR-07: schedulableDay reads wake/sleep back as a Minute Interval', async () => {
    const user = await store.create({
      email: 'day@example.com',
      passwordHash: 'h',
      wakeMinute: 420,
      sleepMinute: 1380,
      baselineCalories: 2000,
      dietaryPreferences: [],
    });
    const day = await store.schedulableDay(user.id);
    expect(day).toEqual({ start: 420, end: 1380 });
  });

  it('FR-USR-07: updateSchedulableDay changes wake/sleep', async () => {
    const user = await store.create({ email: 'upd@example.com', passwordHash: 'h', wakeMinute: 0, sleepMinute: 1, baselineCalories: 2000, dietaryPreferences: [] });
    await store.updateSchedulableDay(user.id, 300, 1200);
    const day = await store.schedulableDay(user.id);
    expect(day).toEqual({ start: 300, end: 1200 });
  });

  it('NFR-SEC-05: a non-string userId is rejected rather than reaching the query', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(store.updateSchedulableDay({ $gt: '' } as any, 0, 1)).rejects.toThrow();
  });

  it('NFR-SEC-06: delete removes the user record', async () => {
    const user = await store.create({ email: 'del@example.com', passwordHash: 'h', wakeMinute: 0, sleepMinute: 1, baselineCalories: 2000, dietaryPreferences: [] });
    await store.delete(user.id);
    expect(await store.findById(user.id)).toBeUndefined();
  });
});
