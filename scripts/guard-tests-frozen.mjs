// RED/GREEN boundary guard. A frozen test suite may not change - CLAUDE.md 8.3.
//
// The commit is the permission boundary, not the fresh chat session. A GREEN agent
// stuck on the last failing assertion will weaken it and produce a fluent, entirely
// reasonable explanation of why the test was subtly incorrect. Do not rely on it being
// forbidden; make it impossible.
//
// Compares the WORKING TREE against each freeze sha, not HEAD against it. That is
// deliberate and strictly stronger: it catches an edited-and-committed test, an edited
// uncommitted one, and a deleted one. The documented `..HEAD` form missed the middle case
// entirely, which is the case that matters, because a committed test edit is the one that
// becomes indistinguishable from a weakened test forever after.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const manifestUrl = new URL('./frozen-tests.json', import.meta.url);
const { frozen } = JSON.parse(readFileSync(manifestUrl, 'utf8'));

if (frozen.length === 0) {
  console.log('no frozen test suites recorded yet (scripts/frozen-tests.json)');
  process.exit(0);
}

let failed = false;

for (const { packet, path, sha, tests } of frozen) {
  try {
    git('cat-file', '-e', `${sha}^{commit}`);
  } catch {
    console.error(`P${packet}: freeze commit ${sha} is not in this repository.`);
    console.error('  A shallow clone cannot verify the boundary. Fetch full history:');
    console.error('  git fetch --unshallow');
    failed = true;
    continue;
  }

  const diff = git('diff', '--stat', sha, '--', path).trim();

  if (diff === '') {
    console.log(`P${packet}: ${path} unchanged since ${sha} (${tests} tests frozen)`);
    continue;
  }

  console.error(`\nP${packet} BOUNDARY VIOLATION: ${path} has changed since ${sha}.`);
  console.error(diff.replace(/^/gm, '  '));
  console.error('');
  console.error('  These tests are the requirements in executable form. An implementer');
  console.error('  may not edit, skip, rename or weaken one - CLAUDE.md 8.3.');
  console.error('');
  console.error('  If you are an agent: STOP. Restore them and report what you were');
  console.error(`  trying to fix - git checkout ${sha} -- ${path}`);
  console.error('');
  console.error('  If a test is genuinely wrong, a HUMAN fixes it in a RED-style commit');
  console.error('  with the reasoning in the body, then re-freezes at the new sha in');
  console.error('  scripts/frozen-tests.json. Do not "fix" this by editing the manifest.');
  failed = true;
}

if (failed) process.exit(1);
