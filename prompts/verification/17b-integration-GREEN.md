# CRITICAL REQUIREMENTS — 17b The FR-REC-04 Wiring (🟢 GREEN)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript/Node engineer. **CRITICAL**: Make the **already-frozen** packet 17a acceptance suite pass by writing **only** implementation, in **only** the files listed. You **may not edit, skip, rename, or weaken a single test or fixture** — not to fix a typo, not to correct an assertion you believe is wrong. If you believe a test is wrong, **STOP and escalate** (§4.6).

| | |
|---|---|
| **Phase** | 🟢 GREEN (implementation only) |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | **17a RED (frozen at `8809158`)** — the 8-test acceptance suite you implement against. Also 05 (engine), 07 (`RescheduleService`), 10 (`RecommendationEngine` + the two rules), 12 (`TaskRepository`, `MetricStore`). |
| **Spec** | `docs/SRS-v2.md` **§6**, **Appendix A**, **Appendix D**, §3.8.7 (FR-REC), §3.8.5 (FR-RSC), §3.6 (class diagram), DR-03, DR-06 · `CLAUDE.md` **§5**, §4.3 |

> **The suite is frozen. It is the specification in executable form.** `npm run guard:tests-frozen` fails the build if any file under `server/test/acceptance/` changes. Your job is to make **8 tests green — 6 of them red at the `Error('17b')` stub — without touching one of them.**

---

## ⛔ **CRITICAL**: WHY THIS PACKET EXISTS — READ BEFORE ANYTHING ELSE

You are writing the wiring for **FR-REC-04**, which `CLAUDE.md` §5 names *the load-bearing requirement of the project*:

> **FR-REC-04.** *(Essential, T)* A recommended workout or meal shall be created as a **task** (FR-TSK-01) and placed by the **engine** (FR-SCH). It shall be subject to conflict detection and automatic rescheduling **identically to a user-created task.** Verified by adding a conflicting commitment over a recommended workout and asserting it is re-placed by FR-RSC-02.

**This is what makes the project one integrated system rather than a scheduler and a fitness app sharing a login.** If everything else shipped and this did not, the project would have failed at its own thesis while appearing complete.

> ### ⛔ **The single most important sentence in this packet**
>
> **"Identically to a user-created task" is satisfied by the ABSENCE of code, not by a branch.**
>
> You are not writing a defence for the recommended workout. You are writing a placement that lands in the **same store** `RescheduleService` already reads, so the **existing** re-placement path picks it up with no knowledge that it came from a recommendation. **If you find yourself writing `if (task.source === 'SYSTEM')` anywhere in a rescheduling path, you have misread the requirement** — that branch is the thing FR-REC-04 exists to forbid.

---

## **MANDATORY**: Requirements In Scope

> Quoted **VERBATIM** from `docs/SRS-v2.md`. The frozen tests pin each; the requirement text is why.

- **FR-REC-02.** *(D)* Where a workout is scheduled at a tier **above** what the day's sleep score warrants, the System shall automatically replace it with one at the warranted tier and **place the replacement using the scheduling engine.**
- **FR-REC-03.** *(D)* The System shall **not silently override the user.** For any workout slot it shall offer **three** options at the warranted tier, drawn from the library (FR-LIB-05); its own choice is placed by default, and the user may select either other and have the slot re-placed.
- **FR-REC-07.** *(Essential, T)* The System shall not reduce the intensity of a workout already marked complete, and shall not replace one whose window has already begun. A workout that was missed or declared skipped and **re-placed into a window that has not yet begun remains eligible** for adjustment.
- **FR-REC-13.** *(D)* Every recommendation shall be accompanied by **the reason it was made, naming the metric and value.** Where made under a fallback, the reason shall say so.
- **FR-SCH-01.** *(T)* Given busy intervals and a task, the engine shall determine whether the task's preferred window contains a free interval ≥ its duration, and if so return a placement within that window.
- **FR-RSC-03.** *(I)* Automatic rescheduling shall use **the identical engine** of FR-SCH — not a second, parallel implementation.
- **FR-RSC-05** *(the re-attempt provenance clause, v2.20)*: *"It shall record a trigger only where the stored schedule holds evidence of one, and shall record none otherwise… Where there is no such row the placement carries no trigger at all, per DR-06 — 'absent means it has never been rescheduled.'"*
- **DR-03.** A placement records **why it is where it is** — and a stored reason must be **true**.
- **DR-06.** History is retained: an occurrence is **retired**, never overwritten. An **absent** `rescheduleTrigger` means the occurrence has never been rescheduled.

