/**
 * THE RESCHEDULE SERVICE. 🟢 GREEN (packet 07) against the suite frozen by packet 06 at
 * `8b24320`. The surface below — the two ports, the outcome types, the seven method
 * signatures — is packet 06's and was not reshaped; only the `throw new Error('07')` bodies
 * were replaced.
 *
 * WHAT THIS CLASS IS. It is the policy layer of FR-RSC: it decides WHEN the engine of
 * FR-SCH is called again, WHAT the day looks like when it is called, IN WHAT ORDER, and
 * WHAT TO DO WITH THE ANSWER. It does not decide where a task goes.
 *
 * ⛔ FR-RSC-03: there is exactly ONE function in this codebase that produces a placement —
 * `findCandidateSlots` in `engine/src` — and this service RE-INVOKES it. It arrives here by
 * injection, typed `FindCandidateSlots`, which is what lets a test double prove the service
 * ASKED rather than ANSWERED. Nothing in `server/src/reschedule/` may find a free gap, merge
 * intervals, choose among candidates by any criterion of its own, or compute a start time.
 *
 * ⚠️ Everything below that touches a time is one of exactly four things, and none of them is a
 * placement: a COMPARISON (has this window elapsed? does this interval overlap that one?), a
 * COPY of a bound the engine returned, `Math.max` against `now` to shape the day handed IN, and
 * rendering a `Minute` as a label in `reasons.ts`. **The only start time that ever reaches a
 * stored `Placement` is `slots[0].start`.** If a future change makes that untrue, FR-RSC-03 is
 * gone and no test here will say so — packet 16's inspection guard is the belt to these braces.
 *
 * ⛔ FR-RSC-10: the service is TOLD the time; it never asks. `now`, today's date, and the
 * next calendar date all arrive through the injected `Clock`. **No ambient clock reading
 * of any kind appears under `server/`** — no system-time call, no timer, no scheduled
 * callback — because FR-RSC-10 is verified "with the clock advanced past a placed occurrence's
 * window", and a test cannot advance a clock the service reads for itself. Same reasoning that
 * made `Minute` the engine's time type (CLAUDE.md §4.7).
 *
 * ⚠️ THE ONE RULE THAT IS EASY TO MISS — FR-RSC-01's elapsed-window substitution (SRS v2.14).
 * A missed occurrence's preferred window is behind `now` by definition, and the day handed to
 * the engine starts at `now`, so FR-SCH-09's last boundary row would oblige the engine to
 * reject EVERY missed task. Where a window has FULLY elapsed the engine is therefore invoked
 * with a DERIVED task whose preferred window is the remainder of the day; **the stored task is
 * never modified.** A partly elapsed window is passed as it stands. And where `now` is at or
 * past the end of the day, the engine is NOT CALLED at all and the reason is `DAY_FULL` — the
 * only reason in the System that does not originate in the engine.
 *
 * The seven methods are §3.6's class diagram, verbatim and unrenamed — `onTaskEdited` is the
 * newest, added at v2.15 to give FR-TSK-04 the mechanism it had never had. Return types are not
 * in the diagram — `void` there means "the diagram does not say" — and are specified here so a
 * test can assert FR-RSC-04's three facts (the task, its new time, the trigger) and
 * FR-RSC-05's offer.
 */
import type {
  FindCandidateSlots,
  Interval,
  IsoDate,
  Minute,
  NoSlotReason,
  Placement,
  PlacementStatus,
  RescheduleTrigger,
  Slot,
  Task,
} from '@capstone/shared';

import {
  cancellationStatement,
  dayAlreadyOverExplanation,
  dayAlreadyPassedExplanation,
  displacedReason,
  editedReason,
  firstPlacementReason,
  missedReason,
  nextDayReason,
  reattemptReason,
  skippedReason,
} from './reasons';
import { byPlacementOrder } from './taskOrder';

// ─── Ports (ratified into §3.6 at SRS v2.14) ─────────────────────────────────

/**
 * The clock, as data. FR-RSC-10. **Synchronous** — reading the time is not storage.
 *
 * `nextDate` lives here rather than in the service because computing "tomorrow" from an
 * `IsoDate` is calendar arithmetic, and calendar arithmetic inside the service is one step away
 * from the service constructing a date object and reading a clock off it. The port is told;
 * the service is told by the port.
 */
export interface Clock {
  /** Minutes since local midnight, right now. The engine's time type (§4.7). */
  nowMinute(): Minute;
  /** The date `nowMinute()` belongs to. */
  today(): IsoDate;
  /** The calendar date after `date`. FR-RSC-05's "next day". */
  nextDate(date: IsoDate): IsoDate;
}

/**
 * `-repo: TaskRepository` in §3.6.
 *
 * ⚠️ **ASYNCHRONOUS, and that is binding** (SRS v2.14, E9). Packet 12 implements this port
 * over the promise-based MongoDB driver, and **a port its only real implementer cannot satisfy
 * is the wrong port** — discovering that after this suite is frozen would mean editing frozen
 * tests, which the method forbids. `nextPlacementId` stays synchronous because identity
 * generation is local, not storage.
 */
export interface TaskRepository {
  getTask(taskId: string): Promise<Task | undefined>;
  /** The user who owns a task — a `Placement` carries a `taskId` but no user. */
  ownerOfTask(taskId: string): Promise<string | undefined>;
  /** Every task listed for the user on that date. */
  tasksForDate(userId: string, date: IsoDate): Promise<readonly Task[]>;
  /** Every placement recorded for the user on that date, in no guaranteed order. */
  placementsForDate(userId: string, date: IsoDate): Promise<readonly Placement[]>;
  /** The user's schedulable day, wake to sleep (FR-USR-07). The engine is told, not asked. */
  schedulableDay(userId: string, date: IsoDate): Promise<Interval>;
  /** Insert or replace by `id`. A displaced or edited occurrence is REPLACED, never duplicated. */
  savePlacement(placement: Placement): Promise<void>;
  /**
   * FR-RSC-05's note, SRS v2.16 (E11).
   *
   * ⛔ THE ONLY DELETION THE DOMAIN PERFORMS, and it serves exactly one case:
   * an occurrence that was still `PLANNED` — displaced or edited — which the engine could not
   * re-place, and which FR-RSC-05 therefore requires to leave no `PLANNED` placement behind.
   *
   * It destroys no history: a `PLANNED` row is a statement about the future, while what actually
   * happened lives in completion records (DR-01) and in the `MISSED` and `SKIPPED` rows that
   * record a real event. **If a second caller for this ever appears, question it** — this domain
   * marks rows, it does not remove them. As of packet 07 there is exactly one, in `moveInPlace`.
   */
  deletePlacement(placementId: string): Promise<void>;
  /** Identity generation belongs to the store, so the service stays deterministic. */
  nextPlacementId(): string;
}

