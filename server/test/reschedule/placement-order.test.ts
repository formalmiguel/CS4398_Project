/**
 * FR-SCH-10 — "Where the System places MORE THAN ONE flexible task into the same schedulable
 * day, it shall place them in ASCENDING ORDER OF PRIORITY (1 first), each resulting placement
 * becoming a busy interval for every task placed after it. Where two tasks share a priority,
 * the EARLIER-CREATED task shall be placed first, so that the order is total and repeatable."
 *
 * ⛔ THIS IS A SERVICE-LEVEL OBLIGATION AND IT IS TESTED HERE, never in `engine/test/`. The
 * engine places ONE task and its signature cannot express an ordering across tasks; this
 * requirement governs only the ORDER IN WHICH THE ENGINE IS INVOKED, and adds nothing to its
 * inputs. `task.priority` is read by nothing in `engine/src`, and that is correct.
 *
 * ⚠️ The second test in this file is the requirement's substance, not the first. An
 * implementation that sorts correctly but hands call n+1 a stale busy set produces two tasks
 * placed on top of each other **while every ordering assertion still passes.**
 *
 * ⛔ NOT displacement. A task already placed is never evicted by a higher-priority task
 * created later — that is FR-SCH-07, Conditional, and out of scope (§2.7.1).
 *
 * ⛔ AND NOT THE INITIAL DAY-PLANNING PATH. FR-SCH-10 binds it identically, but §3.6 gives it
 * to no class and v2.14 assigns it to **packet 12** as **OPEN-17**. No test here reaches for it.
 */
import {
  at,
  busyContains,
  engineByTask,
  InMemoryTaskRepository,
  makeHarness,
  placed,
  placement,
  planned,
  realEngineSpy,
  slot,
  task,
  taskIdsInCallOrder,
  TODAY,
  USER,
} from './support/harness';

// Three flexible tasks, all of whose windows elapsed this morning, deliberately REGISTERED in
// an order that is neither their priority order nor their id order — the order a database
// happens to return them in is exactly what FR-SCH-10 exists to stop deciding the outcome.
const CHORES = task({
  id: 'chores',
  title: 'Chores',
  durationMinutes: 30,
  priority: 3,
  preferredWindow: { start: at(8), end: at(8, 30) },
});
const STUDY = task({
  id: 'study',
  title: 'Study',
  durationMinutes: 60,
  priority: 1,
  preferredWindow: { start: at(9), end: at(10) },
});
const WALK = task({
  id: 'walk',
  title: 'Walk',
  durationMinutes: 20,
  priority: 2,
  preferredWindow: { start: at(10), end: at(10, 20) },
});

const threeElapsed = () => {
  const h = makeHarness({
    engine: engineByTask({
      study: placed(slot(at(13), at(14), 1)),
      walk: placed(slot(at(14), at(14, 20), 1)),
      chores: placed(slot(at(14, 30), at(15), 1)),
    }),
    now: at(12),
  });
  h.repo.addTask(CHORES).addTask(STUDY).addTask(WALK);
  h.repo
    .addPlacement(placement({ id: 'p-chores', taskId: 'chores', start: at(8), end: at(8, 30) }))
    .addPlacement(placement({ id: 'p-study', taskId: 'study', start: at(9), end: at(10) }))
    .addPlacement(placement({ id: 'p-walk', taskId: 'walk', start: at(10), end: at(10, 20) }));
  return h;
};

