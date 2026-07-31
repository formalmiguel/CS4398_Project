/**
 * DR-03 — "A placement shall RECORD WHY IT IS WHERE IT IS, so FR-DSH-05 is satisfied from
 * STORED DATA rather than reconstructed."
 * FR-RSC-04 — the notification states "the task, its new time, and the trigger."
 *
 * ⚠️ DATA ONLY. FR-RSC-04 is a (D) requirement and its demonstration is §6's acceptance
 * sequence; the schedule view that draws the sentence is packets 13–15. What is asserted here
 * is that the DATA the notification needs is present in what the service returns and stores.
 * There is no UI test in this file and there must not be one.
 *
 * ⛔ NOTHING HERE ASSERTS AN EXACT STRING. Freezing prose the SRS does not specify would make
 * packet 07 implement this agent's wording as a requirement — so what is asserted is that each
 * FACT is present, and that a missed sentence differs from a skipped one (DR-06: "this was
 * missed this evening" and "you skipped the 5:00 PM session" are different sentences, and only
 * the stored trigger knows which is true).
 *
 * ⛔ AND NOTHING HERE ASSERTS ANYTHING ABOUT `Slot.explanation`. That field is the ENGINE's,
 * it is packet 04's, it is frozen, and it provably cannot carry FR-DSH-05's sentence — the
 * engine receives `busy` as bare `Interval`s with no titles. Asserting on it here would create
 * a second owner for one requirement. (Settled decision 2.)
 */
import type { Minute, Placement } from '@capstone/shared';

import {
  at,
  engineByTask,
  makeHarness,
  placed,
  placement,
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

/**
 * Does the sentence state this time, in ANY ordinary rendering of it?
 *
 * Deliberately permissive across formats — "5:45 PM", "5:45pm", "17:45". FR-RSC-04 requires
 * the FACT to be present; which of those forms the product uses is a wording decision that
 * belongs to the team and the dashboard, not to a frozen test written before either exists.
 * This is clock-label formatting, and it computes no placement.
 */
const statesTime = (sentence: string, minute: Minute): boolean => {
  const hour24 = Math.floor(minute / 60);
  const minutes = String(minute % 60).padStart(2, '0');
  const hour12 = ((hour24 + 11) % 12) + 1;
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  const forms = [
    `${hour12}:${minutes} ${suffix}`,
    `${hour12}:${minutes}${suffix}`,
    `${String(hour24).padStart(2, '0')}:${minutes}`,
    `${hour24}:${minutes}`,
  ];
  const haystack = sentence.toUpperCase();
  return forms.some((form) => haystack.includes(form.toUpperCase()));
};

const missed = async (): Promise<Placement> => {
  const h = makeHarness({
    engine: engineByTask({ read: placed(slot(at(21, 15), at(21, 45), 1)) }),
    now: at(20, 35),
  });
  const original = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });
  h.repo.addTask(READ).addPlacement(original);
  const outcome = await h.service.onTaskMissed(original);
  if (outcome.kind !== 'RESCHEDULED') throw new Error('set-up did not reschedule');
  // Read back from the STORE, not from the return value: DR-03 is about what was recorded.
  return h.repo.requirePlacement(outcome.placement.id);
};

const skipped = async (): Promise<Placement> => {
  const h = makeHarness({
    engine: engineByTask({ gym: placed(slot(at(20), at(21), 1)) }),
    now: at(15),
  });
  const original = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });
  h.repo.addTask(GYM).addPlacement(original);
  const outcome = await h.service.onUserSkipped(original);
  if (outcome.kind !== 'RESCHEDULED') throw new Error('set-up did not reschedule');
  return h.repo.requirePlacement(outcome.placement.id);
};

const displaced = async (): Promise<Placement> => {
  const h = makeHarness({
    engine: engineByTask({ gym: placed(slot(at(17, 45), at(18, 45), 1)) }),
    now: at(16),
  });
  h.repo.addTask(GYM).addTask(ADVISOR);
  h.repo
    .addPlacement(placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) }))
    .addPlacement(placement({ id: 'p-advisor', taskId: 'advisor', start: at(17), end: at(17, 45) }));
  const outcomes = await h.service.onCommitmentAdded(ADVISOR, TODAY);
  const [outcome] = outcomes;
  if (outcome === undefined || outcome.kind !== 'RESCHEDULED') {
    throw new Error('set-up did not reschedule');
  }
  return h.repo.requirePlacement(outcome.placement.id);
};

