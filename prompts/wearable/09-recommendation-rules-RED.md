# CRITICAL REQUIREMENTS — 09 Recommendation Rules (RED)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Write **only** the failing test suite and the throwing stubs it needs — **no working rule logic**. This packet is one reviewable diff with one human owner.

| | |
|---|---|
| **Phase** | 🔴 RED (tests + throwing stubs / interfaces only) |
| **Human owner** | Ryan Woosley — *the Data & Wearable Integration Lead, who owns the two metrics these rules consume (OPEN-01/02) and the wellness views that will display their output (packets 14/15).* |
| **Depends on** | 03 (the contract) · **08/08b** (the Daily Metric Set — these rules consume `DailyMetricSet`/`Metric`, nothing source-specific). This path does **not** touch the engine (`docs/AGENTIC-TDD-WORKFLOW.md` §8: "The engine is not on it"). |
| **Spec** | `docs/SRS-v2.md` §3.8.7 (FR-REC), NFR-COR-04, NFR-ROB-01, DR-02 |
| **Sibling** | **10 GREEN** makes this suite pass. A *different agent session* writes it (§4.6). |

> **⚠️ PREREQUISITE GATE — the owner must clear this before running this packet.** This packet imports **new** contract types — **`Recommendation`, `Decision`, `CalorieTarget`, `RecommendationReason`** — which the §3.6 class diagram names but which do **not** exist in `shared/src/contract.ts` yet. Under §4.7 the contract is frozen and human-owned; adding them is a **team decision with a decision-log row and an SRS revision**, ratified and committed **before** this RED session runs — exactly as `Task.recurrence` (SRS v2.19) preceded packet 12, and as packet 08 first confirmed its metric types sufficed. **Do not author these types from inside this packet, and do not proceed if any is absent — STOP and report.** The `RecommendationRule` interface and `RecommendationEngine` (also §3.6) are **not** contract types (see "The Contract") and are created here.

