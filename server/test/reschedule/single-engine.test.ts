/**
 * FR-RSC-03 — "Automatic rescheduling shall use THE IDENTICAL ENGINE of FR-SCH — not a
 * second, parallel implementation."
 *
 * ⚠️ THE TESTABLE HALF ONLY. FR-RSC-03 is an (I) requirement and its inspection — "exactly one
 * function in the codebase produces placements" — is packet 16's executable guard. Nothing
 * here greps the source tree. What a test CAN prove is that the service ASKED rather than
 * ANSWERED: every placement it produced is traceable to a value the injected engine returned,
 * and no code path produces a placement the engine was not consulted for.
 *
 * The guard is the belt; this is the braces. A tidy little `findNextFreeSlot()` helper inside
 * the service is the canonical way this project could fail while every other test stayed
 * green — it would be caught here, in week one, rather than in week four.
 *
 * The last block is what §6's claim rests on: the service run against the REAL
 * `findCandidateSlots` from `@capstone/engine`, end to end. A suite that only ever sees a
 * stubbed engine proves the service calls *something*.
 */
import { findCandidateSlots } from '@capstone/engine';

import {
  DAY,
  at,
  call,
  engineByTask,
  makeHarness,
  notPlaced,
  placed,
  placement,
  placementKey,
  realEngineSpy,
  returnedSlotKeys,
  scriptedEngine,
  slot,
  task,
  TODAY,
  TOMORROW,
  USER,
} from './support/harness';

const GYM = task({
  id: 'gym',
  title: 'Gym',
  type: 'WORKOUT',
  durationMinutes: 60,
  priority: 2,
  preferredWindow: { start: at(17), end: at(18) },
});
const READ = task({
  id: 'read',
  title: 'Read 30 minutes',
  durationMinutes: 30,
  priority: 3,
  preferredWindow: { start: at(20), end: at(20, 30) },
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

describe('FR-RSC-03 — every placement comes back from the engine', () => {
  it('FR-RSC-03: a missed reschedule places only a slot the engine returned', async () => {
    const h = makeHarness({
      engine: scriptedEngine([placed(slot(at(21, 15), at(21, 45), 1))]),
      now: at(20, 35),
    });
    const original = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });
    h.repo.addTask(READ).addPlacement(original);

    const outcome = await h.service.onTaskMissed(original);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(returnedSlotKeys(h.engine)).toContain(placementKey(outcome.placement));
  });

  it('FR-RSC-03: a skip and a displacement place only slots the engine returned', async () => {
    const h = makeHarness({
      engine: engineByTask({
        gym: placed(slot(at(20), at(21), 1)),
        read: placed(slot(at(21, 15), at(21, 45), 1)),
      }),
      now: at(15),
    });
    const gymPlacement = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });
    const readPlacement = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });
    h.repo.addTask(GYM).addTask(READ).addTask(ADVISOR);
    h.repo.addPlacement(gymPlacement).addPlacement(readPlacement);

    const skipped = await h.service.onUserSkipped(gymPlacement);
    h.repo.addPlacement(
      placement({ id: 'p-advisor', taskId: 'advisor', start: at(17), end: at(17, 45) }),
    );
    const displaced = await h.service.onCommitmentAdded(ADVISOR, TODAY);

    const produced = [skipped, ...displaced]
      .filter((o) => o.kind === 'RESCHEDULED')
      .map((o) => (o.kind === 'RESCHEDULED' ? placementKey(o.placement) : ''));
    expect(produced.length).toBeGreaterThan(0);
    for (const key of produced) expect(returnedSlotKeys(h.engine)).toContain(key);
  });

  it('FR-RSC-03: every placement in the store after a sweep is traceable to an engine result', async () => {
    const h = makeHarness({
      engine: engineByTask({
        gym: placed(slot(at(20), at(21), 1)),
        read: placed(slot(at(21, 15), at(21, 45), 1)),
      }),
      now: at(21),
    });
    h.repo.addTask(GYM).addTask(READ);
    h.repo
      .addPlacement(placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) }))
      .addPlacement(placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) }));

    await h.service.sweepElapsed(USER, TODAY);

    const created = h.repo.snapshot().filter((p) => p.rescheduleTrigger !== undefined);
    expect(created.length).toBeGreaterThan(0);
    for (const p of created) expect(returnedSlotKeys(h.engine)).toContain(placementKey(p));
  });

  it('FR-RSC-03: produces no placement where the engine returned placed: false', async () => {
    const h = makeHarness({
      engine: scriptedEngine([notPlaced('NO_INTERVAL_LONG_ENOUGH')]),
      now: at(20, 35),
    });
    const original = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });
    h.repo.addTask(READ).addPlacement(original);
    const before = h.repo.snapshot().length;

    const outcome = await h.service.onTaskMissed(original);

    expect(outcome.kind).toBe('UNPLACEABLE');
    // No fabricated slot, no half-placement, no "somewhere later" invented by the service.
    expect(h.repo.snapshot().filter((p) => p.status === 'PLANNED')).toHaveLength(0);
    expect(h.repo.snapshot()).toHaveLength(before);
  });

  it('FR-RSC-03: produces no placement on a path where the engine was never called', async () => {
    const h = makeHarness({ engine: scriptedEngine([]), now: at(20, 35) });
    const completed = placement({
      id: 'p-read',
      taskId: 'read',
      start: at(20),
      end: at(20, 30),
      status: 'COMPLETED',
    });
    h.repo.addTask(READ).addPlacement(completed);
    const before = h.repo.snapshot();

    await h.service.onTaskMissed(completed);

    expect(h.engine.calls).toHaveLength(0);
    expect(h.repo.snapshot()).toEqual(before);
  });

  it('FR-RSC-03: moveToNextDay also goes through the injected engine', async () => {
    const h = makeHarness({
      engine: scriptedEngine([placed(slot(at(17), at(18), 1, true))]),
      now: at(22),
    });
    h.repo.addTask(GYM, { dates: [TODAY, TOMORROW] });

    const outcome = await h.service.moveToNextDay('gym', TODAY);

    expect(h.engine.calls).toHaveLength(1);
    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(returnedSlotKeys(h.engine)).toContain(placementKey(outcome.placement));
  });
});

