/**
 * The ONE legitimate place in this codebase that reads the real system clock for scheduling
 * purposes. Implements the `Clock` port `RescheduleService` is told the time through
 * (FR-RSC-10) — nothing under `server/src/reschedule/` may read a clock itself, and this file
 * is the reason that prohibition can stay absolute: the real time enters at exactly one point,
 * by injection, same as the engine does.
 */
import type { Clock } from '../reschedule/RescheduleService';
import type { IsoDate, Minute } from '@capstone/shared';

const toIsoDate = (d: Date): IsoDate => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export class SystemClock implements Clock {
  nowMinute(): Minute {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  today(): IsoDate {
    return toIsoDate(new Date());
  }

  nextDate(date: IsoDate): IsoDate {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year as number, (month as number) - 1, (day as number) + 1);
    return toIsoDate(d);
  }
}
