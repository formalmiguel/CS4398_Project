# CRITICAL REQUIREMENTS — 11b Catalog and Seeded Libraries (GREEN)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Make the **already-frozen** packet 11 test suite pass by writing **only** implementation and **seed data**, in **only** the five stub files listed (plus new data files you create under `server/src/catalog/`). You **may not edit, skip, rename, or weaken a single test or fixture** — not to fix a typo, not to correct an assertion you believe is wrong, not to loosen a boundary. If you believe a test is wrong, **STOP and escalate** (§4.6).

| | |
|---|---|
| **Phase** | 🟢 GREEN (implementation + seed data only) |
| **Human owner** | Ryan Woosley |
| **Depends on** | **11 RED (frozen at `4b1fd4e` — the RED commit; manifest committed `a91f848`)** — the suite you implement against. Also 03 (the contract: `Workout`, `Meal`, `DietaryFlag`, `MealType`, `IntensityTier`). |
| **Spec** | `docs/SRS-v2.md` §3.8.11 (FR-LIB), FR-REC-03/05, §3.6 (`Catalog`); the three ratified decisions (A dataset, B tier mapping, C durations, D relaxation order) in the frozen tests and the decision log (27 Jul); the frozen tests are the executable form. |

> **The suite is frozen. It is the specification in executable form.** `npm run guard:tests-frozen` fails the build if any file under `server/test/catalog/` changes. Your job is to make **134 red tests green without touching one of them.** Where you seed too little data, tests stay red — that is the design (FR-LIB-05/07), not a reason to edit a test.

---

## **MANDATORY**: Requirements In Scope

> Quoted **VERBATIM** from `docs/SRS-v2.md`. The frozen tests pin each; the requirement text is why.

- **FR-LIB-01.** *(Essential, I)* Each library sits behind a **catalog interface** accepting constraints and returning matching items. The recommendation engine queries only through it and does not know how a library was populated.
- **FR-LIB-03.** *(Essential, D)* The **workout library** is populated by a **one-time seeding process** from a freely licensed exercise dataset. Each workout carries: a name, an intensity tier, a typical duration, required equipment, and target muscle groups or activity type.
- **FR-LIB-04.** *(Essential, T)* The mapping from source fields to **intensity tier** is documented and deterministic *(decision B: `stretching`→LOW; else `plyometrics`→HIGH; else by level `beginner`→LOW / `intermediate`→MODERATE / `expert`→HIGH — the frozen 18-row truth table)*.
- **FR-LIB-05.** *(Essential, T)* At least **five workouts in each intensity tier** satisfying the default preference set, so FR-REC-03 can always offer three distinct options.
- **FR-LIB-06.** *(Essential, D)* The **meal library** is populated by a one-time seeding process. Each meal carries a name, a meal type, a **calorie count**, and dietary flags.
- **FR-LIB-07.** *(Essential, T)* The meal library is large enough, and its calorie counts distributed widely enough, that a day's plan assembles within **±10%** of any target FR-REC-08 can produce, for **every** dietary preference combination. *(Swept range 1,500–4,000 kcal; ±10% is the closed band; day = 0.30/0.35/0.35 BREAKFAST/LUNCH/DINNER — SRS v2.30.)*
- **FR-LIB-08.** *(Essential, T)* Where no item satisfies the full constraint set, relax constraints in the **documented, fixed order** *(decision D — soft: meal type → equipment/preference → calorie tolerance; hard: dietary flags, intensity ceiling — never)* and **report** which were relaxed. **Never** return an item violating a dietary preference or an intensity ceiling. Where relaxation cannot produce a candidate, say so plainly.
- **FR-LIB-10.** *(Essential, I)* Any dataset seeded from is **licensed for the use made of it**, with license and attribution recorded in the repository.
- **FR-REC-03.** *(Essential, D)* For any workout slot, offer **three** options at the warranted tier, drawn from the library.
- **FR-REC-05.** *(Essential, T)* **Never** recommend anything violating a dietary preference — a hard constraint that does not relax under any circumstance, including when no compliant item is found.

### **CRITICAL**: Explicitly Out Of Scope — do not build these here

