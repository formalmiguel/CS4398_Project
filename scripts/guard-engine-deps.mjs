// FR-SCH-05 / NFR-MNT-03 guard: engine and shared declare ZERO runtime dependencies.
// An engine that cannot import anything cannot import a clock.
import { readFileSync } from 'node:fs';

let failed = false;
for (const pkg of ['engine', 'shared']) {
  const json = JSON.parse(readFileSync(new URL(`../${pkg}/package.json`, import.meta.url), 'utf8'));
  const deps = Object.keys(json.dependencies ?? {});
  if (deps.length > 0) {
    console.error(`FR-SCH-05 VIOLATION: ${pkg}/package.json declares runtime dependencies: ${deps.join(', ')}`);
    console.error('  This is not a lint nit. Escalate to the team; do not "fix" it by editing this guard.');
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('engine and shared declare zero runtime dependencies (FR-SCH-05)');
