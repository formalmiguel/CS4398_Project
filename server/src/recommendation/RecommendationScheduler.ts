/**
 * 🟢 GREEN (packet 17b). The FR-REC-04 wiring: a recommendation becomes a real task on the real
 * calendar, placed by the same engine and defended by the same rescheduling as any user task.
 * Derived from the frozen acceptance suite in `server/test/acceptance/` (§6 + Appendix A). The
 * surface — the class name, the constructor, the two method signatures, the `Catalog` port and
 * `WorkoutRecommendationResult` — is packet 17a's and was ratified into SRS §3.6 at v2.27
 * (`RecommendationScheduler --> RecommendationEngine : gets decisions from`, `--> Catalog : draws
 * from`, `--> SchedulingEngine : places via`, `--> RescheduleService : defends placement via`).
 *
 * ⛔ FR-RSC-03 / §4.3: this class does not find a free gap, merge intervals, rank, or compute a
 * start time. Where the recovery session goes is `findCandidateSlots`'s answer, used verbatim —
 * the injected engine, re-invoked, exactly as `RescheduleService` re-invokes it. The three things
 * this class contributes to that call are the busy set, the derived task, and the shape of the day.
 *
 * ⛔ The placement it writes is an ORDINARY `PLANNED` row with no `rescheduleTrigger` (a first
 * placement is not a reschedule — DR-06). Nothing here special-cases a SYSTEM task: the defence
 * "identically to a user task" (FR-REC-04) is not code here, it is the ABSENCE of code — the row
 * lands in the same store `RescheduleService.onCommitmentAdded`/`sweepElapsed` already read, so a
 * commitment dropped on it re-places it through the same path a user task takes (the acceptance
 * suite proves this by calling `stack.reschedule` directly against the row this class wrote).
 */
import type {
  FindCandidateSlots,
  IntensityTier,
  Interval,
  IsoDate,
  Placement,
  PlacementStatus,
  Recommendation,
  RecommendationReason,
  Task,
  Workout,
} from '@capstone/shared';

import type { Clock } from '../reschedule/RescheduleService';
import { RescheduleService } from '../reschedule/RescheduleService';
import { clockLabel } from '../reschedule/reasons';
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

/** FR-REC-03 offers three options at the warranted tier. */
const OPTIONS_OFFERED = 3;

/** LOW < MODERATE < HIGH, so "above the warranted tier" is a comparison, not a table. */
const TIER_RANK: Readonly<Record<IntensityTier, number>> = { LOW: 0, MODERATE: 1, HIGH: 2 };

