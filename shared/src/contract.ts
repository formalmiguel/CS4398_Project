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

  /** 1–5, where 1 is the HIGHEST priority. (FR-SCH-10 placement order; FR-SCH-07 displacement.) */
  readonly priority: number;

  readonly preferredWindow: Interval;
  readonly flexibility: Flexibility;
  readonly source: TaskSource;

  /**
   * When the task was created. FR-SCH-10 breaks a priority tie on the EARLIER-CREATED
   * task "so that the order is total and repeatable" — and until this field existed there
   * was nothing on `Task` to read, so the tiebreak could not be evaluated (OPEN-15).
   *
   * ⚠️ The ENGINE never reads it. It is a SERVICE-level input: FR-SCH-10 governs the ORDER
   * IN WHICH the engine is invoked across several tasks, not anything about a single
   * placement. A timestamp on a type the engine receives does NOT weaken FR-SCH-05 —
   * purity forbids the engine CONSULTING a clock, not the caller passing it data.
   *
   * An INSTANT, not `IsoDate`: two tasks created eleven minutes apart on the same day are
   * the ordinary case, and a calendar date would tie them again — reopening the very hole
   * this field closes.
   *
   * OPTIONAL in the type, set in practice at the API boundary. It is optional because the
   * 30 engine tests frozen at ac06e70 construct `Task` literals: a REQUIRED field would
   * break their typecheck and force a re-freeze, for a field the engine never reads.
   * ORDERING, and it is a single key rather than a pair of cases (FR-SCH-10, SRS v2.14):
   * rank on `(has an instant, the instant, id)`. Tasks with a known instant order by it; a
   * task without one sorts AFTER every task that has one; remaining ties break on `id`.
   *
   * ⚠️ NOT "if either is absent, compare that pair by id" — that comparator is NOT TRANSITIVE
   * and so defines no order at all. A(10:00, id 'a'), B(absent, id 'b'), C(09:00, id 'c')
   * gives A<B, B<C and C<A, and a sort handed a cycle returns whatever its pivots produce.
   */
  readonly createdAt?: IsoTimestamp;

  /**
   * How often the task repeats. Absent means it does not — FR-TSK-01 lists "no recurrence"
   * as a valid answer, and the Data Requirements table (§5) has always listed `recurrence`
   * as a retained Task attribute; this field closes the gap between that table and the
   * class diagram (added 22 Jul, closing the recurrence half of packet 12's scope).
   *
   * FR-TSK-05 expands a recurring task into one Placement PER MATCHING DAY, each
   * independently completable and reschedulable. That expansion happens in the API layer
   * (packet 12) — the ENGINE never reads this field and never sees a recurrence rule, only
   * the concrete per-day Task and Interval produced by expanding it. This is the identical
   * principle FR-CAL-06 already states for calendar-sourced events ("the engine shall never
   * receive a recurrence rule — only concrete busy intervals"); it isn't a new rule, only a
   * second requirement landing on it.
   */
  readonly recurrence?: Recurrence;

  /** Set only for type === 'WORKOUT'. */
  readonly intensityTier?: IntensityTier;
}

/** FR-TSK-01: "daily, or specific weekdays." Daily repeats every day by definition. */
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY';

export interface Recurrence {
  readonly frequency: RecurrenceFrequency;

  /**
   * ISO 8601 weekday numbers, 1 (Monday) – 7 (Sunday). Required and non-empty when
   * `frequency` is `'WEEKLY'` — that is what "specific weekdays" means. Absent and ignored
   * when `frequency` is `'DAILY'`, which needs no day list to mean every day.
   */
  readonly daysOfWeek?: readonly number[];
}

// ─── Placement ───────────────────────────────────────────────────────────────

export interface Slot {
  readonly start: Minute;
  readonly end: Minute;

  /** 1 = best. Dense and ascending: FR-SCH-02 returns up to three, ranked. */
  readonly rank: number;

  readonly withinPreferredWindow: boolean;

