/**
 * FR-RSC-07 — "A task the user has marked complete shall NEVER be rescheduled."
 * FR-RSC-09 — the correction path: marking the ORIGINAL complete cancels the reschedule.
 *
 * "Never" is a quantifier, and these tests behave like one: FR-RSC-07 is asserted across every
 * trigger and through a sweep, not on one convenient path.
 *
 * FR-RSC-09 carries FIVE obligations in one sentence, and they are asserted separately because
 * an implementation can satisfy four of them and look finished:
 *
 *   1. cancel the reschedule
 *   2. withdraw the later placement
 *   3. FREE THE INTERVAL IT HELD          ← the one an implementation forgets
 *   4. record the occurrence as completed
 *   5. state that it has done so
 *
 * DR-06 adds a sixth thing to check: the cancelled placement stays DISTINGUISHABLE from one
 * that never happened — `CANCELLED`, never deleted — and a later sweep must not resurrect it.
 * That last interaction, between FR-RSC-09 and FR-RSC-10, is what a naive sweep gets wrong.
 *
 * ⛔ SCOPED TO THE MISSED CLASSIFICATION (SRS v2.14, closing E6). **No test here asks the
 * System to withdraw a placement that a skip or a displacement produced**, and two tests assert
 * that it does not: a miss is inferred from silence and can be wrong with nobody having said
 * anything, while a skip and a displacement are events the user witnessed. The correction
 * exists because the System guessed, not because the schedule changed.
 */
import {
  at,
  busyContains,
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

const completedPlacement = placement({
  id: 'p-read',
  taskId: 'read',
  start: at(20),
  end: at(20, 30),
  status: 'COMPLETED',
});

// ─── FR-RSC-07 — never, on any path ─────────────────────────────────────────

describe('FR-RSC-07 — a completed task is never rescheduled', () => {
  it('FR-RSC-07: the missed trigger does not reschedule a completed occurrence', async () => {
    const h = makeHarness({
      engine: scriptedEngine([placed(slot(at(21, 15), at(21, 45), 1))]),
      now: at(22),
    });
    h.repo.addTask(READ).addPlacement(completedPlacement);
    const before = h.repo.snapshot();

    const outcome = await h.service.onTaskMissed(completedPlacement);

    expect(outcome).toEqual({ kind: 'NO_ACTION', taskId: 'read', why: 'ALREADY_COMPLETE' });
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.snapshot()).toEqual(before);
  });

  it('FR-RSC-07: a skip declared on a completed occurrence is rejected', async () => {
    // UC-13: "The occurrence is already complete → the skip is rejected."
    const h = makeHarness({
      engine: scriptedEngine([placed(slot(at(21, 15), at(21, 45), 1))]),
      now: at(20),
    });
    h.repo.addTask(READ).addPlacement(completedPlacement);
    const before = h.repo.snapshot();

    const outcome = await h.service.onUserSkipped(completedPlacement);

    expect(outcome).toEqual({ kind: 'NO_ACTION', taskId: 'read', why: 'ALREADY_COMPLETE' });
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.snapshot()).toEqual(before);
  });

  it('FR-RSC-07: a new commitment does not displace a completed occurrence', async () => {
    const h = makeHarness({ engine: scriptedEngine([placed(slot(at(19), at(20), 1))]), now: at(16) });
    const completedGym = placement({
      id: 'p-gym',
      taskId: 'gym',
      start: at(17),
      end: at(18),
      status: 'COMPLETED',
    });
    h.repo.addTask(GYM).addTask(ADVISOR);
    h.repo
      .addPlacement(completedGym)
      .addPlacement(placement({ id: 'p-advisor', taskId: 'advisor', start: at(17), end: at(17, 45) }));
    const before = h.repo.snapshot();

    const outcomes = await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(outcomes.filter((o) => o.kind === 'RESCHEDULED')).toHaveLength(0);
    expect(h.engine.calls.map((c) => c.task.id)).not.toContain('gym');
    expect(h.repo.snapshot()).toEqual(before);
  });

  it('FR-RSC-07: editing a task does not re-place a completed occurrence', async () => {
    // The fourth trigger (FR-TSK-04, SRS v2.15). "Never" is a quantifier, so it has to cover
    // the trigger added last as well as the three that were here first — and this is the path
    // where forgetting it is easiest, because an edit feels like the user's own instruction.
    const h = makeHarness({
      engine: scriptedEngine([placed(slot(at(21, 15), at(21, 45), 1))]),
      now: at(20),
    });
    h.repo.addTask(READ).addPlacement(completedPlacement);
    const before = h.repo.snapshot();

    const outcome = await h.service.onTaskEdited(
      task({
        id: 'read',
        title: 'Read 30 minutes',
        durationMinutes: 90, // long enough that the placement would otherwise be invalidated
        priority: 3,
        preferredWindow: { start: at(20), end: at(22) },
      }),
      TODAY,
    );

    expect(outcome).toEqual({ kind: 'NO_ACTION', taskId: 'read', why: 'ALREADY_COMPLETE' });
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.snapshot()).toEqual(before);
  });

  it('FR-RSC-07: a sweep does not reschedule a completed occurrence whose window has elapsed', async () => {
    const h = makeHarness({
      engine: scriptedEngine([placed(slot(at(21, 15), at(21, 45), 1))]),
      now: at(22),
    });
    h.repo.addTask(READ).addPlacement(completedPlacement);
    const before = h.repo.snapshot();

    const outcomes = await h.service.sweepElapsed(USER, TODAY);

    expect(outcomes.filter((o) => o.kind === 'RESCHEDULED')).toHaveLength(0);
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.snapshot()).toEqual(before);
  });

  it('FR-RSC-07: an occurrence completed AFTER being re-placed is not rescheduled again', async () => {
    const h = makeHarness({
      engine: scriptedEngine([placed(slot(at(21, 15), at(21, 45), 1))]),
      now: at(20, 35),
    });
    const original = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });
    h.repo.addTask(READ).addPlacement(original);
    const rescheduled = await h.service.onTaskMissed(original);
    if (rescheduled.kind !== 'RESCHEDULED') throw new Error('not rescheduled');

    // The user does the 21:15 session and marks THAT one complete.
    await h.service.onCompletionRecorded(rescheduled.placement);
    h.clock.advanceTo(at(22));
    const outcomes = await h.service.sweepElapsed(USER, TODAY);

    expect(outcomes.filter((o) => o.kind === 'RESCHEDULED')).toHaveLength(0);
    expect(h.engine.calls).toHaveLength(1);
  });
});