/** A placement occupies time only while PLANNED or COMPLETED (mirrors `RescheduleService`). */
const OCCUPIES_TIME: readonly PlacementStatus[] = ['PLANNED', 'COMPLETED'];

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
   * driving metric and value. This class only READS the metrics and hands them to the engine —
   * the availability check, the fallback, and the reason are the `RecommendationEngine`'s (FR-REC-06/13).
   */
  async recommendationsFor(userId: string, date: IsoDate): Promise<readonly Recommendation[]> {
    const metrics = await this.metrics.getDailyMetricSet(userId, date);
    return this.recommendations.recommend(metrics);
  }

  /**
   * FR-REC-02 / FR-REC-03 / FR-REC-04: where a workout is scheduled ABOVE the warranted tier for
   * `date`, replace it with one at the warranted tier — created as a SYSTEM/WORKOUT `Task`, drawn
   * from the `Catalog`, PLACED BY THE ENGINE, and thereafter defended by `RescheduleService`
   * identically to a user task. FR-REC-07's guardrails hold (do not reduce a completed workout;
   * do not replace one whose window has begun).
   */
  async applyWorkoutRecommendation(
    userId: string,
    date: IsoDate,
  ): Promise<WorkoutRecommendationResult> {
    // Step 1 — the warranted intensity tier and FR-REC-13's reason. `RecommendationEngine` always
    // returns a WORKOUT_INTENSITY decision (a fallback of MODERATE where sleep is unavailable —
    // FR-REC-06), so `warranted` and `reason` are always defined.
    const metrics = await this.metrics.getDailyMetricSet(userId, date);
    const recs = this.recommendations.recommend(metrics);
    const workoutRec = recs.find((r) => r.decision.kind === 'WORKOUT_INTENSITY');
    if (workoutRec === undefined || workoutRec.decision.kind !== 'WORKOUT_INTENSITY') {
      throw new Error('applyWorkoutRecommendation: no workout-intensity recommendation for the day');
    }
    const warranted = workoutRec.decision.tier;
    const reason = workoutRec.reason;

    // Step 2 — the workout scheduled ABOVE the warranted tier (FR-REC-02), whose window has not
    // begun and which is not complete (FR-REC-07). A PLANNED placement whose task is a WORKOUT at
    // a strictly higher tier.
    const replaced = await this.aboveTierWorkout(userId, date, warranted);
    if (replaced === undefined) {
      throw new Error(
        `applyWorkoutRecommendation: no workout above ${warranted} to replace on ${date}`,
      );
    }

    // Step 3 — three options at the warranted tier, drawn from the library; the System's own is
    // options[0], placed by default (FR-REC-03). The user may later select another (FR-REC-03,
    // NFR-USE-04) — that is a re-placement of options[0]'s slot, not this method's concern.
    const options = this.catalog.findWorkouts(warranted, OPTIONS_OFFERED);
    const chosen = options[0];
    if (chosen === undefined) {
      throw new Error(`applyWorkoutRecommendation: catalog offered no ${warranted} workout`);
    }

    // Step 4 — the recommendation created AS A TASK (FR-REC-04, FR-TSK-01): SYSTEM-authored, a
    // WORKOUT, at the warranted tier, FLEXIBLE so the same rescheduling that moves any user task
    // can move it. It inherits the replaced run's window and duration, which is what makes the
    // recovery session land where the run was (Appendix A's exact-fit 17:00–18:00).
    const task = await this.repo.createTask({
      userId,
      intendedDate: date,
      title: chosen.name,
      type: 'WORKOUT',
      durationMinutes: replaced.task.durationMinutes,
      priority: replaced.task.priority,
      preferredWindow: replaced.task.preferredWindow,
      flexibility: 'FLEXIBLE',
      source: 'SYSTEM',
      intensityTier: warranted,
    });

    // Step 5 — vacate the replaced occurrence. FR-REC-02 "replace" means the above-tier run is no
    // longer on the calendar: marked CANCELLED, not deleted, so it stays distinguishable from one
    // that never happened (DR-06) and drops out of every busy set (CANCELLED is not OCCUPIES_TIME).
    await this.repo.savePlacement({ ...replaced.placement, status: 'CANCELLED' });

    // Step 6 — PLACED BY THE ENGINE (FR-REC-02, FR-SCH-01, FR-RSC-03). The busy set is read AFTER
    // the vacate, so the run's old slot is free; the engine's answer is used verbatim.
    const slot = await this.placeViaEngine(userId, date, task);

    const placement: Placement = {
      id: this.repo.nextPlacementId(),
      taskId: task.id,
      date,
      start: slot.start,
      end: slot.end,
      status: 'PLANNED',
      placementReason:
        `"${task.title}" placed at ${clockLabel(slot.start)} — ` +
        `a lower-intensity recovery session the System recommended for today.`,
    };
    await this.repo.savePlacement(placement);

    return { task, placement, options, reason };
  }

  /**
   * The first PLANNED occurrence on `date` whose task is a WORKOUT at a tier strictly above the
   * warranted one, whose window has not yet begun (FR-REC-07). A read and a comparison — it
   * chooses nothing about placement.
   */
  private async aboveTierWorkout(
    userId: string,
    date: IsoDate,
    warranted: IntensityTier,
  ): Promise<{ task: Task; placement: Placement } | undefined> {
    const now = this.clock.nowMinute();
    const placements = await this.repo.placementsForDate(userId, date);
    for (const p of placements) {
      // FR-REC-07: a completed or already-begun workout is off limits. Only a PLANNED placement
      // whose window is still ahead of `now` is eligible.
      if (p.status !== 'PLANNED' || p.start <= now) continue;
      const task = await this.repo.getTask(p.taskId);
      if (task === undefined || task.type !== 'WORKOUT' || task.intensityTier === undefined) continue;
      if (TIER_RANK[task.intensityTier] <= TIER_RANK[warranted]) continue;
      return { task, placement: p };
    }
    return undefined;
  }

  /**
   * ⛔ THE ONE ENGINE CALL. The recovery task is placed by `findCandidateSlots` (injected), used
   * verbatim (FR-RSC-03) — this method asks where the task fits and takes the rank-1 answer; it
   * computes no time. The busy set is every occupying placement on the day (the vacated run is
   * already CANCELLED, so it is not among them).
   */
  private async placeViaEngine(
    userId: string,
    date: IsoDate,
    task: Task,
  ): Promise<{ start: number; end: number }> {
    const day = await this.repo.schedulableDay(userId, date);
    const placements = await this.repo.placementsForDate(userId, date);
    const busy: Interval[] = placements
      .filter((p) => OCCUPIES_TIME.includes(p.status))
      .map((p) => ({ start: p.start, end: p.end }));

    const result = this.engine(busy, task, day);
    if (!result.placed) {
      throw new Error(`applyWorkoutRecommendation: engine could not place the recovery session (${result.reason})`);
    }
    const best = result.slots[0];
    if (best === undefined) {
      throw new Error('applyWorkoutRecommendation: engine returned placed: true with no slots');
    }
    return { start: best.start, end: best.end };
  }
}
