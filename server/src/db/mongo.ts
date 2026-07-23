/**
 * The single production Mongo connection. `MONGODB_URI` comes from `.env` (`dotenv`) — never
 * committed. Memoized so the app opens one connection and the test suite supplies its own
 * `Db` directly (`test/support/testDb.ts`, `mongodb-memory-server`) rather than going through
 * this file at all.
 */
import { Db, MongoClient } from 'mongodb';

let client: MongoClient | undefined;
let db: Db | undefined;

export const connectMongo = async (uri: string): Promise<Db> => {
  if (db !== undefined) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
};

export const closeMongo = async (): Promise<void> => {
  await client?.close();
  client = undefined;
  db = undefined;
};
