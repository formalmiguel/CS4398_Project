/**
 * Acceptance-suite harness (packet 17a, 🔴 RED). Builds the REAL stack in memory — the real
 * `findCandidateSlots`, the real `RescheduleService`, the real `RecommendationEngine` + the two
 * real rules, the real `MetricStore`/`TaskRepository`/`UserStore` over `mongodb-memory-server`,
 * and a `TestableClock` advanced by hand — PLUS the throwing `RecommendationScheduler` (packet
 * 17b's surface) and a deterministic `Catalog` double.
 *
 * ⛔ NO STUB ANYWHERE NEAR A PLACEMENT DECISION (FR-RSC-03). The only throwing thing is
 * `RecommendationScheduler` — the wiring that 17b writes. Everything the acceptance suite calls
 * to VERIFY a placement (the engine, the reschedule service) is the real, frozen code.
 *
 * ⛔ NO CLOCK IS READ. `TestableClock` is TOLD the time; every minute in every fixture is a
 * literal the test wrote (§6's demonstration advances the clock by hand). No `Date.now()`.
 *
 * ⚠️ CONSTRUCTION PATTERNS ONLY were taken from `server/test/reschedule/support/harness.ts` and
 * `server/test/support/testApp.ts` — how to wire the stack and drive the clock. No expected
 * placement time was read from any implementation; expected values come from the SRS (§6,
 * Appendix A) and are pinned in the test files, not here.
 */
import { findCandidateSlots } from '@capstone/engine';
import type {
  DailyMetricSet,
  IntensityTier,
  Interval,
  IsoDate,
  Metric,
  Minute,
  Placement,
  Task,
  Workout,
} from '@capstone/shared';

import { UserStore } from '../../../src/db/UserStore';
import { TaskRepository } from '../../../src/db/TaskRepository';
import { MetricStore } from '../../../src/db/MetricStore';
import { RescheduleService } from '../../../src/reschedule/RescheduleService';
import { RecommendationEngine } from '../../../src/recommendation/RecommendationEngine';
import { SleepToIntensityRule } from '../../../src/recommendation/SleepToIntensityRule';
import { CaloriesToTargetRule } from '../../../src/recommendation/CaloriesToTargetRule';
import type { Catalog } from '../../../src/recommendation/RecommendationScheduler';
import { RecommendationScheduler } from '../../../src/recommendation/RecommendationScheduler';
import { TestableClock } from '../../support/TestableClock';
import { startTestDb } from '../../support/testDb';

// ─── Fixtures the SRS pins (§6, Appendix A) ──────────────────────────────────

/** A wall-clock label as the contract's `Minute` (minutes since local midnight). A conversion. */
export const at = (hour: number, minute = 0): Minute => hour * 60 + minute;

/** FR-USR-07: the schedulable day of §6/Appendix A — 07:00–23:00. The engine is told it. */
export const DAY: Interval = { start: at(7), end: at(23) };

/** §6: the demonstration's baseline calorie target, before any activity. */
export const BASELINE = 2000;

/** §6/Appendix A run on "today". A fixed literal so the clock never reads a real date. */
export const DEMO_DATE: IsoDate = '2026-07-27';

/** Metric names/units the two real rules and `MetricStore` already use (packet 08/09/10). */
export const SLEEP_SCORE = 'sleepScore';
export const ACTIVE_CALORIES = 'activeCalories';

/** FR-WER-07: an injected metric — `origin: 'INJECTED'`, the demonstration path §6 specifies. */
export const injectedSleepScore = (value: number): Metric => ({
  name: SLEEP_SCORE,
  unit: 'score',
  origin: 'INJECTED',
  isAvailable: true,
  value,
});

export const injectedActiveCalories = (value: number): Metric => ({
  name: ACTIVE_CALORIES,
  unit: 'kcal',
  origin: 'INJECTED',
  isAvailable: true,
  value,
});

export const metricSet = (date: IsoDate, metrics: Record<string, Metric>): DailyMetricSet => ({
  date,
  metrics,
});

// ─── The Catalog double (packet 11 supplies the real one) ────────────────────
//
// Deterministic: a fixed roster per tier. It draws from the library; it makes NO placement
// decision. `count` bounds how many are returned (FR-REC-03 asks for three).

const workout = (id: string, name: string, tier: IntensityTier): Workout => ({
  id,
  name,
  intensityTier: tier,
  // 60 min so Appendix A's exact-fit case (a 60-min task, preferred 17:00–18:00) applies to the
  // recovery session the wiring will place. A fixture choice, not an SRS number.
  typicalDurationMinutes: 60,
  equipment: [],
  targetArea: 'full body',
});

/** Three known LOW recovery workouts and three known HIGH workouts, so results are checkable. */
export const LOW_WORKOUTS: readonly Workout[] = [
  workout('low-1', 'Gentle recovery walk', 'LOW'),
  workout('low-2', 'Restorative yoga', 'LOW'),
  workout('low-3', 'Easy mobility flow', 'LOW'),
];

export const HIGH_WORKOUTS: readonly Workout[] = [
  workout('high-1', 'Interval sprints', 'HIGH'),
  workout('high-2', 'Heavy lifting session', 'HIGH'),
  workout('high-3', 'Long tempo run', 'HIGH'),
];

