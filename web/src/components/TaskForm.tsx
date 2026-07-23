import { useState } from 'react';

import type { Flexibility, IntensityTier, Placement, Slot, Task, TaskType } from '@capstone/shared';

import { ApiError, CreateTaskResult, createTask } from '../api/client';
import { timeToMinute } from '../dateUtils';
import { CandidatePicker } from './CandidatePicker';

const TASK_TYPES: readonly TaskType[] = ['CLASS', 'MEETING', 'HABIT', 'WORKOUT', 'MEAL', 'OTHER'];
const INTENSITY_TIERS: readonly IntensityTier[] = ['LOW', 'MODERATE', 'HIGH'];

interface Props {
  readonly date: string;
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
export const TaskForm = ({ date, onDone, onCancel }: Props) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('HABIT');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priority, setPriority] = useState(3);
  const [windowStart, setWindowStart] = useState('09:00');
  const [windowEnd, setWindowEnd] = useState('10:00');
  const [flexibility, setFlexibility] = useState<Flexibility>('FLEXIBLE');
  const [intensityTier, setIntensityTier] = useState<IntensityTier>('MODERATE');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // UC-03: set once the server reports the preferred window had no room (FR-DSH-06).
  const [picker, setPicker] = useState<{ task: Task; candidates: readonly Slot[] } | null>(null);
  // UC-02/FR-SCH-06: set once the server reports no valid slot exists anywhere today.
  const [unplaceable, setUnplaceable] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    // FR-TSK-02, client-side nicety only — the server's validateTaskInput is authoritative.
    if (windowEnd <= windowStart) {
      setFieldErrors({ preferredWindow: 'end must be after start' });
      return;
    }

    setBusy(true);
    try {
      const result: CreateTaskResult = await createTask({
        title,
        type,
        durationMinutes,
        priority,
        preferredWindow: { start: timeToMinute(windowStart), end: timeToMinute(windowEnd) },
        flexibility,
        intendedDate: date,
        ...(type === 'WORKOUT' ? { intensityTier } : {}),
      });

      if (result.placement !== null) {
        // UC-02, or a FIXED commitment: auto-placed, no conflict to resolve.
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
        setUnplaceable(result.unplaceable.explanation);
        return;
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors !== undefined) {
        const byField: Record<string, string> = {};
        for (const fe of err.fieldErrors) byField[fe.field] = fe.reason;
        setFieldErrors(byField);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Could not reach the server.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (picker !== null) {
    return (
      <CandidatePicker
        task={picker.task}
        date={date}
        candidates={picker.candidates}
        onPlaced={(placement: Placement) => onDone(placement.id)}
        onCancel={() => onDone()}
      />
    );
  }

  if (unplaceable !== null) {
    return (
      <div className="task-form">
        <p>⚠️ {unplaceable}</p>
        <p>The task was created and remains visible, unplaced.</p>
        <button type="button" onClick={() => onDone()}>
          OK
        </button>
      </div>
    );
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} />
      </label>
      {fieldErrors.title !== undefined && <p className="error">{fieldErrors.title}</p>}

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
        Duration (minutes)
        <input
          type="number"
          min={5}
          max={480}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
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

      <label>
        Preferred window start
        <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} required />
      </label>
      <label>
        Preferred window end
        <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} required />
      </label>
      {fieldErrors.preferredWindow !== undefined && <p className="error">{fieldErrors.preferredWindow}</p>}

      <label>
        Flexibility
        <select value={flexibility} onChange={(e) => setFlexibility(e.target.value as Flexibility)}>
          <option value="FLEXIBLE">Flexible — the engine finds a time</option>
          <option value="FIXED">Fixed — a commitment at this exact time</option>
        </select>
      </label>

      {formError !== null && <p className="error">{formError}</p>}

      <div className="task-form__actions">
        <button type="submit" disabled={busy}>
          Add task
        </button>
        <button type="button" className="link" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
};