describe('DR-03 — the placement records why it is where it is', () => {
  it('DR-03: a missed reschedule stores a non-empty placementReason', async () => {
    expect((await missed()).placementReason.trim().length).toBeGreaterThan(0);
  });

  it('DR-03: a skipped reschedule stores a non-empty placementReason', async () => {
    expect((await skipped()).placementReason.trim().length).toBeGreaterThan(0);
  });

  it('DR-03: a displaced reschedule stores a non-empty placementReason', async () => {
    expect((await displaced()).placementReason.trim().length).toBeGreaterThan(0);
  });

  it('DR-03: the reason is read back from the store, not reconstructed by the caller', async () => {
    // The whole point of DR-03: FR-DSH-05 must be satisfiable from stored data alone.
    const stored = (await missed());
    expect(stored.placementReason).toEqual(expect.any(String));
    expect(stored.placementReason.trim().length).toBeGreaterThan(0);
  });
});

describe('DR-06 — each reschedule stores the trigger that caused it', () => {
  it('DR-06: a missed reschedule stores MISSED', async () => {
    expect((await missed()).rescheduleTrigger).toBe('MISSED');
  });

  it('DR-06: a skipped reschedule stores SKIPPED', async () => {
    expect((await skipped()).rescheduleTrigger).toBe('SKIPPED');
  });

  it('DR-06: a displaced reschedule stores DISPLACED', async () => {
    expect((await displaced()).rescheduleTrigger).toBe('DISPLACED');
  });

  it('DR-06: a placement that was never rescheduled carries no trigger', async () => {
    // "Absent means it has never been rescheduled" — the contract, on RescheduleTrigger.
    const h = makeHarness({ engine: engineByTask({}), now: at(19) });
    const original = placement({ id: 'p-read', taskId: 'read', start: at(20), end: at(20, 30) });
    h.repo.addTask(READ).addPlacement(original);

    await h.service.sweepElapsed(USER, TODAY);

    expect(h.repo.requirePlacement('p-read').rescheduleTrigger).toBeUndefined();
  });
});

describe('FR-RSC-04 — the stored sentence carries the task, the new time, and the trigger', () => {
  it('FR-RSC-04: the sentence names the task', async () => {
    expect((await missed()).placementReason).toContain('Read 30 minutes');
  });

  it('FR-RSC-04: the sentence states the new time', async () => {
    const stored = (await missed());
    expect(statesTime(stored.placementReason, stored.start)).toBe(true);
  });

  it('FR-RSC-04 / DR-06: a missed sentence differs from a skipped one', async () => {
    // Not a wording assertion — a distinguishability assertion. "This was missed this evening"
    // and "you skipped the 5:00 PM session" are different sentences, and a service that stored
    // one generic sentence for both would satisfy every other test in this file.
    expect((await missed()).placementReason).not.toEqual((await skipped()).placementReason);
  });

  it('FR-RSC-04 / DR-06: a displaced sentence differs from a missed one', async () => {
    expect((await displaced()).placementReason).not.toEqual((await missed()).placementReason);
  });

  it('FR-RSC-04: a displaced sentence names the commitment responsible', async () => {
    // UC-06: "Moved to 5:45 PM — your 5:00 PM slot was taken by Advisor." Only the caller can
    // write this: the engine receives `busy` as bare intervals with no titles. (The dashboard
    // requirement that DISPLAYS the sentence is not named in this test name on purpose — the
    // view is packets 13–15, and this suite specifies the stored data, not the rendering.)
    const stored = (await displaced());
    expect(stored.placementReason).toContain('Advisor');
    expect(statesTime(stored.placementReason, stored.start)).toBe(true);
  });

  it('FR-RSC-04: the notification data is on the returned outcome as well as in the store', async () => {
    const h = makeHarness({
      engine: engineByTask({ gym: placed(slot(at(20), at(21), 1)) }),
      now: at(15),
    });
    const original = placement({ id: 'p-gym', taskId: 'gym', start: at(17), end: at(18) });
    h.repo.addTask(GYM).addPlacement(original);

    const outcome = await h.service.onUserSkipped(original);

    if (outcome.kind !== 'RESCHEDULED') throw new Error('not rescheduled');
    expect(outcome.taskId).toBe('gym'); // the task
    expect(outcome.placement.start).toBe(at(20)); // its new time
    expect(outcome.trigger).toBe('SKIPPED'); // and the trigger
    expect(outcome.placement.placementReason.trim().length).toBeGreaterThan(0);
  });
});
