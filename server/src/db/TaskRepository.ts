/**
 * The Mongo implementation of `TaskRepository`, ratified into §3.6 at SRS v2.14 and imported
 * from `RescheduleService` (packet 06/07) — the port is asynchronous because this is the real
 * implementer it was written for. See that file for the interface itself; it is not redeclared
 * here.
 *
 * ⛔ THIS FILE DOES NOT COMPUTE A PLACEMENT. It stores and reads back whatever
 * `RescheduleService` (or, for a fixed commitment, this packet's own route handler) decides.
 * FR-RSC-03 forbids a second placement function; a repository method that ranked, merged, or
 * chose among candidates would be exactly that, wearing a different file name.
 *
 * OPEN-17: `tasksForDate` is the method that actually turns FR-SCH-10 on for a never-placed or
 * recurring task — see its own comment below. It does not call the engine; it decides
 * VISIBILITY, and `RescheduleService.sweepElapsed` does the rest.
 */
import { Collection, Db, ObjectId } from 'mongodb';

import type {
  Interval,
  IsoDate,
  Minute,
  Placement,
  PlacementStatus,
  RescheduleTrigger,
  Task,
  TaskSource,
  TaskType,
  Flexibility,
  IntensityTier,
  Recurrence,
} from '@capstone/shared';

import { UserStore } from './UserStore';
import { isValidObjectIdString } from './mongo';

// ─── Documents ─────────────────────────────────────────────────────────────

/**
 * The Mongo shape. `userId` and `intendedDate` are repository-internal — neither is on the
 * shared `Task` type. `userId` is OPEN-12's answer applied (ownership at the boundary, not on
 * the domain type). `intendedDate` exists because `Task` carries no date at all: a one-off task
 * needs something to anchor it to the day its creator meant, and a recurring task needs an
 * anchor for "starting from" (FR-TSK-05).
 */
interface TaskDocument {
  readonly _id: ObjectId;
  readonly userId: string;
  readonly intendedDate: IsoDate;
  readonly title: string;
  readonly type: TaskType;
  readonly durationMinutes: number;
  readonly priority: number;
  readonly preferredWindow: Interval;
  readonly flexibility: Flexibility;
  readonly source: TaskSource;
  readonly createdAt: string;
  readonly recurrence?: Recurrence;
  readonly intensityTier?: IntensityTier;
  /**
   * UC-03 / FR-DSH-06: true from the moment `POST /tasks` offers ranked alternatives until the
   * user accepts one via `POST /tasks/:id/place`. Repository-internal — not on the shared `Task`
   * type, and NOT read by `RescheduleService`.
   *
   * ⛔ Exists because `sweepElapsed`'s reattempt branch (FR-RSC-05) auto-places ANY flexible task
   * with no `PLANNED` row, on every `GET /schedule` — which FR-RSC-10 requires unconditionally.
   * Without this flag, the very next schedule retrieval after UC-03 offers a choice would
   * silently auto-place the task at rank 1 before the user ever saw the picker, making the
   * "present alternatives, let the user accept one" flow racy against an ordinary page refresh.
   * `tasksForDate` (the ratified port `sweepElapsed` reads) excludes these; `allTasksForDate`
   * (this file's own, for `GET /tasks` and `GET /schedule`'s own listing) does not — the user
   * must still SEE the task while its choice is pending.
   */
  readonly awaitingChoice: boolean;
}

interface PlacementDocument {
  readonly _id: string;
  readonly taskId: string;
  readonly userId: string;
  readonly date: IsoDate;
  readonly start: Minute;
  readonly end: Minute;
  readonly status: PlacementStatus;
  readonly placementReason: string;
  readonly rescheduleTrigger?: RescheduleTrigger;
}

interface CompletionRecordDocument {
  readonly _id: ObjectId;
  readonly placementId: string;
  readonly taskId: string;
  readonly userId: string;
  readonly completedAt: string;
}

// ─── Mapping — Mongo document to the CONTRACT's Task/Placement, nothing extra ────────────────

const toTask = (doc: TaskDocument): Task => {
  const task: Task = {
    id: doc._id.toHexString(),
    title: doc.title,
    type: doc.type,
    durationMinutes: doc.durationMinutes,
    priority: doc.priority,
    preferredWindow: doc.preferredWindow,
    flexibility: doc.flexibility,
    source: doc.source,
    createdAt: doc.createdAt,
  };
  return {
    ...task,
    ...(doc.recurrence === undefined ? {} : { recurrence: doc.recurrence }),
    ...(doc.intensityTier === undefined ? {} : { intensityTier: doc.intensityTier }),
  };
};

