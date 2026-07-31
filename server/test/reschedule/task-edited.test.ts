/**
 * FR-TSK-04 — "When a user changes a task's duration or preferred window, the System shall
 * re-evaluate its placement and **re-place it IF the current placement is no longer valid**."
 *
 * Performed by `RescheduleService.onTaskEdited(task, date)` — SRS v2.15, closing OPEN-18. Until
 * that revision this Essential requirement named **no mechanism at all**: it appeared exactly
 * once in the SRS, with no use case, no sequence diagram and no class behind it.
 *
 * ⛔ THE FIRST OBLIGATION IS THE ONE AN IMPLEMENTATION GETS WRONG. *"IF the current placement is
 * no longer valid"* is a condition, not decoration. **A service that re-places unconditionally
 * satisfies every other assertion in this file** — the trigger is right, the reason is right, the
 * engine was called — while moving the user's tasks for no reason. Only the first block catches
 * it, and it catches it by asserting an absence.
 *
 * ⛔ THE VALIDITY CHECK MAY ONLY REJECT, NEVER CHOOSE. The predicate v2.15 states is *"does this
 * placement still fit the new duration, still lie inside the new window, still avoid every busy
 * interval?"* — three questions about a placement that already exists. **Where the task should go
 * instead is the engine's, always** (FR-RSC-03). This requirement is the closest the System comes
 * to licensing a second placement function, which is why the last block re-asserts, for this
 * trigger specifically, what `single-engine.test.ts` asserts of the other three.
 *
 * ⛔ OUT OF SCOPE, per v2.15: **FR-SCH-10 does not apply** — it orders SEVERAL flexible tasks into
 * a day, and this re-places ONE against the existing busy set. And **one call re-evaluates ONE
 * occurrence**; a recurring task's other dates are the caller's business (FR-TSK-05).
 */
import {
  DAY,
  at,
  busyContains,
  call,
  engineByTask,
  makeHarness,
  notPlaced,
  placed,
  placement,
  placementKey,
  planned,
  returnedSlotKeys,
  scriptedEngine,
  slot,
  task,
  TODAY,
  TOMORROW,
  USER,
} from './support/harness';

/** The task as it stands before the user edits it: 60 minutes, 17:00–18:00, placed there. */
const GYM_BEFORE = task({
  id: 'gym',
  title: 'Gym',
  type: 'WORKOUT',
  durationMinutes: 60,
  priority: 2,
  preferredWindow: { start: at(17), end: at(18) },
});
const GYM_PLACED = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });

/** Where the engine says the edited task goes. Rank 1 is not the earliest candidate. */
const GYM_CANDIDATES = placed(
  slot(at(19), at(20, 30), 1),
  slot(at(12), at(13, 30), 2),
);

const edited = (over: Partial<Parameters<typeof task>[0]>) =>
  task({
    id: 'gym',
    title: 'Gym',
    type: 'WORKOUT',
    durationMinutes: 60,
    priority: 2,
    preferredWindow: { start: at(17), end: at(18) },
    ...over,
  });

const editHarness = (now = at(12)) => {
  const h = makeHarness({ engine: engineByTask({ gym: GYM_CANDIDATES }), now });
  h.repo.addTask(GYM_BEFORE).addPlacement(GYM_PLACED);
  return h;
};

// ─── 1. A still-valid placement is left alone ───────────────────────────────

describe('FR-TSK-04 — an edit that leaves the placement valid changes nothing', () => {
  it('FR-TSK-04: a widened preferred window that still contains the placement does not invoke the engine', async () => {
    // 17:00–18:00 still lies inside 16:00–20:00, and 60 minutes still fits the placed hour.
    const h = editHarness();

    await h.service.onTaskEdited(edited({ preferredWindow: { start: at(16), end: at(20) } }), TODAY);

    expect(h.engine.calls).toHaveLength(0);
  });

  it('FR-TSK-04: a still-valid placement is left in the store untouched', async () => {
    const h = editHarness();
    const before = h.repo.snapshot();

    const outcome = await h.service.onTaskEdited(
      edited({ preferredWindow: { start: at(16), end: at(20) } }),
      TODAY,
    );

    expect(outcome).toEqual({
      kind: 'NO_ACTION',
      taskId: 'gym',
      why: 'PLACEMENT_STILL_VALID',
    });
    expect(h.repo.snapshot()).toEqual(before);
  });

  it('FR-TSK-04: a still-valid placement keeps its original placementReason and no trigger', async () => {
    // A service that re-placed unconditionally would stamp EDITED onto a placement that never
    // moved — the story the schedule tells the user would be false while every time was right.
    const h = editHarness();

    await h.service.onTaskEdited(edited({ preferredWindow: { start: at(16), end: at(20) } }), TODAY);

    const stored = h.repo.requirePlacement('p-gym');
    expect(stored.rescheduleTrigger).toBeUndefined();
    expect(stored.placementReason).toBe(GYM_PLACED.placementReason);
  });
});

