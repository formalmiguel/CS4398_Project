// Shared by scripts/freeze-tests.mjs and scripts/guard-tests-frozen.mjs.
//
// One module rather than the same fifteen lines in both, because the two must agree
// EXACTLY on what a suite's fingerprint is. If the freezer and the guard ever computed
// it differently the guard would fail on an untouched suite, somebody would "fix" the
// guard, and the boundary would be gone. Drift between a safety net and the thing that
// arms it is the failure this file exists to make impossible.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** fileURLToPath, not URL.pathname - this repo's own path contains spaces, which
 *  pathname percent-encodes, and a Windows drive letter arrives with a leading slash. */
export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export const MANIFEST = join(ROOT, 'scripts', 'frozen-tests.json');

/** Every file under the suite directory is part of the frozen suite - fixtures and
 *  harnesses included. A weakened test double is a weakened test. */
export function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Repo-relative and POSIX-separated, so a manifest written on Windows verifies on CI. */
export const key = (file) => relative(ROOT, file).split('\\').join('/');

export const hashFile = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

export function hashSuite(suiteDir) {
  const files = {};
  for (const file of walk(suiteDir).sort()) files[key(file)] = hashFile(file);
  return files;
}