const toPlacement = (doc: PlacementDocument): Placement => {
  const base: Placement = {
    id: doc._id,
    taskId: doc.taskId,
    date: doc.date,
    start: doc.start,
    end: doc.end,
    status: doc.status,
    placementReason: doc.placementReason,
  };
  return doc.rescheduleTrigger === undefined
    ? base
    : { ...base, rescheduleTrigger: doc.rescheduleTrigger };
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** ISO weekday, 1 (Monday) – 7 (Sunday), from an `IsoDate` (`YYYY-MM-DD`) — UTC, no locale. */
const isoWeekday = (date: IsoDate): number => {
  const jsDay = new Date(`${date}T00:00:00.000Z`).getUTCDay(); // 0=Sunday..6=Saturday
  return jsDay === 0 ? 7 : jsDay;
};

/** OPEN-17 / FR-TSK-05: does `date` "match" this task's recurrence, given where it started? */
const matchesDate = (doc: TaskDocument, date: IsoDate): boolean => {
  if (doc.recurrence === undefined) return doc.intendedDate === date;
  if (doc.intendedDate > date) return false;
  if (doc.recurrence.frequency === 'DAILY') return true;
  return (doc.recurrence.daysOfWeek ?? []).includes(isoWeekday(date));
};

/** Every `IsoDate` from `start` to `end` inclusive, UTC. Range length is the caller's concern. */
const datesBetween = (start: IsoDate, end: IsoDate): readonly IsoDate[] => {
  const dates: IsoDate[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

// ─── The repository ────────────────────────────────────────────────────────

export class TaskRepository {
  private readonly tasks: Collection<TaskDocument>;
  private readonly placements: Collection<PlacementDocument>;
  private readonly completionRecords: Collection<CompletionRecordDocument>;
  private readonly users: UserStore;

  constructor(db: Db, users: UserStore) {
    this.tasks = db.collection<TaskDocument>('tasks');
    this.placements = db.collection<PlacementDocument>('placements');
    this.completionRecords = db.collection<CompletionRecordDocument>('completionRecords');
    this.users = users;
  }

  // ── §3.6's ratified surface ────────────────────────────────────────────

  async getTask(taskId: string): Promise<Task | undefined> {
    if (!isValidObjectIdString(taskId)) return undefined;
    const doc = await this.tasks.findOne({ _id: new ObjectId(taskId) });
    return doc === null ? undefined : toTask(doc);
  }

  async ownerOfTask(taskId: string): Promise<string | undefined> {
    if (!isValidObjectIdString(taskId)) return undefined;
    const doc = await this.tasks.findOne(
      { _id: new ObjectId(taskId) },
      { projection: { userId: 1 } },
    );
    return doc === null ? undefined : doc.userId;
  }

  /** `loadOwnedTask` (app.ts) needs both the task and its owner; one round trip for both. */
  async getTaskWithOwner(taskId: string): Promise<{ task: Task; ownerId: string } | undefined> {
    if (!isValidObjectIdString(taskId)) return undefined;
    const doc = await this.tasks.findOne({ _id: new ObjectId(taskId) });
    return doc === null ? undefined : { task: toTask(doc), ownerId: doc.userId };
  }

  /** Every task document for the user on `date`, per `matchesDate` — shared by both listings below. */
  private async docsForDate(userId: string, date: IsoDate): Promise<readonly TaskDocument[]> {
    if (!isNonEmptyString(userId)) return [];
    const docs = await this.tasks.find({ userId }).toArray();
    return docs.filter((doc) => matchesDate(doc, date));
  }

  /**
   * OPEN-17: see `matchesDate` — this is the method that makes a task visible to `sweepElapsed`.
   * Excludes `awaitingChoice` tasks (UC-03) — see that field's comment. Use `allTasksForDate` for
   * a listing the user sees; this one is what the reschedule service's automatic sweep reads.
   *
   * ⛔ OPEN-36: the exclusion is scoped to `doc.intendedDate === date`, NOT `doc.awaitingChoice`
   * alone. `awaitingChoice` is only ever set `true` at one call site (`POST /tasks`'s UC-03
   * branch), always for that task's own `intendedDate` — so `intendedDate` IS the occurrence the
   * offer applies to. Excluding on `doc.awaitingChoice` alone (the old behavior) excluded the
   * task from EVERY date `matchesDate` returns true for, which for a `DAILY`/`WEEKLY` recurring
   * task is every date from `intendedDate` onward, forever — one unresolved choice permanently
   * disabled `sweepElapsed`'s self-heal (FR-RSC-05) for the entire series, not just the one
   * occurrence the choice was raised for.
   */
  async tasksForDate(userId: string, date: IsoDate): Promise<readonly Task[]> {
    const docs = await this.docsForDate(userId, date);
    return docs.filter((doc) => !(doc.awaitingChoice && doc.intendedDate === date)).map(toTask);
  }

  /** Every task for the date, INCLUDING one awaiting a UC-03 choice — for the user's own view. */
  async allTasksForDate(userId: string, date: IsoDate): Promise<readonly Task[]> {
    const docs = await this.docsForDate(userId, date);
    return docs.map(toTask);
  }

  /**
   * FR-ANL-01/02: every HABIT task this user owns — the recurring commitments the analytics view
   * reports a streak and completion rate for. Type-filtered in the query so a CLASS or MEETING is
   * never analysed as a habit; mapping reuses `toTask` (no duplicated shape logic).
   */
  async habitsForUser(userId: string): Promise<readonly Task[]> {
    if (!isNonEmptyString(userId)) return [];
    const docs = await this.tasks.find({ userId, type: 'HABIT' }).toArray();
    return docs.map(toTask);
  }

  /**
   * Task ids currently awaiting a UC-03 choice for this date — what the frontend re-offers a
   * picker for.
   *
   * ⛔ BUG FIXED (found during a cleanup pass, not by a test): this previously queried with
   * `projection: { _id: 1 }` and THEN filtered the result with `matchesDate`, which reads
   * `intendedDate`/`recurrence` — fields the projection had already stripped out. `matchesDate`
   * therefore always fell through to `undefined === date`, so this method silently returned `[]`
   * on every call regardless of the actual date. Fixed by reusing `docsForDate`, which fetches
   * the fields `matchesDate` needs before filtering.
   */
  async awaitingChoiceTaskIds(userId: string, date: IsoDate): Promise<readonly string[]> {
    const docs = await this.docsForDate(userId, date);
    // ⛔ OPEN-36: scoped to `doc.intendedDate === date` — see `tasksForDate`'s comment. Without
    // it a recurring task's one unresolved choice would report as "awaiting" on every future
    // occurrence too, not just the one it was actually raised for.
    return docs
      .filter((doc) => doc.awaitingChoice && doc.intendedDate === date)
      .map((doc) => doc._id.toHexString());
  }

  async setAwaitingChoice(taskId: string, awaiting: boolean): Promise<void> {
    if (!isValidObjectIdString(taskId)) return;
    await this.tasks.updateOne({ _id: new ObjectId(taskId) }, { $set: { awaitingChoice: awaiting } });
  }

  async placementsForDate(userId: string, date: IsoDate): Promise<readonly Placement[]> {
    if (!isNonEmptyString(userId)) return [];
    const docs = await this.placements.find({ userId, date }).toArray();
    return docs.map(toPlacement);
  }

  /**
   * FR-CAL-07: every placement in `[start, end]`, inclusive, for the `.ics` export. Range
   * length is bounded by the caller (`app.ts`'s route), same convention as `taskTypesInRange`.
   */
  async placementsInRange(userId: string, start: IsoDate, end: IsoDate): Promise<readonly Placement[]> {
    if (!isNonEmptyString(userId)) return [];
    const docs = await this.placements.find({ userId, date: { $gte: start, $lte: end } }).toArray();
    return docs.map(toPlacement);
  }

  /**
   * FR-ANL-01/02: every placement of ONE task in `[start, end]`, inclusive — the full per-date
   * history `analyzeHabit` folds into a streak and a rate. Scoped by `userId` as well as `taskId`
   * so ownership is enforced at the boundary (OPEN-12), same as every other read here. Range is
   * bounded by the caller's route, same convention as `placementsInRange`. Mapping reuses
   * `toPlacement`.
   */
  async placementsForTaskInRange(
    userId: string,
    taskId: string,
    start: IsoDate,
    end: IsoDate,
  ): Promise<readonly Placement[]> {
    if (!isNonEmptyString(userId) || !isNonEmptyString(taskId)) return [];
    const docs = await this.placements
      .find({ userId, taskId, date: { $gte: start, $lte: end } })
      .toArray();
    return docs.map(toPlacement);
  }

  /** FR-CAL-07: task titles for a set of placements, one round trip. Invalid ids are dropped. */
  async getTasksByIds(taskIds: readonly string[]): Promise<ReadonlyMap<string, Task>> {
    const validIds = [...new Set(taskIds)].filter(isValidObjectIdString);
    if (validIds.length === 0) return new Map();
    const docs = await this.tasks.find({ _id: { $in: validIds.map((id) => new ObjectId(id)) } }).toArray();
    return new Map(docs.map((doc) => [doc._id.toHexString(), toTask(doc)]));
  }

  /** FR-USR-07: wake/sleep as `Minute`. The engine is told, never asked. */
  async schedulableDay(userId: string, _date: IsoDate): Promise<Interval> {
    const day = await this.users.schedulableDay(userId);
    if (day === undefined) throw new Error(`no schedulable day for user ${userId}`);
    return day;
  }

  async savePlacement(placement: Placement): Promise<void> {
    const owner = await this.ownerOfTask(placement.taskId);
    if (owner === undefined) throw new Error(`savePlacement: no owner for task ${placement.taskId}`);
    const doc: PlacementDocument = {
      _id: placement.id,
      taskId: placement.taskId,
      userId: owner,
      date: placement.date,
      start: placement.start,
      end: placement.end,
      status: placement.status,
      placementReason: placement.placementReason,
      ...(placement.rescheduleTrigger === undefined
        ? {}
        : { rescheduleTrigger: placement.rescheduleTrigger }),
    };
    await this.placements.replaceOne({ _id: doc._id }, doc, { upsert: true });
  }

  /**
   * ⛔ THE DOMAIN'S ONLY DELETION (SRS v2.16). Its one legitimate caller is inside
   * `RescheduleService`'s own displaced/edited failure path. If anything in THIS packet ever
   * calls it, that is a second caller and it is an escalation, not a convenience.
   */
  async deletePlacement(placementId: string): Promise<void> {
    if (!isNonEmptyString(placementId)) return;
    await this.placements.deleteOne({ _id: placementId });
  }

  /** Synchronous, local — identity generation is not storage (§3.6's note). */
  nextPlacementId(): string {
    return new ObjectId().toHexString();
  }

  // ── Application-level methods this packet's routes need, beyond the ratified port ──────────

  /**
   * `source` defaults to `'USER'` — the only creator until FR-REC-04. A recommended workout is
   * created as a `source: 'SYSTEM'` task (packet 17b's `RecommendationScheduler`), which is the
   * ONLY caller that passes `'SYSTEM'`. Per FR-REC-04 a SYSTEM task is otherwise identical to a
   * user one — placed by the same engine, defended by the same rescheduling — so this parameter
   * changes only who is recorded as author, never how the task is placed (FR-RSC-03 untouched:
   * this method still stores a task and computes no placement).
   */
  async createTask(input: {
    userId: string;
    intendedDate: IsoDate;
    title: string;
    type: TaskType;
    durationMinutes: number;
    priority: number;
    preferredWindow: Interval;
    flexibility: Flexibility;
    source?: TaskSource;
    recurrence?: Recurrence;
    intensityTier?: IntensityTier;
  }): Promise<Task> {
    const doc: TaskDocument = {
      _id: new ObjectId(),
      userId: input.userId,
      intendedDate: input.intendedDate,
      title: input.title,
      type: input.type,
      durationMinutes: input.durationMinutes,
      priority: input.priority,
      preferredWindow: input.preferredWindow,
      flexibility: input.flexibility,
      source: input.source ?? 'USER',
      createdAt: new Date().toISOString(),
      awaitingChoice: false,
      ...(input.recurrence === undefined ? {} : { recurrence: input.recurrence }),
      ...(input.intensityTier === undefined ? {} : { intensityTier: input.intensityTier }),
    };
    await this.tasks.insertOne(doc);
    return toTask(doc);
  }

  async updateTaskAttributes(
    taskId: string,
    patch: Partial<
      Pick<
        TaskDocument,
        'title' | 'durationMinutes' | 'priority' | 'preferredWindow' | 'recurrence' | 'intensityTier'
      >
    >,
  ): Promise<void> {
    if (!isValidObjectIdString(taskId)) throw new Error('invalid taskId');
    await this.tasks.updateOne({ _id: new ObjectId(taskId) }, { $set: patch });
  }

  /** FR-TSK-07: deletes the task and its FUTURE placements; completion records are untouched (DR-01). */
  async deleteTaskAndFuturePlacements(taskId: string, today: IsoDate): Promise<void> {
    if (!isValidObjectIdString(taskId)) return;
    await this.tasks.deleteOne({ _id: new ObjectId(taskId) });
    await this.placements.deleteMany({ taskId, date: { $gte: today } });
  }

  async recordCompletion(placementId: string, taskId: string, userId: string): Promise<void> {
    await this.completionRecords.insertOne({
      _id: new ObjectId(),
      placementId,
      taskId,
      userId,
      completedAt: new Date().toISOString(),
    });
  }

  async completionRecordsForTask(taskId: string): Promise<readonly { completedAt: string }[]> {
    return this.completionRecords.find({ taskId }, { projection: { completedAt: 1 } }).toArray();
  }

  /**
   * A calendar-overview read, not a placement query: which of the user's TASKS occur on each
   * day in `[start, end]`, and what types they are — computed with the same `matchesDate`
   * predicate `docsForDate` uses for one day, just swept across a range.
   *
   * Deliberately NOT sourced from `placements`: FR-RSC-10 evaluates a day only when it's
   * actually retrieved, so a future day nobody has opened yet has no `Placement` row at all —
   * a placements-only overview would silently show it as empty even when tasks are defined for
   * it. This reads task DEFINITIONS (`intendedDate` + `recurrence`) instead: no engine call, no
   * reschedule sweep, no write. Only dates with at least one matching task are returned. Range
   * length is bounded by the caller (`app.ts`'s route); this method trusts what it's given.
   *
   * `items` (added for the month-view redesign) carries each matching task's title and
   * `preferredWindow.start` — the task's DEFINED time, not a placed one, since no engine runs
   * here. For a FIXED commitment that is the actual time it occupies; for a flexible task it is
   * only where the System will try first, same caveat FR-DSH-05 already carries for candidates
   * shown before a call completes. `types` is kept, unmodified, alongside it — existing readers
   * of the dots-only shape are untouched.
   */
  async taskTypesInRange(
    userId: string,
    start: IsoDate,
    end: IsoDate,
  ): Promise<
    readonly {
      date: IsoDate;
      types: readonly TaskType[];
      items: readonly { id: string; title: string; type: TaskType; start: Minute }[];
    }[]
  > {
    if (!isNonEmptyString(userId)) return [];
    const docs = await this.tasks.find({ userId }).toArray();
    const result: {
      date: IsoDate;
      types: readonly TaskType[];
      items: readonly { id: string; title: string; type: TaskType; start: Minute }[];
    }[] = [];
    for (const date of datesBetween(start, end)) {
      const matching = docs.filter((doc) => matchesDate(doc, date));
      if (matching.length === 0) continue;
      const types = [...new Set(matching.map((doc) => doc.type))];
      const items = matching
        .map((doc) => ({ id: doc._id.toString(), title: doc.title, type: doc.type, start: doc.preferredWindow.start }))
        .sort((a, b) => a.start - b.start);
      result.push({ date, types, items });
    }
    return result;
  }

  /**
   * FR-TSK-04: every date this task currently has a `PLANNED` placement, so the caller can
   * call `onTaskEdited(task, date)` once per date — "one call re-evaluates one occurrence"
   * (the requirement's own note). A date without a `PLANNED` row already happened (`MISSED`,
   * `SKIPPED`, `COMPLETED`) or was withdrawn (`CANCELLED`); nothing here is re-evaluated.
   */
  async plannedDatesForTask(taskId: string): Promise<readonly IsoDate[]> {
    if (!isNonEmptyString(taskId)) return [];
    const docs = await this.placements
      .find({ taskId, status: 'PLANNED' }, { projection: { date: 1 } })
      .toArray();
    return [...new Set(docs.map((d) => d.date))];
  }

  /** NFR-SEC-06, bounded to what this repository owns (tasks, placements, completion records). */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.tasks.deleteMany({ userId });
    await this.placements.deleteMany({ userId });
    await this.completionRecords.deleteMany({ userId });
  }
}
