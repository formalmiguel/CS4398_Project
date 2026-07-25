/**
 * Test-only loader for the DERIVED Garmin export fixtures. Reads them off disk with `fs` because
 * the workspace tsconfig has no `resolveJsonModule`, so a JSON `import` would not type-check —
 * and reading them keeps the raw shape as data rather than baking it into the module graph.
 *
 * ⛔ These fixtures are hand-authored, minimal, and DERIVED (§8.4). No real person's dated
 * health record is copied wholesale — only the two source files' relevant keys, with values
 * chosen to exercise each requirement case.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import type { GarminExport } from '../../src/wearable/GarminExportAdapter';

const FIXTURE_DIR = join(__dirname, 'fixtures');

export const loadGarminExport = (fileName: string): GarminExport =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, fileName), 'utf-8')) as GarminExport;
