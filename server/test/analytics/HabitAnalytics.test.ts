/**
 * 🔴 RED (packet 15a) — FROZEN once the second-human gate passes. FR-ANL-01/02/03/06 are (T);
 * these tests are written against the SRS + the contract, with NO implementation in view (§4.6).
 * Every test fails now because `analyzeHabit` throws `Error('15b')`; 15b GREEN makes them pass and
 * MAY NOT edit one.
 *
 * The unit under test is a PURE function over `Placement[]` — no Mongo, no clock — so the whole of
 * FR-ANL is pinned in memory, the way the engine's correctness is (NFR-COR-01).
 *
 * ── The resolution rules these tests pin (the RED author's reading of the SRS; the two flagged
 *    below go to the gate — see docs/P15A-RED-REPORT.md):
 *   • A calendar DATE is the unit, never a placement. Group by date, then resolve each date:
 *       COMPLETED      if any placement on the date is COMPLETED           (FR-ANL-03, FR-RSC-09)
 *       NOT_COMPLETED  else if any is MISSED or SKIPPED                    (FR-ANL-06)
 *       UNRESOLVED     else (PLANNED-only / CANCELLED-only / SUPERSEDED-only)
 *   • scheduled = distinct RESOLVED dates in the period (COMPLETED or NOT_COMPLETED).
 *   • completed = distinct COMPLETED dates in the period.
 *   • completionRate = scheduled === 0 ? 0 : completed / scheduled.
 *   • streak = walk resolved dates (≤ period.end) from the latest backward, counting consecutive
 *     COMPLETED until the first NOT_COMPLETED.
 *   • ⚠️ GATE-1: a SUPERSEDED-only date is UNRESOLVED — neither completed nor a missed occurrence of
 *     the habit (a workout replaced by a recommendation, FR-REC-02: nothing happened at the old time).
 *   • ⚠️ GATE-2: a PLANNED-only (not-yet-elapsed) date is UNRESOLVED — not counted until it resolves.
 */
import type { IsoDate, Placement, PlacementStatus, RescheduleTrigger } from '@capstone/shared';

import { analyzeHabit } from '../../src/analytics/HabitAnalytics';

const YEAR = { start: '2026-01-01', end: '2026-12-31' } as const;

let seq = 0;
const p = (
  date: IsoDate,
  status: PlacementStatus,
  trigger?: RescheduleTrigger,
): Placement => ({
  id: `pl-${seq++}`,
  taskId: 'habit-1',
  date,
  start: 480,
  end: 510,
  status,
  placementReason: 'test fixture',
  ...(trigger !== undefined ? { rescheduleTrigger: trigger } : {}),
});

/** `2026-06-01` + n days, as `YYYY-MM-DD`. */
const day = (n: number): IsoDate => {
  const d = new Date('2026-06-01T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('FR-ANL-01 — streak', () => {
  it('counts consecutive completed days ending at the most recent day', () => {
    const placements = [0, 1, 2, 3, 4].map((n) => p(day(n), 'COMPLETED'));
    expect(analyzeHabit(placements, YEAR).streak).toBe(5);
  });

  it('resets at a gap: a MISSED day between completions breaks the run', () => {
    const placements = [
      p(day(0), 'COMPLETED'),
      p(day(1), 'COMPLETED'),
      p(day(2), 'MISSED'),
      p(day(3), 'COMPLETED'), // most recent
    ];
    expect(analyzeHabit(placements, YEAR).streak).toBe(1);
  });

  it('is 0 when the most recent day was not completed', () => {
    const placements = [p(day(0), 'COMPLETED'), p(day(1), 'COMPLETED'), p(day(2), 'MISSED')];
    expect(analyzeHabit(placements, YEAR).streak).toBe(0);
  });
});

describe('FR-ANL-02 — completion rate', () => {
  it('is completed ÷ scheduled over the period', () => {
    const completedDays = Array.from({ length: 12 }, (_, i) => p(day(i), 'COMPLETED'));
    const missedDays = Array.from({ length: 8 }, (_, i) => p(day(12 + i), 'MISSED'));
    const result = analyzeHabit([...completedDays, ...missedDays], YEAR);
    expect(result.completed).toBe(12);
    expect(result.scheduled).toBe(20);
    expect(result.completionRate).toBeCloseTo(0.6, 10);
  });

  it('is 0 (never NaN) when nothing was scheduled in the period', () => {
    const result = analyzeHabit([], YEAR);
    expect(result.scheduled).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.completionRate).toBe(0);
  });

  it('excludes a not-yet-resolved PLANNED occurrence from the denominator (FR-ANL-02, GATE-2)', () => {
    // FR-ANL-02 (v2.31): "occurrence scheduled" = one whose window has ELAPSED. A PLANNED-only date
    // has no completion outcome yet, so it is in NEITHER term — a habit is not penalised for a day
    // that has not happened. (The /analytics endpoint sweeps elapsed occurrences to MISSED first,
    // so a past date the analytics sees is already resolved; a still-PLANNED date is treated as future.)
    const placements = [p(day(0), 'COMPLETED'), p(day(1), 'PLANNED')];
    const result = analyzeHabit(placements, YEAR);
    expect(result.scheduled).toBe(1); // only the resolved (COMPLETED) date
    expect(result.completed).toBe(1);
    expect(result.completionRate).toBe(1);
  });
});