// ─── FR-RSC-09 — the five obligations, one at a time ────────────────────────

/**
 * The set-up shared by the FR-RSC-09 tests: "Read 30 minutes" was missed at 20:30, the System
 * automatically re-placed it at 21:15 — and the user then says they read it after all.
 */
const afterAutomaticReschedule = async () => {
  const h = makeHarness({
    engine: engineByTask({
      read: placed(slot(at(21, 15), at(21, 45), 1)),
      gym: placed(slot(at(21, 15), at(22, 15), 1)),
    }),
    now: at(20, 35),
  });
  const original = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });
  h.repo.addTask(READ).addPlacement(original);
  const outcome = await h.service.onTaskMissed(original);
  if (outcome.kind !== 'RESCHEDULED') throw new Error('set-up did not reschedule');
  return { h, original, successor: outcome.placement };
};

describe('FR-RSC-09 — marking the original complete cancels the reschedule', () => {
  it('FR-RSC-09: cancels the reschedule', async () => {
    const { h, original } = await afterAutomaticReschedule();

    const result = await h.service.onCompletionRecorded(original);

    expect(result.cancelled).not.toBeNull();
    expect(result.cancelled?.status).toBe('CANCELLED');
  });

  it('FR-RSC-09: withdraws the later placement', async () => {
    const { h, original, successor } = await afterAutomaticReschedule();

    await h.service.onCompletionRecorded(original);

    expect(h.repo.requirePlacement(successor.id).status).toBe('CANCELLED');
    expect(planned(h.repo, 'read')).toHaveLength(0);
  });

  it('FR-RSC-09: frees the interval the withdrawn placement held', async () => {
    // The half an implementation forgets. Something else must now be placeable there, which
    // means the interval must be absent from the busy set the engine is next handed.
    const { h, original } = await afterAutomaticReschedule();
    await h.service.onCompletionRecorded(original);

    h.repo.addTask(GYM).addPlacement(
      placement({ id: 'p-gym', taskId: 'gym', start: at(19), end: at(20) }),
    );
    h.clock.advanceTo(at(20, 40));
    await h.service.onTaskMissed(h.repo.requirePlacement('p-gym'));

    const lastCall = call(h.engine, h.engine.calls.length - 1);
    expect(busyContains(lastCall.busy, { start: at(21, 15), end: at(21, 45) })).toBe(false);
  });

  it('FR-RSC-09: records the occurrence as completed', async () => {
    const { h, original } = await afterAutomaticReschedule();

    const result = await h.service.onCompletionRecorded(original);

    expect(result.completed.id).toBe(original.id);
    expect(result.completed.status).toBe('COMPLETED');
    expect(h.repo.requirePlacement(original.id).status).toBe('COMPLETED');
  });

  it('FR-RSC-09: states that it has done so', async () => {
    const { h, original } = await afterAutomaticReschedule();

    const result = await h.service.onCompletionRecorded(original);

    expect(result.statement.trim().length).toBeGreaterThan(0);
  });

  it('FR-RSC-09 / DR-06: the cancelled reschedule stays distinguishable from one that never happened', async () => {
    const { h, original, successor } = await afterAutomaticReschedule();

    await h.service.onCompletionRecorded(original);

    // Marked, never deleted: the row is still there, still says which trigger created it.
    const stored = h.repo.requirePlacement(successor.id);
    expect(stored.status).toBe('CANCELLED');
    expect(stored.rescheduleTrigger).toBe('MISSED');
    expect(h.repo.placementsOfTask('read').map((p) => p.id)).toContain(successor.id);
  });

  it('FR-RSC-09 / FR-RSC-10: a later sweep does not resurrect the cancelled reschedule', async () => {
    const { h, original, successor } = await afterAutomaticReschedule();
    await h.service.onCompletionRecorded(original);

    h.clock.advanceTo(at(22));
    const outcomes = await h.service.sweepElapsed(USER, TODAY);

    expect(outcomes.filter((o) => o.kind === 'RESCHEDULED')).toHaveLength(0);
    expect(h.repo.requirePlacement(successor.id).status).toBe('CANCELLED');
    expect(h.repo.requirePlacement(original.id).status).toBe('COMPLETED');
    expect(h.engine.calls).toHaveLength(1); // the original reschedule, and nothing since
  });

  it('FR-RSC-09: completing an occurrence that was never rescheduled cancels nothing', async () => {
    const h = makeHarness({ engine: scriptedEngine([]), now: at(20, 10) });
    const original = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });
    h.repo.addTask(READ).addPlacement(original);

    const result = await h.service.onCompletionRecorded(original);

    expect(result.cancelled).toBeNull();
    expect(h.repo.requirePlacement('p-read').status).toBe('COMPLETED');
    expect(h.engine.calls).toHaveLength(0);
  });
});