// ─── What the service reports ────────────────────────────────────────────────

/**
 * Why a trigger did nothing. Each member names the requirement that makes it a no-op:
 *
 *   ALREADY_COMPLETE    FR-RSC-07 — a completed task is NEVER rescheduled.
 *   NOT_PLANNED         FR-RSC-06 — the missed and skipped triggers act only on a PLANNED
 *                       occurrence, and handling one moves it out of PLANNED. (Displacement
 *                       reaches idempotency the OTHER way — the row stays PLANNED and simply
 *                       no longer overlaps — so it never yields this reason.)
 *   NOT_FLEXIBLE        FR-RSC-01 / FR-RSC-02 / FR-RSC-08 — a fixed commitment is immovable.
 *   WINDOW_NOT_ELAPSED  FR-RSC-01 — a miss requires the window to have FULLY elapsed. Note
 *                       this never applies to FR-RSC-08, whose whole point is that a skip is
 *                       accepted BEFORE the window elapses.
 *   PLACEMENT_STILL_VALID
 *                       FR-TSK-04 — "re-place it IF the current placement is no longer valid."
 *                       The condition is the requirement, not decoration: an edit that leaves
 *                       the placement legal moves nothing.
 *   NOT_COMPLETED       `onCompletionUndone` acts only on a `COMPLETED` occurrence — there is
 *                       nothing to undo otherwise.
 *   NO_SUCH_OCCURRENCE  the placement or task is not in the store.
 */
export type NoActionReason =
  | 'ALREADY_COMPLETE'
  | 'NOT_PLANNED'
  | 'NOT_FLEXIBLE'
  | 'WINDOW_NOT_ELAPSED'
  | 'PLACEMENT_STILL_VALID'
  | 'NOT_COMPLETED'
  | 'NO_SUCH_OCCURRENCE';

/**
 * The result of ONE trigger against ONE occurrence.
 *
 * ⚠️ `RESCHEDULED.placement` is the occurrence in its NEW position, and the two shapes behind
 * it differ by trigger (FR-RSC-02 note, v2.14): a missed or skipped occurrence keeps its
 * original row (`MISSED` / `SKIPPED`) and this is a NEW successor; a displaced one is THIS
 * SAME ROW, moved in place, still `PLANNED`, with no successor anywhere.
 *
 * `UNPLACEABLE` is a REPORT, not a stored state. FR-RSC-05 (v2.13): unplaced is the ABSENCE
 * of a placement — no `UNPLACED` member is added to `PlacementStatus`, the reason is
 * recomputed on retrieval from the engine's own `NoSlotReason`, and nothing is written.
 *
 * ⚠️ `trigger` IS OPTIONAL ON BOTH, and only because FR-RSC-05's re-attempt reaches them for a
 * task that was never placed (SRS v2.20). FR-RSC-04's three facts are the facts of a
 * RESCHEDULE, and a first placement is not one — so there is no trigger to state, and the
 * alternative to omitting it is inventing it. **Every trigger the user actually caused is
 * still required**: `classifyAndReplace` and `moveInPlace` take a literal union and cannot
 * produce an absent one. `undefined` here is reachable from exactly one direction — an
 * evidence-free `triggerFromHistory`.
 *
 * *(Written `?: T | undefined` rather than the absent-key discipline `Placement` uses. The
 * stored field is persisted and compared, so DR-06 needs the key genuinely gone; this is a
 * transient report that `JSON.stringify` drops either way — `res.json` sends the same bytes.)*
 */
export type RescheduleOutcome =
  | {
      readonly kind: 'RESCHEDULED';
      readonly taskId: string;
      readonly trigger?: RescheduleTrigger | undefined;
      readonly placement: Placement;
    }
  | {
      readonly kind: 'UNPLACEABLE';
      readonly taskId: string;
      readonly date: IsoDate;
      readonly trigger?: RescheduleTrigger | undefined;
      /**
       * The ENGINE's reason and explanation (FR-SCH-06), passed through and never invented —
       * with exactly one exception, written down in FR-RSC-01's v2.14 note so that it stays
       * the only one: where `now` is at or past the end of the schedulable day there is no
       * remainder to ask about, the engine is not called, and the reason is `DAY_FULL`.
       */
      readonly reason: NoSlotReason;
      readonly explanation: string;
      /** FR-RSC-05: "offer to move it to the next day". Acted on by `moveToNextDay`. */
      readonly offerNextDay: true;
    }
  | {
      readonly kind: 'NO_ACTION';
      readonly taskId: string;
      readonly why: NoActionReason;
    }
  | {
      /**
       * The `ELAPSED_CLASSIFICATION=COMPLETED` alternative to a `RESCHEDULED` MISSED outcome
       * (see `RescheduleService`'s constructor doc). The occurrence is marked `COMPLETED` in
       * place — no successor, no reschedule — so there is nothing here to call `RESCHEDULED`.
       */
      readonly kind: 'AUTO_COMPLETED';
      readonly taskId: string;
      readonly placement: Placement;
    }
  | {
      /**
       * A FIXED commitment's elapsed occurrence under `ELAPSED_CLASSIFICATION=MISSED`: marked
       * `MISSED` in place, with no successor, because a fixed commitment is immovable and there
       * is nowhere else for it to go (unlike `RESCHEDULED`, which a flexible MISSED occurrence
       * always produces alongside its original row).
       */
      readonly kind: 'AUTO_MISSED';
      readonly taskId: string;
      readonly placement: Placement;
    };

