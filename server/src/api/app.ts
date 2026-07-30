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

import type {
  DietaryFlag,
  IntensityTier,
  Interval,
  Placement,
  PlacementResult,
  PlacementStatus,
  Slot,
  Task,
} from '@capstone/shared';

import { buildIcsCalendar, IcsExportEvent } from '../calendar/ics';
import { UserStore } from '../db/UserStore';
import type { UserRecord } from '../db/UserStore';
import { TaskRepository } from '../db/TaskRepository';
import { MetricStore } from '../db/MetricStore';
import type { Catalog } from '../catalog/Catalog';
import type { RecommendationScheduler } from '../recommendation/RecommendationScheduler';
import { RecommendationEngine } from '../recommendation/RecommendationEngine';
import { SleepToIntensityRule } from '../recommendation/SleepToIntensityRule';
import { CaloriesToTargetRule } from '../recommendation/CaloriesToTargetRule';
import { analyzeHabit } from '../analytics/HabitAnalytics';
import type { Clock, RescheduleService } from '../reschedule/RescheduleService';
import { clockLabel, dayAlreadyOverExplanation, dayAlreadyPassedExplanation } from '../reschedule/reasons';
import { AuthedRequest, AuthService, requireAuth } from './auth';
import {
  isSafeQueryString,
  isValidSchedulableDay,
  validateDailyMetricSet,
  validateTaskInput,
} from './validation';

export interface AppDependencies {
  readonly db: Db;
  readonly users: UserStore;
  readonly tasks: TaskRepository;
  readonly reschedule: RescheduleService;
  readonly clock: Clock;
  readonly auth: AuthService;
  /** FR-WEL-01/04/05, FR-WER-07: the Daily Metric Set store (packet 08). */
  readonly metrics: MetricStore;
  /** FR-WEL-02/03: the seeded workout + meal libraries (packet 11), behind the §3.6 `Catalog` seam. */
  readonly catalog: Catalog;
  /**
   * FR-REC-04 (packet 17d): builds the apply-workout scheduler for ONE user. A factory, not an
   * instance, because `CaloriesToTargetRule` needs THIS user's baseline (FR-REC-09) — the same
   * reason `GET /wellness` builds its engine per request. The composition root owns which rules
   * exist; this layer only asks for a scheduler and calls it.
   */
  readonly recommendationSchedulerFor: (user: UserRecord) => RecommendationScheduler;
}

/** The five dietary flags (FR-REC-05). A local guard so the register route can validate input. */
const DIETARY_FLAGS: readonly DietaryFlag[] = [
  'VEGETARIAN',
  'VEGAN',
  'GLUTEN_FREE',
  'DAIRY_FREE',
  'NUT_FREE',
];
const isDietaryFlag = (v: unknown): v is DietaryFlag =>
  typeof v === 'string' && (DIETARY_FLAGS as readonly string[]).includes(v);

/** FR-REC-09: a baseline the user actually set — positive and within a sane human range. */
const isValidBaselineCalories = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 500 && v <= 10000;

