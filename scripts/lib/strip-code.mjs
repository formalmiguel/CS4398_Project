// The shared source lexer for the executable (I)-requirement guards.
//
// stripCommentsAndStrings() was EXTRACTED HERE VERBATIM (packet 16b) from
// guard-single-placement.mjs and guard-engine-purity.mjs, which each carried an identical
// 46-line copy. The two copies were diffed character-for-character before the move: they
// differed in exactly two TRAILING COMMENTS and in no code whatsoever. The richer comment
// set (guard-engine-purity.mjs's) was kept. Not one character of the body was changed —
// CLAUDE.md §4.12(a): a guard is only trustworthy by transcription or by proof of failure,
// and "improving" a working lexer in passing is precisely the diff nobody reads.
//
// ⛔ Four guards import this. Do NOT edit stripCommentsAndStrings to make a guard pass.
// That is relaxing four checks at once, from a file none of their reviewers will open.
// ESCALATE to the human owner (Patrick Rucker) instead.
/** Blank comments and string/template bodies to spaces, keeping length and newlines so line
 *  numbers survive. Template interpolations (`${ ... }`) are re-entered as code, with brace
 *  depth tracked, so an impurity inside one is still seen. */
export function stripCommentsAndStrings(src) {
  let out = '';
  let state = 'code'; // code | line | block | sq | dq | tpl
  const tplBraces = []; // brace depth of each open ${ ... } interpolation
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

// ─────────────────────────────────────────────────────────────────────────────
// stripComments() is NEW in packet 16b. It is NOT a third copy of the function above and it
// is NOT a modification of it — it answers a different question, and 16b's two guards cannot
// be written without it.
//
// WHY A SECOND VIEW IS UNAVOIDABLE. The four earlier guards look for IDENTIFIERS in code
// (`findCandidateSlots`, `Date.now`), so blanking string bodies is pure gain. 16b's guards look
// for things that LIVE INSIDE STRINGS:
//   - an import specifier — `import ... from 'node:https'`, `require('axios')` (FR-LIB-02)
//   - a metric-name literal — `metrics['sleepScore']` (FR-WER-04 / FR-REC-11)
// Run stripCommentsAndStrings() over those and the module name and the metric name are blanked
// to spaces: the guard sees nothing, exits 0, and enforces NOTHING. That is the exact failure
// mode CLAUDE.md §4.12(a) was written about, so it is called out here rather than discovered.
//
// It therefore blanks comments ONLY and leaves string bodies intact. Comments are still blanked
// because both documented false positives are comments: MetricStore.ts and contract.ts each name
// BOTH metrics in a header comment, in the sentence asserting DR-05 ("NEVER one document with a
// `sleepScore` field and an `activeCalories` field") — that comment is the requirement being
// asserted, not violated.
//
// Character count is preserved exactly, as above, so reported line numbers stay true.
//
// ⚠️ THE HONEST COST of keeping strings, stated because a reader will otherwise assume the
// stronger guarantee: a metric name or a URL mentioned in an ORDINARY string — a log line, a
// thrown error message — is now visible and will be reported. For FR-LIB-02 that is why the URL
// itself is never what Checks A and B match on (they match the import and the call site). For
// FR-WER-04 a metric name in a server-side string IS the finding, not noise.
//
// CONSISTENCY. Because this function removes exactly the comments the function above removes
// and touches nothing else,
//     stripCommentsAndStrings(stripComments(src)) === stripCommentsAndStrings(src)
// must hold for every source file in the repo. Packet 16b verified that over all 40 .ts/.tsx
// files under */src, along with exact length preservation (docs/P16B-REPORT.md).
//
// ⚠️ BUT READ THIS BEFORE YOU TRUST THAT INVARIANT, because 16b's report overstated it and the
// owner corrected the record (27 Jul). The identity above holds for ANY function that does not
// corrupt the code view — INCLUDING a stripComments() that did nothing at all. Verified: with
// `identity` substituted, the equality is still true. So it proves this function does not BREAK
// anything downstream; it does NOT prove it removes comments, and it is not on its own
// sufficient evidence that this file is correct.
//
// What actually proves that is BEHAVIOURAL, and it is what to re-run if you touch either
// function: the false-positive cases in docs/P16B-REPORT.md §5 — the DR-05 header comments in
// server/src/db/MetricStore.ts and shared/src/contract.ts each name BOTH metrics, and the
// extensibility guard must stay SILENT on them. Directly: both names go 1 -> 0 occurrences
// under stripComments(), with length preserved. If a change here breaks comment-stripping, that
// guard starts firing on a comment that asserts the requirement rather than violates it.
/** Blank comments to spaces, keeping string and template bodies INTACT, and keeping length and
 *  newlines so line numbers survive. Template interpolations are re-entered as code with brace
 *  depth tracked, exactly as above, so a comment inside one is still blanked. */
export function stripComments(src) {
  let out = '';
  let state = 'code'; // code | line | block | sq | dq | tpl
  const tplBraces = []; // brace depth of each open ${ ... } interpolation
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const c2 = src[i + 1];
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && c2 === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (c === "'") { state = 'sq'; out += c; i += 1; continue; }
      if (c === '"') { state = 'dq'; out += c; i += 1; continue; }
      if (c === '`') { state = 'tpl'; out += c; i += 1; continue; }
      if (tplBraces.length > 0) {
        if (c === '{') { tplBraces[tplBraces.length - 1] += 1; out += c; i += 1; continue; }
        if (c === '}') {
          if (tplBraces[tplBraces.length - 1] === 0) { tplBraces.pop(); state = 'tpl'; out += c; i += 1; continue; }
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
      out += (c === '\n' || c === '\r' ? c : ' '); i += 1; continue;
    }
    if (state === 'sq' || state === 'dq') {
      const q = state === 'sq' ? "'" : '"';
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === q) { state = 'code'; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    // tpl
    if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
    if (c === '`') { state = 'code'; out += c; i += 1; continue; }
    if (c === '$' && c2 === '{') { tplBraces.push(0); state = 'code'; out += src.slice(i, i + 2); i += 2; continue; }
    out += c; i += 1; continue;
  }
  return out;
}
