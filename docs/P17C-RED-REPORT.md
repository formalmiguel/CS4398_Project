# Packet 17c (RED) — Replacement Durability (OPEN-27): Agent Report

**Packet:** `prompts/verification/17c-replacement-durability.md` · **Phase:** 🔴 RED · **Human owner:** Patrick Rucker
**Run:** 26 July 2026 · **Branch:** `wp-open27-replacement-durability` (off `dev`) · **Spec:** SRS v2.27 (§3.8.5 FR-RSC-05/06, §3.8.7 FR-REC-02/07)
**Status:** 🔴 **RED achieved and verified.** One durability test in a new dedicated dir `server/test/replacement/` **FAILS against current `dev` code for the intended reason** — the replaced workout resurrects on the next sweep. **Not frozen, not committed** — stopped at the human gate (§4.6/§6: nobody freezes their own suite; the GREEN fix is a separate session).

> Clean-room session (§4.6). The RED author read the SRS, the contract, the harness, and the frozen 17a acceptance suite (all *tests*) — **never the fix**. No expected value was read from an implementation body; every assertion cites the requirement it traces to.

---

## What was written

**One file:** `server/test/replacement/replacement-durability.test.ts` (1 test).

- **Its own dedicated dir** `server/test/replacement/`, to be **frozen as packet 17c** — this avoids re-freezing 17a's `8809158` (E3: one packet, one frozen dir). Auto-discovered by `server/jest.config.cjs` (`testMatch: test/**/*.test.ts`); no config change needed.
- **Reuses `server/test/acceptance/support/harness.ts`** (imported, not duplicated) — the same real stack the 17a acceptance suite builds: the real `findCandidateSlots`, the real `RescheduleService`, the real `RecommendationEngine` + rules, the real Mongo-backed repositories over `mongodb-memory-server`, a `TestableClock` told the time, and the one throwing surface `RecommendationScheduler` (now implemented on `dev` by 17b).
- No `src/`, no contract, no frozen test, no `scripts/frozen-tests.json` touched. `git status` shows only `server/test/replacement/` added.

---

## The assertion, and why it is the SRS's and not the code's

**Oracle — the requirements, mechanism-agnostic:**

- **FR-REC-02** *(Essential, D)* — where a workout is scheduled **above** the warranted tier, the System shall **replace it** with one at the warranted tier and **place the replacement using the scheduling engine.** A replacement silently undone on the next retrieval has replaced nothing; it has added a second workout beside the first.
- **FR-RSC-05** *(§3.8.5, v2.20 note)* — "a task with no `PLANNED` placement is **re-attempted on every retrieval**." This self-healing is correct for a genuinely unplaced task; the defect is that it also reaches the *deliberately vacated* replaced run.
- **FR-RSC-06 / NFR-REL-02** — rescheduling is **idempotent and terminating**: firing the retrieval sweep repeatedly converges on a stable schedule. So a **second** sweep must not re-place it either.

