/**
 * NFR-COR-01 — "The engine shall never produce a placement that overlaps a busy interval."
 *
 * The System's central correctness invariant, over >= 1,000 generated cases.
 *
 * The enumerated tests verify the cases we thought of. This one verifies the cases we did
 * not, so the generators are deliberately hostile: busy intervals that overlap each other,
 * sit adjacent with no gap, spill outside the schedulable day, or span the whole of it;
 * preferred windows that straddle the day's edge or fall outside it entirely; and durations
 * that cannot possibly fit.
 *
 * ESCALATION E4: packet 04 also asks for zero-length busy intervals. The ratified contract
 * declares Interval's invariant as `end > start`, so generating them would test behaviour
 * outside the type's domain and could push packet 05 into defending against an input that
 * cannot occur. Generators respect the contract; the zero-GAP concern the row was aiming at
 * is covered by the FR-SCH-09 "adjacent, no gap" boundary test. Confirm at the gate.
 */
import * as fc from 'fast-check';
import type { Interval, Task } from '@capstone/shared';
import { findCandidateSlots } from '../src/index';

/** Assertion predicate. Computes no placement and finds no free gap. */
const overlaps = (a: { start: number; end: number }, b: Interval): boolean =>
  a.start < b.end && b.start < a.end;

const intervalArb = (maxLength: number): fc.Arbitrary<Interval> =>
  fc
    .tuple(fc.integer({ min: 0, max: 1439 }), fc.integer({ min: 1, max: maxLength }))
    .map(([start, length]) => ({ start, end: start + length }));

const scenarioArb = fc.record({
  day: fc
    .tuple(fc.integer({ min: 0, max: 600 }), fc.integer({ min: 60, max: 840 }))
    .map(([start, length]) => ({ start, end: start + length })),
  // Up to 12 busy intervals, free to overlap, abut, or span the entire day.
  busy: fc.array(intervalArb(1440), { maxLength: 12 }),
  preferredWindow: intervalArb(600),
  durationMinutes: fc.integer({ min: 1, max: 1000 }),
  priority: fc.integer({ min: 1, max: 5 }),
});

describe('NFR-COR-01 property: no placement ever overlaps a busy interval', () => {
  it('NFR-COR-01: holds every placement invariant over 1,000 randomised days and tasks', () => {
    fc.assert(
      fc.property(scenarioArb, ({ day, busy, preferredWindow, durationMinutes, priority }) => {
        const task: Task = {
          id: 'generated',
          title: 'Generated task',
          type: 'HABIT',
          durationMinutes,
          priority,
          preferredWindow,
          flexibility: 'FLEXIBLE',
          source: 'USER',
        };

        const result = findCandidateSlots(busy, task, day);

        // 6. placed === false implies an empty slot list and a stated reason.
        if (!result.placed) {
          expect(result.slots).toHaveLength(0);
          expect(result.reason).toBeDefined();
          return;
        }

        // 4. At most three slots.
        expect(result.slots.length).toBeLessThanOrEqual(3);

        // 5. Ranks are exactly 1..n, ascending, no duplicates.
        expect(result.slots.map((s) => s.rank)).toEqual(result.slots.map((_, i) => i + 1));

        for (const slot of result.slots) {
          // 1. No returned slot overlaps any busy interval. ← the central invariant
          for (const b of busy) expect(overlaps(slot, b)).toBe(false);

          // 2. Every slot lies entirely within the schedulable day.
          expect(slot.start).toBeGreaterThanOrEqual(day.start);
          expect(slot.end).toBeLessThanOrEqual(day.end);

          // 3. Every slot is exactly the task's duration.
          expect(slot.end - slot.start).toBe(durationMinutes);
        }
      }),
      { numRuns: 1000 },
    );
  });
});
