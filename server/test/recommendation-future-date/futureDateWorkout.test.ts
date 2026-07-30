/**
 * A workout scheduled on a date that is NOT today must be judged "already begun" by its own
 * date, not by the current wall-clock minute alone.
 *
 * FR-REC-07 says a workout whose window has begun is off limits to FR-REC-02's replacement.
 * `RecommendationScheduler.aboveTierWorkout` implemented that as `p.start <= clock.nowMinute()`
 * — a minute-of-day comparison with no reference to `p.date`. So a 07:00 run on TOMORROW's
 * calendar was treated as already begun from 07:01 today onward, and
 * `applyWorkoutRecommendation` threw "no workout above <tier> to replace" for a day whose
 * workout had not started and could not have.
 *
 * This is the same defect shape as OPEN-35, which `RescheduleService` fixed with a date-aware
 * `hasElapsed(date, endMinute)`; this class never got the equivalent guard.
 *
 * NOT part of the frozen packet-17a/17c suites (`server/test/acceptance` at `8809158`,
 * `server/test/replacement` at `47bb301`) — a new, dedicated, unfrozen file, the same shape
 * OPEN-35 and the 28 Jul metric-validation fix used for a bug found after the fact. It imports
 * the frozen acceptance harness rather than duplicating it, so this exercises the REAL engine
 * and the REAL RescheduleService, not a stub that could hide the bug by construction.
 */
import {
  DEMO_DATE,
  at,
  buildAcceptanceStack,
  createFlexibleTask,
  injectedSleepScore,
  metricSet,
  placePlanned,
  placementsOfTask,
  type AcceptanceStack,
} from '../acceptance/support/harness';

/** Sleep of 40 warrants LOW, so a HIGH run is "above tier" and eligible for replacement. */
const POOR_SLEEP = 40;

/** DEMO_DATE is '2026-07-27'; this is the day after it. */
const TOMORROW = '2026-07-28';
const YESTERDAY = '2026-07-26';

/** 07:00–07:45, deliberately EARLIER in the day than the clock's `nowMinute` in every test below. */
const MORNING_RUN = { start: at(7), end: at(7, 45) };

const arrangeHighRun = async (stack: AcceptanceStack, date: string) => {
  await stack.metrics.ingest(
    stack.userId,
    metricSet(date, { sleepScore: injectedSleepScore(POOR_SLEEP) }),
  );
  const run = await createFlexibleTask(stack, {
    title: 'Morning Run',
    type: 'WORKOUT',
    durationMinutes: 45,
    priority: 3,
    preferredWindow: MORNING_RUN,
    intensityTier: 'HIGH',
    date,
  });
  await placePlanned(stack, run, MORNING_RUN, { date });
  return run;
};

describe('RecommendationScheduler — a workout on a date other than today', () => {
  let stack: AcceptanceStack;

  afterEach(async () => {
    await stack.stop();
  });

  it('replaces a FUTURE date\'s morning workout even though its start minute has passed today', async () => {
    // The clock says 18:00 on DEMO_DATE. Tomorrow's 07:00 run has plainly not begun.
    stack = await buildAcceptanceStack({ nowMinute: at(18), date: DEMO_DATE });
    const run = await arrangeHighRun(stack, TOMORROW);

    const result = await stack.scheduler.applyWorkoutRecommendation(stack.userId, TOMORROW);

    expect(result.task.source).toBe('SYSTEM');
    expect(result.task.intensityTier).toBe('LOW');
    expect(result.placement.status).toBe('PLANNED');
    expect(result.placement.date).toBe(TOMORROW);

    // FR-REC-02: the above-tier run is off the calendar, marked SUPERSEDED rather than deleted.
    const rows = await placementsOfTask(stack, run.id, TOMORROW);
    expect(rows.map((p) => p.status)).toEqual(['SUPERSEDED']);
  });

  it('still refuses a workout on TODAY whose window has genuinely begun (FR-REC-07)', async () => {
    // Same 07:00 run, but it really is today and the clock really is past it.
    stack = await buildAcceptanceStack({ nowMinute: at(18), date: DEMO_DATE });
    await arrangeHighRun(stack, DEMO_DATE);

    await expect(
      stack.scheduler.applyWorkoutRecommendation(stack.userId, DEMO_DATE),
    ).rejects.toThrow(/no workout above LOW to replace/);
  });

  it('refuses a workout on a PAST date, whose window has both begun and ended', async () => {
    // 06:00 — earlier than the run's own start minute, so only the DATE can rule it out.
    stack = await buildAcceptanceStack({ nowMinute: at(6), date: DEMO_DATE });
    await arrangeHighRun(stack, YESTERDAY);

    await expect(
      stack.scheduler.applyWorkoutRecommendation(stack.userId, YESTERDAY),
    ).rejects.toThrow(/no workout above LOW to replace/);
  });
});