### **CRITICAL**: Explicitly Out Of Scope — do not build these here

- ⛔ **HTTP routes.** No `POST /recommendations/apply-workout`, no `GET /recommendations`, no metric route, no composition in `index.ts`. **All of that is packet 17d.** This packet makes an offline acceptance suite green; nothing in it is reachable over HTTP yet, and that is correct.
- ⛔ **The real workout library.** Packet **11** owns it. You consume the **`Catalog` port type 17a declared** and the suite's own double. **Do not widen the port, and do not rename it** — packet 17d renames it to `WorkoutSource` and keeps `Catalog` as a **required** alias, and a frozen suite imports that exact name.
- ⛔ **Making the replacement durable across a sweep.** See the **Known limitation** section below. That is **packet 17c**, deliberately, and `SUPERSEDED` **does not exist in the contract yet** at this point in the sequence — 17c transcribes that amendment. **Do not invent it here.**
- ⛔ **FR-WER-08/10** (the real Garmin export) — (D) on real data, Ryan's, and separate.
- ⛔ **Editing the contract, the frozen suite, or `scripts/frozen-tests.json`.**

---

## **MANDATORY**: The Contract

**CRITICAL**: Import every domain type from `@capstone/shared` — `Task`, `Placement`, `PlacementResult`, `Recommendation`, `Decision`, `RecommendationReason`, `CalorieTarget`, `DailyMetricSet`, `IntensityTier`, `TaskSource`. You **may not redefine, extend, widen, or shadow** any of them.

**⛔ STOP** if you believe the contract is missing something. *Before you conclude that:* `Task.source` (`'USER' | 'SYSTEM'`), `Task.intensityTier`, `Recommendation`, `Decision` and `RecommendationReason` **already exist for exactly this wiring** (§4.7).

---

## **MANDATORY**: What To Build

`server/src/recommendation/RecommendationScheduler.ts` exists from 17a as **signatures with throwing bodies**. Implement them. **The surface, the `Catalog` port and the constructor ports are 17a's and are settled — do not reshape them.**

### `recommendationsFor(userId, date)` — the read half

Read the date's `DailyMetricSet` from `MetricStore` and hand it to the **content-agnostic** `RecommendationEngine`. **Availability, fallback and the FR-REC-13 reason are packet 10's job, already frozen and green** — this method reads and delegates, and decides nothing. *(§6 step 1: sleep 40 → LOW, 850 active calories → target 2850, each reason naming its own metric and value.)*

### `applyWorkoutRecommendation(userId, date)` — the load-bearing half

Six steps. **Each is a read, a create, or a delegation — none of them decides where a task goes.**

1. **Warranted tier + reason** — from the `WORKOUT_INTENSITY` recommendation. It is always defined: when sleep is unavailable the rule falls back to `MODERATE` (FR-REC-06), so there is no "no tier" case to handle.

