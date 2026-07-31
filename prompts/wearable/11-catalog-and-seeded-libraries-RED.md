# CRITICAL REQUIREMENTS — 11 Catalog and Seeded Libraries (RED)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Write **only** the failing test suite and the throwing stubs / interfaces it needs — **no working catalog logic and no seed data**. This packet is one reviewable diff with one human owner.

| | |
|---|---|
| **Phase** | 🔴 RED (tests + throwing stubs / interfaces only) |
| **Human owner** | Ryan Woosley — *the Data & Wearable Integration Lead, who owns the wearable metrics these libraries serve, the OPEN-04 dataset/licence decision behind them, and the wellness views (packets 14/15) that render their output.* |
| **Depends on** | 03 (the contract — `Workout`, `Meal`, `DietaryFlag`, `MealType`, `IntensityTier` **already exist**, so this packet needs **no** contract amendment) · 08/08b, 09/10 (the recommendation path these libraries feed, unchanged here). This path does **not** touch the engine (`docs/AGENTIC-TDD-WORKFLOW.md` §8: "The engine is not on it") or the reschedule service. |
| **Spec** | `docs/SRS-v2.md` §3.8.11 (FR-LIB), FR-REC-03, FR-REC-05, and the §3.6 `Catalog` interface. **Plus three ratified team decisions** transcribed verbatim below (OPEN-04 dataset + tier mapping + duration; FR-LIB-08 relaxation order) — see `docs/TEAM-MEETING.md` decision log, 27 Jul, and SRS v2.29. |
| **Sibling** | **11b GREEN** implements the catalog **and seeds both libraries** to make this suite pass. A *different agent session* writes it (§4.6). |

> **✅ NO PREREQUISITE CONTRACT GATE.** Unlike packet 09, every domain type this packet consumes and produces (`Workout`, `Meal`, `DietaryFlag`, `MealType`, `IntensityTier`) is **already in `shared/src/contract.ts`** — verified 27 Jul. You **import** them; you do **not** define, widen, or shadow them. The `Catalog` interface and its result types are **server-local** (see "The Contract"), authored here — they are not contract types, exactly as `RecommendationEngine` is not.

