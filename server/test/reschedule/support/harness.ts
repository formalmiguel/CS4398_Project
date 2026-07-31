/**
 * Test doubles and fixtures for the RescheduleService suite (packet 06, 🔴 RED).
 *
 * ⛔ NOTHING IN THIS FILE COMPUTES A PLACEMENT. There is exactly one function in this
 * codebase that does (FR-RSC-03), it lives in `engine/src`, and `realEngineSpy()` below is
 * how these tests reach it. The other doubles return placements the TEST wrote down as
 * literals; they never search, merge, rank, or choose. A double that computed a placement
 * would not be a double — it would be the second implementation this packet exists to
 * prevent (CLAUDE.md §4.3).
 *
 * ⛔ NO CLOCK. `TestClock` is told what time it is, and every time in every fixture is a
 * literal the test wrote. No ambient clock reading of any kind appears under `server/` —
 * FR-RSC-10 is verified "with the clock advanced past a placed occurrence's window", and a
 * test cannot advance a clock the service reads for itself. A suite that tried would be
 * time-of-day dependent and would fail at midnight, for reasons nobody diagnoses at 11pm.
 */
import { findCandidateSlots } from '@capstone/engine';
import type {
  Flexibility,
  Interval,
  IsoDate,
  IsoTimestamp,
  Minute,
  NoSlotReason,
  Placement,
  PlacementResult,
  PlacementStatus,
  RescheduleTrigger,
  Slot,
  Task,
  TaskSource,
  TaskType,
} from '@capstone/shared';

import type { Clock, TaskRepository } from '../../../src/reschedule/RescheduleService';
import { RescheduleService } from '../../../src/reschedule/RescheduleService';

// ─── Fixtures ────────────────────────────────────────────────────────────────

export const USER = 'user-1';
export const OTHER_USER = 'user-2';
export const TODAY: IsoDate = '2026-07-22';
export const TOMORROW: IsoDate = '2026-07-23';

/**
 * A wall-clock label as the contract's `Minute` (minutes since local midnight). This converts
 * a label a human can read into the integer the contract uses. It computes no placement.
 */
export const at = (hour: number, minute = 0): Minute => hour * 60 + minute;

/** The user's schedulable day, 07:00–23:00. FR-USR-07 — the caller knows it; the engine is told. */
export const DAY: Interval = { start: at(7), end: at(23) };

export const task = (input: {
  id: string;
  title?: string;
  type?: TaskType;
  durationMinutes?: number;
  priority?: number;
  preferredWindow: Interval;
  flexibility?: Flexibility;
  source?: TaskSource;
  createdAt?: IsoTimestamp;
}): Task => {
  const base = {
    id: input.id,
    title: input.title ?? input.id,
    type: input.type ?? ('HABIT' as TaskType),
    durationMinutes: input.durationMinutes ?? 30,
    priority: input.priority ?? 3,
    preferredWindow: input.preferredWindow,
    flexibility: input.flexibility ?? ('FLEXIBLE' as Flexibility),
    source: input.source ?? ('USER' as TaskSource),
  };
  return input.createdAt === undefined ? base : { ...base, createdAt: input.createdAt };
};

export const placement = (input: {
  id: string;
  taskId: string;
  date?: IsoDate;
  start: Minute;
  end: Minute;
  status?: PlacementStatus;
  placementReason?: string;
  rescheduleTrigger?: RescheduleTrigger;
}): Placement => {
  const base = {
    id: input.id,
    taskId: input.taskId,
    date: input.date ?? TODAY,
    start: input.start,
    end: input.end,
    status: input.status ?? ('PLANNED' as PlacementStatus),
    placementReason: input.placementReason ?? 'Placed in your preferred window.',
  };
  return input.rescheduleTrigger === undefined
    ? base
    : { ...base, rescheduleTrigger: input.rescheduleTrigger };
};

/**
 * A candidate slot as the ENGINE would return it.
 *
 * ⚠️ `explanation` is filled with an obviously synthetic string on purpose. It belongs to the
 * engine (packet 04, frozen) and **no test in this suite asserts anything about it** — the
 * user-facing sentence is `Placement.placementReason`, which is this service's (settled
 * decision 2). If a future test starts reading this field, that test is in the wrong packet.
 */
export const slot = (
  start: Minute,
  end: Minute,
  rank: number,
  withinPreferredWindow = false,
): Slot => ({
  start,
  end,
  rank,
  withinPreferredWindow,
  explanation: `<engine explanation, rank ${rank}: not this suite's business>`,
});

export const placed = (...slots: readonly Slot[]): PlacementResult => ({ placed: true, slots });

