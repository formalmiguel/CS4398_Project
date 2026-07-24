// FR-RSC-03 / NFR-MNT-03 guard: exactly one function in the codebase produces placements,
// and it is `findCandidateSlots` in engine/src. Both the manual and automatic paths call it.
//
// WHY THIS IS THE MOST EXPOSED REQUIREMENT IN THE REPO. Ask an agent to implement FR-RSC-02
// ("when a new commitment overlaps a placed task, re-place it"). Threading the engine through
// is work; a tidy local `findNextFreeSlot()` in the service is twenty lines and obviously
// simpler. It does exactly what was asked, every test passes, and FR-RSC-03 is now false —
// two placement implementations drift, one gets a fix the other misses, and the rescheduler
// starts putting tasks on top of lectures while no test fails. AGENTIC-TDD-WORKFLOW.md §3
// Rule 3 names this the single biggest maintainability threat in the project. An (I)
// requirement has no test, so it rots by default; this script is its test.
//
// A guard a future agent can satisfy by editing the guard is not a guard. If a check below
// fires, the correct response is to ESCALATE to the human owner (Patrick Rucker) — never to
// add an exemption, narrow a pattern, or delete a check. Which of "real violation" vs "false
// positive" is true is a requirements judgement, not a pattern-matching one.
//
// SCANS code, not comments or strings (RescheduleService.ts mentions `findCandidateSlots` in a
// doc comment and in a thrown error message — both legitimate). stripCommentsAndStrings()
// blanks both, preserving line numbers.
//
// EXCLUDES every test directory. Test doubles are legitimate and MUST NOT fire this guard:
// server/test/reschedule/support/harness.ts contains fake engines typed `FindCandidateSlots`,
// and that is precisely how the frozen suite proves the service re-invokes an injected engine
// instead of computing anything itself. Scanning only the */src roots excludes them by
// construction — and covers server/src/api and server/src/db the moment they land, no edit.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rel = (file) => relative(ROOT, file).split('\\').join('/');
const underEngineSrc = (relPath) => relPath.startsWith('engine/src/');

/** Blank comments and string/template bodies to spaces, keeping length and newlines so line
 *  numbers survive. Template interpolations are re-entered as code, brace depth tracked. */
