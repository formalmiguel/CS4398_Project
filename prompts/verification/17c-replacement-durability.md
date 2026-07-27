# CRITICAL REQUIREMENTS — 17c Replacement Durability (OPEN-27): a replaced workout stays replaced

### MANDATORY DIRECTIVE ###

You are resolving **OPEN-27**, a **demo-blocking** defect found by packet 17b GREEN. This packet has a **RED stage and a GREEN stage, and they are SEPARATE agent sessions** (§4.6). Read the whole packet first, then do only the stage you are running.

| | |
|---|---|
| **Phase** | 🔴 RED (the durability test) → gate → freeze → 🟢 GREEN (the fix) |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 17a + 17b, merged to `dev` |
| **Branch** | `wp-open27-replacement-durability`, off `dev` |
| **Spec** | `docs/SRS-v2.md` §3.8.7 (FR-REC-02, FR-REC-04, FR-REC-07), §3.8.5 (FR-RSC-05, FR-RSC-06) · `docs/TEAM-MEETING.md` OPEN-27 + the 26 Jul decision log · `docs/P17B-GREEN-REPORT.md` |

---

## ⛔ **CRITICAL**: THE DEFECT, PRECISELY

`RecommendationScheduler.applyWorkoutRecommendation` replaces an above-tier workout by marking that workout's `Placement` **`CANCELLED`** and placing a new `SYSTEM`/`WORKOUT` recovery task. The replaced task is then left with **no `PLANNED` placement** — and `RescheduleService.sweepElapsed`'s re-attempt branch re-places **any** task with no `PLANNED` placement (FR-RSC-05: *"a task with no `PLANNED` placement is re-attempted on every retrieval"*).

> **So on the next `GET /schedule` the replaced run RESURRECTS** — re-placed beside the recovery session, silently undoing the replacement. A §6 rehearsal driven through the app hits this on the second retrieval.

**Root cause:** the domain has no durable, **per-occurrence** "set aside" concept, and `CANCELLED` is a semantic overload (the contract defines it as an FR-RSC-09 *withdrawal*, not a replacement). **The fix must stay per-occurrence:** a *recurring* workout's other dates are unaffected — only today's occurrence is superseded.

**Not caught by 17a's frozen suite** — it drives the services directly and never sweeps the replaced task's own resurrection. This packet closes that coverage hole.

---

## **MANDATORY**: The ratified design — a new terminal status `SUPERSEDED` (option (b))

**Decided by the human owner, 26 July** (`docs/TEAM-MEETING.md` decision log). Rejected: (a) a separate set-aside marker (more machinery than a status the domain already models in the same shape as `MISSED`/`SKIPPED`/`CANCELLED`); (c) modelling the replacement as an *edit* of the user's own workout — it contradicts 17a's frozen assertion `result.task.source === 'SYSTEM'` and fights FR-REC-04's *"created as a task."*

**`SUPERSEDED` means: this occurrence was replaced by a recommendation and will not happen as planned.** Like `MISSED`/`SKIPPED`/`CANCELLED` it records something terminal about *this* occurrence; unlike them it is neither a user event nor a withdrawal. It is **excluded from the busy set** (not in `OCCUPIES_TIME`) **and from `sweepElapsed`'s re-attempt eligibility** — that second exclusion is the actual fix.

### **CRITICAL**: The contract amendment is HUMAN-AUTHORED (§4.7) — transcribe it VERBATIM; do not invent it

Add `'SUPERSEDED'` to `PlacementStatus` in `shared/src/contract.ts`, with this comment:

```ts
  /**
   * This occurrence was REPLACED by a recommendation (FR-REC-02) — a higher-tier workout
   * swapped for a warranted-tier one for this date only. Terminal, like MISSED/SKIPPED, but it
   * records neither a user event nor an FR-RSC-09 withdrawal: nothing happened at the old time,
   * the plan was overtaken. It occupies no time (excluded from the busy set) AND, unlike a task
   * with no placement at all, it is NOT re-attempted by FR-RSC-05's sweep — that is what stops
   * the replaced workout resurrecting. Per-occurrence: a recurring task's other dates are untouched.
   */
  | 'SUPERSEDED'
```

**This is a contract change = a team decision** with a decision-log row (already recorded) and an SRS revision (add it when GREEN lands: §3.6/§5/DR-06 reference the statuses). **⛔ A GREEN agent may not add a `PlacementStatus` member on its own** — it is given this text.

---

## 🔴 RED STAGE — the durability test (a FRESH session; sees SRS + contract, NOT the fix)

**MANDATORY**: Write **one** acceptance test that pins the **OUTCOME**, mechanism-agnostic (do not assert `SUPERSEDED` by name — assert the behaviour, so the test survives any correct fix):