2. **Find the above-tier workout to replace** (FR-REC-02) — the first `PLANNED` occurrence on the date whose task is a `WORKOUT` at a **strictly higher** tier, subject to **FR-REC-07's two guardrails**: never one already `COMPLETED`, never one **whose window has begun**. This is a read and a comparison; it chooses nothing.

   > ### ⚠️ **"Whose window has begun" is a question about the OCCURRENCE'S OWN DAY, not about the clock's time of day**
   >
   > A `Minute` in this contract is **minutes since local midnight and carries no calendar** (§4.7). So `placement.start <= clock.nowMinute()` **asks a different question** — *"is this earlier in some day than the current time of day"* — and is wrong in **both** directions: a **future** date's workout reads as already begun once the wall clock passes its start minute, and a **past** date's workout reads as still upcoming whenever the clock has not yet reached its start minute, letting a closed day's history be rewritten.
   >
   > **Judge `date` against `clock.today()` first**: a date strictly before today has begun **unconditionally**; a date strictly after today has **not** begun at all; the minute comparison survives **only** for `date === today`. *(SRS **v2.41**, which corrected exactly this. `RescheduleService` carries the mirror-image `hasElapsed` for the same reason — OPEN-35. **Neither the frozen acceptance suite nor any other frozen suite covers this**, because they all apply the recommendation to the clock's own date, which is the one configuration where the bug is invisible.)*

3. **Three options at the warranted tier** from the injected `Catalog` (FR-REC-03). The System's own choice is `options[0]` and is what gets placed by default.

4. **Create the recommendation AS A TASK** (FR-REC-04, FR-TSK-01) — `source: 'SYSTEM'`, `type: 'WORKOUT'`, at the warranted tier, **`FLEXIBLE`**, inheriting the replaced run's preferred window and duration. **This step is the requirement**: it is a task in the same store as every other task, not a recommendation object with a time attached.

5. **Vacate the replaced occurrence** — mark it **`CANCELLED`**; **do not delete it** (DR-06 — an occurrence is retired, never overwritten). `CANCELLED` is not in `OCCUPIES_TIME`, so the interval is freed for the recovery session.

6. **Place it by the engine** (FR-SCH-01, **FR-RSC-03**) — call the **injected** `findCandidateSlots` with the busy set, the derived task and the schedulable day, and use the **rank-1 slot verbatim**. Persist an ordinary `PLANNED` placement with **no `rescheduleTrigger`** — a first placement is not a reschedule (DR-06).

> ### ⛔ **FR-RSC-03: you may not compute a placement**
>
> This class **must not** find a free gap, merge intervals, rank candidates, or compute a start time. Where the task goes is the engine's answer, used verbatim — the same discipline `RescheduleService.askEngine` already holds. `npm run guard:single-placement` enforces it and will fail on re-implementation vocabulary. **If placing the recovery session seems to need "just a little" interval arithmetic here, that is the bug FR-RSC-03 exists to catch — escalate rather than write it.**

### OPEN-24 — the honest-reason fix *(a reschedule-module change, not wiring)*

One frozen test fails at an assertion against **existing** code rather than at the stub. `sweepElapsed`'s re-attempt branch stores a reason claiming *"…your day had no room for it earlier today"* on a task's **first-ever** placement — which is **false**: nothing was tried and failed earlier. **DR-03 requires a stored reason to be true**, and **DR-06** says an absent trigger means never rescheduled.

**Fix**: choose the re-attempt branch's reason on whether the store holds **any** row for that task.
- **No rows** — a brand-new task's first placement, or one whose `PLANNED` row was hard-deleted and whose provenance is genuinely lost → a plain, true sentence claiming **no** earlier attempt.
- **Rows present** — a `MISSED` occurrence whose own re-placement found no room → the existing wording, where *"no room earlier today"* is accurate.

⚠️ **The frozen 17a test asserts the NEGATIVE — that the reason does not claim a failed earlier attempt — and deliberately does not pin a replacement sentence.** Word it as you see fit; do not try to match a string. **This is a *reason* decision, never a placement one** — the engine still decides where the task goes.

### The `TaskRepository` escalation

Creating a `SYSTEM` task needs `TaskRepository.createTask` to accept a source. Add it as an **optional parameter defaulting to `'USER'`**, so no existing caller changes.

> ⚠️ **Cross-owner change — `server/src/db/` is Miguel's module** (§7.2). It stores a task and **computes no placement**, so FR-RSC-03 is untouched. `RecommendationScheduler` is its only caller passing `'SYSTEM'`. **Record it in your report and flag it to Miguel.**

---

## ⚠️ **MANDATORY**: The known limitation you must REPORT and must NOT fix

Vacating the replaced workout as `CANCELLED` leaves that task with **no `PLANNED` placement** — and `sweepElapsed`'s re-attempt branch re-places **any** task with no `PLANNED` placement (FR-RSC-05). **So the replaced run comes back on the next retrieval: the replacement does not stick.**

**This is expected here and is packet 17c's subject.** The frozen 17a suite does not exercise it (its step-5 assertions are all on the recovery task's own rows). The clean fix needs a durable per-occurrence "set aside" the domain does not model yet, and inventing one now would fight the contract.

