/**
 * THE SCHEDULING ENGINE — FR-SCH-01 … FR-SCH-06, FR-SCH-09.
 *
 * One exported function. Given a day's busy intervals, one task, and the bounds of the
 * schedulable day, it returns where that task fits. It is a PURE function (FR-SCH-05):
 * it reads no clock, touches no database, performs no I/O, and mutates nothing it is
 * given. Every array it sorts is a copy it made itself.
 *
 * What is deliberately NOT here:
 *   - FR-SCH-07 / FR-SCH-08 (priority displacement) — Conditional, out of scope.
 *   - FR-SCH-10 (placement order across several tasks) — an obligation on the CALLER.
 *     This function places ONE task; ordering several is a service-level concern.
 *     `task.priority` is therefore read by nothing in this file, and that is correct.
 */
import type {
  FindCandidateSlots,
  Interval,
  Minute,
  NoSlotReason,
  PlacementResult,
  Slot,
  Task,
} from '@capstone/shared';

/** FR-SCH-02: "up to three ranked candidate slots". */
const MAX_CANDIDATES = 3;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const HOURS_PER_HALF_DAY = 12;

/**
 * Renders a `Minute` as a wall-clock label for the human-readable explanations
 * (FR-DSH-05). Pure integer arithmetic on the offset it is handed — the engine still
 * has no idea what day it is, or whether one is in progress.
 */
const clockLabel = (minute: Minute): string => {
  const wrapped = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(wrapped / MINUTES_PER_HOUR);
  const hour12 = ((hour24 + HOURS_PER_HALF_DAY - 1) % HOURS_PER_HALF_DAY) + 1;
  const suffix = hour24 < HOURS_PER_HALF_DAY ? 'AM' : 'PM';
  const minutes = String(wrapped % MINUTES_PER_HOUR).padStart(2, '0');
  return `${hour12}:${minutes} ${suffix}`;
};

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high);

/**
 * FR-SCH-09, rows 6 and 7: adjacent intervals are treated as one, and overlapping
 * intervals are merged, so no candidate can ever be produced inside the union.
 *
 * Busy intervals are clipped to the schedulable day first: a commitment that spills past
 * the user's bedtime constrains nothing the engine may place anyway, and clipping keeps
 * the free-gap arithmetic below honest.
 *
 * `.map()` and `.filter()` each build a NEW array, so the `.sort()` here sorts a copy.
 * Sorting `busy` itself would mutate the caller's array and violate FR-SCH-05.
 */
const mergeBusyIntervals = (busy: readonly Interval[], day: Interval): Interval[] => {
  const clipped = busy
    .map((b) => ({ start: Math.max(b.start, day.start), end: Math.min(b.end, day.end) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const b of clipped) {
    const last = merged[merged.length - 1];
    if (last !== undefined && b.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, b.end) };
    } else {
      merged.push(b);
    }
  }
  return merged;
};

/**
 * The gaps between merged busy intervals, in ascending order. Zero-length gaps are never
 * emitted — FR-SCH-09 row 6 forbids the zero-length slot that an off-by-one here produces.
 */
const freeIntervals = (merged: readonly Interval[], day: Interval): Interval[] => {
  const free: Interval[] = [];
  let cursor = day.start;
  for (const b of merged) {
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    cursor = b.end;
  }
  if (day.end > cursor) free.push({ start: cursor, end: day.end });
  return free;
};

/**
 * FR-SCH-03(a) — "proximity of start time to the preferred window", measured from the
 * window's START. SRS Appendix A states its own ranking that way ("starts 45 min after
 * preferred start", "starts 60 min before preferred start"), and that reading is what
 * makes a candidate 60 minutes BEFORE the window tie with one 60 minutes AFTER it, to be
 * separated by criterion (b).
 */
const distanceFromPreferred = (start: Minute, task: Task): number =>
  Math.abs(start - task.preferredWindow.start);

/**
 * FR-SCH-02, positioning rule (SRS v2.9, closing OPEN-13): within a free interval longer
 * than the task, the candidate starts at the fitting position CLOSEST to the preferred
 * window. Clamping the preferred start into the interval's fitting range is exactly that:
 * a free 07:00–10:00 offers 09:00 to a 60-minute task preferring 17:00, not 07:00.
 */
const candidateStart = (free: Interval, task: Task): Minute =>
  clamp(task.preferredWindow.start, free.start, free.end - task.durationMinutes);

/**
 * FR-DSH-05 — the sentence the user reads to understand why the task is where it is.
 *
 * ⚠️ It must be true of THIS slot, not of the set the slot came from. An earlier draft
 * gave every candidate "the nearest free time to your preferred window" — a claim only
 * rank 1 can make, which left ranks 2 and 3 carrying a sentence that was simply false.
 * FR-DSH-05 is verified by a reader with no knowledge of the algorithm, and three
 * alternatives each announcing they are the nearest fails exactly that reading.
 *
 * So each alternative names its own place in the ranking, and states the rule the ranking
 * used, so that a reader who is shown only one of the three still knows what "nearest"
 * was measured against.
 */