describe('FR-SCH-10 — several flexible tasks are placed in ascending priority order', () => {
  it('FR-SCH-10: invokes the engine in ascending order of priority, 1 first', async () => {
    const h = threeElapsed();

    await h.service.sweepElapsed(USER, TODAY);

    expect(taskIdsInCallOrder(h.engine)).toEqual(['study', 'walk', 'chores']);
  });

  it('FR-SCH-10: each resulting placement becomes a busy interval for the next call', async () => {
    const h = threeElapsed();

    await h.service.sweepElapsed(USER, TODAY);

    const [first, second, third] = h.engine.calls;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error(`expected three engine calls, got ${h.engine.calls.length}`);
    }
    expect(busyContains(first.busy, { start: at(13), end: at(14) })).toBe(false);
    expect(busyContains(second.busy, { start: at(13), end: at(14) })).toBe(true);
    expect(busyContains(third.busy, { start: at(13), end: at(14) })).toBe(true);
    expect(busyContains(third.busy, { start: at(14), end: at(14, 20) })).toBe(true);
  });

  it('FR-SCH-10: a commitment displacing several tasks re-places them in ascending priority order', async () => {
    const h = makeHarness({
      engine: engineByTask({
        study: placed(slot(at(19), at(20), 1)),
        walk: placed(slot(at(20), at(20, 20), 1)),
      }),
      now: at(12),
    });
    const seminar = task({
      id: 'seminar',
      title: 'Seminar',
      type: 'MEETING',
      durationMinutes: 120,
      priority: 1,
      flexibility: 'FIXED',
      preferredWindow: { start: at(13), end: at(15) },
    });
    h.repo.addTask(WALK).addTask(STUDY).addTask(seminar);
    h.repo
      .addPlacement(placement({ id: 'p-walk', taskId: 'walk', start: at(13), end: at(13, 20) }))
      .addPlacement(placement({ id: 'p-study', taskId: 'study', start: at(13, 30), end: at(14, 30) }))
      .addPlacement(placement({ id: 'p-seminar', taskId: 'seminar', start: at(13), end: at(15) }));

    await h.service.onCommitmentAdded(seminar, TODAY);

    expect(taskIdsInCallOrder(h.engine)).toEqual(['study', 'walk']);
  });
});

describe('FR-SCH-10 — the higher-priority task wins a contested slot', () => {
  it('FR-SCH-10: where two flexible tasks want the same slot the higher-priority one gets it', async () => {
    // The REAL engine, so the contention is real rather than scripted. A two-hour seminar lands
    // on both tasks at once; both prefer 15:00–16:00 and both fit there, and only one can have
    // it. The loser's next-best alternative is the noon gap, which the engine chooses — not
    // this test, and not the service.
    const engine = realEngineSpy();
    const h = makeHarness({ engine, now: at(12) });
    const thesis = task({
      id: 'thesis',
      title: 'Thesis writing',
      durationMinutes: 60,
      priority: 1,
      preferredWindow: { start: at(15), end: at(16) },
    });
    const gym = task({
      id: 'gym',
      title: 'Gym',
      type: 'WORKOUT',
      durationMinutes: 60,
      priority: 4,
      preferredWindow: { start: at(15), end: at(16) },
    });
    const seminar = task({
      id: 'seminar',
      title: 'Seminar',
      type: 'MEETING',
      durationMinutes: 120,
      priority: 1,
      flexibility: 'FIXED',
      preferredWindow: { start: at(13), end: at(15) },
    });
    const shift = task({
      id: 'shift',
      title: 'Shift',
      type: 'OTHER',
      durationMinutes: 420,
      priority: 1,
      flexibility: 'FIXED',
      preferredWindow: { start: at(16), end: at(23) },
    });
    // Registered lowest-priority first, so an implementation that keeps the store's order fails.
    h.repo.addTask(gym).addTask(thesis).addTask(seminar).addTask(shift);
    h.repo
      .addPlacement(placement({ id: 'p-gym', taskId: 'gym', start: at(14), end: at(15) }))
      .addPlacement(placement({ id: 'p-thesis', taskId: 'thesis', start: at(13), end: at(14) }))
      .addPlacement(placement({ id: 'p-seminar', taskId: 'seminar', start: at(13), end: at(15) }))
      .addPlacement(placement({ id: 'p-shift', taskId: 'shift', start: at(16), end: at(23) }));

    await h.service.onCommitmentAdded(seminar, TODAY);

    expect(taskIdsInCallOrder(h.engine)).toEqual(['thesis', 'gym']);
    expect(planned(h.repo, 'thesis')[0]?.start).toBe(at(15)); // the contested slot
    expect(planned(h.repo, 'gym')[0]?.start).toBe(at(12)); // its next-best alternative
  });
});