  /**
   * The ENGINE's account of this slot, in plain language, limited to what the engine can
   * actually know: the times, whether it falls inside the preferred window, and which
   * ranked alternative it is. e.g. "5:45 PM to 6:45 PM — alternative 1 of 3, ranked by
   * nearness to your preferred 5:00 PM start."
   *
   * ⚠️ This is NOT the sentence FR-DSH-05 asks the user to read. That one names the
   * commitment responsible — "Moved to 5:45 PM — your 5:00 PM slot was taken by Advisor" —
   * and it lives on `Placement.placementReason`, written by RescheduleService and stored
   * per DR-03. The engine receives `busy` as bare `Interval`s with no titles, so it CANNOT
   * produce that sentence; only the caller holding the schedule can.
   *
   * *(This comment previously carried FR-DSH-05's example, which made two fields appear to
   * own one requirement and put the example on the field that provably cannot satisfy it.
   * Settled 22 Jul before packet 06 was written, because the natural way to "fix" it is to
   * start pushing task titles into the engine, and that ends the purity argument.)*
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
  | 'DISPLACED' // a new fixed commitment overlapped it                 (FR-RSC-02)
  | 'EDITED'; // the user changed the task's duration or window      (FR-TSK-04)

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
  | 'CANCELLED'
  /**
   * This occurrence was REPLACED by a recommendation (FR-REC-02) — a higher-tier workout
   * swapped for a warranted-tier one for this date only. Terminal, like MISSED/SKIPPED, but it
   * records neither a user event nor an FR-RSC-09 withdrawal: nothing happened at the old time,
   * the plan was overtaken. It occupies no time (excluded from the busy set) AND, unlike a task
   * with no placement at all, it is NOT re-attempted by FR-RSC-05's sweep — that is what stops
   * the replaced workout resurrecting. Per-occurrence: a recurring task's other dates are untouched.
   */
  | 'SUPERSEDED';

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

/**
 * An ISO 8601 instant in UTC, `YYYY-MM-DDTHH:MM:SS.sssZ`. Used only by `Task.createdAt`.
 *
 * ALWAYS UTC with the trailing `Z` and always millisecond precision, because FR-SCH-10
 * compares two of these to break a tie — and in that fixed format, and ONLY in that
 * format, lexicographic string order IS chronological order. A local-time or
 * offset-bearing string sorts wrongly while still looking like a valid timestamp.
 */
export type IsoTimestamp = string;

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

// ─── Recommendations ─────────────────────────────────────────────────────────
//
// Realizes, in TypeScript, the recommendation DATA types the §3.6 class diagram already
// names: `Recommendation` (RecommendationEngine.recommend → Recommendation[]), `Decision`
// (RecommendationRule.apply/fallback → Decision), and `CalorieTarget`. The RULES and the
// `RecommendationEngine` that evaluates them are server-local (server/src/recommendation/) —
// like `RescheduleService` and the `WearableAdapter`, which the SAME diagram names but which
// live under server/. Only the data a rule produces lives in the contract, because the
// wellness views (FR-WEL-02, packets 14/15) render it (SRS v2.26, decision log 25 Jul).

/** kcal. §3.6: the decision `CaloriesToTargetRule` produces (FR-REC-08). */
export type CalorieTarget = number;

/**
 * The raw decision a `RecommendationRule` produces (§3.6: `apply`/`fallback` → `Decision`).
 * A discriminated union on `kind`, for the same reason `Metric`/`PlacementResult` are: the
 * two rules in this release decide different things — `SleepToIntensityRule` an
 * `IntensityTier`, `CaloriesToTargetRule` a `CalorieTarget` — and the union keeps each
 * payload precise while leaving room for a third rule (FR-REC-12) without widening the others.
 */
export type Decision =
  | { readonly kind: 'WORKOUT_INTENSITY'; readonly tier: IntensityTier } // FR-REC-01
  | { readonly kind: 'CALORIE_TARGET'; readonly calorieTarget: CalorieTarget }; // FR-REC-08

/**
 * The machine-readable substrate of FR-REC-13's reason — the metric and value that drove the
 * decision, and whether a documented fallback was used (FR-REC-06). The rendered English
 * sentence ("Recovery session — your sleep score was 42 last night") is a VIEW concern.
 *
 * `metricValue` is null EXACTLY when the metric was unavailable — distinct from a measured
 * zero, which is a real value (DR-02, NFR-ROB-01). A reader must not treat null as 0.
 */
export interface RecommendationReason {
  readonly metricName: string;
  readonly metricValue: number | null;
  readonly usedFallback: boolean;
}

/**
 * What `RecommendationEngine.recommend()` returns (§3.6: `recommend` → `Recommendation[]`):
 * a `Decision` plus the reason it was made (FR-REC-13). The diagram names `Recommendation`
 * but, being UML, carries no reason — this realization supplies it.
 */
export interface Recommendation {
  readonly decision: Decision;
  readonly reason: RecommendationReason;
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
