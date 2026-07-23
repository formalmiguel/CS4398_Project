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

export const todayIso = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDays = (isoDate: string, delta: number): string => {
  const { year, month, day } = parseIsoDate(isoDate);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

export const formatDateHeading = (isoDate: string): string => {
  const { year, month, day } = parseIsoDate(isoDate);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};
