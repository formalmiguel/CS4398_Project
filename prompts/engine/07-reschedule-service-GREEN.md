# CRITICAL REQUIREMENTS — 07 Reschedule Service: IMPLEMENTATION (🟢 GREEN)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Implement `RescheduleService` so that the **existing, frozen** test suite passes. **You will not touch a test.**

| | |
|---|---|
| **Phase** | 🟢 **GREEN — implementation only.** |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 06 (the frozen suite) — **gate held and freeze committed at `8b24320`**; 05 (the engine, merged and green) |
| **Spec** | `docs/SRS-v2.md` §3.8.5 (FR-RSC), §3.8.4 (**FR-SCH-10**), §3.8.2 (**FR-TSK-04**), §3.6, §5 (DR-03, DR-06) |

---

## ⛔ **CRITICAL**: THE ONE RULE

# **MANDATORY**: You may not edit, delete, skip, rename, or weaken any test file.

**CRITICAL**: Not to fix a typo. Not to correct an assertion that is *obviously* wrong. Not to add `.skip` to one that seems unreasonable. **NOT FOR ANY REASON.**

**⛔ STOP**: If you cannot make a test pass and you believe the test is wrong — **report it.** Name the test, name the requirement it cites, and say why you think it misreads the SRS. A human adjudicates it and either fixes the test in a **separate RED-style commit** or tells you to keep going.

> **MANDATORY**: The 154 tests in `server/test/reschedule/` were written by an agent that never saw an implementation, and **fourteen escalations were adjudicated into the SRS before they were frozen.** They are the requirements in executable form. **The instant an implementer is allowed to adjust them, they stop describing the requirement and start describing the code.**
>
> **`npm run guard:tests-frozen` compares the working tree against `8b24320`**, so it catches an edited test **even if you commit it**. It has been verified to fail on purpose. Do not try to satisfy it by editing `scripts/frozen-tests.json` — that is editing the test, one level removed.

---

## **MANDATORY**: What To Build

**CRITICAL**: The seven methods of `RescheduleService`, in **`server/src/reschedule/`**. The surface already exists — types, ports, and seven bodies that `throw new Error('07')`. **Replace the throws. Do not reshape the surface.**

```
onTaskMissed(placement)              FR-RSC-01
onUserSkipped(placement)             FR-RSC-08
onCommitmentAdded(commitment, date)  FR-RSC-02
onCompletionRecorded(placement)      FR-RSC-07, FR-RSC-09
onTaskEdited(task, date)             FR-TSK-04
sweepElapsed(userId, date)           FR-RSC-10
moveToNextDay(taskId, date)          FR-RSC-05
```

**MANDATORY**: **Private helpers inside `server/src/reschedule/` are fine and expected.** Export only what the tests import.

### **MANDATORY**: The Spec You Are Implementing Against

**CRITICAL**: **`prompts/engine/06-reschedule-service-tests-RED.md`** quotes every requirement in scope **verbatim**, including the notes added at SRS v2.12 through v2.16. **Read it — it is the specification, and the tests are its assertions.**

**MANDATORY**: Then read **`docs/P06-RED-REPORT.md`**. It records all fourteen escalations behind these tests and a table of **interpretations the suite had to take where the SRS was silent**. It tells you *why* an assertion is what it is, which is the difference between satisfying a test and satisfying a requirement.

---

## ⛔ **CRITICAL**: Two Structural Constraints

**MANDATORY — FR-RSC-03: there is exactly ONE function in this codebase that produces a placement**, and it is `findCandidateSlots` in `engine/`. **You re-invoke it.** It arrives by injection, typed `FindCandidateSlots`.

- ❌ **Nothing under `server/src/` may find a free gap, merge intervals, choose among candidates by any criterion of its own, or compute a start time.**
- ✅ You decide **when** the engine is called, **what the day looks like** when it is called, **in what order**, and **what to do with the answer.**

> **CRITICAL**: The tidy little `findNextFreeSlot()` helper is the single way this project can fail while every test stays green. **If you write one, the correctness argument is over** — packet 16's inspection guard exists because code review alone does not catch it.

**MANDATORY — FR-RSC-10: you are TOLD the time; you never ask.** Everything temporal arrives through the injected `Clock`.