/**
 * ⛔ THE TIEBREAK IS ONE KEY, NOT A CHAIN OF SPECIAL CASES (SRS v2.14, closing E5):
 * rank on **`(has an instant, the instant, id)`**. Tasks with a known `createdAt` order by it;
 * a task without one sorts AFTER every task that has one; any remaining tie breaks on `id`.
 *
 * ⚠️ The rule this packet's first run proposed — "if either is absent, compare that pair by
 * `id`" — **is not transitive and so defines no order at all.** The last test in this block is
 * the counter-example from the SRS, and it is here precisely because a comparator with a cycle
 * still passes every pairwise test anyone thinks to write.
 */
describe('FR-SCH-10 — equal priority breaks on the earlier-created task, and the order is TOTAL', () => {
  const pair = (a: ReturnType<typeof task>, b: ReturnType<typeof task>) => {
    const h = makeHarness({
      engine: engineByTask({
        [a.id]: placed(slot(at(13), at(13, 30), 1)),
        [b.id]: placed(slot(at(14), at(14, 30), 1)),
      }),
      now: at(12),
    });
    // Registered b-then-a, so a service that keeps the store's order fails every case below.
    h.repo.addTask(b).addTask(a);
    h.repo
      .addPlacement(placement({ id: `p-${b.id}`, taskId: b.id, start: at(9), end: at(9, 30) }))
      .addPlacement(placement({ id: `p-${a.id}`, taskId: a.id, start: at(8), end: at(8, 30) }));
    return h;
  };

  it('FR-SCH-10: equal priority, both instants known — the earlier-created task is placed first', async () => {
    const early = task({
      id: 'zeta',
      title: 'Zeta',
      priority: 2,
      preferredWindow: { start: at(8), end: at(8, 30) },
      createdAt: '2026-07-20T08:00:00.000Z',
    });
    const late = task({
      id: 'alpha',
      title: 'Alpha',
      priority: 2,
      preferredWindow: { start: at(9), end: at(9, 30) },
      createdAt: '2026-07-20T09:00:00.000Z',
    });
    const h = pair(early, late);

    await h.service.sweepElapsed(USER, TODAY);

    // Note the ids run the OTHER way: this fails if the tiebreak silently used `id`.
    expect(taskIdsInCallOrder(h.engine)).toEqual(['zeta', 'alpha']);
  });

  it('FR-SCH-10: equal priority, one instant known and one absent — the known instant goes first', async () => {
    // Whatever the ids say. `createdAt` is optional, so a partly backfilled store is the
    // ORDINARY state and this pair is not an edge case.
    const known = task({
      id: 'zeta',
      title: 'Zeta',
      priority: 2,
      preferredWindow: { start: at(8), end: at(8, 30) },
      createdAt: '2026-07-20T09:00:00.000Z',
    });
    const unknown = task({
      id: 'alpha',
      title: 'Alpha',
      priority: 2,
      preferredWindow: { start: at(9), end: at(9, 30) },
    });
    const h = pair(known, unknown);

    await h.service.sweepElapsed(USER, TODAY);

    expect(taskIdsInCallOrder(h.engine)).toEqual(['zeta', 'alpha']);
  });

  it('FR-SCH-10: equal priority, createdAt absent on both — the order falls through to ascending id', async () => {
    // "so that the order is total and repeatable" is a claim about the ones with no timestamp too.
    const alpha = task({
      id: 'alpha',
      title: 'Alpha',
      priority: 2,
      preferredWindow: { start: at(8), end: at(8, 30) },
    });
    const zeta = task({
      id: 'zeta',
      title: 'Zeta',
      priority: 2,
      preferredWindow: { start: at(9), end: at(9, 30) },
    });
    const h = pair(alpha, zeta);

    await h.service.sweepElapsed(USER, TODAY);

    expect(taskIdsInCallOrder(h.engine)).toEqual(['alpha', 'zeta']);
  });

  it('FR-SCH-10: equal priority and one identical createdAt instant — ascending id decides', async () => {
    const sameInstant = '2026-07-20T08:00:00.000Z';
    const alpha = task({
      id: 'alpha',
      title: 'Alpha',
      priority: 2,
      preferredWindow: { start: at(8), end: at(8, 30) },
      createdAt: sameInstant,
    });
    const zeta = task({
      id: 'zeta',
      title: 'Zeta',
      priority: 2,
      preferredWindow: { start: at(9), end: at(9, 30) },
      createdAt: sameInstant,
    });
    const h = pair(alpha, zeta);

    await h.service.sweepElapsed(USER, TODAY);

    expect(taskIdsInCallOrder(h.engine)).toEqual(['alpha', 'zeta']);
  });

  it('FR-SCH-10: three tasks, one without an instant — the order is total, with no cycle', async () => {
    // The SRS's own counter-example: A(10:00, id 'a'), B(absent, id 'b'), C(09:00, id 'c').
    // The rejected pairwise rule gives A<B, B<C and C<A — a cycle, from which a sort returns
    // whatever its pivots happen to produce. The single key gives C, A, B, every time.
    const a = task({
      id: 'a',
      title: 'A',
      priority: 2,
      preferredWindow: { start: at(8), end: at(8, 30) },
      createdAt: '2026-07-20T10:00:00.000Z',
    });
    const b = task({
      id: 'b',
      title: 'B',
      priority: 2,
      preferredWindow: { start: at(9), end: at(9, 30) },
    });
    const c = task({
      id: 'c',
      title: 'C',
      priority: 2,
      preferredWindow: { start: at(10), end: at(10, 30) },
      createdAt: '2026-07-20T09:00:00.000Z',
    });
    const h = makeHarness({
      engine: engineByTask({
        a: placed(slot(at(13), at(13, 30), 1)),
        b: placed(slot(at(14), at(14, 30), 1)),
        c: placed(slot(at(15), at(15, 30), 1)),
      }),
      now: at(12),
    });
    h.repo.addTask(b).addTask(a).addTask(c);
    h.repo
      .addPlacement(placement({ id: 'p-b', taskId: 'b', start: at(9), end: at(9, 30) }))
      .addPlacement(placement({ id: 'p-a', taskId: 'a', start: at(8), end: at(8, 30) }))
      .addPlacement(placement({ id: 'p-c', taskId: 'c', start: at(10), end: at(10, 30) }));

    await h.service.sweepElapsed(USER, TODAY);

    expect(taskIdsInCallOrder(h.engine)).toEqual(['c', 'a', 'b']);
  });
});

