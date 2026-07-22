/**
 * FR-RSC-05 — "Where a missed, **skipped**, or displaced task cannot be re-placed in the
 * remainder of the day, the System shall say so and offer to move it to the next day.
 * **It shall not silently discard the task.**"
 * NFR-REL-01 — "The System shall never lose a task."
 *
 * *"Skipped" joined that sentence at v2.14 (E3). It was already in FR-RSC-08, UC-10 and UC-13;
 * the only place it was missing was the requirement that governs the case.*
 *
 * ⛔ THIS IS THE FILE TO READ HARDEST AT THE GATE. It is the service-level twin of FR-SCH-06,
 * and it fails silently by construction: a service that drops a task it cannot place produces
 * no error, no exception and no red test unless a test goes looking for the task afterwards.
 *
 * ⛔ HOW "UNPLACED" IS REPRESENTED (SRS v2.13): unplaced is the ABSENCE of a placement, not a
 * stored state. There is no `UNPLACED` member of `PlacementStatus` and no test here asks for
 * one. Nothing is written on failure; a missed task simply keeps its `MISSED` placement and
 * has no `PLANNED` one. The reason shown to the user is the ENGINE's own `NoSlotReason` and
 * explanation, RECOMPUTED on retrieval rather than stored — which buys two properties that a
 * stored flag cannot have, and both are asserted below:
 *
 *   • retrieving the same day again still offers the next day  (nothing had to persist)
 *   • freeing the day up makes the task place normally, no offer  (nothing to clean up)
 *
 * ⛔ NOT IN SCOPE, and no test asks for either: discarding the task for the day, and
 * rearranging the current day to make room. The second is FR-SCH-07 — Conditional.
 */
import {
  DAY,
  at,
  call,
  engineByTask,
  makeHarness,
  notPlaced,
  placed,
  placement,
  planned,
  slot,
  task,
  TODAY,
  TOMORROW,
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

const FULL_EXPLANATION = 'Your day is booked from 8:35 PM to 11:00 PM.';
const FULL = notPlaced('DAY_FULL', FULL_EXPLANATION);

/** A missed task the engine cannot re-place: the rest of the day is full. */
const unplaceableHarness = () => {
  const h = makeHarness({ engine: engineByTask({ read: FULL }), now: at(20, 35) });
  h.repo.addTask(READ).addPlacement(ORIGINAL);
  return h;
};

/** Gym is placed 17:00–18:00, the Advisor meeting lands on it, and nowhere else will take it. */
const displacedUnplaceable = () => {
  const h = makeHarness({ engine: engineByTask({ gym: FULL }), now: at(16) });
  h.repo.addTask(GYM).addTask(ADVISOR);
  h.repo
    .addPlacement(placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) }))
    .addPlacement(placement({ id: 'p-advisor', taskId: 'advisor', start: at(17), end: at(17, 45) }));
  return h;
};

