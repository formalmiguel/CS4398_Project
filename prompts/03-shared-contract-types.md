# CRITICAL REQUIREMENTS — 03 The Shared Domain Contract

### MANDATORY DIRECTIVE ###

**⛔ CRITICAL: THIS FILE IS HUMAN-AUTHORED.** It is written by a human, **once, before any agent runs**, and given verbatim to every subsequent prompt.

**MANDATORY**: The contract below is given to you **verbatim. Type it in exactly. Do not improve it, rename anything, add fields, or "clean it up."** It has been derived from the SRS's ERD (§3.5) and class diagram (§3.6) and ratified by the team.

| | |
|---|---|
| **Phase** | **HUMAN-AUTHORED** — an agent transcribes; it does not design |
| **Human owner** | **Patrick Rucker** — ratified by the whole team before this runs |
| **Depends on** | 01 (scaffold) |
| **Spec** | `docs/SRS-v2.md` §3.5 (ERD), §3.6 (class diagram); `CLAUDE.md` §4.7 |

---

## ⛔ **CRITICAL**: Why This File Is Frozen

> **MANDATORY**: The rejected alternative was letting each module's agent define the types it needs. **Three agents produce three locally-reasonable, mutually incompatible `Task` types, each passing its own tests, and day-5 integration becomes a rewrite.**
>
> **CRITICAL: Agents make this worse rather than better, because they generate plausible types faster than a human notices they disagree.**

**MANDATORY**: An agent that wants to change this file **must STOP and escalate.** It is a team decision with a row in `docs/TEAM-MEETING.md`, **not a refactor.**

---

## **MANDATORY**: The Contract — `shared/src/contract.ts`

**Type this file exactly as written.**

```ts
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

/** Minutes since local midnight. 0–1439. */
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

  /** Plain language, for FR-DSH-05. e.g. "4:00 PM — your 2:00 PM slot was taken by CS 401 Lecture." */
  readonly reason: string;
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

// ─── Wearable metrics ────────────────────────────────────────────────────────
//
// One entry per metric, keyed by name — NOT a struct with a sleepScore field and an
// activeCalories field. FR-WER-04 requires adding a metric to be an ADDITION, not a
// modification, and DR/§3.5 requires one ROW per metric per date rather than one COLUMN
// per metric. A `{ sleepScore, activeCalories }` shape would satisfy this release and
// quietly make every future metric a schema migration AND a type change.

export type MetricOrigin = 'EXPORT' | 'LIVE_API' | 'INJECTED';

export interface Metric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;

  /**
   * FR-WER-06: an absent metric and a measured zero are DIFFERENT FACTS and must remain
   * distinguishable at every layer. A rest day with 0 active calories is real data. A watch
   * left on the nightstand is not. Never collapse one into the other.
   */
  readonly isAvailable: boolean;

  readonly origin: MetricOrigin;
}

/** ISO 8601 calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

export interface DailyMetricSet {
  readonly date: IsoDate;
  /** Keyed by metric name. FR-WER-02: the ONLY representation of wearable data downstream. */
  readonly metrics: Readonly<Record<string, Metric>>;
}

// ─── Libraries ───────────────────────────────────────────────────────────────

export type DietaryFlag =
  | 'VEGETARIAN' | 'VEGAN' | 'GLUTEN_FREE' | 'DAIRY_FREE' | 'NUT_FREE';

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
```

### **CRITICAL**: The One Engine Signature

Also in `shared/src/contract.ts`, so that **the type system enforces "exactly one function produces placements"** (FR-RSC-03, NFR-MNT-03):

```ts
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
```

---

## **CRITICAL**: Files You May Create Or Edit

- `shared/src/contract.ts` — **this file only**

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ Everything else.** This packet writes one file.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] **CRITICAL**: `shared/src/contract.ts` matches the above **EXACTLY** — character for character
- [ ] The file contains **types only.** **No logic, no function bodies, no computed constants**
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Every other package can `import` from it
- [ ] **CRITICAL**: A human has read it line by line **with the team** before prompt 04 runs *(`docs/TEAM-MEETING.md` Action Item 4 — "this is the hour that lets us work in parallel")*

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report — do not decide it yourself — if:**

- The contract as given **contradicts** something in the SRS. *(Say which requirement and how. **This is a real possibility and finding one is valuable.**)*
- You believe a field is **missing**. **MANDATORY: Do not add it.** Report it; the team adds it and logs the decision.
- Any instruction here conflicts with `docs/SRS-v2.md`. **The SRS wins**, and the conflict needs recording.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **Time is `Minute`** — an integer, minutes since local midnight. **The engine never sees a `Date`.** **Priority is 1–5, where 1 is HIGHEST.** These conventions are load-bearing: they are why FR-SCH-05's purity is **structural rather than merely intended**, and they kill a whole class of timezone bugs before any code exists.

**CRITICAL**: **Transcribe. Do not design.** If you changed anything, this packet has failed.