/**
 * FR-RSC-09. `cancelled` is the withdrawn successor — status `CANCELLED`, never deleted, so
 * DR-06's "distinguishable from one that never occurred" holds. `null` where there was nothing
 * to withdraw.
 *
 * ⚠️ Scoped to the MISSED classification (v2.14, E6). Completing an occurrence that a skip or
 * a displacement moved is ORDINARY completion: `cancelled` is `null`. A miss is inferred from
 * silence and can be wrong with nobody having said anything; a skip and a displacement are
 * events the user witnessed.
 */
export interface CompletionOutcome {
  readonly taskId: string;
  /** The occurrence the user marked complete, now `COMPLETED`. */
  readonly completed: Placement;
  /** The reschedule that was withdrawn, now `CANCELLED`. */
  readonly cancelled: Placement | null;
  /** "...and state that it has done so." Non-empty whenever `cancelled` is not null. */
  readonly statement: string;
}

// ─── Internals ───────────────────────────────────────────────────────────────

/**
 * The statuses that OCCUPY time on the day, and therefore make a busy interval for the engine.
 * A `MISSED`, `SKIPPED`, `CANCELLED` or `SUPERSEDED` row records something about the past; it
 * holds nothing. FR-RSC-09's "free the interval it held" is this set and nothing else — a
 * withdrawn reschedule becomes `CANCELLED`, and a replaced workout becomes `SUPERSEDED`
 * (FR-REC-02), and each drops out of every subsequent busy set automatically.
 */
const OCCUPIES_TIME: readonly PlacementStatus[] = ['PLANNED', 'COMPLETED'];

const occupiesTime = (p: Placement): boolean => OCCUPIES_TIME.includes(p.status);

/** Half-open [start, end) overlap. A comparison, not a search. */
const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

const intervalOf = (p: Placement): Interval => ({ start: p.start, end: p.end });

/** The occurrence a trigger acts on, once it has been read back from the STORE (FR-RSC-06). */
interface Occurrence {
  readonly task: Task;
  readonly userId: string;
  /** The stored row — never the caller's possibly-stale copy of it. */
  readonly stored: Placement;
}

/** What the engine answered, reduced to what this service is allowed to use. */
type EngineAnswer =
  | { readonly ok: true; readonly slot: Slot }
  | { readonly ok: false; readonly reason: NoSlotReason; readonly explanation: string };

const noAction = (taskId: string, why: NoActionReason): RescheduleOutcome => ({
  kind: 'NO_ACTION',
  taskId,
  why,
});

const unplaceable = (
  taskId: string,
  date: IsoDate,
  trigger: RescheduleTrigger | undefined,
  answer: { readonly reason: NoSlotReason; readonly explanation: string },
): RescheduleOutcome => ({
  kind: 'UNPLACEABLE',
  taskId,
  date,
  trigger,
  reason: answer.reason,
  explanation: answer.explanation,
  offerNextDay: true,
});

/**
 * `exactOptionalPropertyTypes` is on, so an absent `rescheduleTrigger` must be an ABSENT KEY
 * rather than one set to `undefined` — which is also what the contract means by "absent if this
 * placement has never been moved" (DR-06).
 */
const withTrigger = (
  base: Omit<Placement, 'rescheduleTrigger'>,
  trigger: RescheduleTrigger | undefined,
): Placement => (trigger === undefined ? base : { ...base, rescheduleTrigger: trigger });

/**
 * Which trigger a RE-ATTEMPT descends from, for a task that has no `PLANNED` placement at all.
 * FR-RSC-05's offer is derived on every retrieval and nothing about it was stored, so the only
 * evidence of what happened is the row the day left behind.
 *
 * ⛔ `undefined` WHERE THE STORE HOLDS NO EVIDENCE, and this function may never guess again
 * (SRS v2.20, closing OPEN-21). It previously ended `return 'MISSED'`, which made every
 * evidence-free re-attempt claim an event that had not happened — and the commonest such
 * re-attempt by far is a brand-new task's FIRST placement, which the API reaches this branch
 * for deliberately (`server/src/api/app.ts`). "Absent means it has never been rescheduled" is
 * the contract's own sentence on `RescheduleTrigger`; a first placement has never been
 * rescheduled, so `MISSED` contradicted the contract and would have had FR-DSH-05 render
 * *"its 8:00 PM slot passed without being marked complete"* over a task that was simply
 * created.
 *
 * ⚠️ Two DIFFERENT histories are both empty and the store cannot tell them apart: a task never
 * placed at all, and one whose `PLANNED` row `moveInPlace` hard-deleted when a displacement or
 * edit could not be re-placed (FR-RSC-05, v2.16 E11). Provenance is genuinely lost in the
 * second case, and that is accepted — `undefined` understates it by one fact, where a named
 * trigger would state a fact that is false. Saying nothing is the only honest option available.
 */
const triggerFromHistory = (rows: readonly Placement[]): RescheduleTrigger | undefined => {
  if (rows.some((p) => p.status === 'MISSED')) return 'MISSED';
  if (rows.some((p) => p.status === 'SKIPPED')) return 'SKIPPED';
  return undefined;
};

// ─── The service ─────────────────────────────────────────────────────────────

