import { useState } from 'react';

import type { Placement, Slot, Task } from '@capstone/shared';

import { ApiError, placeTask } from '../api/client';

interface Props {
  readonly task: Task;
  readonly date: string;
  readonly candidates: readonly Slot[];
  readonly onPlaced: (placement: Placement) => void;
  readonly onCancel: () => void;
}

/**
 * FR-DSH-06 / UC-03: the preferred window had no room. Present the engine's ranked alternatives
 * and let the user accept one. Each `Slot.explanation` is already the engine's own plain-language
 * account (rank, times, nearness to the preference) — this component renders it verbatim rather
 * than reconstructing a sentence from the raw fields.
 */
export const CandidatePicker = ({ task, date, candidates, onPlaced, onCancel }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async (slot: Slot): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const { placement } = await placeTask(task.id, { date, start: slot.start, end: slot.end });
      onPlaced(placement);
    } catch (err) {
      // The offer may be stale by the time the user chooses (docs/P12-REPORT.md) — a 409
      // means someone/something else took the slot. Report it plainly (NFR-ROB-02/NFR-USE-03).
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="candidate-picker">
      <p>
        <strong>&ldquo;{task.title}&rdquo;</strong>&rsquo;s preferred time was unavailable. Choose an alternative:
      </p>
      <ul>
        {candidates.map((slot) => (
          <li key={`${slot.start}-${slot.end}`}>
            <button type="button" onClick={() => accept(slot)} disabled={busy}>
              {slot.explanation}
            </button>
          </li>
        ))}
      </ul>
      {error !== null && <p className="error">{error}</p>}
      <button type="button" className="link" onClick={onCancel} disabled={busy}>
        Decide later — leave it unplaced
      </button>
    </div>
  );
};