> **⚠️ Phasing note for the owner — ratify or overrule before running.** The build order lists "11 libraries" as a RED/GREEN pair (11 RED → 11b GREEN), like 08→08b, because the requirements in scope are marked **(T)** — the tier mapping (FR-LIB-04), the per-tier supply (FR-LIB-05), the ±10% calorie coverage (FR-LIB-07), the relaxation order and hard-constraint inviolability (FR-LIB-08), and the never-violate-a-dietary-preference rule (FR-REC-05) — and §4.6 forbids one agent writing both a `(T)` test and the code it tests. The `(D)`/`(I)` obligations (FR-LIB-03/06 seeding, FR-LIB-01/10 inspection) are pinned structurally here and demonstrated/recorded in 11b — see "Out Of Scope".

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`. Do not paraphrase. The SRS's phrasing is load-bearing — *"it shall **never** return an item violating a dietary preference"* is a testable, non-negotiable obligation.

- **FR-LIB-01.** *(Essential, I)* Each library shall sit behind a **catalog interface** accepting constraints and returning matching items. The recommendation engine shall query only through it and shall not know how a library was populated.

- **FR-LIB-03.** *(Essential, D)* The **workout library** shall be populated by a **one-time seeding process** from a freely licensed exercise dataset. Each workout shall carry: a name, an intensity tier, a typical duration, required equipment, and target muscle groups or activity type.

- **FR-LIB-04.** *(Essential, T)* The mapping from the source dataset's fields to the System's **intensity tier** shall be documented and deterministic:

  | Intensity tier | Source characteristics |
  |---|---|
  | **LOW** | Stretching, mobility, recovery; and beginner-level strength or cardio |
  | **MODERATE** | Intermediate-level strength and cardio |
  | **HIGH** | Plyometric or high-intensity work; and any expert-level activity |

  *Verification: assert every seeded workout resolves to exactly one tier, and that a representative item of each source category resolves to the expected tier.*

- **FR-LIB-05.** *(Essential, T)* The workout library shall contain **at least five workouts in each intensity tier** satisfying the default preference set, so FR-REC-03 can always offer three distinct options.

- **FR-LIB-06.** *(Essential, D)* The **meal library** shall be populated by a one-time seeding process. Each meal shall carry: a name, a meal type, a **calorie count**, and dietary flags.

- **FR-LIB-07.** *(Essential, T)* The meal library shall be large enough, and its calorie counts distributed widely enough, that a day's plan can be assembled within **±10%** of any target FR-REC-08 can produce, for **every** dietary preference combination offered. Verified by a test sweeping the target range against each preference set.

- **FR-LIB-08.** *(Essential, T)* Where **no item satisfies the full constraint set**, the catalog shall relax constraints in a **documented, fixed order** and report which it relaxed. It shall **never** return an item violating a **dietary preference or an intensity ceiling** — these are hard constraints. Where relaxation cannot produce a candidate, the System shall say so plainly.

- **FR-LIB-10.** *(Essential, I)* Any dataset seeded from shall be **licensed for the use made of it**, with license and attribution recorded in the repository. **Where a source's terms restrict storage or redistribution of its data, that source shall not be seeded from.**

- **FR-REC-03.** *(Essential, D)* The System shall **not silently override the user.** For any workout slot it shall offer **three** options at the warranted tier, drawn from the library (FR-LIB-05); its own choice is placed by default, and the user may select either other and have the slot re-placed.

- **FR-REC-05.** *(Essential, T)* The System shall allow a user to record dietary and workout preferences and shall **never** recommend anything violating one. **This is a hard constraint that does not relax under any circumstance**, including when no compliant item is found (FR-LIB-08). Verified by recording each restriction in turn and asserting no recommendation, across the full calorie range, violates it.

### **MANDATORY**: Ratified team decisions — transcribe VERBATIM into the tests, do not re-derive

> These three are **documented team decisions** (decision log, 27 Jul; SRS v2.29), quoted here so the frozen suite pins the agreed values and no run silently authors its own (§0.1). They are requirements, not implementation.

**(A) Source dataset (OPEN-04, FR-LIB-03/10):** `yuhonas/free-exercise-db`, licensed **The Unlicense** (SPDX `Unlicense`, public domain — permits storage and redistribution with no attribution or share-alike). Each source record carries `name`, `category ∈ {strength, stretching, plyometrics, cardio, powerlifting, strongman}`, `level ∈ {beginner, intermediate, expert}`, `equipment`, `primaryMuscles`/`secondaryMuscles`.

**(B) FR-LIB-04 tier mapping — documented, deterministic, total over every `category × level`:**
1. `category === 'stretching'` → **LOW** *(mobility / recovery)*
2. else `category === 'plyometrics'` → **HIGH** *(plyometric work)*
3. else by `level`: `beginner` → **LOW**, `intermediate` → **MODERATE**, `expert` → **HIGH**

*(This resolves strength / cardio / powerlifting / strongman by level; every combination lands on exactly one tier — the FR-LIB-04 verification clause.)*

**(C) FR-LIB-03 typical-duration rule — the dataset carries none, so it is assigned by tier:** **LOW = 20 min, MODERATE = 30 min, HIGH = 45 min.**

**(D) FR-LIB-08 relaxation order — the hard constraints never relax, in any order, for any reason:**
- **HARD (never relax):** a meal's **dietary flags**; a workout's **intensity ceiling** (never return a workout *above* the warranted tier).
- **SOFT — relax in this fixed order**, applied to whichever soft constraints a given query has, skipping those that do not apply: **(1) meal type → (2) equipment / workout preference → (3) widen the ±10% calorie tolerance.** The calorie tolerance relaxes **last** (FR-REC-08's target is the wearable-driven claim, preserved longest). The catalog **reports** each constraint it relaxed; where full soft relaxation still yields no candidate, it reports the query **unsatisfiable** rather than returning any hard-constraint-violating item.

### ⛔ ATTENTION ANCHOR — the two things a test here must never get wrong

1. **The hard constraints are absolute.** No dietary-preference violation and no above-ceiling workout may EVER be returned — not under relaxation, not when nothing else fits, not as a "closest match." A test that lets one through freezes the single worst behaviour this System could have (FR-REC-05, FR-LIB-08). Assert the negative explicitly: across the full calorie range and every dietary combination, **zero** returned meals violate the preference; across every warranted tier, **zero** returned workouts exceed it.
2. **±10% is the boundary and it is exact.** FR-LIB-07's tolerance is `[0.9 × target, 1.1 × target]` inclusive. Assert at and just inside/outside the bound, per NFR-COR-04's boundary discipline.

### **CRITICAL**: Explicitly Out Of Scope — write no code and no test for these here

- **FR-LIB-02** *(no network in the recommendation path)* — an **(I)** guard, owned by Patrick's **16b**. This packet's libraries are local seed data by construction (no `fetch`, no client), which is what *lets* 16b pass; it does not write the guard.
- **FR-LIB-09** *(external content API)* — **Conditional**, and per the 26 Jul scope freeze **definitively not attempted**. The `Catalog` interface is the seam that would allow it later (FR-LIB-01); nothing here reaches for it.
- **FR-REC-04, FR-REC-02** *(create the recommended workout as a task and place it via the engine / replace an above-tier workout)* — the **load-bearing wiring**, owned by Patrick's **17a/17b**. This packet supplies the *options* a recommendation draws from (FR-REC-03); it never creates a task, calls the engine, or reschedules. §4.3: there is exactly one placement function and it is not here.
- **FR-REC-08's target computation** *(baseline + active calories)* — packet 10's `CaloriesToTargetRule`, already done. This packet **receives** a calorie target and finds meals against it; it never computes one.
- **FR-REC-09** *(record a baseline calorie target)* — a user-preference/persistence concern (packets 12/14), not the catalog's.
- **FR-REC-10** *(weekly meal plan + prep windows)* — **Conditional**, cut (26 Jul). FR-LIB-07's "a day's plan can be assembled" is a *library-richness property* verified by a test-side assembler, **not** a shipped weekly-planner feature.

---

## **MANDATORY**: The Contract

**CRITICAL**: You **import** every domain type from `shared/src/contract.ts`. You **may not redefine, extend, widen, or shadow** any type in it.

Types this packet consumes and produces — **all already in the contract**:

- `IntensityTier = 'LOW' | 'MODERATE' | 'HIGH'` — a workout's tier and the ceiling FR-LIB-08 never relaxes past.
- `DietaryFlag = 'VEGETARIAN' | 'VEGAN' | 'GLUTEN_FREE' | 'DAIRY_FREE' | 'NUT_FREE'` — a meal's flags and the **hard** dietary constraint.
- `MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'`.
- `Workout = { id, name, intensityTier, typicalDurationMinutes, equipment: string[], targetArea }` — exactly the FR-LIB-03 fields.
- `Meal = { id, name, mealType, calories, dietaryFlags: DietaryFlag[] }` — the `calories` field is what FR-REC-08 targets (the contract comment says so).

