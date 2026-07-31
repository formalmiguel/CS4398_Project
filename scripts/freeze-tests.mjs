// Freeze a RED packet's test suite. The mechanical half of the RED/GREEN boundary.
//
//   npm run freeze -- --packet 04 --path engine/test --owner "Patrick Rucker"
//
// WHAT THIS RECORDS, AND WHY IT IS A HASH AND NOT JUST A COMMIT
//
// The freeze needs one thing: the tests, in a recorded state, recorded BEFORE any
// implementation exists and checkable afterwards. A commit is one way to get that, and
// it was the original way - but it couples the safety net to git history, and that
// coupling breaks a property this project wants to be able to demonstrate: delete every
// generated file, run the packets in order, and get the application back with its suites
// frozen and protected FOR THAT RUN. A replay makes no commits until a human has read
// the result (CLAUDE.md 8.5), so a commit-based freeze has nothing to point at while the
// run is still in progress.
//
// So the manifest records a sha256 per test file. That works with no history, no commits,
// and in a shallow clone. A git sha is still recorded when one is available, because it is
// real provenance - who froze it and when, attested by something other than this file. It
// is secondary. The hashes are the enforcement.
//
// DEFEATING THIS: edit scripts/frozen-tests.json. That is true of any manifest, and it is
// why CLAUDE.md 8.3 treats editing the manifest as editing the tests, one level removed.
// The guard makes the weakening visible in a diff; it cannot make it impossible.
//
// The `tests` count is OPTIONAL and INFORMATIONAL: pass `--tests N` with the number the
// runner just printed at the RED gate. It is never compared against anything - a replay
// legitimately produces a different number, and a count that gated the build would fail
// every replay by design. It is not inferred, because a count derived by pattern-matching
// source text is wrong often enough to be worse than an absent one, in a file whose entire
// value is that everything in it is exactly true.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST, ROOT, hashSuite } from './lib/suite-hash.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const packet = flag('packet');
const path = flag('path');
const owner = flag('owner');

if (!packet || !path) {
  console.error('usage: npm run freeze -- --packet <NN> --path <dir>');
  console.error('                        [--owner "Name"] [--tests N] [--sha <sha>]');
  console.error('  e.g. npm run freeze -- --packet 04 --path engine/test --tests 30');
  process.exit(2);
}

const suiteDir = join(ROOT, path);

let files;
try {
  files = hashSuite(suiteDir);
} catch {
  console.error(`freeze: cannot read ${path}. Is that the suite directory?`);
  process.exit(1);
}

if (Object.keys(files).length === 0) {
  console.error(`freeze: ${path} contains no files. Refusing to freeze an empty suite -`);
  console.error('  a freeze that pins nothing passes forever and protects nothing.');
  process.exit(1);
}

/** Provenance only. A replay in progress has no commit yet, and that is not an error.
 *  `--sha` overrides, for backfilling an entry frozen before hashes were recorded.
 *
 *  HEAD is adopted as provenance ONLY when the working tree for `path` matches it - i.e.
 *  HEAD actually contains THESE frozen files. In a from-scratch replay `rev-parse` fails
 *  and no sha is recorded; in a partial replay layered on unrelated history HEAD holds a
 *  DIFFERENT suite, and recording it would make guard-tests-frozen report a false
 *  PROVENANCE MISMATCH (hashes agree with the manifest but the tree differs from the sha).
 *  Leaving the entry sha-less is legitimate - the per-file hashes verify it fully
 *  (CLAUDE.md 4.12), and `--sha` backfills once a real commit containing these files exists. */
let sha = flag('sha');
if (!sha) {
  try {
    const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    // Throws (exit 1) when the working tree for `path` differs from HEAD - a replay whose
    // suite HEAD does not contain. Then the catch leaves sha undefined, which is correct.
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', path], { cwd: ROOT, stdio: 'ignore' });
    sha = head;
  } catch {
    sha = undefined;
  }
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const existing = manifest.frozen.find((e) => e.packet === packet);

const entry = {
  ...(existing ?? {}),
  packet,
  path,
  frozenOn: existing?.frozenOn ?? new Date().toISOString().slice(0, 10),
  ...(owner ? { owner } : {}),
  ...(flag('tests') ? { tests: Number(flag('tests')) } : {}),
  files,
};
// sha is provenance of THIS freeze's content, so it is set from this run's computation,
// never inherited. A re-freeze that establishes no commit (a replay) must CLEAR any stale
// sha the previous entry carried - otherwise guard-tests-frozen diffs the tree against a
// commit that no longer matches it and reports a false PROVENANCE MISMATCH.
if (sha) entry.sha = sha;
else delete entry.sha;

if (existing) {
  manifest.frozen[manifest.frozen.indexOf(existing)] = entry;
  console.log(`P${packet}: re-recorded ${path}`);
  console.warn('  NOTE: an entry for this packet already existed and has been OVERWRITTEN.');
  console.warn('  Re-freezing is a team decision with a row in TEAM-MEETING.md, not a routine step.');
} else {
  manifest.frozen.push(entry);
  console.log(`P${packet}: froze ${path}`);
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `  ${Object.keys(files).length} files${entry.tests ? `, ${entry.tests} tests` : ''}` +
    `${sha ? `, at ${sha}` : ', no commit yet (replay)'}`,
);
console.log('  Recorded in scripts/frozen-tests.json. `npm run guard:tests-frozen` now enforces it.');
