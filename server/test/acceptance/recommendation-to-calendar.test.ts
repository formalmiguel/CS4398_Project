/**
 * 🔴 RED (packet 17a) — the §6 acceptance demonstration, end to end, offline, and the load-bearing
 * FR-REC-04. Every test here FAILS because `RecommendationScheduler` (the packet-17b wiring) throws
 * `Error('17b')`. The verification stack around it — the real `findCandidateSlots`, the real
 * `RescheduleService`, the real `RecommendationEngine` + rules — is the frozen, green code; the ONE
 * thing missing is the wiring that turns a recommendation into a placed, defended task.
 *
 * ORACLE: `docs/SRS-v2.md` §6 (the demonstration sequence) and Appendix A (the worked numbers).
 * Nothing here reads an implementation body to decide an expected value.
 *
 * WHAT IS EXACT vs. PROPERTY (see docs/P17A-RED-REPORT.md):
 *   EXACT (the SRS pins the number): tier `LOW` (FR-REC-01, sleep 40), target `2850` (FR-REC-08,
 *     2000 + 850), and Appendix A's 17:00–18:00 first placement → 17:45–18:45 after a 17:00–17:45
 *     commitment.
 *   PROPERTY (the SRS names the fact, not the minute): which row carries which status/trigger, a
 *     placement exists and lies within the day, non-overlap, an interval is freed. Each such
 *     assertion cites the requirement it traces to.
 */
import type { IsoDate, Placement, Task } from '@capstone/shared';

import {
  at,
  BASELINE,
  DAY,
  DEMO_DATE,
  buildAcceptanceStack,
  createFixedCommitment,
  createFlexibleTask,
  injectedActiveCalories,
  injectedSleepScore,
  metricSet,
  placePlanned,
  placementsOfTask,
  type AcceptanceStack,
} from './support/harness';

// ─── Shared arrangement — Appendix A's day, with a scheduled HIGH-intensity run ───────────────
//
// Reproduces Appendix A's busy set EXACTLY, so the re-placement number (17:45) is the SRS's, not
// this test's. The "scheduled high-intensity run" of §6 is a HIGH WORKOUT preferred 17:00–18:00.

const SLEEP_POOR = 40; // FR-REC-01: 40 ≤ 49 → LOW.
const CALORIES_ACTIVE = 850; // FR-REC-08: 2000 + 850 → 2850.

/** Persist Appendix A's fixed commitments and the placed flexible Lunch. */
const arrangeAppendixADay = async (stack: AcceptanceStack): Promise<void> => {
  const lecture = await createFixedCommitment(stack, {
    title: 'CS 401 Lecture',
    type: 'CLASS',
    window: { start: at(9), end: at(10, 15) },
  });
  await placePlanned(stack, lecture, { start: at(9), end: at(10, 15) });

  const lunch = await createFlexibleTask(stack, {
    title: 'Lunch',
    type: 'MEAL',
    durationMinutes: 30,
    priority: 2,
    preferredWindow: { start: at(12), end: at(12, 30) },
  });
  await placePlanned(stack, lunch, { start: at(12), end: at(12, 30) });

  const lab = await createFixedCommitment(stack, {
    title: 'Lab',
    type: 'CLASS',
    window: { start: at(14), end: at(16) },
  });
  await placePlanned(stack, lab, { start: at(14), end: at(16) });

  const meeting = await createFixedCommitment(stack, {
    title: 'Team Meeting',
    type: 'MEETING',
    window: { start: at(19), end: at(20) },
  });
  await placePlanned(stack, meeting, { start: at(19), end: at(20) });
};

/** The pre-existing HIGH-intensity workout §6 says is "scheduled", placed in its 17:00–18:00 window. */
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

/** Inject today's poor-sleep / high-activity metrics (FR-WER-07 — the demonstration path). */
const injectDemoMetrics = (stack: AcceptanceStack, date: IsoDate = DEMO_DATE): Promise<void> =>
  stack.metrics.ingest(
    stack.userId,
    metricSet(date, {
      sleepScore: injectedSleepScore(SLEEP_POOR),
      activeCalories: injectedActiveCalories(CALORIES_ACTIVE),
    }),
  );