- **FR-REC-02/04** *(replace an over-tier workout and place it via the engine)* — the wiring, packets 17a/17b. This packet supplies *options*; it creates no task, calls no scheduling engine, reschedules nothing (§4.3).
- **FR-REC-08's target computation** *(baseline + active calories)* — packet 10's rule, done. You **receive** a calorie target and select against it.
- **FR-LIB-02's executable guard** *(no network in the recommendation path)* — packet 16b. **But you must not violate it:** the seed is local data committed to the repo, read at seed time from disk — **no `fetch`, no HTTP client, no runtime download anywhere in `server/src/catalog/`.** That is what lets 16b pass (see "Seeding", below).
- **FR-REC-13's rendered English reason, the wellness views** — packets 14/15.
- **Editing the contract, the `Catalog` interface, or any test.**

---

## **MANDATORY**: The Contract and the server-local seam

**CRITICAL**: Import every **domain** type from `@capstone/shared` — `Workout`, `Meal`, `DietaryFlag`, `MealType`, `IntensityTier`. Import the **server-local** interface types from `./Catalog` — `Catalog`, `CatalogResult`, `RelaxedConstraint`, `WorkoutPreferences`. **All of these already exist (RED) and are complete — do not redefine, widen, or edit any of them, including `Catalog.ts`.**

- `CatalogResult<T> = { items: readonly T[]; relaxed: readonly RelaxedConstraint[]; satisfiable: boolean }`.
- `RelaxedConstraint = 'MEAL_TYPE' | 'WORKOUT_PREFERENCE' | 'CALORIE_TOLERANCE'` — there is **no dietary or ceiling member, by construction.** A hard constraint has no relax token because it must never be relaxable.

**⛔ STOP** if the contract or the `Catalog` interface seems insufficient — do not change either. Report it (§4.7).

---

## **MANDATORY**: What To Build

Implement the throwing stubs; the signatures already exist. **Derive every body and the shape of the seed from the frozen tests** — they are cited per file below so you know which assertions constrain each.

### `server/src/catalog/intensityTier.ts` — `resolveIntensityTier(category, level)` *(FR-LIB-04)*

- Implement **decision B exactly**, total over every `(category, level)`: `category === 'stretching'` → `'LOW'`; else `category === 'plyometrics'` → `'HIGH'`; else `level === 'beginner'` → `'LOW'`, `'intermediate'` → `'MODERATE'`, `'expert'` → `'HIGH'`. *(The frozen `intensityTierMapping.test.ts` asserts all 18 rows + 8 named representatives. Match the table; do not invent a tier for an unlisted input — but the mapping is total over the six known categories × three levels.)*

### `server/src/catalog/WorkoutCatalog.ts` — `seedWorkouts()` + `WorkoutCatalog.findWorkouts()` *(FR-LIB-03/04/05/08, FR-REC-03, FR-LIB-01)*

- **`seedWorkouts(): readonly SeededWorkout[]`** — the one-time seed from **`free-exercise-db`** (decision A). For each source record you seed, build a `Workout { id, name, intensityTier: resolveIntensityTier(source.category, source.level), typicalDurationMinutes: {LOW:20,MODERATE:30,HIGH:45}[tier], equipment, targetArea }` and pair it with its `WorkoutSourceRecord { category, level }` as a `SeededWorkout`. `equipment` is the source's equipment as a `string[]` — **it may be empty** for a bodyweight exercise (do not fabricate a sentinel; the test asserts it is present, not non-empty). `targetArea` is derived from the source's `primaryMuscles` (or the activity `category` where muscles are absent) and **must be non-empty**.
- **`WorkoutCatalog.findWorkouts(tier, prefs, n): CatalogResult<Workout>`** — return up to `n` **distinct** (by `id`) workouts **at `tier`** whose `equipment` is satisfied by `prefs.availableEquipment` (a workout is satisfiable iff its `equipment` is a subset of the available set; an omitted/undefined `availableEquipment` is the default set — **no restriction**, everything matches). **Return the bare contract `Workout`, never the `SeededWorkout`** (FR-LIB-01 — the frozen test asserts the returned object has *exactly* the six `Workout` keys). **The intensity ceiling is hard: never return a workout above `tier`, under any prefs or `n`.**
- **FR-LIB-08 equipment relaxation:** when a restrictive `availableEquipment` leaves no at-tier match, relax `'WORKOUT_PREFERENCE'` (report it in `relaxed`) and return at-or-below-tier workouts; if even then nothing fits, `satisfiable: false`, `items: []` — never a ceiling violation.

