/**
 * FR-SCH-06 — "an explicit empty result with a reason ... It shall NOT silently drop the
 * task, and shall NOT place it in violation of its constraints."
 *
 * The last clause is this requirement's teeth, and the final test in this file is the one
 * that carries it: there must be no input for which the engine gives up and puts the task
 * somewhere invalid. That is the failure mode a demo makes visible by placing a workout on
 * top of a lecture.
 */
import type { Interval, Task } from '@capstone/shared';
import { findCandidateSlots } from '../src/index';

const DAY: Interval = { start: 420, end: 1380 };
const SHORT_DAY: Interval = { start: 420, end: 600 }; // 07:00–10:00, 180 minutes

const baseTask: Task = {
  id: 'gym',
  title: 'Gym',
  type: 'WORKOUT',
  durationMinutes: 60,
  priority: 2,
  preferredWindow: { start: 1020, end: 1080 },
  flexibility: 'FLEXIBLE',
  source: 'USER',
};

/** Assertion predicate. Computes no placement and finds no free gap. */
const overlaps = (a: { start: number; end: number }, b: Interval): boolean =>
  a.start < b.end && b.start < a.end;

describe('FR-SCH-06 explicit failure', () => {
  it('FR-SCH-06: reports DAY_FULL when every minute of the schedulable day is busy', () => {
    const result = findCandidateSlots([{ start: 420, end: 1380 }], baseTask, DAY);

    expect(result.placed).toBe(false);
    expect(result.placed === false && result.reason).toBe('DAY_FULL');
  });

  it('FR-SCH-06: reports NO_INTERVAL_LONG_ENOUGH when free gaps exist but none is long enough', () => {
    // Free: 420–450 (30), 480–510 (30), 540–600 (60). The task needs 90.
    const busy: readonly Interval[] = [
      { start: 450, end: 480 },
      { start: 510, end: 540 },
    ];
    const task: Task = {
      ...baseTask,
      durationMinutes: 90,
      preferredWindow: { start: 420, end: 600 },
    };

    const result = findCandidateSlots(busy, task, SHORT_DAY);

    expect(result.placed).toBe(false);
    expect(result.placed === false && result.reason).toBe('NO_INTERVAL_LONG_ENOUGH');
  });

  it('FR-SCH-06: reports WINDOW_OUTSIDE_SCHEDULABLE_DAY when the preferred window falls outside the day', () => {
    const task: Task = { ...baseTask, preferredWindow: { start: 60, end: 120 } };

    const result = findCandidateSlots([], task, DAY);

    expect(result.placed).toBe(false);
    expect(result.placed === false && result.reason).toBe(
      'WINDOW_OUTSIDE_SCHEDULABLE_DAY',
    );
  });

  it('FR-SCH-06: reports DURATION_EXCEEDS_SCHEDULABLE_DAY when the task is longer than the whole day', () => {
    const task: Task = {
      ...baseTask,
      durationMinutes: 240, // the short day is only 180 minutes long
      preferredWindow: { start: 420, end: 600 },
    };

    const result = findCandidateSlots([], task, SHORT_DAY);

    expect(result.placed).toBe(false);
    expect(result.placed === false && result.reason).toBe(
      'DURATION_EXCEEDS_SCHEDULABLE_DAY',
    );
  });

  it('FR-SCH-06: carries an empty slots array and a non-empty human-readable explanation on failure', () => {
    const result = findCandidateSlots([{ start: 420, end: 1380 }], baseTask, DAY);

    expect(result.placed).toBe(false);
    expect(result.slots).toHaveLength(0);
    if (result.placed === false) {
      expect(typeof result.explanation).toBe('string');
      expect(result.explanation.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * The teeth. Every one of these inputs is hostile in a different way. For each, the
   * engine may report failure — but if it reports success, every slot it returns must be
   * genuinely valid. What it may never do is place the task somewhere invalid to make the
   * problem go away (FR-SCH-06, NFR-ROB-03).
   */
  it('FR-SCH-06: never falls back to an invalid placement, for any hostile input', () => {
    const scenarios: ReadonlyArray<{
      name: string;
      busy: readonly Interval[];
      task: Task;
      day: Interval;
    }> = [
      {
        name: 'day entirely busy',
        busy: [{ start: 420, end: 1380 }],
        task: baseTask,
        day: DAY,
      },
      {
        name: 'every gap one minute short',
        busy: [
          { start: 479, end: 538 },
          { start: 597, end: 656 },
        ],
        task: { ...baseTask, durationMinutes: 60, preferredWindow: { start: 420, end: 1380 } },
        day: { start: 420, end: 715 },
      },
      {
        name: 'task longer than the day',
        busy: [],
        task: { ...baseTask, durationMinutes: 5000, preferredWindow: { start: 420, end: 1380 } },
        day: DAY,
      },
      {
        name: 'preferred window before the day starts',
        busy: [],
        task: { ...baseTask, preferredWindow: { start: 0, end: 60 } },
        day: DAY,
      },
      {
        name: 'preferred window after the day ends',
        busy: [],
        task: { ...baseTask, preferredWindow: { start: 1400, end: 1439 } },
        day: DAY,
      },
      {
        name: 'busy intervals overlapping and unsorted, covering everything',
        busy: [
          { start: 900, end: 1380 },
          { start: 420, end: 1000 },
          { start: 600, end: 950 },
        ],
        task: baseTask,
        day: DAY,
      },
    ];

    for (const { name, busy, task, day } of scenarios) {
      const result = findCandidateSlots(busy, task, day);

      if (!result.placed) {
        expect(result.slots).toHaveLength(0);
        expect(result.reason).toBeDefined();
        continue;
      }

      for (const slot of result.slots) {
        // `name` is in each message so a failure says WHICH hostile input broke it.
        expect([name, slot.end - slot.start]).toEqual([name, task.durationMinutes]);
        expect([name, slot.start >= day.start]).toEqual([name, true]);
        expect([name, slot.end <= day.end]).toEqual([name, true]);
        for (const b of busy) expect([name, overlaps(slot, b)]).toEqual([name, false]);
      }
    }
  });
});
