# CRITICAL REQUIREMENTS — 16a Executable Guards: One Placement Function, Engine Purity

### MANDATORY DIRECTIVE ###

You are an expert TypeScript/Node engineer. **CRITICAL**: You are writing **two CI guards** and wiring them into the build. You are **not** writing application code, and you are **not** writing tests for behaviour that already has them.

| | |
|---|---|
| **Phase** | **GUARD** — executable enforcement of two Inspection-verified requirements |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 05 (the engine, merged and green), 07 (the reschedule service, merged and green) |
| **Spec** | `docs/SRS-v2.md` §3.8.4 (FR-SCH-05), §3.8.5 (FR-RSC-03), §4.5 (NFR-MNT-03), §3.2 (CON-04) · `CLAUDE.md` §4.8 · `docs/AGENTIC-TDD-WORKFLOW.md` §2.3, §3 Rule 3 |

---

## ⛔ **CRITICAL**: WHY THIS PACKET EXISTS

**MANDATORY**: Read this before anything else. It is the whole justification and it determines what a correct guard looks like.

> **An (I) requirement has no test, so it rots by default.** *(`AGENTIC-TDD-WORKFLOW.md` §2.3)*

Ask an agent to implement FR-RSC-02 — *"when a new fixed commitment overlaps a placed task, re-place that task."* It needs a free slot. Importing the engine means threading `schedulableDay` through three layers. Writing a small local `findNextFreeSlot()` right there in the service is **twenty lines and obviously simpler**, so that is what it does.

It has done exactly what was asked. FR-RSC-02 works. **Every test passes. And FR-RSC-03 is now false.** Two placement implementations exist, they drift, one gets the merge-adjacent-intervals fix and the other does not, and on 29 July the rescheduler starts putting tasks on top of lectures **while no test fails.**

> **MANDATORY**: `AGENTIC-TDD-WORKFLOW.md` §3 Rule 3: *"The single biggest threat to this codebase's maintainability is not a design flaw — it is an agent quietly adding a second placement function while FR-RSC-03 stays green and nothing fails."*

