/**
 * 🟢 GREEN (packet 11b) — FR-LIB-10. The recorded licence and attribution for every seeded dataset.
 *
 * Only the WORKOUT library is seeded from an external dataset — `free-exercise-db` (decision A),
 * released under The Unlicense (public domain), which permits the storage and redistribution the
 * vendored `data/free-exercise-db.subset.json` relies on. The full notice is in
 * `data/ATTRIBUTION.md`. The MEAL library is hand-authored (§4.2), has no external source, and so
 * carries no entry here.
 */

/** The provenance of one seeded dataset — the source it came from and the licence it is used under. */
export interface SeedAttribution {
  readonly source: string;
  readonly licence: string;
}

export function seedAttribution(): readonly SeedAttribution[] {
  return [{ source: 'free-exercise-db', licence: 'The Unlicense' }];
}