**The test asserts only the OUTCOME** (per the packet's mandate — do **not** assert `SUPERSEDED` by name, so the test survives any correct fix):

> After `applyWorkoutRecommendation` replaces the above-tier run, running `sweepElapsed` — and a second `sweepElapsed` (idempotence) — **does not re-place the replaced run**. The replaced task has **no `PLANNED` placement** afterward; only the recovery session is `PLANNED`; exactly one workout occurrence is planned for the day, never the recovery **and** the resurrected run.

No `PlacementStatus` name, no set-aside mechanism, no re-attempt internal is referenced — the test would pass under design (a), (b), or (c) equally, as long as the replaced run stays gone.

**Preconditions vs. the property.** Before the sweeps, the test asserts the replacement *happened* (recovery `PLANNED`, replaced run not `PLANNED`). This isolates a failure at those lines as a *construction* problem, distinct from the durability defect the sweep exposes. The observed failure is at the durability assertion, after the preconditions passed — so it fails for the right reason.

**Timing choice.** `now = 07:00` (`DAY.start`), the harness default: nothing has elapsed, the replaced run's 17:00 window is still ahead, and the recovery session (placed 17:00–18:00) does not itself become MISSED on the sweep. That isolates the resurrection as the **only** thing a sweep could change — no missed-window noise, no successor churn on the recovery session.

---

## RED verified — it fails, and for the intended reason

```
npx jest --config server/jest.config.cjs test/replacement
→ Tests: 1 failed, 1 total   (fails on all 3 attempts — jest.retryTimes(2))
```

The failure is at the **first durability assertion after the first sweep** (`plannedOf(run.id)` expected length 0):

```
Expected length: 0
Received length: 1
Received array: [{ "taskId": <Evening run>, "start": 960, "end": 1020, "status": "PLANNED",
  "placementReason": "\"Evening run\" placed at 4:00 PM — your day had no room for it earlier today." }]
```

The replaced HIGH-intensity "Evening run" **resurrected at 16:00–17:00** (`start: 960`) — re-placed **beside** the recovery session (17:00–18:00) by `sweepElapsed`'s FR-RSC-05 re-attempt branch, exactly as OPEN-27 predicts. The preconditions passed (the replacement itself occurred), confirming this is the durability defect and not a setup error.

**Verification hygiene:**

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean (root + `web`) |
| `npm run lint` | ✅ clean |
| `npm run guard:tests-frozen` | ✅ P04 `ac06e70` · P06 `c30e784` · P08 `1199d80` · P09 `59f4e8a` · P17a `8809158` — all unchanged |
| Diff scope | only `server/test/replacement/` added; no `src`, no contract, no frozen dir, no manifest |

---

## Escalations

**None.** The SRS settles the assertion (FR-REC-02 "replace it … place the replacement"; FR-RSC-05 re-attempt; FR-RSC-06 idempotence). No ambiguity required a guess, and no rule was invented. The packet and the SRS agree; nothing was found where the packet contradicts the SRS.

*Note on packet §29's ratified design.* The packet names option (b), a new terminal `PlacementStatus` `SUPERSEDED`, as the human-chosen fix — **that is GREEN's business, not RED's.** This test asserts none of it; a GREEN agent is free to realize the durability property however the human-authored contract amendment directs. The mechanism-agnostic framing is deliberate so a re-run of GREEN cannot be forced to match one implementation's choices (§0.1).

---

## The human gate — what is NOT done (needs a SECOND human, §4.6/§6)

- [ ] **Freeze:** `npm run freeze -- --packet 17c --path server/test/replacement --tests 1`, then `guard:tests-frozen` green with the 17c entry. **Nobody freezes their own suite** — a second human holds this gate.
- [ ] **Commit** the RED freeze (test file + this report + the 17c summary line), body recording "no escalations" and the RED evidence. **No AI credit lines / `Co-Authored-By`** (§8.2). Trailers: `Requirements: FR-REC-02, FR-RSC-05, FR-RSC-06`, `Packet: 17c`, `Owner: Patrick Rucker`.
- [ ] **GREEN (a separate session):** apply the human-authored `SUPERSEDED` amendment to `shared/src/contract.ts` verbatim, vacate the replaced occurrence as `SUPERSEDED` in `RecommendationScheduler`, exclude `SUPERSEDED` from `sweepElapsed`'s re-attempt eligibility in `RescheduleService`, keep it out of `OCCUPIES_TIME`, hold FR-RSC-03 (`guard:single-placement`), turn this frozen test green, then close OPEN-27 and add the SRS revision (§3.6/§5/DR-06).

**RED author's note for the GREEN session:** the test pins the replaced run acquiring **no `PLANNED` placement** across two sweeps, and exactly one planned workout occurrence for the day. It reads `placementsForDate`/`placementsOfTask` and filters on `status === 'PLANNED'` only — it does not inspect the vacated row's status, so the fix is free to name it `SUPERSEDED` (or anything else that keeps the occurrence out of `PLANNED` and out of the re-attempt set).
