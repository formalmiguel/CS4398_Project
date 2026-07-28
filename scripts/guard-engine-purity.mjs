// FR-SCH-05 / CON-04 guard: the engine calls no ambient source of impurity.
//
// WHAT THIS ADDS over the three FR-SCH-05 mechanisms that already exist — and why removing
// it as "redundant" would reopen a real hole:
//   - guard-engine-deps.mjs reads package.json. An ambient global is in no manifest.
//   - the no-restricted-imports override in .eslintrc.cjs reads import statements. An
//     ambient global has no import.
//   - engine/test/purity.test.ts proves identical output across two calls. A `Date.now()`
//     read as a tiebreak seed returns the same value twice in the same millisecond, so the
//     behavioural test passes and the engine is impure anyway.
// This is the ONLY one of the four that sees a call needing no import and no dependency —
// `Date.now()`, `Math.random()`, `fetch()`, `process.env`, timers, `globalThis`, `require()`.
// It is not redundant. Escalate before deleting it; do not "simplify" it away.
//
// It scans engine/src/** ONLY. The engine's purity is what makes NFR-COR-01's 1,000-case
// property test and NFR-MNT-01's 90% coverage figure carry information at all: an impure
// engine is measured against itself. A hit here is an escalation to the human owner, not a
// lint nit to be silenced with a disable comment.
//
// It scans CODE, not comments and not string literals. engine/src/index.ts's own header
// says "it reads no clock" — a careless match on `Date` or `clock` would fire on the very
// sentence asserting the property holds. stripCommentsAndStrings() below blanks comments and
// string/template bodies (preserving newlines, so reported line numbers stay true) before any
// pattern runs. Known limit: a regex literal is not special-cased; there are none in the
// engine, and one containing a forbidden token would be a bizarre false positive worth a look.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripCommentsAndStrings } from './lib/strip-code.mjs';

// fileURLToPath, not URL.pathname — this repo's own path contains spaces, and a Windows
// drive letter arrives with a leading slash. Same reasoning as scripts/lib/suite-hash.mjs.
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ENGINE_SRC = join(ROOT, 'engine', 'src');

const rel = (file) => relative(ROOT, file).split('\\').join('/');

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // engine/src should exist; a missing dir is not this guard's error to raise.
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (['node_modules', 'dist', 'coverage', 'build'].includes(entry)) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// An ambient global needs no import and no dependency, so neither existing guard can see it.
const FORBIDDEN = [
  { re: /\bDate\s*\.\s*now\s*\(/g, name: 'Date.now()' },
  { re: /\bnew\s+Date\b/g, name: 'new Date()' },
  { re: /\bMath\s*\.\s*random\s*\(/g, name: 'Math.random()' },
  { re: /\bfetch\s*\(/g, name: 'fetch()' },
  { re: /\bprocess\s*\.\s*env\b/g, name: 'process.env' },
  { re: /\bprocess\s*\.\s*hrtime\b/g, name: 'process.hrtime()' },
  { re: /\bsetTimeout\s*\(/g, name: 'setTimeout()' },
  { re: /\bsetInterval\s*\(/g, name: 'setInterval()' },
  { re: /\bperformance\s*\.\s*now\s*\(/g, name: 'performance.now()' },
  { re: /\bglobalThis\b/g, name: 'globalThis' },
  { re: /\brequire\s*\(/g, name: 'require()' },
];

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

const hits = [];
for (const file of walk(ENGINE_SRC)) {
  const code = stripCommentsAndStrings(readFileSync(file, 'utf8'));
  for (const { re, name } of FORBIDDEN) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      hits.push({ file: rel(file), line: lineOf(code, m.index), name });
    }
  }
}

if (hits.length > 0) {
  console.error('FR-SCH-05 / CON-04 VIOLATION: the engine reached an ambient source of impurity.');
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${h.name}`);
  }
  console.error('');
  console.error('  The engine must be a PURE function (FR-SCH-05): same inputs, same outputs, no');
  console.error('  clock, no I/O, no mutation. That purity is the only reason NFR-COR-01\'s');
  console.error('  1,000-case property test and NFR-MNT-01\'s 90% coverage figure mean anything —');
  console.error('  an impure engine is being measured against itself.');
  console.error('');
  console.error('  This is an escalation to the human owner (Patrick Rucker), not a lint nit.');
  console.error('  Do NOT silence it with an eslint-disable, do NOT relax this guard, and do NOT');
  console.error('  move the call to the caller without a decision-log row. The caller may read a');
  console.error('  clock and pass the engine data (schedulableDay, createdAt); the engine may not.');
  process.exit(1);
}

console.log('engine/src reaches no ambient clock, RNG, timer, network or process global (FR-SCH-05)');