/** `YYYY-MM-DD` shifted by whole days. Lexicographic order stays chronological (contract §IsoDate). */
const shiftIsoDate = (date: string, deltaDays: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

/**
 * FR-WEL-03 / FR-LIB-07: a day plan is BREAKFAST + LUNCH + DINNER, the daily calorie target split
 * in these FIXED proportions and each slot found INDEPENDENTLY within ±10% of its OWN slot target.
 * The catalog is a library, not a planner (packet 11) — `findMeals` takes a PER-SLOT target, so
 * this layer owns the split. These are the ratified proportions (SRS v2.30); under them per-slot
 * ±10% yields whole-day ±10% by construction, so the assembler needs no cross-slot optimisation.
 */
const DAY_PLAN_SPLIT: Readonly<Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>> = {
  BREAKFAST: 0.3,
  LUNCH: 0.35,
  DINNER: 0.35,
};

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
 *
 * ⛔ OPEN-36 (the same shape as OPEN-35, in this file's own duplicate copy): a date strictly
 * before `clock.today()` has no remainder at all — the day is entirely over, not "not today" in
 * the future-facing sense the old single check conflated it with. This was inert while the only
 * caller was task creation (normally today), but `GET /tasks/:id/candidates` (below) recomputes
 * for a task that may have sat `awaitingChoice` for days, so its `intendedDate` can easily be in
 * the past by the time this runs — exactly OPEN-35's bug, just in this file's copy instead of
 * `RescheduleService.remainderOfDay`'s (already fixed there).
 */
const remainderOfDay = (day: Interval, date: string, clock: Clock): Interval | undefined => {
  if (date < clock.today()) return undefined;
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

/**
 * Where a FLEXIBLE task's ranked candidates would land on `date`, without writing anything.
 * Shared by `POST /tasks`'s UC-02/03 branch (which additionally auto-places when the top
 * candidate is `withinPreferredWindow`) and `GET /tasks/:id/candidates` (OPEN-36, which never
 * auto-places — see that route's own comment for why).
 */
type CandidateComputation =
  | { readonly placed: true; readonly candidates: readonly Slot[] }
  | { readonly placed: false; readonly unplaceable: Extract<PlacementResult, { placed: false }> };

const computeCandidates = async (
  userId: string,
  task: Task,
  date: string,
  tasks: TaskRepository,
  clock: Clock,
): Promise<CandidateComputation> => {
  const [rawDay, onDate] = await Promise.all([
    tasks.schedulableDay(userId, date),
    tasks.placementsForDate(userId, date),
  ]);
  const day = remainderOfDay(rawDay, date, clock);
  if (day === undefined) {
    // FR-RSC-01's v2.14 case / OPEN-35's shape: either today's clock is past the day's end, or
    // `date` itself has already closed — two different, honestly-worded reasons (see
    // `dayAlreadyOverExplanation` vs `dayAlreadyPassedExplanation`).
    const explanation =
      date < clock.today() ? dayAlreadyPassedExplanation(task, date) : dayAlreadyOverExplanation(task, rawDay.end);
    return { placed: false, unplaceable: { placed: false, slots: [], reason: 'DAY_FULL', explanation } };
  }
  const result = findCandidateSlots(busySetFrom(onDate), askedAbout(task, day, date, clock), day);
  if (!result.placed) return { placed: false, unplaceable: result };
  return { placed: true, candidates: result.slots };
};

export const buildApp = (deps: AppDependencies): Express => {
  const { users, tasks, reschedule, clock, auth, metrics, catalog, recommendationSchedulerFor } =
    deps;
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ── Auth (FR-USR-01, FR-USR-02) ────────────────────────────────────────

  app.post('/auth/register', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const { email, password, wakeMinute, sleepMinute, baselineCalories, dietaryPreferences } = body;
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
    // FR-REC-09 / UC-01: the user sets a baseline calorie target at account creation. The System
    // asks — it never estimates BMR (§4.9), so this is required input, not a derived default.
    if (!isValidBaselineCalories(baselineCalories)) {
      res.status(400).json({ error: 'baselineCalories must be a number between 500 and 10000' });
      return;
    }
    // FR-REC-05 / UC-01: dietary preferences, an optional array (empty = no restriction) whose
    // every element must be a known flag — an unknown flag is rejected rather than silently dropped.
    const prefs = dietaryPreferences ?? [];
    if (!Array.isArray(prefs) || !prefs.every(isDietaryFlag)) {
      res.status(400).json({ error: 'dietaryPreferences must be an array of dietary flags' });
      return;
    }
    if ((await users.findByEmail(email)) !== undefined) {
      res.status(409).json({ error: 'an account with that email already exists' });
      return;
    }
    const passwordHash = await auth.hashPassword(password);
    const user = await users.create({
      email,
      passwordHash,
      wakeMinute,
      sleepMinute,
      baselineCalories,
      dietaryPreferences: prefs,
    });
    res.status(201).json({
      userId: user.id,
      token: auth.signSession(user.id),
      wakeMinute: user.wakeMinute,
      sleepMinute: user.sleepMinute,
      baselineCalories: user.baselineCalories,
      dietaryPreferences: user.dietaryPreferences,
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
      baselineCalories: user.baselineCalories,
      dietaryPreferences: user.dietaryPreferences,
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
    res.json({
      userId: user.id,
      email: user.email,
      wakeMinute: user.wakeMinute,
      sleepMinute: user.sleepMinute,
      baselineCalories: user.baselineCalories,
      dietaryPreferences: user.dietaryPreferences,
    });
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
    const computed = await computeCandidates(userId, task, intendedDate, tasks, clock);

    if (!computed.placed) {
      // FR-SCH-06: reported, never silently dropped. The task stays created and unplaced;
      // FR-RSC-05's re-attempt (via sweepElapsed, at the next GET /schedule) keeps retrying it.
      res.status(201).json({ task, placement: null, candidates: null, unplaceable: computed.unplaceable });
      return;
    }

    const [best] = computed.candidates;
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
    res.status(201).json({ task, placement: null, candidates: computed.candidates, unplaceable: null });
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

  /**
   * OPEN-36: `TaskForm`'s `CandidatePicker` only ever appears once, at creation — the offer it
   * shows is never persisted, so once that modal closes there was previously no way back to it.
   * This recomputes a FRESH ranked list on demand for a task that is STILL awaiting a choice, so
   * the schedule view can reopen the same picker later. Deliberately read-only: even if the
   * preferred window has reopened since, it comes back as the top candidate rather than being
   * silently auto-placed — the user asked to see and choose, having explicitly clicked in for
   * exactly that. Accepting one still goes through the existing `POST /tasks/:id/place` above.
   */
  app.get('/tasks/:id/candidates', requireAuth(auth), async (req: AuthedRequest, res) => {
    const task = await loadOwnedTask(req, res, req.params.id);
    if (task === undefined) return;
    const { date } = req.query;
    if (!isSafeQueryString(date)) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;

    // The task must currently be awaiting a choice for exactly this date. Nothing else ever sets
    // `awaitingChoice`, so this membership check also structurally guarantees `task.flexibility
    // === 'FLEXIBLE'` — a FIXED commitment can never be in this state.
    const awaiting = await tasks.awaitingChoiceTaskIds(userId, date);
    if (!awaiting.includes(task.id)) {
      res.status(409).json({ error: 'this task is not currently awaiting a choice for that date' });
      return;
    }

    const computed = await computeCandidates(userId, task, date, tasks, clock);
    if (!computed.placed) {
      res.json({ candidates: null, unplaceable: computed.unplaceable });
      return;
    }
    res.json({ candidates: computed.candidates, unplaceable: null });
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

  // ── Calendar export (FR-CAL-07, SI-06) ──────────────────────────────────
  //
  // Text generation, nothing else: no OAuth, no third-party write, no network (CON-07). It
  // reads back whatever this System already placed — the same "engine decided, this file only
  // reports" boundary every other route in this file respects (FR-RSC-03).
  const MAX_EXPORT_DAYS = 366;

  // A CANCELLED placement is a withdrawn automatic reschedule (FR-RSC-09) — the original
  // occurrence stayed where it was, so this one was never really "placed" and exporting it
  // would put a phantom event on the user's calendar. Every other status DID occupy the slot
  // at some point, including MISSED/SKIPPED, so FR-CAL-07's "each placed task" includes them.
  const EXPORTABLE_STATUSES: readonly PlacementStatus[] = ['PLANNED', 'COMPLETED', 'MISSED', 'SKIPPED'];

  app.get('/schedule/export', requireAuth(auth), async (req: AuthedRequest, res) => {
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
    if (spanDays > MAX_EXPORT_DAYS) {
      res.status(400).json({ error: `range too large — ${MAX_EXPORT_DAYS} days maximum` });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    const placements = (await tasks.placementsInRange(userId, start, end)).filter((p) =>
      EXPORTABLE_STATUSES.includes(p.status),
    );
    const taskById = await tasks.getTasksByIds(placements.map((p) => p.taskId));
    const events: IcsExportEvent[] = placements.map((p) => ({
      uid: p.id,
      title: taskById.get(p.taskId)?.title ?? 'Untitled',
      date: p.date,
      start: p.start,
      end: p.end,
    }));
    const ics = buildIcsCalendar(events, new Date());
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="schedule-${start}-to-${end}.ics"`);
    res.send(ics);
  });

  // ── Wearable metric ingestion (FR-WER-07 injection, FR-WER-09 idempotent) ─
  //
  // Exposes MetricStore.ingest over HTTP so the Daily Metric Set has data for the wellness view.
  // Idempotency and the DR-05 stored shape are MetricStore's — this route does not re-implement
  // them. A JSON injection path (FR-WER-07/UC-12) is all the wellness demo needs; a raw Garmin
  // export FILE upload is deliberately out of scope (packet 14a).
  app.post('/wearable/metrics', requireAuth(auth), async (req: AuthedRequest, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    // FR-WER-06: every metric is checked against the `Metric` union at runtime, not just the
    // envelope. The body arrives as `unknown`, so the union constrains nothing until something
    // does this — see `validateDailyMetricSet`. Errors are returned as a list, matching POST
    // /tasks, so a caller fixes every field at once rather than one per round trip.
    const validated = validateDailyMetricSet(req.body);
    if (!validated.ok) {
      res.status(400).json({ errors: validated.errors });
      return;
    }
    await metrics.ingest(userId, validated.value);
    res.status(204).end();
  });

  // ── Wellness read surface (FR-WEL-01…05, UI-03 data) ────────────────────
  //
  // ⛔ READ ONLY. This composes MetricStore + RecommendationEngine + Catalog for display. It must
  // NOT call RecommendationScheduler.applyWorkoutRecommendation, which PLACES a task (FR-REC-02/04):
  // opening the wellness tab must never mutate the schedule. The tier + reason come from
  // RecommendationEngine.recommend (the read path); the options come from Catalog.findWorkouts.
  app.get('/wellness', requireAuth(auth), async (req: AuthedRequest, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    const user = await users.findById(userId);
    if (user === undefined) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const dateParam = req.query.date;
    const date = isSafeQueryString(dateParam) ? dateParam : clock.today();

    // FR-WEL-01: the metric set for the date, rendered by whatever it contains (not a fixed list).
    // FR-WEL-04: the previous 7 days (inclusive) as raw DailyMetricSets — the view extracts the
    // sleep-score and active-calorie series, so a metric added under FR-WER-04 needs no change here.
    const [metricSet, history] = await Promise.all([
      metrics.getDailyMetricSet(userId, date),
      metrics.getMetricsInRange(userId, shiftIsoDate(date, -6), date),
    ]);

    // The recommendation engine is built PER REQUEST from the loaded user, because
    // CaloriesToTargetRule needs THIS user's baseline (FR-REC-09) — never a boot-time constant.
    const engine = new RecommendationEngine();
    engine.register(new SleepToIntensityRule());
    engine.register(new CaloriesToTargetRule(user.baselineCalories));
    const recommendations = engine.recommend(metricSet);

    // Narrow the union by kind (both rules are always registered, so both decisions are present).
    let tier: IntensityTier = 'MODERATE';
    let workoutReason = recommendations[0]?.reason;
    let target = user.baselineCalories;
    let calorieUsedFallback = true;
    for (const rec of recommendations) {
      if (rec.decision.kind === 'WORKOUT_INTENSITY') {
        tier = rec.decision.tier;
        workoutReason = rec.reason;
      } else {
        target = rec.decision.calorieTarget;
        calorieUsedFallback = rec.reason.usedFallback;
      }
    }

    // FR-WEL-02: today's recommended workout + its tier + the two alternatives from FR-REC-03.
    const workouts = catalog.findWorkouts(tier, {}, 3);
    // FR-WEL-03: the meal PLAN — one meal per slot — and the calorie target it was built against,
    // with baseline and the activity contribution shown SEPARATELY. activity = target − baseline
    // (0 when no active-calorie metric is available, in which case usedFallback flags that the
    // target is not a measured figure). The daily target is split per DAY_PLAN_SPLIT and each slot
    // is queried independently; the catalog already applied the dietary/tolerance constraints.
    const activity = target - user.baselineCalories;
    const plan = (['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((mealType) => {
      const slotTarget = Math.round(DAY_PLAN_SPLIT[mealType] * target);
      const result = catalog.findMeals(slotTarget, user.dietaryPreferences, mealType);
      // The meal closest to the slot target, from what findMeals already filtered (dietary flags are
      // HARD and never relaxed — FR-REC-05). null when even full relaxation yields no candidate.
      const meal =
        result.items.length > 0
          ? result.items.reduce((a, b) =>
              Math.abs(a.calories - slotTarget) <= Math.abs(b.calories - slotTarget) ? a : b,
            )
          : null;
      return { mealType, slotTarget, meal, relaxed: result.relaxed, satisfiable: result.satisfiable };
    });
    const planTotalCalories = plan.reduce((sum, slot) => sum + (slot.meal?.calories ?? 0), 0);

    res.json({
      date,
      metrics: metricSet, // FR-WEL-01 / FR-WEL-05: carries each metric's availability + the set's date
      history, // FR-WEL-04
      workout: {
        tier,
        recommended: workouts.items[0] ?? null,
        alternatives: workouts.items.slice(1, 3),
        reason: workoutReason ?? null, // FR-REC-13 (the machine-readable reason; the sentence is a view concern)
        satisfiable: workouts.satisfiable,
      },
      meals: {
        baseline: user.baselineCalories, // FR-WEL-03: shown separately from…
        activity, // …the activity contribution
        target,
        planTotalCalories,
        // FR-WEL-05 / FR-REC-06 / UC-08 alt flow: true = the target fell back to the baseline
        // because active calories were unavailable. The view must not present it as measured.
        madeWithoutCurrentData: calorieUsedFallback,
        plan,
      },
    });
  });

  // ── Apply a recommendation (FR-REC-02, FR-REC-03, FR-REC-04) ───────────
  //
  // ⚠️ THIS ROUTE MUTATES THE SCHEDULE, and that is the whole point — it is the counterpart to
  // read-only `GET /wellness`. FR-REC-04 (`CLAUDE.md` §5, the load-bearing requirement) is what
  // makes this one integrated System rather than a scheduler and a fitness app sharing a login:
  // the recommended workout becomes a REAL task on the REAL calendar, placed by the SAME engine
  // and defended by the SAME rescheduling as anything the user typed in.
  //
  // ⛔ This route decides NOTHING. It loads the user, builds their scheduler, and calls one
  // method. The replacement policy, the tier comparison, the catalog draw and the placement are
  // `RecommendationScheduler`'s, pinned by the frozen acceptance (`8809158`) and replacement
  // (`47bb301`) suites. FR-RSC-03 holds: no placement is computed here.
  app.post('/recommendations/apply-workout', requireAuth(auth), async (req: AuthedRequest, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    const user = await users.findById(userId);
    if (user === undefined) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    // The date defaults to today, matching /wellness — §6 applies the recommendation for the day
    // whose metrics were just injected.
    const { date: bodyDate } = req.body as Record<string, unknown>;
    const date = isSafeQueryString(bodyDate) ? bodyDate : clock.today();

    const scheduler = recommendationSchedulerFor(user);
    try {
      const result = await scheduler.applyWorkoutRecommendation(userId, date);
      res.json(result);
    } catch (err: unknown) {
      // The scheduler throws for the four "nothing to apply" preconditions — no workout above the
      // warranted tier, no candidate in the catalog, the engine could not place, no recommendation
      // for the day. Those are 409s, not faults: the request was well-formed and the System simply
      // has nothing to replace. Every one of them is prefixed by the method name, which is a stable
      // property of that frozen-tested class.
      //
      // ⚠️ Anything else RETHROWS. Blanket-catching here would turn a genuine defect into a tidy
      // 409 and hide it — precisely the failure this project keeps finding the hard way.
      const message = err instanceof Error ? err.message : String(err);
      if (!message.startsWith('applyWorkoutRecommendation:')) throw err;
      res.status(409).json({ error: message.replace('applyWorkoutRecommendation: ', '') });
    }
  });

  // FR-ANL-01/02/04 (UI-04): a streak and completion rate for each of the user's HABIT tasks.
  // Read-only, exactly like /wellness — opening the analytics tab must never mutate the schedule,
  // so this reads placements and never touches RescheduleService or the engine.
  //
  // The window is the trailing year ending today, bounded so the placement query stays cheap
  // (same convention as /schedule/overview and /schedule/export). `asOf` is the request instant
  // from the injected clock: the ROUTE may read the clock, but it hands the instant to the PURE
  // analyzeHabit, which may not (§4.7). That instant is what lets an elapsed-but-unswept PLANNED
  // day count as a miss — FR-RSC-10 sweeps elapsed→MISSED only on retrieval, so a day the user
  // never opened is still PLANNED and would otherwise silently inflate the completion rate.
  app.get('/analytics', requireAuth(auth), async (req: AuthedRequest, res) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userId = req.userId!;
    const user = await users.findById(userId);
    if (user === undefined) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const asOf = clock.today();
    const from = shiftIsoDate(asOf, -364);
    const to = asOf;

    const habits = await tasks.habitsForUser(userId);
    const analytics = await Promise.all(
      habits.map(async (habit) => {
        const placements = await tasks.placementsForTaskInRange(userId, habit.id, from, to);
        const stats = analyzeHabit(placements, { start: from, end: to }, asOf);
        return { taskId: habit.id, title: habit.title, ...stats };
      }),
    );

    res.json({ from, to, asOf, habits: analytics });
  });

  return app;
};