describe('FR-SCH-10 — the order is repeatable', () => {
  it('FR-SCH-10: the same inputs produce the same schedule, including the order of invocation', async () => {
    const first = threeElapsed();
    await first.service.sweepElapsed(USER, TODAY);

    const second = threeElapsed();
    await second.service.sweepElapsed(USER, TODAY);

    expect(taskIdsInCallOrder(second.engine)).toEqual(taskIdsInCallOrder(first.engine));
    expect(second.repo.snapshot()).toEqual(first.repo.snapshot());
  });

  it('FR-SCH-10: a fresh store built in a different registration order yields the same schedule', async () => {
    const reference = threeElapsed();
    await reference.service.sweepElapsed(USER, TODAY);

    const shuffled = makeHarness({
      engine: engineByTask({
        study: placed(slot(at(13), at(14), 1)),
        walk: placed(slot(at(14), at(14, 20), 1)),
        chores: placed(slot(at(14, 30), at(15), 1)),
      }),
      now: at(12),
      repo: new InMemoryTaskRepository(),
    });
    shuffled.repo.addTask(WALK).addTask(CHORES).addTask(STUDY);
    shuffled.repo
      .addPlacement(placement({ id: 'p-walk', taskId: 'walk', start: at(10), end: at(10, 20) }))
      .addPlacement(placement({ id: 'p-chores', taskId: 'chores', start: at(8), end: at(8, 30) }))
      .addPlacement(placement({ id: 'p-study', taskId: 'study', start: at(9), end: at(10) }));
    await shuffled.service.sweepElapsed(USER, TODAY);

    expect(taskIdsInCallOrder(shuffled.engine)).toEqual(taskIdsInCallOrder(reference.engine));
    expect(shuffled.repo.snapshot()).toEqual(reference.repo.snapshot());
  });
});