**The `Catalog` interface and its result types are NOT contract types.** Per the §3.6 class diagram the `Catalog` is the **server-local** content seam (`+findWorkouts(tier, prefs, n) Workout[]`, `+findMeals(calorieTarget, prefs) Meal[]`), authored here under `server/src/catalog/` — exactly like `RecommendationEngine` under `server/src/recommendation/`. Its §3.6 shape is binding, **with one requirement-driven refinement you author here:** the diagram's bare `Workout[]` / `Meal[]` return is wrapped in a result that carries FR-LIB-08's relaxation report (the diagram shows the *items*; FR-LIB-08 requires the catalog also **report what it relaxed**). Because the `Catalog` is server-local, this refinement is **not** a contract change.

```ts
// server/src/catalog/Catalog.ts  — server-local types (authored in this packet; interfaces/types are allowed in RED)
export type RelaxedConstraint = 'MEAL_TYPE' | 'WORKOUT_PREFERENCE' | 'CALORIE_TOLERANCE';

export interface CatalogResult<T> {
  readonly items: readonly T[];
  readonly relaxed: readonly RelaxedConstraint[]; // FR-LIB-08: which soft constraints were relaxed; [] when the full set was satisfied
  readonly satisfiable: boolean;                  // FR-LIB-08: false ⇒ the System "says so plainly"; items may be []
}

export interface WorkoutPreferences {
  readonly availableEquipment?: readonly string[]; // undefined / omitted ⇒ the DEFAULT preference set (no equipment restriction)
}

export interface Catalog {
  // FR-REC-03/FR-LIB-05: up to n distinct workouts AT the warranted tier (never above — FR-LIB-08 ceiling is hard).
  findWorkouts(tier: IntensityTier, prefs: WorkoutPreferences, n: number): CatalogResult<Workout>;
  // FR-REC-08/FR-LIB-07/08: meals near a calorie target; dietaryFlags are HARD; mealType is a SOFT constraint when given.
  findMeals(calorieTarget: number, dietaryPrefs: readonly DietaryFlag[], mealType?: MealType): CatalogResult<Meal>;
}
```