function stripCommentsAndStrings(src) {
  let out = '';
  let state = 'code';
  const tplBraces = [];
  let i = 0;
  const keepNl = (c) => (c === '\n' || c === '\r' ? c : ' ');
  while (i < src.length) {
    const c = src[i];
    const c2 = src[i + 1];
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && c2 === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (c === "'") { state = 'sq'; out += ' '; i += 1; continue; }
      if (c === '"') { state = 'dq'; out += ' '; i += 1; continue; }
      if (c === '`') { state = 'tpl'; out += ' '; i += 1; continue; }
      if (tplBraces.length > 0) {
        if (c === '{') { tplBraces[tplBraces.length - 1] += 1; out += c; i += 1; continue; }
        if (c === '}') {
          if (tplBraces[tplBraces.length - 1] === 0) { tplBraces.pop(); state = 'tpl'; out += ' '; i += 1; continue; }
          tplBraces[tplBraces.length - 1] -= 1; out += c; i += 1; continue;
        }
      }
      out += c; i += 1; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += '\n'; i += 1; continue; }
      out += (c === '\r' ? c : ' '); i += 1; continue;
    }
    if (state === 'block') {
      if (c === '*' && c2 === '/') { state = 'code'; out += '  '; i += 2; continue; }
      out += keepNl(c); i += 1; continue;
    }
    if (state === 'sq' || state === 'dq') {
      const q = state === 'sq' ? "'" : '"';
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (c === q) { state = 'code'; out += ' '; i += 1; continue; }
      out += keepNl(c); i += 1; continue;
    }
    // tpl
    if (c === '\\') { out += '  '; i += 2; continue; }
    if (c === '`') { state = 'code'; out += ' '; i += 1; continue; }
    if (c === '$' && c2 === '{') { tplBraces.push(0); state = 'code'; out += '  '; i += 2; continue; }
    out += keepNl(c); i += 1; continue;
  }
  return out;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Exclude generated output and EVERY test directory — see the header.
      if (['node_modules', 'dist', 'coverage', 'build', 'test', 'tests', '__tests__'].includes(entry)) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Glob the source roots, not a hard-coded file list: engine/src/**, server/src/**,
// shared/src/**, web/src/** — whichever exist now, plus whatever lands under them later.
const files = [];
for (const ws of ['engine', 'server', 'shared', 'web']) {
  for (const f of walk(join(ROOT, ws, 'src'))) {
    files.push({ path: rel(f), code: stripCommentsAndStrings(readFileSync(f, 'utf8')) });
  }
}

const collect = (code, patterns) => {
  const found = [];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      // For patterns with a capture group (the identifier), report it.
      found.push({ line: lineOf(code, m.index), id: m[1] });
    }
  }
  return found;
};

let failed = false;

// ── Check A — the single definition. Exactly one `findCandidateSlots` DECLARATION exists,
//    and it is in engine/src. Declaration forms only, never a bare occurrence of the string. ──
const DEFN = [
  /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+findCandidateSlots\b/g,
  /\b(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+findCandidateSlots\b/g,
  /^[ \t]*(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+|async\s+)*findCandidateSlots\s*\([^;{]*\)\s*(?::[^;{]*)?\{/gm,
];
const definitions = [];
for (const { path, code } of files) {
  const seen = new Set();
  for (const hit of collect(code, DEFN)) {
    if (seen.has(hit.line)) continue; // one declaration, matched by two forms, counts once
    seen.add(hit.line);
    definitions.push({ path, line: hit.line });
  }
}

if (definitions.length !== 1 || !underEngineSrc(definitions[0].path)) {
  failed = true;
  console.error('FR-RSC-03 / NFR-MNT-03 VIOLATION (Check A): there must be exactly one');
  console.error('`findCandidateSlots` definition, in engine/src.');
  if (definitions.length === 0) {
    console.error('  Found NONE. The one placement function is missing or was renamed.');
  } else {
    console.error(`  Found ${definitions.length}:`);
    for (const d of definitions) {
      const flag = underEngineSrc(d.path) ? '' : '   <- outside engine/src: a second placement function';
      console.error(`    ${d.path}:${d.line}${flag}`);
    }
  }
  console.error('');
}

// ── Check B — no second implementation, by type, outside engine/src. A function that RETURNS
//    `PlacementResult`, or a function EXPRESSION annotated `FindCandidateSlots`, is a second
//    engine whatever it is named. A parameter/field/variable merely TYPED `FindCandidateSlots`
//    (the injected port `private readonly engine: FindCandidateSlots`) is the correct
//    mechanism and must NOT fire — it has no `=` binding a function to it. ──
const RETURNS_PLACEMENT = [/\)\s*:\s*PlacementResult\b/g];
const IS_ENGINE_EXPR = [/:\s*FindCandidateSlots\s*=/g];
for (const { path, code } of files) {
  if (underEngineSrc(path)) continue;
  for (const re of [...RETURNS_PLACEMENT, ...IS_ENGINE_EXPR]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      failed = true;
      const kind = re === IS_ENGINE_EXPR[0]
        ? 'function expression annotated `FindCandidateSlots`'
        : 'function returning `PlacementResult`';
      console.error(`FR-RSC-03 VIOLATION (Check B): ${path}:${lineOf(code, m.index)} is a ${kind}.`);
      console.error('  A second thing that produces placements. There must be exactly one, in');
      console.error('  engine/src, re-invoked by injection — not re-implemented here.');
      console.error('');
    }
  }
}

// ── Check C — the re-implementation vocabulary TRIPWIRE. This is a tripwire, NOT a proof: it
//    catches the specific documented failure mode (the tidy local `findNextFreeSlot()` helper)
//    by matching a fixed list of names for the act of computing a placement. It CANNOT catch a
//    second placement function named something innocuous — do not read a clean pass as one.
//    Declared identifiers only, outside engine/src. ──
// Names for the ACT OF COMPUTING a placement, taken from the SRS's own words — find a free
// gap, merge intervals, choose among candidates. NOT orchestration/transport verbs like
// `placeTask` or `scheduleTask`: those legitimately name "record the placement the user chose"
// in a UI client or service (web/src/api/client.ts's `placeTask` POSTs a user-picked slot),
// and including them fired a false positive on wp-13 (escalated, TEAM-MEETING.md 24 Jul; see
// docs/P16A-REPORT.md). A real second engine named `placeTask` is still caught by Checks A/B.
const VOCAB = [
  'findFreeSlot', 'findNextFreeSlot', 'findAvailableSlot', 'findAvailableSlots',
  'nextFreeSlot', 'freeGaps', 'computeGaps', 'mergeIntervals', 'mergeBusy',
  'firstFit', 'pickSlot', 'chooseSlot',
];
const vocabAlt = VOCAB.join('|');
const VOCAB_DECL = [
  new RegExp(`\\b(?:function\\s+|(?:const|let|var)\\s+)(${vocabAlt})\\b`, 'g'),
  new RegExp(`^[ \\t]*(?:public\\s+|private\\s+|protected\\s+|static\\s+|readonly\\s+|async\\s+)*(${vocabAlt})\\s*\\(`, 'gm'),
];
for (const { path, code } of files) {
  if (underEngineSrc(path)) continue;
  const seen = new Set();
  for (const hit of collect(code, VOCAB_DECL)) {
    const key = `${hit.line}:${hit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    failed = true;
    console.error(`FR-RSC-03 VIOLATION (Check C, tripwire): ${path}:${hit.line} declares \`${hit.id}\`.`);
    console.error('  This names the act of computing a placement. If it computes one, it is the');
    console.error('  second implementation FR-RSC-03 forbids. Re-invoke engine/src instead.');
    console.error('');
  }
}

if (failed) {
  console.error('Exactly one function in this codebase may produce a placement:');
  console.error('`findCandidateSlots` in engine/src. Both the manual and automatic paths call it.');
  console.error('ESCALATE to the human owner. Do NOT relax a pattern or add an exemption to make');
  console.error('this pass — a guard narrowed until it is silent verifies nothing.');
  process.exit(1);
}

// Deliberately understated: Check C is a tripwire, so this claims only what was verified.
console.log(
  'exactly one placement definition (findCandidateSlots, engine/src); ' +
    'no PlacementResult-returning or FindCandidateSlots-bodied function elsewhere; ' +
    'no re-implementation vocabulary tripped (FR-RSC-03, NFR-MNT-03)',
);
