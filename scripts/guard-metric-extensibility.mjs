// FR-REC-11 / FR-WER-04 / NFR-MNT-06 guard: the recommendation engine does not know what its
// rules do, so a third metric is TWO ADDITIONS AND NO MODIFICATIONS.
//
// FR-REC-11 (Essential, I): "Each mapping from metrics to a recommendation shall be an
// independent, registered rule declaring the metrics it consumes, the decision it produces, and
// its fallback. The engine shall evaluate registered rules WITHOUT KNOWLEDGE OF ANY RULE'S
// CONTENT. Consequently adding a metric shall be two additions and no modifications."
// FR-WER-04 names the exact surfaces that must not need editing: THE SCHEDULING ENGINE, THE TASK
// MODEL, THE PERSISTENCE LAYER'S STRUCTURE, AND ANY EXISTING RULE. Four, not five — see below.
//
// WHY IT EXISTS. An agent asked for a wellness dashboard, or a third metric, or a nicer reason
// string, adds one `if (rule instanceof SleepToIntensityRule)` to RecommendationEngine.recommend.
// It is three lines, it works, and EVERY TEST IN THE FROZEN PACKET-09 SUITE STILL PASSES —
// because that suite tests two rules that both still behave. What has silently become false is
// the property that made CLAUDE.md §4.4's "extensible by addition" claim true, and nothing
// reports it. An (I) requirement has no test, so it rots by default; this script is its test.
//
// ── ⛔ THIS GUARD IS SELF-MAINTAINING, AND THAT IS A REQUIREMENT, NOT A FLOURISH. ────────────
// The metric names and the Decision kinds are DERIVED from source at run time — the metric names
// from what each rule's requiredMetrics() actually declares, the kinds from the Decision union in
// shared/src/contract.ts. They are NOT hard-coded. A guard that knew only today's two metrics
// would go green forever the moment a third arrived: still exiting 0, still in the verify chain,
// enforcing nothing. That is §0.1's failure mode one level removed, and it is the specific way
// this project has twice shipped a guard that was green while checking nothing.
// ⛔ If you are tempted to replace the derivation with a literal list because it is simpler:
// that is the bug. ESCALATE to the human owner (Patrick Rucker) instead.
//
// ── ⚠️ web/src/** IS DELIBERATELY NOT SCANNED, AND THIS IS THE REQUIREMENT, NOT A LOOPHOLE. ──
// FR-WER-04 named the dashboard among its protected surfaces until SRS v2.32, when it was
// removed on the record (OPEN-29, raised and closed 27 Jul): selecting a chart series by metric
// name is PRESENTATION. The four surviving surfaces are all STRUCTURAL — the question FR-WER-04
// asks is "does the System need editing for the metric to WORK?", not "for the user to SEE it?"
// ⚠️ And note what that does NOT mean (the justification was corrected at SRS v2.34): the view
// layer is NOT unobliged. FR-WEL-01 requires the wellness view to render EVERY METRIC IN THE
// DAILY METRIC SET for the current date, "rather than a hard-coded list, so a metric added under
// FR-WER-04 appears without changing this view" — a real obligation, verified by DEMONSTRATION
// (D), which is simply not this guard's to check. WellnessView.tsx already complies: its
// current-date list is generic, and its two literal metric names build the seven-day chart,
// which is FR-WEL-04 — a requirement that names both metrics itself.
// ⚠️ THE CARVE-OUT IS web/src/** AND NOTHING ELSE. A metric name reaching server/src/api/** —
// including any wellness or analytics endpoint — IS STILL A VIOLATION: that is the server
// shaping data around two named metrics, not a view choosing what to chart.
//
// ── ⚠️ THE HONEST LIMIT, and it belongs in the success message too. ──────────────────────────
// None of the three checks below PROVES the System is extensible. They prove the SHAPE that
// makes an addition cheap. The actual proof is FR-REC-12 — adding a real metric and reporting
// the diff — and FR-REC-12 is Conditional and was definitively cut on 26 Jul. A guard whose
// output claims more than it verified is worse than no guard, because it stops people looking.
//
// ✅ NAMED EXCEPTION, and it is why comments are stripped: server/src/db/MetricStore.ts and
// shared/src/contract.ts each name BOTH metrics in a header comment, in the sentence asserting
// DR-05 — "NEVER one document with a `sleepScore` field and an `activeCalories` field". That
// comment is the requirement being ASSERTED, not violated.
//
// A guard a future agent can satisfy by editing the guard is not a guard. If a check fires, the
// correct response is to ESCALATE to the human owner — never to add an exemption, never to
// relax a pattern, never to delete a check.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments, stripCommentsAndStrings } from './lib/strip-code.mjs';

