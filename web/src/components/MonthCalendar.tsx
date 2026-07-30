import { memo, useEffect, useMemo, useState } from 'react';

import type { TaskType } from '@capstone/shared';

import { MonthOverviewItem, getMonthOverview, toErrorMessage } from '../api/client';
import { addMonths, formatMonthHeading, minuteToLabel, monthGrid, todayIso } from '../dateUtils';

interface Props {
  /** The currently selected day (`ScheduleView`'s own `date`) — highlighted, and the month it opens on. */
  readonly date: string;
  readonly onSelect: (date: string) => void;
  /**
   * `'full'` (default): FR-DSH-08's full-page month view (the `Month` tab) — each cell lists
   * that day's tasks by title and time. `'compact'`: the original collapsible mini-navigator
   * that lives inside Day view — dots only, small, and closable.
   */
  readonly variant?: 'full' | 'compact';
  /** Required for `variant="compact"` — collapses the navigator back into Day view. */
  readonly onClose?: () => void;
}

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** How many events a cell lists before it collapses the rest into "+N more" (§3.7.1's picture). */
const ITEMS_SHOWN = 3;

/** Same fixed order as `styles.css`'s `--type-*` tokens — decorative, never the sole carrier of meaning. */
const DOT_TYPES_SHOWN = 3;

/**
 * FR-DSH-08's month-grid navigator, in two shapes sharing one data source.
 *
 * `variant="full"` (the `Month` tab, `docs/full.png`): a full-page grid, one cell per day, each
 * listing that day's tasks by title and time. `variant="compact"`: a small collapsible navigator
 * that opens above the Day view's timeline — dots only, one per represented task type — kept
 * around for quick glancing/navigation without leaving Day view.
 *
 * Sourced from `GET /schedule/overview` (`TaskRepository.taskTypesInRange`) — a read of task
 * DEFINITIONS, not placements, so it is safe for a month nobody has opened via the day view. The
 * time shown per item (full variant) is therefore the task's `preferredWindow.start`, not a
 * placed time: exact for a FIXED commitment, a first guess for a flexible one (see that method's
 * own note).
 *
 * Memoized: `ScheduleView` re-renders on every schedule action (complete/skip/refresh), none of
 * which change `date`/`onSelect`/`variant`/`onClose` — without this, the 42-cell grid would
 * rebuild on every one of those unrelated renders.
 */
export const MonthCalendar = memo(function MonthCalendar({ date, onSelect, variant = 'full', onClose }: Props) {
  const [monthAnchor, setMonthAnchor] = useState(date);
  const [overview, setOverview] = useState<Readonly<Record<string, readonly MonthOverviewItem[]>>>({});
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();
  const isCompact = variant === 'compact';

  const weeks = useMemo(() => monthGrid(monthAnchor), [monthAnchor]);
  const firstCell = weeks[0]?.[0]?.date;
  const lastCell = weeks[weeks.length - 1]?.[6]?.date;

  useEffect(() => {
    if (firstCell === undefined || lastCell === undefined) return;
    let cancelled = false;
    getMonthOverview(firstCell, lastCell)
      .then((res) => {
        if (cancelled) return;
        setOverview(Object.fromEntries(res.days.map((d) => [d.date, d.items])));
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
    <div className={isCompact ? 'month-calendar' : 'month-calendar month-calendar--full'}>
      {isCompact && (
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
      )}

      <div className="month-calendar__nav">
        <button
          type="button"
          className="icon-button icon-button--filled icon-button--sm"
          aria-label="Previous month"
          onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))}
        >
          ◀
        </button>
        <span className="month-calendar__heading">{formatMonthHeading(monthAnchor)}</span>
        <button
          type="button"
          className="icon-button icon-button--filled icon-button--sm"
          aria-label="Next month"
          onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}
        >
          ▶
        </button>
      </div>

      {error !== null && <p className="error">{error}</p>}

      <div className="month-calendar__weekdays">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      {isCompact ? (
        <div className="month-calendar__grid">
          {weeks.map((week) =>
            week.map((cell) => {
              const types = [...new Set((overview[cell.date] ?? []).map((i) => i.type))] as readonly TaskType[];
              const classes = ['month-calendar__day'];
              if (!cell.inMonth) classes.push('month-calendar__day--outside');
              if (cell.date === date) classes.push('month-calendar__day--selected');
              return (
                <button type="button" key={cell.date} className={classes.join(' ')} onClick={() => onSelect(cell.date)}>
                  <span className="month-calendar__day-number">{Number(cell.date.slice(-2))}</span>
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
      ) : (
        <div className="month-calendar__grid month-calendar__grid--full">
          {weeks.map((week) =>
            week.map((cell) => {
              const items = overview[cell.date] ?? [];
              const shown = items.slice(0, ITEMS_SHOWN);
              const overflow = items.length - shown.length;
              const classes = ['month-calendar__day', 'month-calendar__day--full'];
              if (!cell.inMonth) classes.push('month-calendar__day--outside');
              if (cell.date === date && cell.date !== today) classes.push('month-calendar__day--selected');
              return (
                <button type="button" key={cell.date} className={classes.join(' ')} onClick={() => onSelect(cell.date)}>
                  <span
                    className={
                      cell.date === today
                        ? 'month-calendar__day-number month-calendar__day-number--today'
                        : 'month-calendar__day-number'
                    }
                  >
                    {Number(cell.date.slice(-2))}
                  </span>
                  <span className="month-calendar__items">
                    {shown.map((item) => (
                      <span key={item.id} className="month-calendar__item">
                        <span className={`month-calendar__item-bar type-dot--${item.type}`} aria-hidden="true" />
                        <span className="month-calendar__item-title">{item.title}</span>
                        <span className="month-calendar__item-time">{minuteToLabel(item.start)}</span>
                      </span>
                    ))}
                    {overflow > 0 && <span className="month-calendar__item-more">+{overflow} more</span>}
                  </span>
                </button>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
});
