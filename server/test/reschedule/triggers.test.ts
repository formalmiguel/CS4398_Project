/**
 * FR-RSC-01 (missed), FR-RSC-02 (displaced), FR-RSC-08 (skipped) — ALL THREE TRIGGERS,
 * and all three reaching the same engine. §6 requires "a trigger suite covering all three".
 *
 * Two rules from SRS v2.12 are asserted for every one of the three, because they are the
 * rules an implementation gets right by accident and wrong on purpose:
 *
 *   1. The placement lands on the engine's RANK-1 candidate. Every fixture below returns a
 *      rank 1 that is NOT the earliest candidate — a suite whose fixtures always agree cannot
 *      tell "rank 1" from "earliest remaining", which is exactly why the SRS was silent here
 *      for so long.
 *   2. The `schedulableDay` handed to the engine BEGINS AT `now`. This is what "the next valid
 *      slot remaining that day" means — the service shapes the day, the engine ranks within
 *      it. Asserting it catches a service that searched the whole day and filtered the past
 *      out afterwards: same answer today, and the rule has silently relocated from the caller
 *      into the caller's post-processing.
 *
 * And one from v2.14, which exists because rule 2 on its own made FR-RSC-01 impossible:
 *
 *   3. Where a preferred window has FULLY ELAPSED the engine is invoked with a DERIVED task
 *      whose window is the remainder of the day, and THE STORED TASK IS UNCHANGED. A partly
 *      elapsed window is passed AS IT STANDS. Where `now` is at or past the end of the day the
 *      engine is NOT CALLED and the reason is `DAY_FULL`.
 *
 * Each trigger stores its own `rescheduleTrigger` (DR-06). A trigger the store cannot tell
 * apart from another is DR-06 failing.
 */
import {
  DAY,
  at,
  busyContains,
  call,
  makeHarness,
  placement,
  placed,
  scriptedEngine,
  slot,
  task,
  TODAY,
  TOMORROW,
} from './support/harness';

// ─── FR-RSC-01 — a miss is INFERRED from an elapsed, unmarked window ─────────

const READ = task({
  id: 'read',
  title: 'Read 30 minutes',
  durationMinutes: 30,
  priority: 3,
  preferredWindow: { start: at(20), end: at(20, 30) },
});

/** UC-05: "Read 30 minutes" was scheduled 20:00–20:30 and was not completed. */
const READ_PLANNED = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });

/** Rank 1 (21:15) is deliberately LATER than rank 2 (20:45). The service must take rank 1. */
const READ_CANDIDATES = placed(
  slot(at(21, 15), at(21, 45), 1),
  slot(at(20, 45), at(21, 15), 2),
);

const missedHarness = (now = at(20, 35)) => {
  const h = makeHarness({ engine: scriptedEngine([READ_CANDIDATES]), now });
  h.repo.addTask(READ).addPlacement(READ_PLANNED);
  return h;
};