⚠️ **The default preference set (FR-LIB-05) is the unrestricted one** — `WorkoutPreferences` with no `availableEquipment`. "At least five per tier satisfying the default set" therefore means **≥5 seeded workouts exist at each tier**; equipment relaxation (FR-LIB-08) is exercised by a *restrictive* preference, not the default.

**⛔ STOP**: If you believe a **contract** type is wrong or insufficient — **do not change it.** Report what you need and why (§4.7). The server-local `Catalog` types above you *do* author here; the contract you do not touch.

---

## **MANDATORY**: What To Build (tests + throwing stubs / interfaces — NO working logic, NO seed data)

*State the obligation and the shape it must satisfy. **Do not write the mapping, the selection, or the seed data** — 11b GREEN derives all three from these tests.*

### `server/test/catalog/intensityTierMapping.test.ts` — FR-LIB-04, FR-LIB-03

- `resolveIntensityTier(category, level)` returns the tier from decision **(B)**, asserted for a **representative item of each source category** and the level rule: `('stretching','beginner')→LOW`, `('stretching','expert')→LOW`, `('strength','beginner')→LOW`, `('cardio','intermediate')→MODERATE`, `('strength','expert')→HIGH`, `('plyometrics','beginner')→HIGH`, `('powerlifting','intermediate')→MODERATE`, `('strongman','expert')→HIGH`. Cover **every** `category × level` you can enumerate — the mapping is total.
- **Every seeded workout resolves to exactly one tier** (FR-LIB-04 verification clause): iterate the seeded workout library (via the seed loader) and assert each `intensityTier` equals `resolveIntensityTier(sourceCategory, sourceLevel)` and is one of the three enum values. *(This is RED because the seed loader throws — it does not pass vacuously.)*
- **FR-LIB-03 duration:** every seeded workout's `typicalDurationMinutes` equals decision **(C)** for its tier (LOW 20 / MODERATE 30 / HIGH 45), and every FR-LIB-03 field (`name`, `intensityTier`, `typicalDurationMinutes`, `equipment`, `targetArea`) is present and non-empty.

### `server/test/catalog/WorkoutCatalog.test.ts` — FR-LIB-05, FR-REC-03, FR-LIB-08 (ceiling + equipment), FR-LIB-01

- **FR-LIB-05:** for **each** tier, the seeded library holds **≥5 distinct** workouts at that tier under the default preference set.
- **FR-REC-03:** `findWorkouts(tier, {}, 3)` returns exactly **3 distinct** workouts, **all at `tier`**, for every tier — the supply guarantee FR-REC-03's "offer three options" depends on. `relaxed` is `[]` (the default set is satisfiable).
- **FR-LIB-08 hard ceiling:** `findWorkouts(tier, prefs, n)` **never** returns a workout whose `intensityTier` is above `tier`. Assert for `tier = 'LOW'` that no `MODERATE`/`HIGH` workout is ever returned, under **any** preference and any `n` — including a restrictive `availableEquipment` that forces relaxation.
- **FR-LIB-08 equipment relaxation:** a restrictive `availableEquipment` that no at-tier workout satisfies yields a result whose `relaxed` contains `'WORKOUT_PREFERENCE'` and whose items are still **at or below** the tier (never above). Where even full relaxation cannot supply a workout, `satisfiable` is `false` — not a ceiling violation.
- **FR-LIB-01:** the query goes only through the `Catalog` interface; assert the caller obtains workouts **without** any knowledge of how the library was populated (no seed-shape leak in the return type — it returns `Workout`, the contract type).

### `server/test/catalog/MealCatalog.test.ts` — FR-LIB-06, FR-LIB-07, FR-LIB-08 (order + hard dietary), FR-REC-05, FR-LIB-01