// fileURLToPath, not URL.pathname — this repo's own path contains spaces, and a Windows
// drive letter arrives with a leading slash.
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rel = (file) => relative(ROOT, file).split('\\').join('/');

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
      if (['node_modules', 'dist', 'coverage', 'build', 'test', 'tests', '__tests__'].includes(entry)) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * Two views of every file, and the pairing is what makes the derivation robust.
 *  - `code`        comments AND string bodies blanked. Used for STRUCTURE (brace/paren matching,
 *                  identifiers), because a `{` or `)` inside a string cannot mislead it.
 *  - `withStrings` comments blanked, string bodies INTACT. Used for CONTENT (metric-name
 *                  literals, import specifiers, Decision kinds) — which live inside strings and
 *                  which the fully-stripped view would blank into invisibility.
 * Both preserve length exactly, so an index found in one slices the other. See
 * scripts/lib/strip-code.mjs.
 */
function load(file) {
  const src = readFileSync(file, 'utf8');
  return { path: rel(file), code: stripCommentsAndStrings(src), withStrings: stripComments(src) };
}

/** The body of a named method, located structurally in `code` and returned from `withStrings`. */
function methodBody({ code, withStrings }, name) {
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
  let m;
  while ((m = re.exec(code)) !== null) {
    let i = m.index + m[0].length - 1; // at '('
    let depth = 0;
    for (; i < code.length; i += 1) {
      if (code[i] === '(') depth += 1;
      else if (code[i] === ')') { depth -= 1; if (depth === 0) break; }
    }
    let j = i + 1;
    while (j < code.length && code[j] !== '{' && code[j] !== ';') j += 1;
    if (code[j] !== '{') continue; // a signature with no body — the interface declaration
    let braces = 0;
    for (let k = j; k < code.length; k += 1) {
      if (code[k] === '{') braces += 1;
      else if (code[k] === '}') {
        braces -= 1;
        if (braces === 0) return withStrings.slice(j + 1, k);
      }
    }
  }
  return null;
}

const REC_DIR = join(ROOT, 'server', 'src', 'recommendation');
const ENGINE_FILE = join(REC_DIR, 'RecommendationEngine.ts');
const CONTRACT_FILE = join(ROOT, 'shared', 'src', 'contract.ts');

let failed = false;
const fail = (...lines) => {
  failed = true;
  for (const l of lines) console.error(l);
  console.error('');
};

// ── DERIVATION 1: the metric names, from what each rule DECLARES it consumes. ────────────────
// A rule declares its metrics in requiredMetrics(). Both current rules return a module-level
// const alias (`const SLEEP_SCORE = 'sleepScore'; ... return [SLEEP_SCORE];`), so aliases are
// resolved as well as inline literals. A new rule written either way is picked up with NO EDIT.
const ruleFiles = [];
for (const f of walk(REC_DIR)) {
  const view = load(f);
  if (!/\bimplements\s+(?:[\w$.]+\s*,\s*)*RecommendationRule\b/.test(view.code)) continue;
  ruleFiles.push(view);
}

const metricOwners = new Map(); // metric name -> Set of declaring rule paths
for (const view of ruleFiles) {
  const body = methodBody(view, 'requiredMetrics');
  if (body === null) {
    fail(
      `FR-REC-11 DERIVATION FAILURE: ${view.path} implements RecommendationRule but no`,
      '  requiredMetrics() body could be located. This guard derives the metric names it police',
      '  from that method; if it cannot read one, it is silently policing less than it claims.',
      '  ESCALATE — do NOT hard-code a metric list to make this pass.',
    );
    continue;
  }
  const aliases = new Map();
  const ALIAS = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]*)?=\s*['"]([^'"]*)['"]\s*;/g;
  let a;
  while ((a = ALIAS.exec(view.withStrings)) !== null) aliases.set(a[1], a[2]);

  const names = new Set();
  const LITERAL = /['"]([^'"\n]+)['"]/g;
  let l;
  while ((l = LITERAL.exec(body)) !== null) names.add(l[1]);
  const IDENT = /\b([A-Za-z_$][\w$]*)\b/g;
  let id;
  while ((id = IDENT.exec(body)) !== null) if (aliases.has(id[1])) names.add(aliases.get(id[1]));

  if (names.size === 0) {
    fail(
      `FR-REC-11 DERIVATION FAILURE: ${view.path}'s requiredMetrics() declares no metric name`,
      '  this guard can read. It would then police nothing for this rule while still exiting 0.',
      '  ESCALATE — do NOT hard-code a metric list to make this pass.',
    );
  }
  for (const n of names) {
    if (!metricOwners.has(n)) metricOwners.set(n, new Set());
    metricOwners.get(n).add(view.path);
  }
}

