# CRITICAL REQUIREMENTS — 17a Acceptance Suite (RED): FR-REC-04 and the §6 Demonstration

### MANDATORY DIRECTIVE ###

You are an expert TypeScript/Node engineer writing an **acceptance test suite**. **CRITICAL**: You write **tests only**, plus the single throwing surface those tests call into. You do **not** write the wiring that makes them pass — that is packet **17b**, a **different session**. Your suite must **fail**, and it must fail because the wiring **throws**, never because an assertion is wrong.

| | |
|---|---|
| **Phase** | 🔴 **RED** — the acceptance suite, frozen before the code it verifies exists |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 05 (engine), 07 (reschedule service), 10 (recommendation rules + engine), 12 (backend/persistence) — **all merged to `dev`** |
| **Spec** | `docs/SRS-v2.md` **§6** (Verification Approach + the demonstration sequence), **Appendix D** (acceptance), §3.8.7 (FR-REC), §3.8.5 (FR-RSC), §3.8.6 (FR-WER), §3.8.4 (FR-SCH), **Appendix A** (the worked example), §3.6 (class diagram) · `CLAUDE.md` §5 (FR-REC-04), §4.3, §4.6 · `docs/AGENTIC-TDD-WORKFLOW.md` §1 |

---

## ⛔ **CRITICAL**: WHY THIS PACKET EXISTS — READ BEFORE ANYTHING ELSE

This suite pins **FR-REC-04**, which `CLAUDE.md` §5 names *the load-bearing requirement of the project* — the one §2.7.1 *"would rather lose everything else than lose."* It is what makes this **one integrated system** rather than a scheduler and a fitness app sharing a login.

> **FR-REC-04 is verified by TEST, and its test is frozen HERE — not by whoever writes the wiring in 17b.**

**This is the entire reason 17a and 17b are two packets.** If the session that writes the recommendation→task→placement wiring also writes the test that says the wiring works, the test encodes **what the wiring does**, not **what the requirement says** (`AGENTIC-TDD-WORKFLOW.md` §1.1, §2.1). It goes green on 31 July and proves only that the code agrees with itself — on the one requirement the project cannot afford to get wrong. **The RED/GREEN split is the fix, and this packet is the RED half.**

