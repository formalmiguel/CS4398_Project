/**
 * 🔴 RED (packet 11) — FR-LIB-04 / FR-LIB-03. The deterministic mapping from a source record's
 * `category`/`level` to the System's `IntensityTier` (decision B). Packet 11b (GREEN) derives the
 * mapping from the frozen tests; this stub carries no answer.
 *
 * ⛔ A STUB RESOLVES NOTHING. If this compares `category` to `'stretching'` or returns a tier, it
 * is the implementation and the packet is compromised (§8.3).
 */
import type { IntensityTier } from '@capstone/shared';

export function resolveIntensityTier(_category: string, _level: string): IntensityTier {
  throw new Error('not implemented');
}