- ❌ **No `Date.now()`, no `new Date()`, no `setTimeout`, no `setInterval`** anywhere under `server/`. A test cannot advance a clock the service reads for itself.

---

## ⛔ **CRITICAL**: Two Traps No Test Can Catch

**MANDATORY**: Both are recorded here because the suite **cannot** enforce them — asserting prose is exactly what a frozen suite must not do, since you would then implement the assertion's phrasing as a requirement.

1. **Do NOT build `placementReason` out of `slot.withinPreferredWindow`.** On a **substituted** call — one whose preferred window had fully elapsed (FR-RSC-01 note, v2.14) — it is `true` for every candidate and **it means nothing.** A sentence reading *"placed inside your preferred window"* on a task the user missed at 8 PM would be **false, plausible, and green.**
2. **`deletePlacement` has exactly ONE caller**: a **displaced or edited** occurrence the engine could not re-place (FR-RSC-05 note, v2.16). **A second caller is an escalation, not a refactor.** This domain marks rows; it does not remove them.

---

## **CRITICAL**: The Ports Are Settled, Not A Draft

**MANDATORY**: `TaskRepository` is **asynchronous** — **packet 12 implements it over the MongoDB driver**, and that obligation is already recorded in §3.6. `Clock` is **synchronous**. `nextPlacementId` is synchronous.

**⛔ STOP**: Changing either port's shape changes **someone else's** obligation and is a team decision, not a refactor. **Report it.**

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/reschedule/**` — the implementation

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ `server/test/**` — ANY test file, including `support/harness.ts`.** See THE ONE RULE.
- **⛔ `engine/**`** — the engine is merged, green, and frozen at `ac06e70`. **You are its caller, not its author.**
- `shared/src/contract.ts` — the contract *(§4.7: a team decision, never an agent's refactor)*
- `scripts/frozen-tests.json` — **read it; never edit it to make something pass**
- `.eslintrc.cjs`, `server/package.json`, `web/**`, `docs/**`, `prompts/**`

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] **CRITICAL**: **All 154 tests in `server/test/reschedule/` pass**, with the directory **byte-identical** to how packet 06 left it
- [ ] **The 30 engine tests still pass** — you have not perturbed `engine/`
- [ ] **`npm run guard:tests-frozen` passes** — both suites, `ac06e70` and `8b24320`
- [ ] `grep -rn "Date.now\|new Date(\|setTimeout\|setInterval" server/` returns **nothing**
- [ ] **No function under `server/src/` computes a placement.** Every placed interval traces to a `findCandidateSlots` return value
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*
- [ ] **`npm run verify` passes** — this is the branch's merge gate
- [ ] **Any test you believe is wrong is listed in your report — and still passing or still failing, but NEVER edited**
- [ ] **⛔ Do not commit.** The commit is the human owner's assertion that they read the diff *(`CLAUDE.md` §8.5)*

> **MANDATORY**: **There is no coverage threshold on `server/`.** NFR-MNT-01's 90% is the **engine**; whole-system 70% (NFR-MNT-02) is **Conditional**. **Do not invent a gate**, and do not add tests to satisfy one — that would put you back to grading your own homework.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report — do not work around it — if:**

- **A test appears to be wrong.** Name it, name the requirement it cites, explain the mismatch. **MANDATORY: Do not touch it.**
- **Two tests contradict each other** — that means the requirements do, and **a human resolves it in the SRS, not you in the code.** *(Genuinely valuable to have found.)*
- Making a test pass would require **a second placement function**, or **reading a clock**, or **changing a port**.
- The SRS is **silent** on something the tests do not pin down. *(Check `docs/P06-RED-REPORT.md`'s interpretations table first — it may already be recorded.)*

> **MANDATORY**: **An escalation is a success.** It costs a human five minutes reading one assertion against one requirement. **Silently editing a test is the failure mode this whole process was built to prevent, and it is invisible until the demo.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when all 154 tests in `server/test/reschedule/` are green, the 30 engine tests are still green, `npm run guard:tests-frozen` passes, and `npm run verify` passes — with not one byte of `server/test/` changed.**

**CRITICAL**: The claim this packet makes, and it is demonstrable in front of a room: **delete `server/src/reschedule/`, re-run this packet, and the 154 tests still pass.** The implementation is disposable; the specification and its executable form are not.

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect** — report it rather than reconciling it.