export const notPlaced = (
  reason: NoSlotReason,
  explanation = 'Your day has no free block long enough.',
): PlacementResult => ({ placed: false, slots: [], reason, explanation });

/** What a spy returns once its script runs out — a terminating answer, so a loop cannot hide. */
export const OFF_SCRIPT: PlacementResult = notPlaced(
  'DAY_FULL',
  'off-script engine call: the service asked more times than the test scripted',
);

// ─── The clock, as data (FR-RSC-10) ──────────────────────────────────────────

export class TestClock implements Clock {
  private minute: Minute;
  private date: IsoDate;
  private readonly nextDates: Readonly<Record<string, IsoDate>>;

  constructor(now: Minute, today: IsoDate = TODAY, nextDates: Record<string, IsoDate> = {}) {
    this.minute = now;
    this.date = today;
    this.nextDates = { [TODAY]: TOMORROW, ...nextDates };
  }

  nowMinute(): Minute {
    return this.minute;
  }

  today(): IsoDate {
    return this.date;
  }

  nextDate(date: IsoDate): IsoDate {
    const next = this.nextDates[date];
    if (next === undefined) {
      throw new Error(`TestClock has no next date registered for ${date}`);
    }
    return next;
  }

  /** The test advances the clock. Nothing else can. */
  advanceTo(now: Minute, date: IsoDate = this.date): void {
    this.minute = now;
    this.date = date;
  }
}

// ─── The store (persistence is packet 12; this is an in-memory double) ───────

const key = (userId: string, date: IsoDate): string => `${userId}|${date}`;

/**
 * ⚠️ The `TaskRepository` half of this class is ASYNCHRONOUS, because the port is (SRS v2.14,
 * E9) — packet 12 implements it over the promise-based MongoDB driver. The ARRANGEMENT and
 * ASSERTION helpers above the divider are this double's own and stay synchronous: they are how
 * a test builds a schedule and reads it back, and `await`ing them would add noise to every
 * assertion in the suite without testing anything.
 */