describe('FR-RSC-01 — a missed task is classified and re-placed automatically', () => {
  it('FR-RSC-01: classifies an elapsed, incomplete, flexible occurrence missed', async () => {
    const h = missedHarness();

    await h.service.onTaskMissed(READ_PLANNED);

    expect(h.repo.requirePlacement('p-read').status).toBe('MISSED');
  });

  it('FR-RSC-01: invokes the engine to place it in the remainder of the day', async () => {
    const h = missedHarness();

    await h.service.onTaskMissed(READ_PLANNED);

    expect(h.engine.calls).toHaveLength(1);
    expect(call(h.engine, 0).task.id).toBe('read');
  });

  it('FR-RSC-01: places the occurrence in the engine rank-1 candidate, which is not the earliest', async () => {
    const h = missedHarness();

    const outcome = await h.service.onTaskMissed(READ_PLANNED);

    expect(outcome.kind).toBe('RESCHEDULED');
    if (outcome.kind !== 'RESCHEDULED') return;
    expect(outcome.placement.start).toBe(at(21, 15));
    expect(outcome.placement.end).toBe(at(21, 45));
    expect(outcome.placement.status).toBe('PLANNED');
  });

  it('FR-RSC-01: hands the engine a schedulableDay that begins at the current time', async () => {
    const h = missedHarness(at(20, 35));

    await h.service.onTaskMissed(READ_PLANNED);

    expect(call(h.engine, 0).schedulableDay.start).toBe(at(20, 35));
    expect(call(h.engine, 0).schedulableDay.end).toBe(DAY.end);
  });

  it('FR-RSC-01 / DR-06: stores the trigger as MISSED', async () => {
    const h = missedHarness();

    const outcome = await h.service.onTaskMissed(READ_PLANNED);

    expect(outcome.kind).toBe('RESCHEDULED');
    if (outcome.kind !== 'RESCHEDULED') return;
    expect(outcome.placement.rescheduleTrigger).toBe('MISSED');
    expect(h.repo.requirePlacement(outcome.placement.id).rescheduleTrigger).toBe('MISSED');
  });

  it('FR-RSC-01: does not classify an elapsed FIXED commitment missed, and does not invoke the engine', async () => {
    const lecture = task({
      id: 'lecture',
      title: 'CS 4398 lecture',
      type: 'CLASS',
      durationMinutes: 50,
      flexibility: 'FIXED',
      preferredWindow: { start: at(9), end: at(9, 50) },
    });
    const lecturePlacement = placement({
      id: 'p-lecture',
      taskId: 'lecture',
      start: at(9),
      end: at(9, 50),
    });
    const h = makeHarness({ engine: scriptedEngine([READ_CANDIDATES]), now: at(20, 35) });
    h.repo.addTask(lecture).addPlacement(lecturePlacement);

    const outcome = await h.service.onTaskMissed(lecturePlacement);

    expect(outcome).toEqual({ kind: 'NO_ACTION', taskId: 'lecture', why: 'NOT_FLEXIBLE' });
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.requirePlacement('p-lecture')).toEqual(lecturePlacement);
  });

  it('FR-RSC-01: does not classify an occurrence missed before its window has fully elapsed', async () => {
    const h = missedHarness(at(20, 29));

    const outcome = await h.service.onTaskMissed(READ_PLANNED);

    expect(outcome).toEqual({ kind: 'NO_ACTION', taskId: 'read', why: 'WINDOW_NOT_ELAPSED' });
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.requirePlacement('p-read').status).toBe('PLANNED');
  });
});

/**
 * ⛔ SRS v2.14, closing E1 from this packet's first run. Without the substitution the frozen
 * engine must reject EVERY missed task — FR-SCH-09's last boundary row, "preferred window
 * entirely outside the schedulable day" — because a missed window is behind `now` by
 * definition and the day starts at `now`. **These are the assertions standing between UC-05
 * and a Core requirement that cannot fire.** They were green in neither direction before
 * v2.14: the engine was correct, the service was correct, and the System could not reschedule.
 */
describe('FR-RSC-01 — a fully elapsed preferred window is substituted on the engine call', () => {
  it('FR-RSC-01: invokes the engine with a derived window covering the remainder of the day', async () => {
    const h = missedHarness(at(20, 35));

    await h.service.onTaskMissed(READ_PLANNED);

    const asked = call(h.engine, 0);
    expect(asked.task.preferredWindow).toEqual({ start: at(20, 35), end: DAY.end });
    // The derived window IS the day it was handed — the remainder, and nothing else.
    expect(asked.task.preferredWindow).toEqual(asked.schedulableDay);
  });

  it('FR-RSC-01: the derived task is otherwise the stored task', async () => {
    const h = missedHarness();

    await h.service.onTaskMissed(READ_PLANNED);

    const asked = call(h.engine, 0);
    expect(asked.task.id).toBe('read');
    expect(asked.task.durationMinutes).toBe(30);
    expect(asked.task.priority).toBe(3);
    expect(asked.task.flexibility).toBe('FLEXIBLE');
  });

  it('FR-RSC-01: the STORED task keeps the user original preferred window', async () => {
    // "The stored task is unchanged — tomorrow's occurrence uses the user's real window again."
    const h = missedHarness();

    await h.service.onTaskMissed(READ_PLANNED);

    expect(h.repo.storedTask('read')?.preferredWindow).toEqual({
      start: at(20),
      end: at(20, 30),
    });
  });

  it('FR-RSC-01: with now at the end of the schedulable day the engine is NOT called', async () => {
    // There is no remainder to ask about and no valid Interval to pass.
    const h = missedHarness(DAY.end);

    await h.service.onTaskMissed(READ_PLANNED);

    expect(h.engine.calls).toHaveLength(0);
  });

  it('FR-RSC-01 / FR-RSC-05: with now at the end of the day the reason is DAY_FULL', async () => {
    // The ONE reason in the System that does not originate in the engine, and it is written
    // into the SRS so that it stays the only one.
    const h = missedHarness(DAY.end);

    const outcome = await h.service.onTaskMissed(READ_PLANNED);

    expect(outcome.kind).toBe('UNPLACEABLE');
    if (outcome.kind !== 'UNPLACEABLE') return;
    expect(outcome.reason).toBe('DAY_FULL');
    expect(outcome.offerNextDay).toBe(true);
    expect(outcome.explanation.trim().length).toBeGreaterThan(0);
  });

  it('FR-RSC-01: with now past the end of the day the occurrence is still classified missed', async () => {
    // The classification is not conditional on a slot being found (FR-RSC-05: the original
    // placement remains MISSED, and the task is offered the next day rather than discarded).
    const h = missedHarness(at(23, 30));

    await h.service.onTaskMissed(READ_PLANNED);

    expect(h.repo.requirePlacement('p-read').status).toBe('MISSED');
    expect(h.repo.placementsOfTask('read')).toHaveLength(1);
  });
});