/**
 * ⛔ THE END-TO-END BLOCK. No stubs: the service, the real engine, and a day built out of
 * literals.
 *
 * The first test is UC-05, and it is here because of E1. Before SRS v2.14 this test could not
 * have been written: a missed task's preferred window is behind `now`, the day starts at `now`,
 * and FR-SCH-09's last boundary row obliged the engine to answer `WINDOW_OUTSIDE_SCHEDULABLE_DAY`
 * — every time, for every missed task, with all 30 engine tests green. **The substitution rule
 * is what makes 21:15 reachable, and this is the test that proves it against the real engine
 * rather than against a fixture that agrees with us.**
 */
describe('FR-RSC-03 — the engine is the REAL one, end to end', () => {
  it('FR-RSC-01 / FR-RSC-03: UC-05 — a missed 20:00 reading is re-placed at 21:15 by the real engine', async () => {
    const engine = realEngineSpy();
    const h = makeHarness({ engine, now: at(20, 35) });
    const callWithMum = task({
      id: 'call',
      title: 'Call home',
      type: 'OTHER',
      durationMinutes: 45,
      priority: 1,
      flexibility: 'FIXED',
      preferredWindow: { start: at(20, 30), end: at(21, 15) },
    });
    const original = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });
    h.repo.addTask(READ).addTask(callWithMum);
    h.repo
      .addPlacement(original)
      .addPlacement(placement({ id: 'p-call', taskId: 'call', start: at(20, 30), end: at(21, 15) }));

    const outcome = await h.service.onTaskMissed(original);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.placement.start).toBe(at(21, 15));
    expect(outcome.placement.end).toBe(at(21, 45));
  });

  // UC-13: Gym is placed 17:00–18:00 and the user declares it skipped at 15:00. The Advisor
  // meeting holds 17:00–17:45, so the day's free blocks are 15:00–17:00 and 17:45–23:00.
  const uc13 = () => {
    const engine = realEngineSpy();
    const h = makeHarness({ engine, now: at(15) });
    const gymPlacement = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });
    h.repo.addTask(GYM).addTask(ADVISOR);
    h.repo
      .addPlacement(gymPlacement)
      .addPlacement(placement({ id: 'p-advisor', taskId: 'advisor', start: at(17), end: at(17, 45) }));
    return { engine, h, gymPlacement };
  };

  it('FR-RSC-03: re-places a skipped task through the real findCandidateSlots from @capstone/engine', async () => {
    const { engine, h, gymPlacement } = uc13();

    const outcome = await h.service.onUserSkipped(gymPlacement);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    const asked = call(engine, 0);
    const expected = findCandidateSlots(asked.busy, asked.task, asked.schedulableDay);
    if (!expected.placed) throw new Error('the real engine found no slot for this fixture');
    expect(outcome.placement.start).toBe(expected.slots[0]?.start);
    expect(outcome.placement.end).toBe(expected.slots[0]?.end);
  });

  it('FR-RSC-03: takes the real engine rank-1 candidate even though rank 2 is earlier', async () => {
    // The real engine ranks 5:45 PM first and 4:00 PM second — proximity to the preferred
    // 5:00 PM start, not earliness. A service applying its own criterion would take 4:00 PM.
    const { h, gymPlacement } = uc13();

    const outcome = await h.service.onUserSkipped(gymPlacement);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.placement.start).toBe(at(17, 45));
    expect(outcome.placement.end).toBe(at(18, 45));
  });

  // Named FR-RSC-03, not FR-SCH-04: the engine's own no-overlap guarantee is packet 04's and
  // is frozen. What this asserts is that the SERVICE inherits it by taking the engine's answer
  // unaltered — a service that adjusted a returned slot by so much as a minute would fail here.
  it('FR-RSC-03: the placement the real engine produced overlaps nothing busy and stays inside the day', async () => {
    const { engine, h, gymPlacement } = uc13();

    const outcome = await h.service.onUserSkipped(gymPlacement);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    const { start, end } = outcome.placement;
    expect(start).toBeGreaterThanOrEqual(at(15));
    expect(end).toBeLessThanOrEqual(DAY.end);
    for (const busy of call(engine, 0).busy) {
      expect(start < busy.end && busy.start < end).toBe(false);
    }
  });

  it('FR-RSC-02 / FR-RSC-03: UC-06 — the advisor meeting moves Gym to 17:45 through the real engine', async () => {
    const engine = realEngineSpy();
    const h = makeHarness({ engine, now: at(16) });
    h.repo.addTask(GYM).addTask(ADVISOR);
    h.repo
      .addPlacement(placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) }))
      .addPlacement(placement({ id: 'p-advisor', taskId: 'advisor', start: at(17), end: at(17, 45) }));

    await h.service.onCommitmentAdded(ADVISOR, TODAY);

    // Moved in place: the same row, still PLANNED, at the slot the real engine ranked first.
    const moved = h.repo.requirePlacement('p-gym');
    expect(moved.start).toBe(at(17, 45));
    expect(moved.end).toBe(at(18, 45));
    expect(moved.status).toBe('PLANNED');
    expect(h.repo.requirePlacement('p-advisor').start).toBe(at(17));
  });
});