describe('FR-RSC-05 — the System says so and offers the next day', () => {
  it('FR-RSC-05: reports the failure carrying the engine own NoSlotReason', async () => {
    const h = unplaceableHarness();

    const outcome = await h.service.onTaskMissed(ORIGINAL);

    expect(outcome.kind).toBe('UNPLACEABLE');
    if (outcome.kind !== 'UNPLACEABLE') return;
    expect(outcome.reason).toBe('DAY_FULL');
    // ⚠️ This is `PlacementResult`'s FAILURE-branch explanation, passed through from the engine
    // rather than composed by the service (FR-SCH-06). It is NOT `Slot.explanation`, which is
    // packet 04's, frozen, and asserted on nowhere in this suite (settled decision 2).
    expect(outcome.explanation).toBe(FULL_EXPLANATION);
  });

  it('FR-RSC-05: offers to move it to the next day', async () => {
    const h = unplaceableHarness();

    const outcome = await h.service.onTaskMissed(ORIGINAL);

    if (outcome.kind !== 'UNPLACEABLE') throw new Error('expected an offer');
    expect(outcome.offerNextDay).toBe(true);
    expect(outcome.taskId).toBe('read');
    expect(outcome.date).toBe(TODAY);
  });

  it('FR-RSC-05: a displaced task that cannot be re-placed is offered the next day too', async () => {
    const h = displacedUnplaceable();

    const outcomes = await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.kind).toBe('UNPLACEABLE');
  });

  it('FR-RSC-05: an edited task that cannot be re-placed is offered the next day too', async () => {
    // v2.16 (E12) removed the trigger list from this requirement precisely so the fourth
    // trigger would be covered by the sentence that governs the failure, rather than by an
    // enumeration somebody has to remember to extend.
    const h = makeHarness({ engine: engineByTask({ gym: FULL }), now: at(12) });
    h.repo.addTask(GYM).addPlacement(placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) }));

    const outcome = await h.service.onTaskEdited(
      task({
        id: 'gym',
        title: 'Gym',
        type: 'WORKOUT',
        durationMinutes: 90,
        priority: 2,
        preferredWindow: { start: at(17), end: at(18, 30) },
      }),
      TODAY,
    );

    expect(outcome.kind).toBe('UNPLACEABLE');
    if (outcome.kind !== 'UNPLACEABLE') return;
    expect(outcome.offerNextDay).toBe(true);
  });

  it('FR-RSC-05: a skipped task that cannot be re-placed is offered the next day too', async () => {
    // UC-13: "No slot remains in the day → System says so and offers tomorrow; the task is not
    // discarded (FR-RSC-05)" — and since v2.14 the requirement's own sentence says so as well.
    const h = makeHarness({ engine: engineByTask({ gym: FULL }), now: at(15) });
    const gymPlacement = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });
    h.repo.addTask(GYM).addPlacement(gymPlacement);

    const outcome = await h.service.onUserSkipped(gymPlacement);

    expect(outcome.kind).toBe('UNPLACEABLE');
  });
});

describe('FR-RSC-05 — unplaced is the ABSENCE of a placement, and nothing is stored', () => {
  it('FR-RSC-05: no new placement is created when the engine cannot place the task', async () => {
    const h = unplaceableHarness();
    const before = h.repo.snapshot().length;

    await h.service.onTaskMissed(ORIGINAL);

    expect(h.repo.snapshot()).toHaveLength(before);
    expect(planned(h.repo, 'read')).toHaveLength(0);
  });

  it('FR-RSC-05: a missed task original placement remains MISSED', async () => {
    const h = unplaceableHarness();

    await h.service.onTaskMissed(ORIGINAL);

    expect(h.repo.requirePlacement('p-read').status).toBe('MISSED');
  });

  /**
   * ⛔ SRS v2.16, closing E11. A missed or skipped occurrence is already out of `PLANNED` by the
   * time the engine is asked, so "no `PLANNED` placement" costs nothing. A DISPLACED one is
   * still `PLANNED` — so where it cannot be re-placed, the row is REMOVED. The only deletion in
   * the domain, and the reason it is safe: a `PLANNED` row is a statement about the future,
   * while what actually happened lives in completion records and in `MISSED`/`SKIPPED` rows.
   *
   * The second test below is the one that matters. Leaving the row would store an overlap — but
   * far worse, it would make the task *look placed*, and **the next-day offer would silently
   * stop being made.** The overlap is visible; the missing offer is not.
   */
  it('FR-RSC-05: a displaced occurrence that cannot be re-placed leaves no placement behind', async () => {
    const h = displacedUnplaceable();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(h.repo.placementsOfTask('gym')).toHaveLength(0);
  });

  it('FR-RSC-05 / FR-SCH-04: nothing is left overlapping the commitment that displaced it', async () => {
    const h = displacedUnplaceable();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    for (const p of h.repo.snapshot()) {
      if (p.taskId === 'advisor') continue;
      expect(p.start < at(17, 45) && at(17) < p.end).toBe(false);
    }
  });

  it('FR-RSC-05: the offer for a displaced task is re-derived on the next retrieval', async () => {
    // Nothing was stored to make the offer, so nothing had to survive for it to be made again.
    const h = displacedUnplaceable();
    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    const outcomes = await h.service.sweepElapsed(USER, TODAY);

    expect(outcomes.filter((o) => o.kind === 'UNPLACEABLE').map((o) => o.taskId)).toEqual(['gym']);
  });

  it('NFR-REL-01: the displaced task survives the removal of its placement', async () => {
    // The PLACEMENT goes; the TASK never does. That distinction is the whole of NFR-REL-01.
    const h = displacedUnplaceable();

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    expect(await h.repo.getTask('gym')).toBeDefined();
    expect((await h.repo.tasksForDate(USER, TODAY)).map((t) => t.id)).toContain('gym');
  });

  it('FR-RSC-05: freeing the day up re-places the displaced task, with no offer', async () => {
    const h = displacedUnplaceable();
    await h.service.onCommitmentAdded(ADVISOR, TODAY);
    expect(planned(h.repo, 'gym')).toHaveLength(0);

    h.repo.removePlacement('p-advisor');
    const freed = makeHarness({
      engine: engineByTask({ gym: placed(slot(at(17), at(18), 1, true)) }),
      now: at(16),
      repo: h.repo,
    });
    const outcomes = await freed.service.sweepElapsed(USER, TODAY);

    expect(outcomes.filter((o) => o.kind === 'UNPLACEABLE')).toHaveLength(0);
    expect(planned(freed.repo, 'gym')).toHaveLength(1);
  });

  it('FR-RSC-05: no placement is left in any status other than the five the contract defines', async () => {
    // There is no UNPLACED status, and this asserts nobody invented one under another name.
    const h = unplaceableHarness();

    await h.service.onTaskMissed(ORIGINAL);

    for (const p of h.repo.snapshot()) {
      expect(['PLANNED', 'COMPLETED', 'MISSED', 'SKIPPED', 'CANCELLED']).toContain(p.status);
    }
  });
});

