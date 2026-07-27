/**
 * 🔴 RED STUB (packet 17a). EVERY method THROWS `Error('17b')`. Packet 17b (a DIFFERENT
 * session) derives the real body from the frozen acceptance suite in
 * `server/test/acceptance/`. This mirrors how packet 06 declared `RescheduleService`, packet 08
 * declared `WearableAdapter`/`MetricStore`, and packet 09 declared `RecommendationEngine` — a
 * SURFACE, not an implementation.
 *
 * ⚠️ THE NAME AND SHAPE ARE A PROPOSAL, NOT A SETTLED FACT — escalated for ratification into
 * §3.6 (see docs/P17A-RED-REPORT.md). §3.6 attaches the two deferred edges
 *   `RecommendationEngine --> SchedulingEngine : places via`
 *   `RecommendationEngine --> Catalog : draws from`
 * to `RecommendationEngine` ITSELF. Packet 10 built `RecommendationEngine` as a CONTENT-AGNOSTIC
 * rule evaluator (exactly `register`/`recommend`, no ports, no state) and explicitly deferred
 * these edges to packet 17 (see that file's class comment). Bolting placement, a `Catalog`, a
 * `TaskRepository`, a `RescheduleService`, and a `Clock` onto it would contradict its packet-10
 * shape AND the frozen packet-09 suite that pins it to `register`/`recommend`. This dedicated
 * collaborator COMPOSES the content-agnostic engine with the scheduling stack instead. **The
 * frozen tests depend on the OBLIGATIONS below, not on this identifier** — the gate may rename
 * the collaborator or fold the method onto `RecommendationEngine` and re-freeze.
 *
 * ⛔ FR-RSC-03 / §4.3: this class MUST NOT find a free gap, merge intervals, rank, choose among
 * candidates, or compute a start time. Where a task goes is the engine's answer, used verbatim —
 * exactly the discipline `RescheduleService` and `app.ts` already hold. It is HANDED the one
 * engine (`FindCandidateSlots`) and the `RescheduleService`; it re-invokes, never re-implements.
 *
 * ⚠️ A stub returns nothing and computes nothing. If a method here draws a workout, creates a
 * task, or persists a placement, it is the IMPLEMENTATION and this packet is compromised (§8.3).
 */
import type {
  FindCandidateSlots,
  IntensityTier,
  IsoDate,
  Placement,
  Recommendation,
  RecommendationReason,
  Task,
  Workout,
} from '@capstone/shared';

import type { Clock } from '../reschedule/RescheduleService';
import { RescheduleService } from '../reschedule/RescheduleService';
import { TaskRepository } from '../db/TaskRepository';
import { MetricStore } from '../db/MetricStore';
import { RecommendationEngine } from './RecommendationEngine';

/**
 * The seam to the workout/meal library (§3.6: `Catalog`). Declared as a TYPE only — exactly like
 * `WearableAdapter` in packet 08 — because the REAL catalog is packet 11 (FR-LIB), not yet
 * merged. The acceptance harness supplies a deterministic double.
 *
 * ⚠️ ESCALATION (see report): §3.6 draws `findWorkouts(tier, prefs, n)` and
 * `findMeals(calorieTarget, prefs)`. `prefs` has no shape in the contract, and the acceptance
 * demonstration exercises no dietary/workout preference (FR-REC-05 is out of scope here). This
 * minimal port omits `prefs` and `findMeals`; packet 11 owns the full signature. Kept small on
 * purpose so the frozen tests do not pin a shape packet 11 must be free to widen.
 */
export interface Catalog {
  /** Up to `count` workouts at the warranted tier (FR-REC-03's "three options"; FR-LIB-05). */
  findWorkouts(tier: IntensityTier, count: number): readonly Workout[];
}

/**
 * What placing a workout recommendation yields, for the acceptance suite to assert against. The
 * fields are the OBLIGATIONS FR-REC-02/03/04 name, not an internal design:
 *   - `task`      the recommendation created AS A TASK (FR-REC-04, FR-TSK-01) — SYSTEM/WORKOUT,
 *                 carrying the warranted `intensityTier` from the `Decision`.
 *   - `placement` that task PLACED BY THE ENGINE onto the real calendar (FR-REC-02, FR-SCH-01),
 *                 status `PLANNED`, thereafter defended by `RescheduleService` with no
 *                 special-casing (FR-REC-04, the identically-to-a-user-task clause).
 *   - `options`   the three warranted-tier choices offered, the System's own placed by default
 *                 (FR-REC-03); `task` is drawn from `options[0]`.
 *   - `reason`    FR-REC-13's machine-readable reason (metric + value) carried through.
 */
export interface WorkoutRecommendationResult {
  readonly task: Task;
  readonly placement: Placement;
  readonly options: readonly Workout[];
  readonly reason: RecommendationReason;
}

export class RecommendationScheduler {
  constructor(
    /** FR-RSC-03: the ONE engine, injected — never re-implemented here. */
    private readonly engine: FindCandidateSlots,
    /** FR-REC-04: so a placed recommendation is defended IDENTICALLY to a user task. */
    private readonly reschedule: RescheduleService,
    /** §3.6 "evaluates": produces the `Recommendation` from the day's metrics (FR-REC-01/08/13). */
    private readonly recommendations: RecommendationEngine,
    /** §3.6 "draws from": the concrete workout at the warranted tier (FR-REC-03). */
    private readonly catalog: Catalog,
    /** FR-WER-07: the injected metrics the recommendation is computed from. */
    private readonly metrics: MetricStore,
    /** Persists the SYSTEM task and reads the calendar back (FR-REC-04, FR-TSK-01). */
    private readonly repo: TaskRepository,
    /** FR-RSC-10: the service is told the time; it never asks. */
    private readonly clock: Clock,
  ) {}

  /**
   * FR-REC-01 / FR-REC-08 / FR-REC-13: the day's recommendations, computed from the metrics
   * injected for `date` (FR-WER-07) via the content-agnostic `RecommendationEngine`. Sleep score
   * → intensity tier; active calories → daily calorie target; each with the reason naming the
   * driving metric and value.
   */
  async recommendationsFor(_userId: string, _date: IsoDate): Promise<readonly Recommendation[]> {
    throw new Error('17b');
  }

  /**
   * FR-REC-02 / FR-REC-03 / FR-REC-04: where a workout is scheduled ABOVE the warranted tier for
   * `date`, replace it with one at the warranted tier — created as a SYSTEM/WORKOUT `Task`, drawn
   * from the `Catalog`, PLACED BY THE ENGINE, and thereafter defended by `RescheduleService`
   * identically to a user task. FR-REC-07's guardrails hold (do not reduce a completed workout;
   * do not replace one whose window has begun).
   */
  async applyWorkoutRecommendation(
    _userId: string,
    _date: IsoDate,
  ): Promise<WorkoutRecommendationResult> {
    throw new Error('17b');
  }
}