// ─── FR-RSC-02 — a new fixed commitment displaces; it never moves itself ─────

const GYM = task({
  id: 'gym',
  title: 'Gym',
  type: 'WORKOUT',
  durationMinutes: 60,
  priority: 2,
  preferredWindow: { start: at(17), end: at(18) },
});
const GYM_PLANNED = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });

const ADVISOR = task({
  id: 'advisor',
  title: 'Advisor',
  type: 'MEETING',
  durationMinutes: 45,
  priority: 1,
  flexibility: 'FIXED',
  preferredWindow: { start: at(17), end: at(17, 45) },
});
const ADVISOR_PLANNED = placement({
  id: 'p-advisor',
  taskId: 'advisor',
  start: at(17),
  end: at(17, 45),
});

/** UC-06's 17:45, and again rank 1 is NOT the earliest candidate (16:00 is). */
const GYM_CANDIDATES = placed(
  slot(at(17, 45), at(18, 45), 1),
  slot(at(16), at(17), 2),
);

const displacedHarness = (now = at(16)) => {
  const h = makeHarness({ engine: scriptedEngine([GYM_CANDIDATES]), now });
  h.repo
    .addTask(GYM)
    .addTask(ADVISOR)
    .addPlacement(GYM_PLANNED)
    // §3.4: the commitment is INSERTED first, then the overlapping flexible tasks are found.
    .addPlacement(ADVISOR_PLANNED);
  return h;
};