describe('FR-RSC-05 / NFR-REL-01 — the task is never lost', () => {
  it('NFR-REL-01: the task is still retrievable after it could not be placed', async () => {
    const h = unplaceableHarness();

    await h.service.onTaskMissed(ORIGINAL);

    expect(await h.repo.getTask('read')).toBeDefined();
    expect((await h.repo.tasksForDate(USER, TODAY)).map((t) => t.id)).toContain('read');
  });

  it('NFR-REL-01: the count of tasks is conserved across a sequence of conflicts and reschedules', async () => {
    const h = makeHarness({
      engine: engineByTask({
        gym: placed(slot(at(18), at(19), 1)),
        read: FULL, // one succeeds, one cannot be placed at all
      }),
      now: at(16),
    });
    h.repo.addTask(GYM).addTask(READ).addTask(ADVISOR);
    h.repo
      .addPlacement(placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) }))
      .addPlacement(ORIGINAL)
      .addPlacement(placement({ id: 'p-advisor', taskId: 'advisor', start: at(17), end: at(17, 45) }));
    const before = h.repo.allTasks().length;

    await h.service.onCommitmentAdded(ADVISOR, TODAY);
    h.clock.advanceTo(at(20, 35));
    await h.service.sweepElapsed(USER, TODAY);
    await h.service.sweepElapsed(USER, TODAY);
    h.clock.advanceTo(at(22));
    await h.service.sweepElapsed(USER, TODAY);

    expect(h.repo.allTasks()).toHaveLength(before);
    expect(h.repo.allTasks().map((t) => t.id).sort()).toEqual(['advisor', 'gym', 'read']);
  });
});

