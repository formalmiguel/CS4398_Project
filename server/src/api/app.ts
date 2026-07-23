/**
 * The Express app. FR-USR, FR-TSK, FR-CAL, FR-RSC-10's retrieval point, NFR-SEC-03/05.
 *
 * ⛔ This file calls `RescheduleService`'s seven methods and, for a flexible task's first
 * placement, relies on `sweepElapsed`'s existing "reattempt" branch (see the FR-SCH-10 note in
 * the packet). It never calls `findCandidateSlots` itself and never computes a placement.
 *
 * A fixed commitment is the ONE case this file writes a `Placement` directly — the user's own
 * statement of when it is, not the engine's answer (§3.4's sequence diagram inserts it before
 * asking the engine about anything else).
 */
import cors from 'cors';
import express, { Express, Response } from 'express';
import { Db } from 'mongodb';

import type { Placement, Task } from '@capstone/shared';

import { UserStore } from '../db/UserStore';
import { TaskRepository } from '../db/TaskRepository';
import type { Clock, RescheduleService } from '../reschedule/RescheduleService';
import { clockLabel } from '../reschedule/reasons';
import { AuthedRequest, AuthService, requireAuth } from './auth';
import { isSafeQueryString, validateTaskInput } from './validation';

export interface AppDependencies {
  readonly db: Db;
  readonly users: UserStore;
  readonly tasks: TaskRepository;
  readonly reschedule: RescheduleService;
  readonly clock: Clock;
  readonly auth: AuthService;
}

/** FR-CAL-01's fixed-commitment placement reason — the user's own statement, not the engine's. */
const commitmentReason = (title: string, start: number, end: number): string =>
  `"${title}" scheduled for ${clockLabel(start)} – ${clockLabel(end)}.`;

