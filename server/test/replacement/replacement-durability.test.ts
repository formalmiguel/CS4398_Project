/**
 * 🔴 RED (packet 17c) — OPEN-27: a recommendation-replaced workout must STAY replaced.
 *
 * The load-bearing FR-REC-04 path (17b) turns a recommendation into a task and places it. But
 * FR-REC-02 obliges the System, where a workout is scheduled above the warranted tier, to
 * "automatically REPLACE it with one at the warranted tier and place the replacement using the
 * scheduling engine." A replacement that is silently undone on the next schedule retrieval has
 * not replaced anything — it has merely added a second workout beside the first.
 *
 * THE DEFECT THIS PINS (OPEN-27, decision log 26 Jul): after the above-tier run is replaced, it is
 * left with no `PLANNED` placement, and FR-RSC-05's self-healing re-attempt ("a task with no
 * `PLANNED` placement is re-attempted on every retrieval", SRS §3.8.5 / v2.20 note) re-places it on
 * the next `sweepElapsed` — the replaced run RESURRECTS beside the recovery session, undoing the
 * replacement. A §6 rehearsal driven through the app hits this on the second `GET /schedule`.
 *
 * ORACLE — the SRS, not any implementation body:
 *   - FR-REC-02: the above-tier workout is REPLACED, and the replacement is placed by the engine.
 *   - FR-RSC-05: an unplaced task is re-attempted on every retrieval — the exact mechanism that must
 *     NOT reach the replaced run (otherwise "replace" degrades to "add a second one").
 *   - FR-RSC-06 / NFR-REL-02: rescheduling is idempotent and terminating — firing the retrieval
 *     sweep repeatedly must converge on a stable schedule, so a SECOND sweep must not re-place it
 *     either.
 *
 * MECHANISM-AGNOSTIC (per packet 17c): this test asserts only the OUTCOME — after a replacement,
 * no sweep re-places the replaced workout; only the recovery session stays `PLANNED`. It does NOT
 * assert HOW the fix marks the replaced occurrence (no status name is referenced), so it survives
 * any correct fix.
 *
 * CLEAN ROOM (§4.6): the RED author read the SRS, the contract, the harness and the frozen 17a
 * acceptance suite (all tests) — never the fix. No expected value here is read from an
 * implementation; every assertion cites the requirement it traces to.
 */
import type { IsoDate, Placement, Task } from '@capstone/shared';

import {
  at,
  BASELINE,
  DAY,
  DEMO_DATE,
  buildAcceptanceStack,
  createFlexibleTask,
  injectedActiveCalories,
  injectedSleepScore,
  metricSet,
  placePlanned,
  placementsFor,
  placementsOfTask,
  type AcceptanceStack,
} from '../acceptance/support/harness';

// ─── Arrangement — a scheduled ABOVE-tier run on a day that sleeps poorly ─────────────────────
//
// The minimum the FR-REC-02 replacement needs: a PLANNED HIGH-intensity workout whose window has
// not begun (FR-REC-07), preferred 17:00–18:00, and injected poor-sleep / high-activity metrics so
// the warranted tier is LOW (FR-REC-01: 40 ≤ 49 → LOW) — strictly below HIGH, so the run is
// "scheduled above what the day's sleep score warrants" and FR-REC-02 fires. The day is otherwise
// open, so BOTH the recovery session AND (against the current defect) the resurrected run can find
// a slot — which is what makes the resurrection observable as a real `PLANNED` row rather than an
// unplaceable one.

const SLEEP_POOR = 40; // FR-REC-01: 40 ≤ 49 → LOW.
const CALORIES_ACTIVE = 850; // Present so the demonstration's metric set is complete (FR-WER-07).

/** The pre-existing HIGH-intensity workout, placed in its 17:00–18:00 window. Returns its task. */
const arrangeScheduledHighWorkout = async (stack: AcceptanceStack): Promise<Task> => {
  const run = await createFlexibleTask(stack, {
    title: 'Evening run',
    type: 'WORKOUT',
    durationMinutes: 60,
    priority: 2,
    preferredWindow: { start: at(17), end: at(18) },
    intensityTier: 'HIGH',
  });
  await placePlanned(stack, run, { start: at(17), end: at(18) });
  return run;
};

const injectDemoMetrics = (stack: AcceptanceStack, date: IsoDate = DEMO_DATE): Promise<void> =>
  stack.metrics.ingest(
    stack.userId,
    metricSet(date, {
      sleepScore: injectedSleepScore(SLEEP_POOR),
      activeCalories: injectedActiveCalories(CALORIES_ACTIVE),
    }),
  );