export class RescheduleService {
  /**
   * `elapsedClassification` — a same-session, dev-facing switch (env var `ELAPSED_CLASSIFICATION`
   * in `index.ts`, defaulting to `'MISSED'` so every existing test and the frozen packet 06/07
   * suite is unaffected) between FR-RSC-01's classification and an alternative the team wanted to
   * compare it against: instead of MISSED + a rescheduled successor, `sweepElapsed` marks the
   * elapsed occurrence `COMPLETED` in place and calls the engine for nothing. Only `sweepElapsed`
   * reads this — `onTaskMissed` (the explicit, human-invoked `/tasks/:id/mark-missed`) always
   * means MISSED regardless, because the human said so, not because time passed.
   */
  constructor(
    private readonly engine: FindCandidateSlots,
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly elapsedClassification: 'MISSED' | 'COMPLETED' = 'MISSED',
  ) {}

  /** FR-RSC-01 — an elapsed, incomplete, flexible occurrence is classified missed. */
  async onTaskMissed(placement: Placement): Promise<RescheduleOutcome> {
    const found = await this.occurrence(placement);
    if ('why' in found) return noAction(placement.taskId, found.why);
    const { task, userId, stored } = found;

    // FR-RSC-01, read literally: a miss requires the window to have FULLY elapsed. This is what
    // keeps FR-RSC-08 meaningful — a skip must be accepted in exactly the case a miss must not.
    if (!this.hasElapsed(stored.date, stored.end)) return noAction(task.id, 'WINDOW_NOT_ELAPSED');

    return this.classifyAndReplace(userId, task, stored, 'MISSED');
  }

  /** FR-RSC-08 — the user declares an occurrence skipped, possibly before its window ends. */
  async onUserSkipped(placement: Placement): Promise<RescheduleOutcome> {
    const found = await this.occurrence(placement);
    if ('why' in found) return noAction(placement.taskId, found.why);
    const { task, userId, stored } = found;

    return this.classifyAndReplace(userId, task, stored, 'SKIPPED');
  }

  /**
   * FR-RSC-02 — a new fixed commitment moves what it overlaps; it never moves itself.
   *
   * `date` is a parameter because `Task` records WHEN IN A DAY and never WHICH DAY (v2.14, E2).
   */
  async onCommitmentAdded(
    commitment: Task,
    date: IsoDate,
  ): Promise<readonly RescheduleOutcome[]> {
    const userId = await this.repo.ownerOfTask(commitment.id);
    if (userId === undefined) return [];

    // §3.4's sequence diagram: the commitment is INSERTED first, then the overlapping flexible
    // tasks are found. Its interval is therefore read from the store, not guessed from its
    // preferred window — where the user put it is the fact that matters.
    const onDate = await this.repo.placementsForDate(userId, date);
    const held = onDate.filter((p) => p.taskId === commitment.id && occupiesTime(p)).map(intervalOf);
    if (held.length === 0) return [];

    // ⚠️ `PLANNED` only. FR-RSC-06's second route to idempotency depends on it: the displaced
    // row stays `PLANNED` and simply stops overlapping, so a second firing finds nothing. A
    // rule that also caught `MISSED` or `SKIPPED` rows would re-fire forever on the same
    // commitment, and a `COMPLETED` one is protected by FR-RSC-07 regardless.
    const candidates: Occurrence[] = [];
    for (const p of onDate) {
      if (p.taskId === commitment.id || p.status !== 'PLANNED') continue;
      if (!held.some((h) => overlaps(intervalOf(p), h))) continue;
      const task = await this.repo.getTask(p.taskId);
      if (task === undefined || task.flexibility !== 'FLEXIBLE') continue;
      candidates.push({ task, userId, stored: p });
    }

    // FR-SCH-10: one commitment can displace several tasks, and they go back in priority order.
    candidates.sort((a, b) => byPlacementOrder(a.task, b.task));

    const outcomes: RescheduleOutcome[] = [];
    for (const c of candidates) {
      outcomes.push(
        await this.moveInPlace(c, date, 'DISPLACED', (start) =>
          displacedReason(c.task, c.stored.start, start, commitment.title),
        ),
      );
    }
    return outcomes;
  }

  /** FR-RSC-07, FR-RSC-09 — completion ends rescheduling, and withdraws one already made. */
  async onCompletionRecorded(placement: Placement): Promise<CompletionOutcome> {
    const userId = await this.repo.ownerOfTask(placement.taskId);
    const task = await this.repo.getTask(placement.taskId);
    const onDate =
      userId === undefined ? [] : await this.repo.placementsForDate(userId, placement.date);
    const stored = onDate.find((p) => p.id === placement.id) ?? placement;

    const completed: Placement = { ...stored, status: 'COMPLETED' };
    await this.repo.savePlacement(completed);

    // FR-RSC-09, scoped to the MISSED classification (v2.14, E6). The successor is found the
    // only way the contract allows — no link field was added to `Placement` (§4.7) — as the
    // task's other `PLANNED` placement on the same date carrying the `MISSED` trigger. One
    // `PLANNED` placement per task per date makes that unambiguous. A skip or a displacement
    // is an event the user witnessed, so nothing is withdrawn for either.
    const successor = onDate.find(
      (p) =>
        p.id !== stored.id &&
        p.taskId === stored.taskId &&
        p.status === 'PLANNED' &&
        p.rescheduleTrigger === 'MISSED',
    );

    if (successor === undefined) {
      return { taskId: stored.taskId, completed, cancelled: null, statement: '' };
    }

    // Marked, never deleted (DR-06): a cancelled reschedule stays distinguishable from one that
    // never occurred, and `CANCELLED` is outside OCCUPIES_TIME — which is what frees the
    // interval it held, for the engine and for every later sweep.
    const cancelled: Placement = { ...successor, status: 'CANCELLED' };
    await this.repo.savePlacement(cancelled);

    return {
      taskId: stored.taskId,
      completed,
      cancelled,
      statement:
        task === undefined ? '' : cancellationStatement(task, successor.start),
    };
  }

