# CRITICAL REQUIREMENTS — 17d: Wire the Recommendation Path Into the Running System

### MANDATORY DIRECTIVE ###

You are an expert TypeScript/Node engineer. **CRITICAL**: The wearable → recommendation → task chain **already exists and is already tested.** Your job is to make it **reachable from the running application.** You are wiring and exposing; you are **not** designing recommendation behaviour, and you are **not** writing a second placement function.

| | |
|---|---|
| **Phase** | **INTEGRATION** — the apply-workout path §6's demonstration needs |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 08 (adapter + `MetricStore`), 10 (`RecommendationEngine` + both rules), 11 (`WorkoutCatalog`/`MealCatalog`), 12 (the Express app), 17a/17b/17c (`RecommendationScheduler`) — all merged to `dev` and green — **and ⛔ packet 14a, which MUST be merged to `dev` before this packet runs (see below)** |
| **Spec** | `docs/SRS-v2.md` §6 (the demonstration sequence), §3.8.6 (FR-WER-07, FR-WER-10), §3.8.7 (FR-REC-01/02/03/04/08/13), §3.8.11 (FR-LIB-02) · `CLAUDE.md` §5, §4.3 |
| **Closes** | **OPEN-30** (the path is unreachable), **OPEN-28** (the two `Catalog` interfaces) |

