import { memo, useEffect, useMemo, useState } from 'react';

import type { TaskType } from '@capstone/shared';

import { getMonthOverview, toErrorMessage } from '../api/client';
import { addMonths, formatMonthHeading, monthGrid } from '../dateUtils';

interface Props {
  /** The currently selected day (`ScheduleView`'s own `date`) — highlighted, and the month it opens on. */
  readonly date: string;
  readonly onSelect: (date: string) => void;
  /** Collapses the calendar. Lives inside this component, not beside `ScheduleView`'s date heading. */
  readonly onClose: () => void;
}

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Same fixed order as `styles.css`'s `--type-*` tokens — decorative, never the sole carrier of meaning. */
const DOT_TYPES_SHOWN = 3;

/**
 * The picture's month-grid navigator. Dots come from `GET /schedule/overview`
 * (`TaskRepository.taskTypesInRange`) — a read of task DEFINITIONS, not placements, so it is
 * safe to show for a month nobody has ever opened via the day view (see that method's own note).
 *
 * Memoized: `ScheduleView` re-renders on every schedule action (complete/skip/refresh), none of
 * which change `date`, `onSelect`, or `onClose` — without this, the 42-cell grid would rebuild
 * on every one of those unrelated renders.
 */
export const MonthCalendar = memo(function MonthCalendar({ date, onSelect, onClose }: Props) {
  const [monthAnchor, setMonthAnchor] = useState(date);
  const [overview, setOverview] = useState<Readonly<Record<string, readonly TaskType[]>>>({});
  const [error, setError] = useState<string | null>(null);

  const weeks = useMemo(() => monthGrid(monthAnchor), [monthAnchor]);
  const firstCell = weeks[0]?.[0]?.date;
  const lastCell = weeks[weeks.length - 1]?.[6]?.date;

  useEffect(() => {
    if (firstCell === undefined || lastCell === undefined) return;
    let cancelled = false;
    getMonthOverview(firstCell, lastCell)
      .then((res) => {
        if (cancelled) return;
        setOverview(Object.fromEntries(res.days.map((d) => [d.date, d.types])));
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toErrorMessage(err, 'Could not load the month overview.'));
      });
    return () => {
      cancelled = true;
    };
  }, [firstCell, lastCell]);

  return (
    <div className="month-calendar">
      <div className="month-calendar__header">
        <button
          type="button"
          className="icon-button icon-button--ghost icon-button--md"
          aria-label="Hide month view"
          onClick={onClose}
        >
          ▲
        </button>
      </div>

      <div className="month-calendar__nav">
        <button
          type="button"
          className="icon-button icon-button--filled icon-button--sm"
          aria-label="Previous month"
          onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))}
        >
          ◄
        </button>
        <span className="month-calendar__heading">{formatMonthHeading(monthAnchor)}</span>
        <button
          type="button"
          className="icon-button icon-button--filled icon-button--sm"
          aria-label="Next month"
          onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}
        >
          ►
        </button>
      </div>

      {error !== null && <p className="error">{error}</p>}

      <div className="month-calendar__weekdays">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="month-calendar__grid">
        {weeks.map((week) =>
          week.map((cell) => {
            const types = overview[cell.date] ?? [];
            const classes = ['month-calendar__day'];
            if (!cell.inMonth) classes.push('month-calendar__day--outside');
            if (cell.date === date) classes.push('month-calendar__day--selected');
            return (
              <button type="button" key={cell.date} className={classes.join(' ')} onClick={() => onSelect(cell.date)}>
                <span className="month-calendar__day-number">{Number(cell.date.slice(-2))}</span>
                {/* Always rendered, even empty — reserves the same row height on every day so
                    a day with no activity doesn't sit shorter than one with dots. */}
                <span className="month-calendar__dots">
                  {types.slice(0, DOT_TYPES_SHOWN).map((t) => (
                    <span key={t} className={`month-calendar__dot type-dot--${t}`} />
                  ))}
                </span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
});
