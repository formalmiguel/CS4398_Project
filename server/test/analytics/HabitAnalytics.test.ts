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
 *   • ⚠️ GATE-2: a PLANNED-only date resolves against `asOf` (FR-ANL-02 v2.31, "window has ELAPSED"):
 *       date  <  asOf  → the window elapsed → NOT_COMPLETED (a miss, even if FR-RSC-10 has not yet
 *                        swept it — a day the user never opened must not inflate the rate);
 *       date  ≥  asOf  → not yet elapsed → UNRESOLVED (excluded — it has not happened).
 *     `asOf` is passed in, never read from a clock (purity — §4.7). The date-granularity boundary
 *     (`date < asOf`, so an occurrence on `asOf`'s own day is still in progress) is the RED author's
 *     reading and is flagged to the gate — see docs/P15A-RED-REPORT.md.
 */
import * as fc from 'fast-check';
import type { IsoDate, Placement, PlacementStatus, RescheduleTrigger } from '@capstone/shared';

import { analyzeHabit } from '../../src/analytics/HabitAnalytics';

const YEAR = { start: '2026-01-01', end: '2026-12-31' } as const;

/**
 * Default reference "now" for tests that carry no PLANNED occurrences: well after every fixture date,
 * so every terminal-status date has already elapsed and `asOf` cannot change their resolution. Tests
 * that exercise the FR-ANL-02 elapsed boundary pass their own `asOf` explicitly.
 */
const AS_OF: IsoDate = '2027-06-01';

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
    expect(analyzeHabit(placements, YEAR, AS_OF).streak).toBe(5);
  });

  it('resets at a gap: a MISSED day between completions breaks the run', () => {
    const placements = [
      p(day(0), 'COMPLETED'),
      p(day(1), 'COMPLETED'),
      p(day(2), 'MISSED'),
      p(day(3), 'COMPLETED'), // most recent
    ];
    expect(analyzeHabit(placements, YEAR, AS_OF).streak).toBe(1);
  });

  it('is 0 when the most recent day was not completed', () => {
    const placements = [p(day(0), 'COMPLETED'), p(day(1), 'COMPLETED'), p(day(2), 'MISSED')];
    expect(analyzeHabit(placements, YEAR, AS_OF).streak).toBe(0);
  });

  it('a weekly habit: three completed occurrences 7 days apart give a streak of 3, not 1 (FR-ANL-01)', () => {
    // A weekly (e.g. Monday-only) habit has NO placement on the six intervening days — they are not
    // occurrences of the habit, so they are absent from the walk and cannot break the run. The streak
    // counts consecutive completed OCCURRENCES, not calendar days.
    //
    // This is compelled by the SRS read whole — NOT a loosening of FR-ANL-01's "days": FR-ANL-07 (v2.31)
    // says a SUPERSEDED occurrence does not break a streak, and the SUPERSEDED test below pins it — so a
    // strict consecutive-calendar-days reading is already impossible (it would give that test streak 1,
    // not 2). A day the System excused cannot break the streak while a day the habit was never scheduled
    // does; the only coherent rule skips both. (See docs/P15A-RED-REPORT.md, item ②, and OPEN-30.)
    const asOf = day(20);
    const placements = [p(day(0), 'COMPLETED'), p(day(7), 'COMPLETED'), p(day(14), 'COMPLETED')];
    expect(analyzeHabit(placements, YEAR, asOf).streak).toBe(3);
  });
});

describe('FR-ANL-02 — completion rate', () => {
  it('is completed ÷ scheduled over the period', () => {
    const completedDays = Array.from({ length: 12 }, (_, i) => p(day(i), 'COMPLETED'));
    const missedDays = Array.from({ length: 8 }, (_, i) => p(day(12 + i), 'MISSED'));
    const result = analyzeHabit([...completedDays, ...missedDays], YEAR, AS_OF);
    expect(result.completed).toBe(12);
    expect(result.scheduled).toBe(20);
    expect(result.completionRate).toBeCloseTo(0.6, 10);
  });

  it('is 0 (never NaN) when nothing was scheduled in the period', () => {
    const result = analyzeHabit([], YEAR, AS_OF);
    expect(result.scheduled).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.completionRate).toBe(0);
  });

  it('excludes a PLANNED occurrence whose window has NOT yet elapsed as of asOf (FR-ANL-02, GATE-2)', () => {
    // FR-ANL-02 (v2.31): "occurrence scheduled" = one whose window has ELAPSED. day(1) is on asOf's
    // own day (date >= asOf), so its window has not elapsed — it is in NEITHER term. A habit is not
    // penalised for a day that has not happened yet.
    const asOf = day(1);
    const placements = [p(day(0), 'COMPLETED'), p(day(1), 'PLANNED')];
    const result = analyzeHabit(placements, YEAR, asOf);
    expect(result.scheduled).toBe(1); // only the resolved (COMPLETED) date
    expect(result.completed).toBe(1);
    expect(result.completionRate).toBe(1);
  });

  it('counts a PLANNED occurrence whose window HAS elapsed but was never swept (FR-ANL-02, GATE-2)', () => {
    // The load-bearing case: FR-RSC-10 sweeps elapsed→MISSED only on RETRIEVAL, so a day the user
    // never opened is still PLANNED. Analytics must not let that inflate the rate — an elapsed,
    // uncompleted day is a miss whether or not the sweep has run. day(1) < asOf ⇒ its window elapsed.
    // Without asOf the function had to exclude every PLANNED, silently OVERSTATING completion.
    const asOf = day(5);
    const placements = [p(day(0), 'COMPLETED'), p(day(1), 'PLANNED')];
    const result = analyzeHabit(placements, YEAR, asOf);
    expect(result.scheduled).toBe(2); // the elapsed-but-unswept day is in the denominator
    expect(result.completed).toBe(1);
    expect(result.completionRate).toBeCloseTo(0.5, 10);
  });

  it('an elapsed unswept PLANNED breaks the streak exactly like a MISSED day (FR-ANL-01 + FR-ANL-02)', () => {
    // Consequence of the rule above: an elapsed PLANNED that counts in the denominator as
    // not-completed must ALSO resolve as NOT_COMPLETED for the streak, or `scheduled` and `streak`
    // would disagree about the same date. ⚠️ GATE: this streak pin follows from — but goes beyond —
    // the denominator direction Patrick raised; confirm at the review. See docs/P15A-RED-REPORT.md.
    const asOf = day(3);
    const placements = [p(day(0), 'COMPLETED'), p(day(1), 'PLANNED'), p(day(2), 'COMPLETED')];
    const result = analyzeHabit(placements, YEAR, asOf);
    expect(result.streak).toBe(1); // most recent day(2) COMPLETED; the elapsed day(1) miss caps it
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
      const result = analyzeHabit(placements, YEAR, AS_OF);
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
    const result = analyzeHabit(placements, YEAR, AS_OF);
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
    const result = analyzeHabit(placements, YEAR, AS_OF);
    expect(result.scheduled).toBe(3); // the skip IS in the denominator — no exclusion
    expect(result.completed).toBe(2);
    expect(result.streak).toBe(1); // the skip breaks the run just like a miss
  });

  it('skipped THEN rescheduled then completed counts as completed (FR-ANL-06 + FR-ANL-03)', () => {
    const placements = [
      p(day(0), 'SKIPPED'),
      p(day(0), 'COMPLETED', 'SKIPPED'), // re-placed after the skip, then completed
    ];
    const result = analyzeHabit(placements, YEAR, AS_OF);
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
    const result = analyzeHabit(placements, YEAR, AS_OF);
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
    const result = analyzeHabit(placements, YEAR, AS_OF);
    expect(result.scheduled).toBe(2); // the superseded date is excluded from the denominator
    expect(result.completed).toBe(2);
    expect(result.streak).toBe(2); // and does NOT break the streak (it is not a miss)
  });
});

