/**
 * 🔴 RED (packet 08) — FR-WER-01, 02, 03, 05, 06, DR-02, DR-04, plus the OPEN-20 discriminator
 * and the CON-05 / §4.9 no-BMR guard.
 *
 * These tests pin how a DERIVED Garmin export normalizes into Daily Metric Sets. They fail
 * because `GarminExportAdapter`'s methods throw — that is the RED contract. 08b GREEN makes them
 * pass without editing, skipping, or weakening one (§4.6).
 *
 * Every test name cites the requirement it verifies — the traceability matrix as evidence
 * (Appendix B).
 */
import type { DailyMetricSet, Metric } from '@capstone/shared';

import { GarminExportAdapter } from '../../src/wearable/GarminExportAdapter';
import { loadGarminExport } from './wearableFixtures';

// ─── Local assertion helpers (they narrow; they do not compute the answer) ───

const setFor = (sets: readonly DailyMetricSet[], date: string): DailyMetricSet => {
  const found = sets.find((s) => s.date === date);
  if (found === undefined) throw new Error(`no DailyMetricSet for ${date}`);
  return found;
};

const metricOf = (set: DailyMetricSet, name: string): Metric => {
  const m = set.metrics[name];
  if (m === undefined) throw new Error(`no metric "${name}" on ${set.date}`);
  return m;
};

let adapter: GarminExportAdapter;

beforeAll(() => {
  adapter = new GarminExportAdapter(loadGarminExport('garmin-export.json'));
});

