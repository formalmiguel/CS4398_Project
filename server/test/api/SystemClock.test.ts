import { SystemClock } from '../../src/api/SystemClock';

describe('SystemClock', () => {
  it('FR-RSC-10: nowMinute returns a value in range [0, 1439]', () => {
    const clock = new SystemClock();
    const minute = clock.nowMinute();
    expect(minute).toBeGreaterThanOrEqual(0);
    expect(minute).toBeLessThan(1440);
  });

  it('today returns an IsoDate matching YYYY-MM-DD', () => {
    expect(new SystemClock().today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('nextDate rolls over the day, month, and year correctly', () => {
    const clock = new SystemClock();
    expect(clock.nextDate('2026-07-22')).toBe('2026-07-23');
    expect(clock.nextDate('2026-07-31')).toBe('2026-08-01');
    expect(clock.nextDate('2026-12-31')).toBe('2027-01-01');
  });
});
