# CRITICAL REQUIREMENTS — <NN> <Component Name>

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Implement **only** what is specified below, and **only** in the files listed. This packet is one reviewable diff with one human owner.

| | |
|---|---|
| **Phase** | 🔴 RED (tests only) · 🟢 GREEN (implementation only) · SCAFFOLD · GUARD · BUILD |
| **Human owner** | *A name. Not "the team." This person must be able to explain the result aloud without opening the file.* |
| **Depends on** | *Prompt numbers, or "nothing"* |
| **Spec** | `docs/SRS-v2.md` §\<x> |

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`. Do not paraphrase.
> The SRS's phrasing is load-bearing — *"it shall **not** silently drop the task"* is a testable obligation; *"handle the no-slot case gracefully"* is not. **Paraphrasing is where the requirement quietly changes.**

- **FR-XXX-01.** *(Essential, T)* …
- **FR-XXX-02.** *(Essential, T)* …

### **CRITICAL**: Explicitly Out Of Scope

- *Requirement IDs that are Conditional, deferred, or belong to another packet. **Write no code and no test for these.***

---

## **MANDATORY**: The Contract

**CRITICAL**: You **import** every domain type from `shared/src/contract.ts`. You **may not redefine, extend, widen, or shadow** any type in it.

**⛔ STOP**: If you believe the contract is wrong or insufficient — **do not change it.** Report what you need and why. The contract is a team decision with a row in `docs/TEAM-MEETING.md`, not a refactor.

---

## **MANDATORY**: What To Build

*State the obligation and the shape it must satisfy. **Do not paste a finished implementation** — the agent derives it from the requirement, which is what makes the coverage and property-test figures mean anything (`00-prompt-collection-summary.md`).*

### `path/to/file.ts` — FR-XXX-01, FR-XXX-02

- …

---

## **CRITICAL**: Files You May Create Or Edit

- `path/to/file.ts`

## **CRITICAL**: Files You Must **NOT** Touch

- `shared/src/contract.ts` — the contract
- *(🟢 GREEN packets: **every test file.** You may not edit, delete, skip, rename, or weaken a test. **Not to fix a typo. Not to correct an "obviously wrong" assertion.**)*
- *(🔴 RED packets: **any implementation.** No helpers, no utilities "to make the tests readable." **If you write a function that computes the answer, you have written the implementation.**)*

---

## **MANDATORY**: Verification Steps — Definition of Done

*Mechanical and checkable. **Not** "the code is good."*

- [ ] …
- [ ] **Every test name cites the requirement ID it verifies** — e.g. `it('FR-SCH-09: rejects a free interval one minute short and keeps searching', …)`. This is the traceability matrix (Appendix B); a grader reads the test output as evidence.
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*
- [ ] *(🟢 GREEN only)* **`git diff --stat <test dir>` is EMPTY.** Nothing in the test folder changed.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to the human owner — do not work around it — if:**

- You need to change the contract.
- Two requirements in scope appear to **contradict** each other. *(Say which, and how.)*
- A requirement is **ambiguous** for a case you must handle. **Do not invent a rule and encode it.**
- *(🟢 GREEN only)* You cannot make a test pass and believe **the test** is wrong. **Report it. Do not edit it.** A human adjudicates it against the SRS.
- Satisfying a requirement here would require touching a file on the **must NOT touch** list.

> **MANDATORY**: An escalation is a **success**, not a failure. It is the mechanism working. **A packet that finishes with zero escalations and zero questions on a genuinely ambiguous specification is the outcome to be suspicious of.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: Restate the packet's single pass condition here, in one sentence, so it is the last thing read before work begins.

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it — an agent that silently resolves a contradiction has made a requirements decision nobody agreed to.
