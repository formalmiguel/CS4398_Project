/**
 * OPEN-35 — a date that is no longer today must not keep re-classifying its own occurrences as
 * freshly missed on every retrieval.
 *
 * NOT part of the frozen packet-06 suite (`server/test/reschedule`, sha `c30e784`) — a new,
 * dedicated, unfrozen file, the same shape the 28 Jul metric-validation fix used for a bug found
 * after the fact: a pinning test written and watched to FAIL against the buggy source, then the
 * fix applied. Imports the frozen suite's own harness rather than duplicating it, so this uses
 * the REAL engine (`realEngineSpy`) — the actual integration, not a stub that could paper over
 * the bug by construction.
 */
import {
  DAY,
  TODAY,
  USER,
  at,
  makeHarness,
  placement,
  realEngineSpy,
  task,
} from '../reschedule/support/harness';

describe('OPEN-35 — sweeping a date that is no longer today', () => {
  it('does not keep spawning duplicate MISSED placements on a closed day', async () => {
    const PAST = TODAY; // '2026-07-22' — the date under test
    const NOW_REALITY = '2026-07-24'; // the clock has moved on two days; PAST is now closed

    const h = makeHarness({ engine: realEngineSpy(), now: at(9), today: NOW_REALITY });
    h.repo.setSchedulableDay(USER, PAST, DAY);

    const run = task({
      id: 'run',
      title: 'Morning Run',
      preferredWindow: { start: at(7), end: at(8) },
    });
    h.repo.addTask(run, { dates: [PAST] });
    h.repo.addPlacement(
      placement({ id: 'p-1', taskId: 'run', date: PAST, start: at(7), end: at(7, 45) }),
    );

    // Two retrievals of the SAME closed date — e.g. the month navigator opened twice.
    await h.service.sweepElapsed(USER, PAST);
    await h.service.sweepElapsed(USER, PAST);

    const rows = h.repo.placementsOfTask('run');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('MISSED');
  });

  it('classifies a closed day missed exactly once, not a fresh miss per retrieval', async () => {
    const PAST = TODAY;
    const NOW_REALITY = '2026-07-29';

    const h = makeHarness({ engine: realEngineSpy(), now: at(14), today: NOW_REALITY });
    h.repo.setSchedulableDay(USER, PAST, DAY);

    const lunch = task({
      id: 'lunch',
      title: 'Lunch',
      preferredWindow: { start: at(12), end: at(13) },
    });
    h.repo.addTask(lunch, { dates: [PAST] });
    h.repo.addPlacement(
      placement({ id: 'p-1', taskId: 'lunch', date: PAST, start: at(12), end: at(12, 45) }),
    );

    await h.service.sweepElapsed(USER, PAST);
    await h.service.sweepElapsed(USER, PAST);
    await h.service.sweepElapsed(USER, PAST);

    expect(h.repo.placementsOfTask('lunch')).toHaveLength(1);
  });
});
