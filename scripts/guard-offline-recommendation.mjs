// FR-LIB-02 guard: no component of the recommendation path makes an external network call.
//
// FR-LIB-02 (Essential, I): "No component of the recommendation path shall make an external
// network call. Recommendation generation shall depend on nothing beyond the System's own
// database." That last clause is load-bearing and decides what this guard PERMITS.
//
// WHY IT EXISTS. The seeded workout library has ~5 exercises per tier. An agent asked to improve
// variety finds free-exercise-db published on the internet and writes six lines that pull it
// live. The tests pass. The library genuinely gets better. And on 31 July the demonstration runs
// on a conference-room network, or behind a captive portal, or not at all — and the failure lands
// in the one hour of this project that cannot be retried. An (I) requirement has no test, so it
// rots by default (AGENTIC-TDD-WORKFLOW.md §2.3); this script is its test.
//
// ── THE RECOMMENDATION PATH, as a set of directories. This is the load-bearing definition in
//    the whole guard: every check below is downstream of it. ─────────────────────────────────
//   server/src/recommendation/**  it IS the recommendation path — the rules, the engine,
//                                RecommendationScheduler.
//   server/src/catalog/**         FR-REC-03 draws the recommended workout from here. CLAUDE.md
//                                §4.2 is the decision that this content is LOCAL SEEDED DATA,
//                                not a runtime API call.
//   server/src/wearable/**        FR-WER-07 — the metrics that drive a recommendation enter
//                                here. This is the module whose entire job is fetching wearable
//                                data, and FR-WER-11 (the live Garmin API) is the deferred
//                                version of exactly that. It is the single most likely place in
//                                this codebase for a real network call to appear.
//
// ── DELIBERATELY NOT IN THE PATH, stated because an unexplained omission reads as an oversight:
//   server/src/api/**   the HTTP SERVER. It is express, it is INBOUND by definition. Scanning it
//                       for `http` would fire on the thing it is.
//   server/src/db/**    Mongo. FR-LIB-02's own words permit it: "shall depend on nothing beyond
//                       the System's own database."
//
// ⚠️ WHAT THAT OMISSION COSTS, said plainly rather than papered over: a network call placed in
// server/src/api/ and called FROM the recommendation path is out of this guard's reach. That is
// a real hole and it is accepted deliberately — a guard that cannot distinguish inbound Express
// from an outbound call will be disabled within a week, and a disabled guard checks nothing at
// all. Do NOT "fix" this by scanning the API layer.
//
// ⚠️ THIS IS THE INSPECTION HALF OF FR-LIB-02 ONLY. The requirement also demands "demonstrating
// every Essential FR-REC requirement with all outbound network access disabled." That is a
// REHEARSAL against the running System, it belongs to the human owner, and a static scan does
// not perform it. Passing this guard is not passing FR-LIB-02.
//
// ⚠️ AND IT DOES NOT GREP FOR URLs. Check A reads import specifiers (strings) and Check B reads
// call sites (code). A URL handed to an HTTP client is just a string argument; the guard catches
// the IMPORT and the CALL, never the URL text. A reader who assumes otherwise would trust this
// more than it deserves. (server/src/catalog/attribution.ts records the free-exercise-db
// provenance for FR-LIB-10; on this branch it carries no URL at all — the full notice lives in
// data/ATTRIBUTION.md, a .md file no check here opens.)
//
// SCANS *.ts/*.tsx under the three src roots only. Every test directory is excluded by
// construction: server/test/** holds fixtures and doubles, and server/test/wearable/** and
// server/test/catalog/** are FROZEN (1199d80, 4b1fd4e) — a guard that fired on a frozen suite
// could not be obeyed without breaking the freeze.
//
// A guard a future agent can satisfy by editing the guard is not a guard. If a check below
// fires, the correct response is to ESCALATE to the human owner (Patrick Rucker) — never to add
// an exemption, never to relax a pattern, never to delete the check.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments, stripCommentsAndStrings } from './lib/strip-code.mjs';

// fileURLToPath, not URL.pathname — this repo's own path contains spaces, and a Windows
// drive letter arrives with a leading slash.
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rel = (file) => relative(ROOT, file).split('\\').join('/');

