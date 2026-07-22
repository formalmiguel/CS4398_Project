# CRITICAL REQUIREMENTS — 05 Scheduling Engine: IMPLEMENTATION (🟢 GREEN)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Implement the scheduling engine so that the **existing, frozen** test suite passes. **You will not touch a test.**

| | |
|---|---|
| **Phase** | 🟢 **GREEN — implementation only.** |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 04 (the failing test suite) — **and its human review gate must have passed and the tests must be committed** |
| **Spec** | `docs/SRS-v2.md` §3.8.4, Appendix A (worked example) |

---

## ⛔ **CRITICAL**: THE ONE RULE

# **MANDATORY**: You may not edit, delete, skip, rename, or weaken any test file.

**CRITICAL**: Not to fix a typo. Not to correct an assertion that is *obviously* wrong. Not to add `.skip` to one that seems unreasonable. **NOT FOR ANY REASON.**

**⛔ STOP**: If you cannot make a test pass and you believe the test is wrong — **report it.** Name the test, name the requirement it cites, and say why you think it misreads the requirement. A human adjudicates it against the SRS and either fixes the test or tells you to keep going.

> **MANDATORY**: **This is the point of the entire exercise.** The tests in `engine/test/` were written by an agent that never saw an implementation, from the SRS. They are the closest thing this project has to the requirements *in executable form.* **The instant an implementer is allowed to adjust them, they stop describing the requirement and start describing the code** — and you get a green suite that proves nothing.
>
> **CRITICAL: Escalating a test is a success.** It costs a human five minutes reading one assertion against one requirement. **Silently editing one is the failure mode this whole process was built to prevent, and it is invisible until the demo.**

---

## **MANDATORY**: What To Build

**CRITICAL**: **Exactly one function**, in `engine/src/index.ts`:

```ts
export const findCandidateSlots: FindCandidateSlots =
  (busy, task, schedulableDay) => { … }
```

**MANDATORY**: It must satisfy the `FindCandidateSlots` type from `shared/src/contract.ts`.

**CRITICAL**: **Private helpers within `engine/src/` are fine and expected** — the class diagram (§3.6) names `mergeBusyIntervals`, `freeIntervals`, and `rankSlots`. **Export only `findCandidateSlots`.** Everything else stays module-private.

### **MANDATORY**: Requirements It Implements

**FR-SCH-01, -02, -03, -04, -05, -06, -09** and **NFR-COR-01, -02, -03** and **NFR-PERF-01**, all quoted verbatim in `04-engine-tests-RED.md`.

**CRITICAL**: Read that file — **it is the spec you are implementing against**, and the tests are its assertions.

### **CRITICAL**: Explicitly Out Of Scope

**MANDATORY**: **FR-SCH-07 / FR-SCH-08 (priority displacement).** Conditional. Not started until every Essential requirement is verified (§2.7.1). **There is no test for it. Do not implement it.**

> *It is the most interesting problem in the project and the fastest way to lose a week — `CLAUDE.md` §6.*

**⛔ MANDATORY: FR-SCH-10 (placement order across several tasks) is NOT yours.** It was added at SRS **v2.9** and **you will encounter it in §3.8.4, sitting immediately after FR-SCH-09** — so read this before you act on it.

> **It is an obligation on the *caller*, not a behaviour of the engine.** It governs the **order in which the engine is invoked** when a day contains several flexible tasks; it adds nothing to the engine's inputs and changes nothing about a single placement. The requirement text says so explicitly.
>
> **The engine you are writing places ONE task.** Its signature — `(busy, task, schedulableDay) => PlacementResult` — cannot express an ordering across tasks, and **there is no test for it in `engine/test/`.** If you find yourself accepting a list of tasks, sorting anything by `priority`, or looping over tasks inside the engine, **stop: you have left this packet.** FR-SCH-10 is implemented and tested in packets 06–07, at service level.
>
> *`task.priority` is therefore **read by nothing in this packet**. That is correct and expected, not an omission — FR-SCH-03's ranking uses proximity then earlier start, and priority plays no part in it since SRS v2.7.*

---

## ⛔ **CRITICAL**: The Purity Requirement Is Structural, Not Stylistic

**MANDATORY — FR-SCH-05: no clock, no database, no side effects, no mutation of arguments.**

- ❌ **No `Date`, no `Date.now()`, no `new Date()`.** Anywhere. **The engine does not know what time it is**; if it needs to, the caller tells it.
- ❌ **No `Math.random()`** — it would break determinism (NFR-COR-02) *and* the property test's reproducibility.
- ❌ **No imports outside `engine/src/` and `shared/src/contract.ts`.** `engine/package.json` has an **empty `dependencies` block and CI fails if you add one.**
- ❌ **No mutation of `busy`, `task`, or `schedulableDay`** — the purity test deep-freezes them, so mutation throws.

> **CRITICAL**: Do not work around the freeze. **Copy before sorting** — `[...busy].sort(…)`, **never** `busy.sort(…)`. `Array.prototype.sort` mutates in place, and **this is the single most likely way you will fail that test.**

**MANDATORY**: This purity is not fastidiousness. It is what lets the engine be property-tested over 1,000 randomized days with no database and no browser, and held to 90% coverage. **It is the project's claim to technical depth. Protect it.**

---

## **CRITICAL**: Files You May Create Or Edit

- `engine/src/**` — the implementation

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ `engine/test/**` — ANY test file.** See THE ONE RULE.
- `shared/src/contract.ts`
- `server/**`, `web/**` — not this packet
- `engine/package.json` — **MANDATORY: you may not add a dependency.** If you think you need one, you have misunderstood the packet: **stop and report.**

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] **CRITICAL**: **Every test in `engine/test/` passes**, with `engine/test/` **byte-identical** to how prompt 04 left it.
  - **Verify: `git diff --stat engine/test/` is EMPTY.** If it is not, **revert it and report what you were trying to fix.**
- [ ] **Coverage on `engine/` ≥ 90% lines** *(NFR-MNT-01, Essential — CI enforces it)*
- [ ] **`findCandidateSlots` is the only export from `engine/src/index.ts`**
- [ ] `grep -rn "Date\|Math.random\|fetch\|require(" engine/src/` returns **nothing**
- [ ] `engine/package.json` `dependencies` is still `{}`
- [ ] `npm run lint` and `npm run typecheck` pass with zero errors
- [ ] **Any test you believe is wrong is listed in your report — and still passing or still failing, but NEVER edited**

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report — do not work around it — if:**

- **A test appears to be wrong.** Name it, name the requirement it cites, explain the mismatch. **MANDATORY: Do not touch it.**
- **Two tests contradict each other** — that means the requirements do, and **a human must resolve it in the SRS, not you in the code.** *(This is a genuinely useful thing to have found.)*
- **You cannot reach 90% coverage without adding tests. Say so.** *(Uncovered lines usually mean either dead code you should delete, or a real case prompt 04 missed. Both are worth a human's five minutes. **Neither is fixed by you writing a test** — that would put you back to grading your own homework.)*
- Making a test pass would require an implementation you believe is **wrong** — e.g. it forces a placement that overlaps a busy interval.

> **MANDATORY: NFR-COR-01 is the invariant the System may not violate. If a test demands you break it, the test is wrong. Report it; do not obey it.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when every test in `engine/test/` is green, coverage is ≥ 90%, and `git diff --stat engine/test/` is empty.**

**CRITICAL**: **You may not edit a test.** Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect** — report it rather than reconciling it.
