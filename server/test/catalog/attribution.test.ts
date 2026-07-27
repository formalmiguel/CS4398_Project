/**
 * 🔴 RED (packet 11) — FR-LIB-10. The seed source's licence and attribution are recorded in the
 * repository. RED because `seedAttribution` THROWS; 11b (GREEN) records the `free-exercise-db`
 * provenance (decision A: The Unlicense — public domain, permitting storage and redistribution).
 */
import { seedAttribution } from '../../src/catalog/attribution';

describe('seed attribution — FR-LIB-10', () => {
  it('FR-LIB-10: the repository records a provenance entry for every seeded dataset', () => {
    const records = seedAttribution();
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.source.trim().length).toBeGreaterThan(0);
      expect(record.licence.trim().length).toBeGreaterThan(0);
    }
  });

  it('FR-LIB-10: the exercise dataset is recorded as free-exercise-db under The Unlicense', () => {
    const records = seedAttribution();
    const exercise = records.find((r) => /free-exercise-db/i.test(r.source));
    expect(exercise).toBeDefined();
    expect(exercise?.licence).toMatch(/unlicense/i);
  });
});