// ─── 2. An invalidated placement is re-placed through the engine ────────────

describe('FR-TSK-04 — an edit that invalidates the placement re-places it', () => {
  it('FR-TSK-04: a duration that no longer fits the placed interval re-places the occurrence', async () => {
    // 90 minutes cannot be served by a 60-minute placement.
    const h = editHarness();

    const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    expect(outcome.kind).toBe('RESCHEDULED');
    if (outcome.kind !== 'RESCHEDULED') return;
    expect(h.engine.calls).toHaveLength(1);
    expect(outcome.placement.start).toBe(at(19));
    expect(outcome.placement.end).toBe(at(20, 30));
  });

  it('FR-TSK-04: a SHORTER duration also invalidates the placement', async () => {
    // v2.16 (E13): validity is `end - start === durationMinutes`, exactly — not "at least".
    // Every placement leaves the engine with `end = start + duration`, so a 60-minute block held
    // for a 30-minute task is not a roomy booking, it is the WRONG OCCURRENCE: it blocks half an
    // hour of the day from everything else and shows the user a block of the wrong length.
    // (Trimming `end` in place was rejected — that computes a time outside the engine.)
    const h = editHarness();

    const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 30 }), TODAY);

    expect(outcome.kind).toBe('RESCHEDULED');
    expect(h.engine.calls).toHaveLength(1);
    expect(call(h.engine, 0).task.durationMinutes).toBe(30);
  });

  it('FR-TSK-04: a preferred window that no longer contains the placed interval re-places it', async () => {
    // The placement is still 60 minutes long and still free — but 17:00–18:00 is not inside
    // 19:00–21:00, and v2.15's predicate asks whether it "still lies inside the new window".
    const h = editHarness();

    const outcome = await h.service.onTaskEdited(
      edited({ preferredWindow: { start: at(19), end: at(21) } }),
      TODAY,
    );

    expect(outcome.kind).toBe('RESCHEDULED');
    expect(h.engine.calls).toHaveLength(1);
  });

  it('FR-TSK-04: takes the engine rank-1 candidate, which is not the earliest', async () => {
    const h = editHarness();

    const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.placement.start).toBe(at(19));
  });

  it('FR-TSK-04: hands the engine the EDITED task and a day beginning at the current time', async () => {
    const h = editHarness(at(12));

    await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    const asked = call(h.engine, 0);
    expect(asked.task.durationMinutes).toBe(90); // the new attributes, not the stored ones
    expect(asked.schedulableDay.start).toBe(at(12));
    expect(asked.schedulableDay.end).toBe(DAY.end);
  });

  it('FR-TSK-04: the occurrence own interval is not busy for its re-placement', async () => {
    // It is moving. Leaving it in the busy set asks the engine to route around a booking that
    // is about to cease to exist — and would keep the task out of its own preferred window.
    const h = editHarness();

    await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    expect(busyContains(call(h.engine, 0).busy, { start: at(17), end: at(18) })).toBe(false);
  });

  it('FR-TSK-04: re-evaluates only the occurrence on the date it was given', async () => {
    // FR-TSK-05 gives a recurring task one occurrence per matching day, and v2.15 is explicit
    // that one call re-evaluates one occurrence. The caller decides which dates to re-evaluate.
    const h = makeHarness({ engine: engineByTask({ gym: GYM_CANDIDATES }), now: at(12) });
    const tomorrowPlacement = placement({
      id: 'p-gym-tomorrow',
      taskId: 'gym',
      date: TOMORROW,
      start: at(17),
      end: at(18),
    });
    h.repo.addTask(GYM_BEFORE, { dates: [TODAY, TOMORROW] });
    h.repo.addPlacement(GYM_PLACED).addPlacement(tomorrowPlacement);

    await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    expect(h.engine.calls).toHaveLength(1);
    expect(h.repo.requirePlacement('p-gym-tomorrow')).toEqual(tomorrowPlacement);
  });
});