**CRITICAL**: You are the clean-room author. **Derive every assertion from `docs/SRS-v2.md`** — the §6 demonstration sequence, Appendix A's worked numbers, and the requirement text quoted below. **Do not read the bodies of `server/src/reschedule/RescheduleService.ts`, `server/src/api/app.ts`, `server/src/recommendation/RecommendationEngine.ts`, or `engine/src/**` to decide what a test should expect.** Their behaviour is not the oracle; the SRS is. You may import and construct these components through their **public exports** (see *What To Build*), but an expected value that came from reading an implementation is a poisoned assertion (§2.1) and voids this packet.

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`. Do not paraphrase — the phrasing is the obligation.

### The load-bearing one

- **FR-REC-04.** *(Essential, T)* A recommended workout or meal shall be created as a **task** (FR-TSK-01) and placed by the **engine** (FR-SCH). It shall be subject to conflict detection and automatic rescheduling **identically to a user-created task.** Verified by adding a conflicting commitment over a recommended workout and asserting it is re-placed by FR-RSC-02.

### The demonstration sequence (§6), which this suite executes end to end, offline

> Inject a sleep score of **40** and **850** active calories for today. Observe the scheduled high-intensity run replaced by a recovery session, and the day's calorie target rise from 2,000 to 2,850. Observe the recovery session placed onto the **real calendar by the same engine that places everything else**. Then drop a fixed commitment on top of it, and observe it **automatically re-placed**, with the reason stated to the user in plain language. **Then declare the re-placed session skipped, and observe it move again — the same engine, a different trigger. Finally, mark it complete and observe the System withdraw its own reschedule.**

The steps above exercise, **together**: FR-WER-07, FR-REC-01, FR-REC-02, FR-REC-03, FR-REC-04, FR-REC-08, FR-REC-13, FR-SCH-01, FR-SCH-02, FR-RSC-02, FR-RSC-08, FR-RSC-09, FR-DSH-05, FR-DSH-07.

The supporting requirement text (all Essential unless marked):

- **FR-WER-07.** *(D)* The System shall provide a means of **injecting a specified value for any metric on a specified date**, for demonstrating and testing adaptive behavior without requiring the operator to actually sleep poorly or run a marathon.
- **FR-REC-01.** *(T)* map sleep score to recommended **intensity tier**: 0–49 → **LOW**, 50–74 → MODERATE, 75–100 → HIGH.
- **FR-REC-02.** *(D)* Where a workout is scheduled at a tier **above** what the day's sleep score warrants, the System shall automatically replace it with one at the warranted tier and **place the replacement using the scheduling engine.**
- **FR-REC-03.** *(D)* The System shall **not silently override the user.** For any workout slot it shall offer **three** options at the warranted tier, drawn from the library (FR-LIB-05); its own choice is placed by default, and the user may select either other and have the slot re-placed.
- **FR-REC-08.** *(T)* compute a **daily calorie target** as the baseline target **plus the active calories** recorded for that date… presented as a **current, not final** figure.
- **FR-REC-13.** *(D)* Every recommendation shall be accompanied by **the reason it was made, naming the metric and value** — e.g. *"Recovery session — your sleep score was 42 last night."* Where made under a fallback, the reason shall say so.
- **FR-SCH-01.** *(T)* Given busy intervals and a task, the engine shall determine whether the task's preferred window contains a free interval ≥ its duration, and if so return a placement within that window.
- **FR-SCH-02.** *(T)* If the preferred window has no room, search the remainder of the day and return up to three ranked candidates; a candidate's start is the fitting position **closest to the preferred window**, earliest breaking ties.
- **FR-RSC-02.** *(T)* When a new fixed commitment overlaps an already-placed flexible task, the System shall automatically invoke the engine to re-place that task, and shall **not** move the commitment. *(Displaced occurrence is moved **in place**: same row, status stays `PLANNED`, `rescheduleTrigger` = `DISPLACED`, no successor.)*
- **FR-RSC-08.** *(T)* allow a user to declare a placed, incomplete, flexible occurrence **skipped**, and thereupon classify it skipped and invoke the engine exactly as FR-RSC-01 does. **Accepted before the window elapses**, not only after. *(Keeps the original row `SKIPPED`; creates a new successor.)*
- **FR-RSC-09.** *(T)* Where an occurrence was automatically rescheduled under FR-RSC-01 and the user subsequently marks **the original occurrence** complete, the System shall **cancel the reschedule**, withdraw the later placement, **free the interval it held**, record the occurrence as completed, and state that it has done so.
- **FR-DSH-05.** *(D)* Where the System placed or moved a task, **state the reason in plain language** — e.g. *"Moved to 4:00 PM — your 2:00 PM slot was taken by CS 401 Lecture."*
- **FR-DSH-07.** *(D)* Allow the user to declare an occurrence skipped (FR-RSC-08) and to overturn an automatic reschedule by marking the original complete (FR-RSC-09).
- **FR-RSC-03.** *(I)* Automatic rescheduling shall use **the identical engine** of FR-SCH — not a second, parallel implementation.

### Two regression-window cases the SRS specifies but no frozen test yet pins (OPEN-22 / OPEN-24)

**MANDATORY**: These are yours by assignment (`docs/TEAM-MEETING.md`, OPEN-22 and OPEN-24, 24 Jul). They live in the reschedule module, and §4.6 bars the session that wrote that module from testing it; packet 06's suite is frozen. **Your clean-room RED gate is where they land.** The behaviour fix for OPEN-24 is 17b's; its test is frozen here.

- **FR-RSC-05** (re-attempt provenance, the part added **v2.20**): *"It shall record a trigger only where the stored schedule holds evidence of one, and shall record none otherwise… Where there is no such row the placement carries no trigger at all, per DR-06 — 'absent means it has never been rescheduled.'"* **Two cases (OPEN-22):**
  1. A task with **no placement history** re-attempted / first-placed carries **no `rescheduleTrigger`** at all.
  2. A re-attempt that **does** descend from a `MISSED` or `SKIPPED` row **still records that trigger**.
- **OPEN-24** — the *sentence* stored for case (1). `reattemptReason`'s wording *"…your day had no room for it earlier today"* is **false for a first-ever placement**: nothing was tried and failed earlier. The honest-sentence obligation traces to **DR-03** (*a placement records why it is where it is*) and FR-DSH-05 (*plain language, true*). **Pin that a first-ever placement's stored `placementReason` does NOT claim the day "had no room for it earlier today"** (or any equivalent false history-of-failure), because there was none. **Do not pin an exact replacement sentence** — that would freeze prose 17b must be free to word — pin the *property*: the reason must not assert a failed earlier attempt that did not happen. *(This is a genuine seam where the SRS gives an obligation but not a string: assert the negative, and escalate if you believe a positive assertion is required.)*

### **CRITICAL**: Explicitly Out Of Scope — write no test for these here

- **FR-REC-03's "three options" and FR-LIB-05's tier coverage** as a *library* claim — the real **Catalog / workout library is packet 11 (FR-LIB), not yet merged.** You must **not** depend on a real library existing. Where your scenario needs a concrete workout at a tier, obtain it through a **`Catalog` test double** you inject (see *What To Build*). You **may** assert FR-REC-03's *shape* against that double (the recommendation offers three warranted-tier options, its own placed by default) — but you are testing the **wiring's use of the Catalog seam**, never a seeded library.
- **FR-WER-08 / FR-WER-10** (real Garmin export driving a real recommendation) — those are **(D)/demonstration** on the real export, shown in 17b rehearsals, not a unit assertion. Your suite uses the **injection path (FR-WER-07)**, which is exactly what §6 specifies for the demonstration.
- **FR-SCH-07/08** (priority displacement, Conditional), **FR-REC-10/12** (Conditional), **FR-WER-11** (live API) — `CLAUDE.md` §6.
- **The engine's own boundary matrix (FR-SCH-09), the reschedule triggers in isolation (packet 06), the rules in isolation (packet 09), persistence (packet 12).** They are **already frozen and green.** This suite is **integration/acceptance**: it asserts the pieces work **together** through the FR-REC-04 seam. Re-testing a frozen unit here duplicates a suite and adds a second thing to maintain.

---

## **MANDATORY**: The Contract

**CRITICAL**: You **import** every domain type from `@capstone/shared` (`shared/src/contract.ts`): `Task`, `Placement`, `PlacementResult`, `Recommendation`, `Decision`, `CalorieTarget`, `RecommendationReason`, `DailyMetricSet`, `Metric`, `IntensityTier`, `TaskSource`, etc. You **may not redefine, extend, widen, or shadow** any of them.

**⛔ STOP**: If you believe the contract is missing something FR-REC-04 needs — **do not add it.** Report it (§4.7: a team decision with a decision-log row, not an agent's edit). *Note before you conclude that: `Task.source` (`'USER' | 'SYSTEM'`), `Task.intensityTier`, `Recommendation`, `Decision` and `RecommendationReason` already exist for exactly this wiring.*

---

## **MANDATORY**: What To Build

You produce **one non-test file** (the throwing surface) and the **test suite + its harness**, all under **one dedicated directory** so the freeze fingerprints the whole thing (`docs/TEAM-MEETING.md`, 25 Jul, E3): **`server/test/acceptance/`**.

### 1. The wiring surface — throwing stubs only (`server/src/recommendation/RecommendationScheduler.ts`)

**CRITICAL**: This is the FR-REC-04 seam. It realizes §3.6's two deferred edges — **`RecommendationEngine --> SchedulingEngine : places via`** and **`RecommendationEngine --> Catalog : draws from`** — which packet 10 explicitly left to packet 17 (see the class comment in `RecommendationEngine.ts`). Declare its **types and method signatures**; **every method body is `throw new Error('17b')`** and nothing else. This is exactly how packet 06 declared `RescheduleService` and packet 08 declared `WearableAdapter` and `MetricStore` — a surface, not an implementation.

- **⚠️ NAME/SHAPE IS AN ESCALATION, NOT A SETTLED FACT.** `RecommendationScheduler` is the packet author's proposal, grounded in §3.6's "places via" edge. §3.6 attaches that edge to `RecommendationEngine` itself; packet 10 deferred it. **You must state, in `docs/P17A-RED-REPORT.md`, whether you kept a dedicated collaborator or believe §3.6 requires the method to live on `RecommendationEngine`** — and escalate the name for ratification into §3.6 at the gate, exactly as packet 06's ports were drafted by the RED packet and ratified at v2.14 (E9). Whatever you choose, the frozen tests must not depend on a name the gate might change more than trivially — **keep the surface small and its obligations, not its identifiers, load-bearing.**
- **What it must be told (constructor ports), so it can ADD nothing of its own:** the **one engine** (`FindCandidateSlots` from `@capstone/engine` — injected, never re-implemented: FR-RSC-03), the `RescheduleService` (so a placed recommendation is defended *identically to a user task*), a `Catalog` port (the seam to the library — declare it as a **type**, like `WearableAdapter`; the real one is packet 11), the `TaskRepository`, and the `Clock`. **⛔ It may not find a free gap, merge intervals, choose among candidates, or compute a start time (§4.3).** Where a task goes is the engine's answer, used verbatim — the same discipline `RescheduleService` and `app.ts` already hold.
- **What it must do (stated as obligations, for you to encode as *assertions*, NOT to implement):**
  - Turn a warranted-tier workout **`Recommendation`** into a **`Task`** with `source: 'SYSTEM'`, `type: 'WORKOUT'`, and the `intensityTier` from the `Decision` (FR-REC-04, FR-TSK-01), the concrete workout drawn from the injected `Catalog` at the warranted tier (FR-REC-03).
  - **Place it via the engine** (FR-SCH-01/02) and persist the `Placement` — so it appears on the real calendar (FR-REC-02) and is thereafter defended by `RescheduleService` with no special-casing (FR-REC-04, the identically-to-a-user-task clause).
  - **FR-REC-02 replacement:** where a **higher-tier** workout is already placed for the date, replace it with the warranted-tier one, placed by the engine. **FR-REC-07's guardrails hold** (do not reduce a completed workout; do not replace one whose window has begun) — assert them.
  - Carry FR-REC-13's reason (naming the metric and value) through to what the user reads.
- **A `Catalog` port** (interface) sufficient for the above — minimally *"give me N workouts at tier T"* (§3.6: `findWorkouts(tier, prefs, n) → Workout[]`). **Type only.** Your harness supplies a deterministic double; packet 11 supplies the real one.

### 2. The acceptance suite (`server/test/acceptance/*.test.ts`) + harness (`server/test/acceptance/support/`)

**CRITICAL**: Construct the **real stack in memory** — `mongodb-memory-server`, the **real** `findCandidateSlots`, `RescheduleService`, `RecommendationEngine` + the two real rules, `MetricStore`, `TaskRepository`, `UserStore`, a `TestableClock` you advance by hand — plus the **throwing** `RecommendationScheduler` and your **`Catalog` double**. No stub anywhere near a placement decision (FR-RSC-03). Follow the harness idiom of `server/test/reschedule/support/harness.ts` and `server/test/support/testApp.ts` — **read those two for construction patterns and the clock discipline (never `Date.now()`); do not read the service/app bodies for expected values.**

**The one end-to-end scenario (grounded in Appendix A + §6 — this is the spine of the suite):**

Schedulable day **07:00–23:00**, baseline calorie target **2000**. Inject **sleepScore 40** and **activeCalories 850** for the demo date (FR-WER-07). Then assert, step by step:

1. **Recommendation (FR-REC-01/08/13):** the rules yield **intensity tier `LOW`** (40 ≤ 49) and **calorie target `2850`** (2000 + 850); the workout reason **names sleep score 40**, the calorie reason **names 850**. *(These are exact — the SRS pins them.)*
2. **Replacement + placement (FR-REC-02/03/04, FR-SCH-01):** a **HIGH-intensity** workout scheduled for the date is **replaced** by a **LOW recovery session**, created as a `SYSTEM`/`WORKOUT` task and **placed by the engine** onto the calendar (a real `Placement` exists, `status: 'PLANNED'`). The recovery session offers **three** LOW options, its own placed by default (FR-REC-03).
3. **Displacement (FR-REC-04's own verification clause, FR-RSC-02, FR-DSH-05):** drop a **fixed commitment overlapping** the recovery session; it is **automatically re-placed by the same engine** — moved **in place** (same row, `PLANNED`, `rescheduleTrigger: 'DISPLACED'`, no successor), not overlapping the commitment (FR-SCH-04), within the day, and its stored `placementReason` **names the commitment** in plain language (FR-DSH-05). **This is the assertion FR-REC-04 names explicitly — make it unmistakable and cite FR-REC-04 in the test name.** *Where Appendix A pins a number (commitment 17:00–17:45 over a 17:00–18:00 session → re-placed 17:45), assert it exactly; otherwise assert the properties above.*
4. **Skip → move again (FR-RSC-08, same engine different trigger):** declare the re-placed session **skipped**; it moves again, the **original row stays `SKIPPED`**, a **new successor** is `PLANNED` with a distinguishable reason — demonstrating the same engine serving a **user-initiated** trigger (the §6 point about FR-RSC-03).
5. **Complete → withdrawal (FR-RSC-09):** mark the **original** occurrence complete; the automatic reschedule is **withdrawn** (successor → `CANCELLED`, its interval freed), the occurrence recorded completed, and a statement says so.

**MANDATORY — assert exact where the SRS pins, assert properties (traced to an FR ID) elsewhere.** The SRS pins: tier `LOW`, target `2850`, Appendix A's 17:00 / 17:45. It does **not** pin every minute of steps 4–5 — for those, assert the **structural** facts the requirements name (which row is which status, which trigger, non-overlap, interval freed), each test naming the requirement it verifies. A suite that hardcodes an unpinned minute will be wrong and will force a re-freeze.

**The two OPEN-22 cases and OPEN-24**, as their own tests (they need no recommendation — a plain flexible task exercises them):
- A flexible task with **no placement history**, placed on retrieval, has **no `rescheduleTrigger`** (OPEN-22 case 1) **and** a stored reason that does **not** falsely claim a failed earlier attempt (OPEN-24).
- A task whose stored history holds a **`MISSED`** (and, separately, a **`SKIPPED`**) row, re-attempted, **records that trigger** (OPEN-22 case 2).

### **CRITICAL**: Every test name cites its requirement ID

e.g. `it('FR-REC-04: a fixed commitment dropped on a recommended workout re-places it via the same engine (FR-RSC-02)', …)`. This is Appendix B as running evidence — a grader reads the output.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/recommendation/RecommendationScheduler.ts` *(new — the throwing surface + `Catalog` port type. Bodies throw. Nothing computes a placement.)*
- `server/test/acceptance/**` *(new — the suite and its harness/fixtures, all under this one directory)*
- `docs/P17A-RED-REPORT.md` *(new — see Definition of Done)*
- `prompts/00-prompt-collection-summary.md` — **only** to flip 17a's status marker from *"Not yet written"* to authored. Nothing else.

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ Every frozen suite** — `engine/test/**` (`ac06e70`), `server/test/reschedule/**` (`c30e784`), `server/test/wearable/**` (`1199d80`), `server/test/recommendation/**` (`59f4e8a`). `guard:tests-frozen` compares the working tree against each and will catch an edit even if committed.
- **⛔ `scripts/frozen-tests.json`** — read it; the gate writes it via `npm run freeze`, never you.
- **⛔ `shared/src/contract.ts`** — the contract (§4.7).
- **⛔ Any implementation body** — `server/src/reschedule/**`, `server/src/api/**`, `server/src/recommendation/RecommendationEngine.ts` / the two rules, `engine/src/**`, `server/src/db/**`, `server/src/wearable/**`. **You add the throwing `RecommendationScheduler` and nothing else in `src/`.** Making a test pass by editing one of these is 17b's work, in a different session.
- `web/**`, `docs/SRS-v2.md`, other `prompts/**`.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] **Every test in the suite FAILS, and every failure's cause is the thrown `Error('17b')`** from `RecommendationScheduler` — not a wrong expectation, not a compile error, not a missing import. **Verify this mechanically** (run the suite, confirm every `●` failure traces to the stub) and record it in the report, the way `docs/P06-RED-REPORT.md` did (`sort | uniq -c` on the failure messages).
- [ ] The OPEN-22/OPEN-24 tests **also** fail only at the stub. *(If they can be satisfied without the wiring — i.e. by the existing `sweepElapsed` alone — say so and escalate: they may belong against a different surface. The SRS assigns them here; verify the assignment holds.)*
- [ ] `npm run typecheck` and `npm run lint` pass with **zero** errors *(NFR-MNT-04)* — a RED suite still compiles and lints; only its assertions fail.
- [ ] **No frozen file changed:** `npm run guard:tests-frozen` green for all four packets; `git status` shows only your new files (+ the one summary-marker line).
- [ ] **Nothing in `server/src/` computes a placement except by calling the injected engine.** Your `RecommendationScheduler` throws; it does not search, rank, or merge. Confirm `npm run guard:single-placement` and `npm run guard:engine-purity` still pass.
- [ ] **`docs/P17A-RED-REPORT.md`** records: the surface you declared and **why that shape** (with the §3.6 naming escalation); every escalation; the must-fail transcript; the exact SRS-pinned numbers vs. the property assertions and why each is which; and **what the gate should look at hardest** (in the style of P06's list).
- [ ] **⛔ Do not commit, and do not run `npm run freeze`.** The freeze is the **gate's** step and needs a **second human** (`AGENTIC-TDD-WORKFLOW.md` §6, §4.6) — Patrick authors, so Miguel or Ryan gates. **Nobody freezes their own suite.**

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to the human owner — do not work around it — if:**

- **§3.6 does not settle where the "places via" wiring lives** (a method on `RecommendationEngine`, or a dedicated collaborator). **Propose, encode against your proposal, and escalate the name** — do not silently invent architecture the SRS has not ratified (the exact trap `CLAUDE.md` §9 records: a draft that invented `Rule`/`ruleRegistry` was caught and realigned to §3.6).
- **The SRS is silent on a value your scenario needs** (a duration, a `now`, an unpinned start time). **Assert a property traced to a requirement instead of inventing a number**, and note it. **Do not invent a rule and encode it** — that is how a frozen test becomes an accidental specification (§0.1).
- **Two requirements in scope appear to contradict** each other. Say which, and how.
- **The OPEN-22/OPEN-24 cases turn out to be satisfiable without the 17b wiring** (e.g. by `sweepElapsed` as it stands). Then either the case does not fail at the stub, or it belongs against a different surface — say which.
- Satisfying anything here would require touching a file on the **must NOT touch** list, or adding to the contract.

> **MANDATORY**: An escalation is a **success**. **A packet that finishes with zero escalations on a specification this integrative — spanning the engine, the reschedule service, the recommendation engine, persistence, and a library seam that does not exist yet — is the outcome to be suspicious of.** Packet 06 raised fourteen. Expect several here, most of them about the wiring surface and the Catalog seam.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when `server/test/acceptance/` is a suite that executes the §6 demonstration sequence end to end and FAILS entirely at a throwing `RecommendationScheduler` — with FR-REC-04's own verification clause (a commitment dropped on a recommended workout re-places it via FR-RSC-02) as its centerpiece, and OPEN-22/OPEN-24 pinned — while every frozen suite stays green and nothing in `src/` computes a placement but the one engine.**

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it — an agent that silently resolves a contradiction has made a requirements decision nobody agreed to.