describe('§6 acceptance demonstration — wearable data changes the real calendar (FR-REC-04)', () => {
  let stack: AcceptanceStack;

  beforeEach(async () => {
    stack = await buildAcceptanceStack({ nowMinute: DAY.start, date: DEMO_DATE, baseline: BASELINE });
  });

  afterEach(async () => {
    await stack.stop();
  });

  // ── Step 1 — the recommendation itself (SRS-pinned numbers) ────────────────────────────────

  it('FR-REC-01/FR-REC-08/FR-REC-13: injected sleep 40 → LOW tier and 850 active cal → 2850 target, each reason naming its metric', async () => {
    await injectDemoMetrics(stack);

    const recs = await stack.scheduler.recommendationsFor(stack.userId, DEMO_DATE);

    const workoutRec = recs.find((r) => r.decision.kind === 'WORKOUT_INTENSITY');
    const calorieRec = recs.find((r) => r.decision.kind === 'CALORIE_TARGET');

    // EXACT — FR-REC-01 pins the tier boundary (40 ≤ 49 → LOW); FR-REC-08 pins 2000 + 850.
    expect(workoutRec?.decision).toEqual({ kind: 'WORKOUT_INTENSITY', tier: 'LOW' });
    expect(calorieRec?.decision).toEqual({ kind: 'CALORIE_TARGET', calorieTarget: 2850 });

    // FR-REC-13: the reason names the metric AND the value that drove it.
    expect(workoutRec?.reason).toEqual({ metricName: 'sleepScore', metricValue: 40, usedFallback: false });
    expect(calorieRec?.reason).toEqual({ metricName: 'activeCalories', metricValue: 850, usedFallback: false });
  });

  // ── Step 2 — replacement created as a task and placed by the engine ────────────────────────

  it('FR-REC-02/FR-REC-03/FR-REC-04/FR-SCH-01: the scheduled HIGH run is replaced by a LOW recovery session, created SYSTEM/WORKOUT and placed by the engine, offering three options', async () => {
    await arrangeAppendixADay(stack);
    await arrangeScheduledHighWorkout(stack);
    await injectDemoMetrics(stack);

    const result = await stack.scheduler.applyWorkoutRecommendation(stack.userId, DEMO_DATE);

    // FR-REC-04 / FR-TSK-01: a recommendation becomes a TASK — SYSTEM-authored, a WORKOUT, at the
    // warranted (LOW) tier the Decision carried.
    expect(result.task.source).toBe('SYSTEM');
    expect(result.task.type).toBe('WORKOUT');
    expect(result.task.intensityTier).toBe('LOW');

    // FR-REC-02 / FR-SCH-01: it is PLACED BY THE ENGINE onto the real calendar — a PLANNED
    // placement exists, within the schedulable day. (Property: the minute is not SRS-pinned here.)
    expect(result.placement.status).toBe('PLANNED');
    expect(result.placement.start).toBeGreaterThanOrEqual(DAY.start);
    expect(result.placement.end).toBeLessThanOrEqual(DAY.end);

    const stored = await placementsOfTask(stack, result.task.id);
    expect(stored.some((p) => p.id === result.placement.id && p.status === 'PLANNED')).toBe(true);

    // FR-REC-03: three options at the warranted tier, the System's own placed by default.
    expect(result.options).toHaveLength(3);
    expect(result.options.every((w) => w.intensityTier === 'LOW')).toBe(true);
  });

  // ── Step 3 — FR-REC-04's OWN verification clause: displacement re-places it via FR-RSC-02 ────
  //
  // THIS is the assertion FR-REC-04 names explicitly — "adding a conflicting commitment over a
  // recommended workout and asserting it is re-placed by FR-RSC-02." Appendix A pins the numbers.

  it('FR-REC-04: a fixed commitment dropped on the recommended recovery session re-places it via the same engine (FR-RSC-02), 17:00–18:00 → 17:45', async () => {
    await arrangeAppendixADay(stack);
    await arrangeScheduledHighWorkout(stack);
    await injectDemoMetrics(stack);

    // The recovery session is placed by the engine into the replaced run's 17:00–18:00 window
    // (Appendix A's exact-fit first placement).
    const result = await stack.scheduler.applyWorkoutRecommendation(stack.userId, DEMO_DATE);
    expect(result.placement.start).toBe(at(17)); // EXACT — Appendix A first placement.
    expect(result.placement.end).toBe(at(18));

    // Drop "Advisor, 17:00–17:45" on it — a FIXED commitment. §3.4: insert the commitment, then
    // re-place the flexible task it overlaps.
    const advisor = await createFixedCommitment(stack, {
      title: 'Advisor',
      type: 'MEETING',
      window: { start: at(17), end: at(17, 45) },
    });
    await placePlanned(stack, advisor, { start: at(17), end: at(17, 45) });

    const outcomes = await stack.reschedule.onCommitmentAdded(advisor, DEMO_DATE);

    // FR-RSC-02: the recovery task is re-placed; the commitment never moves.
    expect(outcomes.some((o) => o.kind === 'RESCHEDULED' && o.taskId === result.task.id)).toBe(true);

    const rows = await placementsOfTask(stack, result.task.id);
    // FR-RSC-02 note: moved IN PLACE — same row, still PLANNED, DISPLACED, no successor.
    expect(rows).toHaveLength(1);
    const moved = rows[0] as Placement;
    expect(moved.status).toBe('PLANNED');
    expect(moved.rescheduleTrigger).toBe('DISPLACED');
    // EXACT — Appendix A: commitment 17:00–17:45 over the 17:00–18:00 session → re-placed 17:45.
    expect(moved.start).toBe(at(17, 45));
    expect(moved.end).toBe(at(18, 45));
    // FR-SCH-04: the new position does not overlap the immovable commitment.
    expect(moved.start).toBeGreaterThanOrEqual(at(17, 45));
    // FR-DSH-05: the stored reason names the commitment responsible, in plain language.
    expect(moved.placementReason).toContain('Advisor');
  });

  // ── Step 4 — skip the re-placed session; it moves again, same engine, a different trigger ───

  it('FR-RSC-08: declaring the re-placed recovery session skipped moves it again — original stays SKIPPED, a new successor is PLANNED (the same engine, a user trigger)', async () => {
    await arrangeAppendixADay(stack);
    await arrangeScheduledHighWorkout(stack);
    await injectDemoMetrics(stack);

    const result = await stack.scheduler.applyWorkoutRecommendation(stack.userId, DEMO_DATE);

    // Displace it first, so this is genuinely "the re-placed session" of §6's step 4.
    const advisor = await createFixedCommitment(stack, {
      title: 'Advisor',
      type: 'MEETING',
      window: { start: at(17), end: at(17, 45) },
    });
    await placePlanned(stack, advisor, { start: at(17), end: at(17, 45) });
    await stack.reschedule.onCommitmentAdded(advisor, DEMO_DATE);

    const displaced = (await placementsOfTask(stack, result.task.id))[0] as Placement;

    // Now the user skips it (before its window elapses — now is 07:00).
    const outcome = await stack.reschedule.onUserSkipped(displaced);
    expect(outcome.kind).toBe('RESCHEDULED');

    const rows = await placementsOfTask(stack, result.task.id);
    // FR-RSC-08 note: the original row is kept SKIPPED; a NEW successor is created.
    const skipped = rows.filter((p) => p.status === 'SKIPPED');
    const planned = rows.filter((p) => p.status === 'PLANNED');
    expect(skipped).toHaveLength(1);
    expect(planned).toHaveLength(1);
    // Property (FR-RSC-08 / FR-SCH): the successor is a DISTINCT placement, placed within the day.
    expect((planned[0] as Placement).id).not.toBe((skipped[0] as Placement).id);
    expect((planned[0] as Placement).start).toBeGreaterThanOrEqual(DAY.start);
    expect((planned[0] as Placement).end).toBeLessThanOrEqual(DAY.end);
  });

  // ── Step 5 — mark the original complete; the System withdraws its OWN reschedule ────────────
  //
  // ⚠️ ESCALATION (docs/P17A-RED-REPORT.md): §6's narrative chains "skip … then mark it complete
  // and observe the System withdraw its own reschedule." FR-RSC-09 and its v2.14 scope note
  // restrict the complete-to-withdraw REMEDY to the MISSED classification — completing a skipped
  // or displaced occurrence is ORDINARY completion (cancelled = null). So the withdrawal step is
  // exercised against a MISSED reschedule (a miss inferred by advancing the clock past the
  // window), which is the only trigger FR-RSC-09 covers. The §6/FR-RSC-09 tension is reported.

  it('FR-RSC-09: after the recovery session is auto-rescheduled by a MISS, marking the original complete withdraws the reschedule (successor CANCELLED, interval freed) and states so', async () => {
    await arrangeScheduledHighWorkout(stack);
    await injectDemoMetrics(stack);

    const result = await stack.scheduler.applyWorkoutRecommendation(stack.userId, DEMO_DATE);
    const original = result.placement; // placed 17:00–18:00.

    // Advance past the window; retrieving the schedule infers the miss and reschedules (FR-RSC-10).
    stack.clock.advanceTo(at(18, 1));
    await stack.reschedule.sweepElapsed(stack.userId, DEMO_DATE);

    const afterMiss = await placementsOfTask(stack, result.task.id);
    expect(afterMiss.some((p) => p.status === 'MISSED')).toBe(true);
    expect(afterMiss.some((p) => p.status === 'PLANNED')).toBe(true);

    // The user marks the ORIGINAL complete — it was done, just not tapped.
    const completion = await stack.reschedule.onCompletionRecorded(original);

    // FR-RSC-09: the reschedule is cancelled, its interval freed, the occurrence completed, and a
    // statement says so.
    expect(completion.completed.status).toBe('COMPLETED');
    expect(completion.cancelled?.status).toBe('CANCELLED');
    expect(completion.statement.length).toBeGreaterThan(0);

    // "Free the interval it held" — no PLANNED successor keeps occupying time after the withdrawal.
    const afterComplete = await placementsOfTask(stack, result.task.id);
    expect(afterComplete.some((p) => p.status === 'PLANNED')).toBe(false);
  });
});