describe('the per-date fold holds over generated schedules (property)', () => {
  // fast-check, SEEDED — a failure is reproducible and shrinks to a minimal counterexample. That
  // matters doubly here: jest.setup.ts sets jest.retryTimes(2) (OPEN-25), which would silently
  // re-roll an unseeded random test until it passed; a fixed seed makes every retry fail identically
  // on the same case, so a real defect stays red instead of hiding.
  const ANY_STATUS: PlacementStatus[] = ['PLANNED', 'COMPLETED', 'MISSED', 'SKIPPED', 'CANCELLED', 'SUPERSEDED'];
  const anyRows = fc.array(
    fc.record({ offset: fc.integer({ min: 0, max: 40 }), status: fc.constantFrom(...ANY_STATUS) }),
    { maxLength: 60 },
  );

  it('never inflates a date, never exceeds the distinct dates present, and streak ≤ completed', () => {
    // These are the invariants a "rate ≈ completed/scheduled" check CANNOT express: they constrain
    // the per-date fold (multiple placements per date — reschedules, withdrawals, replacements) and
    // the asOf-relative resolution, which is where the actual FR-ANL-01/02/03/06 logic lives.
    fc.assert(
      fc.property(anyRows, fc.integer({ min: 0, max: 45 }), (raw, asOfOffset) => {
        const placements = raw.map((r) => p(day(r.offset), r.status));
        const result = analyzeHabit(placements, YEAR, day(asOfOffset));
        const distinctDates = new Set(raw.map((r) => r.offset)).size;

        expect(Number.isNaN(result.completionRate)).toBe(false);
        expect(result.completionRate).toBeGreaterThanOrEqual(0);
        expect(result.completionRate).toBeLessThanOrEqual(1);
        expect(result.completed).toBeLessThanOrEqual(result.scheduled);
        expect(result.scheduled).toBeLessThanOrEqual(distinctDates);
        expect(result.streak).toBeLessThanOrEqual(result.completed);
        expect(result.completionRate).toBeCloseTo(
          result.scheduled === 0 ? 0 : result.completed / result.scheduled,
          10,
        );
      }),
      { seed: 15, numRuns: 300 },
    );
  });

  it('adding a CANCELLED or SUPERSEDED placement to any date never changes completed or scheduled', () => {
    // FR-RSC-09 (a withdrawn reschedule) and GATE-1 (a superseded replacement) are non-events for the
    // count. This is the invariant a tautological check silently passes over: a CANCELLED/SUPERSEDED
    // row must be inert — it can neither add a scheduled date nor un-complete one.
    const RESOLVED: PlacementStatus[] = ['COMPLETED', 'MISSED', 'SKIPPED'];
    const NON_EVENT: PlacementStatus[] = ['CANCELLED', 'SUPERSEDED'];
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ offset: fc.integer({ min: 0, max: 20 }), status: fc.constantFrom(...RESOLVED) }),
          { minLength: 1, maxLength: 30 },
        ),
        fc.integer({ min: 0, max: 20 }),
        fc.constantFrom(...NON_EVENT),
        (raw, noiseOffset, noiseStatus) => {
          const base = raw.map((r) => p(day(r.offset), r.status));
          const before = analyzeHabit(base, YEAR, day(60));
          const after = analyzeHabit([...base, p(day(noiseOffset), noiseStatus)], YEAR, day(60));
          expect(after.completed).toBe(before.completed);
          expect(after.scheduled).toBe(before.scheduled);
        },
      ),
      { seed: 15, numRuns: 300 },
    );
  });
});
