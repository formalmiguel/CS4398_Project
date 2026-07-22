/**
 * The sentences this service STORES — `Placement.placementReason` (DR-03), carrying
 * FR-RSC-04's three facts so FR-DSH-05 reads stored data rather than reconstructing it.
 *
 * ⚠️ NOT `Slot.explanation`. That field is the engine's, it is frozen, and it provably cannot
 * carry these sentences: the engine receives `busy` as bare `Interval`s with no titles, so it
 * cannot name the commitment responsible. Only the caller holding the schedule can.
 *
 * ⛔ NOTHING HERE READS `Slot.withinPreferredWindow`, and nothing here may start to. On a
 * SUBSTITUTED engine call — one whose preferred window had fully elapsed (FR-RSC-01, v2.14) —
 * every candidate is "within the preferred window" as far as the engine can see, and the flag
 * therefore says nothing about what the user actually asked for. A sentence reading "placed
 * inside your preferred window" on a task the user missed at 8 PM would be false, plausible,
 * and green. The trigger is what these sentences are built from, because the trigger is a fact.
 *
 * ⛔ AND NOTHING HERE COMPUTES A TIME. `clockLabel` renders a `Minute` the engine already chose
 * into a wall-clock label; every minute passed in arrives from a `Slot` or a stored `Placement`.
 */
import type { Minute, Task } from '@capstone/shared';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const HOURS_PER_HALF_DAY = 12;

/** A `Minute` as a wall-clock label — "9:15 PM". Formatting, not arithmetic on a schedule. */
export const clockLabel = (minute: Minute): string => {
  const wrapped = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(wrapped / MINUTES_PER_HOUR);
  const hour12 = ((hour24 + HOURS_PER_HALF_DAY - 1) % HOURS_PER_HALF_DAY) + 1;
  const suffix = hour24 < HOURS_PER_HALF_DAY ? 'AM' : 'PM';
  const minutes = String(wrapped % MINUTES_PER_HOUR).padStart(2, '0');
  return `${hour12}:${minutes} ${suffix}`;
};

/**
 * FR-RSC-01. Each trigger gets its own sentence because DR-06 requires the three to stay
 * distinguishable, and the sentence is what the user reads: "this was missed this evening" and
 * "you skipped the 5:00 PM session" are different claims and only one of them is true.
 */
export const missedReason = (task: Task, from: Minute, to: Minute): string =>
  `"${task.title}" moved to ${clockLabel(to)} — its ${clockLabel(from)} slot passed ` +
  `without being marked complete.`;

/** FR-RSC-08. The user said so; the System did not infer it. */
export const skippedReason = (task: Task, from: Minute, to: Minute): string =>
  `"${task.title}" moved to ${clockLabel(to)} — you skipped the ${clockLabel(from)} session.`;

/** FR-RSC-02 / UC-06. Names the commitment responsible, which only the caller knows. */
export const displacedReason = (
  task: Task,
  from: Minute,
  to: Minute,
  commitmentTitle: string,
): string =>
  `"${task.title}" moved to ${clockLabel(to)} — your ${clockLabel(from)} slot was taken by ` +
  `${commitmentTitle}.`;

/** FR-TSK-04. Nothing happened at the old time; the task itself changed. */
export const editedReason = (task: Task, to: Minute): string =>
  `"${task.title}" moved to ${clockLabel(to)} — you changed its duration or preferred window.`;

/**
 * FR-RSC-05. A task that had no placement at all when the schedule was retrieved: the day had
 * no room for it earlier, and now it does.
 */
export const reattemptReason = (task: Task, to: Minute): string =>
  `"${task.title}" placed at ${clockLabel(to)} — your day had no room for it earlier today.`;

/** FR-RSC-05, the accepted offer. */
export const nextDayReason = (task: Task, to: Minute): string =>
  `"${task.title}" moved to ${clockLabel(to)} tomorrow — your day had no room left for it.`;

/** FR-RSC-09's "…and state that it has done so." */
export const cancellationStatement = (task: Task, withdrawn: Minute): string =>
  `You marked "${task.title}" complete, so its ${clockLabel(withdrawn)} reschedule was cancelled.`;

/**
 * FR-RSC-01 (v2.14): where `now` is at or past the end of the schedulable day there is no
 * remainder to ask about and no valid `Interval` to pass, so the engine is not called. This is
 * the ONE explanation in the System that does not originate in the engine, and FR-RSC-01's note
 * exists to keep it the only one.
 */
export const dayAlreadyOverExplanation = (task: Task, dayEnd: Minute): string =>
  `Your schedulable day ended at ${clockLabel(dayEnd)}, so there is no time left today for ` +
  `"${task.title}".`;
