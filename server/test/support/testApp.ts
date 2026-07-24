/**
 * Builds a full app against `mongodb-memory-server`, the REAL engine, and a `TestableClock` the
 * test can advance by hand — no stub anywhere near a placement decision (FR-RSC-03's "at least
 * one test runs the service against the real engine" extended to this packet's own suite).
 */
import { findCandidateSlots } from '@capstone/engine';
import { Express } from 'express';

import { UserStore } from '../../src/db/UserStore';
import { TaskRepository } from '../../src/db/TaskRepository';
import { RescheduleService } from '../../src/reschedule/RescheduleService';
import { AuthService } from '../../src/api/auth';
import { buildApp } from '../../src/api/app';
import { TestableClock } from './TestableClock';
import { startTestDb, TestDb } from './testDb';

export interface TestApp {
  readonly app: Express;
  readonly users: UserStore;
  readonly tasks: TaskRepository;
  readonly clock: TestableClock;
  readonly auth: AuthService;
  readonly stop: () => Promise<void>;
}

export const buildTestApp = async (
  startMinute = 0,
  startDate = '2026-07-23',
): Promise<TestApp> => {
  const testDb: TestDb = await startTestDb();
  const users = new UserStore(testDb.db);
  await users.ensureIndexes();
  const tasks = new TaskRepository(testDb.db, users);
  const clock = new TestableClock(startMinute, startDate);
  const reschedule = new RescheduleService(findCandidateSlots, tasks, clock);
  const auth = new AuthService('test-jwt-secret');

  const app = buildApp({ db: testDb.db, users, tasks, reschedule, clock, auth });

  return { app, users, tasks, clock, auth, stop: testDb.stop };
};
