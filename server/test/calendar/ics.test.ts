import { buildIcsCalendar, IcsExportEvent } from '../../src/calendar/ics';

const NOW = new Date('2026-07-24T18:30:05.000Z');

describe('buildIcsCalendar — FR-CAL-07 / SI-06', () => {
  it('wraps the document in BEGIN/END:VCALENDAR with a RFC 5545 VERSION/PRODID', () => {
    const ics = buildIcsCalendar([], NOW);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('CALSCALE:GREGORIAN\r\n');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('renders one VEVENT per placed occurrence with DTSTART/DTEND as floating local time', () => {
    const event: IcsExportEvent = {
      uid: 'placement-1',
      title: 'Morning Run',
      date: '2026-07-25',
      start: 6 * 60 + 30, // 06:30
      end: 7 * 60 + 15, // 07:15
    };
    const ics = buildIcsCalendar([event], NOW);
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('UID:placement-1@adaptive-habit-scheduler\r\n');
    expect(ics).toContain('DTSTART:20260725T063000\r\n');
    expect(ics).toContain('DTEND:20260725T071500\r\n');
    expect(ics).toContain('SUMMARY:Morning Run\r\n');
    expect(ics).toContain('END:VEVENT\r\n');
    // Floating time per RFC 5545 §3.3.5: no trailing Z, no TZID — the System stores no timezone.
    expect(ics).not.toMatch(/DTSTART:[^\r\n]*Z/);
  });

  it('DTSTAMP reflects the instant passed in, in UTC, not the event\'s own date', () => {
    const event: IcsExportEvent = { uid: 'p1', title: 'X', date: '2026-01-01', start: 0, end: 60 };
    const ics = buildIcsCalendar([event], NOW);
    expect(ics).toContain('DTSTAMP:20260724T183005Z\r\n');
  });

  it('escapes commas, semicolons, and backslashes in the title (RFC 5545 §3.3.11)', () => {
    const event: IcsExportEvent = {
      uid: 'p1',
      title: 'Buy milk, eggs; bread \\ butter',
      date: '2026-07-25',
      start: 0,
      end: 30,
    };
    const ics = buildIcsCalendar([event], NOW);
    expect(ics).toContain('SUMMARY:Buy milk\\, eggs\\; bread \\\\ butter\r\n');
  });

  it('folds a content line longer than 75 octets with CRLF + a leading space (RFC 5545 §3.1)', () => {
    const event: IcsExportEvent = {
      uid: 'p1',
      title: 'A'.repeat(120),
      date: '2026-07-25',
      start: 0,
      end: 30,
    };
    const ics = buildIcsCalendar([event], NOW);
    const summaryLineStart = ics.indexOf('SUMMARY:');
    const folded = ics.slice(summaryLineStart, summaryLineStart + 78);
    expect(folded).toContain('\r\n ');
    // No raw (unfolded) line in the output exceeds 75 octets.
    for (const line of ics.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it('orders events by date then start time regardless of input order', () => {
    const later: IcsExportEvent = { uid: 'b', title: 'Later', date: '2026-07-26', start: 60, end: 90 };
    const earlierSameDay: IcsExportEvent = { uid: 'a', title: 'Earlier', date: '2026-07-25', start: 60, end: 90 };
    const earliestSameDay: IcsExportEvent = { uid: 'c', title: 'Earliest', date: '2026-07-25', start: 0, end: 30 };
    const ics = buildIcsCalendar([later, earlierSameDay, earliestSameDay], NOW);
    const order = [...ics.matchAll(/UID:([a-z])@/g)].map((m) => m[1]);
    expect(order).toEqual(['c', 'a', 'b']);
  });

  it('an empty event list still produces a valid, empty calendar', () => {
    const ics = buildIcsCalendar([], NOW);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
