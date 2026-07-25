import type { Minute } from '@capstone/shared';

/** Wall-clock conversion happens only at the render boundary — the contract's own convention. */
export const minuteToLabel = (minute: Minute): string => {
  const hour24 = Math.floor(minute / 60) % 24;
  const mins = minute % 60;
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(mins).padStart(2, '0')} ${period}`;
};

/** An `<input type="time">` always yields `HH:MM` — the `?? 0` is TS's noUncheckedIndexedAccess, not a real fallback. */
export const timeToMinute = (hhmm: string): Minute => {
  const [h, m] = hhmm.split(':');
  return Number(h ?? 0) * 60 + Number(m ?? 0);
};

const parseIsoDate = (isoDate: string): { year: number; month: number; day: number } => {
  const [y, m, d] = isoDate.split('-');
  return { year: Number(y ?? 0), month: Number(m ?? 1), day: Number(d ?? 1) };
};

const formatIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const todayIso = (): string => formatIsoDate(new Date());

export const addDays = (isoDate: string, delta: number): string => {
  const { year, month, day } = parseIsoDate(isoDate);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return formatIsoDate(date);
};

export const formatDateHeading = (isoDate: string): string => {
  const { year, month, day } = parseIsoDate(isoDate);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

export const addMonths = (isoDate: string, delta: number): string => {
  const { year, month, day } = parseIsoDate(isoDate);
  const date = new Date(year, month - 1, day);
  date.setMonth(date.getMonth() + delta);
  return formatIsoDate(date);
};

export const formatMonthHeading = (isoDate: string): string => {
  const { year, month } = parseIsoDate(isoDate);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

export interface CalendarDay {
  readonly date: string;
  readonly inMonth: boolean;
}

/**
 * A Monday-start, 6-row (42-day) grid covering `monthAnchor`'s month, padded with adjacent
 * months' days — the same shape as the picture's mini calendar. Six rows is a fixed size (not
 * "however many the month needs") so the grid's height never jumps between months.
 */
export const monthGrid = (monthAnchor: string): readonly (readonly CalendarDay[])[] => {
  const { year, month } = parseIsoDate(monthAnchor);
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay() === 0 ? 7 : first.getDay(); // Mon=1..Sun=7
  const offset = firstWeekday - 1; // days to back up to the prior Monday
  const cursor = new Date(year, month - 1, 1 - offset);

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push({ date: formatIsoDate(cursor), inMonth: cursor.getMonth() === month - 1 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
};
