/**
 * FR-SCH-02 (up to three ranked candidates) and FR-SCH-03 (the ranking rule).
 *
 * The headline test transcribes SRS Appendix A's worked example, including its expected
 * ordering. That example is the SRS handing us an oracle, so it is used verbatim rather
 * than paraphrased.
 */
import type { Interval, Task } from '@capstone/shared';
import { findCandidateSlots } from '../src/index';

const DAY: Interval = { start: 420, end: 1380 };

const gym: Task = {
  id: 'gym',
  title: 'Gym',
  type: 'WORKOUT',
  durationMinutes: 60,
  priority: 2,
  preferredWindow: { start: 1020, end: 1080 }, // 17:00–18:00
  flexibility: 'FLEXIBLE',
  source: 'USER',
};

/** SRS Appendix A, after the user adds the fixed "Advisor, 17:00–17:45" commitment. */
const APPENDIX_A_BUSY: readonly Interval[] = [
  { start: 540, end: 615 }, // 09:00–10:15 CS 401 Lecture
  { start: 720, end: 750 }, // 12:00–12:30 Lunch
  { start: 840, end: 960 }, // 14:00–16:00 Lab
  { start: 1020, end: 1065 }, // 17:00–17:45 Advisor
  { start: 1140, end: 1200 }, // 19:00–20:00 Team Meeting
];

describe('FR-SCH-02 / FR-SCH-03 ranked candidates', () => {
  it('FR-SCH-03: ranks candidates by proximity to the preferred window, per SRS Appendix A', () => {
    const result = findCandidateSlots(APPENDIX_A_BUSY, gym, DAY);

    expect(result.placed).toBe(true);
    const slots = result.placed ? result.slots : [];

    // Appendix A states this ordering explicitly:
    //   1. 17:45–18:45  (starts  45 min after preferred start)  ← selected
    //   2. 16:00–17:00  (starts  60 min before preferred start)
    //   3. 20:00–21:00  (starts 180 min after preferred start)
    expect(slots.map((s) => [s.start, s.end, s.rank])).toEqual([
      [1065, 1125, 1],
      [960, 1020, 2],
      [1200, 1260, 3],
    ]);
  });

  it('FR-SCH-02: returns at most three candidate slots however many free intervals exist', () => {
    // Seven free regions of >= 60 minutes; the preferred window is fully busy.
    const busy: readonly Interval[] = [
      { start: 480, end: 540 },
      { start: 600, end: 660 },
      { start: 720, end: 780 },
      { start: 840, end: 900 },
      { start: 960, end: 1020 },
      { start: 1080, end: 1140 },
    ];
    const task: Task = { ...gym, preferredWindow: { start: 480, end: 540 } };

    const result = findCandidateSlots(busy, task, DAY);

    const slots = result.placed ? result.slots : [];
    expect(slots.length).toBeLessThanOrEqual(3);
  });

  it('FR-SCH-02: numbers ranks densely and ascending from 1', () => {
    const result = findCandidateSlots(APPENDIX_A_BUSY, gym, DAY);

    const slots = result.placed ? result.slots : [];
    expect(slots.map((s) => s.rank)).toEqual(slots.map((_, i) => i + 1));
  });

  /**
   * Both candidates sit exactly 60 minutes from the preferred window start — one before,
   * one after — so criterion (a) cannot separate them. Criterion (b), earlier start, decides.
   */
  it('FR-SCH-03: breaks a remaining proximity tie by earlier start time', () => {
    const busy: readonly Interval[] = [
      { start: 420, end: 960 },
      { start: 1020, end: 1080 }, // the preferred window itself, fully busy
      { start: 1140, end: 1380 },
    ];

    const result = findCandidateSlots(busy, gym, DAY);

    expect(result.placed).toBe(true);
    const slots = result.placed ? result.slots : [];
    expect(slots.map((s) => [s.start, s.rank])).toEqual([
      [960, 1],
      [1080, 2],
    ]);
  });

  /*
   * ESCALATION E1 — RESOLVED 22 Jul, no test needed.
   *
   * FR-SCH-03 formerly ranked by "the task's priority relative to neighbors" as its
   * middle criterion. It was removed in SRS v2.7: the engine receives `readonly
   * Interval[]`, and an Interval is `{start, end}` — there is no neighbour priority to
   * read, and the placed task's own priority is identical across its candidate slots so
   * it can never break a tie. Ranking is now proximity, then earlier start, both tested
   * above. Priority still matters for FR-SCH-07 (Conditional, out of scope).
   */

  describe('NFR-COR-02 determinism', () => {
    it('NFR-COR-02: returns deeply identical output, including array order, across ten identical calls', () => {
      const first = findCandidateSlots(APPENDIX_A_BUSY, gym, DAY);

      for (let i = 0; i < 9; i += 1) {
        expect(findCandidateSlots(APPENDIX_A_BUSY, gym, DAY)).toEqual(first);
      }
    });

    it('NFR-COR-02: does not inherit the ordering of the caller\'s busy array', () => {
      const ordered = findCandidateSlots(APPENDIX_A_BUSY, gym, DAY);

      const shuffled: readonly Interval[] = [
        APPENDIX_A_BUSY[3] as Interval,
        APPENDIX_A_BUSY[0] as Interval,
        APPENDIX_A_BUSY[4] as Interval,
        APPENDIX_A_BUSY[2] as Interval,
        APPENDIX_A_BUSY[1] as Interval,
      ];

      expect(findCandidateSlots(shuffled, gym, DAY)).toEqual(ordered);
    });

    it('NFR-COR-02: is unaffected by a fully reversed busy array', () => {
      const ordered = findCandidateSlots(APPENDIX_A_BUSY, gym, DAY);

      expect(findCandidateSlots([...APPENDIX_A_BUSY].reverse(), gym, DAY)).toEqual(ordered);
    });
  });
});
