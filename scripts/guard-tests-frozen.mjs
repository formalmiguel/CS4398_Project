// RED/GREEN boundary guard. A frozen test suite may not change - CLAUDE.md 8.3.
//
// The freeze, not the fresh chat session, is the permission boundary. A GREEN agent stuck
// on the last failing assertion will weaken it and produce a fluent, entirely reasonable
// explanation of why the test was subtly incorrect. Do not rely on it being forbidden;
// make it visible.
//
// PRIMARY CHECK: sha256 per file, recorded by `npm run freeze` (scripts/freeze-tests.mjs).
// It catches an edited test, an edited-AND-COMMITTED test, a deleted one, and a test
// QUIETLY ADDED to a frozen suite - and it needs no git history, so it works mid-replay
// before any commit exists, and in a shallow clone. That last property is why the check
// is hash-based rather than commit-based; see the header of freeze-tests.mjs.
//
// SECONDARY CHECK: if the entry records a git sha AND that commit is reachable, the working
// tree is also diffed against it. This is provenance, not enforcement - it attests WHEN the
// freeze happened, from something other than the manifest. A missing commit is reported and
// skipped, never failed: a replay legitimately has no commits yet, and failing there would
// make the guard unusable in exactly the situation it was rebuilt to support.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST, ROOT, hashSuite } from './lib/suite-hash.mjs';

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const { frozen } = JSON.parse(readFileSync(MANIFEST, 'utf8'));

if (frozen.length === 0) {
  console.log('no frozen test suites recorded yet (scripts/frozen-tests.json)');
  process.exit(0);
}

let failed = false;

for (const { packet, path, sha, tests, files } of frozen) {
  if (!files) {
    console.error(`\nP${packet}: manifest entry for ${path} records no file hashes.`);
    console.error('  This entry pins nothing and would pass forever. Re-run:');
    console.error(`  npm run freeze -- --packet ${packet} --path ${path}`);
    failed = true;
    continue;
  }

  let onDisk;
  try {
    onDisk = hashSuite(join(ROOT, path));
  } catch {
    onDisk = {};
  }

  const modified = Object.keys(files).filter((f) => onDisk[f] && onDisk[f] !== files[f]);
  const deleted = Object.keys(files).filter((f) => !onDisk[f]);
  const added = Object.keys(onDisk).filter((f) => !files[f]);

  if (modified.length === 0 && deleted.length === 0 && added.length === 0) {
    let provenance = sha ? ` frozen at ${sha}` : ' frozen (no commit recorded)';
    if (sha) {
      try {
        git('cat-file', '-e', `${sha}^{commit}`);
        const drift = git('diff', '--stat', sha, '--', path).trim();
        if (drift !== '') {
          // Hashes match the manifest but the tree differs from the recorded commit.
          // Means the manifest was re-recorded against a changed suite - i.e. someone
          // edited the tests and re-froze rather than escalating. Exactly the move
          // CLAUDE.md 8.3 calls "editing the test, one level removed".
          console.error(`\nP${packet} PROVENANCE MISMATCH: ${path} matches the manifest but NOT ${sha}.`);
          console.error(drift.replace(/^/gm, '  '));
          console.error('');
          console.error('  The recorded hashes agree with the working tree, so the manifest was');
          console.error('  re-recorded AFTER the suite changed. Re-freezing is a team decision with');
          console.error('  a row in TEAM-MEETING.md - never a step taken to make a build go green.');
          failed = true;
          continue;
        }
      } catch {
        provenance = ` frozen at ${sha} (commit not reachable here - hashes verified)`;
      }
    }
    console.log(`P${packet}: ${path} unchanged,${provenance}${tests ? ` (${tests} tests)` : ''}`);
    continue;
  }

  console.error(`\nP${packet} BOUNDARY VIOLATION: ${path} has changed since it was frozen.`);
  for (const f of modified) console.error(`  modified  ${f}`);
  for (const f of deleted) console.error(`  deleted   ${f}`);
  for (const f of added) console.error(`  added     ${f}  <- a new file in a frozen suite is a change to it`);
  console.error('');
  console.error('  These tests are the requirements in executable form. An implementer');
  console.error('  may not edit, skip, rename or weaken one - CLAUDE.md 8.3.');
  console.error('');
  console.error('  If you are an agent: STOP. Restore them and report what you were trying');
  console.error(`  to fix.${sha ? `  git checkout ${sha} -- ${path}` : ''}`);
  console.error('');
  console.error('  If a test is genuinely wrong, a HUMAN adjudicates it against the SRS and');
  console.error('  re-freezes with the reasoning recorded. Do not "fix" this by re-running');
  console.error('  `npm run freeze`, and do not edit scripts/frozen-tests.json by hand -');
  console.error('  both are editing the test, one level removed.');
  failed = true;
}

if (failed) process.exit(1);
