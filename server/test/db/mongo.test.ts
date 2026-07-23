/**
 * `connectMongo`/`closeMongo` are the ONE piece of packet 12 no other test exercises —
 * `UserStore.test.ts` and `TaskRepository.test.ts` construct their own `Db` directly from a
 * memory-server client, bypassing this file entirely. Without this, the actual production
 * connection path has never run.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

import { closeMongo, connectMongo } from '../../src/db/mongo';

let memoryServer: MongoMemoryServer;

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
});

afterAll(async () => {
  await closeMongo();
  await memoryServer.stop();
});

describe('connectMongo/closeMongo', () => {
  it('connects to a URI and returns a usable Db', async () => {
    const db = await connectMongo(memoryServer.getUri());
    await db.collection('smoke').insertOne({ ok: 1 });
    const found = await db.collection('smoke').findOne({ ok: 1 });
    expect(found?.ok).toBe(1);
  });

  it('memoizes the connection — a second call returns the same Db without reconnecting', async () => {
    const first = await connectMongo(memoryServer.getUri());
    const second = await connectMongo(memoryServer.getUri());
    expect(second).toBe(first);
  });
});