export const buildApp = (deps: AppDependencies): Express => {
  const { users, tasks, reschedule, clock, auth } = deps;
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ── Auth (FR-USR-01, FR-USR-02) ────────────────────────────────────────

  app.post('/auth/register', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const { email, password, wakeMinute, sleepMinute } = body;
    if (typeof email !== 'string' || email.length === 0) {
      res.status(400).json({ error: 'email is required' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'password must be at least 8 characters' });
      return;
    }
    if (
      typeof wakeMinute !== 'number' ||
      typeof sleepMinute !== 'number' ||
      wakeMinute < 0 ||
      wakeMinute > 1439 ||
      sleepMinute < 0 ||
      sleepMinute > 1439 ||
      sleepMinute <= wakeMinute
    ) {
      // FR-USR-07: the schedulable day is defined at account creation so task placement has
      // something to work with from the first request.
      res.status(400).json({ error: 'wakeMinute/sleepMinute must define a valid schedulable day' });
      return;
    }
    if ((await users.findByEmail(email)) !== undefined) {
      res.status(409).json({ error: 'an account with that email already exists' });
      return;
    }
    const passwordHash = await auth.hashPassword(password);
    const user = await users.create({ email, passwordHash, wakeMinute, sleepMinute });
    res.status(201).json({ userId: user.id, token: auth.signSession(user.id) });
  });

  app.post('/auth/login', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const { email, password } = body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(401).json({ error: 'invalid email or password' });
      return;
    }
    const user = await users.findByEmail(email);
    // NFR-SEC-05 / timing: verify against SOMETHING even when the email is unknown, so a
    // response-time difference cannot be used to enumerate registered emails.
    const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const valid = await auth.verifyPassword(password, hash);
    if (user === undefined || !valid) {
      res.status(401).json({ error: 'invalid email or password' });
      return;
    }
    res.json({ userId: user.id, token: auth.signSession(user.id) });
  });

  // ── User (FR-USR-07, NFR-SEC-06) ───────────────────────────────────────

  app.patch('/user/schedulable-day', requireAuth(auth), async (req: AuthedRequest, res) => {
    const { wakeMinute, sleepMinute } = req.body as Record<string, unknown>;
    if (
      typeof wakeMinute !== 'number' ||
      typeof sleepMinute !== 'number' ||
      wakeMinute < 0 ||
      wakeMinute > 1439 ||
      sleepMinute < 0 ||
      sleepMinute > 1439 ||
      sleepMinute <= wakeMinute
    ) {
      res.status(400).json({ error: 'wakeMinute/sleepMinute must define a valid schedulable day' });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await users.updateSchedulableDay(req.userId!, wakeMinute, sleepMinute);
    res.status(204).end();
  });

  app.delete('/user/me', requireAuth(auth), async (req: AuthedRequest, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    await tasks.deleteAllForUser(userId);
    // NFR-SEC-06: best-effort — packet 08 has not created this collection yet. Not a defect in
    // this packet; see docs/P12-REPORT.md.
    await deps.db.collection('wearableMetrics').deleteMany({ userId }).catch(() => undefined);
    await users.delete(userId);
    res.status(204).end();
  });

  // ── Ownership helper — NFR-SEC-03 ──────────────────────────────────────

  /** 404, never 403: a request for someone else's task must not confirm the task exists. */
  const loadOwnedTask = async (
    req: AuthedRequest,
    res: Response,
    taskId: unknown,
  ): Promise<Task | undefined> => {
    if (!isSafeQueryString(taskId)) {
      res.status(404).json({ error: 'not found' });
      return undefined;
    }
    const task = await tasks.getTask(taskId);
    const owner = await tasks.ownerOfTask(taskId);
    if (task === undefined || owner === undefined || owner !== req.userId) {
      res.status(404).json({ error: 'not found' });
      return undefined;
    }
    return task;
  };

  // ── Tasks (FR-TSK, FR-CAL, FR-SCH-10/OPEN-17) ──────────────────────────

  app.post('/tasks', requireAuth(auth), async (req: AuthedRequest, res) => {
    const validated = validateTaskInput(req.body);
    if (!validated.ok) {
      res.status(400).json({ errors: validated.errors });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    const { intendedDate, ...taskInput } = validated.value;

    const task = await tasks.createTask({ userId, intendedDate, ...taskInput });

    if (task.flexibility === 'FIXED') {
      // FR-CAL-01/02/03: the user's own statement of when it is — never the engine's answer.
      const placement: Placement = {
        id: tasks.nextPlacementId(),
        taskId: task.id,
        date: intendedDate,
        start: task.preferredWindow.start,
        end: task.preferredWindow.end,
        status: 'PLANNED',
        placementReason: commitmentReason(task.title, task.preferredWindow.start, task.preferredWindow.end),
      };
      await tasks.savePlacement(placement);
      // FR-RSC-02: a new commitment displaces whatever flexible task it overlaps.
      const displaced = await reschedule.onCommitmentAdded(task, intendedDate);
      res.status(201).json({ task, placement, displaced });
      return;
    }

    // FLEXIBLE: no placement written here, and NO sweep here either — see FR-SCH-10 below.
    // The client sees `placement: null` and calls GET /schedule to place it (which it must do
    // anyway, per FR-RSC-10).
    res.status(201).json({ task, placement: null });
  });

  app.get('/tasks/:id', requireAuth(auth), async (req: AuthedRequest, res) => {
    const task = await loadOwnedTask(req, res, req.params.id);
    if (task === undefined) return;
    res.json({ task });
  });

  app.get('/tasks', requireAuth(auth), async (req: AuthedRequest, res) => {
    const { date } = req.query;
    if (!isSafeQueryString(date)) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const list = await tasks.tasksForDate(req.userId!, date);
    res.json({ tasks: list });
  });

  app.patch('/tasks/:id', requireAuth(auth), async (req: AuthedRequest, res) => {
    const task = await loadOwnedTask(req, res, req.params.id);
    if (task === undefined) return;

    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.length >= 1 && body.title.length <= 100) {
      patch.title = body.title;
    }
    let placementAffecting = false;
    if (typeof body.durationMinutes === 'number') {
      patch.durationMinutes = body.durationMinutes;
      placementAffecting = true;
    }
    if (
      typeof body.preferredWindow === 'object' &&
      body.preferredWindow !== null &&
      typeof (body.preferredWindow as Record<string, unknown>).start === 'number' &&
      typeof (body.preferredWindow as Record<string, unknown>).end === 'number'
    ) {
      patch.preferredWindow = body.preferredWindow;
      placementAffecting = true;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'no recognized fields to update' });
      return;
    }
    await tasks.updateTaskAttributes(task.id, patch);
    const updated = await tasks.getTask(task.id);
    if (updated === undefined) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    // FR-TSK-04: re-evaluate every date this task currently has a PLANNED occurrence.
    // onTaskEdited MAY ONLY REJECT OR RE-PLACE — never choose outside the engine (FR-RSC-03).
    let outcomes: unknown[] = [];
    if (placementAffecting) {
      const dates = await tasks.plannedDatesForTask(task.id);
      outcomes = await Promise.all(dates.map((date) => reschedule.onTaskEdited(updated, date)));
    }
    res.json({ task: updated, outcomes });
  });

  app.delete('/tasks/:id', requireAuth(auth), async (req: AuthedRequest, res) => {
    const task = await loadOwnedTask(req, res, req.params.id);
    if (task === undefined) return;
    // FR-TSK-07: future placements removed; completion records preserved (DR-01).
    await tasks.deleteTaskAndFuturePlacements(task.id, clock.today());
    res.status(204).end();
  });

  // ── Occurrence actions ─────────────────────────────────────────────────

  const findPlannedPlacement = async (
    userId: string,
    taskId: string,
    date: string,
  ): Promise<Placement | undefined> => {
    const onDate = await tasks.placementsForDate(userId, date);
    return onDate.find((p) => p.taskId === taskId && p.status === 'PLANNED');
  };

  app.post('/tasks/:id/complete', requireAuth(auth), async (req: AuthedRequest, res) => {
    const task = await loadOwnedTask(req, res, req.params.id);
    if (task === undefined) return;
    const { date } = req.body as Record<string, unknown>;
    if (!isSafeQueryString(date)) {
      res.status(400).json({ error: 'date is required' });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    const placement = await findPlannedPlacement(userId, task.id, date);
    if (placement === undefined) {
      res.status(404).json({ error: 'no planned occurrence on that date' });
      return;
    }
    // FR-TSK-06: recording the timestamp is this packet's own bookkeeping (DR-01); FR-RSC-07/09
    // (never reschedule a completed task; withdraw an automatic reschedule) is the service's.
    const outcome = await reschedule.onCompletionRecorded(placement);
    await tasks.recordCompletion(placement.id, task.id, userId);
    res.json({ outcome });
  });

  app.post('/tasks/:id/skip', requireAuth(auth), async (req: AuthedRequest, res) => {
    const task = await loadOwnedTask(req, res, req.params.id);
    if (task === undefined) return;
    const { date } = req.body as Record<string, unknown>;
    if (!isSafeQueryString(date)) {
      res.status(400).json({ error: 'date is required' });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const placement = await findPlannedPlacement(req.userId!, task.id, date);
    if (placement === undefined) {
      res.status(404).json({ error: 'no planned occurrence on that date' });
      return;
    }
    // FR-RSC-08: accepted before the window elapses too — the service's own rule, not this route's.
    const outcome = await reschedule.onUserSkipped(placement);
    res.json({ outcome });
  });

  app.post('/tasks/:id/move-to-next-day', requireAuth(auth), async (req: AuthedRequest, res) => {
    const task = await loadOwnedTask(req, res, req.params.id);
    if (task === undefined) return;
    const { date } = req.body as Record<string, unknown>;
    if (!isSafeQueryString(date)) {
      res.status(400).json({ error: 'date is required' });
      return;
    }
    const outcome = await reschedule.moveToNextDay(task.id, date);
    res.json({ outcome });
  });

  // ── Schedule (FR-RSC-10's retrieval point) ─────────────────────────────

  app.get('/schedule', requireAuth(auth), async (req: AuthedRequest, res) => {
    const { date } = req.query;
    if (!isSafeQueryString(date)) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    // FR-RSC-10: evaluated at EVERY retrieval — this is the "each point" the requirement means.
    await reschedule.sweepElapsed(userId, date);
    const [taskList, placementList] = await Promise.all([
      tasks.tasksForDate(userId, date),
      tasks.placementsForDate(userId, date),
    ]);
    res.json({ tasks: taskList, placements: placementList });
  });

  return app;
};