export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();
  private readonly owners = new Map<string, string>();
  private readonly listings = new Map<string, string[]>();
  private readonly placements = new Map<string, Placement>();
  private readonly days = new Map<string, Interval>();
  private counter = 0;

  // ── arrangement helpers (not part of TaskRepository) ──

  /** Register a task, own it, and list it on the given dates. */
  addTask(t: Task, options: { userId?: string; dates?: readonly IsoDate[] } = {}): this {
    const userId = options.userId ?? USER;
    this.tasks.set(t.id, t);
    this.owners.set(t.id, userId);
    for (const date of options.dates ?? [TODAY]) {
      const listed = this.listings.get(key(userId, date)) ?? [];
      if (!listed.includes(t.id)) listed.push(t.id);
      this.listings.set(key(userId, date), listed);
    }
    return this;
  }

  addPlacement(p: Placement): this {
    this.placements.set(p.id, p);
    return this;
  }

  setSchedulableDay(userId: string, date: IsoDate, day: Interval): this {
    this.days.set(key(userId, date), day);
    return this;
  }

  /** Remove a placement outright — used to free a day up between two retrievals. */
  removePlacement(placementId: string): this {
    this.placements.delete(placementId);
    return this;
  }

  /** Every placement in the store, ordered by id, so two snapshots deep-equal stably. */
  snapshot(): readonly Placement[] {
    return [...this.placements.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /** Every task in the store. NFR-REL-01 counts these. */
  allTasks(): readonly Task[] {
    return [...this.tasks.values()];
  }

  placementsOfTask(taskId: string): readonly Placement[] {
    return this.snapshot().filter((p) => p.taskId === taskId);
  }

  requirePlacement(placementId: string): Placement {
    const found = this.placements.get(placementId);
    if (found === undefined) throw new Error(`no placement ${placementId} in the store`);
    return found;
  }

  /** The stored task, read synchronously — for asserting the store was NOT modified. */
  storedTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  // ── TaskRepository — asynchronous from here down (SRS v2.14, §3.6) ──

  async getTask(taskId: string): Promise<Task | undefined> {
    return this.tasks.get(taskId);
  }

  async ownerOfTask(taskId: string): Promise<string | undefined> {
    return this.owners.get(taskId);
  }

  async tasksForDate(userId: string, date: IsoDate): Promise<readonly Task[]> {
    const ids = this.listings.get(key(userId, date)) ?? [];
    const found: Task[] = [];
    for (const id of ids) {
      const t = this.tasks.get(id);
      if (t !== undefined) found.push(t);
    }
    return found;
  }

  async placementsForDate(userId: string, date: IsoDate): Promise<readonly Placement[]> {
    const owned = new Set(this.listings.get(key(userId, date)) ?? []);
    return this.snapshot().filter((p) => p.date === date && owned.has(p.taskId));
  }

  async schedulableDay(userId: string, date: IsoDate): Promise<Interval> {
    return this.days.get(key(userId, date)) ?? DAY;
  }

  async savePlacement(p: Placement): Promise<void> {
    this.placements.set(p.id, p);
  }

  async deletePlacement(placementId: string): Promise<void> {
    this.placements.delete(placementId);
  }

  nextPlacementId(): string {
    this.counter += 1;
    return `p-new-${this.counter}`;
  }
}

// ─── The engine, injected (FR-RSC-03) ────────────────────────────────────────

export interface EngineCall {
  readonly busy: readonly Interval[];
  readonly task: Task;
  readonly schedulableDay: Interval;
}

export interface EngineSpy {
  /** What is injected into the service. */
  readonly fn: (
    busy: readonly Interval[],
    t: Task,
    schedulableDay: Interval,
  ) => PlacementResult;
  readonly calls: readonly EngineCall[];
  /** Every slot this spy ever handed back — FR-RSC-03's traceability set. */
  readonly returned: readonly Slot[];
}

const spyOn = (
  respond: (call: EngineCall, index: number) => PlacementResult,
): EngineSpy => {
  const calls: EngineCall[] = [];
  const returned: Slot[] = [];
  const fn = (busy: readonly Interval[], t: Task, schedulableDay: Interval): PlacementResult => {
    // Copied, so a later mutation by anyone cannot rewrite what the service actually asked.
    const call: EngineCall = {
      busy: busy.map((b) => ({ start: b.start, end: b.end })),
      task: t,
      schedulableDay: { start: schedulableDay.start, end: schedulableDay.end },
    };
    calls.push(call);
    const result = respond(call, calls.length - 1);
    if (result.placed) returned.push(...result.slots);
    return result;
  };
  return { fn, calls, returned };
};

/** Answers the nth call with the nth scripted result. Beyond the script: an off-script no-slot. */
export const scriptedEngine = (script: readonly PlacementResult[]): EngineSpy =>
  spyOn((_call, index) => script[index] ?? OFF_SCRIPT);

/** Answers by the id of the task it was asked about — order-independent, for multi-task days. */
export const engineByTask = (byTaskId: Readonly<Record<string, PlacementResult>>): EngineSpy =>
  spyOn((call) => byTaskId[call.task.id] ?? OFF_SCRIPT);

/**
 * THE REAL ENGINE, recorded. FR-RSC-03: "both the manual and automatic paths call it."
 *
 * A suite that only ever sees a stub proves the service calls *something*; §6's claim is that
 * it calls *the engine*.
 */
export const realEngineSpy = (): EngineSpy =>
  spyOn((call) => findCandidateSlots(call.busy, call.task, call.schedulableDay));

// ─── Assembly ────────────────────────────────────────────────────────────────

export interface Harness {
  readonly repo: InMemoryTaskRepository;
  readonly clock: TestClock;
  readonly engine: EngineSpy;
  readonly service: RescheduleService;
}

export const makeHarness = (options: {
  engine: EngineSpy;
  now: Minute;
  today?: IsoDate;
  repo?: InMemoryTaskRepository;
}): Harness => {
  const repo = options.repo ?? new InMemoryTaskRepository();
  const clock = new TestClock(options.now, options.today ?? TODAY);
  const service = new RescheduleService(options.engine.fn, repo, clock);
  return { repo, clock, engine: options.engine, service };
};

// ─── Assertion helpers (comparisons only — no arithmetic on times) ───────────

/** `noUncheckedIndexedAccess` is on: this narrows, and fails loudly if the call never happened. */
export const call = (spy: EngineSpy, index: number): EngineCall => {
  const found = spy.calls[index];
  if (found === undefined) {
    throw new Error(`the engine was never called ${index + 1} time(s) — got ${spy.calls.length}`);
  }
  return found;
};

export const busyContains = (busy: readonly Interval[], want: Interval): boolean =>
  busy.some((b) => b.start === want.start && b.end === want.end);

export const taskIdsInCallOrder = (spy: EngineSpy): readonly string[] =>
  spy.calls.map((c) => c.task.id);

/** Every slot the spy handed back, as `start-end` keys — the set a placement must come from. */
export const returnedSlotKeys = (spy: EngineSpy): readonly string[] =>
  spy.returned.map((s) => `${s.start}-${s.end}`);

export const placementKey = (p: Placement): string => `${p.start}-${p.end}`;

export const planned = (repo: InMemoryTaskRepository, taskId: string): readonly Placement[] =>
  repo.placementsOfTask(taskId).filter((p) => p.status === 'PLANNED');
