/**
 * THE RESCHEDULE SERVICE — SURFACE ONLY. 🔴 RED (packet 06).
 *
 * ⛔ EVERY METHOD BODY IS `throw new Error('07')`. That is deliberate and it is the whole
 * point: packet 06 writes the tests, packet 07 writes the implementation against them and
 * MAY NOT EDIT THEM. A test written by whoever wrote the implementation encodes what the
 * code does, not what the requirement says (CLAUDE.md §4.6).
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
 * ⛔ FR-RSC-10: the service is TOLD the time; it never asks. `now`, today's date, and the
 * next calendar date all arrive through the injected `Clock` port. **No ambient clock reading
 * of any kind appears under `server/`** — no system-time call, no timer, no scheduled
 * callback — because FR-RSC-10 is verified "with the clock advanced past a placed occurrence's
 * window", and a test cannot advance a clock the service reads for itself. Same reasoning that
 * made `Minute` the engine's time type (CLAUDE.md §4.7). Packet 07 inherits this prohibition:
 * the checklist greps for it.
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
  RescheduleTrigger,
  Task,
} from '@capstone/shared';

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
   * ⏳ **PROPOSED, NOT YET IN THE SRS — E11 in `docs/P06-RED-REPORT.md`, awaiting adjudication.**
   * It exists here because the suite needs it to express the case; **it binds nothing until a
   * human writes the rule into the SRS.** If E11 is decided another way, this method goes.
   *
   * ⛔ THE ONLY DELETION THE DOMAIN WOULD PERFORM, and it serves exactly one case:
   * an occurrence that was still `PLANNED` — displaced or edited — which the engine could not
   * re-place, and which FR-RSC-05 therefore requires to leave no `PLANNED` placement behind.
   *
   * It destroys no history: a `PLANNED` row is a statement about the future, while what actually
   * happened lives in completion records (DR-01) and in the `MISSED` and `SKIPPED` rows that
   * record a real event. **If a second caller for this ever appears, question it** — this domain
   * marks rows, it does not remove them.
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
 *   NO_SUCH_OCCURRENCE  the placement or task is not in the store.
 */
export type NoActionReason =
  | 'ALREADY_COMPLETE'
  | 'NOT_PLANNED'
  | 'NOT_FLEXIBLE'
  | 'WINDOW_NOT_ELAPSED'
  | 'PLACEMENT_STILL_VALID'
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
 */
export type RescheduleOutcome =
  | {
      readonly kind: 'RESCHEDULED';
      readonly taskId: string;
      readonly trigger: RescheduleTrigger;
      readonly placement: Placement;
    }
  | {
      readonly kind: 'UNPLACEABLE';
      readonly taskId: string;
      readonly date: IsoDate;
      readonly trigger: RescheduleTrigger;
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

// ─── The service ─────────────────────────────────────────────────────────────

/*
 * The parameters below are `_`-prefixed because a RED stub has no body and every one of them
 * is unused BY CONSTRUCTION. `.eslintrc.cjs` carries `argsIgnorePattern: '^_'` for exactly this
 * (E7, closed 22 Jul) — so a deliberately unused argument is silent while a genuinely forgotten
 * one still errors. **Packet 07: drop the underscores as each parameter comes into use.**
 *
 * Declared returning `Promise<…>` without `async`, so that each body remains the single `throw`
 * this packet allows. Packet 07 will mark them `async`.
 */
export class RescheduleService {
  constructor(
    private readonly engine: FindCandidateSlots,
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
  ) {}

  /** FR-RSC-01 — an elapsed, incomplete, flexible occurrence is classified missed. */
  onTaskMissed(_placement: Placement): Promise<RescheduleOutcome> {
    throw new Error('07');
  }

  /** FR-RSC-08 — the user declares an occurrence skipped, possibly before its window ends. */
  onUserSkipped(_placement: Placement): Promise<RescheduleOutcome> {
    throw new Error('07');
  }

  /**
   * FR-RSC-02 — a new fixed commitment moves what it overlaps; it never moves itself.
   *
   * `date` is a parameter because `Task` records WHEN IN A DAY and never WHICH DAY (v2.14, E2).
   */
  onCommitmentAdded(_commitment: Task, _date: IsoDate): Promise<readonly RescheduleOutcome[]> {
    throw new Error('07');
  }

  /** FR-RSC-07, FR-RSC-09 — completion ends rescheduling, and withdraws one already made. */
  onCompletionRecorded(_placement: Placement): Promise<CompletionOutcome> {
    throw new Error('07');
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
  onTaskEdited(_task: Task, _date: IsoDate): Promise<RescheduleOutcome> {
    throw new Error('07');
  }

  /** FR-RSC-10 — the evaluation a schedule retrieval performs. No timer, no background job. */
  sweepElapsed(_userId: string, _date: IsoDate): Promise<readonly RescheduleOutcome[]> {
    throw new Error('07');
  }

  /** FR-RSC-05 — the user accepts the offer; the SAME engine places the task on `date` + 1. */
  moveToNextDay(_taskId: string, _date: IsoDate): Promise<RescheduleOutcome> {
    throw new Error('07');
  }
}