const explain = (slot: Omit<Slot, 'explanation'>, total: number, task: Task): string => {
  const when = `${clockLabel(slot.start)} to ${clockLabel(slot.end)}`;
  const preferred = clockLabel(task.preferredWindow.start);

  if (slot.withinPreferredWindow) {
    return `${when} — inside your preferred window.`;
  }
  if (total === 1) {
    return (
      `${when} — the only free block long enough, placed as close to your preferred ` +
      `${preferred} start as it fits.`
    );
  }
  return (
    `${when} — alternative ${slot.rank} of ${total}, ranked by nearness to your preferred ` +
    `${preferred} start; that window had no free block long enough.`
  );
};

const toSlot = (start: Minute, rank: number, total: number, task: Task): Slot => {
  const end = start + task.durationMinutes;
  const draft: Omit<Slot, 'explanation'> = {
    start,
    end,
    rank,
    withinPreferredWindow:
      start >= task.preferredWindow.start && end <= task.preferredWindow.end,
  };
  return { ...draft, explanation: explain(draft, total, task) };
};

/**
 * FR-SCH-03 — rank by proximity, then by earlier start as the final tiebreaker, then keep
 * the best three. The tiebreaker is load-bearing rather than decorative: without it the
 * order of two equidistant candidates would fall out of the caller's array order, and
 * NFR-COR-02's determinism claim would be false.
 */
const rankSlots = (starts: readonly Minute[], task: Task): Slot[] => {
  const best = [...starts]
    .sort((a, b) => distanceFromPreferred(a, task) - distanceFromPreferred(b, task) || a - b)
    .slice(0, MAX_CANDIDATES);

  // `best.length` is settled before any explanation is written, because each alternative's
  // sentence has to name how many alternatives there are alongside it.
  return best.map((start, index) => toSlot(start, index + 1, best.length, task));
};

/**
 * FR-SCH-06 — an explicit empty result WITH a reason. Never a silent empty list, and
 * never a placement forced into an invalid position to make the problem disappear.
 */
const noSlot = (reason: NoSlotReason, explanation: string): PlacementResult => ({
  placed: false,
  slots: [],
  reason,
  explanation,
});

export const findCandidateSlots: FindCandidateSlots = (busy, task, schedulableDay) => {
  const { preferredWindow, durationMinutes, title } = task;

  // FR-SCH-09, final row: a preferred window lying wholly outside the schedulable day.
  if (
    preferredWindow.end <= schedulableDay.start ||
    preferredWindow.start >= schedulableDay.end
  ) {
    return noSlot(
      'WINDOW_OUTSIDE_SCHEDULABLE_DAY',
      `"${title}" prefers ${clockLabel(preferredWindow.start)} to ${clockLabel(preferredWindow.end)}, ` +
        `which is outside your schedulable day of ${clockLabel(schedulableDay.start)} to ${clockLabel(schedulableDay.end)}.`,
    );
  }

  // FR-SCH-09, row 5: a task as long as the whole day can still be placed — but one
  // LONGER than the day can never be, whatever the busy set looks like.
  const dayLength = schedulableDay.end - schedulableDay.start;
  if (durationMinutes > dayLength) {
    return noSlot(
      'DURATION_EXCEEDS_SCHEDULABLE_DAY',
      `"${title}" needs ${durationMinutes} minutes, and your whole schedulable day is only ${dayLength} minutes long.`,
    );
  }

  const free = freeIntervals(mergeBusyIntervals(busy, schedulableDay), schedulableDay);

  // FR-SCH-09, row 2: the day is entirely full.
  if (free.length === 0) {
    return noSlot(
      'DAY_FULL',
      `Your day is booked from ${clockLabel(schedulableDay.start)} to ${clockLabel(schedulableDay.end)}, ` +
        `so there is no free time anywhere for "${title}".`,
    );
  }

  // FR-SCH-01 — the preferred window is tried first, and a fit there ends the search.
  // Within the window every position is equally "close", so the EARLIEST fitting one
  // governs (SRS v2.9 note under FR-SCH-02), which for an empty window is its start.
  const windowStart = Math.max(preferredWindow.start, schedulableDay.start);
  const windowEnd = Math.min(preferredWindow.end, schedulableDay.end);
  for (const gap of free) {
    const start = Math.max(gap.start, windowStart);
    const end = Math.min(gap.end, windowEnd);
    if (end - start >= durationMinutes) {
      return { placed: true, slots: [toSlot(start, 1, 1, task)] };
    }
  }

  // FR-SCH-02 — no sufficient free interval inside the window, so search the rest of the
  // day. FR-SCH-09 row 4: a gap one minute short is rejected and the scan CONTINUES.
  const starts = free
    .filter((gap) => gap.end - gap.start >= durationMinutes)
    .map((gap) => candidateStart(gap, task));

  if (starts.length === 0) {
    return noSlot(
      'NO_INTERVAL_LONG_ENOUGH',
      `Your day has free time, but no single gap is long enough for the ${durationMinutes} minutes "${title}" needs.`,
    );
  }

  return { placed: true, slots: rankSlots(starts, task) };
};