// Globbed, never a hard-coded file list: new files land in these directories constantly and
// this guard must cover them with no edit.
const PATH_DIRS = [
  join('server', 'src', 'recommendation'),
  join('server', 'src', 'catalog'),
  join('server', 'src', 'wearable'),
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // a directory that does not exist yet is not this guard's error to raise
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (['node_modules', 'dist', 'coverage', 'build', 'test', 'tests', '__tests__'].includes(entry)) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Every outbound HTTP/socket client this project could plausibly reach for. `node:fs` and
// `node:path` are deliberately ABSENT — see the note on Check A below.
const FORBIDDEN_MODULES = new Set([
  'http', 'https', 'net', 'dns', 'dgram', 'tls',
  'node:http', 'node:https', 'node:net', 'node:dns', 'node:dgram', 'node:tls',
  'axios', 'node-fetch', 'undici', 'got', 'superagent', 'request', 'cross-fetch', 'ky',
]);

const files = [];
for (const dir of PATH_DIRS) {
  for (const f of walk(join(ROOT, dir))) {
    const src = readFileSync(f, 'utf8');
    files.push({
      path: rel(f),
      // Import specifiers ARE strings. stripCommentsAndStrings would blank the module name to
      // spaces and Check A would silently enforce nothing — so Check A reads the comments-only
      // view. Check B matches call sites, which are code, so it reads the fully-stripped view.
      withStrings: stripComments(src),
      code: stripCommentsAndStrings(src),
    });
  }
}

let failed = false;

// ── Check A — no outbound network client is IMPORTED. By `import`, by `require(...)`, or by
//    dynamic `import(...)`.
//
//    ✅ node:fs and node:path are LEGAL here and must stay legal. WorkoutCatalog.ts calls
//    readFileSync on the VENDORED free-exercise-db subset committed at
//    server/src/catalog/data/free-exercise-db.subset.json. Reading it from disk is what makes
//    FR-LIB-02 true BY CONSTRUCTION (§4.2). DISK IS NOT NETWORK. The engine's ban on node:fs is
//    a PURITY rule (FR-SCH-05, CON-04) scoped to engine/src only; conflating the two would break
//    the catalog and reverse a decision the team already made. ────────────────────────────────
const SPECIFIER_FORMS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
];
for (const { path, withStrings } of files) {
  for (const re of SPECIFIER_FORMS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(withStrings)) !== null) {
      if (!FORBIDDEN_MODULES.has(m[1])) continue;
      failed = true;
      console.error(`FR-LIB-02 VIOLATION (Check A): ${path}:${lineOf(withStrings, m.index)} imports \`${m[1]}\`.`);
      console.error('  An outbound network client in the recommendation path. Recommendation');
      console.error('  generation must depend on nothing beyond the System\'s own database.');
      console.error('');
    }
  }
}