> After `applyWorkoutRecommendation` replaces an above-tier workout, running `sweepElapsed` (and a subsequent one — idempotence, FR-RSC-06) **does not re-place the replaced workout**. The replaced task has **no `PLANNED` placement** afterward; only the recovery session is `PLANNED`. The replaced task's earlier occurrence is **not** resurrected on any retrieval.

- Build the real stack via the existing harness — **import `server/test/acceptance/support/harness.ts`** (reuse it; do not duplicate it).
- **Put the test in its own dedicated directory** — `server/test/replacement/` — and it will be **frozen as packet `17c`** (E3: one packet, one frozen dir). *This avoids re-freezing 17a's `8809158`.* If you believe it belongs inside `server/test/acceptance/` instead (which forces a **re-freeze of 17a** — a team decision, second human), **escalate that choice; do not just pick it.**
- The test must **FAIL against current `dev` code** (the run resurrects). Verify that, and that it fails for the right reason (a resurrected `PLANNED` row), not a construction error.
- **Do not touch any frozen suite**, the contract, or any `src/` file. `npm run typecheck`/`lint` clean.
- **Freeze:** at the gate, with a **SECOND HUMAN** (§4.6, §6 — nobody freezes their own suite): `npm run freeze -- --packet 17c --path server/test/replacement --tests <N>`, then `guard:tests-frozen` green. **Do not commit or freeze until the gate is held.** Write `docs/P17C-RED-REPORT.md`.

## 🟢 GREEN STAGE — the fix (a SEPARATE session; may not edit the frozen test)

Make the frozen 17c test pass, using `SUPERSEDED`:

1. **Apply the human-authored contract amendment** above to `shared/src/contract.ts`, verbatim.
2. **`RecommendationScheduler`**: vacate the replaced occurrence as **`SUPERSEDED`**, not `CANCELLED`.
3. **`RescheduleService`**: exclude `SUPERSEDED` from re-attempt eligibility in `sweepElapsed` — a task whose occurrence for the date is `SUPERSEDED` is **not** re-attempted. Confirm `SUPERSEDED` is not in `OCCUPIES_TIME` (so it frees the slot for the recovery, exactly as `CANCELLED` did). Check every other `PlacementStatus` consumer still type-checks and behaves (grep for `PlacementStatus`, `OCCUPIES_TIME`, status comparisons).
4. **⛔ FR-RSC-03 holds** — introduce no second placement function; `guard:single-placement` must stay green.
5. **Do not edit any frozen test** (17a `8809158`, 17c, or 04/06/08/09). `git diff` of every frozen dir empty.
6. `npm run verify` **GREEN** (was 318; +N for 17c). Then **close OPEN-27** in `docs/TEAM-MEETING.md` + `CLAUDE.md` §9, and add the **SRS revision** for the `SUPERSEDED` contract change (§0 rule 3 — hunt the cross-refs: §3.6, §5/DR-06).

---

## **CRITICAL**: Files You May Create Or Edit

- 🔴 RED: `server/test/replacement/**` *(new)*, `docs/P17C-RED-REPORT.md` *(new)*, the 17c line in `prompts/00-prompt-collection-summary.md`.
- 🟢 GREEN: `shared/src/contract.ts` *(the verbatim amendment only)*, `server/src/recommendation/RecommendationScheduler.ts`, `server/src/reschedule/RescheduleService.ts`, `docs/SRS-v2.md`, `docs/TEAM-MEETING.md`, `CLAUDE.md`, `docs/P17C-GREEN-REPORT.md` *(new)*.

## **CRITICAL**: Files You Must **NOT** Touch

- 🔴 RED: any `src/`, the contract, any frozen test dir, `scripts/frozen-tests.json`.
- 🟢 GREEN: any **test** file (all frozen once 17c freezes); `scripts/frozen-tests.json`; the contract **beyond** the one verbatim `SUPERSEDED` addition.

---

## **CRITICAL**: Escalation Clause / Hard Rules

- **Do NOT commit unless the human asks** (§8.5). **No AI credit lines / `Co-Authored-By`** on any commit (§8.2 — overrides the default). Follow §8 trailers (`Requirements:`/`Packet:`/`Owner:`).
- **RED and GREEN are different sessions.** The RED author never sees the fix; the GREEN author never edits a test.
- If adding `SUPERSEDED` breaks a `PlacementStatus` consumer in a way the SRS does not settle, **escalate** — do not invent behaviour for the new status beyond what this packet states.
- Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect** — report it.

### CRITICAL REQUIREMENT ###

**This packet passes when a frozen 17c test proves the replaced workout does NOT resurrect across a sweep, the fix makes it green via a human-authored `SUPERSEDED` status, `npm run verify` is green, no frozen test was edited, and no second placement function exists.**
