/**
 * FR-SCH-09 — the eight required boundary rows, one `it()` each (NFR-COR-03).
 *
 * Transcribed from docs/SRS-v2.md §3.8.4. Where a row does not pin a value, this file
 * asserts only what the row states. See the packet 04 escalation report for the two
 * places where the SRS is silent and this suite therefore stays silent too.
 */
import type { Interval, Task } from '@capstone/shared';
import { findCandidateSlots } from '../src/index';

/** 07:00–23:00 — the schedulable day used throughout SRS Appendix A. */
const DAY: Interval = { start: 420, end: 1380 };

const baseTask: Task = {
  id: 'gym',
  title: 'Gym',
  type: 'WORKOUT',
  durationMinutes: 60,
  priority: 2,
  preferredWindow: { start: 1020, end: 1080 }, // 17:00–18:00
  flexibility: 'FLEXIBLE',
  source: 'USER',
};

/**
 * Assertion predicate over half-open intervals. NOT engine logic: it computes no
 * placement and finds no free gap. It only checks a returned slot against an input.
 */
const overlaps = (a: { start: number; end: number }, b: Interval): boolean =>
  a.start < b.end && b.start < a.end;

describe('FR-SCH-09 boundary cases', () => {
  it('FR-SCH-09: places the task at the start of its preferred window when the day is entirely empty', () => {
    const result = findCandidateSlots([], baseTask, DAY);

    expect(result.placed).toBe(true);
    const slots = result.placed ? result.slots : [];
    expect(slots[0]?.start).toBe(1020);
    expect(slots[0]?.end).toBe(1080);
    expect(slots[0]?.rank).toBe(1);
    expect(slots[0]?.withinPreferredWindow).toBe(true);
  });

  /**
   * ESCALATION E3 — cardinality of a successful in-window placement.
   * FR-SCH-01 says "return A placement" (singular) and Appendix A returns a single slot,
   * but the SRS never states it outright. Kept as its own `it()` so the human gate can
   * delete exactly one test if it decides otherwise, rather than untangling an assertion.
   */
  it('FR-SCH-01: returns exactly one slot when the preferred window itself works (E3 — confirm at gate)', () => {
    const result = findCandidateSlots([], baseTask, DAY);

    const slots = result.placed ? result.slots : [];
    expect(slots).toHaveLength(1);
  });

  it('FR-SCH-09: returns an explicit empty result with a reason when the day is entirely full', () => {
    const busy: Interval[] = [{ start: 420, end: 1380 }];

    const result = findCandidateSlots(busy, baseTask, DAY);

    expect(result.placed).toBe(false);
    expect(result.slots).toHaveLength(0);
    expect(result.placed === false && result.reason).toBe('DAY_FULL');
  });

  it('FR-SCH-09: places the task when a free interval exactly equals its duration', () => {
    // Free interval 17:00–18:00 is exactly 60 minutes. SRS Appendix A, first placement.
    const busy: Interval[] = [
      { start: 420, end: 1020 },
      { start: 1080, end: 1380 },
    ];

    const result = findCandidateSlots(busy, baseTask, DAY);

    expect(result.placed).toBe(true);
    const slots = result.placed ? result.slots : [];
    expect(slots[0]?.start).toBe(1020);
    expect(slots[0]?.end).toBe(1080);
    for (const slot of slots) {
      for (const b of busy) expect(overlaps(slot, b)).toBe(false);
    }
  });

  /**
   * The row reads "Rejected; engine continues searching" — TWO obligations. An engine that
   * rejects the short gap and then gives up satisfies the first half and fails the
   * requirement. The second assertion is the one that matters.
   */
  it('FR-SCH-09: rejects a free interval one minute short and keeps searching, placing the task elsewhere', () => {
    // Free: 1021–1080 (59 min — one short of 60) and 1200–1380 (180 min).
    const busy: Interval[] = [
      { start: 420, end: 1021 },
      { start: 1080, end: 1200 },
    ];

    const result = findCandidateSlots(busy, baseTask, DAY);

    expect(result.placed).toBe(true);
    const slots = result.placed ? result.slots : [];
    expect(slots.length).toBeGreaterThan(0);

    // It did not squeeze into the 59-minute gap...
    for (const slot of slots) {
      expect(slot.start).not.toBe(1021);
      expect(slot.end - slot.start).toBe(60);
      for (const b of busy) expect(overlaps(slot, b)).toBe(false);
    }
    // ...and it did not give up: the only sufficient region is 1200–1380.
    expect(slots[0]?.start).toBe(1200);
  });

  it('FR-SCH-09: places a task whose duration equals the whole schedulable day when the day is empty', () => {
    const wholeDayTask: Task = {
      ...baseTask,
      durationMinutes: 960, // 07:00–23:00
      preferredWindow: { start: 420, end: 1380 },
    };

    const result = findCandidateSlots([], wholeDayTask, DAY);

    expect(result.placed).toBe(true);
    const slots = result.placed ? result.slots : [];
    expect(slots[0]?.start).toBe(420);
    expect(slots[0]?.end).toBe(1380);
  });

  it('FR-SCH-09: refuses a task whose duration equals the whole schedulable day when the day is not empty', () => {
    const wholeDayTask: Task = {
      ...baseTask,
      durationMinutes: 960,
      preferredWindow: { start: 420, end: 1380 },
    };
    const busy: Interval[] = [{ start: 600, end: 660 }];

    const result = findCandidateSlots(busy, wholeDayTask, DAY);

    expect(result.placed).toBe(false);
    expect(result.slots).toHaveLength(0);
    expect(result.placed === false && result.reason).toBe('NO_INTERVAL_LONG_ENOUGH');
  });

  /**
   * A merge bug returns {start: 660, end: 660} — a zero-length slot that overlaps nothing
   * and is nonsense. This asserts it cannot appear.
   */
  it('FR-SCH-09: treats two adjacent busy intervals as one and returns no zero-length slot', () => {
    const busy: Interval[] = [
      { start: 600, end: 660 },
      { start: 660, end: 720 },
    ];
    const task: Task = { ...baseTask, preferredWindow: { start: 600, end: 720 } };

    const result = findCandidateSlots(busy, task, DAY);

    const slots = result.placed ? result.slots : [];
    for (const slot of slots) {
      expect(slot.end).toBeGreaterThan(slot.start);
      expect(slot.end - slot.start).toBe(60);
      expect(overlaps(slot, { start: 600, end: 720 })).toBe(false);
    }
  });

  it('FR-SCH-09: merges overlapping busy intervals and produces no placement inside the overlap', () => {
    const busy: Interval[] = [
      { start: 600, end: 720 },
      { start: 660, end: 780 },
    ];
    const task: Task = { ...baseTask, preferredWindow: { start: 600, end: 780 } };

    const result = findCandidateSlots(busy, task, DAY);

    const slots = result.placed ? result.slots : [];
    for (const slot of slots) {
      expect(slot.end - slot.start).toBe(60);
      // The merged busy region is 600–780. Nothing may land anywhere inside it.
      expect(overlaps(slot, { start: 600, end: 780 })).toBe(false);
    }
  });

  it('FR-SCH-09: returns an explicit empty result when the preferred window lies entirely outside the schedulable day', () => {
    const nightTask: Task = {
      ...baseTask,
      preferredWindow: { start: 60, end: 120 }, // 01:00–02:00, before the day starts
    };

    const result = findCandidateSlots([], nightTask, DAY);

    expect(result.placed).toBe(false);
    expect(result.slots).toHaveLength(0);
    expect(result.placed === false && result.reason).toBe('WINDOW_OUTSIDE_SCHEDULABLE_DAY');
  });
});
