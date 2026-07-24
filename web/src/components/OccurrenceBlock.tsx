import type { Placement, Task } from '@capstone/shared';

import { minuteToLabel } from '../dateUtils';

interface Props {
  readonly placement: Placement;
  readonly task: Task | undefined;
  readonly onComplete: () => void;
  readonly onSkip: () => void;
  readonly busy: boolean;
  /**
   * UC-03: true only for a placement this browser session just watched the user accept from
   * the CandidatePicker. Deliberately NOT part of `rescheduleTrigger` — accepting a ranked
   * alternative at creation is a first placement, not a reschedule, so it correctly never gets
   * one (OPEN-21's own distinction). This flag exists only so the server's already-computed
   * `placementReason` ("you chose this after your preferred time was unavailable") stays
   * visible right after the picker closes, instead of vanishing the instant it unmounts. It is
   * ephemeral client state — it does not survive a reload, the same limitation already
   * recorded for `awaitingChoice` (docs/P13-REPORT.md).
   */
  readonly justAccepted: boolean;
}

/**
 * One occurrence block (FR-DSH-01, §3.7.1's wireframe).
 *
 * ⚠️ The single rule this component must not get wrong: `placement.rescheduleTrigger` is
 * OPTIONAL (SRS v2.20 / OPEN-21). Absent means "never rescheduled" — not "moved for an
 * unknown reason." The ↻ marker is gated STRICTLY on its presence and never on anything else —
 * it specifically claims "automatically rescheduled" (§3.7.1's legend), which `justAccepted`
 * is not. The ⓘ reason line is gated on `wasRescheduled || justAccepted` (never on
 * `placementReason` alone, which always exists, even for an ordinary "Lunch" block placed
 * once) — either way it renders the server's own text verbatim, with no fallback sentence
 * invented for either case. Inventing a fallback sentence for the absent case is exactly the
 * bug OPEN-21 was: a brand-new task's first placement must never be presented as though it
 * were a reschedule.
 */
export const OccurrenceBlock = ({ placement, task, onComplete, onSkip, busy, justAccepted }: Props) => {
  const wasRescheduled = placement.rescheduleTrigger !== undefined;
  const showReason = wasRescheduled || justAccepted;
  const isFixed = task?.flexibility === 'FIXED';
  const isSystem = task?.source === 'SYSTEM';
  const isDone = placement.status === 'COMPLETED' || placement.status === 'CANCELLED';

  const classes = ['occurrence', isFixed ? 'occurrence--fixed' : 'occurrence--flexible'];
  if (wasRescheduled) classes.push('occurrence--rescheduled');
  if (isDone) classes.push('occurrence--done');

  return (
    <div className={classes.join(' ')}>
      <div className="occurrence__header">
        <span className="occurrence__marker">
          {isSystem && '✦ '}
          {wasRescheduled && '↻ '}
        </span>
        <span className="occurrence__title">{task?.title ?? '(task unavailable)'}</span>
        <span className="occurrence__time">
          {minuteToLabel(placement.start)} – {minuteToLabel(placement.end)}
        </span>
        {isFixed && <span className="occurrence__badge">FIXED</span>}
      </div>

      {placement.status === 'PLANNED' && (
        <div className="occurrence__actions">
          <button type="button" onClick={onComplete} disabled={busy}>
            ○ complete
          </button>
          <button type="button" onClick={onSkip} disabled={busy}>
            ⤼ skip
          </button>
        </div>
      )}

      {showReason && <p className="occurrence__reason">ⓘ {placement.placementReason}</p>}
    </div>
  );
};