const rosterFor = (tier: IntensityTier): readonly Workout[] => {
  if (tier === 'LOW') return LOW_WORKOUTS;
  if (tier === 'HIGH') return HIGH_WORKOUTS;
  return [];
};

export const deterministicCatalog = (): Catalog => ({
  findWorkouts: (tier: IntensityTier, count: number): readonly Workout[] =>
    rosterFor(tier).slice(0, count),
});

// ─── Assembly ────────────────────────────────────────────────────────────────

export interface AcceptanceStack {
  readonly userId: string;
  readonly tasks: TaskRepository;
  readonly metrics: MetricStore;
  readonly reschedule: RescheduleService;
  readonly recommendations: RecommendationEngine;
  readonly catalog: Catalog;
  /** 🔴 The one throwing surface — packet 17b implements it. */
  readonly scheduler: RecommendationScheduler;
  readonly clock: TestableClock;
  readonly stop: () => Promise<void>;
}

export const buildAcceptanceStack = async (
  options: { nowMinute?: Minute; date?: IsoDate; baseline?: number } = {},
): Promise<AcceptanceStack> => {
  const date = options.date ?? DEMO_DATE;
  const baseline = options.baseline ?? BASELINE;
  const nowMinute = options.nowMinute ?? DAY.start; // 07:00 — nothing has elapsed yet.

  const testDb = await startTestDb();
  const users = new UserStore(testDb.db);
  await users.ensureIndexes();
  const tasks = new TaskRepository(testDb.db, users);
  const metrics = new MetricStore(testDb.db);
  await metrics.ensureIndexes();

  const user = await users.create({
    email: 'demo@example.com',
    passwordHash: 'x',
    wakeMinute: DAY.start,
    sleepMinute: DAY.end,
  });

  const clock = new TestableClock(nowMinute, date);
  const reschedule = new RescheduleService(findCandidateSlots, tasks, clock);

  const recommendations = new RecommendationEngine();
  recommendations.register(new SleepToIntensityRule());
  recommendations.register(new CaloriesToTargetRule(baseline));

  const catalog = deterministicCatalog();

  const scheduler = new RecommendationScheduler(
    findCandidateSlots,
    reschedule,
    recommendations,
    catalog,
    metrics,
    tasks,
    clock,
  );

  return {
    userId: user.id,
    tasks,
    metrics,
    reschedule,
    recommendations,
    catalog,
    scheduler,
    clock,
    stop: testDb.stop,
  };
};

// ─── Arrangement helpers (persist fixtures; none computes a placement) ────────

/** Create a flexible task for the demo date. `source` is USER (the repository's only creator). */
export const createFlexibleTask = (
  stack: AcceptanceStack,
  input: {
    title: string;
    type: Task['type'];
    durationMinutes: number;
    priority: number;
    preferredWindow: Interval;
    intensityTier?: IntensityTier;
    date?: IsoDate;
  },
): Promise<Task> =>
  stack.tasks.createTask({
    userId: stack.userId,
    intendedDate: input.date ?? DEMO_DATE,
    title: input.title,
    type: input.type,
    durationMinutes: input.durationMinutes,
    priority: input.priority,
    preferredWindow: input.preferredWindow,
    flexibility: 'FLEXIBLE',
    ...(input.intensityTier === undefined ? {} : { intensityTier: input.intensityTier }),
  });

/** Create a FIXED commitment for the demo date. */
export const createFixedCommitment = (
  stack: AcceptanceStack,
  input: {
    title: string;
    type: Task['type'];
    window: Interval;
    date?: IsoDate;
  },
): Promise<Task> =>
  stack.tasks.createTask({
    userId: stack.userId,
    intendedDate: input.date ?? DEMO_DATE,
    title: input.title,
    type: input.type,
    durationMinutes: input.window.end - input.window.start,
    priority: 1,
    preferredWindow: input.window,
    flexibility: 'FIXED',
  });

/** Persist a PLANNED placement for an already-created task. Records nothing the engine decides. */
export const placePlanned = async (
  stack: AcceptanceStack,
  task: Task,
  window: Interval,
  options: { reason?: string; date?: IsoDate } = {},
): Promise<Placement> => {
  const placement: Placement = {
    id: stack.tasks.nextPlacementId(),
    taskId: task.id,
    date: options.date ?? DEMO_DATE,
    start: window.start,
    end: window.end,
    status: 'PLANNED',
    placementReason: options.reason ?? 'Placed in your preferred window.',
  };
  await stack.tasks.savePlacement(placement);
  return placement;
};

/** Every placement the store holds for the user on `date`. A read, in no particular order. */
export const placementsFor = (
  stack: AcceptanceStack,
  date: IsoDate = DEMO_DATE,
): Promise<readonly Placement[]> => stack.tasks.placementsForDate(stack.userId, date);

/** The placements of one task on `date`, so a test can watch a single occurrence move. */
export const placementsOfTask = async (
  stack: AcceptanceStack,
  taskId: string,
  date: IsoDate = DEMO_DATE,
): Promise<readonly Placement[]> => {
  const all = await placementsFor(stack, date);
  return all.filter((p) => p.taskId === taskId);
};
