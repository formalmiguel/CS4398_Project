/**
 * THE CONTRACT.
 *
 * Every module is written against these types. Nothing here may be redefined,
 * widened, shadowed, or extended by any other package.
 *
 * Changing this file is a TEAM DECISION with a row in TEAM-MEETING.md's decision
 * log — never an agent's unilateral refactor. If you are an agent and you believe
 * this file is wrong: STOP and report it. Do not edit it.
 *
 * Types only. No logic, no constants with behavior, no functions.
 *
 * Derived from SRS-v2.md §3.5 (ERD) and §3.6 (class diagram).
 */

// ─── Time ────────────────────────────────────────────────────────────────────
//
// Minutes since local midnight. 0 = 00:00, 1439 = 23:59.
//
// The engine NEVER sees a Date, a timestamp, or a timezone. FR-SCH-05 requires a
// pure function with no clock; an integer offset is the representation that makes
// that structurally true rather than merely intended. Conversion between wall-clock
// time and Minute happens at the API boundary — never inside the engine.

/**
 * Minutes since local midnight. 0–1439.
 *
 * NOTE: this is a plain alias, NOT a branded type. It does not stop you passing a
 * priority or a duration where a Minute belongs — every one of those is `number`.
 * It is a naming convention that makes intent readable, and nothing more.
 *
 * The team considered branding it (`number & { __brand: 'Minute' }`), which WOULD be
 * enforced, and declined on 21 Jul: every literal, JSON boundary, Mongo document and
 * test fixture would need a cast, and a time/priority mix-up fails the property test
 * (NFR-COR-01) on the first of its 1,000 cases anyway. Decision logged.
 *
 * What DOES enforce FR-SCH-05's purity is that the engine never receives a Date and
 * has zero dependencies — not this alias.
 */
export type Minute = number;

/** A half-open interval [start, end). Invariant: end > start. */
export interface Interval {
  readonly start: Minute;
  readonly end: Minute;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type Flexibility = 'FIXED' | 'FLEXIBLE';
export type IntensityTier = 'LOW' | 'MODERATE' | 'HIGH';
export type TaskType = 'CLASS' | 'MEETING' | 'HABIT' | 'WORKOUT' | 'MEAL' | 'OTHER';

/**
 * Who created the task. FR-DSH-04 requires system-generated recommendations to be
 * visually distinguishable from user-created tasks — but note that per FR-REC-04 they
 * are otherwise IDENTICAL: a SYSTEM task is placed by the same engine and defended by
 * the same rescheduling logic as a USER task. This field changes how a task is DRAWN.
 * It must never change how a task is PLACED.
 */
export type TaskSource = 'USER' | 'SYSTEM';

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly type: TaskType;

  /** Must be > 0. */
  readonly durationMinutes: number;

  /** 1–5, where 1 is the HIGHEST priority. (FR-SCH-03 ranking tiebreak.) */
  readonly priority: number;

  readonly preferredWindow: Interval;
  readonly flexibility: Flexibility;
  readonly source: TaskSource;

  /** Set only for type === 'WORKOUT'. */
  readonly intensityTier?: IntensityTier;
}

// ─── Placement ───────────────────────────────────────────────────────────────

export interface Slot {
  readonly start: Minute;
  readonly end: Minute;

  /** 1 = best. Dense and ascending: FR-SCH-02 returns up to three, ranked. */
  readonly rank: number;

  readonly withinPreferredWindow: boolean;

  /**
   * Plain language, for FR-DSH-05. e.g. "4:00 PM — your 2:00 PM slot was taken by CS 401 Lecture."
   *
   * Named `explanation`, NOT `reason`, deliberately: `PlacementResult`'s failure branch has a
   * `reason` field that is an ENUM. Two fields called `reason` — one prose, one union — on types
   * that appear in the same expression is a bug waiting to be written.
   */
  readonly explanation: string;
}

/** Why nothing could be placed. FR-SCH-06 requires a REASON, never a silent empty list. */
export type NoSlotReason =
  | 'DAY_FULL'
  | 'NO_INTERVAL_LONG_ENOUGH'
  | 'WINDOW_OUTSIDE_SCHEDULABLE_DAY'
  | 'DURATION_EXCEEDS_SCHEDULABLE_DAY';

/**
 * The engine's return type.
 *
 * A discriminated union, NOT a bare Slot[]. FR-SCH-06: where no valid slot exists the
 * engine returns "an explicit empty result with a reason" and the System tells the user
 * why — "it shall NOT silently drop the task." An empty array cannot carry a reason, so
 * an empty array would make FR-SCH-06 unsatisfiable at the type level.
 */
export type PlacementResult =
  | { readonly placed: true; readonly slots: readonly Slot[] }
  | {
      readonly placed: false;
      readonly slots: readonly [];
      readonly reason: NoSlotReason;
      readonly explanation: string;
    };

