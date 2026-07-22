/**
 * FR-SCH-05 — the engine is a pure function.
 *
 * "Called twice with identical inputs it returns identical outputs; it performs no
 * database write, no HTTP call, and no mutation of its arguments."
 *
 * Mutation is the half an implementation actually gets wrong: sorting the caller's busy
 * array in place is the single likeliest way to violate this, and it is invisible until
 * some other module reads that array afterwards.
 */
import type { Interval, Task } from '@capstone/shared';
import { findCandidateSlots } from '../src/index';

const DAY: Interval = { start: 420, end: 1380 };

const busy: readonly Interval[] = [
  { start: 1020, end: 1065 },
  { start: 540, end: 615 },
  { start: 840, end: 960 },
];

const task: Task = {
  id: 'gym',
  title: 'Gym',
  type: 'WORKOUT',
  durationMinutes: 60,
  priority: 2,
  preferredWindow: { start: 1020, end: 1080 },
  flexibility: 'FLEXIBLE',
  source: 'USER',
};

/** Test infrastructure, not engine logic: it freezes objects and computes no placement. */
const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
};

describe('FR-SCH-05 purity', () => {
  it('FR-SCH-05: does not mutate its arguments, even when they are deeply frozen', () => {
    const frozenBusy = deepFreeze([...busy].map((i) => ({ ...i })));
    const frozenTask = deepFreeze({ ...task, preferredWindow: { ...task.preferredWindow } });
    const frozenDay = deepFreeze({ ...DAY });

    // A frozen object throws on write in strict mode, so an in-place sort fails loudly here.
    expect(() => findCandidateSlots(frozenBusy, frozenTask, frozenDay)).not.toThrow();
  });

  it('FR-SCH-05: leaves the caller\'s busy array unchanged in contents and order', () => {
    const input: Interval[] = [...busy].map((i) => ({ ...i }));
    const before = JSON.stringify(input);

    findCandidateSlots(input, task, DAY);

    expect(JSON.stringify(input)).toBe(before);
  });

  it('FR-SCH-05: leaves the caller\'s task and schedulable day unchanged', () => {
    const inputTask: Task = { ...task, preferredWindow: { ...task.preferredWindow } };
    const inputDay: Interval = { ...DAY };
    const taskBefore = JSON.stringify(inputTask);
    const dayBefore = JSON.stringify(inputDay);

    findCandidateSlots([...busy], inputTask, inputDay);

    expect(JSON.stringify(inputTask)).toBe(taskBefore);
    expect(JSON.stringify(inputDay)).toBe(dayBefore);
  });

  it('FR-SCH-05: returns deeply equal results when called twice with identical inputs', () => {
    const first = findCandidateSlots(busy, task, DAY);
    const second = findCandidateSlots(busy, task, DAY);

    expect(second).toEqual(first);
  });

  it('FR-SCH-05: returns a slots array that is not a reference to any input array', () => {
    const input: Interval[] = [...busy];

    const result = findCandidateSlots(input, task, DAY);

    const slots = result.placed ? result.slots : [];
    expect(slots).not.toBe(input);
    expect(slots as unknown).not.toBe(busy as unknown);
  });
});
