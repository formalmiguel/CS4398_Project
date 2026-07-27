# Packet 17b (GREEN) — The FR-REC-04 Wiring: Agent Report

**Packet:** the GREEN half of `prompts/verification/17a-acceptance-suite-RED.md` · **Phase:** 🟢 GREEN · **Human owner:** Patrick Rucker
**Run:** 26 July 2026 · **Branch:** `wp-17-acceptance` (off `dev`) · **Spec:** SRS **v2.27**
**Status:** ✅ **The frozen acceptance suite is GREEN. `npm run verify` passes: 318 tests, engine still 100%, all five frozen suites unchanged.** Not committed — waits for Patrick's explicit ask (§8.5).

> Fresh session from 17a's RED author (§4.6). No frozen test was edited, skipped, renamed, or weakened — the diff is four `src` files and zero test files.

---

## Result

| | |
|---|---|
| **Acceptance suite** (`server/test/acceptance`, 8 tests) | **8 passed** (was 6 failed / 2 passed at RED) |
| `npm run verify` | ✅ typecheck · lint · engine-deps · **engine-purity** · **single-placement** · **tests-frozen** · coverage |
| Tests overall | **318 passed / 318** (was 294 on `dev` + this suite + wiring) |
| Engine coverage | **100%** (NFR-MNT-01, unchanged) |
| `guard:tests-frozen` | ✅ P04 `ac06e70` · P06 `c30e784` · P08 `1199d80` · P09 `59f4e8a` · **P17a `8809158`** — all unchanged |
| `guard:single-placement` | ✅ still exactly one `findCandidateSlots`; the new engine call re-invokes it, it does not re-implement it |
| `guard:engine-purity` | ✅ engine untouched |
| Files changed | `RecommendationScheduler.ts` (the wiring), `TaskRepository.ts` (`source` param), `RescheduleService.ts` + `reasons.ts` (OPEN-24) |

---

## What the two methods do

**`recommendationsFor(userId, date)`** — reads the day's `DailyMetricSet` from `MetricStore` and hands it to the content-agnostic `RecommendationEngine`. Availability, fallback, and the FR-REC-13 reason are the engine's (packet 10); this method only reads and delegates. Satisfies §6 step 1 (sleep 40 → LOW, 850 cal → 2850, each reason naming its metric).

**`applyWorkoutRecommendation(userId, date)`** — the load-bearing FR-REC-04 path, in six steps:

1. **Warranted tier + reason** from the WORKOUT_INTENSITY recommendation. (Always defined: the rule falls back to MODERATE when sleep is unavailable — FR-REC-06.)
2. **Find the above-tier workout** (FR-REC-02): the first PLANNED occurrence on the day whose task is a WORKOUT at a strictly higher tier and whose window has **not begun** (FR-REC-07). A read and a comparison — it chooses nothing.
3. **Three options** at the warranted tier from the `Catalog` (FR-REC-03); `options[0]` is the System's own.
4. **Create the recommendation AS A TASK** (FR-REC-04, FR-TSK-01): `source: 'SYSTEM'`, `type: 'WORKOUT'`, at the warranted tier, **FLEXIBLE**, inheriting the replaced run's window and duration.
5. **Vacate** the replaced occurrence — marked `CANCELLED`, not deleted (DR-06), so it drops from every busy set and stays distinguishable from an occurrence that never happened.
6. **Place it by the engine** (FR-REC-02, FR-SCH-01, **FR-RSC-03**): `findCandidateSlots` is injected and re-invoked with (busy set, the derived task, the schedulable day); the rank-1 slot is used **verbatim**. The stored placement is an ordinary `PLANNED` row with **no `rescheduleTrigger`** (a first placement is not a reschedule — DR-06).

### FR-REC-04's "identically to a user task" is the *absence* of code, not a branch

Nothing in the wiring special-cases a SYSTEM task after it is placed. The row lands in the same store `RescheduleService.onCommitmentAdded`/`sweepElapsed` already read, so a commitment dropped on it is re-placed through the **same** path a user task takes. The acceptance suite proves this by calling `stack.reschedule` directly against the row this class wrote — 17:00–18:00 → 17:45–18:45 (Appendix A), then a skip moves it again, then a miss-then-complete withdraws it. The injected `RescheduleService` is therefore held but not *called* by the scheduler; the defence is structural.

### One placement function, still

The scheduler calls `this.engine(busy, task, day)` directly — the same move `RescheduleService.askEngine` makes. `guard:single-placement` confirms there is still exactly one `findCandidateSlots` definition (in `engine/src`) and no second placement function or re-implementation vocabulary anywhere. The scheduler finds no gap, merges no interval, ranks nothing, and computes no start time.

---

## How the escalations were resolved (against the adjudications in `P17A-RED-REPORT.md`)