**CRITICAL**: A guard that a future agent can satisfy by editing the guard is not a guard. **Every failure message you write must say, explicitly, that the correct response is to escalate to the human owner — never to add an exemption, never to relax a pattern, never to delete the check.**

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`. Do not paraphrase. The phrasing is load-bearing.

- **FR-RSC-03.** *(Essential, I)* Automatic rescheduling shall use **the identical engine** of FR-SCH — not a second, parallel implementation. Verified by inspection: **exactly one function in the codebase produces placements**, and both the manual and automatic paths call it.

- **NFR-MNT-03.** *(Essential, I)* **There shall be exactly one implementation of placement logic in the codebase** (FR-RSC-03).

- **FR-SCH-05.** *(Essential, T)* The engine shall be a **pure function**: called twice with identical inputs it returns identical outputs; it performs no database write, no HTTP call, and no mutation of its arguments.

- **CON-04.** The scheduling engine shall be a module with **no dependency** on the HTTP layer, the database, or the wearable client, exercisable by unit tests that build their inputs in memory.

- **NFR-MNT-04.** *(Essential, I)* The System shall pass a **linter and a type check with zero errors** as a precondition of any merge.

### **CRITICAL**: Explicitly Out Of Scope

- **FR-LIB-02** (no network in the recommendation path) and **FR-REC-11 / NFR-MNT-06** (metric extensibility) — **these are packet 16b.** Their subjects do not exist yet; they need packets 10 and 11. **Write nothing for them.** A guard written against code that does not exist is a guess, and it will be wrong in a way nobody notices because it will pass.
- **FR-SCH-07 / FR-SCH-08** (priority displacement) — Conditional and deliberately not started (`CLAUDE.md` §6).
- **NFR-COR-01** (the 1,000-case property test) — already exists, frozen, in `engine/test/property.test.ts`.
- **Any change to application behaviour.** This packet adds enforcement. If a guard you write **fails on the code as it stands**, that is a finding to escalate — **not a licence to edit `engine/src/` or `server/src/`.**

---

## ⛔ **CRITICAL**: WHAT ALREADY EXISTS — DO NOT REBUILD IT

**MANDATORY**: FR-SCH-05 is **already guarded three ways.** Read all three before writing a line. Duplicating one of them wastes the packet and adds a second thing to maintain.

| Already enforced | Where | What it catches |
|---|---|---|
| **Manifest level** — `engine` and `shared` declare zero runtime dependencies | `scripts/guard-engine-deps.mjs`, run by `npm run guard:engine-deps` | `npm install mongodb -w engine` |
| **Import level** — `engine/src/**` and `engine/test/**` may import only relative paths, `@capstone/shared` (and `fast-check`, tests only) | the two `no-restricted-imports` overrides in `.eslintrc.cjs`, run by `npm run lint` | a stray `import { readFileSync } from 'node:fs'` |
| **Behaviour level** — no argument mutation even when deeply frozen; identical output when called twice; output arrays are not references to input arrays; deterministic ordering across ten calls and under a reversed/reordered busy array | `engine/test/purity.test.ts` (5 tests) and `engine/test/ranking.test.ts`'s `NFR-COR-02 determinism` block (3 tests) — **frozen at `ac06e70`** | an engine that sorts its caller's array in place |

### ⛔ **CRITICAL**: The gap those three leave, and it is the only FR-SCH-05 work in this packet

**MANDATORY**: **An ambient global needs no import and no dependency.**

```
Date.now()      new Date()      Math.random()      fetch()
process.env     process.hrtime  setTimeout        setInterval
performance.now()               globalThis        require()
```

**None of these appear in an import list. None appear in `package.json`.** The dependency guard reads a manifest and sees nothing. The lint rule inspects import statements and sees nothing. And the frozen purity suite catches such a call **only if it changes the output** — a `Date.now()` read as a tiebreak seed returns effectively the same value across ten calls in the same millisecond, so *"returns deeply equal results when called twice"* passes and the engine is no longer pure.

> **CRITICAL**: This is a hole a competent agent falls into innocently. It is not hypothetical: packet 07's prompt had to forbid `Date.now()` under `server/` **in prose**, because nothing enforced it. **Prose is not a guard.**

---

## **MANDATORY**: What To Build

**CRITICAL**: Two new Node scripts under `scripts/`, matching the idiom of the two that are already there — plain `.mjs`, no dependencies, `console.error` on violation, `process.exit(1)`, a one-line success message on pass. **Read `scripts/guard-engine-deps.mjs` and `scripts/guard-tests-frozen.mjs` first and follow their shape, their comment style, and their failure-message tone.**

### 1. `scripts/guard-single-placement.mjs` — FR-RSC-03, NFR-MNT-03

**MANDATORY**: The obligation is *"exactly one function in the codebase produces placements, and both the manual and automatic paths call it."* Translate that into checks that are **decidable by reading source text**. Three are specified below; you derive the exact matching.

**Check A — the single definition.** Across all first-party source (`engine/src/**`, `server/src/**`, `shared/src/**`, `web/src/**` — whichever exist), **exactly one `findCandidateSlots` definition exists, and it is in `engine/src/`.**

- **CRITICAL**: Match **declaration forms** — `function findCandidateSlots`, `const findCandidateSlots =`, `export function findCandidateSlots`, a class method of that name — **not every occurrence of the string.** `server/src/reschedule/RescheduleService.ts` mentions the name in a doc comment and in a thrown error message, and **both are legitimate.** A guard that fires on a comment gets deleted by the next person, and then it protects nothing.

**Check B — no second implementation, by return type.** **No file outside `engine/src/` may declare a function whose return type is `PlacementResult`, nor a function expression annotated `FindCandidateSlots`.**

- ✅ **A parameter, field, or variable *typed* `FindCandidateSlots` is correct and expected** — that is `RescheduleService`'s injected port (`server/src/reschedule/RescheduleService.ts`, `private readonly engine: FindCandidateSlots`), and it is the mechanism by which the service re-invokes the one engine rather than being one.
- ❌ **A function *body* annotated `FindCandidateSlots` outside `engine/src/` is a second placement function**, whatever it is named.

**Check C — the re-implementation vocabulary tripwire.** No **declared identifier** outside `engine/src/` may name the act of computing a placement. Derive the pattern list from the SRS's own words for that act — *find a free gap, merge intervals, choose among candidates, compute a start time* — e.g. `findFreeSlot`, `findNextFreeSlot`, `findAvailableSlot`, `nextFreeSlot`, `freeGaps`, `computeGaps`, `mergeIntervals`, `mergeBusy`, `firstFit`, `pickSlot`, `chooseSlot`.

- **MANDATORY**: Write into the script's header comment, in plain words, that **Check C is a tripwire, not a proof.** It catches the specific documented failure mode — *"the tidy little `findNextFreeSlot()` helper"* — and it **cannot** catch a second placement function named something innocuous. **Do not oversell it in the success message.** A guard whose output claims more than it verified is worse than no guard, because it stops people looking.

**Scope of the scan, for all three checks:**

- **Include:** `engine/src/**`, `server/src/**`, `shared/src/**`, `web/src/**`, `*.ts`/`*.tsx`.
- **Exclude:** `node_modules`, `dist`, `coverage`, `build`, **and every test directory.** ⚠️ **Test doubles are legitimate and must not fire this guard**: `server/test/reschedule/support/harness.ts` contains fake engines typed `FindCandidateSlots`, and that is exactly how the frozen suite proves the service re-invokes an injected engine instead of computing anything itself. **State this exclusion, and why it is correct, in the script's header comment** — an unexplained exclusion reads as a loophole to the next person.
- **MANDATORY**: Glob for directories rather than hard-coding a file list. `server/src/api/` and `server/src/db/` **do not exist on this branch** (see the section below) and the guard must cover them the moment they land, with no edit.

### 2. `scripts/guard-engine-purity.mjs` — FR-SCH-05, CON-04

**MANDATORY**: A static scan of **`engine/src/**` only**, rejecting the ambient globals listed above. Roughly 30 lines.

- **CRITICAL**: Scan **code, not comments and not string literals.** `engine/src/index.ts`'s header comment says *"it reads no clock"* — a substring match on `clock` or a careless match on `Date` would fire on the very comment asserting the property holds. Strip line and block comments before matching, and say in the header comment that you did and why.
- The failure message must name the requirement (FR-SCH-05), name the ambient global found, name the file and line, and state that **the engine's purity is what makes NFR-COR-01's 1,000-case property test and NFR-MNT-01's 90% coverage figure mean anything** — so this is an escalation, not a lint nit.
- **MANDATORY**: The header comment must state what this guard adds **over** the three existing mechanisms, in one sentence, so the next reader does not conclude it is redundant and remove it. *(It is the only one of the four that sees a call needing no import.)*

### 3. Wiring — `package.json` and `.github/workflows/ci.yml`

**MANDATORY**: Both guards run in `npm run verify` and in CI. A gate that is not enforced is not a gate; it is a hope.

- `package.json`: add `guard:single-placement` and `guard:engine-purity`, and add both to the `verify` chain **before** `test:coverage`, alongside the two existing guards. Keep the existing ordering idiom.
- `.github/workflows/ci.yml`: add both as named steps, each with a comment naming its requirement, matching the file's existing style.

**⚠️ MANDATORY — two defects in `ci.yml` you must also fix, and they are in scope because they are the same failure this packet exists to prevent:**

1. **`npm run guard:tests-frozen` is not in CI at all.** It was added after `ci.yml` was written and the workflow was never updated. **The RED/GREEN boundary — the single most important invariant in this project's method (`CLAUDE.md` §8.3) — is currently enforced only when a human remembers to run `verify` locally.** Add it as a named step.
2. **`actions/checkout@v4` defaults to a shallow clone (`fetch-depth: 1`), and `guard-tests-frozen.mjs` cannot work in one** — it compares the working tree against freeze shas `ac06e70` and `c30e784`, and its own error path tells you to run `git fetch --unshallow`. **Set `fetch-depth: 0` on the checkout step**, or the step you just added fails on every run for a reason unrelated to any test.

> **CRITICAL**: Adding the frozen-tests step **without** `fetch-depth: 0` produces a permanently red CI that someone will "fix" by deleting the step. **Both halves, or neither.**

---

## ⚠️ **CRITICAL**: THIS BRANCH DOES NOT CONTAIN THE CODE MOST AT RISK

**MANDATORY**: This packet runs on a branch off **`dev`**. On `dev`, `server/src/` contains **only `reschedule/`**. **`server/src/api/`, `server/src/db/` and `web/src/` exist only on `wp-12-backend-api` and `wp-13-frontend-dashboard`, neither merged.**

**That is where the exposure is.** Packet 12's `POST /tasks` calls `findCandidateSlots` **directly** for a flexible task's first placement — the newest, least-reviewed placement-adjacent code in the repo, and precisely what Check A and Check B exist to police.

**MANDATORY: You must validate both guards against that code before this packet is done.** Do it read-only, without switching branches and without merging anything:

```
git worktree add --detach ../_16a-check wp-13-frontend-dashboard
# point the guards at that tree, run them, read the output
git worktree remove ../_16a-check
```

- ✅ **Both guards pass on that tree** → say so in your report. The guards are validated against the real codebase and this packet is doing its job.
- ⛔ **Either guard fires on that tree** → **STOP. This is an escalation, and it is the single most valuable outcome this packet can produce.** Report the file, the line, the check that fired, and your reading of whether it is (a) a genuine FR-RSC-03 violation in packet 12/13, or (b) a false positive in your pattern.
  - **MANDATORY: Do not resolve it yourself.** Do not add an exemption, do not narrow the pattern, do not edit `wp-13`'s code — it is **Miguel Alvarez's** module (`CLAUDE.md` §7.2, §8.5) and you are on a different branch. A guard that was relaxed until it passed is a guard that verifies nothing, and **which of (a) or (b) is true is a requirements judgement, not a pattern-matching one.**

> **CRITICAL**: If you skip this step, the guard has never been run against the code it was written to police, and the first time it executes will be inside somebody else's merge. **Say plainly in your report whether you did it and what it returned.**

---

## **CRITICAL**: Files You May Create Or Edit

- `scripts/guard-single-placement.mjs` *(new)*
- `scripts/guard-engine-purity.mjs` *(new)*
- `package.json` — **only** the two new `scripts` entries and the `verify` chain
- `.github/workflows/ci.yml` — the new steps, the frozen-tests step, and `fetch-depth: 0`
- `docs/P16A-REPORT.md` *(new)* — see Definition of Done

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ `engine/src/**` and `server/src/**`** — you are writing the inspection, not the subject. **If a guard fails on this code, that is the finding. Report it; do not make it pass.**
- **⛔ `engine/test/**` (frozen at `ac06e70`) and `server/test/reschedule/**` (frozen at `c30e784`)** — `npm run guard:tests-frozen` compares the **working tree** against those shas and will catch an edit even if you commit it.
- **⛔ `scripts/frozen-tests.json`** — read it; never edit it. Editing the manifest is editing the tests, one level removed.
- **⛔ `scripts/guard-engine-deps.mjs`** — it works and it is cited by `ci.yml`. Your purity guard is **additive**; it does not absorb, replace, or refactor this one.
- `shared/src/contract.ts` — the contract *(`CLAUDE.md` §4.7: a team decision, never an agent's refactor)*
- `.eslintrc.cjs` — the two `no-restricted-imports` overrides are a working FR-SCH-05 guard. **Adding your check there instead of in a script is not equivalent**: lint is configurable per-file by anyone with an `eslint-disable` comment; a script in the `verify` chain is not.
- `web/**`, `docs/SRS-v2.md`, `prompts/**` *(other than your own report)*

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] **CRITICAL — each guard has been PROVEN to fail.** For each of the four checks (A, B, C, ambient-global), temporarily introduce a violation, run the guard, **confirm it exits non-zero with a message naming the requirement**, then remove the violation. **Record all four in your report, with the exact failure output.** *(A guard nobody has watched fail is a guard nobody knows works. `guard:tests-frozen` was verified this way on purpose — packet 07's prompt says so.)*
- [ ] **CRITICAL — `git status` is clean apart from your five files** after the must-fail exercise. A violation left behind is a defect you introduced.
- [ ] Both guards **pass** on this branch's tree.
- [ ] Both guards **have been run against `wp-13-frontend-dashboard`** via a detached worktree, the worktree removed afterwards, **and the result stated in the report** — pass, or escalation.
- [ ] `npm run verify` passes, with both new guards visibly in the chain.
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*.
- [ ] **Both freeze guards still intact** — `guard:tests-frozen` green for `ac06e70` and `c30e784`.
- [ ] Test count is **unchanged** — this packet adds no tests. *(The guards are scripts in the `verify` chain, not Jest suites. If your count moved, you wrote something you were not asked for.)*
- [ ] **`docs/P16A-REPORT.md`** records: what each guard checks and **in one honest sentence what it does not**; the four must-fail transcripts; the `wp-13` validation result; the `ci.yml` defects fixed and why they mattered; and **any escalation**.
- [ ] **⛔ Do not commit.** The commit is the human owner's assertion that they read the diff *(`CLAUDE.md` §8.5)*.

> **MANDATORY**: **Do not add a Jest test to raise a coverage number, and do not add a coverage threshold to `server/`.** NFR-MNT-01's 90% is the **engine**; whole-system 70% (NFR-MNT-02) is **Conditional**. Inventing a gate here is grading your own homework.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to the human owner — do not work around it — if:**

- **A guard fires on existing code**, on this branch or on `wp-13-frontend-dashboard`. **This is the packet succeeding.** Name the file, the line, the check, and your reading of whether it is a real violation or a false positive. **Do not decide it yourself and do not silence it.**
- **You cannot write a check that is decidable from source text** without producing false positives on legitimate code. **Say so and say why.** A narrower guard that is exactly right beats a broad one that gets disabled in three days — **but the narrowing is the owner's call, not yours.**
- **You conclude a check is redundant** with the deps guard, the lint rule, or the frozen purity suite. Say which, and quote the mechanism you think already covers it. *(If you are right, that is worth knowing. If you are wrong, the owner catches it in a minute.)*
- The two `ci.yml` defects turn out to be **more** than the two described, or fixing them makes CI red for a reason you cannot explain.
- Satisfying anything here would require touching a file on the **must NOT touch** list.

> **MANDATORY**: **An escalation is a success, not a failure.** A guard packet that finishes silently with everything green has, at best, confirmed that today's code is clean — and at worst, written four checks that cannot fire. **Say which one you believe it was.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when `npm run verify` and CI both run two new guards that have each been WATCHED TO FAIL on a deliberate violation and to pass on the real tree — including the tree of `wp-13-frontend-dashboard`, where the code most likely to violate FR-RSC-03 actually lives.**

**CRITICAL**: The property being defended is one sentence: **exactly one function in this codebase produces a placement, and it is `findCandidateSlots` in `engine/src/`.** Every other line of this packet is machinery around that sentence.

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it — an agent that silently resolves a contradiction has made a requirements decision nobody agreed to.