// ── DERIVATION 2: the Decision kinds, from the union in shared/src/contract.ts. ──────────────
const contract = load(CONTRACT_FILE);
const decisionKinds = new Set();
{
  const start = contract.code.indexOf('export type Decision');
  if (start === -1) {
    fail(
      'FR-REC-11 DERIVATION FAILURE: no `export type Decision` union found in',
      '  shared/src/contract.ts. The engine-agnosticism check derives the decision kinds from it.',
      '  ESCALATE — do NOT hard-code the kinds.',
    );
  } else {
    let depth = 0;
    let end = start;
    for (; end < contract.code.length; end += 1) {
      const c = contract.code[end];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === ';' && depth === 0) break;
    }
    const union = contract.withStrings.slice(start, end);
    const KIND = /\bkind\s*:\s*['"]([^'"]+)['"]/g;
    let k;
    while ((k = KIND.exec(union)) !== null) decisionKinds.add(k[1]);
    if (decisionKinds.size === 0) {
      fail(
        'FR-REC-11 DERIVATION FAILURE: the Decision union carries no readable `kind` literal.',
        '  ESCALATE — do NOT hard-code the kinds.',
      );
    }
  }
}

if (metricOwners.size === 0 && !failed) {
  fail(
    'FR-REC-11 DERIVATION FAILURE: no rule implementing RecommendationRule was found under',
    '  server/src/recommendation/. With nothing derived, every check below is vacuous.',
    '  ESCALATE — a guard with an empty subject exits 0 and verifies nothing.',
  );
}

const metricNames = [...metricOwners.keys()];

// ── Check A — THE ENGINE IS CONTENT-AGNOSTIC. RecommendationEngine.ts may not name a concrete
//    rule type, a metric name, or a Decision kind. Calling only the interface methods —
//    requiredMetrics(), apply(), fallback() — is the correct shape and is what it does today. ─
{
  const engine = load(ENGINE_FILE);

  const CONCRETE_RULE = /\b([A-Za-z_$][\w$]*Rule)\b/g;
  let m;
  while ((m = CONCRETE_RULE.exec(engine.code)) !== null) {
    if (m[1] === 'RecommendationRule') continue; // the interface it is typed against — correct
    fail(
      `FR-REC-11 VIOLATION (Check A): ${engine.path}:${lineOf(engine.code, m.index)} names \`${m[1]}\`.`,
      '  The engine must evaluate registered rules WITHOUT knowledge of any rule\'s content. It',
      '  may know the RecommendationRule interface and nothing else. Branching on a concrete',
      '  rule makes "adding a metric is two additions, no modifications" false while every',
      '  frozen packet-09 test keeps passing.',
    );
  }

  for (const name of metricNames) {
    const re = new RegExp(`\\b${name}\\b`, 'g');
    let h;
    while ((h = re.exec(engine.withStrings)) !== null) {
      fail(
        `FR-REC-11 VIOLATION (Check A): ${engine.path}:${lineOf(engine.withStrings, h.index)} names the metric \`${name}\`.`,
        '  The engine reads requiredMetrics() to learn what a rule needs; it must never name a',
        '  metric itself. A third metric would then require editing the engine.',
      );
    }
  }

  for (const kind of decisionKinds) {
    const re = new RegExp(`\\b${kind}\\b`, 'g');
    let h;
    while ((h = re.exec(engine.withStrings)) !== null) {
      fail(
        `FR-REC-11 VIOLATION (Check A): ${engine.path}:${lineOf(engine.withStrings, h.index)} names the Decision kind \`${kind}\`.`,
        '  The engine passes a rule\'s Decision through opaquely. Branching on a kind is knowing',
        '  a rule\'s content, and a new kind would then require editing the engine.',
      );
    }
  }
}

