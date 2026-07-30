import { useState } from 'react';

import type { Placement, Task } from '@capstone/shared';

import { minuteToLabel } from '../dateUtils';

interface Props {
  readonly placement: Placement;
  readonly task: Task | undefined;
  readonly onComplete: () => void;
  readonly onSkip: () => void;
  /** Reschedule > Auto (FLEXIBLE only) — the same SKIPPED action the Skip button triggers. */
  readonly onRescheduleAuto: () => void;
  /**
   * Reschedule > Pick a time (FIXED and FLEXIBLE alike) — opens the Add Task form pre-filled
   * with this occurrence's details, every field editable. FIXED has no "auto" option (there is
   * nothing for the engine to search for — its time is the user's own statement, FR-CAL-01), so
   * this is the ONLY reschedule action offered for it.
   */
  readonly onOpenReschedule: () => void;
  readonly onUndoToMissed: () => void;
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
export const OccurrenceBlock = ({
  placement,
  task,
  onComplete,
  onSkip,
  onRescheduleAuto,
  onOpenReschedule,
  onUndoToMissed,
  busy,
  justAccepted,
}: Props) => {
  const [showRescheduleMenu, setShowRescheduleMenu] = useState(false);
  const wasRescheduled = placement.rescheduleTrigger !== undefined;
  const showReason = wasRescheduled || justAccepted;
  const isFixed = task?.flexibility === 'FIXED';
  const isSystem = task?.source === 'SYSTEM';
  const isCompleted = placement.status === 'COMPLETED';
  const isDone = isCompleted || placement.status === 'CANCELLED';

  const classes = ['occurrence', isFixed ? 'occurrence--fixed' : 'occurrence--flexible'];
  if (wasRescheduled) classes.push('occurrence--rescheduled');
  if (isDone) classes.push('occurrence--done');

  return (
    <div className={classes.join(' ')}>
      <div className="occurrence__header">
        {/* Decorative only — task type is never the sole carrier of any meaning the legend
            requires (═/─/✦/↻ and the FIXED badge below still do that work in text/symbols). */}
        <span className={`occurrence__dot type-dot--${task?.type ?? 'OTHER'}`} aria-hidden="true" />
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
          {/* Expands INLINE rather than as a floating popover — the timeline container clips
              overflow (for its rounded corners), which would cut off an absolutely-positioned
              menu instead of letting it float above the surrounding content. */}
          {isFixed ? (
            // FR-CAL-01: nothing for the engine to auto-search — go straight to the form.
            <button type="button" onClick={onOpenReschedule} disabled={busy}>
              ↻ reschedule
            </button>
          ) : showRescheduleMenu ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowRescheduleMenu(false);
                  onRescheduleAuto();
                }}
                disabled={busy}
              >
                Auto reschedule
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRescheduleMenu(false);
                  onOpenReschedule();
                }}
                disabled={busy}
              >
                Pick a time
              </button>
              <button type="button" onClick={() => setShowRescheduleMenu(false)} disabled={busy}>
                cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowRescheduleMenu(true)}
              disabled={busy}
              aria-expanded={false}
            >
              ↻ reschedule
            </button>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="occurrence__actions">
          {/* Corrects a mistaken "complete" click: reverts to MISSED and re-places it exactly as
              a real miss would (RescheduleService.onCompletionUndone). */}
          <button type="button" onClick={onUndoToMissed} disabled={busy}>
            ✕ missed
          </button>
        </div>
      )}

      {showReason && <p className="occurrence__reason">ⓘ {placement.placementReason}</p>}
    </div>
  );
};