### `server/src/catalog/MealCatalog.ts` — `seedMeals()` + `MealCatalog.findMeals()` *(FR-LIB-06/07/08, FR-REC-05, FR-LIB-01)*

- **`seedMeals(): readonly Meal[]`** — the **hand-authored** meal library (§4.2 — meals are authored, not sourced; no dataset, no FR-LIB-10 question). Each `Meal { id, name, mealType, calories, dietaryFlags }` with `calories > 0`. See "Seeding" for the FR-LIB-07 coverage strategy — this is the load-bearing content decision.
- **`MealCatalog.findMeals(calorieTarget, dietaryPrefs, mealType?): CatalogResult<Meal>`** — return meals within the **closed ±10% band** of `calorieTarget` that carry **every** flag in `dietaryPrefs` (dietary is **hard** — a returned meal never lacks a requested flag, ever, for any query) and match `mealType` when given. **FR-LIB-08 order (decision D):** if the full set yields nothing, relax **`'MEAL_TYPE'` first** (report it), then widen the **`'CALORIE_TOLERANCE'`** (report it) — **never** relax dietary. Report each relaxed constraint in `relaxed` in that canonical order. Where even full soft relaxation yields no dietary-satisfying meal, `satisfiable: false`, `items: []` — never a violating meal. Return the bare contract `Meal`.

### `server/src/catalog/attribution.ts` — `seedAttribution()` *(FR-LIB-10)*

- Return a non-empty `SeedAttribution[]` recording the exercise dataset: `{ source: 'free-exercise-db', licence: 'The Unlicense' }` (the frozen test matches `/free-exercise-db/i` and `/unlicense/i`). The hand-authored meal library has no external source and needs no entry.

---

## **MANDATORY**: Seeding — the load-bearing content work

> The tests do not just check code; several are red until the **data** is right. This is where most of the work is.

**Workouts (FR-LIB-02 / FR-LIB-10 — vendored, not fetched):** commit the `free-exercise-db` data into the repo (the whole `exercises.json`, or a curated subset) under `server/src/catalog/` and read it from **disk** at seed time — **never fetch it at runtime.** The Unlicense (decision A) permits this storage and redistribution; record it in `attribution.ts`. This keeps the recommendation path network-free, which packet 16b will guard.

**Two workout-seed constraints the frozen tests impose — get these right or specific tests stay red:**
1. **≥5 distinct workouts per tier under the default set** (FR-LIB-05) and **3 distinct at each tier with nothing relaxed** for `findWorkouts(tier, {}, 3)` (FR-REC-03). Ensure your seeded subset keeps at least five per tier.
2. ⚠️ **The MODERATE tier must contain no bodyweight (empty-equipment) workout.** `WorkoutCatalog.test.ts` asserts that `findWorkouts('MODERATE', {availableEquipment:['__none_such__']}, 3)`, *if satisfiable*, reports `'WORKOUT_PREFERENCE'`. A bodyweight workout needs no equipment, so it would satisfy *any* preference **without** relaxation — leaving `relaxed: []` and failing the test. Curate the MODERATE seed to equipment-requiring exercises (intermediate barbell/dumbbell/machine work — plentiful in the source). LOW and HIGH are not equipment-tested, so bodyweight there is fine.

