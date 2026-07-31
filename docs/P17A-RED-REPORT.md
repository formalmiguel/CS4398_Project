# Packet 17a (RED) — Acceptance Suite: Agent Report and Escalations

**Packet:** `prompts/verification/17a-acceptance-suite-RED.md` · **Phase:** 🔴 RED · **Human owner:** Patrick Rucker
**Run:** 26 July 2026 · **Branch:** `wp-17-acceptance` (off `dev`) · **Spec:** SRS **v2.26**
**Status:** ✅ **Gate held 26 July 2026 by Patrick Rucker (owner), reviewing ALONE — a documented self-gate.** The second-human review required by `AGENTIC-TDD-WORKFLOW.md` §6 was **waived on the record**: Patrick's teammates were unavailable at the time and **gave him the green light to self-gate** this suite. *(Unlike packet 06's waiver — no teammate had yet worked the method — this waiver rests on availability plus explicit prior authorization, not inexperience.)* **All five escalations adjudicated** (three into the SRS at v2.27; one convention into the decision log; one flagged for packet 17b). **Suite frozen** — `server/test/acceptance`, 8 tests, hash-enforced, **no commit sha yet** (the RED freeze is not committed; the sha backfills when Patrick commits — see `scripts/frozen-tests.json`'s `shaPendingCommit` note and the §"After the gate" list). **Not committed** — that waits for Patrick's explicit ask (§8.5).

### How the five escalations were adjudicated (26 Jul)

| # | Escalation | Decision |
|---|---|---|
| 1 | `RecommendationScheduler` name / §3.6 placement | **Keep the dedicated collaborator; ratified into §3.6 (v2.27).** No test change. |
| 2 | `Catalog` seam minimal shape | **Accepted as minimal;** packet 11 owns the full signature. No test change. |
| 3 | SYSTEM-task creation gap | **Flagged for packet 17b** — 17b needs a sanctioned `source: 'SYSTEM'` creation path (Miguel's `db/` module) that is not a second placement function. |
| 4 | §6 ↔ FR-RSC-09 contradiction | **§6 amended (v2.27)** so the withdrawal is demonstrated on a *miss*, not chained off the skip. No test change (the test already used a miss). |
| 5 | Two green OPEN-22(2) regression tests | **Kept in 17a;** convention *"a RED freeze may include a green regression guard"* recorded in the decision log. No test change. |

> **This file exists to be read at the gate, before the freeze commit.** Its contents belong in that commit's body (`CLAUDE.md` §8.3): *"an ambiguity the RED agent found and refused to guess at is the highest-value line in the whole log, and it exists nowhere else once the session ends."*

> ⛔ **Nothing below is settled.** The RED agent wrote tests against its proposed resolutions; **a resolution becomes a requirement only when a human writes it into the SRS.** The same reasoning that separates RED from GREEN separates a proposal from a specification.

---

## Result

| | |
|---|---|
| **Test suites** | 2 failed, 2 total |
| **Tests** | **6 failed, 2 passed, 8 total** *(the two green ones are the headline — see §"The two that pass")* |
| **Spine failures' cause** | `Error('17b')` — the throwing `RecommendationScheduler`. Verified mechanically: with `jest.retryTimes(2)` (3 attempts each), the stub threw **15** times across the 5 spine tests — `applyWorkoutRecommendation` ×12, `recommendationsFor` ×3 — and nothing else. |
| **The 6th failure** | `reattempt-provenance.test.ts`'s OPEN-22(1)/OPEN-24 test, failing at an **assertion, not the stub**: `expect(placementReason).not.toMatch(/no room/i)` — received *"…your day had no room for it earlier today."* This is a **genuine RED for a real bug** (OPEN-24) that 17b fixes in the reschedule module. |
| `npm run typecheck` | ✅ zero errors |
| `npm run lint` | ✅ zero errors |
| `npm run guard:tests-frozen` | ✅ P04 `ac06e70`, P06 `c30e784`, P08 `1199d80`, P09 `59f4e8a` — all unchanged |
| `npm run guard:single-placement` | ✅ exactly one placement definition; the stub trips no check |
| `npm run guard:engine-purity` | ✅ engine reaches no ambient global |
| `git status` | only the 4 new files + the one 17a status-marker line in `00-prompt-collection-summary.md` |

### Files written

```
server/src/recommendation/RecommendationScheduler.ts     the FR-REC-04 wiring SURFACE — throwing stubs only + the Catalog port type
server/test/acceptance/support/harness.ts                real stack (real engine/reschedule/rec-engine/rules/stores) + Catalog double
server/test/acceptance/recommendation-to-calendar.test.ts  the §6 demonstration spine, 5 tests
server/test/acceptance/reattempt-provenance.test.ts        OPEN-22 (2 cases) + OPEN-24, 3 tests
```

**Nothing in `server/src/` computes a placement except by calling the injected engine.** `RecommendationScheduler` throws; it does not search, rank, merge, or compute a start time. The harness's `Catalog` double returns a fixed roster and makes no placement decision. Every expected placement time in the suite is either the engine's own answer (verified through the real `findCandidateSlots`) or a number pinned by SRS Appendix A.

---

## The surface declared, and why this shape (Escalation 1)

`RecommendationScheduler` (`server/src/recommendation/RecommendationScheduler.ts`), constructed with the one engine (`FindCandidateSlots`), `RescheduleService`, `RecommendationEngine`, a `Catalog` port, `MetricStore`, `TaskRepository`, and `Clock`. Two methods, both `throw new Error('17b')`:

- `recommendationsFor(userId, date) → Recommendation[]` — the day's recommendations from the injected metrics (FR-REC-01/08/13).
- `applyWorkoutRecommendation(userId, date) → WorkoutRecommendationResult` — replace an above-tier workout with a warranted-tier one, created as a SYSTEM/WORKOUT `Task`, drawn from the `Catalog`, **placed by the engine**, defended by `RescheduleService` (FR-REC-02/03/04). The result type carries only the four facts FR-REC-02/03/04/13 name (`task`, `placement`, `options`, `reason`).

> **⚠️ ESCALATION 1 — the name/shape is a proposal, ratify it into §3.6 before freezing.** §3.6 draws the two edges this realizes — `RecommendationEngine --> SchedulingEngine : places via` and `--> Catalog : draws from` — on **`RecommendationEngine` itself.** But packet 10 built `RecommendationEngine` as a *content-agnostic rule evaluator* (`register`/`recommend` only, no ports, no state), and the **frozen packet-09 suite pins that shape.** Bolting placement + four collaborators onto it would contradict both. The agent introduced a **dedicated collaborator** that composes the frozen engine with the scheduling stack — the same move by which `RescheduleService` realizes "re-invokes SchedulingEngine" without *being* the engine.
>
> **A human must decide:** ratify the collaborator (and its name) into §3.6, **or** fold the method onto `RecommendationEngine`. The frozen tests bind to the *obligations* (a SYSTEM/WORKOUT task placed by the engine, re-placed by FR-RSC-02), not to the identifier — but **a rename is a more-than-trivial change and would force a re-freeze**, so settle it *before* freezing, not after. *(This is the same class of decision as packet 06's ports, drafted by the RED packet and ratified into §3.6 at v2.14, E9 — and the same trap `CLAUDE.md` §9 records: a draft that invented `Rule`/`ruleRegistry` was caught and realigned to §3.6.)*

---

## Escalations 2–5

### Escalation 2 — the `Catalog` seam is declared minimal on purpose

§3.6 draws `Catalog.findWorkouts(tier, prefs, n)` and `findMeals(calorieTarget, prefs)`. `prefs` has no shape in the contract, and the acceptance demonstration exercises **no** dietary/workout preference (FR-REC-05 is out of scope here — packet 11/FR-LIB owns it). The agent declared a **type-only** `Catalog` with just `findWorkouts(tier, count)` and supplied a deterministic double, exactly as packet 08 declared `WearableAdapter` before its implementer existed. **Decide:** confirm the minimal port does not box in **packet 11**, which owns the full catalog signature. Kept small deliberately so the frozen tests do not pin a shape packet 11 must be free to widen.

### Escalation 3 — 17b needs a sanctioned way to persist a `source: 'SYSTEM'` task

`TaskRepository.createTask` (packet 12) hardcodes `source: 'USER'`; there is **no** repository path today that persists a SYSTEM task, which FR-REC-04 requires. The agent did **not** touch `server/src/db/` (must-not-touch). The suite reads the created task from the scheduler's *result*, so it does not depend on a repository method that does not yet exist. **Decide (a 17b concern, flagged now so it is not discovered mid-GREEN):** 17b needs either a new creation path or a `source` parameter — **and it must not become a second placement path** (FR-RSC-03). This is Miguel's module boundary (`server/src/db/`), so 17b touching it is a cross-owner change worth a heads-up.

### Escalation 4 — a genuine §6 ↔ FR-RSC-09 contradiction

**§6's demonstration prose** chains: *"declare the re-placed session **skipped** … then mark it complete and observe the System **withdraw** its own reschedule."* **But FR-RSC-09** — and its v2.14 scope note (E6) — restrict the complete-to-withdraw remedy to the **MISSED** classification: *"Completing an occurrence that a skip or a displacement moved is ordinary completion … and needs no withdrawal."* Read literally, §6's step 5 (a completion after step 4's **skip**) would withdraw **nothing** (`cancelled: null`).

The agent resolved the **test** by exercising the withdrawal against a **MISSED** reschedule (a miss inferred by advancing the clock past the window — FR-RSC-10's own verification condition), the only trigger FR-RSC-09 covers, and flagged the tension in-test. **A human must decide:** either **(a)** confirm the live demonstration's final step is shown on a **miss** (the skip and the withdrawal are two separate illustrations, not one chain), and optionally amend §6's prose so the narrative is executable; or **(b)** state a different reading. *As written, the two sentences of §6 cannot both be executed on the same occurrence in one chain, and the demo script (17b's rehearsals) needs this settled.*

### Escalation 5 — OPEN-22 case 2 does not route through the 17b stub, and is already GREEN

This is the **most important thing for the gate.** OPEN-22/OPEN-24 need no recommendation — they exercise a plain flexible task through the real `RescheduleService.sweepElapsed`. Verified against the real stack:

| Test | Result | Why |
|---|---|---|
| **OPEN-22(1) / OPEN-24** — no history → no trigger **and** honest reason | 🔴 **FAILS** (at the reason assertion) | The trigger-absence half already passes; the **reason** half is a real RED — `reattemptReason` stores *"…no room for it earlier today"* on a first-ever placement, which is false. **17b fixes the wording** (OPEN-24). |
| **OPEN-22(2)** — a `MISSED` row → re-attempt records `MISSED` | 🟢 **PASSES** | `sweepElapsed` + `triggerFromHistory` already read the row's trigger (packet 07/12, the OPEN-21 fix). |
| **OPEN-22(2)** — a `SKIPPED` row → re-attempt records `SKIPPED` | 🟢 **PASSES** | Same. |

The two green tests are **regression guards**: they pin the OPEN-21 fix (SRS v2.20) so it cannot silently revert — which is *exactly* what OPEN-22 asks for (*"Until then this is a regression window: nothing would fail if the default came back"*). They were derived from **v2.20's binding text**, not from reading the implementation.

**A human must decide:** may a RED freeze contain an **already-green regression guard**? Three options —
1. **Keep them in 17a's frozen suite** *(the agent's and orchestrator's recommendation)*. OPEN-22 is assigned to *"packet 17a's RED gate"* by the SRS/decision log; 17a's clean-room is the correct author (packet 06 could not reach the case — before packet 12 nothing could hand the service a task with no placement history); and freezing a satisfied requirement to stop it regressing is a legitimate use of the freeze, whose stated purpose is *"the requirements in executable form."* **This makes "a RED freeze may include a green regression guard" a decision worth a `docs/TEAM-MEETING.md` row (§0).**
2. **Move case 2 to packet 06's reschedule surface** — heavier: it re-freezes `c30e784` (a second-human team decision) to add a case packet 06's clean-room could not construct.
3. **Drop them** — reopens the exact regression window OPEN-22 exists to close.

---

## EXACT vs PROPERTY assertions — and why each is which

The suite asserts **exact numbers only where the SRS pins them**, and **properties traced to an FR ID everywhere else** — because a frozen test that hardcodes an unpinned minute becomes an accidental specification (§0.1) and forces a re-freeze when 17b legitimately chooses differently.

| Assertion | Kind | Source |
|---|---|---|
| intensity tier `LOW` | EXACT | FR-REC-01 (40 ≤ 49 → LOW) |
| calorie target `2850` | EXACT | FR-REC-08 (2000 + 850) |
| reasons name `40` / `850`, `usedFallback: false` | EXACT | FR-REC-13 |
| recovery placed **17:00–18:00**; after a **17:00–17:45** commitment → **17:45–18:45** | EXACT | **Appendix A** (the test reproduces Appendix A's busy set so the number is the SRS's, not the test's) |
| task is SYSTEM / WORKOUT / LOW | PROPERTY | FR-REC-04, FR-TSK-01 |
| a `PLANNED` placement exists, within the day | PROPERTY | FR-REC-02, FR-SCH-01 |
| three LOW options, own placed by default | PROPERTY | FR-REC-03 |
| moved **in place** — same row, `PLANNED`, `DISPLACED`, no successor | PROPERTY | FR-RSC-02 note (v2.14) |
| skip: original stays `SKIPPED`, a **distinct** `PLANNED` successor | PROPERTY | FR-RSC-08 |
| complete: successor `CANCELLED`, interval freed, statement non-empty | PROPERTY | FR-RSC-09 |
| first placement: **no** `rescheduleTrigger`; reason does **not** claim a failed earlier attempt | PROPERTY (negative) | OPEN-22(1)/DR-06; OPEN-24/DR-03/FR-DSH-05 |

**OPEN-24 is asserted as a *negative* property** (`not /no room/i`, `not /earlier today/i`) rather than an exact replacement sentence — so 17b is free to word the honest reason however it likes. Pinning a positive sentence would freeze prose that is 17b's to write.

---

## What the gate should look at hardest

In priority order (`AGENTIC-TDD-WORKFLOW.md` §6):

1. **Escalation 5 — the two green OPEN-22(2) tests.** This is the only place the suite is not all-red, and the freeze-convention question (*may a RED freeze hold a green regression guard?*) is a genuine method decision that outlives this packet. **Decide it, and record it (§0).** Nothing else in the freeze depends on the choice.
2. **Escalation 1 — the `RecommendationScheduler` name.** Ratify into §3.6 **before** freezing; a more-than-trivial rename after the freeze costs a re-freeze. Confirm the dedicated-collaborator reading over folding the method onto the frozen-suite-bearing `RecommendationEngine`.
3. **Escalation 4 — the §6/FR-RSC-09 contradiction.** Confirm the withdrawal is demonstrated on a **miss**, not chained off the skip — or the demo's final step proves nothing on 31 July. Consider an SRS §6 prose amendment.
4. **The FR-REC-04 centerpiece test** (`recommendation-to-calendar.test.ts`, *"a fixed commitment dropped on the recommended recovery session re-places it via the same engine, 17:00–18:00 → 17:45"*). It is the load-bearing requirement in one assertion. **Check that 17:00 → 17:45 comes from the reproduced Appendix A busy set (the SRS), not from any engine reading — and that requiring the replaced HIGH placement to be gone is the intended FR-REC-02 "replace," not an over-constraint.** ⚠️ Note the **one design assumption** the test bakes in: the recovery session inherits the replaced run's **17:00–18:00 window and 60-min duration**, which is what makes 17:00 the placement. FR-REC-02 says "replace … and place using the engine" but does not *explicitly* say the replacement keeps the slot — if the gate disagrees that replacement preserves the window, this assertion must change **before** freezing.
5. **Escalation 3 — the SYSTEM-task creation gap.** Verify 17b has a sanctioned path to persist `source: 'SYSTEM'` that is not a second placement function, and that Miguel is aware `server/src/db/` may be touched.
6. **Clock discipline.** Confirm no `Date.now()` anywhere (the miss in step 5 is produced by `clock.advanceTo(...)`, matching FR-RSC-10's *"clock advanced past the window"*), and that the harness reads no ambient time.

---

## After the gate (do NOT do these until a second human has held the gate)

- [ ] **Adjudicate escalations 1 and 4 into the SRS** (the `RecommendationScheduler`/`Catalog` naming into §3.6; the §6/FR-RSC-09 reading into §6), with revision-history rows and cross-references (§0 rule 3). **Escalation 5's convention** goes in `docs/TEAM-MEETING.md`'s decision log.
- [ ] **Freeze:** `npm run freeze -- --packet 17a --path server/test/acceptance --tests 8`, then confirm `npm run guard:tests-frozen` is green for the new entry. *(One directory, harness + fixtures included — the E3 rule, 25 Jul.)*
- [ ] **Freeze commit** — the test files plus the throwing `RecommendationScheduler`, **nothing else** (`CLAUDE.md` §8.3), with these escalations in the body. **Only when Patrick asks** (§8.5).
- [ ] Post **8** to the team as 17b's target — but note **2 are already green** (they protect, they do not drive) and **1 is a reschedule-module fix**, not wiring. **17b's real work is the 5 spine tests + OPEN-24's honest reason.**

## ⚠️ One thing the gate must not be misled by

**This suite is not "5 fail at the stub, done."** Its shape is deliberately mixed: **5 spine tests** are RED at the wiring stub (17b's core job); **OPEN-24** is RED at an assertion against *existing* code (17b changes `reattemptReason`/`sweepElapsed`, a different module); **OPEN-22(2)** is GREEN and stays green (a regression guard). A reviewer who expects a uniform all-red RED freeze will read the two green tests as a defect — they are not; they are Escalation 5, and the gate's job is to rule on them, not to make them red.
