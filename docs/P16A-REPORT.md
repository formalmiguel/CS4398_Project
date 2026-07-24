# P16A Report — Executable Guards: One Placement Function, Engine Purity

**Packet:** `prompts/verification/16a-guards-placement-purity.md`
**Owner:** Patrick Rucker · **Branch:** `wp-16a-guards` off `dev` · **Date:** 24 July 2026
**Requirements:** FR-RSC-03, NFR-MNT-03 (single placement function); FR-SCH-05, CON-04 (engine purity); NFR-MNT-04 (lint/typecheck clean).

This packet adds two CI guards. It adds **no application code and no tests** — the test count is unchanged at 184.

---

## What each guard checks — and, honestly, what it does not

### `scripts/guard-single-placement.mjs` — FR-RSC-03 / NFR-MNT-03

Scans the four source roots (`engine/src`, `server/src`, `shared/src`, `web/src`) — globbed, so `server/src/api` and `server/src/db` are covered the moment they land, no edit — with comments and string literals blanked. Every test directory is excluded by construction (the scan starts at `*/src`), so the fake engines typed `FindCandidateSlots` in `server/test/reschedule/support/harness.ts` correctly do not fire it.

- **Check A — the single definition.** Exactly one `findCandidateSlots` *declaration* exists across all first-party source, and it is in `engine/src`. Declaration forms only (`function`, `const/let/var`, class method); the doc-comment mention and the thrown-error string in `RescheduleService.ts` do not count.
- **Check B — no second implementation, by type.** Outside `engine/src`, no function *returns* `PlacementResult` and no function *expression* is annotated `FindCandidateSlots`. A parameter/field merely *typed* `FindCandidateSlots` — the injected engine port `private readonly engine: FindCandidateSlots` — is correct and does not fire.
- **Check C — re-implementation vocabulary tripwire.** Outside `engine/src`, no declared identifier names the low-level act of computing a placement (`findFreeSlot`, `mergeIntervals`, `pickSlot`, …).

**What it does NOT do (one honest sentence):** Check C is a tripwire, not a proof — it catches the one documented failure mode (a tidy local `findNextFreeSlot()` helper) and **cannot catch a second placement function named something innocuous**; that residual case is caught by Checks A and B, which key on the type signature rather than the name.

### `scripts/guard-engine-purity.mjs` — FR-SCH-05 / CON-04