describe('FR-RSC-02 — a new fixed commitment displaces the flexible task it overlaps', () => {
  it('FR-RSC-02: re-places the flexible task the commitment overlaps', async () => {
    const h = displacedHarness();

    const outcomes = await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(outcomes).toHaveLength(1);
    const [outcome] = outcomes;
    expect(outcome?.kind).toBe('RESCHEDULED');
    if (outcome === undefined || outcome.kind !== 'RESCHEDULED') return;
    expect(outcome.taskId).toBe('gym');
    expect(outcome.placement.start).toBe(at(17, 45));
    expect(outcome.placement.end).toBe(at(18, 45));
  });

  it('FR-RSC-02: does not move the commitment', async () => {
    const h = displacedHarness();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    // The half an implementation gets wrong: the commitment is immovable by definition.
    expect(h.repo.requirePlacement('p-advisor')).toEqual(ADVISOR_PLANNED);
    expect(h.engine.calls.map((c) => c.task.id)).not.toContain('advisor');
  });

  it('FR-RSC-02: the commitment is in the busy set the engine is given', async () => {
    const h = displacedHarness();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(busyContains(call(h.engine, 0).busy, { start: at(17), end: at(17, 45) })).toBe(true);
  });

  it('FR-RSC-02: the displaced occurrence own interval is not busy for its re-placement', async () => {
    // It is moving. A service that left it in the busy set would be asking the engine to
    // route around a booking that is about to cease to exist.
    const h = displacedHarness();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(busyContains(call(h.engine, 0).busy, { start: at(17), end: at(18) })).toBe(false);
  });

  it('FR-RSC-02: takes the engine rank-1 candidate, which is not the earliest remaining slot', async () => {
    const h = displacedHarness();

    const outcomes = await h.service.onCommitmentAdded(ADVISOR, TODAY);

    const [outcome] = outcomes;
    if (outcome === undefined || outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.placement.start).toBe(at(17, 45));
  });

  it('FR-RSC-02: hands the engine a schedulableDay that begins at the current time', async () => {
    const h = displacedHarness(at(16));

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(call(h.engine, 0).schedulableDay.start).toBe(at(16));
    expect(call(h.engine, 0).schedulableDay.end).toBe(DAY.end);
  });

  it('FR-RSC-02: the displaced occurrence preferred window is still ahead, so it is passed as it stands', async () => {
    // v2.14's substitution is for a FULLY ELAPSED window only. At 16:00 the gym's 17:00–18:00
    // window has not started, so the engine sees the user's real preference — which is what
    // makes rank 1 land at 17:45 rather than at the earliest free minute.
    const h = displacedHarness(at(16));

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(call(h.engine, 0).task.preferredWindow).toEqual({ start: at(17), end: at(18) });
  });

  it('FR-RSC-02 / DR-06: stores the trigger as DISPLACED', async () => {
    const h = displacedHarness();

    const outcomes = await h.service.onCommitmentAdded(ADVISOR, TODAY);

    const [outcome] = outcomes;
    if (outcome === undefined || outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.trigger).toBe('DISPLACED');
    expect(h.repo.requirePlacement(outcome.placement.id).rescheduleTrigger).toBe('DISPLACED');
  });

  it('FR-RSC-02: a commitment that overlaps nothing reschedules nothing', async () => {
    const h = makeHarness({ engine: scriptedEngine([GYM_CANDIDATES]), now: at(8) });
    const dentist = task({
      id: 'dentist',
      title: 'Dentist',
      type: 'MEETING',
      durationMinutes: 30,
      flexibility: 'FIXED',
      preferredWindow: { start: at(11), end: at(11, 30) },
    });
    h.repo
      .addTask(GYM)
      .addTask(dentist)
      .addPlacement(GYM_PLANNED)
      .addPlacement(placement({ id: 'p-dentist', taskId: 'dentist', start: at(11), end: at(11, 30) }));

    expect(await h.service.onCommitmentAdded(dentist, TODAY)).toEqual([]);
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.requirePlacement('p-gym')).toEqual(GYM_PLANNED);
  });

  it('FR-RSC-02: the date argument selects the day, not the clock', async () => {
    // `Task` records WHEN IN A DAY and never WHICH DAY (v2.14, E2). A commitment added for
    // tomorrow at 17:00 must not disturb today's 17:00, however similar the two look.
    const h = makeHarness({ engine: scriptedEngine([GYM_CANDIDATES]), now: at(16) });
    h.repo.addTask(GYM, { dates: [TODAY] }).addTask(ADVISOR, { dates: [TOMORROW] });
    h.repo
      .addPlacement(GYM_PLANNED)
      .addPlacement(
        placement({
          id: 'p-advisor-tomorrow',
          taskId: 'advisor',
          date: TOMORROW,
          start: at(17),
          end: at(17, 45),
        }),
      );

    const outcomes = await h.service.onCommitmentAdded(ADVISOR, TOMORROW);

    expect(outcomes).toEqual([]);
    expect(h.repo.requirePlacement('p-gym')).toEqual(GYM_PLANNED);
  });
});

/**
 * ⛔ SRS v2.14, closing E10. A displaced occurrence is MOVED IN PLACE — the same row, still
 * `PLANNED`, no successor — because **nothing happened at the old time**: the day was
 * rearranged before the fact. That is what §3.4's sequence diagram has always drawn
 * ("Update Gym placement → 17:45"), and it is deliberately unlike a miss or a skip, where the
 * original is kept as a record of something that really did or did not happen.
 *
 * ⛔ If a test here wanted a `DISPLACED` *status*, it would be asserting a state that does not
 * exist — `PlacementStatus` has five members and none of them means "was moved out of the way".
 */
