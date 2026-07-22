/**
 * NFR-PERF-01 — "a placement decision for a day of up to 50 busy intervals in under 200 ms,
 * at the 95th percentile over 100 consecutive invocations."
 */
import type { Interval, Task } from '@capstone/shared';
import { findCandidateSlots } from '../src/index';

const DAY: Interval = { start: 420, end: 1380 };

/** 50 busy intervals of 9 minutes, spaced 18 apart: 420–1311, leaving 69 free minutes. */
const FIFTY_BUSY: readonly Interval[] = Array.from({ length: 50 }, (_, i) => ({
  start: 420 + i * 18,
  end: 420 + i * 18 + 9,
}));

const task: Task = {
  id: 'gym',
  title: 'Gym',
  type: 'WORKOUT',
  durationMinutes: 30,
  priority: 2,
  preferredWindow: { start: 600, end: 660 },
  flexibility: 'FLEXIBLE',
  source: 'USER',
};

describe('NFR-PERF-01 performance', () => {
  it('NFR-PERF-01: decides a 50-interval day in under 200 ms at the 95th percentile of 100 calls', () => {
    const durations: number[] = [];

    for (let i = 0; i < 100; i += 1) {
      const startedAt = performance.now();
      findCandidateSlots(FIFTY_BUSY, task, DAY);
      durations.push(performance.now() - startedAt);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[94] ?? Number.POSITIVE_INFINITY;

    expect(p95).toBeLessThan(200);
  });
});