describe('FR-RSC-05 — the offer is DERIVED, not stored', () => {
  it('FR-RSC-05: retrieving the same day again still offers the next day', async () => {
    const h = unplaceableHarness();
    await h.service.onTaskMissed(ORIGINAL);

    const first = await h.service.sweepElapsed(USER, TODAY);
    const second = await h.service.sweepElapsed(USER, TODAY);

    expect(first.filter((o) => o.kind === 'UNPLACEABLE')).toHaveLength(1);
    expect(second).toEqual(first);
  });

  it('FR-RSC-05: freeing the day up makes the task place normally, with no offer', async () => {
    // The property a stored flag cannot have. Nothing was left behind to clean up.
    const h = makeHarness({ engine: engineByTask({ read: FULL }), now: at(20, 35) });
    h.repo.addTask(READ).addTask(ADVISOR);
    h.repo
      .addPlacement(ORIGINAL)
      .addPlacement(placement({ id: 'p-block', taskId: 'advisor', start: at(20, 30), end: at(23) }));
    await h.service.sweepElapsed(USER, TODAY);
    expect(planned(h.repo, 'read')).toHaveLength(0);

    // The blocking commitment is removed, and the engine can now answer.
    h.repo.removePlacement('p-block');
    const freed = makeHarness({
      engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
      now: at(20, 35),
      repo: h.repo,
    });
    const outcomes = await freed.service.sweepElapsed(USER, TODAY);

    expect(outcomes.filter((o) => o.kind === 'UNPLACEABLE')).toHaveLength(0);
    expect(planned(freed.repo, 'read')).toHaveLength(1);
    expect(planned(freed.repo, 'read')[0]?.start).toBe(at(21, 15));
  });
});

describe('FR-RSC-05 — moveToNextDay acts on the offer through the same engine', () => {
  it('FR-RSC-05: moveToNextDay places the task on the next day through findCandidateSlots', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(20), at(20, 30), 1, true)) }),
      now: at(22, 30),
    });
    h.repo.addTask(READ, { dates: [TODAY, TOMORROW] });

    const outcome = await h.service.moveToNextDay('read', TODAY);

    expect(h.engine.calls).toHaveLength(1);
    expect(call(h.engine, 0).task.id).toBe('read');
    if (outcome.kind !== 'RESCHEDULED') throw new Error('expected a placement');
    expect(outcome.placement.date).toBe(TOMORROW);
    expect(outcome.placement.start).toBe(at(20));
  });

  it('FR-RSC-05: the next day is offered in full, and with the user real preferred window', async () => {
    // `now` is not on that day, so there is no elapsed part to narrow away and nothing to
    // substitute — v2.14's rules are both about a window relative to the CURRENT day.
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(20), at(20, 30), 1, true)) }),
      now: at(22, 30),
    });
    h.repo.addTask(READ, { dates: [TODAY, TOMORROW] });

    await h.service.moveToNextDay('read', TODAY);

    expect(call(h.engine, 0).schedulableDay).toEqual(DAY);
    expect(call(h.engine, 0).task.preferredWindow).toEqual({ start: at(20), end: at(20, 30) });
  });

  it('FR-RSC-05: the placement moveToNextDay produces is an ordinary PLANNED placement', async () => {
    const h = makeHarness({
      engine: engineByTask({ read: placed(slot(at(20), at(20, 30), 1, true)) }),
      now: at(22, 30),
    });
    h.repo.addTask(READ, { dates: [TODAY, TOMORROW] });

    const outcome = await h.service.moveToNextDay('read', TODAY);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('expected a placement');
    expect(outcome.placement.status).toBe('PLANNED');
    expect(h.repo.requirePlacement(outcome.placement.id).date).toBe(TOMORROW);
    expect(planned(h.repo, 'read')).toHaveLength(1);
  });

  it('FR-RSC-05: moveToNextDay onto a full next day reports it rather than discarding the task', async () => {
    const h = makeHarness({ engine: engineByTask({ read: FULL }), now: at(22, 30) });
    h.repo.addTask(READ, { dates: [TODAY, TOMORROW] });

    const outcome = await h.service.moveToNextDay('read', TODAY);

    expect(outcome.kind).toBe('UNPLACEABLE');
    expect(await h.repo.getTask('read')).toBeDefined();
    expect(planned(h.repo, 'read')).toHaveLength(0);
  });
});
