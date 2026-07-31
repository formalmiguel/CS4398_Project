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

import type { DietaryFlag, Interval, Minute } from '@capstone/shared';

import { isValidObjectIdString } from './mongo';

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly wakeMinute: Minute;
  readonly sleepMinute: Minute;
  /**
   * FR-REC-09 / UC-01: the baseline calorie target the user SET at account creation — the floor
   * for FR-REC-08 and the FR-REC-06 fallback. Stored, never estimated (§4.9: the System asks).
   * A persistence field on the `users` document (the ERD's `baseline_calorie_target`), NOT a
   * shared-contract type — user data lives at this boundary (OPEN-12, v2.18).
   */
  readonly baselineCalories: number;
  /** FR-REC-05 / UC-01: the user's stated dietary preferences — a HARD meal constraint downstream. */
  readonly dietaryPreferences: readonly DietaryFlag[];
  readonly createdAt: string;
}

interface UserDocument {
  readonly _id: ObjectId;
  readonly email: string;
  readonly passwordHash: string;
  readonly wakeMinute: Minute;
  readonly sleepMinute: Minute;
  readonly baselineCalories: number;
  readonly dietaryPreferences: readonly DietaryFlag[];
  readonly createdAt: string;
}

const toRecord = (doc: UserDocument): UserRecord => ({
  id: doc._id.toHexString(),
  email: doc.email,
  passwordHash: doc.passwordHash,
  wakeMinute: doc.wakeMinute,
  sleepMinute: doc.sleepMinute,
  // Pre-14a accounts have no profile fields stored: default to a safe, explicit shape rather than
  // `undefined` leaking downstream (a missing baseline would break CaloriesToTargetRule silently).
  baselineCalories: doc.baselineCalories ?? 0,
  dietaryPreferences: doc.dietaryPreferences ?? [],
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
    // FR-REC-09/FR-REC-05: supplied by the register route (which REQUIRES a baseline — §4.9 asks,
    // never estimates). Optional HERE only so the frozen acceptance harness's older call site,
    // which does not exercise calories, still compiles — the store must not be edited to require
    // what a frozen test cannot pass. A real account always carries both (enforced at the route).
    baselineCalories?: number;
    dietaryPreferences?: readonly DietaryFlag[];
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
      baselineCalories: input.baselineCalories ?? 0,
      dietaryPreferences: input.dietaryPreferences ?? [],
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

  /** Every user id in the store — the background elapsed-window sweep's user list (FR-RSC-10). */
  async allUserIds(): Promise<string[]> {
    const docs = await this.users.find({}, { projection: { _id: 1 } }).toArray();
    return docs.map((doc) => doc._id.toHexString());
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
