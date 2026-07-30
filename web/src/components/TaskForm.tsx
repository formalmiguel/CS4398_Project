import { useState } from 'react';

import type { Flexibility, IntensityTier, Placement, Slot, Task, TaskType } from '@capstone/shared';

import {
  ApiError,
  CreateTaskResult,
  RescheduleResult,
  createTask,
  moveToNextDay,
  rescheduleTask,
  toErrorMessage,
} from '../api/client';
import { minuteToTimeInput, timeToMinute } from '../dateUtils';
import { CandidatePicker } from './CandidatePicker';

const TASK_TYPES: readonly TaskType[] = ['CLASS', 'MEETING', 'HABIT', 'WORKOUT', 'MEAL', 'OTHER'];
const INTENSITY_TIERS: readonly IntensityTier[] = ['LOW', 'MODERATE', 'HIGH'];

interface Props {
  readonly date: string;
  /**
   * Set only when this form is the Reschedule action's "pick a time" step — every field below
   * is pre-filled from the occurrence being moved, and submitting calls `rescheduleTask`
   * instead of `createTask`. `fromDate` identifies which existing occurrence is being replaced
   * (a recurring task can have several) — or, when the task is still `awaitingChoice` and has no
   * placement at all (the candidate picker's "use reschedule" escape, switched to internally —
   * see `target` below), simply the date it's being placed on for the first time; the server
   * treats "nothing found to retire" as a first placement rather than an error either way.
   * `date` above stays the day currently on screen, only used as the default when this whole
   * prop is absent (a genuinely new task, added from scratch).
   */
  readonly rescheduleFrom?: { readonly task: Task; readonly fromDate: string };
  /**
   * Reschedule mode only: fires the moment the server confirms the move, before any interstitial
   * screen (e.g. the displaced-count notice) — lets the caller remember the exact old→new pair
   * immediately, which is what makes the "Rescheduled" panel's cross-day case accurate.
   */
  readonly onRescheduled?: (result: RescheduleResult) => void;
  /**
   * Fires once the task has reached a resting state: placed, unplaceable, or user-placed via
   * the picker. When a UC-03 pick produced the placement, its id is passed along so the
   * schedule view can remember (client-side only, this session) that it was just accepted —
   * this is NOT `rescheduleTrigger` and does not touch its meaning; it only lets the ⓘ line
   * keep showing the server's own `placementReason` immediately after the picker closes,
   * rather than the explanation vanishing the instant the picker unmounts.
   */
  readonly onDone: (justAcceptedPlacementId?: string) => void;
  readonly onCancel: () => void;
}