// ── Check B — RULES ARE INDEPENDENT. No rule may import another rule, and no rule may import
//    RecommendationEngine. The dependency direction is ONE-WAY: the engine knows the interface;
//    the rules know nothing about each other or about the engine. A rule importing a sibling is
//    FR-REC-11's "independent" quietly becoming false. ─────────────────────────────────────────
{
  const ruleBasenames = new Set(ruleFiles.map((r) => r.path.split('/').pop().replace(/\.tsx?$/, '')));
  // All three specifier forms, not just `from '...'`: a require() or a dynamic import() of a
  // sibling rule breaks independence exactly as much as a static import does.
  const SPEC_FORMS = [
    /\bfrom\s*['"](\.[^'"]*)['"]/g,
    /\brequire\s*\(\s*['"](\.[^'"]*)['"]\s*\)/g,
    /\bimport\s*\(\s*['"](\.[^'"]*)['"]\s*\)/g,
  ];
  for (const view of ruleFiles) {
    const self = view.path.split('/').pop().replace(/\.tsx?$/, '');
    for (const re of SPEC_FORMS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(view.withStrings)) !== null) {
        const target = m[1].split('/').pop().replace(/\.tsx?$/, '');
        const line = lineOf(view.withStrings, m.index);
        if (target === 'RecommendationEngine') {
          fail(
            `FR-REC-11 VIOLATION (Check B): ${view.path}:${line} imports RecommendationEngine.`,
            '  The dependency direction is one-way: the engine knows the RecommendationRule',
            '  interface, a rule knows nothing about the engine that evaluates it.',
          );
        } else if (ruleBasenames.has(target) && target !== self) {
          fail(
            `FR-REC-11 VIOLATION (Check B): ${view.path}:${line} imports the rule \`${target}\`.`,
            '  Each rule shall be an INDEPENDENT registered mapping. A rule that reads a sibling',
            '  cannot be added or removed on its own, and FR-WER-04\'s "no change to any existing',
            '  rule" becomes false the moment either one moves.',
          );
        }
      }
    }
  }
}

// ── Check C — A METRIC NAME APPEARS ONLY WHERE IT MAY. ───────────────────────────────────────
//    ✅ ALLOWED: the rule that consumes it (the rule declaring what it needs), and
//       server/src/wearable/** — the adapter that PRODUCES it. That is "add it to the metric
//       set", addition #1 of FR-REC-11's two, and it is expected.
//    ❌ FORBIDDEN — FR-WER-04's four surviving surfaces, plus the layers with no business
//       knowing a metric's name: engine/src/** (the scheduling engine), shared/src/contract.ts
//       (the task model — DailyMetricSet is Record<string, Metric>, keyed by name, exactly so
//       this stays true; DR-05), server/src/db/** (the persistence layer's structure —
//       MetricStore is keyed by (userId, date, name) for the same reason), any OTHER rule, and
//       server/src/{reschedule,api,catalog,calendar}/**.
//    ⛔ web/src/** is not scanned — see the header. That is the requirement, not an oversight.
{
  const scanRoots = [join('engine', 'src'), join('shared', 'src'), join('server', 'src')];
  const scanned = [];
  for (const r of scanRoots) for (const f of walk(join(ROOT, r))) scanned.push(load(f));

  for (const view of scanned) {
    if (view.path.startsWith('server/src/wearable/')) continue; // the producer — addition #1
    for (const name of metricNames) {
      if (metricOwners.get(name).has(view.path)) continue; // the rule that consumes it
      const re = new RegExp(`\\b${name}\\b`, 'g');
      let h;
      while ((h = re.exec(view.withStrings)) !== null) {
        const isOtherRule = ruleFiles.some((r) => r.path === view.path);
        fail(
          `FR-WER-04 / FR-REC-11 VIOLATION (Check C): ${view.path}:${lineOf(view.withStrings, h.index)} names the metric \`${name}\`.`,
          `  Declared by: ${[...metricOwners.get(name)].join(', ')}.`,
          isOtherRule
            ? '  This is ANOTHER RULE naming a metric it does not consume — FR-WER-04\'s "no change'
            : '  Adding a metric must be an ADDITION, not a modification: no change',
          isOtherRule
            ? '  to any existing rule" is what that breaks.'
            : '  to the scheduling engine, the task model, the persistence layer\'s structure, or any',
          isOtherRule ? '' : '  existing rule (FR-WER-04, NFR-MNT-06, DR-05).',
        );
      }
    }
  }
}

if (failed) {
  console.error('The recommendation engine must not know what its rules do — so a third metric is');
  console.error('TWO ADDITIONS, and nobody edits the scheduler, the task model, the store, or');
  console.error('another rule to make it work (FR-REC-11, FR-WER-04, NFR-MNT-06).');
  console.error('ESCALATE to the human owner (Patrick Rucker). Do NOT add an exemption, narrow a');
  console.error('pattern, or replace the derivation with a hard-coded metric list — a guard that');
  console.error('knows only today\'s metrics goes green forever the moment a third one lands.');
  process.exit(1);
}

// Understated on purpose: this proves the SHAPE, not the property. FR-REC-12 is the real proof
// and it is Conditional and cut — so the message must not imply this replaced it.
console.log(
  `metric extensibility: engine names no rule/metric/decision-kind, rules import no sibling or engine, ` +
    `and ${metricNames.length} derived metric name(s) [${metricNames.join(', ')}] appear only in their own rule ` +
    `and the wearable adapter (FR-REC-11, FR-WER-04, NFR-MNT-06 — the shape that makes an addition cheap, ` +
    `not a proof of extensibility; that is FR-REC-12, which is cut)`,
);
