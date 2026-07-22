/**
 * FR-RSC-06 / NFR-REL-02 — rescheduling is IDEMPOTENT and TERMINATING.
 *
 * ⛔ WHAT MAKES TWO TRIGGERS "THE SAME" (SRS v2.13, generalised at v2.14): **a trigger is a
 * no-op when the condition that fires it is no longer true of the stored schedule.**
 * Idempotency is a property of the SCHEDULE, never of a record of past triggers — and the
 * three triggers reach that state by two different routes, **both of which are asserted here**:
 *
 *   • **Missed and skipped** — the trigger acts only on a `PLANNED` occurrence, and handling it
 *     moves that occurrence out of `PLANNED`. A second firing finds nothing to act on.
 *   • **Displaced** — the occurrence STAYS `PLANNED` and is moved in place, so a second firing
 *     for the same commitment finds NO OVERLAP and does nothing.
 *
 * *The second route was missing from the SRS until v2.14: the requirement explained idempotency
 * by a state change displacement does not make, so displacement was idempotent for a reason the
 * document did not give. Found while writing the test that asserts it (E10).*
 *
 * ⛔ **If a test in this file needed a store of processed triggers to pass, it would be
 * asserting the design the SRS rejected** — a second source of truth that FR-RSC-09's
 * cancellation would have to unwind by hand, whose divergence from the schedule is invisible.
 *
 * This matters because FR-RSC-10 re-evaluates on EVERY schedule retrieval. A user refreshing
 * five times fires the missed check five times, and exactly one placement must result.
 *
 * ⛔ TERMINATION NEEDS NO COUNTER AND NO CAP, and no test here asserts one. Writing "at most N
 * reschedules" into a frozen test would CREATE a cap the SRS deliberately refused. What is
 * asserted instead is the property termination actually rests on: each successor starts
 * strictly later than the occurrence it replaced, because the day handed to the engine begins
 * at `now`.
 */
import {
  at,
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
const GYM = task({
  id: 'gym',
  title: 'Gym',
  type: 'WORKOUT',
  durationMinutes: 60,
  priority: 2,
  preferredWindow: { start: at(17), end: at(18) },
});
const ADVISOR = task({
  id: 'advisor',
  title: 'Advisor',
  type: 'MEETING',
  durationMinutes: 45,
  priority: 1,
  flexibility: 'FIXED',
  preferredWindow: { start: at(17), end: at(17, 45) },
});

const ORIGINAL = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });

const missedTwiceHarness = () => {
  const h = makeHarness({
    engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
    now: at(20, 35),
  });
  h.repo.addTask(READ).addPlacement(ORIGINAL);
  return h;
};

describe('FR-RSC-06 — the same trigger processed twice produces one placement', () => {
  it('FR-RSC-06: firing the missed trigger twice creates one successor placement', async () => {
    const h = missedTwiceHarness();

    await h.service.onTaskMissed(ORIGINAL);
    await h.service.onTaskMissed(ORIGINAL);

    expect(planned(h.repo, 'read')).toHaveLength(1);
    expect(h.repo.placementsOfTask('read')).toHaveLength(2); // the MISSED original + one successor
  });

  it('FR-RSC-06: the second firing is a no-op because the occurrence is no longer PLANNED', async () => {
    // NOT because anything remembered the first firing. The schedule carries the fact.
    const h = missedTwiceHarness();

    await h.service.onTaskMissed(ORIGINAL);
    const second = await h.service.onTaskMissed(ORIGINAL);

    expect(second).toEqual({ kind: 'NO_ACTION', taskId: 'read', why: 'NOT_PLANNED' });
    expect(h.repo.requirePlacement('p-read').status).toBe('MISSED');
    expect(h.engine.calls).toHaveLength(1);
  });

  it('FR-RSC-06: the second firing reads the STORED occurrence, not the stale argument', async () => {
    // The caller still holds the PLANNED copy it was handed. Trusting that copy rather than
    // the store is how a second placement gets made while every "idempotent" test still passes.
    const h = missedTwiceHarness();

    await h.service.onTaskMissed(ORIGINAL);
    await h.service.onTaskMissed({ ...ORIGINAL, status: 'PLANNED' });

    expect(planned(h.repo, 'read')).toHaveLength(1);
  });

  it('FR-RSC-06: repeated skip declarations on one occurrence produce one placement', async () => {
    const h = makeHarness({
      engine: engineByTask({ gym: placed(slot(at(20), at(21), 1)) }),
      now: at(15),
    });
    const gymPlacement = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });
    h.repo.addTask(GYM).addPlacement(gymPlacement);

    await h.service.onUserSkipped(gymPlacement);
    const second = await h.service.onUserSkipped(gymPlacement);

    expect(second.kind).toBe('NO_ACTION');
    expect(planned(h.repo, 'gym')).toHaveLength(1);
    expect(h.engine.calls).toHaveLength(1);
  });
});

/**
 * ⛔ The SECOND route to a no-op (v2.14, E10). A displaced occurrence stays `PLANNED`, so
 * "no longer `PLANNED`" cannot be what makes the repeat harmless — **"no longer overlaps" is.**
 * A test that asserted `NOT_PLANNED` here would be asserting the pre-v2.14 rule against the
 * one trigger it was never true of.
 */
