# CRITICAL REQUIREMENTS — 17d: Wire the Recommendation Path Into the Running System

### MANDATORY DIRECTIVE ###

You are an expert TypeScript/Node engineer. **CRITICAL**: The wearable → recommendation → task chain **already exists and is already tested.** Your job is to make it **reachable from the running application.** You are wiring and exposing; you are **not** designing recommendation behaviour, and you are **not** writing a second placement function.

| | |
|---|---|
| **Phase** | **INTEGRATION** — composition root + the transport surface §6's demonstration needs |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 08 (adapter + `MetricStore`), 10 (`RecommendationEngine` + both rules), 11 (`WorkoutCatalog`/`MealCatalog`), 12 (the Express app), 17a/17b/17c (`RecommendationScheduler`) — **all merged to `dev` and green** |
| **Spec** | `docs/SRS-v2.md` §6 (the demonstration sequence), §3.8.6 (FR-WER-07, FR-WER-10), §3.8.7 (FR-REC-01/02/03/04/08/13), §3.8.11 (FR-LIB-02) · `CLAUDE.md` §5, §4.3 |
| **Closes** | **OPEN-30** (the path is unreachable), **OPEN-28** (the two `Catalog` interfaces) |

---

## ⛔ **CRITICAL**: WHY THIS PACKET EXISTS

**MANDATORY**: Read this before anything else.

**Every piece of the System's central claim is built, and none of it can be run.**

`server/src/index.ts` — the production entrypoint — wires `UserStore`, `TaskRepository`, `SystemClock`, `RescheduleService` and `AuthService`. **It wires nothing else.** `MetricStore`, `GarminExportAdapter`, `RecommendationEngine`, `SleepToIntensityRule`, `CaloriesToTargetRule`, `WorkoutCatalog`, `MealCatalog` and `RecommendationScheduler` are **constructed nowhere outside tests**, and `server/src/api/app.ts`'s seventeen routes are auth, tasks and schedule — **there is no metric route and no recommendation route.**

**So the System's claim is currently demonstrable only inside `server/test/acceptance/`.** SRS §6 does not ask for that. It asks for this:

> *Inject a sleep score of **40** and **850** active calories for today. **Observe** the scheduled high-intensity run replaced by a recovery session, and the day's calorie target rise from 2,000 to 2,850. **Observe** the recovery session placed by the same engine…*

**"Observe" means on the running System, in front of a room, on 31 July.**

> **CRITICAL**: This packet is the last thing standing between **FR-REC-04 — the load-bearing requirement (`CLAUDE.md` §5)** — and its demonstration. FR-WER-07, FR-WER-10 and §6 all rest on it too. **If the schedule forces a cut, cut anything else first.**