**Meals (FR-LIB-07 — the ±10% coverage, the packet's flagged scope risk):** the assembler splits each daily target 0.30/0.35/0.35 and requires, per slot, a dietary-satisfying meal within ±10% of the slot target — for **every** one of the 32 dietary combinations across 1,500–4,000 kcal. Per-slot targets span roughly **450–1,400 kcal**. **The subset insight makes this tractable:** a meal tagged with *all five* dietary flags satisfies *every* combination (a subset check), so a **backbone of ~20 maximally-flagged meals**, spaced so consecutive calorie values are ≤~22% apart across 450–1,400 kcal, covers every combination at every swept slot target. Author that backbone first; then add **variety** (less-flagged, more realistic meals) on top for the demo — variety meals are only ever *additionally* selected, never required, so they cannot break a combination. Confirm coverage by running the FR-LIB-07 sweep, not by eye.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/catalog/intensityTier.ts`, `server/src/catalog/WorkoutCatalog.ts`, `server/src/catalog/MealCatalog.ts`, `server/src/catalog/attribution.ts` — implement the stubs.
- **New files under `server/src/catalog/`** — the vendored `free-exercise-db` data file, and (optionally) a meal-library data module. Keep them local and network-free.

## **CRITICAL**: Files You Must **NOT** Touch

- **Every file under `server/test/catalog/`** — the frozen suite (all four `*.test.ts` **and `_support.ts`**, which holds the sweep, the powerset, `withinTolerance`, and the day-plan assembler). Not one character. `_support.ts` is inside the frozen dir and is fingerprinted with it.
- `server/src/catalog/Catalog.ts` — the interface + result types are complete; do not edit.
- `scripts/frozen-tests.json` — the freeze manifest. **Re-running `npm run freeze` to go green is editing the test one level removed (§8.3).**
- `shared/src/contract.ts`; any `server/src/db/**`, `server/src/api/**`, `server/src/reschedule/**`, `server/src/recommendation/**`, `server/src/wearable/**`, or other package. *(If wiring the real catalog into `RecommendationScheduler` tempts you — that is **OPEN-28**, a separate integration item, not this packet.)*

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] `npm run test` (server): the **134** packet-11 tests pass; every pre-existing server test still passes. No test was changed to achieve this.
- [ ] **`npm run guard:tests-frozen` passes** — `P11 … unchanged` (and P04/P06/P08/P09/P17a/P17c). Non-negotiable.
- [ ] **`git diff --stat 4b1fd4e -- server/test/catalog/` is EMPTY.** Nothing in the frozen suite changed.
- [ ] No `fetch`/HTTP/network call exists anywhere under `server/src/catalog/` — the seed is read from committed local data (FR-LIB-02, ahead of 16b).
- [ ] `attribution.ts` records `free-exercise-db` / The Unlicense (FR-LIB-10).
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*.
- [ ] `npm run verify` is **green end to end** — this branch (`wp-11-libraries`) now passes for the first time (RED + GREEN together, §8.5), so it is ready to merge to `dev`.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to Ryan — do not work around it — if:**

- You **cannot make a test pass and believe the test is wrong.** Report it; a human adjudicates against the SRS. **Do not edit it.**
- **FR-LIB-07 turns out genuinely infeasible** for some dietary combination even with the maximally-flagged backbone — this was the RED gate's flagged scope risk, so if the frozen sweep cannot be satisfied by any authorable library, that is a requirements decision (reduce the offered combinations? widen the tolerance for the extreme combos?), **not** a test to weaken. Say which combination and why.
- The equipment-relaxation test appears unsatisfiable even after curating the MODERATE seed (it should be satisfiable — see the seeding note).
- Satisfying a test would require touching a **must-NOT-touch** file — in particular the urge to edit `_support.ts`, `Catalog.ts`, a test, or the manifest.
- A test appears to contradict the contract, the `Catalog` interface, the SRS, or another test. Say which.

> An escalation is a **success**. This suite's RED gate already adjudicated its five escalations (decision log, 27 Jul), so a clean GREEN is a plausible good outcome here — **but the meal library is real authoring work, and "the sweep won't go green for combination X" is a legitimate escalation, not a signal to loosen a boundary.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: This packet's single pass condition — **the 134 frozen packet-11 tests are green, `guard:tests-frozen` passes, `npm run verify` is green end to end, the catalog path makes no network call, and not one test, fixture, or manifest entry changed.**

**CRITICAL**: Where this prompt and a frozen test disagree, **the test wins and this prompt is a defect** — report it, do not reconcile it by editing the test. Where this prompt and `docs/SRS-v2.md` disagree, the SRS wins.