// ─── Placement (an occurrence on a real day) ─────────────────────────────────
//
// A Task is the standing intent ("read 30 minutes, evenings"). A Placement is one
// occurrence of it on one date. FR-TSK-05: a recurring task expands to one Placement
// per matching day, each INDEPENDENTLY completable and reschedulable.
//
// The ENGINE never sees this type — it is pure and per-day (FR-SCH-05). RescheduleService
// does (§3.6), and so do the API, analytics, and the dashboard.

/** DR-06: which trigger moved this placement. Absent means it has never been rescheduled. */
export type RescheduleTrigger =
  | 'MISSED' // inferred: window elapsed, not complete, not skipped  (FR-RSC-01)
  | 'SKIPPED' // declared by the user, possibly before the window     (FR-RSC-08)
  | 'DISPLACED'; // a new fixed commitment overlapped it                 (FR-RSC-02)

export type PlacementStatus =
  | 'PLANNED'
  | 'COMPLETED'
  | 'MISSED'
  | 'SKIPPED'
  /**
   * An automatic reschedule that was WITHDRAWN because the user marked the original
   * occurrence complete (FR-RSC-09). DR-06 requires a cancelled reschedule to stay
   * distinguishable from one that never happened — so it is marked, never deleted.
   */
  | 'CANCELLED';

export interface Placement {
  readonly id: string;
  readonly taskId: string;
  readonly date: IsoDate;
  readonly start: Minute;
  readonly end: Minute;
  readonly status: PlacementStatus;

  /** DR-03: a placement records WHY it is where it is, so FR-DSH-05 reads stored data. */
  readonly placementReason: string;

  /** Absent if this placement has never been moved. */
  readonly rescheduleTrigger?: RescheduleTrigger;
}

// ─── Wearable metrics ────────────────────────────────────────────────────────
//
// One entry per metric, keyed by name — NOT a struct with a sleepScore field and an
// activeCalories field. FR-WER-04 requires adding a metric to be an ADDITION, not a
// modification, and DR/§3.5 requires one ROW per metric per date rather than one COLUMN
// per metric. A `{ sleepScore, activeCalories }` shape would satisfy this release and
// quietly make every future metric a schema migration AND a type change.

export type MetricOrigin = 'EXPORT' | 'LIVE_API' | 'INJECTED';

/**
 * A discriminated union, for the SAME reason PlacementResult is one.
 *
 * FR-WER-06 and NFR-ROB-01: an absent metric and a measured zero are DIFFERENT FACTS and must
 * remain distinguishable at every layer. A rest day with 0 active calories is real data. A watch
 * left on the nightstand is not.
 *
 * A single interface with `value: number` and `isAvailable: boolean` permits
 * `{ value: 0, isAvailable: false }` and lets a rule read `value` without ever checking the flag
 * — which is precisely the collapse the requirement forbids, and nothing would fail.
 *
 * As a union, `value` DOES NOT EXIST on the unavailable branch. A rule that forgets to check
 * availability does not compile. That is the difference between a convention and a constraint.
 */
export type Metric =
  | {
      readonly name: string;
      readonly unit: string;
      readonly origin: MetricOrigin;
      readonly isAvailable: true;
      readonly value: number;
    }
  | {
      readonly name: string;
      readonly unit: string;
      readonly origin: MetricOrigin;
      readonly isAvailable: false;
    };

/** ISO 8601 calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

export interface DailyMetricSet {
  readonly date: IsoDate;
  /** Keyed by metric name. FR-WER-02: the ONLY representation of wearable data downstream. */
  readonly metrics: Readonly<Record<string, Metric>>;
}

// ─── Libraries ───────────────────────────────────────────────────────────────

export type DietaryFlag =
  | 'VEGETARIAN'
  | 'VEGAN'
  | 'GLUTEN_FREE'
  | 'DAIRY_FREE'
  | 'NUT_FREE';

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export interface Workout {
  readonly id: string;
  readonly name: string;
  readonly intensityTier: IntensityTier;
  readonly typicalDurationMinutes: number;
  readonly equipment: readonly string[];
  readonly targetArea: string;
}

export interface Meal {
  readonly id: string;
  readonly name: string;
  readonly mealType: MealType;
  /** FR-LIB-06: not optional metadata — this is the field FR-REC-08 targets. */
  readonly calories: number;
  readonly dietaryFlags: readonly DietaryFlag[];
}

// ─── The engine signature ────────────────────────────────────────────────────

/**
 * THE scheduling engine. FR-SCH.
 *
 * There is exactly ONE function in this codebase that produces a placement, and this is
 * its type. Rescheduling (FR-RSC) is not a second algorithm — it is THIS function, called
 * again with an updated view of the day. If you find yourself writing a second function
 * that computes a placement, STOP: that is precisely the defect FR-RSC-03 exists to prevent.
 *
 * `schedulableDay` is a parameter, not a constant the engine reads, because FR-SCH-05
 * forbids the engine from consulting a clock or a database. The caller knows what time
 * the user wakes and sleeps. The engine is told.
 */
export type FindCandidateSlots = (
  busy: readonly Interval[],
  task: Task,
  schedulableDay: Interval,
) => PlacementResult;