  /**
   * The user corrects a mistaken `complete` click: the occurrence is reverted to `MISSED` and
   * re-placed exactly as a real miss would be (the same `classifyAndReplace` path FR-RSC-01
   * uses). This is deliberately the one way past FR-RSC-07's "never" — every other path reaches
   * a `COMPLETED` row through inference (the sweep, a stale trigger); this one only fires on the
   * user's own explicit statement that the completion was wrong, so nothing is being guessed.
   */
  async onCompletionUndone(placement: Placement): Promise<RescheduleOutcome> {
    const task = await this.repo.getTask(placement.taskId);
    const userId = await this.repo.ownerOfTask(placement.taskId);
    if (task === undefined || userId === undefined) {
      return noAction(placement.taskId, 'NO_SUCH_OCCURRENCE');
    }

    // FR-RSC-06: the stored row, never the caller's possibly-stale copy.
    const onDate = await this.repo.placementsForDate(userId, placement.date);
    const stored = onDate.find((p) => p.id === placement.id);
    if (stored === undefined) return noAction(task.id, 'NO_SUCH_OCCURRENCE');
    if (stored.status !== 'COMPLETED') return noAction(task.id, 'NOT_COMPLETED');
    // A fixed commitment isn't the engine's to re-place, same as every other trigger.
    if (task.flexibility !== 'FLEXIBLE') return noAction(task.id, 'NOT_FLEXIBLE');

    return this.classifyAndReplace(userId, task, stored, 'MISSED');
  }

  /**
   * FR-TSK-04 — the user changed the task's duration or preferred window, so its occurrence on
   * `date` is re-evaluated and re-placed IF it is no longer valid (SRS v2.15, closing OPEN-18).
   *
   * ⛔ THE VALIDITY CHECK MAY ONLY REJECT, NEVER CHOOSE. *"Does this placement still fit the new
   * duration, still lie inside the new window, still avoid every busy interval?"* is a predicate
   * over a placement that already exists. **Where the task should go instead is the engine's,
   * always** (FR-RSC-03). This is the closest any requirement in the System comes to licensing a
   * second placement function, and v2.15 draws the line here on purpose.
   *
   * One call re-evaluates ONE occurrence: under FR-TSK-05 a recurring task has many, and the
   * caller invokes this once per date it has materialised.
   */
  async onTaskEdited(task: Task, date: IsoDate): Promise<RescheduleOutcome> {
    const userId = await this.repo.ownerOfTask(task.id);
    if (userId === undefined) return noAction(task.id, 'NO_SUCH_OCCURRENCE');

    const onDate = await this.repo.placementsForDate(userId, date);
    const mine = onDate.filter((p) => p.taskId === task.id);

    // FR-RSC-07 is a quantifier, and this is the trigger where forgetting it is easiest,
    // because an edit feels like the user's own instruction.
    if (mine.some((p) => p.status === 'COMPLETED')) return noAction(task.id, 'ALREADY_COMPLETE');

    // A fixed commitment's placement is the user's statement, not the engine's answer (§3.4
    // inserts it directly). Computing where it goes HERE would be the second placement function.
    if (task.flexibility !== 'FLEXIBLE') return noAction(task.id, 'NOT_FLEXIBLE');

    const current = mine.find((p) => p.status === 'PLANNED');
    if (current === undefined) return noAction(task.id, 'NOT_PLANNED');

    if (this.stillValid(current, task, onDate)) return noAction(task.id, 'PLACEMENT_STILL_VALID');

    return this.moveInPlace({ task, userId, stored: current }, date, 'EDITED', (start) =>
      editedReason(task, start),
    );
  }

  /** FR-RSC-10 — the evaluation a schedule retrieval performs. No timer, no background job. */
  async sweepElapsed(userId: string, date: IsoDate): Promise<readonly RescheduleOutcome[]> {
    const tasks = await this.repo.tasksForDate(userId, date);
    const placements = await this.repo.placementsForDate(userId, date);

    // At most ONE candidate per task per retrieval — which is what keeps ten refreshes from
    // producing ten successors (FR-RSC-06), and what stops an occurrence classified missed in
    // this pass from being re-attempted again in the same pass.
    const elapsedOnes: Occurrence[] = [];
    const reattempts: { readonly task: Task; readonly history: readonly Placement[] }[] = [];

    for (const task of tasks) {
      const mine = placements.filter((p) => p.taskId === task.id);
      if (mine.some((p) => p.status === 'COMPLETED')) continue; // FR-RSC-07, never.

      // FR-RSC-01's RE-PLACEMENT is flexible-only — a fixed commitment is immovable by
      // definition, so there is no successor to find it and no reattempt to offer. But an
      // elapsed fixed occurrence still needs a real status instead of sitting PLANNED forever,
      // so it is classified in place (below, at the output loop) and never enters `reattempts`.
      if (task.flexibility !== 'FLEXIBLE') {
        const fixedPlanned = mine.filter((p) => p.status === 'PLANNED');
        const fixedElapsed = fixedPlanned.find((p) => this.hasElapsed(date, p.end));
        if (fixedElapsed !== undefined) elapsedOnes.push({ task, userId, stored: fixedElapsed });
        continue;
      }

      const plannedRows = mine.filter((p) => p.status === 'PLANNED');
      if (plannedRows.length === 0) {
        // ⛔ FR-REC-02 / OPEN-27: a `SUPERSEDED` occurrence was DELIBERATELY vacated when a
        // recommendation replaced this workout for the day (RecommendationScheduler). Unlike a
        // genuinely unplaced task it must NOT be re-attempted — the FR-RSC-05 self-heal below
        // would otherwise resurrect the replaced run beside the recovery session on the next
        // retrieval, silently undoing the replacement. Per-occurrence: only THIS date is
        // superseded, so a recurring task's other dates still self-heal normally.
        if (mine.some((p) => p.status === 'SUPERSEDED')) continue;
        // FR-RSC-05: unplaced is the ABSENCE of a placement, and the offer is re-derived rather
        // than stored — so a task with no `PLANNED` row is re-attempted on every retrieval, and
        // "free the day up and the next retrieval places the task" needs nothing cleaned up.
        reattempts.push({ task, history: mine });
        continue;
      }

      const elapsed = plannedRows.find((p) => this.hasElapsed(date, p.end));
      if (elapsed !== undefined) elapsedOnes.push({ task, userId, stored: elapsed });
    }

    const ordered: (Occurrence | { readonly task: Task; readonly history: readonly Placement[] })[] =
      [...elapsedOnes, ...reattempts].sort((a, b) => byPlacementOrder(a.task, b.task));

    const outcomes: RescheduleOutcome[] = [];
    for (const item of ordered) {
      if ('stored' in item) {
        if (this.elapsedClassification === 'COMPLETED') {
          outcomes.push(await this.completeElapsed(item.stored));
        } else if (item.task.flexibility === 'FLEXIBLE') {
          outcomes.push(await this.classifyAndReplace(userId, item.task, item.stored, 'MISSED'));
        } else {
          // Fixed and immovable: MISSED in place, same as a real miss's original row, but with
          // no successor to find it — there is nowhere else for a fixed commitment to go.
          outcomes.push(await this.markElapsedFixedMissed(item.stored));
        }
      } else {
        // The re-attempt is stamped with what it descends from — and with NOTHING where the
        // store holds no evidence it descends from anything (v2.20). This branch is also a
        // brand-new task's first-ever placement, which is not a reschedule at all — so its stored
        // reason must not claim a failed earlier attempt (OPEN-24, v2.27). Where the store holds a
        // row (a MISSED occurrence whose own re-placement found no room) the day genuinely had no
        // room earlier and `reattemptReason` is true; where it holds nothing, only a plain
        // `firstPlacementReason` is honest. The distinction is a REASON choice, not a placement
        // one — the engine still decides where the task goes (FR-RSC-03).
        const reason: (start: Minute) => string =
          item.history.length === 0
            ? (start) => firstPlacementReason(item.task, start)
            : (start) => reattemptReason(item.task, start);
        outcomes.push(
          await this.placeFresh(userId, item.task, date, triggerFromHistory(item.history), reason),
        );
      }
    }
    return outcomes;
  }

