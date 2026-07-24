/**
 * A `Clock` a test can advance by hand — never `Date.now()`. Same reasoning as packet 06's
 * `TestClock` (`server/test/reschedule/support/harness.ts`): FR-RSC-10 is verified "with the
 * clock advanced past a placed occurrence's window," which a clock reading real time cannot do.
 */
import type { Clock } from '../../src/reschedule/RescheduleService';
import type { IsoDate, Minute } from '@capstone/shared';

export class TestableClock implements Clock {
  constructor(
    private minute: Minute,
    private date: IsoDate,
  ) {}

  nowMinute(): Minute {
    return this.minute;
  }

  today(): IsoDate {
    return this.date;
  }

  nextDate(date: IsoDate): IsoDate {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(Date.UTC(year as number, (month as number) - 1, (day as number) + 1));
    return d.toISOString().slice(0, 10);
  }

  advanceTo(minute: Minute): void {
    this.minute = minute;
  }
}