- ✅ **Report it** in `docs/P17B-GREEN-REPORT.md` as a limitation you found, with the mechanism.
- ⛔ **Do not fix it**, do not add a status to the contract, and **do not** repurpose `awaitingChoice` (that is UC-03's).

> **A GREEN packet that notices a real defect outside its scope and says so is doing its job.** Silently working around it — or silently leaving it unmentioned — is how a demo-blocking bug reaches a rehearsal.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/recommendation/RecommendationScheduler.ts` *(the wiring — the throwing bodies)*
- `server/src/db/TaskRepository.ts` *(the optional `source` parameter — additive)*
- `server/src/reschedule/RescheduleService.ts` **and** its reason helper *(OPEN-24 only)*
- `docs/P17B-GREEN-REPORT.md` *(new)*

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ `server/test/acceptance/**`** — the frozen suite (`8809158`), harness included. Not one character.
- **⛔ Every other frozen suite** — `engine/test/**`, `server/test/reschedule/**`, `server/test/wearable/**`, `server/test/recommendation/**`, `server/test/catalog/**`.
- **⛔ `scripts/frozen-tests.json`** — **re-running `npm run freeze` to go green is editing the test one level removed (§8.3, §4.12(b)).**
- **⛔ `shared/src/contract.ts`** (§4.7) · **⛔ `engine/**`** (FR-SCH-05 purity; `guard:engine-purity` enforces it) · `server/src/api/**` · `web/**` · `docs/SRS-v2.md`.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] `npx jest server/test/acceptance`: **8 of 8 pass** (was 6 failed / 2 passed at RED). No test was changed to achieve this.
- [ ] **`npm run guard:tests-frozen` passes** — `P17a … unchanged`, and every other entry unchanged. Non-negotiable.
- [ ] **`git diff --stat 8809158 -- server/test/acceptance/` is EMPTY.**
- [ ] **`npm run guard:single-placement` passes** — still exactly one `findCandidateSlots`, in `engine/src`. The new engine call **re-invokes** it; it does not re-implement it (FR-RSC-03).
- [ ] **`npm run guard:engine-purity` passes** — the engine is untouched.
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*.
- [ ] `npm run verify` is **green end to end** — RED + GREEN together on this branch (§8.5), so it is ready to merge to `dev`.
- [ ] **The diff is `src` files only. Zero test files.** If a test file appears in `git status`, the packet is compromised — stop.
- [ ] Report at `docs/P17B-GREEN-REPORT.md`: how each 17a escalation was resolved, the `createTask` cross-owner note, **the known limitation above**, and — honestly — that this is verified by the offline acceptance suite and **not** in a browser or against a running server, which is 17d's.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to Patrick — do not work around it — if:**

- You **cannot make a test pass and believe the test is wrong.** A human adjudicates it against the SRS. **Do not edit it.**
- A test appears to contradict the SRS, the contract, or another test. Say which two, and how.
- Making a test pass would require touching a **must-NOT-touch** file, or adding to the contract.
- **Placing the recovery session seems to require computing a slot, a gap, or a start time here.** That is FR-RSC-03 being violated, and it is a design smell to report, not to code around.
- **You feel the need to special-case a `SYSTEM` task in a rescheduling path.** Report it — that branch is precisely what FR-REC-04 forbids, and needing it means something upstream is wrong.
- You believe the replaced-workout durability problem must be fixed *now* to make a frozen test pass. Say which test — that would mean 17c's scope is misassigned.

> An escalation is a **success.** Note that 17a's escalations were adjudicated at the RED gate and ratified into SRS §3.6 at v2.27 — so a clean GREEN is plausible here, unlike a RED run. **The `createTask` source parameter and the durability limitation are both expected findings, not surprises.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: This packet's single pass condition — **the 8 frozen packet-17a acceptance tests are green; a recommended workout exists on the real calendar as a `SYSTEM` task placed by the one engine; a fixed commitment dropped on it is re-placed by the existing `RescheduleService` with no special-casing; `guard:tests-frozen` and `guard:single-placement` pass; `npm run verify` is green; and not one test or manifest entry changed.**

**CRITICAL**: Where this prompt and a frozen test disagree, **the test wins and this prompt is a defect** — report it, do not reconcile it by editing the test. Where this prompt and `docs/SRS-v2.md` disagree, the SRS wins.

*(House-style techniques — Sandwich Method, Attention Anchoring, Visual Emphasis, Clear Delimiters, Selective Context — as in packets 05 / 07 / 10 / 17a.)*