> **⚠️ Phasing note for the owner — ratify or overrule before running.** The build order lists "09 rules RED → 10 GREEN" as a RED/GREEN pair, exactly like 04→05, 06→07, 08→08b, because the rules in scope are marked **(T)** and §4.6 forbids one agent writing both a `(T)` test and the code it tests. The `(D)`/`(I)` obligations in §3.8.7 are demonstrated or guarded elsewhere — see "Out Of Scope".

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`. Do not paraphrase. The SRS's phrasing is load-bearing — *"the recommendation shall be **labeled** as made without current data"* is a testable obligation.

- **FR-REC-01.** *(Essential, T)* The System shall map sleep score to recommended **intensity tier**:

  | Sleep score | Intensity tier |
  |---|---|
  | 0 – 49 | LOW |
  | 50 – 74 | MODERATE |
  | 75 – 100 | HIGH |

  *Verification: inject a score at each boundary (49, 50, 74, 75) per FR-WER-07 and assert the tier.*

- **FR-REC-06.** *(Essential, T)* Where a metric a rule needs is unavailable, that rule shall fall back to a **documented default**, and the recommendation shall be labeled as made without current data. **No rule shall fail, block, or leave a slot empty for want of a metric.** Defaults: sleep score unavailable → **MODERATE**; active calories unavailable → the **baseline calorie target**.

- **FR-REC-08.** *(Essential, T)* The System shall compute a **daily calorie target** as the baseline target plus the active calories recorded for that date, and generate meal recommendations against it. Because calories accrue during the day (ASM-03), the target for today shall be recomputed on refresh and presented as a **current, not final** figure.

  *Verification: inject an active-calorie value and assert the target moves by exactly that amount; inject unavailable and assert fallback to baseline.*

- **FR-REC-11.** *(Essential, I)* Each mapping from metrics to a recommendation shall be an **independent, registered rule** declaring the metrics it consumes, the decision it produces, and its fallback. The engine shall evaluate registered rules **without knowledge of any rule's content.** Consequently **adding a metric shall be two additions and no modifications**: add it to the metric set, register a rule that consumes it. Verified by inspection: no existing rule, and no code in the scheduler, task model, or dashboard, requires editing to introduce a new one.

  > ℹ️ **Superseded wording — this packet ran on 25 Jul against SRS v2.26 and the quote above is left as it was read.** At **v2.32** (27 Jul, OPEN-29) the verification clause dropped *"or dashboard"* and now reads *"…no code in the scheduler, the task model, or the persistence layer's structure…"* — **FR-WER-04 and FR-REC-11 make no claim about the view layer** (the generic-rendering obligation is **FR-WEL-01**'s, verified by demonstration; corrected at v2.34). **Nothing this packet specifies changes**: it pins the rules and the content-agnostic engine, neither of which the dashboard clause ever touched. **On a replay, quote the SRS as it stands, not this line** (§0.1 — the SRS is the source of truth; a packet's quote is a snapshot).

- **FR-REC-13.** *(Essential, D)* Every recommendation shall be accompanied by **the reason it was made, naming the metric and value** — e.g. *"Recovery session — your sleep score was 42 last night"*, or *"2,850 kcal today — you burned 850 active calories."* Where made under a fallback, the reason shall say so.

- **NFR-COR-04.** *(Essential, T)* The sleep-to-intensity mapping (FR-REC-01) and the calorie-target computation (FR-REC-08) shall be correct **at their boundaries**, verified by injecting values at each threshold.

- **NFR-ROB-01.** *(Essential, T)* **Missing data shall never be silently substituted.** An absent metric and a measured zero shall remain distinguishable at every layer (FR-WER-06, DR-02), and a rule lacking its metric shall fall back to a **documented default** and say so (FR-REC-06).

### ⛔ ATTENTION ANCHOR — the boundaries are EXACT

**FR-REC-01's thresholds are `49 → LOW`, `50 → MODERATE`, `74 → MODERATE`, `75 → HIGH`.** An off-by-one in a test here becomes a **permanent green off-by-one in the rule** — packet 10 implements exactly what these tests assert, and the freeze makes it forever. Assert all four boundary values, plus a measured `0` (a real rest-day zero for active calories, distinct from unavailable — DR-02).

### **CRITICAL**: Explicitly Out Of Scope — write no code and no test for these here

- **FR-REC-02, FR-REC-04** *(replace an over-tier workout and **place it via the engine**)* — the **load-bearing wiring**, owned by Patrick's acceptance suite **17a RED / 17b GREEN**. This packet pins the *decision* (what tier a score warrants); it never creates a task, calls the engine, or reschedules. §4.3: there is exactly one placement function and it is not here.
- **FR-REC-03, FR-REC-05** *(three library options; dietary constraint never violated)* — need the workout/meal libraries (**packet 11**) and are TDD'd there.
- **FR-REC-07** *(eligibility: not reducing a complete workout, not replacing one underway)* — needs real occurrence state and window/clock comparison; belongs to the wiring layer, not a pure rule.
- **FR-REC-09** *(record a baseline calorie target)* — a user-preference/persistence concern, not a rule. This packet **receives** the baseline as an input; it never asks for or stores it (CON-05, §4.9: the System asks, it does not estimate).
- **FR-REC-10, FR-REC-12** *(Conditional)* — deferred until all Essential work is verified (§6).
- **The FR-REC-11 executable guard** — packet **16b** (Patrick) enforces "adding a metric is an addition, not a modification" by inspection. This packet builds the `RecommendationEngine` *shape* that guard will check; it does not write the guard.

---

## **MANDATORY**: The Contract

**CRITICAL**: You **import** every domain type from `shared/src/contract.ts`. You **may not redefine, extend, widen, or shadow** any type in it.

The types this packet consumes and produces:

- `IntensityTier = 'LOW' | 'MODERATE' | 'HIGH'` — the decision `SleepToIntensityRule` produces (§3.6). **Already in the contract.**
- `Metric` — the **discriminated union** on `isAvailable`. On the `false` branch `value` **does not exist**. This is what makes FR-REC-06/NFR-ROB-01 structural: code that reads `value` without checking availability **does not compile**, so the fallback cannot be forgotten silently. **Already in the contract.**
- `DailyMetricSet` — `{ date; metrics: Readonly<Record<string, Metric>> }`, keyed by metric name (`'sleepScore'`, `'activeCalories'`). The **only** representation of wearable data a rule sees (FR-WER-02). **Already in the contract.**
- **`Decision`**, **`CalorieTarget`**, **`Recommendation`**, **`RecommendationReason`** — the recommendation output types the §3.6 class diagram names, **added to `shared/src/contract.ts` by the amendment in the PREREQUISITE GATE above.** `Decision` is what a rule's `apply()`/`fallback()` returns; `Recommendation` (a `Decision` + a `RecommendationReason`) is what the engine's `recommend()` returns. **Import them; do not define them. If any is absent, STOP and report — the gate was not cleared.**

**The `RecommendationRule` interface and `RecommendationEngine` are NOT contract types.** Per the §3.6 class diagram they are the **server-local** recommendation abstraction, authored here under `server/src/recommendation/` — exactly like `RescheduleService`/`WearableAdapter`, which the same diagram names but which live under `server/`. Their §3.6 shape is binding:

- `RecommendationRule` *(interface — a type, allowed in RED, as packet 08 declared `WearableAdapter`)*: `requiredMetrics(): string[]`, `fallback(): Decision`, `apply(metrics: DailyMetricSet): Decision`.
- `RecommendationEngine`: `register(rule: RecommendationRule): void`, `recommend(metrics: DailyMetricSet): Recommendation[]`.

⚠️ **Division of labor (this is what makes FR-REC-06/11/13 testable in isolation):** the **rule** owns the pure mapping (`apply`) and its own fallback *value* (`fallback`); the **engine** owns availability-checking and reason-building — it inspects `requiredMetrics()` against the set, calls `apply` when they are all available or `fallback` when any is not, and attaches the `RecommendationReason` (`usedFallback`, the driving `metricName`/`metricValue`). This keeps `apply → Decision` exactly as §3.6 draws it. ⛔ **`RecommendationEngine`'s `Catalog` and `SchedulingEngine` collaborators (§3.6: "draws from", "places via") are OUT of scope** — that is FR-REC-03 (packet 11) and FR-REC-04 (packet 17). This packet builds only `recommend`/`register` over rules.

**⛔ STOP**: If you believe the contract is wrong or insufficient — **do not change it.** Report what you need and why (§4.7). It is a team decision with a row in `docs/TEAM-MEETING.md`, not a refactor.

---

## **MANDATORY**: What To Build (tests + throwing stubs / interfaces — NO working logic)

*State the obligation and the shape it must satisfy. **Do not write the rule logic** — 10 GREEN derives it from these tests.*

### `server/test/recommendation/SleepToIntensityRule.test.ts` — FR-REC-01, 13, NFR-COR-04

- `apply(metrics)` on a `DailyMetricSet` whose `metrics['sleepScore']` is an **available** metric returns a `Decision` of kind `WORKOUT_INTENSITY` whose `tier` follows FR-REC-01's table. **Assert every boundary: 49→LOW, 50→MODERATE, 74→MODERATE, 75→HIGH**, plus at least one interior value per tier and the endpoints `0→LOW`, `100→HIGH`.
- `requiredMetrics()` returns `['sleepScore']`; `fallback()` returns the `WORKOUT_INTENSITY` decision **MODERATE** (FR-REC-06's documented default). *(The rule owns the fallback **value**; the engine owns **when** it is used — see the engine test.)*

### `server/test/recommendation/CaloriesToTargetRule.test.ts` — FR-REC-08, 13, NFR-COR-04, DR-02

- Constructed with a **baseline** target (rule state — the baseline is a user preference per FR-REC-09, **not** a metric), `apply(metrics)` returns a `CALORIE_TARGET` decision whose `calorieTarget` is **baseline + activeCalories, exactly** — assert the target moves by exactly the injected amount.
- **DR-02 — the measured zero:** `activeCalories` available with `value: 0` (a real rest day) yields `calorieTarget === baseline` (moved by 0). This is a genuine `apply` result, **not** a fallback — and the engine test below asserts it carries `usedFallback: false`, distinguishing it from the unavailable case.
- `requiredMetrics()` returns `['activeCalories']`; `fallback()` returns the `CALORIE_TARGET` decision **= baseline** (FR-REC-06).

### `server/test/recommendation/RecommendationEngine.test.ts` — FR-REC-06, 11, 13, NFR-ROB-01

- `recommend(metrics)` returns one `Recommendation` per **registered** rule; each bundles the rule's `Decision` with a `RecommendationReason`.
- **FR-REC-06 / NFR-ROB-01 — fallback is the ENGINE's call:** where a rule's `requiredMetrics()` are all **available**, the engine uses `apply` and the reason carries `usedFallback: false` with the driving `metricName`/`metricValue`; where **any is unavailable**, the engine uses the rule's `fallback()` and the reason carries `usedFallback: true` and `metricValue: null`. ⚠️ Assert the **measured-zero vs unavailable** pair: both may yield the same numeric target, but the *reason* differs — that difference is the whole point of DR-02.
- **FR-REC-11 — content-agnostic:** `recommend`'s logic **does not branch on any rule's identity or content**. Pin it behaviorally: register a **test-only dummy rule** declaring a third metric name and assert its recommendation flows through **with no change to the engine** — adding a rule is `register()` only. This is the property packet 16b's guard later enforces by inspection.
- A registered rule whose declared metric is unavailable still yields a recommendation (its fallback), never an error or an empty result — **no rule shall fail, block, or leave a slot empty for want of a metric** (FR-REC-06).

### Throwing stubs / interfaces (RED only — so the suite compiles and fails, carrying no answer)

- `server/src/recommendation/RecommendationRule.ts` — the **`RecommendationRule` interface** (a type; allowed in RED) per §3.6: `requiredMetrics()`, `fallback()`, `apply()`. **No implementation.**
- `server/src/recommendation/RecommendationEngine.ts` — a class (mirroring how `server/src/reschedule/` is structured) whose `register`/`recommend` **throw** `new Error('not implemented')`.
- `server/src/recommendation/SleepToIntensityRule.ts`, `server/src/recommendation/CaloriesToTargetRule.ts` — the two rules (implementing `RecommendationRule`), whose methods **throw**.

> ⚠️ **A stub returns nothing and computes nothing.** If a "stub" reads a `sleepScore`, compares it to `50`, or adds `activeCalories` to a baseline, **it is the implementation** and this packet is compromised (§8.3). Revert and re-run RED.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/test/recommendation/SleepToIntensityRule.test.ts`
- `server/test/recommendation/CaloriesToTargetRule.test.ts`
- `server/test/recommendation/RecommendationEngine.test.ts`
- `server/test/support/*` — only if a shared fixture helper for building a `DailyMetricSet` is genuinely needed (reuse `server/test/wearable/wearableFixtures.ts`'s pattern; do not duplicate it).
- `server/src/recommendation/RecommendationRule.ts`, `server/src/recommendation/RecommendationEngine.ts`, `server/src/recommendation/SleepToIntensityRule.ts`, `server/src/recommendation/CaloriesToTargetRule.ts` — **throwing stubs / interface only**

## **CRITICAL**: Files You Must **NOT** Touch

- `shared/src/contract.ts` — the contract. *(The `Recommendation`/`Decision`/`CalorieTarget`/`RecommendationReason` amendment is a **separate**, already-committed change — the PREREQUISITE GATE. This packet does not edit the contract.)*
- `engine/**` — this path does not reach the engine (§4.3).
- `server/src/db/**`, `server/src/api/**`, `server/src/reschedule/**`, `server/src/wearable/**` — existing surface; **reuse** it, do not modify it.
- **Any working rule logic** — no tier comparison, no addition, no availability branching that decides an answer. If you write a function that computes the recommendation, you have written the implementation.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] `npm run test` (server) shows the new suites **RED** — every new test fails, and fails **because the stub throws**, not because of a compile error.
- [ ] The diff contains **only** test files and throwing stubs / the `RecommendationRule` interface. **No working logic anywhere.**
- [ ] **Every test name cites the requirement ID it verifies** — e.g. `it('FR-REC-01: a sleep score of exactly 75 warrants the HIGH tier', …)` and `it('FR-REC-06: an unavailable sleep score makes the engine use the MODERATE fallback and say so', …)`. This is the traceability matrix (Appendix B); the grader reads test output as evidence.
- [ ] The boundary tests assert **49, 50, 74, 75** explicitly by value (NFR-COR-04), and the calorie tests assert the **measured-zero vs unavailable** distinction by reason, not only by number (DR-02, NFR-ROB-01).
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)* — a throwing stub still type-checks.
- [ ] The suite is **frozen** after the human gate: `npm run freeze -- --packet 09 --path server/test/recommendation`. RED-freeze commit per §8.3. *(⚠️ Run `freeze` **after** the RED commit exists, so the recorded provenance sha points at the commit that contains the tests — not its parent. See the 25 Jul freeze-provenance note in `docs/TEAM-MEETING.md`.)*

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to Ryan — do not work around it — if:**

