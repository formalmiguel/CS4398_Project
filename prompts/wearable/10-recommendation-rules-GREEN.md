# CRITICAL REQUIREMENTS — 10 Recommendation Rules (GREEN)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Make the **already-frozen** packet 09 test suite pass by writing **only** implementation, in **only** the stub files listed. You **may not edit, skip, rename, or weaken a single test or fixture** — not to fix a typo, not to correct an assertion you believe is wrong. If you believe a test is wrong, **STOP and escalate** (§4.6).

| | |
|---|---|
| **Phase** | 🟢 GREEN (implementation only) |
| **Human owner** | Ryan Woosley |
| **Depends on** | **09 RED (frozen at `59f4e8a` — the RED commit; manifest committed `f5b3d74`)** — the suite you implement against. Also 03 (the contract, amended v2.26) and packet 08's `DailyMetricSet`/`Metric`. |
| **Spec** | `docs/SRS-v2.md` §3.8.7 (FR-REC), §3.6 (class diagram), NFR-COR-04, NFR-ROB-01, DR-02; the frozen tests are the executable form. |

> **The suite is frozen. It is the specification in executable form.** `npm run guard:tests-frozen` fails the build if any file under `server/test/recommendation/` changes. Your job is to make **27 red tests green without touching one of them.**

---

## **MANDATORY**: Requirements In Scope

> Quoted **VERBATIM** from `docs/SRS-v2.md`. The frozen tests pin each; the requirement text is why.

- **FR-REC-01.** *(Essential, T)* Map sleep score to intensity tier: **0–49 → LOW, 50–74 → MODERATE, 75–100 → HIGH.** *(Boundaries 49/50/74/75 asserted by literal value — NFR-COR-04.)*
- **FR-REC-06.** *(Essential, T)* Where a metric a rule needs is unavailable, fall back to a **documented default** and label the recommendation as made without current data. **No rule shall fail, block, or leave a slot empty for want of a metric.** Defaults: sleep unavailable → **MODERATE**; active calories unavailable → the **baseline** target.
- **FR-REC-08.** *(Essential, T)* Compute the **daily calorie target** as **baseline + active calories** for the date.
- **FR-REC-11.** *(Essential, I)* Each mapping is an **independent, registered rule** declaring the metrics it consumes, the decision it produces, and its fallback. The engine evaluates registered rules **without knowledge of any rule's content.**
- **FR-REC-13.** *(Essential, D)* Every recommendation carries **the reason it was made, naming the metric and value**; where made under a fallback, the reason says so.
- **NFR-ROB-01.** *(Essential, T)* **Missing data shall never be silently substituted.** An absent metric and a measured zero stay distinguishable (FR-WER-06, DR-02); a rule lacking its metric falls back to a documented default and says so.
- **DR-02.** distinguish "no data" from a **measured zero**, per metric.

### **CRITICAL**: Explicitly Out Of Scope — do not build these here

- **FR-REC-02/04** *(replace an over-tier workout and place it via the engine)* — the wiring, packets 17a/17b. **This packet computes decisions; it creates no task, calls no scheduling engine, reschedules nothing** (§4.3).
- **FR-REC-03/05** *(three library options; dietary constraint)* — need the libraries, packet 11.
- **FR-REC-07/09** *(eligibility; recording the baseline)* — the baseline is **received** as constructor state, never asked for or stored here (CON-05, §4.9).
- **`RecommendationEngine`'s `Catalog` and `SchedulingEngine` collaborators** (§3.6: "draws from" / "places via") — packets 11/17. Build **only** `recommend`/`register` over rules.
- **FR-REC-13's rendered English sentence** — a view concern (packets 14/15). Produce only the machine-readable reason substrate the tests assert.
- **Editing the contract, the `RecommendationRule` interface, or any test.**

---

## **MANDATORY**: The Contract

**CRITICAL**: Import every domain type from `@capstone/shared` — `Decision`, `Recommendation`, `RecommendationReason`, `CalorieTarget`, `IntensityTier`, `Metric`, `DailyMetricSet` (added/confirmed by SRS v2.26). `Metric` is a **discriminated union on `isAvailable`** — the unavailable branch **has no `value`**. Read a metric's `value` **only after** narrowing on `isAvailable === true`; that narrowing is how FR-REC-06/NFR-ROB-01 stay structural.

**⛔ STOP** if the contract or the `RecommendationRule` interface seems insufficient — do not change either. Report it (§4.7).

---

## **MANDATORY**: What To Build

Implement the throwing stubs. Signatures and source types already exist (RED) — **derive the bodies from the frozen tests.** The `RecommendationRule` interface (`requiredMetrics()`, `fallback()`, `apply()`) is **complete — do not touch it.**

### `server/src/recommendation/SleepToIntensityRule.ts` — implements `RecommendationRule`