> ## ⛔ **RESCOPED 27 Jul — READ THIS BEFORE THE REST OF THE PACKET**
>
> **This packet was authored against `dev`, and roughly half of what it specified already exists on `origin/wp-14a-wellness-backend`** (Ryan's packet 14a, unmerged when this was written). **That was verified by reading the branch, not by assuming.** The overlapping work has been **cut from this packet**, which is now materially smaller:
>
> | Originally specified here | Actually already on `wp-14a` | Now |
> |---|---|---|
> | `POST /metrics` (FR-WER-07 injection) | **`POST /wearable/metrics`** — authenticated, scoped to the caller, takes a whole `DailyMetricSet`, delegates to `MetricStore.ingest` | ⛔ **CUT — use the existing route** |
> | `GET /recommendations` (FR-REC-01/08/13 read side) | **`GET /wellness`** — returns the tier, FR-REC-13's reason, FR-REC-03's three options, the calorie target and the meal plan | ⛔ **CUT — use the existing route** |
> | Composition root: `MetricStore` + `ensureIndexes()`, `WorkoutCatalog`, `MealCatalog`, a composed `Catalog` | **All already wired in `server/src/index.ts`** | ⛔ **CUT — extend, do not rebuild** |
> | *"the baseline capture **may** live on `wp-14a`"* (an open guess in the escalation clause) | **It does** — `user.baselineCalories` and `user.dietaryPreferences` are captured and validated at registration (FR-REC-09 / UC-01) | ✅ **RESOLVED — that escalation cannot fire** |
> | *"decide where the per-user engine is built and say why"* (posed as an open question) | **Answered, correctly: per request, from the loaded user** — `CaloriesToTargetRule` needs *this* user's baseline, so it is never a boot-time constant | ✅ **FOLLOW THE EXISTING PATTERN** |
>
> **What remains is this packet's real and unique content, and it is the load-bearing part:** the **`WorkoutSource` port + `Catalog` alias + adapter** (OPEN-28), wiring **`RecommendationScheduler`** — which nothing constructs on any branch — the **`POST /recommendations/apply-workout`** route, and **the §6 transcript**. `GET /wellness` **reads**; nothing anywhere **applies**, and applying is where FR-REC-02/03/04 live.
>
> ⛔ **HARD DEPENDENCY: `wp-14a` must be merged to `dev` before this packet is run.** Both branches edit `server/src/index.ts` and `server/src/api/app.ts`; running this first guarantees a conflict in exactly the two files that are hardest to merge safely. **If `wp-14a` is not on `dev`, STOP and say so — do not build the cut routes "temporarily".**

---

## ⛔ **CRITICAL**: WHY THIS PACKET EXISTS

**MANDATORY**: Read this before anything else.

**Every piece of the System's central claim is built, and none of it can be run.**

**On `dev` as this was written**, `server/src/index.ts` — the production entrypoint — wired `UserStore`, `TaskRepository`, `SystemClock`, `RescheduleService` and `AuthService` and **nothing else**, and `app.ts`'s seventeen routes were auth, tasks and schedule alone.

⚠️ **`wp-14a` closes part of that** — it wires `MetricStore` and both catalogs and adds `POST /wearable/metrics` and `GET /wellness`. **But one thing is true on `dev`, on `wp-14a`, on `wp-15`, and on every other branch:**

> ### ⛔ **`grep -rn "new RecommendationScheduler" server/src` returns NOTHING.**

**`RecommendationScheduler` — the class that holds FR-REC-02, FR-REC-03 and FR-REC-04 — is constructed nowhere outside tests, and no route reaches it.** `GET /wellness` deliberately does not call it (its comment says so explicitly: opening a tab must never mutate the schedule — and that call is correct). **So the System can currently show you what it recommends and cannot act on it.** `GarminExportAdapter` is likewise called from nowhere (**OPEN-33**, a separate packet — not yours).

**So the System's claim is currently demonstrable only inside `server/test/acceptance/`.** SRS §6 does not ask for that. It asks for this:

> *Inject a sleep score of **40** and **850** active calories for today. **Observe** the scheduled high-intensity run replaced by a recovery session, and the day's calorie target rise from 2,000 to 2,850. **Observe** the recovery session placed by the same engine…*

**"Observe" means on the running System, in front of a room, on 31 July.**

> **CRITICAL**: This packet is the last thing standing between **FR-REC-04 — the load-bearing requirement (`CLAUDE.md` §5)** — and its demonstration. FR-WER-07, FR-WER-10 and §6 all rest on it too. **If the schedule forces a cut, cut anything else first.**

**MANDATORY**: The behaviour is **already specified and already frozen.** `server/test/acceptance/` (frozen `8809158`) and `server/test/replacement/` (frozen `47bb301`) pin what `RecommendationScheduler` does. ⛔ **You are not re-deciding any of it.** If you find yourself writing a rule, a tier comparison, a slot search, or a replacement policy, **stop — that code exists and you are duplicating it.**

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`.

- **FR-WER-07.** *(Essential, D)* The System shall provide a means of **injecting a specified value for any metric on a specified date**, for demonstrating and testing adaptive behavior without requiring the operator to actually sleep poorly or run a marathon. *(See UC-12. This depends on no network, no device, and no third party, and it is what makes the System's central claim demonstrable on 31 July.)*

  > ✅ **DELIVERED by packet 14a's `POST /wearable/metrics` — you do not build this.** It is listed because **your §6 transcript is what demonstrates it (D)**: until someone injects a metric into the running System and shows the effect, FR-WER-07 has a route and no demonstration. ⚠️ **FR-WER-07 is the *injection* means and is deliberately synthetic. It does NOT satisfy FR-WER-08/09/10, which need the real export ingested — that is OPEN-33 and a separate packet.**

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
- ⚠️ **MANDATORY — do not silently discard `CatalogResult.relaxed` / `satisfiable`.** FR-LIB-08 requires the catalog to *report* what it relaxed, and the narrow port has nowhere to put it — so **the adapter must at minimum log it, and your report must state what is and is not surfaced.**

  > ⚠️ **The gap is NARROWER than this packet first claimed — corrected 27 Jul after reading `wp-14a`.** The original text said the relaxation report *"is not currently surfaced to the user"* **full stop, and that is not true.** `GET /wellness` on `wp-14a` **already surfaces `relaxed` AND `satisfiable` for every meal slot**, and **`satisfiable` for the workout block.** ⛔ **Do not build a second surfacing mechanism — it exists.** **What is genuinely missing is only:** `relaxed` on the **workout** side of `GET /wellness`, and both fields through **your** apply-workout path, where the narrow `WorkoutSource` port cannot carry them. ⛔ **The `/wellness` side is Ryan's file and NOT yours to edit** — record it, do not fix it. *(An honest gap recorded beats a requirement quietly dropped at a type boundary — but a gap reported wider than it is costs someone a day rebuilding what already works.)*

### 2. `server/src/index.ts` — EXTEND the composition root

⛔ **`MetricStore` (+ `ensureIndexes()`), `WorkoutCatalog`, `MealCatalog` and the composed `Catalog` are ALREADY wired here by packet 14a. Do not rebuild them, do not re-order them, do not "tidy" them.** You are adding one thing:

- **`RecommendationScheduler`**, constructed with the **same** `findCandidateSlots`, the **same** `RescheduleService`, the **same** `TaskRepository`, `MetricStore` and clock the app already uses, plus a `RecommendationEngine` and the `WorkoutSource` adapter over the **existing** `WorkoutCatalog`.

> ### ⚠️ **CRITICAL — `RecommendationScheduler` CANNOT be a process-level singleton, and this is the one real design decision in this packet.**
>
> Its constructor takes a `RecommendationEngine`, and that engine must have `CaloriesToTargetRule(user.baselineCalories)` registered — **per-user state** (FR-REC-09; **CON-05/§4.9: the System asks, it never estimates**). A scheduler built once at boot would bake one user's baseline into every user's recommendations.
>
> ✅ **The pattern is already established on `wp-14a`, and you follow it:** `GET /wellness` loads the user, then builds the engine **per request** from `user.baselineCalories`. Do the same — **a factory in `index.ts` that takes the loaded user and returns a `RecommendationScheduler`** is the shape to aim for, so `app.ts` does not acquire knowledge of which rules exist.
>
> ⛔ **Do not hard-code a baseline. Do not derive one from height/weight/BMR.** If a user has no stored baseline, **escalate** — but note that `wp-14a` captures and validates it at registration, so in practice this should not fire.
>
> ⚠️ **Naming collision, and it will bite you:** `index.ts` already imports `Catalog` from `./catalog/Catalog`, and your `WorkoutSource.ts` also exports a `Catalog` alias. **Import one under an alias.** Do not resolve it by deleting the alias — a frozen suite depends on it.

### 3. `server/src/api/app.ts` — ONE route, `requireAuth`

Match the file's existing idiom exactly — validation, error shape, ownership at the repository boundary.

| Route | Requirement | What it does |
|---|---|---|
| `POST /recommendations/apply-workout` | **FR-REC-02, FR-REC-03, FR-REC-04** | Applies the workout recommendation for a date — the replacement, the `SYSTEM` task, the engine placement. Returns the frozen `WorkoutRecommendationResult` shape. |

⛔ **The other two routes this packet used to specify are CUT — `wp-14a` has them.** See the rescope table at the top.

- **`POST /wearable/metrics`** is FR-WER-07's injection path. **Use it in your §6 transcript; do not add a second one.** ⚠️ **Read it before you assume its shape** — it takes a whole `DailyMetricSet`, not a single named metric.
- **`GET /wellness`** is the read side (tier, FR-REC-13's reason, FR-REC-03's options, the calorie target). **Use it to observe.** ⛔ **Do not add `GET /recommendations`** — `RecommendationScheduler.recommendationsFor` would return the same decisions `GET /wellness` already serves, and a second read surface for one fact is exactly the divergence OPEN-28 was about.
- ⚠️ **If you find `GET /wellness` genuinely cannot show what §6 asks you to observe, that is an escalation, not a licence to add a route.** Report what is missing.
- ⛔ **Do not invent response shapes.** `WorkoutRecommendationResult` already exists and is frozen-tested. Serialize it; do not reshape it.
- ⚠️ **`apply-workout` MUTATES the schedule** — it places a task. `GET /wellness` deliberately does not, and its comment says why. **Keep that separation intact:** the read surface must stay read-only.

### 4. Tests — transport only

**MANDATORY**: `supertest` route tests in `server/test/api/` (existing, **unfrozen**), following packet 12's pattern: auth required, ownership enforced, validation rejected, success shape correct, and **one end-to-end route test that injects a poor sleep score via `POST /wearable/metrics` and asserts a `SYSTEM` `WORKOUT` task comes back placed** (§6's spine, through HTTP).

⚠️ **`wp-14a` already has `server/test/api/wellness.test.ts` covering the two routes you are reusing. Do not duplicate its coverage** — your tests are for `apply-workout` and the composition.

> ⚠️ **CRITICAL — why one agent may write these tests and this code, when §4.6 normally forbids it.** **The behaviour these routes expose is already pinned clean-room** by the frozen `server/test/acceptance/` (17a) and `server/test/replacement/` (17c) suites, written before any wiring existed. **What you are adding is composition and transport**, and packet 12 set the precedent for transport tests inside the same packet. ⛔ **This exemption is narrow and does not travel**: if you find yourself asserting *what the recommendation should be* rather than *that the route returns it*, you are writing a behaviour test for code you just wrote — **stop, and leave that assertion to the frozen suite that already makes it.**

---

## ⚠️ **CRITICAL**: WHAT THIS PACKET DOES **NOT** FINISH — SAY SO IN YOUR REPORT

**MANDATORY**: §6's demonstration has two observable halves, and **this packet delivers one of them.**

- ✅ *"Observe the high-intensity run replaced by a recovery session… placed by the same engine"* — the resulting `SYSTEM` task is an ordinary task with an ordinary placement, so **the existing dashboard renders it with no frontend change.**
- ✅ *"Observe the day's calorie target rise from 2,000 to 2,850"* — **`GET /wellness` serves this**, and once `wp-14a` is merged (which this packet now requires) the wellness **view** renders it too. ⚠️ **You still do not build or edit any of it** — `web/` is another owner's module (§7.2). **Observe through the existing route and, if the view is running, beside it.**
- ⚠️ **If `wp-14a` has NOT merged, this packet does not run at all** — see the hard dependency at the top. **Do not build the calorie half yourself to work around it.**
- ⚠️ **Triggering the recommendation from the UI is likewise not in scope.** The demonstration can be driven by `curl` against the running server with the dashboard open beside it. **If you believe a UI trigger is required, escalate — do not add one to `web/`.**

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/recommendation/WorkoutSource.ts` *(new — the renamed port, the `Catalog` alias, the adapter)*
- `server/src/recommendation/RecommendationScheduler.ts` — **only** the port's rename/import. ⛔ **No change to any method body.**
- `server/src/index.ts` — **additive only**: the `RecommendationScheduler` factory. ⛔ **Leave 14a's existing wiring alone.**
- `server/src/api/app.ts` — **one route** and its wiring
- `server/test/api/` *(existing, unfrozen)* — transport tests for what you added
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

- [ ] **⛔ CRITICAL — the §6 sequence has been RUN AGAINST THE RUNNING SERVER and the transcript is in the report.** Start the server, register a user **with a baseline of 2,000**, create a high-intensity workout for today, `POST /wearable/metrics` a sleep score of **40** and **850** active calories, `GET /wellness`, `POST /recommendations/apply-workout`, then `GET /schedule` — **and show the recovery session present, the above-tier run gone, the calorie target at 2,850, and the reason naming the metric and value.** *(A passing test suite is not this. §6 says "observe.")*
- [ ] **⛔ `wp-14a` is confirmed merged to `dev` before any of the above.** If it is not, this packet stops here.
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

- **The user has no stored calorie baseline** and `CaloriesToTargetRule` cannot be constructed. ⛔ **Do not invent a default and do not estimate one** (CON-05, §4.9 — the System asks). *(⚠️ This should not fire: `wp-14a` captures and validates `baselineCalories` at registration. If it does, something about the merge is wrong — report it rather than working around it.)*
- **`wp-14a` is not merged to `dev`.** ⛔ **Stop.** Do not rebuild the cut routes, and do not run this packet against `dev` alone.
- **Wiring the real catalog requires changing `RecommendationScheduler`'s behaviour**, not just its port type. That means the frozen suite and the real catalog disagree about something substantive — **the highest-value finding this packet can produce.**
- **Anything you need would edit a frozen suite or the contract.**
- **The §6 run does not produce what §6 says it produces.** ⛔ **Do not adjust the demonstration to match the System.** Report the divergence exactly.

> **MANDATORY**: **An escalation is a success.** A packet that reports everything green **without a §6 transcript in the report** has not demonstrated the thing this packet exists for.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when a person at a keyboard can inject a bad night's sleep into the running System and watch the calendar change — with no test runner involved.**

**CRITICAL**: Everything needed for that already exists and is tested. **This packet is the `WorkoutSource` adapter, the `RecommendationScheduler` wiring, one route, and the honest report of what still is not reachable.** If you are writing recommendation logic, you have misread the packet.

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it.
