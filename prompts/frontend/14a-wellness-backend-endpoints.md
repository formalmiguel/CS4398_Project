# CRITICAL REQUIREMENTS — 14a Wellness Backend Endpoints (+ UC-01 registration capture)

### MANDATORY DIRECTIVE ###

You are an expert Node.js + TypeScript engineer. **CRITICAL**: Implement **only** what is specified below, and **only** in the files listed. This packet is one reviewable diff with one human owner. It **composes modules that already exist and are already tested** — you are wiring them to HTTP, not re-deriving them.

| | |
|---|---|
| **Phase** | BUILD — no frozen test suite. FR-WEL is entirely **(D)/Demonstrated**, so this layer is verified by exercising the running server (`CLAUDE.md` §4.11: 08, 11, 12, 13 are the cheaper one-session BUILD phase, not the RED/GREEN split). The (T) analytics work is a *separate* packet (15a RED / 15b GREEN) — **not this one.** |
| **Human owner** | Ryan Woosley |
| **Depends on** | Packet 12 (`server/src/api/app.ts`, `server/src/db/`), packet 08 (`server/src/db/MetricStore.ts`, `server/src/wearable/`), packet 10 (`server/src/recommendation/`), packet 11 (`server/src/catalog/`). All are merged to `dev`. |
| **⚠️ Cross-owner touch** | This packet edits `server/src/api/app.ts`, `server/src/db/UserStore.ts`, `web/src/components/AuthScreen.tsx`, and `web/src/api/client.ts` — Miguel's packet 12/13 surface. **Flag Miguel before merge** (per the 27 Jul ownership decision: "Ryan builds it, flags Miguel"). Additive only — no existing route's behaviour changes except the register/login/me payloads, which gain fields. |
| **Spec** | `docs/SRS-v2.md` §3.7.2 (wireframe), §3.8.9 (FR-WEL), FR-REC-08/09, FR-WER-07/09, UC-01 (§ Account Creation), UC-08 (§ Calorie Target). |

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`. Do not paraphrase.

**The wellness read surface (the reason this packet exists):**

- **FR-WEL-01.** *(Essential, D)* Display **every metric in the Daily Metric Set** for the current date, each with value, unit, and measurement date. The view shall render whatever the set contains **rather than a hard-coded list**, so a metric added under FR-WER-04 appears without changing this view.
- **FR-WEL-02.** *(Essential, D)* Display today's recommended workout, its intensity tier, and the two alternatives from FR-REC-03.
- **FR-WEL-03.** *(Essential, D)* Display the current meal plan **and the daily calorie target it was built against**, showing the baseline and the activity contribution **separately**, so the effect of wearable data on meals is visible rather than implied.
- **FR-WEL-04.** *(Essential, D)* Display sleep score and active calories over at least the previous seven days.
- **FR-WEL-05.** *(Essential, D)* Where a metric is not from the current day, or is unavailable, **say so and state the date of the value shown.** Never present an old measurement as current, nor an absent one as zero.

**The calorie target and its inputs:**

- **FR-REC-08.** *(Essential, T)* The System shall compute a **daily calorie target** as the baseline target plus the active calories recorded for that date, and generate meal recommendations against it. Because calories accrue during the day (ASM-03), the target for today shall be recomputed on refresh and presented as a **current, not final** figure.
- **FR-REC-09.** *(Essential, D)* The System shall allow the user to record a **baseline calorie target**, used as the floor for FR-REC-08 and the fallback for FR-REC-06. *(The System does not estimate BMR. **It asks.**)*

**Getting real metric data into the store so the view has something to render:**

- **FR-WER-07.** *(Essential, T)* The System shall support **injecting** a metric value for a date, recorded as injected (DR-04), so the acceptance demonstration is deterministic.
- **FR-WER-09.** *(Essential, T)* Ingestion shall be **idempotent**: ingesting the same export twice shall not duplicate metric records; re-ingesting a date shall update rather than duplicate. *(Already satisfied by `MetricStore.ingest` — this packet only exposes it over HTTP; do not re-implement idempotency.)*

**The navigation obligation:**

- **UI-03.** *(Essential, D)* A **wellness view** showing metrics, today's recommended workout, and the meal plan, reachable from the main navigation in **one action** from the schedule. *(Wireframe: §3.7.2)* — *the view itself is packet 14b; this packet supplies the data it fetches.*

**The registration capture UC-01 requires (this is why the packet touches auth):**

> UC-01 Basic Path step 3: *"User sets wake time, sleep time, dietary preferences, workout preferences, **and baseline calorie target**."* Post-Conditions: *"the user's schedulable day (wake and sleep times) **and baseline calorie target** are recorded."* Requirements: FR-USR-01/02/03/07, **FR-REC-05, FR-REC-09**. The ERD carries `baseline_calorie_target` as a **user field**.
>
> - **FR-REC-05.** *(Essential, T)* The System shall never recommend a meal that violates a user's stated **dietary preference** — this constraint does not relax, for any reason.

**The current registration (packet 12/13) captures only wake/sleep. This packet completes UC-01's capture minus workout preferences** (deferred — see Out Of Scope).

---

### **CRITICAL**: Explicitly Out Of Scope

- **The analytics view and its computation (FR-ANL, UI-04)** — packets 15a/15b/15c. Streaks and completion rates are **(T)** and get their own RED/GREEN pair. **Build no streak or completion-rate logic here.**
- **The wellness VIEW itself (`web/src/components/WellnessView.tsx`, the 7-day sparklines, the workout carousel, the meal list)** — packet 14b. This packet stops at the JSON the view will fetch, plus the two registration form fields.
- **Workout preferences at registration** — UC-01 lists them, but nothing in scope reads them (they only drive FR-LIB-08 equipment relaxation, which the wellness view does not demonstrate). Do **not** add a workout-preference field. *(Deferred by the 27 Jul decision — recorded, not forgotten.)*
- **`applyWorkoutRecommendation` — the WRITE path.** `RecommendationScheduler.applyWorkoutRecommendation` PLACES a task on the calendar (FR-REC-02/04). **The wellness view is display-only (every FR-WEL is (D)).** Reading `GET /wellness` must never mutate the schedule. Use the **read** path only (see below). Placing a recommended workout as a real task is FR-REC-04's wiring, already built in packet 17b and triggered elsewhere — not on a wellness GET.
- **Garmin export FILE upload / parsing a raw `export.zip`** — the `GarminExportAdapter` exists, but a multipart file-upload endpoint is not needed to demonstrate FR-WEL. A JSON metric-**injection** endpoint (FR-WER-07) is enough and is what UC-12 uses. Do not build a file-upload route.
- **FR-REC-10** (weekly meal plan / prep windows) — Conditional, cut (26 Jul scope freeze). One day's meal plan only.

---

## **MANDATORY**: The Contract

**CRITICAL**: You **import** every domain type from `shared/src/contract.ts` (via `@capstone/shared`). You **may not redefine, extend, widen, or shadow** any type in it — including `DailyMetricSet`, `Metric`, `MetricOrigin`, `Workout`, `Meal`, `DietaryFlag`, `IntensityTier`, `Recommendation`, `Decision`, `CalorieTarget`, `RecommendationReason`, `IsoDate`.

**⛔ STOP**: If you believe the contract is wrong or insufficient — **do not change it.** Report what you need and why.

### The types you are composing (all already in the contract or a server-local module)

- **`DailyMetricSet { date, metrics: Record<string, Metric> }`** — keyed by metric NAME (DR-05). `Metric` is a **discriminated union**: the available branch carries `value`, `unit`, `measuredOn`, `origin`; the unavailable branch does not carry `value`. **FR-WER-06/NFR-ROB-01: an absent metric and a measured zero are different facts. Never read `.value` without narrowing on availability first** — the union makes forgetting it a compile error; keep it that way.
- **`Recommendation { decision, reason }`** where `Decision` is `{ kind: 'WORKOUT_INTENSITY', tier } | { kind: 'CALORIE_TARGET', calorieTarget }` and `reason: RecommendationReason { metricName, metricValue: number | null, usedFallback }`. `metricValue` is `null` **exactly** when the metric was unavailable — do not coerce null to 0.
- **`RecommendationEngine.recommend(metrics) → Recommendation[]`** (server-local, packet 10). Returns one `Recommendation` per registered rule — a `WORKOUT_INTENSITY` and a `CALORIE_TARGET`.
- **`CaloriesToTargetRule(baseline)`** (server-local, packet 10) — the baseline is **constructor state**, a user preference (FR-REC-09), never a metric. Its `apply` returns `baseline + activeCalories`; its `fallback` returns `baseline`. **This is why the user's `baselineCalories` must be stored and read per request.**
- **`Catalog.findWorkouts(tier, prefs, n) → CatalogResult<Workout>`** and **`findMeals(calorieTarget, dietaryPrefs, mealType?) → CatalogResult<Meal>`** (server-local, packet 11). `CatalogResult { items, relaxed, satisfiable }`. Dietary prefs are a HARD constraint — a returned meal always carries every requested flag.
- **`MetricStore.getDailyMetricSet(userId, date) → DailyMetricSet`** and **`MetricStore.ingest(userId, set)`** (packet 08).

---

## **MANDATORY**: What To Build

*State the obligation and the shape it must satisfy. Derive the implementation from the requirement and the wireframe (§3.7.2) — do not expect a finished handler handed to you.*

### 1. `server/src/db/UserStore.ts` — store what UC-01 says is captured

Add to `UserRecord`, the `create` input, the document mapper, and the document shape:
- **`baselineCalories: number`** (kcal, the FR-REC-09 floor).
- **`dietaryPreferences: readonly DietaryFlag[]`** (FR-REC-05; import `DietaryFlag` from `@capstone/shared`).

Add a small update method (`updateProfile` or extend the existing pattern) is **not** required by any in-scope requirement — omit it. Registration is the only capture point in scope.

### 2. `server/src/api/app.ts` — capture at registration, expose on read, serve wellness

- **`POST /auth/register`** — additionally read, validate, and store `baselineCalories` (a positive number within a sane bound — reject `<= 0` or absurd values with a `400 { error }` in the same style as the existing wake/sleep check) and `dietaryPreferences` (an array whose every element is a valid `DietaryFlag`; an empty array is valid = no restriction). Include them in the `201` response. **FR-REC-09 is the "System asks" requirement — a registration that does not record a baseline the user supplied does not satisfy it.**
- **`POST /auth/login`** and **`GET /user/me`** — include `baselineCalories` and `dietaryPreferences` in their JSON, so a session restored from a stored token (packet 13's flow) still knows them.
- **`POST /wearable/metrics`** (new; `requireAuth`) — FR-WER-07: accept a `DailyMetricSet`-shaped body for the authenticated user and call `metrics.ingest(userId, set)`. Origin on each ingested metric is `INJECTED` (DR-04) unless the body states otherwise. Idempotency is `MetricStore.ingest`'s job (FR-WER-09) — do not re-implement it. Respond `204`.
- **`GET /wellness`** (new; `requireAuth`; optional `?date=YYYY-MM-DD`, defaulting to `clock.today()`) — the composition this packet exists for. It **reads only**. Return a single JSON object carrying:
  - **`metrics: DailyMetricSet`** for the date — FR-WEL-01. Render-whatever-it-contains: do not name specific metric keys in the payload shape; hand the view the `DailyMetricSet` as-is.
  - **`history`** — for **at least the previous 7 days** through the date, the sleep-score and active-calorie series, each point carrying its date and either its value or an explicit "unavailable" (FR-WEL-04 + FR-WEL-05). Built from a new `MetricStore` range read (see §3). Do **not** invent zeros for missing days.
  - **`workout`** — today's recommended workout (`options[0]`), its `intensityTier`, and **the two alternatives** (`options[1]`, `options[2]`) — FR-WEL-02. Derive the tier from the `WORKOUT_INTENSITY` decision `RecommendationEngine.recommend` returns for these metrics, then `catalog.findWorkouts(tier, {}, 3)`. Carry the recommendation's `reason` so the view can state why (FR-REC-13). **No default preferences beyond `{}`.**
  - **`meals`** — the meal plan and the calorie target it was built against, with **baseline and activity contribution stated separately** (FR-WEL-03). The target is the `CALORIE_TARGET` decision from `RecommendationEngine.recommend` (constructed with the user's `baselineCalories`); `activity = target − baseline`. Meals via `catalog.findMeals(target, user.dietaryPreferences)`. Include `baseline`, `activity`, `target`, and the meals. **If active calories are unavailable, `target === baseline` and `activity === 0`, and the payload must say the target was made without current data** (FR-REC-06 / FR-WEL-05 / UC-08 alternate flow) — do not silently present the fallback as a measured figure.

### 3. `server/src/db/MetricStore.ts` — a range read for the 7-day history

Add `getMetricsInRange(userId, start, end)` (or a metric-name-scoped variant) returning the stored metrics per date across the inclusive range, so `GET /wellness` can build FR-WEL-04's series **without** N single-date round trips. Keep the DR-05 shape (one document per metric per date) — you are reading it, not changing it. A date with no record for a metric is **absent from the series for that metric**, not a zero.

### 4. Composition root + `AppDependencies` — construct the wellness services

`AppDependencies` currently lacks the metric store and the recommendation/catalog services. Extend it (and wherever `buildApp` is constructed — the server entry point) to inject:
- the `MetricStore`,
- the `Catalog` (packet 11's real `WorkoutCatalog` + `MealCatalog`, seeded),
- a factory or per-request construction of `RecommendationEngine` with the two rules registered — note `CaloriesToTargetRule` needs the **current user's** `baselineCalories`, so the engine (or at least that rule) is constructed **per request from the loaded user**, not once at boot.

Keep `findCandidateSlots`, `RescheduleService`, and `TaskRepository` exactly as they are — the wellness path does not touch them.

### 5. `web/src/components/AuthScreen.tsx` + `web/src/api/client.ts` — capture the two fields in the form

The registration form must collect `baselineCalories` (a number input, kcal) and `dietaryPreferences` (a multi-select over the five `DietaryFlag` values), and send them in the `register` call. `client.ts`'s `register` signature gains the two fields, and the stored session/derived state gains them where wake/sleep already live. **Do not build the wellness view here** — only the registration fields, so a newly created account satisfies UC-01. Keep the form's existing validation-message style.

---

## **CRITICAL**: The Calls This Packet Must Get Exactly Right

1. **`GET /wellness` reads; it never writes.** The tempting shortcut is to call `RecommendationScheduler.applyWorkoutRecommendation` because it already returns `options`, a `task`, a `placement`, and a `reason` in one shape. **That method PLACES a task on the calendar** (FR-REC-02/04) — calling it on a display GET would put a new workout on the schedule every time the user opened the wellness tab. Use `RecommendationEngine.recommend(metrics)` for the tier + reason and `catalog.findWorkouts(tier, {}, 3)` for the options. Nothing on this path mutates.
2. **Baseline and activity are shown SEPARATELY (FR-WEL-03).** Return `baseline`, `activity`, and `target` as three explicit fields — not a single `target` the view has to reverse-engineer. The wireframe (§3.7.2) states it literally: *"baseline 2,000 + 850 active calories."* A payload that only carries `2,850` cannot render that sentence.
3. **Unavailable ≠ zero, and stale ≠ current (FR-WER-06 / FR-WEL-05 / NFR-ROB-01).** The `Metric` union already encodes availability; carry it through to the payload intact. For the history series, a day with no record is *absent*, never `0`. For the calorie target, an unavailable active-calorie metric yields `target === baseline` **and a flag that says so** — never a `2,850` that looks measured when it was a fallback.
4. **The metric map is rendered by whatever it contains (FR-WEL-01).** Do not shape the `metrics` payload as `{ sleepScore, activeCalories }`. Pass the `DailyMetricSet.metrics` record through by its keys. A third metric added under FR-WER-04 must appear in `GET /wellness` with **no change to this endpoint** — that is the DR-05/FR-WER-04 claim, and hard-coding two keys here quietly breaks it.
5. **`baselineCalories` is the user's, read per request.** `CaloriesToTargetRule` takes it as constructor state. Construct the rule (and thus the engine, or that rule) from the loaded user on each request. A boot-time constant would be the §4.9 "estimate, don't ask" failure wearing a different hat.

---

## ⚠️ **MANDATORY**: Escalation Clause

If any requirement, type, or wiring below cannot be satisfied as written — **stop and report; do not invent a way around it.** In particular:

- If `RecommendationEngine`/`Catalog`/`MetricStore` do not expose what §3.6 / this packet assumes, **report the exact gap** — do not add a second code path that duplicates their logic (that is the FR-RSC-03 / §4.3 failure mode applied to recommendations).
- If capturing `baselineCalories`/`dietaryPreferences` at registration appears to require a contract change, **stop** — user identity lives at the persistence boundary (OPEN-12, v2.18); `UserRecord` is a server-local persistence type, not the shared contract, so these fields belong there, not in `shared/src/contract.ts`. If you find yourself editing `shared/`, you have taken a wrong turn.
- Anything you had to guess at, list it under an **Escalations** heading in the report with the SRS clause it turns on.

---

## **MANDATORY**: Files You May NOT Touch

- ⛔ **`shared/src/contract.ts`** — the frozen contract (§4.7). Import only.
- ⛔ **`engine/**`** — the wellness path never touches the engine.
- ⛔ **Any frozen test suite** — `engine/test/`, `server/test/reschedule/`, `server/test/wearable/`, `server/test/catalog/`, `server/test/acceptance/`, `server/test/replacement/`. `npm run guard:tests-frozen` must stay green (§4.12); if your change reddens a frozen suite, you have changed behaviour a frozen test pinned — stop and report.
- ⛔ **`scripts/**` and `scripts/frozen-tests.json`** — human-owned guards (§4.12).
- ⛔ **`RescheduleService`, `findCandidateSlots`, `RecommendationScheduler.applyWorkoutRecommendation`** — read/compose the read methods; do not edit these.

---

## **MANDATORY**: Done Criteria (verified by demonstration — FR-WEL is (D))

**CRITICAL**: "It compiles" is **not** done. Demonstrate the running behaviour with `curl` against the dev server, and record the transcript in the report:

1. `npm run verify` is green (existing count unchanged + any additive server test you add for the range read / new routes — you MAY add tests for your own new code; you may not touch frozen suites).
2. `npm run guard:tests-frozen`, `guard:single-placement`, `guard:engine-purity` all green.
3. `typecheck` and `lint` clean across `server` and `web`.
4. **Live transcript:** register a user with `baselineCalories: 2000` and a dietary preference → inject a metric set for today with `sleepScore` and `activeCalories: 850` → `GET /wellness` returns: the metric set, a 7-day history, a warranted-tier workout + 2 alternatives with a reason, and a meal plan whose payload shows **`baseline: 2000, activity: 850, target: 2850`** separately, honoring the dietary preference. Then `GET /wellness` a second time and confirm the schedule was **not** mutated (no new placement) and the response is identical.
5. **The unavailable case:** inject a day with `activeCalories` unavailable → `GET /wellness` shows `target === baseline`, `activity === 0`, and a flag saying the target was made without current data. Never a bare `2850`-looking number, never a `0` where "no data" is the truth.
6. Report at `docs/P14A-REPORT.md`: what was wired, the two live transcripts, the exact `AppDependencies` change, and an **Escalations** section (or "none").

---

## Prompt-Construction Techniques Applied *(house style, `CLAUDE.md` §4.11)*

- **Sandwich Method** — the MANDATORY DIRECTIVE opens and the Done Criteria close; the obligations sit between.
- **Attention Anchoring** — the five load-bearing calls are pulled out under their own heading so they are not lost in the endpoint list; #1 (read-not-write) is the one most likely to be gotten wrong.
- **Visual Emphasis** — ⛔ / ⚠️ / **CRITICAL** mark the non-negotiables (no contract edit, no frozen-suite touch, no mutation on GET).
- **Clear Delimiters** — verbatim SRS quotes are fenced as quotes; every file has its own sub-heading.
- **Selective Context** — only the modules this packet composes are described; the analytics side, the engine internals, and the reschedule policy are deliberately absent.
