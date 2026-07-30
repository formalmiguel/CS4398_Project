import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Interval, Placement, Slot, Task, TaskType } from '@capstone/shared';

import {
  RescheduleResult,
  ScheduleResult,
  completeTask,
  exportScheduleIcs,
  getSchedule,
  moveToNextDay,
  refreshCandidates,
  skipTask,
  toErrorMessage,
  undoCompletion,
} from '../api/client';
import { addDays, formatDateHeading, minuteToLabel } from '../dateUtils';
import { CandidatePicker } from './CandidatePicker';
import { MonthCalendar } from './MonthCalendar';
import { OccurrenceBlock } from './OccurrenceBlock';
import { TaskForm } from './TaskForm';

interface Props {
  readonly date: string;
  readonly onDateChange: (date: string) => void;
  readonly schedulableDay: Interval;
}

/** Same fixed order as `styles.css`'s `--type-*` tokens and the `type-dot--*` classes they key. */
const TYPE_LEGEND: ReadonlyArray<{ type: TaskType; label: string }> = [
  { type: 'CLASS', label: 'Class' },
  { type: 'MEETING', label: 'Meeting' },
  { type: 'HABIT', label: 'Habit' },
  { type: 'WORKOUT', label: 'Workout' },
  { type: 'MEAL', label: 'Meal' },
  { type: 'OTHER', label: 'Other' },
];