  /** FR-RSC-05 — the user accepts the offer; the SAME engine places the task on `date` + 1. */
  async moveToNextDay(taskId: string, date: IsoDate): Promise<RescheduleOutcome> {
    const task = await this.repo.getTask(taskId);
    const userId = await this.repo.ownerOfTask(taskId);
    if (task === undefined || userId === undefined) return noAction(taskId, 'NO_SUCH_OCCURRENCE');

    // `date` is the day the task could NOT be placed on — the offer is made there, so that is
    // the date the caller is holding. The placement is made on the day after it.
    const next = this.clock.nextDate(date);
    const history = await this.repo.placementsForDate(userId, date);
    const descendsFrom = triggerFromHistory(history.filter((p) => p.taskId === taskId));

    // The next day is offered IN FULL, with the user's real preferred window: `now` is not on
    // that day, so there is no elapsed part to narrow away and nothing to substitute. Both of
    // v2.14's rules are about a window's relationship to the CURRENT day.
    return this.placeFresh(
      userId,
      task,
      next,
      descendsFrom,
      (start) => nextDayReason(task, start),
      { stamped: false },
    );
  }

  // ── The one call to the engine, and the three ways its answer is recorded ──

  /**
   * ⛔ THE ONLY PLACE THIS SERVICE ASKS WHERE A TASK GOES, and it asks — it does not answer.
   * The service's whole contribution is the three arguments: the busy set, the (possibly
   * derived) task, and the shape of the day. The return value is used verbatim.
   */
  private async askEngine(
    userId: string,
    task: Task,
    date: IsoDate,
    excludePlacementId: string | undefined,
    /**
     * `classifyAndReplace`'s vacated interval (FR-RSC-01/08): the retiring row is excluded from
     * `busy` by its own now-MISSED/SKIPPED status, so without this the slot it just gave up
     * reads as free again and the engine's own ranking (closest to the preferred window) simply
     * re-selects it — a "reschedule" that lands right back where it started. Passed as an extra
     * busy interval so the search is genuinely forced elsewhere. Not used by `moveInPlace`,
     * whose row is still `PLANNED` and displaced by a real conflict already in `busy`.
     */
    avoid?: Interval,
  ): Promise<EngineAnswer> {
    const day = await this.repo.schedulableDay(userId, date);
    const window = this.remainderOfDay(day, date);

    // FR-RSC-01 (v2.14): no remainder means no valid `Interval` to pass, so the engine is not
    // called. The one reason in the System that does not originate in the engine. ⛔ OPEN-35:
    // two distinct cases now reach here — today's day being over, and a date that has already
    // CLOSED (strictly before today) — and they get two different, honestly-worded reasons.
    if (window === undefined) {
      const explanation =
        date < this.clock.today()
          ? dayAlreadyPassedExplanation(task, date)
          : dayAlreadyOverExplanation(task, day.end);
      return { ok: false, reason: 'DAY_FULL', explanation };
    }

    // UC-13 step 3: "re-invokes the same engine with the UPDATED busy set." The occurrence being
    // moved is not in it — it is about to cease to exist where it is, and a displaced or edited
    // row is still `PLANNED`, so a service reading "all PLANNED placements" would route the task
    // around itself and keep it out of its own preferred window.
    const onDate = await this.repo.placementsForDate(userId, date);
    const busy: Interval[] = onDate
      .filter((p) => p.id !== excludePlacementId && occupiesTime(p))
      .map(intervalOf);
    if (avoid !== undefined) busy.push(avoid);

    const result = this.engine(busy, this.askedAbout(task, window, date), window);
    if (!result.placed) return { ok: false, reason: result.reason, explanation: result.explanation };

    // FR-RSC-01 (v2.12): the RANK-1 candidate — the first element of the returned `slots`.
    // FR-SCH-03 has already ranked them; a service applying its own criterion to that list is
    // where the second placement function FR-RSC-03 forbids would begin.
    const [best] = result.slots;
    if (best === undefined) {
      // `placed: true` with no slots is a broken engine, not a full day. Reporting it as a
      // domain outcome would invent a `NoSlotReason` the engine never gave.
      throw new Error('findCandidateSlots returned placed: true with no candidate slots');
    }
    return { ok: true, slot: best };
  }

