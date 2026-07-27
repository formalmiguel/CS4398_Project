/**
 * 🟢 GREEN (packet 11b) — FR-LIB-04 / FR-LIB-03. The deterministic, documented mapping from a
 * `free-exercise-db` record's `category`/`level` to the System's `IntensityTier` (decision B,
 * SRS v2.29). The mapping is derived from the frozen `intensityTierMapping.test.ts` truth table,
 * transcribed here as decision B — never re-authored:
 *
 *   1. category === 'stretching'    → LOW   (a stretch is low intensity regardless of level)
 *   2. else category === 'plyometrics' → HIGH  (explosive work is high intensity regardless of level)
 *   3. else by level: beginner → LOW, intermediate → MODERATE, expert → HIGH
 *
 * The rule is TOTAL over the six documented categories × three levels (the 18 pinned rows). The
 * `default` on the level switch is defensive only — the seed is curated to the known levels, so it
 * is never reached in practice; it keeps the function total (returns a value, never throws) for any
 * string, which is what "deterministic" requires.
 */
import type { IntensityTier } from '@capstone/shared';

export function resolveIntensityTier(category: string, level: string): IntensityTier {
  if (category === 'stretching') return 'LOW';
  if (category === 'plyometrics') return 'HIGH';
  switch (level) {
    case 'beginner':
      return 'LOW';
    case 'expert':
      return 'HIGH';
    case 'intermediate':
    default:
      return 'MODERATE';
  }
}