/** UI-01/FR-DSH-01/02: one day, a vertical time axis, ◀/▶ navigation. UI-05: every action re-renders in place. */
export const ScheduleView = ({ date, onDateChange, schedulableDay }: Props) => {
  const [data, setData] = useState<ScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  // FR-DSH-01/02 (day) vs FR-DSH-08 (month) — two ways to look at the same schedule. Day is the
  // view the screen opens on; UI-01's actual required structure never changes because of this.
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
  // The collapsible mini-navigator (dots, `variant="compact"`) that opens above Day view's own
  // timeline — independent of `viewMode`, which is the full-page Month tab. Collapsed by default
  // so Day view's required structure is what's on screen without the user opening anything.
  const [showMiniMonth, setShowMiniMonth] = useState(false);
  // Stable identities so memoized MonthCalendar doesn't re-render on unrelated ScheduleView state.
  const selectFromMonth = useCallback(
    (picked: string) => {
      onDateChange(picked);
      setViewMode('day');
    },
    [onDateChange],
  );
  // Deliberately does NOT close the mini month on pick (unlike `selectFromMonth`'s full-page
  // Month tab) — the mini navigator is meant for browsing several days in a row without
  // reopening it each time; `closeMiniMonth` (▼'s own toggle) is the only thing that closes it.
  const selectFromMiniMonth = useCallback(
    (picked: string) => {
      onDateChange(picked);
    },
    [onDateChange],
  );
  const closeMiniMonth = useCallback(() => setShowMiniMonth(false), []);
  const [busyPlacementId, setBusyPlacementId] = useState<string | null>(null);
  // UC-03: placements accepted via the CandidatePicker THIS session. Independent of
  // rescheduleTrigger (a picker accept is a first placement, not a reschedule, so it never
  // gets one) — this only keeps the server's own placementReason visible right after the
  // picker closes, instead of it vanishing the instant the modal unmounts. Ephemeral by
  // design: does not survive a reload, same limitation already recorded for `awaitingChoice`.
  const [justAcceptedIds, setJustAcceptedIds] = useState<ReadonlySet<string>>(new Set());
  // OPEN-36: reopens a real CandidatePicker for a task still awaiting a choice — the offer
  // TaskForm originally showed is never persisted, so this recomputes a fresh one on demand.
  const [picker, setPicker] = useState<{ task: Task; candidates: readonly Slot[] } | null>(null);
  // The Reschedule action's "pick a time" step — opens TaskForm pre-filled from this occurrence.
  const [rescheduleForm, setRescheduleForm] = useState<{ task: Task; fromDate: string } | null>(null);
  // Reschedules done via the form THIS session, keyed by the retired placement's id — lets the
  // Rescheduled panel show the EXACT new time/date immediately, even across a day change, which
  // the same-day successor lookup in the panel's own render (below) cannot see. Ephemeral, same
  // limitation already accepted for `justAcceptedIds`/`awaitingChoice` — does not survive a reload.
  const [justRescheduled, setJustRescheduled] = useState<ReadonlyMap<string, Placement>>(new Map());

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = await getSchedule(date);
      setData(result);
      setError(null);
    } catch (err) {
      setError(toErrorMessage(err, 'Could not load the schedule.'));
    }
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = async (
    placementId: string,
    taskId: string,
    action: (taskId: string, date: string) => Promise<unknown>,
    errorMessage: string,
  ): Promise<void> => {
    setBusyPlacementId(placementId);
    try {
      await action(taskId, date);
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, errorMessage));
    } finally {
      setBusyPlacementId(null);
    }
  };

  const onComplete = (placementId: string, taskId: string): Promise<void> =>
    runAction(placementId, taskId, completeTask, 'Could not complete the task.');

  const onSkip = (placementId: string, taskId: string): Promise<void> =>
    runAction(placementId, taskId, skipTask, 'Could not skip the task.');

  // Reschedule > Auto (FLEXIBLE only): the same SKIPPED action the Skip button triggers
  // (FR-RSC-08 already covers "declared by the user, possibly before the window") — a second
  // entry point onto the identical action, not a new trigger.
  const onRescheduleAuto = onSkip;

  // Reschedule > Pick a time (FIXED and FLEXIBLE alike): opens the Add Task form pre-filled
  // with this occurrence's details. No candidate search here — see TaskForm/rescheduleTask.
  const onOpenReschedule = (task: Task, fromDate: string): void => setRescheduleForm({ task, fromDate });

  // Corrects a mistaken "complete" click: reverts the occurrence to MISSED and re-places it, the
  // same way a real miss would be. Not routed through `runAction` — there's no generic failure
  // text worth showing over the specific one.
  const onUndoToMissed = async (placementId: string, taskId: string): Promise<void> => {
    setBusyPlacementId(placementId);
    try {
      await undoCompletion(taskId, date);
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, 'Could not undo the completion.'));
    } finally {
      setBusyPlacementId(null);
    }
  };

  // A MISSED row whose same-day re-attempt (FR-RSC-05, on every retrieval) found no room has no
  // successor anywhere — this is the "offer to move it to the next day" the requirement
  // describes, reusing the same moveToNextDay action TaskForm already offers at creation time.
  // Applies equally to a SKIPPED row with no successor — Skip/Auto reschedule can fail to find
  // room the same way a miss's same-day re-attempt can. Deliberately gated to rows with no
  // active successor (see rescheduledHistory below): calling moveToNextDay on a task that
  // already has one would place a SECOND, unwanted occurrence tomorrow.
  const onMoveToNextDay = (placementId: string, taskId: string): Promise<void> =>
    runAction(placementId, taskId, moveToNextDay, 'Could not reschedule the task.');

  /** OPEN-36: recompute fresh candidates for a task still awaiting a choice and reopen the picker. */
  const onChooseTime = async (task: Task): Promise<void> => {
    try {
      const result = await refreshCandidates(task.id, date);
      if (result.candidates !== null && result.candidates.length > 0) {
        setPicker({ task, candidates: result.candidates });
      } else if (result.unplaceable !== null) {
        setError(result.unplaceable.explanation);
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Could not refresh alternative times.'));
    }
  };

  /** FR-CAL-07: exports just the day currently on screen — a single-day range is still a range. */
  const onExport = async (): Promise<void> => {
    try {
      const blob = await exportScheduleIcs(date, date);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schedule-${date}.ics`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(toErrorMessage(err, 'Could not export the schedule.'));
    }
  };

  const { taskById, placements, rescheduledHistory, unplacedTasks, awaitingChoiceIds, awaitingChoiceCount } =
    useMemo(() => {
      const byId = new Map<string, Task>((data?.tasks ?? []).map((t) => [t.id, t]));
      const sortedPlacements = [...(data?.placements ?? [])].sort((a, b) => a.start - b.start);
      // MISSED and SKIPPED rows are history (DR-06 — kept, never deleted) and no longer occupy
      // time, so they don't belong on the live timeline; every reschedule — automatic (miss,
      // skip) or manual (the Reschedule button, either option) — lands here instead, since all
      // of them retire the old row the same way (see the unified "Rescheduled" section below).
      const isRetired = (p: Placement): boolean => p.status === 'MISSED' || p.status === 'SKIPPED';
      const timelinePlacements = sortedPlacements.filter((p) => !isRetired(p));
      const history = sortedPlacements.filter(isRetired);
      // A retired row (missed/skipped) that found no successor holds no live placement — the
      // task is currently unplaced, same as one that never found a slot at all, and belongs in
      // the "Unplaced" section below, not just the "Rescheduled" history. Built from LIVE
      // placements only, so a retired row with a real successor elsewhere still counts as placed
      // (via that successor), while one with none does not.
      const placedTaskIds = new Set(timelinePlacements.map((p) => p.taskId));
      const awaitingIds = new Set(data?.awaitingChoice ?? []);
      return {
        taskById: byId,
        placements: timelinePlacements,
        rescheduledHistory: history,
        // FLEXIBLE only: "no valid slot found today" describes the engine failing to place a
        // task, which cannot be what happened to a FIXED commitment (never engine-placed at
        // all) — a fixed occurrence with no live placement is simply retired (MISSED), and the
        // "Rescheduled" panel above is where that belongs, with no "unplaced" implication.
        unplacedTasks: (data?.tasks ?? []).filter(
          (t) => t.flexibility === 'FLEXIBLE' && !placedTaskIds.has(t.id),
        ),
        awaitingChoiceIds: awaitingIds,
        awaitingChoiceCount: awaitingIds.size,
      };
    }, [data]);

  // Splits the retired rows into what's DONE (has a "was X → now Y" pairing, or is a fixed
  // commitment with nowhere to go) and what still NEEDS a reschedule (flexible, retired, and no
  // successor was ever found — the same "Reschedule" offer that used to sit inside the
  // "Rescheduled" list itself, now its own section so it reads as something to act on).
  const { rescheduledDone, needsRescheduling } = useMemo(() => {
    const done: Placement[] = [];
    const needsAction: Placement[] = [];
    for (const p of rescheduledHistory) {
      const task = taskById.get(p.taskId);
      // Same successor lookup the "Rescheduled" list itself uses: this session's own exact
      // pairing first, then a same-day fallback (a reload, or Skip/Auto reschedule/an automatic
      // miss, none of which move a task to a different day).
      const successor = justRescheduled.get(p.id) ?? placements.find((live) => live.taskId === p.taskId);
      if (successor !== undefined || task?.flexibility !== 'FLEXIBLE') {
        done.push(p);
      } else {
        needsAction.push(p);
      }
    }
    return { rescheduledDone: done, needsRescheduling: needsAction };
  }, [rescheduledHistory, placements, taskById, justRescheduled]);

  return (
    <div className={viewMode === 'month' ? 'schedule-view schedule-view--month' : 'schedule-view'}>
      {/* FR-DSH-01/02 vs FR-DSH-08: Day is the required structure and what the screen opens on;
          Month is a full-page alternative view, not a dropdown layered on top of it. */}
      <div className="schedule-view__mode-toggle" role="tablist" aria-label="Schedule view">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'day'}
          className={viewMode === 'day' ? 'schedule-view__mode-tab schedule-view__mode-tab--active' : 'schedule-view__mode-tab'}
          onClick={() => setViewMode('day')}
        >
          Day
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'month'}
          className={viewMode === 'month' ? 'schedule-view__mode-tab schedule-view__mode-tab--active' : 'schedule-view__mode-tab'}
          onClick={() => setViewMode('month')}
        >
          Month
        </button>
      </div>

      <div className="schedule-view__legend" aria-label="Task type color legend">
        {TYPE_LEGEND.map(({ type, label }) => (
          <span key={type} className="schedule-view__legend-item">
            <span className={`schedule-view__legend-dot type-dot--${type}`} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>

      {viewMode === 'month' ? (
        <MonthCalendar date={date} onSelect={selectFromMonth} />
      ) : (
        <>
          {showMiniMonth && (
            <MonthCalendar date={date} onSelect={selectFromMiniMonth} variant="compact" onClose={closeMiniMonth} />
          )}

          <div className="schedule-view__nav">
            <button
              type="button"
              className="icon-button icon-button--filled icon-button--lg"
              onClick={() => onDateChange(addDays(date, -1))}
              aria-label="Previous day"
            >
              ◀
            </button>
            <div className="schedule-view__date-wrap">
              <h2>{formatDateHeading(date)}</h2>
              {/* Only an OPEN affordance — once expanded, MonthCalendar carries its own close control. */}
              {!showMiniMonth && (
                <button
                  type="button"
                  className="icon-button icon-button--ghost icon-button--md"
                  aria-label="Show mini month calendar"
                  aria-expanded={false}
                  onClick={() => setShowMiniMonth(true)}
                >
                  ▼
                </button>
              )}
            </div>
            <button
              type="button"
              className="icon-button icon-button--filled icon-button--lg"
              onClick={() => onDateChange(addDays(date, 1))}
              aria-label="Next day"
            >
              ▶
            </button>
            <div className="schedule-view__nav-actions">
              <button type="button" className="schedule-view__export" onClick={() => void onExport()}>
                Export .ics
              </button>
              <button type="button" className="schedule-view__add-task" onClick={() => setShowForm(true)}>
                + Add Task
              </button>
            </div>
          </div>

          {error !== null && <p className="error">{error}</p>}

          {showForm && (
            <div className="modal">
              <TaskForm
                date={date}
                onDone={(justAcceptedPlacementId) => {
                  setShowForm(false);
                  if (justAcceptedPlacementId !== undefined) {
                    setJustAcceptedIds((prev) => new Set(prev).add(justAcceptedPlacementId));
                  }
                  void refresh();
                }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {picker !== null && (
            <div className="modal">
              <CandidatePicker
                task={picker.task}
                date={date}
                candidates={picker.candidates}
                onPlaced={(placement: Placement) => {
                  setPicker(null);
                  setJustAcceptedIds((prev) => new Set(prev).add(placement.id));
                  void refresh();
                }}
                onCancel={() => setPicker(null)}
                onUseReschedule={() => {
                  // The task already exists (still awaitingChoice, no placement) — rescheduleTask
                  // treats "nothing to retire" as a first placement, not an error.
                  setRescheduleForm({ task: picker.task, fromDate: date });
                  setPicker(null);
                }}
              />
            </div>
          )}

          {rescheduleForm !== null && (
            <div className="modal">
              <TaskForm
                date={date}
                rescheduleFrom={rescheduleForm}
                onRescheduled={(result: RescheduleResult) => {
                  const { oldPlacement, placement } = result;
                  if (oldPlacement !== null) {
                    setJustRescheduled((prev) => new Map(prev).set(oldPlacement.id, placement));
                  }
                }}
                onDone={() => {
                  setRescheduleForm(null);
                  void refresh();
                }}
                onCancel={() => setRescheduleForm(null)}
              />
            </div>
          )}

          {awaitingChoiceCount > 0 && (
            <p className="schedule-view__banner">
              {awaitingChoiceCount} task(s) are awaiting your choice of an alternative time.
            </p>
          )}

          <div className="schedule-view__timeline">
            <span className="schedule-view__axis-label">Day Start: {minuteToLabel(schedulableDay.start)}</span>
            {placements.length === 0 && <p className="schedule-view__free">(free)</p>}
            {placements.map((p) => (
              <OccurrenceBlock
                key={p.id}
                placement={p}
                task={taskById.get(p.taskId)}
                busy={busyPlacementId === p.id}
                justAccepted={justAcceptedIds.has(p.id)}
                onComplete={() => onComplete(p.id, p.taskId)}
                onSkip={() => onSkip(p.id, p.taskId)}
                onRescheduleAuto={() => void onRescheduleAuto(p.id, p.taskId)}
                onOpenReschedule={() => {
                  const task = taskById.get(p.taskId);
                  if (task !== undefined) onOpenReschedule(task, p.date);
                }}
                onUndoToMissed={() => void onUndoToMissed(p.id, p.taskId)}
              />
            ))}
            <span className="schedule-view__axis-label">Day End: {minuteToLabel(schedulableDay.end)}</span>
          </div>

          {rescheduledDone.length > 0 && (
            <div className="schedule-view__rescheduled">
              <h3>Rescheduled</h3>
              <ul>
                {rescheduledDone.map((p) => {
                  const task = taskById.get(p.taskId);
                  // This session's own exact pairing (from the Reschedule form, `onRescheduled`)
                  // is accurate even across a day change; a same-day successor lookup is the
                  // fallback for everything else (a reload, or Skip/Auto reschedule/an automatic
                  // miss, none of which move a task to a different day).
                  const successor = justRescheduled.get(p.id) ?? placements.find((live) => live.taskId === p.taskId);
                  return (
                    <li key={p.id} className="schedule-view__rescheduled-item">
                      <span>
                        {task?.title ?? '(task unavailable)'} — was {minuteToLabel(p.start)}–{minuteToLabel(p.end)}
                        {successor !== undefined && (
                          <>
                            {' '}
                            → now {successor.date !== date ? `${successor.date} ` : ''}
                            {minuteToLabel(successor.start)}–{minuteToLabel(successor.end)}
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {needsRescheduling.length > 0 && (
            <div className="schedule-view__needs-reschedule">
              <h3>Needs Rescheduling</h3>
              <ul>
                {needsRescheduling.map((p) => {
                  const task = taskById.get(p.taskId);
                  return (
                    <li key={p.id} className="schedule-view__needs-reschedule-item">
                      <span>
                        {task?.title ?? '(task unavailable)'} — was {minuteToLabel(p.start)}–{minuteToLabel(p.end)}
                      </span>
                      <button
                        type="button"
                        className="link"
                        disabled={busyPlacementId === p.id}
                        onClick={() => void onMoveToNextDay(p.id, p.taskId)}
                      >
                        Reschedule
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {unplacedTasks.length > 0 && (
            <div className="schedule-view__unplaced">
              <h3>Unplaced</h3>
              <ul>
                {unplacedTasks.map((t) =>
                  awaitingChoiceIds.has(t.id) ? (
                    <li key={t.id}>
                      {t.title} — awaiting your choice of an alternative time{' '}
                      <button type="button" className="link" onClick={() => void onChooseTime(t)}>
                        Choose a time
                      </button>
                    </li>
                  ) : (
                    <li key={t.id}>{t.title} — no valid slot found today</li>
                  ),
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};