/**
 * ⛔ SRS v2.16, closing E14 — and E14 existed because **nothing pinned this**. An edited
 * occurrence is **moved in place**, exactly as a displaced one is: same row, still `PLANNED`,
 * trigger `EDITED`, no successor.
 *
 * The reasoning is FR-RSC-02's, unchanged. A `MISSED` or `SKIPPED` original is kept because
 * **something happened** at the old time and FR-ANL must be able to read it. **Nothing happened
 * here** — the user changed the task before its occurrence came round. A successor would also
 * need a status for the row left behind, and `PlacementStatus` has none, which is exactly why
 * v2.14 declined to invent one for displacement.
 */
describe('FR-TSK-04 — the edited occurrence is moved in place', () => {
  it('FR-TSK-04: the re-placed occurrence keeps its placement id and creates no successor', async () => {
    const h = editHarness();

    const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.placement.id).toBe('p-gym');
    expect(h.repo.placementsOfTask('gym')).toHaveLength(1);
  });

  it('FR-TSK-04: the moved occurrence stays PLANNED, and nothing is marked missed or skipped', async () => {
    const h = editHarness();

    await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    const moved = h.repo.requirePlacement('p-gym');
    expect(moved.status).toBe('PLANNED');
    expect(moved.start).toBe(at(19));
    expect(moved.end).toBe(at(20, 30));
    const statuses = h.repo.snapshot().map((p) => p.status);
    expect(statuses).not.toContain('MISSED');
    expect(statuses).not.toContain('SKIPPED');
  });
});

// ─── 3. The trigger and the sentence (DR-06, DR-03) ─────────────────────────

describe('FR-TSK-04 — the re-placement records that an edit caused it', () => {
  it('FR-TSK-04 / DR-06: stores the trigger as EDITED', async () => {
    const h = editHarness();

    const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.trigger).toBe('EDITED');
    expect(h.repo.requirePlacement(outcome.placement.id).rescheduleTrigger).toBe('EDITED');
  });

  it('FR-TSK-04 / DR-03: stores a non-empty placementReason naming the task', async () => {
    const h = editHarness();

    const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    const stored = h.repo.requirePlacement(outcome.placement.id);
    expect(stored.placementReason.trim().length).toBeGreaterThan(0);
    expect(stored.placementReason).toContain('Gym');
  });

  it('FR-TSK-04 / DR-06: an edited sentence differs from a missed one and from a skipped one', async () => {
    // Not a wording assertion — a distinguishability one. "You changed how long this takes" and
    // "this was missed this evening" are different sentences, and only the stored trigger knows
    // which is true. A service storing one generic sentence passes every other test here.
    const editedReason = await (async () => {
      const h = editHarness();
      const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);
      if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
      return h.repo.requirePlacement(outcome.placement.id).placementReason;
    })();

    const skippedReason = await (async () => {
      const h = makeHarness({
        engine: engineByTask({ gym: placed(slot(at(20), at(21), 1)) }),
        now: at(15),
      });
      h.repo.addTask(GYM_BEFORE).addPlacement(GYM_PLACED);
      const outcome = await h.service.onUserSkipped(GYM_PLACED);
      if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
      return h.repo.requirePlacement(outcome.placement.id).placementReason;
    })();

    const missedReason = await (async () => {
      const h = makeHarness({
        engine: engineByTask({ gym: placed(slot(at(20), at(21), 1)) }),
        now: at(18, 30),
      });
      h.repo.addTask(GYM_BEFORE).addPlacement(GYM_PLACED);
      const outcome = await h.service.onTaskMissed(GYM_PLACED);
      if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
      return h.repo.requirePlacement(outcome.placement.id).placementReason;
    })();

    expect(editedReason).not.toEqual(skippedReason);
    expect(editedReason).not.toEqual(missedReason);
  });
});

// ─── 4. The predicate may only reject — the engine still chooses ────────────