- **`apply(metrics): Decision`** — read `metrics['sleepScore']` (available branch) and map its `value` to a tier per FR-REC-01: `value <= 49 → LOW`, `50–74 → MODERATE`, `>= 75 → HIGH`. Return `{ kind: 'WORKOUT_INTENSITY', tier }`. *(The boundaries are exact — the frozen tests assert 49/50/74/75.)*
- **`requiredMetrics(): string[]`** → `['sleepScore']`.
- **`fallback(): Decision`** → `{ kind: 'WORKOUT_INTENSITY', tier: 'MODERATE' }` (the value only — the engine decides *when* it is used).

### `server/src/recommendation/CaloriesToTargetRule.ts` — implements `RecommendationRule`

- Constructed with a **`baseline: number`** (a user preference, FR-REC-09 — **received**, never stored or asked for here).
- **`apply(metrics): Decision`** — read `metrics['activeCalories']` (available branch) and return `{ kind: 'CALORIE_TARGET', calorieTarget: baseline + value }`. **A measured `value: 0` yields `baseline` exactly** — a real result, not a fallback (DR-02).
- **`requiredMetrics(): string[]`** → `['activeCalories']`.
- **`fallback(): Decision`** → `{ kind: 'CALORIE_TARGET', calorieTarget: baseline }`.

### `server/src/recommendation/RecommendationEngine.ts` — `register()`, `recommend()`

- **`register(rule): void`** — hold the rule. **`recommend(metrics): Recommendation[]`** — return **one `Recommendation` per registered rule**, in nothing more than the order they were registered (the tests assert count, not order).
- ⚠️ **The engine owns availability and the reason; the rule owns the mapping and its fallback value.** For each rule: if **every** name in `rule.requiredMetrics()` is present in `metrics` **and** `isAvailable`, use `rule.apply(metrics)` and a reason `{ metricName, metricValue, usedFallback: false }`; otherwise use `rule.fallback()` and a reason `{ metricName, metricValue: null, usedFallback: true }`. Bundle each `Decision` with its `RecommendationReason` into a `Recommendation`.
  - `metricName` is the rule's (single) required metric; `metricValue` is that metric's `value` on the available path — **including a measured `0`** — and `null` on the fallback path. **This is the DR-02 distinction: a measured zero and an unavailable metric produce the same number but different reasons.**
- ⛔ **FR-REC-11 — content-agnostic:** `recommend` must **not branch on any rule's identity or concrete type.** It calls only the interface methods. A rule the engine has never seen (the frozen suite registers a dummy one) must flow through unchanged — this is what makes "adding a metric is two additions, no modifications" true, and what packet 16b will later guard.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/recommendation/SleepToIntensityRule.ts`
- `server/src/recommendation/CaloriesToTargetRule.ts`
- `server/src/recommendation/RecommendationEngine.ts`

## **CRITICAL**: Files You Must **NOT** Touch

- **Every file under `server/test/recommendation/`** — the frozen suite (all three `*.test.ts`, including their inlined builders and the `DummyStressRule` double). Not one character.
- `scripts/frozen-tests.json` — the freeze manifest. **Re-running `npm run freeze` to go green is editing the test one level removed (§8.3).**
- `shared/src/contract.ts`; `server/src/recommendation/RecommendationRule.ts` (the interface — complete); any `server/src/db/**`, `server/src/api/**`, `server/src/reschedule/**`, `server/src/wearable/**`, or other package.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] `npm run test` (server): the **27** packet-09 tests pass; every pre-existing server test still passes. No test was changed to achieve this.
- [ ] **`npm run guard:tests-frozen` passes** — `P09 … unchanged` (and P04/P06/P08). This is non-negotiable.
- [ ] **`git diff --stat 59f4e8a -- server/test/recommendation/` is EMPTY.** Nothing in the frozen suite changed.
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*.
- [ ] `npm run verify` is **green end to end** — this branch now passes for the first time (RED + GREEN together, §8.5), so it is ready to merge to `dev`.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to Ryan — do not work around it — if:**

- You **cannot make a test pass and believe the test is wrong.** Report it; a human adjudicates against the SRS. **Do not edit it.**
- A test appears to contradict the contract, the `RecommendationRule` interface, the SRS, or another test. Say which.
- Making a test pass would require touching a **must-NOT-touch** file — in particular, if you feel the urge to adjust the interface, a fixture, or the manifest.
- Making `recommend` content-agnostic (FR-REC-11) seems to require knowing a rule's concrete type. That is a design smell worth reporting, not coding around.

> An escalation is a **success**. But note: this suite was written by a fresh RED session and its escalations were already adjudicated at the RED gate (decision log, 25 Jul — single-metric reason deferred to FR-REC-12; ordering left unpinned) — so a clean GREEN with no surprises is a plausible, good outcome here, unlike a RED run.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: This packet's single pass condition — **the 27 frozen packet-09 tests are green, `guard:tests-frozen` passes, `npm run verify` is green, and not one test or manifest entry changed.**

**CRITICAL**: Where this prompt and a frozen test disagree, **the test wins and this prompt is a defect** — report it, do not reconcile it by editing the test. Where this prompt and `docs/SRS-v2.md` disagree, the SRS wins.