**MANDATORY**: The behaviour is **already specified and already frozen.** `server/test/acceptance/` (frozen `8809158`) and `server/test/replacement/` (frozen `47bb301`) pin what `RecommendationScheduler` does. ⛔ **You are not re-deciding any of it.** If you find yourself writing a rule, a tier comparison, a slot search, or a replacement policy, **stop — that code exists and you are duplicating it.**

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`.

- **FR-WER-07.** *(Essential, D)* The System shall provide a means of **injecting a specified value for any metric on a specified date**, for demonstrating and testing adaptive behavior without requiring the operator to actually sleep poorly or run a marathon. *(See UC-12. This depends on no network, no device, and no third party, and it is what makes the System's central claim demonstrable on 31 July.)*

- **FR-REC-04.** *(Essential, T)* A recommended workout shall be **created as a task and placed by the same engine**, subject to the same conflict detection and rescheduling as any user-created task.

- **FR-REC-13.** *(Essential, D)* Every recommendation shall be accompanied by **the reason it was made, naming the metric and value.** Where made under a fallback, the reason shall say so.

- **FR-LIB-02.** *(Essential, I)* **No component of the recommendation path shall make an external network call.** Recommendation generation shall depend on nothing beyond the System's own database.

- **FR-RSC-03.** *(Essential, I)* Automatic rescheduling shall use **the identical engine** of FR-SCH — not a second, parallel implementation. **Exactly one function in the codebase produces placements.**

### **CRITICAL**: Explicitly Out Of Scope

- ⛔ **Any change to recommendation BEHAVIOUR** — the rules, the tier mapping, the calorie arithmetic, the replacement policy, the reason text. All frozen-tested. **Wiring only.**
- ⛔ **A second placement function.** `RecommendationScheduler` already re-invokes the injected engine. `npm run guard:single-placement` must stay green.
- ⛔ **The `.ics` export, the month navigator, priority displacement, a live wearable API** — untouched.
- ⛔ **`shared/src/contract.ts`** — a team decision, never an agent's refactor (§4.7). **If you believe you need a contract change, STOP and escalate.**
- **Packet 16b's guards** — a separate packet. You do not write guards here. ⚠️ **But your code will be scanned by them**, so see the FR-LIB-02 constraint below.

---

## **MANDATORY**: What To Build

### 1. `server/src/recommendation/WorkoutSource.ts` — the `Catalog` reconciliation (OPEN-28)

**CRITICAL**: Two different interfaces are currently both named `Catalog`:

| Where | Signature | Who satisfies it |
|---|---|---|
| `server/src/recommendation/RecommendationScheduler.ts` | `findWorkouts(tier, count): readonly Workout[]` | the frozen acceptance double |
| `server/src/catalog/Catalog.ts` (packet 11) | `findWorkouts(tier, prefs, n): CatalogResult<Workout>`, `findMeals(...)` | the real `WorkoutCatalog` |

⛔ **MANDATORY — do NOT "replace" the narrow port with packet 11's, which is what OPEN-28 originally proposed. It cannot be done.** `server/test/acceptance/support/harness.ts` — **frozen at `8809158`** — does `import type { Catalog } from '../../../src/recommendation/RecommendationScheduler'` and implements the two-argument form. **Widening that interface breaks the frozen suite at compile time**, which §8.3 forbids and `guard:tests-frozen` catches. *(This constraint was discovered on 27 Jul and OPEN-28 was corrected; the packet is the authority, not the original issue text.)*

**Build instead:**

- **Rename** the narrow port to **`WorkoutSource`**, and keep **`export type Catalog = WorkoutSource`** as an alias so the frozen harness's import still resolves. ✅ **The alias is required, not optional** — deleting it reddens a frozen suite.
- **A small adapter** — roughly fifteen lines — mapping packet 11's `Catalog` to `WorkoutSource`: pass the default `WorkoutPreferences` (i.e. `{}`, no equipment restriction — FR-LIB-05's default set), call `findWorkouts(tier, prefs, n)`, return `result.items`.
- ⚠️ **MANDATORY — do not silently discard `CatalogResult.relaxed` / `satisfiable`.** FR-LIB-08 requires the catalog to *report* what it relaxed. The narrow port has nowhere to put that, so **the adapter must at minimum log it, and your report must state plainly that the relaxation report is not currently surfaced to the user.** *(An honest gap recorded beats a requirement quietly dropped at a type boundary.)*

### 2. `server/src/index.ts` — the composition root

**MANDATORY**: Construct and wire, in the production entrypoint, everything the chain needs:

- `MetricStore` (+ `ensureIndexes()`, as `UserStore` already does)
- `RecommendationEngine`, with **both** rules registered — `SleepToIntensityRule` and `CaloriesToTargetRule`
- `WorkoutCatalog` and `MealCatalog` (the seeded libraries — read from disk, never fetched)
- the `WorkoutSource` adapter over the real `WorkoutCatalog`
- `RecommendationScheduler`, with the **same** `findCandidateSlots` and the **same** `RescheduleService` instance the app already uses

⚠️ **CRITICAL — `CaloriesToTargetRule` takes the user's baseline calorie target as constructor state** (FR-REC-09; **CON-05/§4.9: the System asks, it never estimates**). **A per-user rule instance cannot be a process-level singleton.** Decide where the engine is built — per request, per user, or a factory — **and say why in your report.** ⛔ **Do not hard-code a baseline**, and ⛔ **do not derive one from height/weight/BMR.** If no baseline is stored for the user, **escalate rather than invent a default.**

### 3. `server/src/api/app.ts` — three routes, all `requireAuth`

Match the file's existing idiom exactly — validation, error shape, ownership at the repository boundary.

| Route | Requirement | What it does |
|---|---|---|
| `POST /metrics` | **FR-WER-07** | Inject a value for a named metric on a date, for the authenticated user. Delegates to `MetricStore.ingest`. **This is the demonstration's first step and it exists nowhere today.** |
| `GET /recommendations?date=` | FR-REC-01, FR-REC-08, FR-REC-13 | The day's recommendations with their reasons, via `RecommendationScheduler.recommendationsFor`. |
| `POST /recommendations/apply-workout` | **FR-REC-02, FR-REC-03, FR-REC-04** | Applies the workout recommendation for a date — the replacement, the `SYSTEM` task, the engine placement. Returns the frozen `WorkoutRecommendationResult` shape. |

- ⚠️ **`POST /metrics` writes a metric the System will treat as real.** It is the injection path FR-WER-07 requires, so it is **not** a debug backdoor — but it must be **authenticated and scoped to the caller**, exactly like every other route.
- **MANDATORY — respect DR-02 / NFR-ROB-01**: a metric may be injected as **unavailable**, and **a measured `0` is not the same as absent.** The route must be able to express both, and must not coerce one into the other.
- ⛔ **Do not invent response shapes.** `WorkoutRecommendationResult` and `Recommendation` already exist. Serialize them; do not reshape them.

### 4. Tests — transport only

**MANDATORY**: `supertest` route tests in a **new, unfrozen** directory, following packet 12's pattern: auth required, ownership enforced, validation rejected, success shape correct, and **one end-to-end route test that injects a poor sleep score and asserts a `SYSTEM` `WORKOUT` task comes back placed** (§6's spine, through HTTP).

> ⚠️ **CRITICAL — why one agent may write these tests and this code, when §4.6 normally forbids it.** **The behaviour these routes expose is already pinned clean-room** by the frozen `server/test/acceptance/` (17a) and `server/test/replacement/` (17c) suites, written before any wiring existed. **What you are adding is composition and transport**, and packet 12 set the precedent for transport tests inside the same packet. ⛔ **This exemption is narrow and does not travel**: if you find yourself asserting *what the recommendation should be* rather than *that the route returns it*, you are writing a behaviour test for code you just wrote — **stop, and leave that assertion to the frozen suite that already makes it.**

---

## ⚠️ **CRITICAL**: WHAT THIS PACKET DOES **NOT** FINISH — SAY SO IN YOUR REPORT

**MANDATORY**: §6's demonstration has two observable halves, and **this packet delivers one of them.**

- ✅ *"Observe the high-intensity run replaced by a recovery session… placed by the same engine"* — the resulting `SYSTEM` task is an ordinary task with an ordinary placement, so **the existing dashboard renders it with no frontend change.**
- ⛔ *"Observe the day's calorie target rise from 2,000 to 2,850"* — **there is no wellness view on `dev`.** It is Ryan's packet 14b, on the unmerged `origin/wp-14a-wellness-backend`. **This packet does not build one and must not**: `web/` is another owner's module (§7.2), and duplicating a view that already exists unmerged is the worst of both. **State this dependency plainly in your report — §6 cannot be run end to end until `wp-14a` merges.**
- ⚠️ **Triggering the recommendation from the UI is likewise not in scope.** The demonstration can be driven by `curl` against the running server with the dashboard open beside it. **If you believe a UI trigger is required, escalate — do not add one to `web/`.**

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/recommendation/WorkoutSource.ts` *(new — the renamed port, the `Catalog` alias, the adapter)*
- `server/src/recommendation/RecommendationScheduler.ts` — **only** the port's rename/import. ⛔ **No change to any method body.**
- `server/src/index.ts` — the composition root
- `server/src/api/app.ts` — the three routes and their wiring
- `server/test/api/` *(new or existing, unfrozen)* — transport tests
- `docs/P17D-REPORT.md` *(new)*

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ Every frozen test directory** — `engine/test` (`ac06e70`), `server/test/reschedule` (`c30e784`), `server/test/wearable` (`1199d80`), `server/test/recommendation` (`59f4e8a`), `server/test/catalog` (`4b1fd4e`), `server/test/acceptance` (`8809158`), `server/test/replacement` (`47bb301`). `guard:tests-frozen` re-hashes all seven.
- **⛔ `scripts/frozen-tests.json`** — read it; never edit it.
- **⛔ `shared/src/contract.ts`** (§4.7) · **⛔ `engine/src/**`** (pure, frozen-tested, and none of its business)
- **⛔ `server/src/recommendation/{RecommendationEngine,RecommendationRule,SleepToIntensityRule,CaloriesToTargetRule}.ts`** and **⛔ `server/src/catalog/**`** — **behaviour, all frozen-tested. You are wiring them, not editing them.**
- **⛔ `web/**`** — Miguel's and Ryan's. See the section above.
- `docs/SRS-v2.md`, `prompts/**` *(other than your own report)*

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] **⛔ CRITICAL — the §6 sequence has been RUN AGAINST THE RUNNING SERVER and the transcript is in the report.** Start the server, register a user, create a high-intensity workout for today, `POST /metrics` a sleep score of **40**, `GET /recommendations`, `POST /recommendations/apply-workout`, then `GET /schedule` — **and show the recovery session present, the above-tier run gone, and the reason naming the metric and value.** *(A passing test suite is not this. §6 says "observe.")*
- [ ] **The replacement survives a second `GET /schedule`** — the OPEN-27 / FR-RSC-06 idempotency case, now through HTTP. **Two retrievals, same result.**
- [ ] **`npm run verify` passes**, all seven freeze entries intact, engine still at 100%.
- [ ] **`npm run guard:single-placement` green** — you introduced no second placement function (FR-RSC-03).
- [ ] **`npm run lint` and `npm run typecheck`**: zero errors *(NFR-MNT-04)*.
- [ ] **FR-LIB-02 holds in the code you wrote**: no `fetch`, no `http`/`https`, no HTTP client in the recommendation path. *(Packet 16b's guard will enforce this; do not be the reason it fires.)*
- [ ] **The frozen acceptance and replacement suites still compile and pass** — proof the `Catalog` alias did its job.
- [ ] **`docs/P17D-REPORT.md`** records: the §6 transcript; where the per-user `RecommendationEngine` is built and why; **that `CatalogResult.relaxed`/`satisfiable` is not surfaced to the user**; **that §6's calorie half needs `wp-14a` merged**; and every escalation.
- [ ] **⛔ Do not commit.** The commit is the human owner's assertion that they read the diff *(§8.5)*.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report — do not work around it — if:**

- **The user has no stored calorie baseline** and `CaloriesToTargetRule` cannot be constructed. ⛔ **Do not invent a default and do not estimate one** (CON-05, §4.9 — the System asks). Report what is missing and where it would come from. *(⚠️ The capture may live on `wp-14a`'s UC-01 profile work, unmerged — say so rather than building a second one.)*
- **Wiring the real catalog requires changing `RecommendationScheduler`'s behaviour**, not just its port type. That means the frozen suite and the real catalog disagree about something substantive — **the highest-value finding this packet can produce.**
- **Anything you need would edit a frozen suite or the contract.**
- **The §6 run does not produce what §6 says it produces.** ⛔ **Do not adjust the demonstration to match the System.** Report the divergence exactly.

> **MANDATORY**: **An escalation is a success.** A packet that reports everything green **without a §6 transcript in the report** has not demonstrated the thing this packet exists for.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when a person at a keyboard can inject a bad night's sleep into the running System and watch the calendar change — with no test runner involved.**

**CRITICAL**: Everything needed for that already exists and is tested. **This packet is the wiring, the three routes, and the honest report of what still is not reachable.** If you are writing recommendation logic, you have misread the packet.

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it.