  /**
   * FR-RSC-01 (v2.12): "remaining that day" is expressed by what the service passes IN, not by
   * a rule the engine applies. `undefined` where the day is already over.
   *
   * ⛔ OPEN-35: a date BEFORE today has no remainder at all — the day is entirely over, not
   * merely partway through. The old code only special-cased `date === today`, so a past date
   * (any date whose `IsoDate` sorts before `clock.today()`) fell into the "not today" branch
   * meant for a FUTURE day and was handed the FULL schedulable day back. That let a missed
   * occurrence on a closed day be "re-placed" inside that same closed day, in the same slot it
   * already occupied — which the next retrieval then found freshly "elapsed" again by
   * `hasElapsed`'s own minute check, forever. A future date still gets the full day (nothing
   * has elapsed on a day that has not arrived), which is unchanged.
   */
  private remainderOfDay(day: Interval, date: IsoDate): Interval | undefined {
    const today = this.clock.today();
    if (date < today) return undefined;
    if (date !== today) return day;
    const start = Math.max(day.start, this.clock.nowMinute());
    return start < day.end ? { start, end: day.end } : undefined;
  }

  /**
   * FR-RSC-01 / FR-RSC-10 — has this occurrence's window elapsed? ⛔ OPEN-35: this is the
   * decision the bug lived in. The old callers compared `clock.nowMinute()` to the placement's
   * minute-of-day ALONE, never checking which calendar date the placement is even ON — so a
   * placement on ANY date whose minute-of-day happened to be `<= nowMinute()` was "elapsed",
   * including a date two days from now or two days ago. A date strictly before today has
   * unambiguously elapsed in full, regardless of the clock's minute; a date strictly after
   * today has not begun to elapse, regardless of the clock's minute; only on today does the
   * minute comparison mean anything.
   */
  private hasElapsed(date: IsoDate, endMinute: Minute): boolean {
    const today = this.clock.today();
    if (date < today) return true;
    if (date > today) return false;
    return endMinute <= this.clock.nowMinute();
  }

  /**
   * FR-RSC-01 (v2.14, E1): where the preferred window has FULLY elapsed the engine is invoked
   * with a DERIVED task whose window is the remainder of the day. **The stored task is never
   * modified** — tomorrow's occurrence uses the user's real window again. A partly elapsed
   * window is passed AS IT STANDS, and the engine handles the surviving part normally.
   *
   * Without this the engine is obliged by FR-SCH-09's last boundary row to reject every missed
   * task, and §2.7.1's "the schedule repairs itself" is false for the Core's own trigger.
   */
  private askedAbout(task: Task, window: Interval, date: IsoDate): Task {
    if (date !== this.clock.today()) return task;
    if (task.preferredWindow.end > this.clock.nowMinute()) return task;
    return { ...task, preferredWindow: window };
  }

  /**
   * FR-RSC-01 / FR-RSC-08 — the occurrence elapsed or was declared skipped, so something really
   * did happen at the old time: the original row is KEPT as the record of it (FR-ANL reads
   * these) and the re-placement is a NEW successor.
   */
  private async classifyAndReplace(
    userId: string,
    task: Task,
    stored: Placement,
    trigger: 'MISSED' | 'SKIPPED',
  ): Promise<RescheduleOutcome> {
    await this.repo.savePlacement({ ...stored, status: trigger });

    const answer = await this.askEngine(userId, task, stored.date, stored.id, intervalOf(stored));
    // FR-RSC-05: the classification is not conditional on a slot being found. The original stays
    // MISSED/SKIPPED, nothing else is written, and the next day is offered.
    if (!answer.ok) return unplaceable(task.id, stored.date, trigger, answer);

    const successor = withTrigger(
      {
        id: this.repo.nextPlacementId(),
        taskId: task.id,
        date: stored.date,
        start: answer.slot.start,
        end: answer.slot.end,
        status: 'PLANNED',
        placementReason:
          trigger === 'MISSED'
            ? missedReason(task, stored.start, answer.slot.start)
            : skippedReason(task, stored.start, answer.slot.start),
      },
      trigger,
    );
    await this.repo.savePlacement(successor);
    return { kind: 'RESCHEDULED', taskId: task.id, trigger, placement: successor };
  }

  /**
   * The `ELAPSED_CLASSIFICATION=COMPLETED` alternative to `classifyAndReplace(..., 'MISSED')`:
   * the elapsed row is marked `COMPLETED` in place, exactly as `onCompletionRecorded` marks a
   * user-confirmed completion — no successor, no engine call, no reschedule trigger, because
   * nothing was rescheduled. `OCCUPIES_TIME` already includes `COMPLETED`, so the slot stays
   * held rather than freed.
   */
  private async completeElapsed(stored: Placement): Promise<RescheduleOutcome> {
    const placement: Placement = { ...stored, status: 'COMPLETED' };
    await this.repo.savePlacement(placement);
    return { kind: 'AUTO_COMPLETED', taskId: stored.taskId, placement };
  }

  /**
   * A fixed commitment's elapsed occurrence, under `ELAPSED_CLASSIFICATION=MISSED`: marked
   * `MISSED` in place, exactly like `classifyAndReplace`'s original row — but with no successor,
   * because a fixed commitment is immovable (FR-RSC-02) and there is nowhere else for it to go.
   */
  private async markElapsedFixedMissed(stored: Placement): Promise<RescheduleOutcome> {
    const placement: Placement = { ...stored, status: 'MISSED' };
    await this.repo.savePlacement(placement);
    return { kind: 'AUTO_MISSED', taskId: stored.taskId, placement };
  }