/** UI-02 / FR-TSK-01: every mandatory attribute, rejecting submission with the missing one stated. */
export const TaskForm = ({ date, rescheduleFrom, onRescheduled, onDone, onCancel }: Props) => {
  // Mutable, unlike the prop it starts from: the candidate picker's "use reschedule" escape
  // (below) switches an in-progress CREATE into a reschedule targeting the task just created,
  // without the parent needing to re-mount this component with a new prop.
  const [target, setTarget] = useState(rescheduleFrom ?? null);
  const [title, setTitle] = useState(rescheduleFrom?.task.title ?? '');
  // Defaults to the occurrence's own date when rescheduling, otherwise the day currently on
  // screen — either way it's its own field, editable independently.
  const [taskDate, setTaskDate] = useState(rescheduleFrom?.fromDate ?? date);
  const [type, setType] = useState<TaskType>(rescheduleFrom?.task.type ?? 'HABIT');
  // Raw text, not a number: a controlled numeric input whose value is `Number(e.target.value)`
  // turns a cleared field into `0` on every keystroke, so React re-renders the DOM with "0"
  // while the browser leaves the caret where the deleted digit was — to its right. Keeping the
  // field's own text as state lets it sit empty mid-edit; `Number(durationInput)` is computed
  // only where an actual number is needed (submit).
  const [durationInput, setDurationInput] = useState(String(rescheduleFrom?.task.durationMinutes ?? 30));
  const [priority, setPriority] = useState(rescheduleFrom?.task.priority ?? 3);
  // The window's END is never entered directly — it's `start + durationMinutes`, computed at
  // submit. Asking for both invited them to disagree (an end that didn't match the duration is
  // not a second, independent fact about the task; it's just wrong).
  const [windowStart, setWindowStart] = useState(
    rescheduleFrom === undefined ? '09:00' : minuteToTimeInput(rescheduleFrom.task.preferredWindow.start),
  );
  const [flexibility, setFlexibility] = useState<Flexibility>(rescheduleFrom?.task.flexibility ?? 'FLEXIBLE');
  const [intensityTier, setIntensityTier] = useState<IntensityTier>(
    rescheduleFrom?.task.intensityTier ?? 'MODERATE',
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // UC-03: set once the server reports the preferred window had no room (FR-DSH-06).
  const [picker, setPicker] = useState<{ task: Task; candidates: readonly Slot[] } | null>(null);
  // UC-02/FR-SCH-06: set once the server reports no valid slot exists anywhere today.
  const [unplaceable, setUnplaceable] = useState<{ taskId: string; explanation: string } | null>(null);
  // FR-RSC-05: the next-day offer, accepted or declined from the unplaceable screen above.
  const [movingToNextDay, setMovingToNextDay] = useState(false);
  const [nextDayError, setNextDayError] = useState<string | null>(null);
  // FR-RSC-02: a FIXED commitment can displace other flexible tasks; how many, if any.
  const [displacedCount, setDisplacedCount] = useState<number | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    // FR-TSK-02, client-side nicety only — the server's validateTaskInput is authoritative.
    const durationMinutes = Number(durationInput);
    if (durationInput.trim() === '' || !Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      setFieldErrors({ durationMinutes: 'must be a number between 5 and 480' });
      return;
    }

    setBusy(true);
    try {
      const start = timeToMinute(windowStart);
      const attrs = {
        title,
        type,
        durationMinutes,
        priority,
        preferredWindow: { start, end: start + durationMinutes },
        flexibility,
        ...(type === 'WORKOUT' ? { intensityTier } : {}),
      };

      if (target !== null) {
        // No candidate search here — the user has already decided the new time (that's the
        // whole point of pre-filling this form from the occurrence being moved).
        const result: RescheduleResult = await rescheduleTask(target.task.id, {
          ...attrs,
          intendedDate: taskDate,
          fromDate: target.fromDate,
        });
        onRescheduled?.(result);
        const displaced = result.displaced.filter((d) => d.kind !== 'NO_ACTION');
        if (displaced.length > 0) {
          setDisplacedCount(displaced.length);
          return;
        }
        onDone();
        return;
      }

      const result: CreateTaskResult = await createTask({ ...attrs, intendedDate: taskDate });

      if (result.placement !== null) {
        // UC-02, or a FIXED commitment: auto-placed, no conflict to resolve.
        const displaced = (result.displaced ?? []).filter((d) => d.kind !== 'NO_ACTION');
        if (displaced.length > 0) {
          // FR-RSC-02: this commitment moved other flexible tasks — say so before closing.
          setDisplacedCount(displaced.length);
          return;
        }
        onDone();
        return;
      }
      if (result.candidates != null && result.candidates.length > 0) {
        // UC-03 / FR-DSH-06: present the ranked alternatives instead of closing.
        setPicker({ task: result.task, candidates: result.candidates });
        return;
      }
      if (result.unplaceable != null) {
        // FR-SCH-06: reported, never silently dropped. The task stays created and unplaced.
        setUnplaceable({ taskId: result.task.id, explanation: result.unplaceable.explanation });
        return;
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors !== undefined) {
        const byField: Record<string, string> = {};
        for (const fe of err.fieldErrors) byField[fe.field] = fe.reason;
        setFieldErrors(byField);
      } else {
        setFormError(toErrorMessage(err, 'Could not reach the server.'));
      }
    } finally {
      setBusy(false);
    }
  };

  if (picker !== null) {
    return (
      <CandidatePicker
        task={picker.task}
        date={taskDate}
        candidates={picker.candidates}
        onPlaced={(placement: Placement) => onDone(placement.id)}
        onCancel={() => onDone()}
        onUseReschedule={() => {
          // The task this picker offered candidates for already exists (just created,
          // `awaitingChoice`) — switch into reschedule mode targeting it directly, rather than
          // accepting one of the engine's ranked slots. `rescheduleTask` treats "nothing to
          // retire" as a first placement, not an error, so this needs no special server case.
          setTarget({ task: picker.task, fromDate: taskDate });
          setPicker(null);
        }}
      />
    );
  }

  if (unplaceable !== null) {
    const acceptNextDay = async (): Promise<void> => {
      setMovingToNextDay(true);
      setNextDayError(null);
      try {
        await moveToNextDay(unplaceable.taskId, taskDate);
        onDone();
      } catch (err) {
        setNextDayError(toErrorMessage(err, 'Could not move the task to tomorrow.'));
      } finally {
        setMovingToNextDay(false);
      }
    };

    return (
      <div className="task-form">
        <p>⚠️ {unplaceable.explanation}</p>
        <p>The task was created and remains visible, unplaced.</p>
        {nextDayError !== null && <p className="error">{nextDayError}</p>}
        <div className="task-form__actions">
          {/* FR-RSC-05: "the System shall offer to move it to the next day." */}
          <button type="button" onClick={() => void acceptNextDay()} disabled={movingToNextDay}>
            Move to tomorrow
          </button>
          <button type="button" className="link" onClick={() => onDone()} disabled={movingToNextDay}>
            Leave it unplaced
          </button>
        </div>
      </div>
    );
  }

  if (displacedCount !== null) {
    return (
      <div className="task-form">
        <p>
          This commitment displaced {displacedCount} other task{displacedCount === 1 ? '' : 's'}, which the
          System rescheduled automatically.
        </p>
        <button type="button" onClick={() => onDone()}>
          OK
        </button>
      </div>
    );
  }

  return (
    <form className="task-form" onSubmit={submit}>
      {target !== null && <h3>Reschedule</h3>}
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} />
      </label>
      {fieldErrors.title !== undefined && <p className="error">{fieldErrors.title}</p>}

      <label>
        Date
        <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} required />
      </label>

      <label>
        Flexibility
        <select value={flexibility} onChange={(e) => setFlexibility(e.target.value as Flexibility)}>
          <option value="FLEXIBLE">Flexible — the engine finds a time</option>
          <option value="FIXED">Fixed — a commitment at this exact time</option>
        </select>
      </label>

      <label>
        Type
        <select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      {type === 'WORKOUT' && (
        <label>
          Intensity
          <select value={intensityTier} onChange={(e) => setIntensityTier(e.target.value as IntensityTier)}>
            {INTENSITY_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Preferred window start
        <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} required />
      </label>
      {fieldErrors.preferredWindow !== undefined && <p className="error">{fieldErrors.preferredWindow}</p>}

      <label>
        Duration (minutes)
        <input
          type="number"
          min={5}
          max={480}
          value={durationInput}
          onChange={(e) => setDurationInput(e.target.value)}
          required
        />
      </label>
      {fieldErrors.durationMinutes !== undefined && <p className="error">{fieldErrors.durationMinutes}</p>}

      <label>
        Priority (1 highest – 5 lowest)
        <input
          type="number"
          min={1}
          max={5}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          required
        />
      </label>
      {fieldErrors.priority !== undefined && <p className="error">{fieldErrors.priority}</p>}

      {formError !== null && <p className="error">{formError}</p>}

      <div className="task-form__actions">
        <button type="submit" disabled={busy}>
          {target === null ? 'Add task' : 'Reschedule'}
        </button>
        <button type="button" className="link" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
};