describe('FR-TSK-04 / FR-RSC-03 — the validity check rejects; the engine chooses', () => {
  it('FR-TSK-04 / FR-RSC-03: every re-placement traces to a findCandidateSlots return value', async () => {
    const h = editHarness();

    const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(returnedSlotKeys(h.engine)).toContain(placementKey(outcome.placement));
  });

  it('FR-TSK-04 / FR-RSC-03: where the engine places nothing, the service places nothing', async () => {
    // The moment a validity check is allowed to answer "and it goes here instead", FR-RSC-03 is
    // gone. If the engine says no, there is no placement — not one the service picked.
    const h = makeHarness({
      engine: engineByTask({ gym: notPlaced('NO_INTERVAL_LONG_ENOUGH') }),
      now: at(12),
    });
    h.repo.addTask(GYM_BEFORE).addPlacement(GYM_PLACED);

    const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    expect(outcome.kind).toBe('UNPLACEABLE');
    expect(planned(h.repo, 'gym')).toHaveLength(0);
  });

  it('FR-TSK-04 / NFR-REL-01: an edit that cannot be re-placed does not lose the task', async () => {
    // "The System shall never lose a task." The PLACEMENT goes — the row was still PLANNED and
    // FR-RSC-05 recognises an unplaced task by the absence of one (v2.16, E11) — but the TASK
    // never does, and it is still listed for the date so the next retrieval can re-attempt it.
    const h = makeHarness({
      engine: engineByTask({ gym: notPlaced('NO_INTERVAL_LONG_ENOUGH') }),
      now: at(12),
    });
    h.repo.addTask(GYM_BEFORE).addPlacement(GYM_PLACED);

    await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    expect(await h.repo.getTask('gym')).toBeDefined();
    expect((await h.repo.tasksForDate(USER, TODAY)).map((t) => t.id)).toContain('gym');
    expect(h.repo.placementsOfTask('gym')).toHaveLength(0);
  });
});

// ─── Occurrences this trigger does not touch ────────────────────────────────

describe('FR-TSK-04 — edits the service does not act on', () => {
  it('FR-TSK-04: a FIXED task edit does not invoke the engine', async () => {
    // A fixed commitment's placement is the user's statement, not the engine's answer (§3.4
    // inserts it directly), and FR-RSC-02 makes it immovable by the scheduler. Moving one is
    // the creation path's business, and computing where it goes here would be the second
    // placement function FR-RSC-03 forbids.
    const h = makeHarness({ engine: scriptedEngine([GYM_CANDIDATES]), now: at(12) });
    const advisor = task({
      id: 'advisor',
      title: 'Advisor',
      type: 'MEETING',
      durationMinutes: 45,
      priority: 1,
      flexibility: 'FIXED',
      preferredWindow: { start: at(17), end: at(17, 45) },
    });
    const advisorPlaced = placement({
      id: 'p-advisor',
      taskId: 'advisor',
      start: at(17),
      end: at(17, 45),
    });
    h.repo.addTask(advisor).addPlacement(advisorPlaced);

    const outcome = await h.service.onTaskEdited(
      task({
        id: 'advisor',
        title: 'Advisor',
        type: 'MEETING',
        durationMinutes: 90,
        priority: 1,
        flexibility: 'FIXED',
        preferredWindow: { start: at(17), end: at(18, 30) },
      }),
      TODAY,
    );

    expect(outcome).toEqual({ kind: 'NO_ACTION', taskId: 'advisor', why: 'NOT_FLEXIBLE' });
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.requirePlacement('p-advisor')).toEqual(advisorPlaced);
  });

  it('FR-TSK-04: an edit to a task with no PLANNED occurrence on that date changes nothing', async () => {
    // There is no placement to re-evaluate. The sweep is what re-attempts an unplaced task
    // (FR-RSC-05), and it does so on retrieval rather than on edit.
    const h = makeHarness({ engine: scriptedEngine([GYM_CANDIDATES]), now: at(12) });
    const missedPlacement = placement({
      id: 'p-gym',
      taskId: 'gym',
      start: at(17),
      end: at(18),
      status: 'MISSED',
    });
    h.repo.addTask(GYM_BEFORE).addPlacement(missedPlacement);
    const before = h.repo.snapshot();

    const outcome = await h.service.onTaskEdited(edited({ durationMinutes: 90 }), TODAY);

    expect(outcome).toEqual({ kind: 'NO_ACTION', taskId: 'gym', why: 'NOT_PLANNED' });
    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.snapshot()).toEqual(before);
  });
});