  /**
   * FR-RSC-02 / FR-TSK-04 — nothing happened at the old time, so the SAME ROW moves: same id,
   * status still `PLANNED`, no successor. Inventing a status for the row left behind is what
   * v2.14 declined to do for displacement, and `PlacementStatus` still has none.
   */
  private async moveInPlace(
    occurrence: Occurrence,
    date: IsoDate,
    trigger: 'DISPLACED' | 'EDITED',
    reason: (start: Minute) => string,
  ): Promise<RescheduleOutcome> {
    const { task, userId, stored } = occurrence;
    const answer = await this.askEngine(userId, task, date, stored.id);

    if (!answer.ok) {
      // ⛔ FR-RSC-05 (v2.16, E11) — THE DOMAIN'S ONLY DELETION, and this is its only caller.
      // This row is still `PLANNED`, and FR-RSC-05 recognises an unplaced task by the ABSENCE
      // of a `PLANNED` placement: leaving it would store an overlap AND, far worse, make the
      // task look placed, so the next-day offer would silently stop being made and a day that
      // later freed up would never heal it. The overlap is visible; the missing offer is not.
      await this.repo.deletePlacement(stored.id);
      return unplaceable(task.id, date, trigger, answer);
    }

    const moved: Placement = {
      ...stored,
      start: answer.slot.start,
      end: answer.slot.end,
      status: 'PLANNED',
      placementReason: reason(answer.slot.start),
      rescheduleTrigger: trigger,
    };
    await this.repo.savePlacement(moved);
    return { kind: 'RESCHEDULED', taskId: task.id, trigger, placement: moved };
  }

  /**
   * A task with no occurrence to move — FR-RSC-05's re-attempt on retrieval, and the accepted
   * next-day offer. Nothing is excluded from the busy set because nothing is being vacated.
   *
   * `stamped: false` leaves `rescheduleTrigger` absent: the next day's placement is an ordinary
   * one, and "absent means it has never been rescheduled" is what the contract says the field
   * means. The trigger is still reported on the outcome, so a failure says what it descends from.
   *
   * ⚠️ `stamped` and an ABSENT `trigger` are two different absences and both are needed (v2.20).
   * `stamped: false` says *"this really is a reschedule, but the ROW being written is a fresh
   * placement"* — the accepted next-day offer, which still reports what it descends from. An
   * absent `trigger` says *"the store holds no evidence this descends from anything"*, and it
   * is absent in the report too, because there is nothing to report. Collapsing the two would
   * have `moveToNextDay` stop naming the miss that produced the offer.
   */
  private async placeFresh(
    userId: string,
    task: Task,
    date: IsoDate,
    trigger: RescheduleTrigger | undefined,
    reason: (start: Minute) => string,
    options: { readonly stamped: boolean } = { stamped: true },
  ): Promise<RescheduleOutcome> {
    const answer = await this.askEngine(userId, task, date, undefined);
    if (!answer.ok) return unplaceable(task.id, date, trigger, answer);

    const placement = withTrigger(
      {
        id: this.repo.nextPlacementId(),
        taskId: task.id,
        date,
        start: answer.slot.start,
        end: answer.slot.end,
        status: 'PLANNED',
        placementReason: reason(answer.slot.start),
      },
      options.stamped ? trigger : undefined,
    );
    await this.repo.savePlacement(placement);
    return { kind: 'RESCHEDULED', taskId: task.id, trigger, placement };
  }

  // ── Predicates. These REJECT; they never choose. ──

  /**
   * FR-TSK-04's predicate, exactly as v2.15 states it and v2.16 (E13) sharpens it: does this
   * placement still fit the new duration, still lie inside the new window, still avoid every
   * busy interval?
   *
   * ⚠️ `end - start === durationMinutes`, EXACTLY — not "at least". Every placement leaves the
   * engine with `end = start + duration`, so a 60-minute block held for a 30-minute task is not
   * a roomy booking, it is the WRONG OCCURRENCE: it blocks half an hour of the day from
   * everything else and shows the user a block of the wrong length. Trimming `end` in place was
   * rejected — that computes a time outside the engine.
   *
   * ⚠️ And "lies inside the window" IS part of validity, despite FR-SCH-02 legitimately placing
   * tasks outside their window: without it, editing the preferred window could never invalidate
   * anything — the old slot still fits and is still free — and half of FR-TSK-04's own sentence
   * would be dead text.
   */
  private stillValid(
    current: Placement,
    task: Task,
    onDate: readonly Placement[],
  ): boolean {
    if (current.end - current.start !== task.durationMinutes) return false;
    if (current.start < task.preferredWindow.start) return false;
    if (current.end > task.preferredWindow.end) return false;
    return !onDate.some(
      (p) => p.id !== current.id && occupiesTime(p) && overlaps(intervalOf(p), intervalOf(current)),
    );
  }

  /**
   * FR-RSC-06 — the occurrence as the STORE has it, never the caller's copy. A caller still
   * holding the `PLANNED` copy it was handed is the ordinary case on a second firing, and
   * trusting that copy is how a second placement gets made while every "idempotent" test passes.
   */
  private async occurrence(
    placement: Placement,
  ): Promise<Occurrence | { readonly why: NoActionReason }> {
    const task = await this.repo.getTask(placement.taskId);
    const userId = await this.repo.ownerOfTask(placement.taskId);
    if (task === undefined || userId === undefined) return { why: 'NO_SUCH_OCCURRENCE' };

    const onDate = await this.repo.placementsForDate(userId, placement.date);
    const stored = onDate.find((p) => p.id === placement.id);
    if (stored === undefined) return { why: 'NO_SUCH_OCCURRENCE' };

    if (stored.status === 'COMPLETED') return { why: 'ALREADY_COMPLETE' }; // FR-RSC-07, never.
    if (task.flexibility !== 'FLEXIBLE') return { why: 'NOT_FLEXIBLE' };
    // FR-RSC-06's first route to idempotency: handling a trigger moves the occurrence out of
    // `PLANNED`, so a second firing finds nothing to act on. No trigger log, by design.
    if (stored.status !== 'PLANNED') return { why: 'NOT_PLANNED' };

    return { task, userId, stored };
  }
}