describe('GarminExportAdapter', () => {
  it('FR-WER-02/03: parses one DailyMetricSet per calendarDate, each keyed by metric name', () => {
    const sets = adapter.toMetricSets();
    const dates = sets.map((s) => s.date).sort();
    expect(dates).toEqual([
      '2024-01-11',
      '2024-06-01',
      '2026-02-13',
      '2026-03-10',
      '2026-03-17',
      '2026-03-18',
    ]);
  });

  it('FR-WER-03: every set carries exactly the two release metrics — sleepScore and activeCalories', () => {
    const sets = adapter.toMetricSets();
    for (const set of sets) {
      expect(Object.keys(set.metrics).sort()).toEqual(['activeCalories', 'sleepScore']);
    }
  });

  it('CON-05 / §4.9: no metric is ever derived from bmrKilocalories', () => {
    const sets = adapter.toMetricSets();
    for (const set of sets) {
      const names = Object.keys(set.metrics);
      expect(names).not.toContain('bmr');
      expect(names).not.toContain('bmrKilocalories');
      expect(names).not.toContain('basalCalories');
      expect(names).not.toContain('restingCalories');
    }
  });

  it('FR-WER-01: fetch(userId, date) resolves to the normalized DailyMetricSet for that date', async () => {
    const set = await adapter.fetch('user-1', '2026-03-10');
    expect(set.date).toBe('2026-03-10');
  });

  it('FR-WER-03 / DR-04: on a day both metrics are present, each carries its unit and origin EXPORT', () => {
    const set = setFor(adapter.toMetricSets(), '2026-03-10');

    const cal = metricOf(set, 'activeCalories');
    expect(cal.unit).toBe('kcal');
    expect(cal.origin).toBe('EXPORT');
    expect(cal.isAvailable).toBe(true);
    if (cal.isAvailable) expect(cal.value).toBe(540);

    const sleep = metricOf(set, 'sleepScore');
    // NOTE (ESCALATION-1): the SRS gives no unit token for a 0–100 sleep score the way it gives
    // "kcal" for calories. 'score' is the RED author's default, pending Ryan's ratification.
    expect(sleep.unit).toBe('score');
    expect(sleep.origin).toBe('EXPORT');
    expect(sleep.isAvailable).toBe(true);
    if (sleep.isAvailable) expect(sleep.value).toBe(82);
  });

  it('FR-WER-06 / DR-02: an ABSENT overallScore key leaves sleep UNAVAILABLE while active calories stay available', () => {
    // 2024-01-11: the sleepScores object is PRESENT (feedback/insight) but has NO overallScore
    // key on an ENHANCED_CONFIRMED_FINAL record (real: 2024-01-11, 2024-09-19). The real export
    // never emits `overallScore: null` (OPEN-26) — availability gates on `'overallScore' in
    // sleepScores`, not on `!= null`. An adapter doing `score ?? 0` or checking `!= null` fails here.
    const set = setFor(adapter.toMetricSets(), '2024-01-11');

    const sleep = metricOf(set, 'sleepScore');
    expect(sleep.isAvailable).toBe(false);
    // The unavailable branch has no `value` field at all (contract). Prove it is truly absent.
    expect('value' in sleep).toBe(false);

    // FR-WER-06: "the absence of one metric shall not render the others unavailable."
    const cal = metricOf(set, 'activeCalories');
    expect(cal.isAvailable).toBe(true);
    if (cal.isAvailable) expect(cal.value).toBe(300);
  });

  it('OPEN-20: activeKilocalories 0 WITH totalSteps present is a MEASURED zero (available, value 0)', () => {
    // 2026-03-17, 26 steps.
    const set = setFor(adapter.toMetricSets(), '2026-03-17');
    const cal = metricOf(set, 'activeCalories');
    expect(cal.isAvailable).toBe(true);
    if (cal.isAvailable) expect(cal.value).toBe(0);
  });

  it('OPEN-20: activeKilocalories 0 WITHOUT totalSteps is UNAVAILABLE', () => {
    const set = setFor(adapter.toMetricSets(), '2026-03-18');
    const cal = metricOf(set, 'activeCalories');
    expect(cal.isAvailable).toBe(false);
    expect('value' in cal).toBe(false);
  });

  it('OPEN-20: totalSteps — NOT includesActivityData — is the discriminator', () => {
    // 2026-02-13: 721 kcal with includesActivityData=false but totalSteps present → available.
    // This pins the team decision that includesActivityData must not be used (it tracks
    // something else). An adapter keying on includesActivityData would mark this unavailable.
    const set = setFor(adapter.toMetricSets(), '2026-02-13');
    const cal = metricOf(set, 'activeCalories');
    expect(cal.isAvailable).toBe(true);
    if (cal.isAvailable) expect(cal.value).toBe(721);
  });

  it('FR-WER-06: a day present in one source only still yields the other metric marked unavailable', () => {
    // 2026-03-17 has an activity record but no sleep record → sleepScore is recorded unavailable,
    // never fabricated or defaulted.
    const set = setFor(adapter.toMetricSets(), '2026-03-17');
    const sleep = metricOf(set, 'sleepScore');
    expect(sleep.isAvailable).toBe(false);
    expect('value' in sleep).toBe(false);
  });

  it('FR-REC-01 boundary: a sleep score of exactly 75 is carried through as an available value', () => {
    // 75 is a named FR-REC-01 boundary asserted downstream in 09/10; preserve it verbatim here.
    const set = setFor(adapter.toMetricSets(), '2024-06-01');
    const sleep = metricOf(set, 'sleepScore');
    expect(sleep.isAvailable).toBe(true);
    if (sleep.isAvailable) expect(sleep.value).toBe(75);
  });

  it('OPEN-26 (defensive): a stray duplicate calendarDate still yields exactly one DailyMetricSet', () => {
    // The REAL export has no intra-file duplicate dates (OPEN-26 closed), so this is not a real
    // case — it is a defensive guard on an inline synthetic export. FR-WER-09's actual last-write-
    // wins is the MetricStore upsert's job (see MetricStore.test.ts), not the adapter's. The
    // adapter groups per calendarDate, so a duplicate collapses to one set for free; which record
    // wins is deliberately NOT asserted here (pending the team decision noted at freeze).
    const dup = new GarminExportAdapter({
      activity: [
        { calendarDate: '2099-01-01', activeKilocalories: 100, totalSteps: 1000 },
        { calendarDate: '2099-01-01', activeKilocalories: 200, totalSteps: 2000 },
      ],
      sleep: [],
    });
    const forDate = dup.toMetricSets().filter((s) => s.date === '2099-01-01');
    expect(forDate).toHaveLength(1);
  });
});