describe('FR-RSC-02 — displacement moves the row in place', () => {
  it('FR-RSC-02: the displaced occurrence keeps its placement id', async () => {
    const h = displacedHarness();

    const outcomes = await h.service.onCommitmentAdded(ADVISOR, TODAY);

    const [outcome] = outcomes;
    if (outcome === undefined || outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.placement.id).toBe('p-gym');
  });

  it('FR-RSC-02: the displaced occurrence status stays PLANNED', async () => {
    const h = displacedHarness();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    const moved = h.repo.requirePlacement('p-gym');
    expect(moved.status).toBe('PLANNED');
    expect(moved.start).toBe(at(17, 45));
    expect(moved.end).toBe(at(18, 45));
  });

  it('FR-RSC-02: no successor placement is created', async () => {
    const h = displacedHarness();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(h.repo.placementsOfTask('gym')).toHaveLength(1);
  });

  it('FR-RSC-02: nothing is marked missed or skipped by a displacement', async () => {
    const h = displacedHarness();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    const statuses = h.repo.snapshot().map((p) => p.status);
    expect(statuses).not.toContain('MISSED');
    expect(statuses).not.toContain('SKIPPED');
  });
});

// ─── FR-RSC-08 — the user declares a skip, and may do so IN ADVANCE ──────────

/** UC-13's 20:00, and once more rank 1 (20:00) is not the earliest candidate (15:30). */
const SKIP_CANDIDATES = placed(
  slot(at(20), at(21), 1),
  slot(at(15, 30), at(16, 30), 2),
);

const skipHarness = (now = at(15)) => {
  const h = makeHarness({ engine: scriptedEngine([SKIP_CANDIDATES]), now });
  h.repo.addTask(GYM).addPlacement(GYM_PLANNED);
  return h;
};

describe('FR-RSC-08 — a user-declared skip is the third trigger, and the only one available in advance', () => {
  it('FR-RSC-08: accepts the declaration BEFORE the occurrence window has elapsed', async () => {
    // UC-13: Gym is placed 17:00–18:00; at 15:00 the user is told to stay late at work.
    const h = skipHarness(at(15));

    const outcome = await h.service.onUserSkipped(GYM_PLANNED);

    expect(outcome.kind).toBe('RESCHEDULED');
    expect(h.engine.calls).toHaveLength(1);
  });

  it('FR-RSC-08: classifies the occurrence skipped', async () => {
    const h = skipHarness();

    await h.service.onUserSkipped(GYM_PLANNED);

    expect(h.repo.requirePlacement('p-gym').status).toBe('SKIPPED');
  });

  it('FR-RSC-08: invokes the engine exactly as FR-RSC-01 does — rank 1, not the earliest', async () => {
    const h = skipHarness();

    const outcome = await h.service.onUserSkipped(GYM_PLANNED);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.placement.start).toBe(at(20));
    expect(outcome.placement.end).toBe(at(21));
  });

  it('FR-RSC-08: hands the engine a schedulableDay that begins at the current time', async () => {
    const h = skipHarness(at(15));

    await h.service.onUserSkipped(GYM_PLANNED);

    expect(call(h.engine, 0).schedulableDay.start).toBe(at(15));
    expect(call(h.engine, 0).schedulableDay.end).toBe(DAY.end);
  });

  it('FR-RSC-08 / DR-06: stores the trigger as SKIPPED', async () => {
    const h = skipHarness();

    const outcome = await h.service.onUserSkipped(GYM_PLANNED);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.trigger).toBe('SKIPPED');
    expect(h.repo.requirePlacement(outcome.placement.id).rescheduleTrigger).toBe('SKIPPED');
  });

  it('FR-RSC-08: the skipped occurrence own interval is not busy for its re-placement', async () => {
    // UC-13 step 3: the engine is re-invoked "with the updated busy set". An occurrence that
    // has just been classified skipped no longer occupies the day.
    const h = skipHarness();

    await h.service.onUserSkipped(GYM_PLANNED);

    expect(busyContains(call(h.engine, 0).busy, { start: at(17), end: at(18) })).toBe(false);
  });

  it('FR-RSC-08: accepts the declaration after the window has elapsed as well', async () => {
    // "shall be accepted before the occurrence's window has elapsed, NOT ONLY AFTER."
    const h = skipHarness(at(18, 30));

    const outcome = await h.service.onUserSkipped(GYM_PLANNED);

    expect(outcome.kind).toBe('RESCHEDULED');
  });

  it('FR-RSC-08 / FR-RSC-01: a skip declared mid-window passes the window AS IT STANDS', async () => {
    // v2.14: substitution is for a FULLY elapsed window. A window that is half over is not,
    // and the engine handles the surviving part normally. The two cases are one `if` apart,
    // and an implementation will get exactly one of them right.
    const h = skipHarness(at(17, 30));

    await h.service.onUserSkipped(GYM_PLANNED);

    expect(call(h.engine, 0).task.preferredWindow).toEqual({ start: at(17), end: at(18) });
  });

  it('FR-RSC-08 / FR-RSC-01: a skip declared after the window has elapsed gets the derived window', async () => {
    // The substitution rule is about the WINDOW, not about which trigger fired.
    const h = skipHarness(at(18, 30));

    await h.service.onUserSkipped(GYM_PLANNED);

    expect(call(h.engine, 0).task.preferredWindow).toEqual({ start: at(18, 30), end: DAY.end });
    expect(h.repo.storedTask('gym')?.preferredWindow).toEqual({ start: at(17), end: at(18) });
  });

  it('FR-RSC-08: is not offered for a FIXED occurrence', async () => {
    const h = makeHarness({ engine: scriptedEngine([SKIP_CANDIDATES]), now: at(15) });
    h.repo.addTask(ADVISOR).addPlacement(ADVISOR_PLANNED);

    const outcome = await h.service.onUserSkipped(ADVISOR_PLANNED);

    expect(outcome).toEqual({ kind: 'NO_ACTION', taskId: 'advisor', why: 'NOT_FLEXIBLE' });
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.requirePlacement('p-advisor')).toEqual(ADVISOR_PLANNED);
  });
});

