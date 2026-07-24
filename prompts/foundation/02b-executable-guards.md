# CRITICAL REQUIREMENTS — 02b Executable Guards and the Test Freeze

### MANDATORY DIRECTIVE ###

You are an expert Node engineer. **CRITICAL**: This packet is **transcription, not derivation.** Every file below is given **verbatim**. Reproduce it **exactly** — including comments, wording, and blank lines. **Do not improve, shorten, modernise, rename, or "clean up" anything in it.**

| | |
|---|---|
| **Phase** | **HUMAN-AUTHORED** — transcribed verbatim, like `foundation/03-shared-contract-types.md` |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 02 (the toolchain, `package.json`, `.eslintrc.cjs`, `.github/workflows/ci.yml`) |
| **Spec** | `docs/SRS-v2.md` §4.5 — **NFR-MNT-07, NFR-MNT-08**, NFR-MNT-03, NFR-MNT-04, NFR-MNT-09 · §3.8.4 (FR-SCH-05) · §3.2 (CON-04) |
| **Runs** | **Immediately after packet 02, before packet 04.** Packet 04 freezes a suite; the thing that freezes it must exist first. |

---

## ⛔ **CRITICAL**: WHY THIS PACKET IS HUMAN-AUTHORED AND NOT GENERATED

**MANDATORY**: Read this before transcribing. It is the reason the rest of the pack works the way it does, and the reason this one packet is the exception.

**`CLAUDE.md` §4.11 and §0.1 make the prompt pack a *generator*: the packets contain requirements, the agent creates the code, and re-running may produce different code — deliberately, because an implementation derived independently of the tests is the only thing that makes NFR-MNT-01's coverage figure and NFR-COR-01's property test mean anything.**

**This packet is one of exactly two exceptions, and it is an exception for the same reason as the other one.**

| Exception | Why it may not be regenerated |
|---|---|
| **The domain contract** (`shared/src/contract.ts`, packet 03) | Three agents produce three locally-reasonable, mutually incompatible `Task` types, each passing its own tests. Day-5 integration becomes a rewrite. *(§4.7)* |
| **The guards** (this packet) | **A regenerated safety net can come back weaker — and a weaker check passes.** Nothing fails. Nobody is told. The guard still prints a success line, and it is now guarding less than it says it is. |

> **MANDATORY**: This is the whole argument in one sentence: **you cannot verify a verifier with the thing it verifies.** A guard that came out 10% weaker than the one it replaced is indistinguishable, from the outside, from one that came out right — both exit 0. Every other packet in this pack is checked by something downstream of it; **these files are what that something is.**
>
> **CRITICAL**: Nothing here is measured by a coverage figure or a property test, so transcribing it verbatim costs the project nothing — **which is exactly why it is safe to do, and why doing the same thing to `engine/src/` would not be.** Do not generalise from this packet to any other.