// ─── FR-RSC-09's scope — the missed classification, and only that ────────────

describe('FR-RSC-09 — the remedy is for the missed classification only', () => {
  it('FR-RSC-09: completing an occurrence a SKIP moved is ordinary completion', async () => {
    // The user declared the skip themselves. There is nothing the System guessed wrong about,
    // and nothing to withdraw — the re-placed occurrence is simply completed.
    const h = makeHarness({
      engine: engineByTask({ gym: placed(slot(at(20), at(21), 1)) }),
      now: at(15),
    });
    const original = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });
    h.repo.addTask(GYM).addPlacement(original);
    const moved = await h.service.onUserSkipped(original);
    if (moved.kind !== 'RESCHEDULED') throw new Error('set-up did not reschedule');

    const result = await h.service.onCompletionRecorded(moved.placement);

    expect(result.cancelled).toBeNull();
    expect(result.completed.status).toBe('COMPLETED');
    expect(h.repo.requirePlacement('p-gym').status).toBe('SKIPPED'); // the declaration stands
  });

  it('FR-RSC-09: completing a DISPLACED occurrence has no earlier occurrence to withdraw', async () => {
    // A displacement moves the row in place (FR-RSC-02 note), so there is no second placement
    // in existence to cancel — the shape of the data makes the question disappear.
    const h = makeHarness({
      engine: engineByTask({ gym: placed(slot(at(17, 45), at(18, 45), 1)) }),
      now: at(16),
    });
    h.repo.addTask(GYM).addTask(ADVISOR);
    h.repo
      .addPlacement(placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) }))
      .addPlacement(placement({ id: 'p-advisor', taskId: 'advisor', start: at(17), end: at(17, 45) }));
    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    const result = await h.service.onCompletionRecorded(h.repo.requirePlacement('p-gym'));

    expect(result.cancelled).toBeNull();
    expect(h.repo.placementsOfTask('gym')).toHaveLength(1);
    expect(h.repo.requirePlacement('p-gym').status).toBe('COMPLETED');
  });
});
