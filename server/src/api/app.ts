/**
 * The Express app. FR-USR, FR-TSK, FR-CAL, FR-RSC-10's retrieval point, NFR-SEC-03/05.
 *
 * ⛔ FR-RSC-03 still holds: `findCandidateSlots` is the only function anywhere that computes a
 * placement, and this file never re-implements it — it CALLS it, exactly as `RescheduleService`
 * does, for the one case that is genuinely this layer's own: a task's FIRST placement, at
 * creation (UC-02/UC-03, FR-DSH-06). That is a live, single-task, per-request decision — not
 * the "several flexible tasks placed together" FR-SCH-10 governs, and not an automatic
 * RESCHEDULE (FR-RSC), so it does not go through `RescheduleService`. Every trigger-driven
 * placement after creation — missed, skipped, displaced, edited, and the batched reattempt of a
 * task that genuinely could not be placed at creation — still goes through
 * `RescheduleService`'s seven methods, unchanged.
 *
 * A fixed commitment is the other case this file writes a `Placement` directly — the user's own
 * statement of when it is, not the engine's answer (§3.4's sequence diagram inserts it before
 * asking the engine about anything else).
 */
import { findCandidateSlots } from '@capstone/engine';
import cors from 'cors';
import express, { Express, Response } from 'express';
import { Db } from 'mongodb';

import type { Interval, Placement, PlacementStatus, Task } from '@capstone/shared';

import { UserStore } from '../db/UserStore';
import { TaskRepository } from '../db/TaskRepository';
import type { Clock, RescheduleService } from '../reschedule/RescheduleService';
import { clockLabel, dayAlreadyOverExplanation } from '../reschedule/reasons';
import { AuthedRequest, AuthService, requireAuth } from './auth';
import { isSafeQueryString, isValidSchedulableDay, validateTaskInput } from './validation';

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

/** UC-02: the task landed inside the window the user actually asked for — no conflict to resolve. */
const fitsPreferredReason = (title: string, start: number): string =>
  `"${title}" placed at ${clockLabel(start)}.`;

/** UC-03: the user was shown ranked alternatives because the preferred window had no room, and picked this one. */
const acceptedAlternativeReason = (title: string, start: number): string =>
  `"${title}" placed at ${clockLabel(start)} — you chose this after your preferred time was unavailable.`;

/**
 * The busy set for a single-task creation-time engine call — SRS v2.17's invariant applied here
 * too: `PLANNED` and `COMPLETED` only. A `MISSED`/`SKIPPED`/`CANCELLED` row is not going to
 * happen and must not hold the day against the task being created.
 */
const OCCUPYING: readonly PlacementStatus[] = ['PLANNED', 'COMPLETED'];
const busySetFrom = (placements: readonly Placement[]): Interval[] =>
  placements.filter((p) => OCCUPYING.includes(p.status)).map((p) => ({ start: p.start, end: p.end }));

/**
 * FR-RSC-01 (v2.14)'s "remainder of day" rule, applied here too. `RescheduleService.askEngine`
 * (`server/src/reschedule/RescheduleService.ts`) does this exact narrowing for every reschedule
 * trigger, and the same reasoning applies verbatim to a task created today with a preferred
 * window that has already passed: without it, a task created at 10am for "7:00-8:00am" would be
 * placed IN THE PAST, and the very next `GET /schedule` would instantly reclassify it `MISSED`
 * before the user ever saw it planned. This is caller-side input-shaping, not a second placement
 * function — `findCandidateSlots` is still the only function that decides where anything goes;
 * this only decides what window to ask it about. `RescheduleService`'s copy is private and this
 * file may not edit that module, so the shape is necessarily duplicated here — see docs/P12-REPORT.md.
 */
const remainderOfDay = (day: Interval, date: string, clock: Clock): Interval | undefined => {
  if (date !== clock.today()) return day;
  const start = Math.max(day.start, clock.nowMinute());
  return start < day.end ? { start, end: day.end } : undefined;
};