**SRS NFR-MNT-09 states this exemption in binding form**, and names it: *"The human-authored inputs are exempt and are named, not implied: the domain contract (§3.6) and the enforcement checks required by NFR-MNT-07 and NFR-MNT-08."*

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md` v2.21. Do not paraphrase.

- **NFR-MNT-07.** *(Essential, I)* **Every requirement in this document whose verification method is Inspection (I) shall be enforced by an automated check that fails the build.** A requirement verified only by a written instruction to look is not verified: it has no failing state, so it becomes false without anything reporting it.

- **NFR-MNT-08.** *(Essential, I)* Where a test suite is **frozen** at the completion of a test-first work packet, the build shall be able to verify that suite as **unmodified — no file edited, deleted, renamed, or added — without reliance on repository history.**

- **NFR-MNT-03.** *(Essential, I)* **There shall be exactly one implementation of placement logic in the codebase** (FR-RSC-03).

- **NFR-MNT-04.** *(Essential, I)* The System shall pass a **linter and a type check with zero errors** as a precondition of any merge.

- **FR-SCH-05.** *(Essential, T)* The engine shall be a **pure function**: called twice with identical inputs it returns identical outputs; it performs no database write, no HTTP call, and no mutation of its arguments.

- **CON-04.** The scheduling engine shall be a module with **no dependency** on the HTTP layer, the database, or the wearable client, exercisable by unit tests that build their inputs in memory.

### **CRITICAL**: Explicitly Out Of Scope

- **FR-RSC-03's placement-function guard and FR-SCH-05's ambient-global guard** — those are **packet 16a**, and their subjects (`server/src/reschedule/`) do not exist yet. **This packet delivers the guards whose subjects exist after packet 02: the engine's dependency manifest, the engine's import list, and the freeze.**
- **FR-LIB-02 and FR-REC-11's guards** — packet 16b; they need packets 10 and 11.
- **Any test.** This packet writes no Jest suite. The guards are scripts in the `verify` chain.

> **MANDATORY**: **This packet does not claim to be the complete guard set**, and must not be edited later to say that it is. NFR-MNT-07 is satisfied incrementally, as each (I) requirement's subject comes into existence. 02b, 16a and 16b together are the set.

---

## **MANDATORY**: What To Build — Six Files, All Verbatim

### 1. `scripts/lib/suite-hash.mjs` *(new)*

```js
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
```

### 2. `scripts/freeze-tests.mjs` *(new)* — NFR-MNT-08

```js
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
 *  `--sha` overrides, for backfilling an entry frozen before hashes were recorded. */
