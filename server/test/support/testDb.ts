/**
 * Test-only Mongo, via `mongodb-memory-server` (OPEN-19). A throwaway in-process Mongo per
 * test file — no real `mongod` required to run `npm test`. This is infrastructure for the
 * suite, not part of the domain: nothing here computes a placement or an ownership decision.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Db, MongoClient } from 'mongodb';

export interface TestDb {
  readonly db: Db;
  readonly stop: () => Promise<void>;
}

export const startTestDb = async (): Promise<TestDb> => {
  const memoryServer = await MongoMemoryServer.create();
  const client = new MongoClient(memoryServer.getUri());
  await client.connect();
  const db = client.db('test');

  const stop = async (): Promise<void> => {
    await client.close();
    await memoryServer.stop();
  };

  return { db, stop };
};