| # | Escalation | What 17b did |
|---|---|---|
| 1 | `RecommendationScheduler` name/shape | Ratified into §3.6 at v2.27 (edges *gets decisions from / draws from / places via / defends placement via*). Implemented as the dedicated collaborator — the frozen `RecommendationEngine` (register/recommend) is composed, not extended. |
| 2 | `Catalog` minimal port | Left as declared (`findWorkouts(tier, count)`); packet 11 owns the full signature. Not widened. |
| **3** | **SYSTEM-task creation gap** | **Resolved by adding an optional `source?: TaskSource` parameter to `TaskRepository.createTask`, defaulting to `'USER'`.** ⚠️ **Cross-owner change — this is Miguel's `server/src/db/` module.** It is NOT a second placement function (FR-RSC-03): the method stores a task and computes no placement. `RecommendationScheduler` is the only caller that passes `'SYSTEM'`. **Miguel should be aware.** |
| 4 | §6 ↔ FR-RSC-09 | No code needed — the frozen test already exercises the withdrawal on a **miss**, matching §6 as amended at v2.27. |
| 5 | Two green OPEN-22(2) guards | Untouched; they stay green. |

---

## OPEN-24 — the honest-reason fix (a reschedule-module change, not wiring)

The RED suite's `reattempt-provenance` test failed at an assertion against *existing* code: `sweepElapsed`'s re-attempt branch stored `reattemptReason` — *"…your day had no room for it earlier today"* — on a task's **first-ever** placement, which is false (DR-03 requires a stored reason to be TRUE; DR-06 says an absent trigger means never rescheduled).

**Fix** (`reasons.ts` + `RescheduleService.ts`): the re-attempt branch now chooses its reason on whether the store holds any row for the task.
- **No rows** (a brand-new task's first placement, or a displaced/edited occurrence whose PLANNED row was hard-deleted and whose provenance is genuinely lost) → new `firstPlacementReason`: *`"…" placed at 8:00 PM.`* — plain and true, claiming no earlier attempt.
- **Rows present** (a MISSED occurrence whose own re-placement found no room) → `reattemptReason` unchanged, where *"no room earlier today"* is accurate.

The choice is a **reason** decision, not a placement one — the engine still decides where the task goes. Safe against the frozen packet-06 suite: it exercises only the elapsed-successor path of `sweepElapsed`, never the re-attempt reason (verified — no packet-06 test asserts a `placementReason` on a fresh placement). The two green OPEN-22(2) guards assert the *trigger*, not the reason, so they are unaffected.

---

## Design choices worth a second look at review

- **The recovery task inherits the replaced run's window and duration** (17:00–18:00, 60 min), which is what makes it land at 17:00 (Appendix A's exact fit) and re-place to 17:45 when Advisor is dropped on it. This is the one design assumption 17a flagged; it is now realized. If the team prefers the recovery to use the *catalog* workout's `typicalDurationMinutes` instead, that is a small change — but it would break the Appendix A number unless the two happen to match.
- **Vacating = `CANCELLED`, not delete.** Preserves history (DR-06), no use of the domain's single reserved deletion. ⚠️ **Known limitation, flagged not silently worked around:** the replaced (now-CANCELLED) USER workout has no PLANNED row, so `sweepElapsed`'s re-attempt branch would re-place it on a later retrieval — the replacement does not "stick" across a sweep. It is **not exercised by the acceptance suite** (step 5's assertions are all on the recovery task's own rows, and pass), and preventing it cleanly needs a way to mark a task "set aside" that the codebase does not yet have (`awaitingChoice` is UC-03's, and abusing it here would be wrong). Recommend a follow-up decision for a future packet: how a recommendation-replaced task should behave under the retrieval sweep.
- **`throw` on the no-op paths** (no above-tier workout, empty catalog, engine can't place). The result type is mandatory, so there is no "nothing to do" value to return; the demonstration always supplies a replaceable HIGH run. A real deployment would want these surfaced as user-facing outcomes, but that is beyond FR-REC-04's acceptance path.

---

## Verification honesty

Verified by the frozen acceptance suite and `npm run verify` (318 green, engine 100%). **Not** exercised in a browser or against a running server — this is the wiring layer proven by the offline acceptance suite (§6), which is exactly what FR-REC-04 is verified by (T). FR-WER-10's (D) demonstration on the real Garmin export remains separate and Ryan's.

## After the gate (do NOT do until Patrick asks — §8.5)

- [ ] **Commit** the GREEN diff (four `src` files), body stating `Tests unchanged since 8809158.`, `Requirements: FR-REC-04, FR-REC-01, FR-REC-02, FR-REC-03, FR-REC-13, FR-RSC-05`, `Packet: 17b`, `Owner: Patrick Rucker`.
- [ ] **Decision-log rows** (`docs/TEAM-MEETING.md`): OPEN-24 CLOSED (the honest-reason fix); the `createTask` `source` param as a cross-owner change to Miguel's `db/` (Escalation 3), with the FR-RSC-03 note that it is not a second placement path.
- [ ] **OPEN-24 → CLOSED** in `docs/SRS-v2.md` Appendix C and `docs/TEAM-MEETING.md` Open Issues, with the answer recorded.
- [ ] **CLAUDE.md §9** + "Last updated": FR-REC-04 realized; the wiring is green on `wp-17-acceptance`, ready to merge once read.
- [ ] **Heads-up to Miguel** on the `server/src/db/TaskRepository.ts` `source` param.