let sha = flag('sha');
if (!sha) {
  try {
    sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
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
  ...(sha ? { sha } : {}),
  frozenOn: existing?.frozenOn ?? new Date().toISOString().slice(0, 10),
  ...(owner ? { owner } : {}),
  ...(flag('tests') ? { tests: Number(flag('tests')) } : {}),
  files,
};

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
```

### 3. `scripts/guard-tests-frozen.mjs` *(new)* — NFR-MNT-08

```js
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
```

### 4. `scripts/guard-engine-deps.mjs` *(new)* — FR-SCH-05, CON-04

```js
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
```

### 5. `scripts/frozen-tests.json` *(new — created EMPTY)*

**⛔ CRITICAL: `frozen` is an empty array and stays empty.** Each RED packet appends its own entry via `npm run freeze` when its gate is held. **A packet that pre-populates this file has frozen a suite that does not exist yet.**

```json
{
  "comment": [
    "Frozen test suites. One entry per RED packet, written by `npm run freeze`.",
    "",
    "A RED packet's tests are the requirements in executable form. Once frozen, the GREEN",
    "agent implementing against them may not edit, skip, rename or weaken one - see",
    "CLAUDE.md 8.3 and AGENTIC-TDD-WORKFLOW.md 5. That rule used to be enforced by a human",
    "remembering to run a git command, which was documented wrong in six places and could",
    "not have caught a test that was edited AND committed. It is now enforced here.",
    "",
    "`files` IS THE ENFORCEMENT: a sha256 per file. It needs no git history, so it holds",
    "in a shallow clone and mid-replay, before any commit exists. It catches an edited",
    "test, an edited-and-committed one, a deleted one, and a test quietly ADDED to a",
    "frozen suite. `sha` is PROVENANCE, not enforcement - it attests when the freeze",
    "happened, from something other than this file, and a re-freeze that does not match",
    "it is reported as a provenance mismatch. An entry with no `sha` is legitimate: a",
    "replay freezes before it commits (CLAUDE.md 8.5), and hashes verify it fully.",
    "",
    "`tests` is informational and is never compared. A replay produces a different",
    "number, and a count that gated the build would fail every replay by design.",
    "",
    "ADDING AN ENTRY: npm run freeze -- --packet NN --path <dir> --tests <N>",
    "",
    "CHANGING OR REMOVING AN ENTRY is how you would defeat this guard, so it is a team",
    "decision with a row in TEAM-MEETING.md - exactly like editing the tests themselves.",
    "If a frozen test was genuinely wrong, a HUMAN adjudicates it against the SRS, fixes",
    "it in a RED-style commit with the reasoning in the body, and re-freezes. Re-running",
    "`npm run freeze` to make a build go green is editing the test, one level removed."
  ],
  "frozen": []
}
```

### 6. `.eslintrc.cjs` — **add** the FR-SCH-05 import-level overrides

**MANDATORY**: Packet 02 created this file. **Add the `overrides` array below; change nothing else in it.**

**⛔ CRITICAL — the three-step deny/allow dance is load-bearing, not redundant.** `group: ['*']` denies everything; a scope directory must be **re-included** before anything inside it can be, then the sibling workspaces are re-denied, then exactly one is allowed. **An earlier version of this rule read `group: ['*']` alone with a message claiming relative paths were permitted. They were not — it rejected every import in `engine/`, including the engine's own contract import. Nobody noticed for a week, because `engine/` was empty and lint had nothing to check.**

```js
  overrides: [
    {
      // FR-SCH-05 purity guard, import-level. The package.json check catches
      // `npm install x -w engine`; this catches a stray import line, which is
      // the likelier mistake and the one the requirement actually cares about.
      //
      // Default-deny with explicit exemptions: `*` forbids everything, each `!`
      // re-permits one thing. Written this way so that giving the engine a new
      // import requires editing this file — which is the point of the guard.
      files: ['engine/src/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: [
              '*', // deny everything...
              '!@capstone', // ...but a scope dir must be re-included before anything inside it
              '@capstone/*', // ...then re-deny the sibling workspaces (server, web, engine)
              '!@capstone/shared', // ...and allow exactly one: the contract
              '!.', '!./**', '!..', '!../**', // relative paths within the engine
            ],
            message:
              'FR-SCH-05: engine/src may import ONLY relative paths and @capstone/shared. ' +
              'No clock, no database, no HTTP. Escalate rather than adding one.',
          }],
          paths: [],
        }],
      },
    },
    {
      // The same guard for the engine's tests, plus fast-check — NFR-COR-01 makes
      // the 1,000-case property test Essential, so the guard must not forbid the
      // library that requirement depends on. Test-only: nothing here is reachable
      // from engine/src, so the engine itself stays dependency-free.
      files: ['engine/test/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: [
              '*',
              '!@capstone', // see the note in the engine/src block above — gitignore
              '@capstone/*', // semantics: a parent dir must be re-included first, so
              '!@capstone/shared', // this three-step dance is load-bearing, not redundant
              '!fast-check', // NFR-COR-01's property test. Tests only.
              '!.', '!./**', '!..', '!../**',
            ],
            message:
              'FR-SCH-05: engine/test may import ONLY relative paths, @capstone/shared, ' +
              'and fast-check (NFR-COR-01). No clock, no database, no HTTP.',
          }],
          paths: [],
        }],
      },
    },
  ],
