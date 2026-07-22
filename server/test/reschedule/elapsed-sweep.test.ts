/**
 * FR-RSC-10 — "The System shall evaluate FR-RSC-01 against EVERY placed, incomplete, flexible
 * occurrence whose window has elapsed **at each point a user's schedule for that date is
 * retrieved.** A background scheduler or timer is permitted but not required."
 *
 * FR-RSC-01 states the condition for a miss but never what observes it, and an unstated
 * mechanism gets decided by whichever module is implemented first — which is how a requirement
 * acquires an accidental design. `sweepElapsed` is that observation, and its verification is
 * quoted verbatim in the requirement: "with the clock advanced past a placed occurrence's
 * window, retrieving the schedule yields the occurrence re-placed and the reason recorded,
 * **with no background process running.**"
 *
 * ⛔ That sentence is why the clock is injected. A test cannot advance a clock the service
 * reads for itself, and a suite that tried would become time-of-day dependent and fail at
 * midnight for reasons nobody will diagnose at 11pm on 30 July.
 */
import {
  DAY,
  at,
  call,
  engineByTask,
  makeHarness,
  placed,
  placement,
  planned,
  scriptedEngine,
  slot,
  task,
  TODAY,
  USER,
} from './support/harness';

const READ = task({
  id: 'read',
  title: 'Read 30 minutes',
  durationMinutes: 30,
  priority: 3,
  preferredWindow: { start: at(20), end: at(20, 30) },
});
const STRETCH = task({
  id: 'stretch',
  title: 'Stretch',
  durationMinutes: 15,
  priority: 4,
  preferredWindow: { start: at(19), end: at(19, 15) },
});
const WALK = task({
  id: 'walk',
  title: 'Evening walk',
  durationMinutes: 20,
  priority: 5,
  preferredWindow: { start: at(21, 30), end: at(21, 50) },
});
const LECTURE = task({
  id: 'lecture',
  title: 'CS 4398 lecture',
  type: 'CLASS',
  durationMinutes: 50,
  priority: 1,
  flexibility: 'FIXED',
  preferredWindow: { start: at(9), end: at(9, 50) },
});

describe('FR-RSC-10 — evaluation happens when the schedule is retrieved', () => {
  it('FR-RSC-10: with the clock advanced past a window, retrieval re-places the occurrence', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 10),
    });
    h.repo
      .addTask(READ)
      .addPlacement(placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) }));

    // Nothing has elapsed yet.
    expect(await h.service.sweepElapsed(USER, TODAY)).toEqual([]);

    h.clock.advanceTo(at(20, 35));
    const outcomes = await h.service.sweepElapsed(USER, TODAY);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.kind).toBe('RESCHEDULED');
    expect(planned(h.repo, 'read')[0]?.start).toBe(at(21, 15));
  });

  it('FR-RSC-10 / FR-RSC-01: the sweep substitutes the elapsed window on the engine call', async () => {
    // The sweep is the path FR-RSC-01 actually fires on in production (FR-RSC-10 runs it on
    // every retrieval), so v2.14's substitution has to hold here and not only on the direct
    // call. Without it the engine rejects every occurrence the sweep finds.
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 35),
    });
    h.repo
      .addTask(READ)
      .addPlacement(placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) }));

    await h.service.sweepElapsed(USER, TODAY);

    expect(call(h.engine, 0).task.preferredWindow).toEqual({ start: at(20, 35), end: DAY.end });
    expect(h.repo.storedTask('read')?.preferredWindow).toEqual({ start: at(20), end: at(20, 30) });
  });

  it('FR-RSC-10: the reason is recorded on retrieval, not merely reported', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 35),
    });
    h.repo
      .addTask(READ)
      .addPlacement(placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) }));

    await h.service.sweepElapsed(USER, TODAY);

    const successor = planned(h.repo, 'read')[0];
    expect(successor?.placementReason.trim().length).toBeGreaterThan(0);
    expect(successor?.rescheduleTrigger).toBe('MISSED');
  });

  it('FR-RSC-10: a retrieval when nothing has elapsed changes nothing', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(19, 59),
    });
    h.repo
      .addTask(READ)
      .addPlacement(placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) }));
    const before = h.repo.snapshot();

    const outcomes = await h.service.sweepElapsed(USER, TODAY);

    expect(outcomes).toEqual([]);
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.snapshot()).toEqual(before);
  });

  it('FR-RSC-10: evaluates EVERY elapsed occurrence, not merely the first one found', async () => {
    const h = makeHarness({
      engine: engineByTask({
        stretch: placed(slot(at(21), at(21, 15), 1)),
        read: placed(slot(at(21, 15), at(21, 45), 1)),
      }),
      now: at(20, 35),
    });
    h.repo.addTask(STRETCH).addTask(READ);
    h.repo
      .addPlacement(placement({ id: 'p-stretch', taskId: 'stretch', start: at(19), end: at(19, 15) }))
      .addPlacement(placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) }));

    const outcomes = await h.service.sweepElapsed(USER, TODAY);

    expect(outcomes.filter((o) => o.kind === 'RESCHEDULED')).toHaveLength(2);
    expect(h.repo.requirePlacement('p-stretch').status).toBe('MISSED');
    expect(h.repo.requirePlacement('p-read').status).toBe('MISSED');
    expect(planned(h.repo, 'stretch')).toHaveLength(1);
    expect(planned(h.repo, 'read')).toHaveLength(1);
  });

  it('FR-RSC-10: leaves an occurrence whose window has not elapsed alone while re-placing one that has', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 35),
    });
    const walkPlacement = placement({
      id: 'p-walk',
      taskId: 'walk',
      start: at(21, 30),
      end: at(21, 50),
    });
    h.repo.addTask(READ).addTask(WALK);
    h.repo
      .addPlacement(placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) }))
      .addPlacement(walkPlacement);

    await h.service.sweepElapsed(USER, TODAY);

    expect(h.repo.requirePlacement('p-walk')).toEqual(walkPlacement);
    expect(h.engine.calls.map((c) => c.task.id)).not.toContain('walk');
  });

  it('FR-RSC-10 / FR-RSC-01: an elapsed FIXED commitment is not swept', async () => {
    const h = makeHarness({ engine: scriptedEngine([]), now: at(20, 35) });
    const lecturePlacement = placement({
      id: 'p-lecture',
      taskId: 'lecture',
      start: at(9),
      end: at(9, 50),
    });
    h.repo.addTask(LECTURE).addPlacement(lecturePlacement);

    expect(await h.service.sweepElapsed(USER, TODAY)).toEqual([]);
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.requirePlacement('p-lecture')).toEqual(lecturePlacement);
  });

  it('FR-RSC-10: sweeps only the requested user schedule', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 35),
    });
    h.repo.addTask(READ, { userId: 'user-2' });
    h.repo.addPlacement(placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) }));

    expect(await h.service.sweepElapsed(USER, TODAY)).toEqual([]);
    expect(h.engine.calls).toHaveLength(0);
  });
});

describe('FR-RSC-10 — no background process is required, and none is created', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('FR-RSC-10: retrieval re-places the occurrence with no timer pending', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 35),
    });
    h.repo
      .addTask(READ)
      .addPlacement(placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) }));

    const outcomes = await h.service.sweepElapsed(USER, TODAY);

    expect(outcomes.filter((o) => o.kind === 'RESCHEDULED')).toHaveLength(1);
    // "with no background process running" — the reschedule is complete when the call returns.
    expect(jest.getTimerCount()).toBe(0);
  });
});