A static scan of `engine/src/**` only, with comments and strings blanked (so the file's own header comment *"it reads no clock"* does not fire), rejecting the ambient globals that need no import and no `package.json` entry: `Date.now()`, `new Date()`, `Math.random()`, `fetch()`, `process.env`, `process.hrtime`, `setTimeout`, `setInterval`, `performance.now()`, `globalThis`, `require()`.

**What it adds over the three existing FR-SCH-05 mechanisms:** it is the only one of the four that sees a call needing no import and no dependency — the deps guard reads a manifest, the lint override reads import statements, and the frozen purity suite only catches an impurity that *changes the output* (a `Date.now()` tiebreak seed returns the same value twice in a millisecond and passes).

**What it does NOT do (one honest sentence):** it blanks string/template bodies but does not special-case regex literals, so a forbidden token inside a regex literal would be a false positive — there are none in the engine, and one would warrant a look rather than a silent pass.

---

## The four must-fail transcripts

Each check was proven to fail on a deliberate violation, then the violation was removed and the guard confirmed green. The tree was clean after each.

### Ambient-global (purity guard) — injected `const _seed = Date.now();` into `engine/src/index.ts`

```
FR-SCH-05 / CON-04 VIOLATION: the engine reached an ambient source of impurity.
  engine/src/index.ts:27  Date.now()
  ...
  This is an escalation to the human owner (Patrick Rucker), not a lint nit.
exit=1
```
Restored → `engine/src reaches no ambient clock, RNG, timer, network or process global (FR-SCH-05)` (exit 0). This also confirms comment-stripping: the header's *"reads no clock"* did not fire.

### Check A — second `findCandidateSlots` definition (probe file under `server/src`)

```
FR-RSC-03 / NFR-MNT-03 VIOLATION (Check A): there must be exactly one
`findCandidateSlots` definition, in engine/src.
  Found 2:
    engine/src/index.ts:183
    server/src/_probe16a.ts:1   <- outside engine/src: a second placement function
exit=1
```

### Check B — function returning `PlacementResult` outside `engine/src`

```
FR-RSC-03 VIOLATION (Check B): server/src/_probe16a.ts:2 is a function returning `PlacementResult`.
  A second thing that produces placements. There must be exactly one, in
  engine/src, re-invoked by injection — not re-implemented here.
exit=1
```

### Check C — declared `findNextFreeSlot` outside `engine/src`

```
FR-RSC-03 VIOLATION (Check C, tripwire): server/src/_probe16a.ts:1 declares `findNextFreeSlot`.
  This names the act of computing a placement. If it computes one, it is the
  second implementation FR-RSC-03 forbids. Re-invoke engine/src instead.
exit=1
```

All three re-confirmed still failing after the Check-C vocabulary change below.

---

## `wp-13-frontend-dashboard` validation — AN ESCALATION WAS RAISED AND RESOLVED

Both guards were run against the `wp-13-frontend-dashboard` tree via a detached worktree (`git worktree add --detach ../_16a-check wp-13-frontend-dashboard`), read-only, no branch switch, worktree removed afterward. That tree is where the exposure actually is: `server/src/api/app.ts:270` calls `findCandidateSlots` **directly** for a flexible task's first placement.

- **Purity guard:** passed on `wp-13` (exit 0).
- **Single-placement guard, FIRST run:** **fired** —
  ```
  FR-RSC-03 VIOLATION (Check C, tripwire): web/src/api/client.ts:113 declares `placeTask`.
  ```

**Reading: false positive in my pattern, not a violation in packet 12/13.** `web/src/api/client.ts:113`'s `placeTask(taskId, choice)` is a frontend HTTP transport wrapper — it `POST`s a slot the *user already chose* from the FR-DSH-06 candidate picker to `/tasks/:id/place`. It computes no placement; it records one. `app.ts` correctly re-invokes the one engine (import + call at line 270), and defines no placement function of its own — Checks A and B passed on that tree.

**Root cause:** I had added `placeTask` and `scheduleTask` to Check C's vocabulary *beyond the packet's SRS-derived example list*. Those are orchestration/transport verbs (they legitimately name "record the chosen placement" in a UI client or service), not the SRS's words for the *act of computing* a slot.

**Per the packet, I did not resolve it myself** — I stopped and escalated to the human owner (Patrick Rucker), who decided the narrowing.

**Resolution (owner's decision, 24 Jul):** remove `placeTask` and `scheduleTask` from Check C; keep the SRS-derived list. No enforcement is lost — a genuine second engine named `placeTask` is still caught by Checks A/B, which key on the type signature, not the name. After the change, **both guards pass on `wp-13`** (single-placement exit 0), and Checks A/B/C still fail on injected violations.

> This is the packet doing its job: the guard was run against the code most likely to violate FR-RSC-03 before that code ever reached a merge, and the one thing it surfaced was a defect in the guard, corrected under the owner's decision rather than by silently relaxing a live check.

---

## `ci.yml` defects fixed — and why they mattered

Both were the same failure this packet exists to prevent: an inspection-level guarantee enforced only by a human remembering to run something.

1. **`npm run guard:tests-frozen` was absent from CI entirely.** It was added after `ci.yml` was written and the workflow never updated, so the RED/GREEN boundary — the single most important invariant in the project's method (CLAUDE.md §8.3) — was enforced only when someone ran `verify` locally. Added as a named step.
2. **`actions/checkout@v4` defaults to a shallow clone (`fetch-depth: 1`).** The frozen-tests guard's provenance check diffs the working tree against freeze shas `ac06e70` and `c30e784`, which are unreachable in a depth-1 clone. Set `fetch-depth: 0` on the checkout step — **both halves together**, since adding the step without the fetch depth produces a permanently red CI someone would "fix" by deleting the step.

The two new guards (`guard:engine-purity`, `guard:single-placement`) were also added as named CI steps, each commented with its requirement.

---

## Definition of Done — status

- [x] Each of the four checks watched to fail on a deliberate violation, with the requirement named; transcripts above.
- [x] Tree clean after the must-fail exercise (no probe file, no worktree residue).
- [x] Both guards pass on this branch and on `wp-13-frontend-dashboard` (after the escalation resolution).
- [x] `npm run verify` passes, both new guards visible in the chain, before `test:coverage`.
- [x] `npm run lint` and `npm run typecheck` clean (NFR-MNT-04).
- [x] Frozen guards intact — `guard:tests-frozen` green for `ac06e70` and `c30e784`.
- [x] Test count unchanged (184); this packet added no Jest tests and no `server/` coverage threshold.
- [x] Report records checks, honest limits, four transcripts, the `wp-13` escalation + resolution, and the `ci.yml` fixes.
- [ ] **Not committed** — the commit is the owner's assertion that the diff was read (CLAUDE.md §8.5).

**Files touched:** `scripts/guard-single-placement.mjs` (new), `scripts/guard-engine-purity.mjs` (new), `package.json` (two script entries + verify chain), `.github/workflows/ci.yml` (two guard steps, the frozen-tests step, `fetch-depth: 0`), `docs/P16A-REPORT.md` (this file).

## Escalation summary

One escalation, raised and resolved: Check C fired on `wp-13`'s legitimate `placeTask` transport wrapper — a false positive from two vocabulary terms added beyond the packet's SRS-derived list. Resolved by the owner narrowing the list to the SRS-derived terms. This packet did **not** finish silently green: it surfaced a real defect in one of its own checks by running it against the code it was written to police.