/** The `PLANNED` placements a single task holds on the demo date — the occurrences that "count". */
const plannedOf = async (stack: AcceptanceStack, taskId: string): Promise<readonly Placement[]> => {
  const rows = await placementsOfTask(stack, taskId);
  return rows.filter((p) => p.status === 'PLANNED');
};

/** Every `PLANNED` placement on the demo date, across all tasks. */
const plannedForDay = async (stack: AcceptanceStack): Promise<readonly Placement[]> => {
  const rows = await placementsFor(stack, DEMO_DATE);
  return rows.filter((p) => p.status === 'PLANNED');
};

describe('OPEN-27 — a recommendation-replaced workout stays replaced across a schedule sweep (FR-REC-02)', () => {
  let stack: AcceptanceStack;

  beforeEach(async () => {
    // now = 07:00 (DAY.start): nothing has elapsed. The replaced run's 17:00 window is still ahead,
    // so any re-placement of it (the defect) is an ordinary future placement, not a missed-window
    // artefact — the resurrection is isolated as the ONLY thing a sweep could change.
    stack = await buildAcceptanceStack({ nowMinute: DAY.start, date: DEMO_DATE, baseline: BASELINE });
  });

  afterEach(async () => {
    await stack.stop();
  });

  it('FR-REC-02 + FR-RSC-05/06: after the above-tier run is replaced, no retrieval sweep re-places it — only the recovery session stays PLANNED', async () => {
    const run = await arrangeScheduledHighWorkout(stack);
    await injectDemoMetrics(stack);

    // FR-REC-02 / FR-REC-04: replace the above-tier run with a warranted-tier recovery session,
    // created as a task and placed by the engine.
    const result = await stack.scheduler.applyWorkoutRecommendation(stack.userId, DEMO_DATE);
    const recoveryId = result.task.id;

    // Preconditions the replacement establishes (FR-REC-02 "replace it"): the recovery session is
    // PLANNED, and the replaced run is no longer PLANNED. If these fail the replacement itself
    // didn't happen — a construction problem, not the durability defect.
    expect(await plannedOf(stack, recoveryId)).toHaveLength(1);
    expect(await plannedOf(stack, run.id)).toHaveLength(0);

    // ── The durability property — this is what OPEN-27 breaks ──────────────────────────────────
    //
    // A schedule retrieval runs the sweep (FR-RSC-10). The replacement must survive it: the
    // replaced run must NOT be re-placed, and the recovery session is the sole PLANNED workout.
    const assertReplacementDurable = async (afterWhat: string): Promise<void> => {
      // FR-REC-02: the replaced run stays replaced — it acquires no PLANNED placement.
      expect(await plannedOf(stack, run.id)).toHaveLength(0);
      // Only the recovery session's occurrence is PLANNED (it did not move; now is 07:00).
      const recoveryPlanned = await plannedOf(stack, recoveryId);
      expect(recoveryPlanned).toHaveLength(1);
      // NFR-REL-01: exactly one workout occurrence is planned for the day — the recovery session —
      // never the recovery session AND the resurrected run. Guards the "landing beside it" defect.
      const dayPlanned = await plannedForDay(stack);
      const plannedTaskIds = new Set(dayPlanned.map((p) => p.taskId));
      expect(plannedTaskIds.has(run.id)).toBe(false); // the replaced run is not among the planned
      expect(plannedTaskIds.has(recoveryId)).toBe(true); // ... and the recovery session is
      // Sanity anchor for the failure message.
      expect({ afterWhat, plannedRunOccurrences: (await plannedOf(stack, run.id)).length }).toEqual({
        afterWhat,
        plannedRunOccurrences: 0,
      });
    };

    // Retrieval 1 (FR-RSC-10): the sweep the §6 rehearsal reaches on the second `GET /schedule`.
    await stack.reschedule.sweepElapsed(stack.userId, DEMO_DATE);
    await assertReplacementDurable('the first retrieval sweep');

    // Retrieval 2 (FR-RSC-06 / NFR-REL-02): idempotent and terminating — a second sweep changes
    // nothing and certainly does not re-place the replaced run.
    await stack.reschedule.sweepElapsed(stack.userId, DEMO_DATE);
    await assertReplacementDurable('a second retrieval sweep');
  });
});