// ─── All three, on one day, through one service ──────────────────────────────

describe('FR-RSC-01 / FR-RSC-02 / FR-RSC-08 — the three triggers are distinguishable in store', () => {
  it('DR-06: three reschedules on one day record three different triggers', async () => {
    const h = makeHarness({
      engine: scriptedEngine([SKIP_CANDIDATES, GYM_CANDIDATES, READ_CANDIDATES]),
      now: at(15),
    });
    const gymSkipped = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });
    h.repo.addTask(GYM).addTask(ADVISOR).addTask(READ);
    h.repo.addPlacement(gymSkipped);

    const skipped = await h.service.onUserSkipped(gymSkipped);
    h.repo.addPlacement(ADVISOR_PLANNED);
    const displaced = await h.service.onCommitmentAdded(ADVISOR, TODAY);
    h.repo.addPlacement(READ_PLANNED);
    h.clock.advanceTo(at(20, 35), TODAY);
    const missed = await h.service.onTaskMissed(READ_PLANNED);

    const triggers = [skipped, ...displaced, missed]
      .filter((o) => o.kind === 'RESCHEDULED')
      .map((o) => (o.kind === 'RESCHEDULED' ? o.trigger : null));
    expect(triggers).toEqual(['SKIPPED', 'DISPLACED', 'MISSED']);
  });

  it('FR-RSC-01 / FR-RSC-02: only the missed trigger leaves a record of the old occurrence', async () => {
    // The shapes differ, and the reason they differ is worth asserting side by side: a miss
    // and a skip happened; a displacement did not.
    const h = makeHarness({
      engine: scriptedEngine([GYM_CANDIDATES, READ_CANDIDATES]),
      now: at(16),
    });
    h.repo.addTask(GYM).addTask(ADVISOR).addTask(READ);
    h.repo.addPlacement(GYM_PLANNED).addPlacement(ADVISOR_PLANNED).addPlacement(READ_PLANNED);

    await h.service.onCommitmentAdded(ADVISOR, TODAY);
    h.clock.advanceTo(at(20, 35), TODAY);
    await h.service.onTaskMissed(READ_PLANNED);

    expect(h.repo.placementsOfTask('gym')).toHaveLength(1); // moved in place
    expect(h.repo.placementsOfTask('read')).toHaveLength(2); // MISSED original + successor
    expect(h.repo.requirePlacement('p-gym').status).toBe('PLANNED');
    expect(h.repo.requirePlacement('p-read').status).toBe('MISSED');
  });
});
