/**
 * Persistence for `User` (FR-USR). Not a §3.6 class — the SRS never named a `UserRepository`
 * interface the way it ratified `TaskRepository`, so this is an ordinary class, not a port.
 *
 * ⛔ Stores a password HASH only, never a plaintext password (FR-USR-03, NFR-SEC-02). Hashing
 * itself happens one layer up, in the auth route — this file only persists and reads back
 * whatever hash it is given, so it has no bcrypt dependency of its own.
 *
 * OPEN-12 (closed, SRS v2.18): the identifier IS this collection's Mongo `_id`, stringified.
 * Email is unique and used ONLY to look the id up at login — it is never itself the identifier
 * carried elsewhere, and it is not duplicated onto `Task`/`Placement` documents.
 */
import { Collection, Db, ObjectId } from 'mongodb';

import type { Interval, Minute } from '@capstone/shared';

import { isValidObjectIdString } from './mongo';

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly wakeMinute: Minute;
  readonly sleepMinute: Minute;
  readonly createdAt: string;
}

interface UserDocument {
  readonly _id: ObjectId;
  readonly email: string;
  readonly passwordHash: string;
  readonly wakeMinute: Minute;
  readonly sleepMinute: Minute;
  readonly createdAt: string;
}

const toRecord = (doc: UserDocument): UserRecord => ({
  id: doc._id.toHexString(),
  email: doc.email,
  passwordHash: doc.passwordHash,
  wakeMinute: doc.wakeMinute,
  sleepMinute: doc.sleepMinute,
  createdAt: doc.createdAt,
});

export class UserStore {
  private readonly users: Collection<UserDocument>;

  constructor(db: Db) {
    this.users = db.collection<UserDocument>('users');
  }

  async ensureIndexes(): Promise<void> {
    await this.users.createIndex({ email: 1 }, { unique: true });
  }

  async create(input: {
    email: string;
    passwordHash: string;
    wakeMinute: Minute;
    sleepMinute: Minute;
  }): Promise<UserRecord> {
    if (typeof input.email !== 'string' || typeof input.passwordHash !== 'string') {
      throw new Error('NFR-SEC-05: email and passwordHash must be strings');
    }
    const doc: UserDocument = {
      _id: new ObjectId(),
      email: input.email,
      passwordHash: input.passwordHash,
      wakeMinute: input.wakeMinute,
      sleepMinute: input.sleepMinute,
      createdAt: new Date().toISOString(),
    };
    await this.users.insertOne(doc);
    return toRecord(doc);
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    if (typeof email !== 'string') return undefined;
    const doc = await this.users.findOne({ email });
    return doc === null ? undefined : toRecord(doc);
  }

  async findById(userId: string): Promise<UserRecord | undefined> {
    if (!isValidObjectIdString(userId)) return undefined;
    const doc = await this.users.findOne({ _id: new ObjectId(userId) });
    return doc === null ? undefined : toRecord(doc);
  }

  /** FR-USR-07: wake and sleep, as `Minute`. The engine is told; nobody consults a database row. */
  async schedulableDay(userId: string): Promise<Interval | undefined> {
    const user = await this.findById(userId);
    if (user === undefined) return undefined;
    return { start: user.wakeMinute, end: user.sleepMinute };
  }

  async updateSchedulableDay(userId: string, wakeMinute: Minute, sleepMinute: Minute): Promise<void> {
    if (!isValidObjectIdString(userId)) throw new Error('NFR-SEC-05: invalid userId');
    await this.users.updateOne({ _id: new ObjectId(userId) }, { $set: { wakeMinute, sleepMinute } });
  }

  /** NFR-SEC-06. Deletes only the `users` document — task/placement cascade lives in TaskRepository. */
  async delete(userId: string): Promise<void> {
    if (!isValidObjectIdString(userId)) throw new Error('NFR-SEC-05: invalid userId');
    await this.users.deleteOne({ _id: new ObjectId(userId) });
  }
}
