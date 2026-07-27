/**
 * 🔴 RED (packet 11) — FR-LIB-10. The recorded licence and attribution for any seeded dataset.
 *
 * THROWS in RED. Packet 11b (GREEN) records the `free-exercise-db` provenance here (or points this
 * at a committed `ATTRIBUTION.md`) — the source name and the licence (The Unlicense, decision A),
 * satisfying FR-LIB-10's "licence and attribution recorded in the repository".
 */

/** The provenance of one seeded dataset — the source it came from and the licence it is used under. */
export interface SeedAttribution {
  readonly source: string;
  readonly licence: string;
}

export function seedAttribution(): readonly SeedAttribution[] {
  throw new Error('not implemented');
}