- **`Recommendation`/`Decision`/`CalorieTarget`/`RecommendationReason` are not in `shared/src/contract.ts`.** The PREREQUISITE GATE was not cleared; this packet cannot run. Do **not** define the types yourself.
- You need any **other** change to the contract, or the amended types do not fit what §3.6 / FR-REC-13 require.
- A sleep score in a fixture falls **outside 0–100**, or an `activeCalories` value is **negative** — FR-REC-01's table and FR-WER-03's `≥ 0` do not specify these. **Do not invent clamping or a rule and encode it.**
- Two requirements in scope appear to **contradict** each other. (Say which, and how.)
- Making `RecommendationEngine.recommend` **content-agnostic** (FR-REC-11) appears impossible without knowing a rule's identity — that is a design signal worth surfacing before it is frozen.
- Satisfying a requirement here would require touching a file on the **must NOT touch** list.

> **MANDATORY**: An escalation is a **success**, not a failure. **A RED packet that pins two boundary-sensitive rules and a content-agnostic engine with zero escalations is the outcome to be suspicious of.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: This packet's single pass condition — **a frozen, RED test suite that pins the two §3.6 rules (`SleepToIntensityRule`, `CaloriesToTargetRule`) at their exact boundaries (FR-REC-01 sleep→tier at 49/50/74/75; FR-REC-08 target = baseline + active calories), the `RecommendationEngine`'s documented fallbacks with a "no current data" label (FR-REC-06, NFR-ROB-01), the measured-zero-vs-unavailable distinction (DR-02), the reason substrate (FR-REC-13), and a content-agnostic engine (FR-REC-11) — and no implementation that answers any of it.**

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it — an agent that silently resolves a contradiction has made a requirements decision nobody agreed to.