- **FR-LIB-06:** every seeded meal carries `name`, `mealType`, a **positive `calories`** count, and `dietaryFlags`; assert the library is non-empty and every field present.
- **FR-REC-05 / FR-LIB-08 hard dietary — the negative, asserted exhaustively:** for **every** subset of `DietaryFlag` (all 2⁵ = 32 combinations) and across the **full calorie range** FR-REC-08 can produce, **every** meal `findMeals` returns satisfies the requested flags — **zero** violations, even when `satisfiable` is `false` and `items` is empty, and even after every soft relaxation. *(A meal "satisfies" `VEGAN` iff its `dietaryFlags` include `VEGAN`, etc. — GREEN owns the exact semantics of each flag, but the invariant "never return a meal lacking a requested flag" is absolute.)*
- **FR-LIB-07 ±10% sweep:** for **every** dietary combination and every daily target across the FR-REC-08 range (sweep e.g. `1500…4000` kcal in fixed steps — GREEN must cover whatever range this test asserts), a **day's plan** (BREAKFAST + LUNCH + DINNER, via a small test-side assembler that calls `findMeals` per slot against a split of the daily target) sums to within `[0.9 × target, 1.1 × target]`. Assert the boundary exactly.
- **FR-LIB-08 relaxation order (decision D):** construct a query no meal satisfies at the full constraint set and assert the catalog relaxes in the order **meal type → calorie tolerance** (equipment is workout-only, skipped for meals), reporting each in `relaxed`, and **never** dropping a dietary flag. Assert that a query relaxable only by widening tolerance reports `'CALORIE_TOLERANCE'` and **not** before it has tried relaxing `'MEAL_TYPE'`.
- **"Say so plainly" (FR-LIB-08):** a query whose dietary constraint no seeded meal can satisfy returns `satisfiable: false` with `items: []` — **not** a violating meal.
- **FR-LIB-01:** as above — querying only through the interface, return type is the contract `Meal`.

### `server/test/catalog/attribution.test.ts` — FR-LIB-10

- The repository records the seed source's **licence and attribution**: assert a provenance record (e.g. `server/src/catalog/attribution.ts` exporting a constant, or a committed `ATTRIBUTION.md` the module points at) exists and names **the source** (`free-exercise-db`) and **the licence** (`Unlicense`). *(RED because the provenance module is a throwing stub / absent — 11b adds it.)*

### Throwing stubs / interfaces (RED only — so the suite compiles and fails, carrying no answer or data)

- `server/src/catalog/Catalog.ts` — the `Catalog` interface + `CatalogResult`, `RelaxedConstraint`, `WorkoutPreferences` types shown above. **Types/interfaces only — no implementation.**
- `server/src/catalog/intensityTier.ts` — `resolveIntensityTier(category: string, level: string): IntensityTier`, a stub that **throws** `new Error('not implemented')`.
- `server/src/catalog/WorkoutCatalog.ts` — a class implementing `Catalog`'s `findWorkouts` (mirroring `server/src/reschedule/` structure) whose methods **throw**; plus a `seedWorkouts(): Workout[]` (or async loader) stub that **throws**.
- `server/src/catalog/MealCatalog.ts` — a class implementing `findMeals` whose methods **throw**; plus a `seedMeals(): Meal[]` stub that **throws**.
- `server/src/catalog/attribution.ts` — a throwing stub / absent export for the FR-LIB-10 record.

> ⚠️ **A stub returns nothing and computes nothing, and there is NO seed data in this packet.** If a "stub" compares a `category` to `'stretching'`, returns a tier, filters meals by calories, or contains even one real `Workout`/`Meal` literal, **it is the implementation / the seed** and this packet is compromised (§8.3). Revert and re-run RED. The seed data — the workouts derived from `free-exercise-db` and the hand-authored meal library — is **11b's** work, constrained by these tests.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/test/catalog/intensityTierMapping.test.ts`
- `server/test/catalog/WorkoutCatalog.test.ts`
- `server/test/catalog/MealCatalog.test.ts`
- `server/test/catalog/attribution.test.ts`
- `server/test/catalog/*` — a small local fixture/assembler helper if genuinely needed (a day-plan assembler for the FR-LIB-07 sweep). Keep it **in the frozen test dir** (NFR-MNT-08 — the whole dir is fingerprinted); do not scatter it into `server/test/support/`.
- `server/src/catalog/Catalog.ts`, `server/src/catalog/intensityTier.ts`, `server/src/catalog/WorkoutCatalog.ts`, `server/src/catalog/MealCatalog.ts`, `server/src/catalog/attribution.ts` — **throwing stubs / interfaces only**

## **CRITICAL**: Files You Must **NOT** Touch