describe('FR-ANL-03 — rescheduled then completed counts as completed', () => {
  it.each<RescheduleTrigger>(['MISSED', 'SKIPPED'])(
    'a date with a %s original and a later COMPLETED placement counts completed — the trigger is irrelevant',
    (trigger) => {
      const placements = [
        p(day(0), trigger === 'MISSED' ? 'MISSED' : 'SKIPPED'), // the original occurrence
        p(day(0), 'COMPLETED', trigger), // its reschedule, completed, same date
      ];
      const result = analyzeHabit(placements, YEAR);
      expect(result.completed).toBe(1);
      expect(result.scheduled).toBe(1);
      expect(result.streak).toBe(1);
    },
  );
});

describe('FR-RSC-09 — a withdrawn reschedule (CANCELLED) does not double-count', () => {
  it('a COMPLETED original with a CANCELLED reschedule is one completed occurrence', () => {
    const placements = [
      p(day(0), 'COMPLETED'), // original, marked complete
      p(day(0), 'CANCELLED', 'MISSED'), // the reschedule that was withdrawn (FR-RSC-09)
    ];
    const result = analyzeHabit(placements, YEAR);
    expect(result.completed).toBe(1);
    expect(result.scheduled).toBe(1);
  });
});

describe('FR-ANL-06 — a skipped occurrence never completed counts as not completed', () => {
  it('a SKIPPED-only date is scheduled but not completed, identical to a miss, and cannot be excluded', () => {
    const placements = [
      p(day(0), 'COMPLETED'),
      p(day(1), 'SKIPPED'), // declared skipped, never made up
      p(day(2), 'COMPLETED'), // most recent
    ];
    const result = analyzeHabit(placements, YEAR);
    expect(result.scheduled).toBe(3); // the skip IS in the denominator — no exclusion
    expect(result.completed).toBe(2);
    expect(result.streak).toBe(1); // the skip breaks the run just like a miss
  });

  it('skipped THEN rescheduled then completed counts as completed (FR-ANL-06 + FR-ANL-03)', () => {
    const placements = [
      p(day(0), 'SKIPPED'),
      p(day(0), 'COMPLETED', 'SKIPPED'), // re-placed after the skip, then completed
    ];
    const result = analyzeHabit(placements, YEAR);
    expect(result.completed).toBe(1);
    expect(result.scheduled).toBe(1);
  });
});

describe('the distinct-date invariant', () => {
  it('multiple placements on one date never inflate scheduled or completed beyond 1', () => {
    const placements = [
      p(day(0), 'MISSED'),
      p(day(0), 'MISSED', 'MISSED'),
      p(day(0), 'COMPLETED', 'MISSED'),
    ];
    const result = analyzeHabit(placements, YEAR);
    expect(result.scheduled).toBe(1);
    expect(result.completed).toBe(1);
  });
});

describe('SUPERSEDED — a replaced recommendation is not a user miss (GATE-1)', () => {
  it('a SUPERSEDED-only date is neither completed nor a scheduled-but-missed occurrence', () => {
    const placements = [
      p(day(0), 'COMPLETED'),
      p(day(1), 'SUPERSEDED'), // replaced by a recommendation (FR-REC-02) — nothing happened here
      p(day(2), 'COMPLETED'),
    ];
    const result = analyzeHabit(placements, YEAR);
    expect(result.scheduled).toBe(2); // the superseded date is excluded from the denominator
    expect(result.completed).toBe(2);
    expect(result.streak).toBe(2); // and does NOT break the streak (it is not a miss)
  });
});

describe('the completion rate is internally consistent (property)', () => {
  it('completed never exceeds scheduled, and the rate is their quotient, over many random days', () => {
    const statuses: PlacementStatus[] = ['COMPLETED', 'MISSED', 'SKIPPED'];
    for (let trial = 0; trial < 200; trial++) {
      const placements: Placement[] = [];
      const n = 1 + Math.floor(Math.random() * 30);
      for (let i = 0; i < n; i++) {
        const status = statuses[Math.floor(Math.random() * statuses.length)] ?? 'COMPLETED';
        placements.push(p(day(i), status));
      }
      const r = analyzeHabit(placements, YEAR);
      expect(r.completed).toBeLessThanOrEqual(r.scheduled);
      expect(r.completionRate).toBeCloseTo(r.scheduled === 0 ? 0 : r.completed / r.scheduled, 10);
    }
  });
});