describe('FR-RSC-06 — a displaced occurrence is idempotent by no longer overlapping', () => {
  const displacedTwice = () => {
    const h = makeHarness({
      engine: engineByTask({ gym: placed(slot(at(17, 45), at(18, 45), 1)) }),
      now: at(16),
    });
    h.repo.addTask(GYM).addTask(ADVISOR);
    h.repo
      .addPlacement(placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) }))
      .addPlacement(placement({ id: 'p-advisor', taskId: 'advisor', start: at(17), end: at(17, 45) }));
    return h;
  };

  it('FR-RSC-06: adding the same commitment twice moves the occurrence once', async () => {
    const h = displacedTwice();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);
    const second = await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(second).toEqual([]);
    expect(h.engine.calls).toHaveLength(1);
    expect(h.repo.placementsOfTask('gym')).toHaveLength(1);
    expect(h.repo.requirePlacement('p-gym').start).toBe(at(17, 45));
  });

  it('FR-RSC-06: the moved occurrence is still PLANNED — the no-op is the absence of an overlap', async () => {
    const h = displacedTwice();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);
    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(h.repo.requirePlacement('p-gym').status).toBe('PLANNED');
  });

  it('NFR-REL-02: ten firings of the same commitment converge on one stable schedule', async () => {
    const h = displacedTwice();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);
    const afterFirst = h.repo.snapshot();
    for (let i = 0; i < 9; i += 1) await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(h.repo.snapshot()).toEqual(afterFirst);
    expect(h.engine.calls).toHaveLength(1);
  });
});

describe('FR-RSC-06 / NFR-REL-02 — a trigger fired repeatedly converges on a stable schedule', () => {
  it('FR-RSC-06: ten retrievals of the same day yield exactly one successor placement', async () => {
    // FR-RSC-10 runs this on EVERY retrieval. This is the case that matters.
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 35),
    });
    h.repo.addTask(READ).addPlacement(ORIGINAL);

    for (let i = 0; i < 10; i += 1) await h.service.sweepElapsed(USER, TODAY);

    expect(planned(h.repo, 'read')).toHaveLength(1);
    expect(h.repo.placementsOfTask('read')).toHaveLength(2);
  });

  it('NFR-REL-02: the schedule is deep-equal after the second, third and tenth firing', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 35),
    });
    h.repo.addTask(READ).addPlacement(ORIGINAL);

    await h.service.sweepElapsed(USER, TODAY);
    const afterFirst = h.repo.snapshot();
    await h.service.sweepElapsed(USER, TODAY);
    const afterSecond = h.repo.snapshot();
    await h.service.sweepElapsed(USER, TODAY);
    const afterThird = h.repo.snapshot();
    for (let i = 0; i < 7; i += 1) await h.service.sweepElapsed(USER, TODAY);
    const afterTenth = h.repo.snapshot();

    expect(afterSecond).toEqual(afterFirst);
    expect(afterThird).toEqual(afterFirst);
    expect(afterTenth).toEqual(afterFirst);
  });

  it('FR-RSC-06: ten retrievals invoke the engine once — the later nine find nothing to do', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 35),
    });
    h.repo.addTask(READ).addPlacement(ORIGINAL);

    for (let i = 0; i < 10; i += 1) await h.service.sweepElapsed(USER, TODAY);

    expect(h.engine.calls).toHaveLength(1);
  });
});

describe('FR-RSC-06 — one trigger does not cascade, and successors move strictly forward', () => {
  it('FR-RSC-06: one trigger invokes the engine a bounded number of times', async () => {
    // One occurrence, one trigger, one question asked of the engine. A service that re-entered
    // its own sweep after writing the successor would show up here as more.
    const h = missedTwiceHarness();

    await h.service.onTaskMissed(ORIGINAL);

    expect(h.engine.calls).toHaveLength(1);
  });

  it('FR-RSC-06: the successor starts strictly later than the occurrence it replaced', async () => {
    // This is the property termination rests on: the day handed to the engine begins at `now`,
    // so the sequence is strictly increasing and bounded by the end of the day.
    const h = missedTwiceHarness();

    const outcome = await h.service.onTaskMissed(ORIGINAL);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.placement.start).toBeGreaterThan(ORIGINAL.start);
    expect(outcome.placement.start).toBeGreaterThanOrEqual(at(20, 35));
  });

  it('FR-RSC-06: a chain of misses moves strictly forward and comes to a stop', async () => {
    // The successor is itself missed, and its successor after that. Each starts later than the
    // one before, and when the day runs out FR-RSC-05 ends the chain rather than a counter.
    const h = makeHarness({
      engine: scriptedEngine([
        placed(slot(at(21, 15), at(21, 45), 1)),
        placed(slot(at(22, 15), at(22, 45), 1)),
      ]),
      now: at(20, 35),
    });
    h.repo.addTask(READ).addPlacement(ORIGINAL);

    const first = await h.service.onTaskMissed(ORIGINAL);
    if (first.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    h.clock.advanceTo(at(21, 50));
    const second = await h.service.onTaskMissed(first.placement);
    if (second.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    h.clock.advanceTo(at(22, 50));
    const third = await h.service.onTaskMissed(second.placement);

    expect(second.placement.start).toBeGreaterThan(first.placement.start);
    expect(third.kind).toBe('UNPLACEABLE'); // the day ran out; FR-RSC-05 takes over
    expect(planned(h.repo, 'read')).toHaveLength(0);
  });
});