/** Companion to `remainderOfDay`: substitutes the TASK's window only when it has itself elapsed. */
const askedAbout = (task: Task, window: Interval, date: string, clock: Clock): Task => {
  if (date !== clock.today()) return task;
  if (task.preferredWindow.end > clock.nowMinute()) return task;
  return { ...task, preferredWindow: window };
};

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
      !isValidSchedulableDay(wakeMinute, sleepMinute)
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
    res.status(201).json({
      userId: user.id,
      token: auth.signSession(user.id),
      wakeMinute: user.wakeMinute,
      sleepMinute: user.sleepMinute,
    });
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
    res.json({
      userId: user.id,
      token: auth.signSession(user.id),
      wakeMinute: user.wakeMinute,
      sleepMinute: user.sleepMinute,
    });
  });

  // ── User (FR-USR-07, NFR-SEC-06) ───────────────────────────────────────

  // FR-USR-07's schedulable day, re-readable on session restore (e.g. a stored token surviving
  // a page reload, with no fresh /auth/login to carry wakeMinute/sleepMinute again). Additive:
  // no existing route's shape changes, and neither does the contract.
  app.get('/user/me', requireAuth(auth), async (req: AuthedRequest, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const user = await users.findById(req.userId!);
    if (user === undefined) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ userId: user.id, email: user.email, wakeMinute: user.wakeMinute, sleepMinute: user.sleepMinute });
  });

  app.patch('/user/schedulable-day', requireAuth(auth), async (req: AuthedRequest, res) => {
    const { wakeMinute, sleepMinute } = req.body as Record<string, unknown>;
    if (
      typeof wakeMinute !== 'number' ||
      typeof sleepMinute !== 'number' ||
      !isValidSchedulableDay(wakeMinute, sleepMinute)
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
    const found = await tasks.getTaskWithOwner(taskId);
    if (found === undefined || found.ownerId !== req.userId) {
      res.status(404).json({ error: 'not found' });
      return undefined;
    }
    return found.task;
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

    // FLEXIBLE: UC-02/UC-03 — a single-task, creation-time call to the engine. Not FR-SCH-10 (that
    // governs several tasks placed TOGETHER in one operation) and not RescheduleService (nothing
    // is being RE-scheduled; this task has never had a placement).
    const [rawDay, onDate] = await Promise.all([
      tasks.schedulableDay(userId, intendedDate),
      tasks.placementsForDate(userId, intendedDate),
    ]);
    const day = remainderOfDay(rawDay, intendedDate, clock);
    if (day === undefined) {
      // FR-RSC-01's v2.14 case, applied at creation: `now` is at or past the end of the
      // schedulable day, so there is no remainder to ask about and no valid Interval to pass.
      res.status(201).json({
        task,
        placement: null,
        candidates: null,
        unplaceable: {
          placed: false,
          slots: [],
          reason: 'DAY_FULL',
          explanation: dayAlreadyOverExplanation(task, rawDay.end),
        },
      });
      return;
    }
    const result = findCandidateSlots(busySetFrom(onDate), askedAbout(task, day, intendedDate, clock), day);

    if (!result.placed) {
      // FR-SCH-06: reported, never silently dropped. The task stays created and unplaced;
      // FR-RSC-05's re-attempt (via sweepElapsed, at the next GET /schedule) keeps retrying it.
      res
        .status(201)
        .json({ task, placement: null, candidates: null, unplaceable: result });
      return;
    }

    const [best] = result.slots;
    if (best === undefined) {
      throw new Error('findCandidateSlots returned placed: true with no candidate slots');
    }

    if (best.withinPreferredWindow) {
      // UC-02: it landed inside the window the user actually asked for. No real conflict —
      // auto-place, exactly as the use case's basic path does.
      const placement: Placement = {
        id: tasks.nextPlacementId(),
        taskId: task.id,
        date: intendedDate,
        start: best.start,
        end: best.end,
        status: 'PLANNED',
        placementReason: fitsPreferredReason(task.title, best.start),
      };
      await tasks.savePlacement(placement);
      res.status(201).json({ task, placement, candidates: null, unplaceable: null });
      return;
    }

    // UC-03 / FR-DSH-06: the preferred window had no room. Present the ranked alternatives and
    // write NOTHING — the user accepts one via POST /tasks/:id/place. Marked `awaitingChoice` so
    // the very next GET /schedule (FR-RSC-10 sweeps unconditionally) does not auto-place it out
    // from under the picker — see the field's comment in TaskRepository.
    await tasks.setAwaitingChoice(task.id, true);
    res.status(201).json({ task, placement: null, candidates: result.slots, unplaceable: null });
  });

  app.post('/tasks/:id/place', requireAuth(auth), async (req: AuthedRequest, res) => {
    const task = await loadOwnedTask(req, res, req.params.id);
    if (task === undefined) return;
    if (task.flexibility !== 'FLEXIBLE') {
      res.status(400).json({ error: 'only a flexible task can be placed this way' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const { date, start, end } = body;
    if (!isSafeQueryString(date) || typeof start !== 'number' || typeof end !== 'number') {
      res.status(400).json({ error: 'date, start, and end are required' });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;

    // UC-03's candidates were computed moments before this request and may be stale — another
    // commitment or task could have landed since. Never trust the client's chosen interval
    // blindly; re-validate against the CURRENT busy set (FR-CAL-02's overlap rule).
    const [day, onDate] = await Promise.all([
      tasks.schedulableDay(userId, date),
      tasks.placementsForDate(userId, date),
    ]);
    if (onDate.some((p) => p.taskId === task.id && p.status === 'PLANNED')) {
      res.status(409).json({ error: 'this task already has a placement for that date' });
      return;
    }
    const busy = busySetFrom(onDate);
    const overlapsBusy = busy.some((b) => start < b.end && b.start < end);
    const withinDay = start >= day.start && end <= day.end;
    const matchesDuration = end - start === task.durationMinutes;
    if (overlapsBusy || !withinDay || !matchesDuration) {
      res.status(409).json({ error: 'that slot is no longer available' });
      return;
    }

    const placement: Placement = {
      id: tasks.nextPlacementId(),
      taskId: task.id,
      date,
      start,
      end,
      status: 'PLANNED',
      placementReason: acceptedAlternativeReason(task.title, start),
    };
    await tasks.savePlacement(placement);
    // The choice is made — this task is visible to sweepElapsed again like any other.
    await tasks.setAwaitingChoice(task.id, false);
    res.status(201).json({ placement });
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
    const userId = req.userId!;
    // allTasksForDate, not tasksForDate: the user must see a task awaiting a UC-03 choice too.
    const [list, awaitingChoice] = await Promise.all([
      tasks.allTasksForDate(userId, date),
      tasks.awaitingChoiceTaskIds(userId, date),
    ]);
    res.json({ tasks: list, awaitingChoice });
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

  /** Shared by complete/skip: load the owned task, the target date, and its PLANNED occurrence. */
  const loadPlannedOccurrence = async (
    req: AuthedRequest,
    res: Response,
  ): Promise<{ task: Task; placement: Placement } | undefined> => {
    const task = await loadOwnedTask(req, res, req.params.id);
    if (task === undefined) return undefined;
    const { date } = req.body as Record<string, unknown>;
    if (!isSafeQueryString(date)) {
      res.status(400).json({ error: 'date is required' });
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const placement = await findPlannedPlacement(req.userId!, task.id, date);
    if (placement === undefined) {
      res.status(404).json({ error: 'no planned occurrence on that date' });
      return undefined;
    }
    return { task, placement };
  };

  app.post('/tasks/:id/complete', requireAuth(auth), async (req: AuthedRequest, res) => {
    const found = await loadPlannedOccurrence(req, res);
    if (found === undefined) return;
    // FR-TSK-06: recording the timestamp is this packet's own bookkeeping (DR-01); FR-RSC-07/09
    // (never reschedule a completed task; withdraw an automatic reschedule) is the service's.
    const outcome = await reschedule.onCompletionRecorded(found.placement);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await tasks.recordCompletion(found.placement.id, found.task.id, req.userId!);
    res.json({ outcome });
  });

  app.post('/tasks/:id/skip', requireAuth(auth), async (req: AuthedRequest, res) => {
    const found = await loadPlannedOccurrence(req, res);
    if (found === undefined) return;
    // FR-RSC-08: accepted before the window elapses too — the service's own rule, not this route's.
    const outcome = await reschedule.onUserSkipped(found.placement);
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
    // Tasks awaiting a UC-03 choice are excluded from the sweep itself (tasksForDate), so this
    // never auto-places one out from under a picker the user hasn't acted on yet.
    await reschedule.sweepElapsed(userId, date);
    const [taskList, placementList, awaitingChoice] = await Promise.all([
      tasks.allTasksForDate(userId, date),
      tasks.placementsForDate(userId, date),
      tasks.awaitingChoiceTaskIds(userId, date),
    ]);
    res.json({ tasks: taskList, placements: placementList, awaitingChoice });
  });

  // ── Calendar overview (month-grid dots) ─────────────────────────────────
  //
  // NOT a placement read — see TaskRepository.taskTypesInRange's own note on why. No sweep, no
  // engine call, no write: viewing a month must never trigger reschedule side effects for every
  // day in it.
  const MAX_OVERVIEW_DAYS = 62;

  app.get('/schedule/overview', requireAuth(auth), async (req: AuthedRequest, res) => {
    const { start, end } = req.query;
    if (!isSafeQueryString(start) || !isSafeQueryString(end)) {
      res.status(400).json({ error: 'start and end query parameters are required' });
      return;
    }
    if (end < start) {
      res.status(400).json({ error: 'end must not be before start' });
      return;
    }
    const spanDays =
      (new Date(`${end}T00:00:00.000Z`).getTime() - new Date(`${start}T00:00:00.000Z`).getTime()) / 86_400_000 + 1;
    if (spanDays > MAX_OVERVIEW_DAYS) {
      res.status(400).json({ error: `range too large — ${MAX_OVERVIEW_DAYS} days maximum` });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    const days = await tasks.taskTypesInRange(userId, start, end);
    res.json({ days });
  });

  return app;
};