```

---

## **MANDATORY**: Wiring — `package.json` and `.github/workflows/ci.yml`

**CRITICAL — NFR-MNT-07 is about a check that FAILS THE BUILD.** A script nobody runs satisfies nothing.

**`package.json` — add three entries and extend `verify`:**

```
"guard:engine-deps":  "node scripts/guard-engine-deps.mjs",
"guard:tests-frozen": "node scripts/guard-tests-frozen.mjs",
"freeze":             "node scripts/freeze-tests.mjs",
```

`verify` runs, in order: `typecheck` → `lint` → `guard:engine-deps` → `guard:tests-frozen` → `test:coverage`. **Guards before tests**, so a boundary violation is reported before a wall of test output buries it.

> **MANDATORY**: **`freeze` is NOT in `verify`.** It *writes* the manifest. A verify chain that froze anything would re-freeze the suite it was supposed to be checking, every run, and the guard would pass forever. **If you find yourself adding it, stop and re-read this line.**

**`.github/workflows/ci.yml` — every guard in `verify` gets a named step**, each with a comment naming the requirement it enforces. `guard:tests-frozen` **must** be one of them.

> **⛔ CRITICAL**: `guard:tests-frozen` is hash-based and needs **no git history** (NFR-MNT-08), so the default shallow `actions/checkout` is fine. **Do not add `fetch-depth: 0` for it** — and if a future change makes the freeze depend on history again, that is a regression in NFR-MNT-08, not a checkout setting to adjust.

---

## **CRITICAL**: Files You May Create Or Edit

- `scripts/lib/suite-hash.mjs`, `scripts/freeze-tests.mjs`, `scripts/guard-tests-frozen.mjs`, `scripts/guard-engine-deps.mjs`, `scripts/frozen-tests.json` *(all new)*
- `.eslintrc.cjs` — **the `overrides` array only**
- `package.json` — **the three `scripts` entries and the `verify` chain only**
- `.github/workflows/ci.yml` — the guard steps

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ Anything under `engine/`, `shared/`, `server/`, `web/`.** This packet adds enforcement; it does not touch a subject. **If a guard fails on existing code, that is the finding — report it.**
- `shared/src/contract.ts` — the contract *(§4.7)*
- `docs/**`, `prompts/**` *(other than your own report)*

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] **CRITICAL — the freeze guard has been WATCHED TO FAIL in all four modes.** Freeze any suite, then in turn: **edit** a file in it, **delete** one, **add** a new one, and **edit-then-re-freeze** (which must report a *provenance mismatch*, not pass). **Confirm a non-zero exit and a message naming the requirement each time**, restore after each, and **record all four transcripts in your report.**
- [ ] **The dependency guard has been watched to fail** — add a dependency to `engine/package.json`, confirm exit 1, remove it.
- [ ] **The eslint override has been watched to fail** — add `import { readFileSync } from 'node:fs';` to a file under `engine/src/`, confirm `npm run lint` errors with the FR-SCH-05 message, remove it.
- [ ] `npm run freeze` with **no arguments** exits 2 and prints usage; against an **empty directory** it refuses rather than freezing nothing.
- [ ] **`git status` is clean apart from this packet's files** after every must-fail exercise.
- [ ] `npm run verify` passes end to end, with `no frozen test suites recorded yet` from the freeze guard — **correct at this point in the order**, since packet 04 has not run.
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*.
- [ ] **Every transcribed file is byte-identical to the block above**, comments included. **Diff them.**
- [ ] **⛔ Do not commit.** The commit is the human owner's assertion that they read the diff *(`CLAUDE.md` §8.5)*.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to the human owner — do not work around it — if:**

- **A transcribed file does not run as given** — a syntax error, a wrong path, an API that does not exist in Node 20. **Report the exact error. Do not fix it silently**, because a "fix" to a human-authored guard is precisely the regeneration this packet exists to prevent, and it would arrive looking like a typo correction.
- **A guard fires on the existing codebase.** That is a finding about the code, not about the guard.
- You believe a guard is weaker than the requirement it cites, or that it can be trivially evaded. **Say how.** *(Genuinely valuable — and note the known one, stated in `freeze-tests.mjs`'s own header: editing the manifest defeats it, which is why `CLAUDE.md` §8.3 treats that as editing the tests.)*
- Wiring a guard into `verify` or CI would require changing something outside the files listed above.

> **MANDATORY**: **An escalation is a success.** A transcription packet that reports zero problems has either transcribed correctly or has not checked — and the must-fail exercises above are how you tell those apart.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when `npm run verify` and CI both run the guards, `npm run freeze` records a suite the guard then enforces, and every one of the six checks above has been WATCHED TO FAIL on a deliberate violation — with all six files byte-identical to the blocks in this packet.**

**CRITICAL**: These files are **human-authored inputs to the generator, not products of it** (SRS NFR-MNT-09). **Transcribe; do not derive.** Everywhere else in this pack, an agent producing its own solution is the entire point — **here it is the failure mode**, because you cannot verify a verifier with the thing it verifies.

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it.
