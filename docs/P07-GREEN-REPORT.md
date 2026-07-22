# Packet 07 (GREEN) — Agent Report

**Packet:** `prompts/engine/07-reschedule-service-GREEN.md` · **Phase:** 🟢 GREEN · **Human owner:** Patrick Rucker
**Run:** 22 July 2026 · **Branch:** `wp-06-reschedule-red` · **Spec:** SRS **v2.16**, with **v2.17** written after the run from this report
**Status:** ✅ **Complete.** 154/154, one escalation raised and upheld.

> **Read this beside `docs/P06-RED-REPORT.md`.** They are two halves of one argument. RED found a Core requirement that could never fire (E1) and refused to guess; GREEN found a frozen test that could not pass and refused to weaken it. **Neither agent could have found the other's defect**, and that is the entire case for splitting them.

---

## Result

| | |
|---|---|
| **`server/test/reschedule`** | **154 / 154 pass** — after the one escalated test was corrected |
| **`engine/test`** | 30 / 30 pass, engine coverage **100%** *(NFR-MNT-01 requires 90%)* |
| `npm run guard:tests-frozen` | ✅ `P04 … ac06e70` · `P06 … c30e784` |
| `npm run guard:engine-deps` | ✅ engine and shared declare zero runtime dependencies |
| `npm run typecheck` · `npm run lint` | ✅ zero errors |
| `grep -rn "Date.now\|new Date(\|setTimeout\|setInterval" server/` | ✅ **silent** |
| `npm run verify` | ✅ **passes** — the branch's merge gate |

### Files written — all under `server/src/reschedule/`

```
RescheduleService.ts   bodies only; the surface frozen by packet 06 is untouched
reasons.ts             the sentences stored on Placement.placementReason (DR-03, FR-DSH-05)
taskOrder.ts           FR-SCH-10's comparator: (priority, has instant, instant, id)
```

### FR-RSC-03 — verified structurally, not by intention

**Every stored placement's `start` and `end` come from a slot the engine returned.** The only arithmetic anywhere under `server/src/` is:

- `Math.max(day.start, now)` — shaping the day handed **in**, per the v2.12 rule. The caller narrows; the engine ranks.
- `end - start !== task.durationMinutes` — E13's validity predicate, **rejecting** a placement. It never chooses one.

**Nothing merges intervals, finds a gap, or ranks a candidate.** `taskOrder.ts` orders *tasks* — the sequence in which the engine is invoked (FR-SCH-10) — never slots.

---

## ⛔ The escalation — one frozen test could not pass, and it was the test

**`triggers.test.ts` — "DR-06: three reschedules on one day record three different triggers."**

The scenario is skip → displace → miss. But the shared `SKIP_CANDIDATES` ranks **20:00–21:00** first, so `onUserSkipped` moved Gym **clear of the Advisor meeting (17:00–17:45)** before `onCommitmentAdded` ran. Nothing overlapped, nothing was displaced, and `['SKIPPED','DISPLACED','MISSED']` came back `['SKIPPED','MISSED']`. `READ_PLANNED` enters the store only *after* the displacement call, so there was no other candidate either.

**The scenario contradicted its own intent**: the engine script's second entry is `GYM_CANDIDATES`, whose rank 1 of 17:45 means *"just after the Advisor ends"* — an answer that is only meaningful if Gym were still sitting on it.

**Two rules would have turned it green, and both were refused:**

1. **Displace non-`COMPLETED` rows**, so the `SKIPPED` 17:00–18:00 row gets moved — which **overwrites DR-06's record that the user declared a skip**, the only thing that knows *"you skipped the 5:00 PM session"* is the true sentence (FR-DSH-05).
2. **Match overlap at task level while moving a different row** — which leaves the `SKIPPED` row overlapping the commitment forever, so displacement **re-fires on every retrieval**.

> **Both are non-idempotent, and `idempotence.test.ts` contains no skipped rows in its fixtures — so either would have stayed green while being wrong.** That is the *false, plausible, and green* shape this method exists to prevent, and an implementer who is forbidden from touching a test has nowhere to put the problem except a report.

**Resolution.** Upheld: the requirement was fine and the fixture was defective. Corrected by the **RED** session in `c30e784` — a local fixture ranking 17:15–18:15 first, **assertion unmoved, no other test changed** — and re-frozen in `fc75612`. *The RED session was told not to read `server/src/reschedule/` and not to run the suite: with the stub gone, a green run would have meant the fixture was tuned until the implementation liked it.*

---

## Choices no test pins

*Each is a place the frozen suite left open. **Two were promoted into the SRS at v2.17**; the rest are recorded here.*

| Choice | Where it now lives |
|---|---|
| **"Fully elapsed" is read off two different intervals.** The FR-RSC-01 trigger reads `placement.end`; the v2.14 substitution reads `task.preferredWindow.end`. **Reading the task's window for the trigger makes the sweep churn forever** — a 21:15 successor of a task whose window closed at 20:30 is elapsed the instant it exists. | **SRS v2.17**, §3.8.5 |
| **The busy set is `PLANNED` + `COMPLETED` only.** That single choice is what satisfies FR-RSC-09's *"frees the interval it held"*: a `CANCELLED` row drops out with **no cleanup code anywhere**. | **SRS v2.17**, §3.8.5 |
| `moveToNextDay` stores **no** `rescheduleTrigger` — the SRS calls the next day's placement an ordinary one, and the contract says an absent trigger means never moved. The trigger is still *reported* on the outcome, derived from the `MISSED`/`SKIPPED` row left on the failing day. | here |
| `CompletionOutcome.statement` is `''` when nothing was cancelled — the field's own comment requires non-empty **only** when `cancelled` is not null. | here |
| `placed: true` with **zero** slots throws. Unreachable under the contract; reporting it as `UNPLACEABLE` would mean **inventing a `NoSlotReason` the engine never gave**. | here |

---

## For the packets that come next

**Packet 12 (backend)** implements `TaskRepository` — **asynchronous**, eight methods, over the MongoDB driver. `nextPlacementId` and the whole `Clock` port stay synchronous. **⛔ `deletePlacement` has exactly one caller**: a displaced or edited occurrence the engine could not re-place. *A second caller is an escalation, not a refactor — this domain marks rows, it does not remove them.* Packet 12 also owns **OPEN-17**, the task-creation placement path, which FR-SCH-10 binds identically.

**Packet 16 (the (I) guards)** now has a second module to inspect for FR-RSC-03 / NFR-MNT-03. The mechanical form the guard can take: **assert that no file under `server/src/` computes an interval** — every `start`/`end` written to a `Placement` traces to a `findCandidateSlots` return value. *`Math.max(day.start, now)` and the exact-length validity check are the two legitimate exceptions and should be named in the guard rather than pattern-matched around.*

**⛔ Carried forward from packet 06, because no test can enforce it:** do not build `placementReason` out of `slot.withinPreferredWindow`. On a substituted call it is `true` for every candidate and **means nothing** — *"placed inside your preferred window"* on a task the user missed at 8 PM would be **false, plausible, and green**.
