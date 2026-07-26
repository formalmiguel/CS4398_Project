/**
 * FR-CAL-07 / SI-06: renders already-placed occurrences as an RFC 5545 iCalendar (`.ics`)
 * document. Pure formatting — no clock read, no database, no network (CON-07): every value
 * this function emits arrives as an argument, the same discipline `reasons.ts` already
 * applies to `clockLabel`. `now` is passed in, not read, for the same reason `Task.createdAt`
 * is passed to the engine's callers rather than consulted internally (`shared/src/contract.ts`).
 *
 * DTSTART/DTEND are emitted as RFC 5545 §3.3.5 FLOATING local time — no `Z`, no `TZID`. The
 * contract's `Minute` is already "minutes since LOCAL midnight" and no type in this System
 * (`Task`, `Placement`, `User`) carries a timezone, so floating time is the only form that
 * doesn't fabricate one. A calendar app reads it in whatever zone it is itself set to, which
 * is exactly what "the user's own local day" already means everywhere else in this codebase.
 */
import type { IsoDate, Minute } from '@capstone/shared';

export interface IcsExportEvent {
  readonly uid: string;
  readonly title: string;
  readonly date: IsoDate;
  readonly start: Minute;
  readonly end: Minute;
}

const CRLF = '\r\n';
const FOLD_LIMIT = 75;

/** RFC 5545 §3.3.11: escape backslash, semicolon, comma, and newline in a TEXT value. */
const escapeText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545 §3.1: a content line over 75 octets is folded — CRLF followed by a leading space. */
const foldLine = (line: string): string => {
  if (line.length <= FOLD_LIMIT) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > FOLD_LIMIT) {
    parts.push(rest.slice(0, FOLD_LIMIT));
    rest = rest.slice(FOLD_LIMIT);
  }
  parts.push(rest);
  return parts.join(`${CRLF} `);
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DD` + a `Minute` → the floating-local `YYYYMMDDTHHMMSS` DTSTART/DTEND form. */
const floatingDateTime = (date: IsoDate, minute: Minute): string => {
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  return `${date.replace(/-/g, '')}T${pad2(hour)}${pad2(min)}00`;
};

/** DTSTAMP — RFC 5545 requires one per VEVENT: the instant the file was generated, UTC. */
const utcStamp = (now: Date): string =>
  `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}T` +
  `${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;

/**
 * Sorted by (date, start) so the output is deterministic regardless of the order the caller's
 * query happened to return — a repository read makes no ordering promise the caller should
 * have to know about.
 */
const inOrder = (events: readonly IcsExportEvent[]): readonly IcsExportEvent[] =>
  [...events].sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));

export const buildIcsCalendar = (events: readonly IcsExportEvent[], now: Date): string => {
  const stamp = utcStamp(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Adaptive Habit, Schedule & Wellness System//FR-CAL-07//EN',
    'CALSCALE:GREGORIAN',
    ...inOrder(events).flatMap((event) => [
      'BEGIN:VEVENT',
      `UID:${event.uid}@adaptive-habit-scheduler`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${floatingDateTime(event.date, event.start)}`,
      `DTEND:${floatingDateTime(event.date, event.end)}`,
      `SUMMARY:${escapeText(event.title)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
};
