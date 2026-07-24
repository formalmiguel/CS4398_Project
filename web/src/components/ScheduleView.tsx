import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Interval, Task } from '@capstone/shared';

import { ScheduleResult, completeTask, getSchedule, skipTask, toErrorMessage } from '../api/client';
import { addDays, formatDateHeading, minuteToLabel } from '../dateUtils';
import { OccurrenceBlock } from './OccurrenceBlock';
import { TaskForm } from './TaskForm';

interface Props {
  readonly date: string;
  readonly onDateChange: (date: string) => void;
  readonly schedulableDay: Interval;
}

/** UI-01/FR-DSH-01/02: one day, a vertical time axis, ◄/► navigation. UI-05: every action re-renders in place. */
export const ScheduleView = ({ date, onDateChange, schedulableDay }: Props) => {
  const [data, setData] = useState<ScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyPlacementId, setBusyPlacementId] = useState<string | null>(null);
  // UC-03: placements accepted via the CandidatePicker THIS session. Independent of
  // rescheduleTrigger (a picker accept is a first placement, not a reschedule, so it never
  // gets one) — this only keeps the server's own placementReason visible right after the
  // picker closes, instead of it vanishing the instant the modal unmounts. Ephemeral by
  // design: does not survive a reload, same limitation already recorded for `awaitingChoice`.
  const [justAcceptedIds, setJustAcceptedIds] = useState<ReadonlySet<string>>(new Set());

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

  const { taskById, placements, unplacedTasks, awaitingChoiceCount } = useMemo(() => {
    const byId = new Map<string, Task>((data?.tasks ?? []).map((t) => [t.id, t]));
    const sortedPlacements = [...(data?.placements ?? [])].sort((a, b) => a.start - b.start);
    const placedTaskIds = new Set(sortedPlacements.map((p) => p.taskId));
    return {
      taskById: byId,
      placements: sortedPlacements,
      unplacedTasks: (data?.tasks ?? []).filter((t) => !placedTaskIds.has(t.id)),
      awaitingChoiceCount: (data?.awaitingChoice ?? []).length,
    };
  }, [data]);

  return (
    <div className="schedule-view">
      <div className="schedule-view__nav">
        <button type="button" onClick={() => onDateChange(addDays(date, -1))} aria-label="Previous day">
          ◄
        </button>
        <h2>{formatDateHeading(date)}</h2>
        <button type="button" onClick={() => onDateChange(addDays(date, 1))} aria-label="Next day">
          ►
        </button>
        <button type="button" onClick={() => setShowForm(true)}>
          + Add Task
        </button>
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

      {awaitingChoiceCount > 0 && (
        <p className="schedule-view__banner">
          {awaitingChoiceCount} task(s) are awaiting your choice of an alternative time —
          re-add or check back after choosing from the "+ Add Task" flow that created them.
        </p>
      )}

      <div className="schedule-view__timeline">
        <span className="schedule-view__axis-label">{minuteToLabel(schedulableDay.start)}</span>
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
          />
        ))}
        <span className="schedule-view__axis-label">{minuteToLabel(schedulableDay.end)}</span>
      </div>

      {unplacedTasks.length > 0 && (
        <div className="schedule-view__unplaced">
          <h3>Unplaced</h3>
          <ul>
            {unplacedTasks.map((t) => (
              <li key={t.id}>{t.title} — no valid slot found today</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