// ── Check B — no ambient network GLOBAL is called. These need no import and no dependency,
//    which is exactly why Check A alone is insufficient — the same argument
//    guard-engine-purity.mjs makes in its own header.
//
//    ⛔ THE `fetch` PROBLEM, and why the obvious fix is worse than the bug. `WearableAdapter`
//    declares `fetch(userId, date): Promise<DailyMetricSet>` (FR-WER-01), GarminExportAdapter
//    implements it as `async fetch(...)`, and every caller writes `adapter.fetch(...)`. A bare
//    token match on `fetch` fires on all three. The tempting fix — exclude server/src/wearable/
//    — would leave a real `fetch('https://connect.garmin.com/...')` unseen forever in THE ONE
//    MODULE MOST LIKELY TO CONTAIN ONE. So the receiver is what is discriminated, not the
//    directory: an UNQUALIFIED `fetch(` is a violation; `<receiver>.fetch(` is a method call and
//    a modifiers-only line ending in a return-type annotation is a member DECLARATION.
//    Known limit: a method signature written with NO return type reads as a call here. Every
//    fetch member in this repo annotates its return type, and an unannotated one would fail
//    typecheck under the repo's lint settings anyway. ───────────────────────────────────────
const FETCH_CALL = /(?:^|[^\w$.?])fetch\s*\(/g;
const FETCH_MEMBER_DECL =
  /^[ \t]*(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+|abstract\s+|override\s+|async\s+)*fetch\s*\([^;{]*\)\s*:\s*[^;{]*[;{]/gm;

const OTHER_GLOBALS = [
  { re: /\bglobalThis\s*\.\s*fetch\b/g, name: 'globalThis.fetch' },
  { re: /\bXMLHttpRequest\b/g, name: 'XMLHttpRequest' },
  { re: /\bWebSocket\b/g, name: 'WebSocket' },
  { re: /\bEventSource\b/g, name: 'EventSource' },
  { re: /\bnavigator\s*\.\s*sendBeacon\b/g, name: 'navigator.sendBeacon' },
];

for (const { path, code } of files) {
  // Lines carrying a `fetch` MEMBER DECLARATION — the FR-WER-01 port and its implementation.
  const declLines = new Set();
  FETCH_MEMBER_DECL.lastIndex = 0;
  let d;
  while ((d = FETCH_MEMBER_DECL.exec(code)) !== null) declLines.add(lineOf(code, d.index));

  FETCH_CALL.lastIndex = 0;
  let m;
  while ((m = FETCH_CALL.exec(code)) !== null) {
    const line = lineOf(code, m.index);
    if (declLines.has(line)) continue; // the declared port, not a global call
    failed = true;
    console.error(`FR-LIB-02 VIOLATION (Check B): ${path}:${line} calls the global \`fetch()\`.`);
    console.error('  An ambient network call needs no import and no dependency, so Check A and');
    console.error('  the package manifest both miss it. `adapter.fetch(...)` is a method call on');
    console.error('  the FR-WER-01 port and is fine; an UNQUALIFIED fetch( is an outbound call.');
    console.error('');
  }

  for (const { re, name } of OTHER_GLOBALS) {
    re.lastIndex = 0;
    let g;
    while ((g = re.exec(code)) !== null) {
      failed = true;
      console.error(`FR-LIB-02 VIOLATION (Check B): ${path}:${lineOf(code, g.index)} reaches \`${name}\`.`);
      console.error('  An ambient network global in the recommendation path.');
      console.error('');
    }
  }
}

// ── Check D — the manifest half. Cheap, and it fires on `npm i axios -w server` BEFORE a line
//    of code exists. Modelled on guard-engine-deps.mjs, but this is an ALLOW-NOTHING-NAMED-BELOW
//    check, not an empty-dependencies check: server legitimately depends on express, cors,
//    mongodb, bcrypt, jsonwebtoken and dotenv. ────────────────────────────────────────────────
const HTTP_CLIENT_PACKAGES = ['axios', 'node-fetch', 'undici', 'got', 'superagent', 'request', 'cross-fetch', 'ky'];
const serverPkg = JSON.parse(readFileSync(join(ROOT, 'server', 'package.json'), 'utf8'));
for (const field of ['dependencies', 'devDependencies']) {
  for (const dep of Object.keys(serverPkg[field] ?? {})) {
    if (!HTTP_CLIENT_PACKAGES.includes(dep)) continue;
    failed = true;
    console.error(`FR-LIB-02 VIOLATION (Check D): server/package.json ${field} declares \`${dep}\`.`);
    console.error('  An HTTP client dependency. The recommendation path must reach nothing beyond');
    console.error('  the System\'s own database — the workouts are vendored on disk (§4.2).');
    console.error('');
  }
}

if (failed) {
  console.error('Nothing in the recommendation path may reach the network. The workouts are on');
  console.error('disk and the metrics are in our own database, so 31 July does not depend on a');
  console.error('conference-room wifi (FR-LIB-02).');
  console.error('ESCALATE to the human owner (Patrick Rucker). Do NOT relax a pattern, add an');
  console.error('exemption, or exclude a directory to make this pass — a guard narrowed until it');
  console.error('is silent verifies nothing, and this repo has already shipped two of those.');
  process.exit(1);
}

// Understated on purpose: this is the INSPECTION half only, and it names what it did not do.
console.log(
  'recommendation path (server/src/{recommendation,catalog,wearable}) imports no network client, ' +
    'calls no ambient network global, and server/package.json declares none (FR-LIB-02, inspection half; ' +
    'the offline demonstration is a rehearsal this script does not perform)',
);