- `shared/src/contract.ts` — the contract. Every type you need is already there; import it.
- `engine/**` — this path does not reach the engine (§4.3).
- `server/src/recommendation/**`, `server/src/reschedule/**`, `server/src/wearable/**`, `server/src/db/**`, `server/src/api/**` — existing surface; **reuse** it, do not modify it.
- **Any working catalog logic** — no tier comparison, no meal filtering, no relaxation loop, no seed literals. If you write a function that resolves a tier or selects a meal, you have written the implementation.
- **Any real seed data** — no `free-exercise-db` import, no meal library. That is 11b's.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] `npm run test` (server) shows the new suites **RED** — every new test fails, and fails **because a stub throws**, not because of a compile error.
- [ ] The diff contains **only** test files and throwing stubs / the `Catalog` interface + result types. **No working logic and no seed data anywhere.**
- [ ] **Every test name cites the requirement ID it verifies** — e.g. `it('FR-LIB-04: a beginner strength exercise resolves to LOW', …)`, `it('FR-LIB-08: findMeals never returns a meal lacking a requested dietary flag, across the full calorie range', …)`, `it('FR-LIB-07: a day plan is assemblable within ±10% for the VEGAN+GLUTEN_FREE combination at 2,850 kcal', …)`. This is the traceability matrix (Appendix B); the grader reads test output as evidence.
- [ ] The hard-constraint tests assert the **negative exhaustively** — zero dietary violations across all 32 combinations and the full calorie range (FR-REC-05/FR-LIB-08), zero above-ceiling workouts across every tier (FR-LIB-08) — and the ±10% tests assert the **boundary** exactly (NFR-COR-04).
- [ ] The relaxation test asserts the **documented order** (decision D) — `MEAL_TYPE` before `CALORIE_TOLERANCE`, dietary never relaxed — not merely that *some* relaxation happened.
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)* — a throwing stub still type-checks.
- [ ] The suite is **frozen** after the human gate: `npm run freeze -- --packet 11 --path server/test/catalog`. RED-freeze commit per §8.3. *(⚠️ Run `freeze` **after** the RED commit exists, so the recorded provenance sha points at the commit that contains the tests — not its parent. See the 25 Jul freeze-provenance note in `docs/TEAM-MEETING.md`.)*

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to Ryan — do not work around it — if:**

- A **contract** type does not fit what the `Catalog` needs (it should — every field is already there). Do **not** amend the contract yourself (§4.7).
- The server-local `Catalog` result shape above cannot express FR-LIB-08's "report which it relaxed" — surface it before it is frozen.
- **FR-LIB-07's "±10% for every dietary combination" appears infeasible** for the most restrictive combinations (e.g. `VEGAN + GLUTEN_FREE + DAIRY_FREE + NUT_FREE`) with a hand-authored library — this is a **requirements decision** (reduce the *offered* combinations? accept FR-LIB-08 calorie relaxation for the extreme combos?), **not** something a test may silently narrow. Say which combinations, and why. *(This is the packet's known scope risk — flagging it is a success.)*
- FR-LIB-07's assertion would require the test itself to contain a non-trivial meal-planning algorithm — a signal the "day plan" boundary between library-richness (here) and a planner (FR-REC-10, cut) needs the owner's line.
- Two requirements in scope appear to **contradict** each other — in particular FR-LIB-07's "within ±10% for every combination" versus FR-LIB-08's "relax the tolerance when nothing fits." (Say which, and how — the intended resolution is that FR-LIB-07 obliges the *library* to be rich enough and FR-LIB-08 is the *runtime* safety net, but if a test cannot honour both, stop.)
- Satisfying a requirement here would require touching a file on the **must NOT touch** list.

> **MANDATORY**: An escalation is a **success**, not a failure. **A RED packet that pins two seeded libraries, a total tier mapping, an exhaustive dietary-safety invariant, and a fixed relaxation order with zero escalations is the outcome to be suspicious of.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: This packet's single pass condition — **a frozen, RED test suite that pins, through the server-local `Catalog` interface: the deterministic FR-LIB-04 tier mapping (decision B) and per-tier durations (C) over every seeded workout (FR-LIB-03); ≥5 workouts per tier and 3 distinct at-tier options (FR-LIB-05, FR-REC-03); the meal library's ±10% coverage for every dietary combination across the FR-REC-08 range (FR-LIB-07); the absolute, never-relaxed dietary and intensity-ceiling constraints (FR-REC-05, FR-LIB-08) asserted as exhaustive negatives; the documented soft-relaxation order and its "say so plainly" terminus (FR-LIB-08, decision D); and the recorded seed provenance (FR-LIB-10) — with no mapping logic, no selection logic, and no seed data that answers any of it.**

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it — an agent that silently resolves a contradiction has made a requirements decision nobody agreed to.
