# CRITICAL REQUIREMENTS — 08 Wearable Adapter + Daily Metric Set (RED)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Write **only** the failing test suite and the fixtures and throwing stubs it needs — **no working implementation**. This packet is one reviewable diff with one human owner.

| | |
|---|---|
| **Phase** | 🔴 RED (tests + derived fixtures + throwing stubs only) |
| **Human owner** | Ryan Woosley — *the Data & Wearable Integration Lead, who has read the real export (OPEN-01/02) and derived the fixtures below.* |
| **Depends on** | 03 (the contract). Nothing else — this path does **not** touch the engine (`docs/AGENTIC-TDD-WORKFLOW.md` §8: "The engine is not on it"). |
| **Spec** | `docs/SRS-v2.md` §3.9 (FR-WER), §5 (DR-02/04/05), §3.5–3.6 (ERD / class diagram) |
| **Sibling** | **08b GREEN** makes this suite pass. A *different agent session* writes it (§4.6). |

> **⚠️ Phasing note for the owner — ratify or overrule before running.** The build order lists "08 adapter + Daily Metric Set" as one item. It is being realized as a **RED/GREEN pair** (this packet + 08b), exactly like 04→05 and 06→07, because three requirements in scope — FR-WER-02, FR-WER-06, FR-WER-09 — are marked **(T)**, and §4.6 forbids one agent writing both a `(T)` test and the code it tests. `docs/AGENTIC-TDD-WORKFLOW.md` §3.5 prescribes this precisely — *"Explore → fixture from real data → RED → GREEN"* — and it was deferred **only** because nobody had seen the export. **OPEN-01 closed that.** The `(D)` obligations (FR-WER-08, FR-WER-10) are demonstrated, not tested — see "Out Of Scope".

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`. Do not paraphrase. The SRS's phrasing is load-bearing.

- **FR-WER-01.** *(Essential, T)* The System shall obtain the user's health data for a date from a **wearable data source**, and shall be **indifferent to which source supplied it**.
- **FR-WER-02.** *(Essential, T)* The System shall normalize data from any source into a **Daily Metric Set**: named metrics, each with a value, unit, and availability flag. This is the **only** representation of wearable data any downstream component sees.
- **FR-WER-03.** *(Essential, T)* The Daily Metric Set shall contain, in this release, **sleep score** (0–100 → workout intensity, FR-REC-01) and **active calories** (kcal, ≥ 0 → daily calorie target, FR-REC-08). This is the complete set of wearable metrics driving recommendations.
- **FR-WER-05.** *(Essential, I)* All data sources shall sit behind a **single adapter interface** whose output is the Daily Metric Set. No component downstream shall reference a source-specific field, file format, or API response shape.
- **FR-WER-06.** *(Essential, T)* **Each metric shall carry its own availability flag.** Where a source supplies no value for a metric on a date, that metric is recorded unavailable. The System shall **not** record a fabricated, zero, or default value that could be mistaken for a real measurement, and **the absence of one metric shall not render the others unavailable.**
- **FR-WER-09.** *(Essential, T)* Ingestion shall be **idempotent**: ingesting the same export twice shall not duplicate metric records; re-ingesting a date shall update rather than duplicate.
- **DR-02.** *(Essential, I)* A metric record shall distinguish **"no data available" from a measured zero** — per metric, not per date.
- **DR-04.** *(Essential, I)* A metric record shall record its **origin**, and an **injected value shall be distinguishable from a measured one.**
- **DR-05.** *(Essential, I)* Metrics shall be stored such that introducing a new metric requires **no change to the stored shape and no change to any existing reader** — **one document per metric per date.**

### **CRITICAL**: Explicitly Out Of Scope — write no code and no test for these here

- **FR-WER-08, FR-WER-10** *(Essential, **D**)* — demonstrated by the owner pointing the adapter at the **real** Garmin export, not by a unit test (§3.5: "(D) → Do NOT TDD it"). FR-WER-10's *decision* half needs the recommendation rules, which are **packets 09/10**.
- **FR-WER-07** *(injection endpoint/UI)* — the store must not *prevent* an `INJECTED` origin (DR-04's `MetricOrigin` already carries it), but the injection API surface is a later packet.
- **FR-REC-01/02/06/08** *(the rules that consume the metrics)* — **packets 09 RED / 10 GREEN.** This packet stops at the Daily Metric Set; it never maps a score to a tier or a calorie target.
- **FR-WER-11** *(live API)* — Conditional; deferred until all Essential work is verified (§6).

---

## **MANDATORY**: The Contract

**CRITICAL**: You **import** every domain type from `shared/src/contract.ts`. You **may not redefine, extend, widen, or shadow** any type in it.

The types this packet needs **already exist** and are sufficient — do **not** add to the contract:

- `Metric` — a **discriminated union** on `isAvailable`. On the `false` branch `value` **does not exist**. This is what makes DR-02/FR-WER-06 structural: an adapter that writes `value: 0` for an unmeasured night does not type-check.
- `MetricOrigin = 'EXPORT' | 'LIVE_API' | 'INJECTED'` — DR-04's origin. The Garmin export produces `'EXPORT'`.
- `DailyMetricSet` — `{ date: IsoDate; metrics: Readonly<Record<string, Metric>> }`. **Keyed by metric name**, not a `{ sleepScore, activeCalories }` struct — this is FR-WER-04/DR-05 by construction.

**⛔ STOP**: If you believe the contract is wrong or insufficient — **do not change it.** Report what you need and why (§4.7). It is a team decision with a row in `docs/TEAM-MEETING.md`, not a refactor.

---

## **MANDATORY**: What To Build (tests, fixtures, and throwing stubs — NO working logic)

*State the obligation and the shape it must satisfy. **Do not write the implementation** — 08b GREEN derives it from these tests.*

### Fixtures — `server/test/fixtures/wearable/` — DERIVED from the real export, never copied

> ⛔ **§8.4: the real Garmin export never enters the repo.** These fixtures are **hand-authored, minimal JSON derived from the shapes Ryan read** — the two source files' relevant keys only, with values chosen to exercise each case below. A real person's health record does not travel with the branch.

Author small fixtures that reproduce **these real properties** (all recorded in OPEN-01/02/20):

- A day with **both** metrics present (e.g. active kcal + a sleep `overallScore`).
- **`sleepScores.overallScore: null`** on a record marked `ENHANCED_CONFIRMED_FINAL` — FR-WER-06's unavailable branch occurring **naturally**. (Real: 2024-01-11, 2024-09-19.) An adapter doing `score ?? 0` must be caught here.
- **`activeKilocalories: 0.0` WITH `totalSteps` present** → a **real measured zero** (available, value 0). *(Real: 2026-03-17, 26 steps.)*
- **`activeKilocalories: 0.0` WITHOUT `totalSteps`** → **unavailable**. *(The OPEN-20 discriminator — see the constraint below.)*
- A boundary sleep score of **exactly 75** (a named FR-REC-01 boundary; asserted downstream in 09/10, but preserve it here).
- Two source records for the **same `calendarDate`** across a re-ingest, to drive FR-WER-09.

### ⛔ STATED CONSTRAINT — OPEN-20 (given, not inferred)

**The absent-vs-measured-zero discriminator for active calories is the presence of the `totalSteps` key.** `totalSteps` present → the day was measured, so `activeKilocalories: 0.0` is a **real zero** (`Metric` available, `value: 0`). `totalSteps` absent → **unavailable**. Do **not** use `includesActivityData` (it carries 721 kcal with `false` on 2026-02-13 — it tracks something else). This rule is a **team decision** (decision log, 25 Jul); the tests assert it, and 08b implements exactly it. An agent must **not** substitute a different rule.

### `server/test/wearable/GarminExportAdapter.test.ts` — FR-WER-01, 02, 03, 06, DR-02, DR-04

- Parsing a derived export fixture yields a `DailyMetricSet` per `calendarDate` (already `IsoDate` form).
- `metrics['sleepScore']` and `metrics['activeCalories']` are present with correct `unit` and `origin: 'EXPORT'`.
- **`overallScore: null` → the sleep metric is `{ isAvailable: false }`** (no `value` field), and the *active-calories* metric on the same day is **still available** (FR-WER-06: "the absence of one metric shall not render the others unavailable").
- The OPEN-20 cases both hold: `0.0` + `totalSteps` → available `value: 0`; `0.0` + no `totalSteps` → unavailable.

### `server/test/db/MetricStore.test.ts` — FR-WER-09, DR-05

- Persisting a `DailyMetricSet` writes **one document per metric per date** (DR-05) — assert the stored document count, and that no document carries two metric values.
- **Idempotency (FR-WER-09):** ingesting the same fixture twice leaves the same document count; re-ingesting a date with a changed value **updates** the existing document, does not duplicate. (Upsert keyed on `(userId, date, metricName)`.)
- Reading back yields a `DailyMetricSet` equal to what was written, availability branch preserved.

### Throwing stubs (RED only — so the suite compiles and fails, carrying no answer)

- `server/src/wearable/WearableAdapter.ts` — the **interface** (FR-WER-05), e.g. `fetch(userId, date): Promise<DailyMetricSet>` per §3.6's class diagram. An interface is a type, not an implementation — this is allowed in RED.
- `server/src/wearable/GarminExportAdapter.ts` — a class implementing it whose every method **throws** `new Error('not implemented')`.
- `server/src/db/MetricStore.ts` — a class (constructed from a `Db`, mirroring `TaskRepository`/`UserStore` in `server/src/db/`) whose methods **throw**.

> ⚠️ **A stub returns nothing and computes nothing.** If a "stub" parses JSON, merges records, or decides availability, **it is the implementation** and this packet is compromised (§8.3). Revert and re-run RED.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/test/fixtures/wearable/*.json`
- `server/test/wearable/GarminExportAdapter.test.ts`
- `server/test/db/MetricStore.test.ts`
- `server/test/support/*` — only if a shared fixture-loader helper is genuinely needed (mirror the existing `server/test/support/testDb.ts`).
- `server/src/wearable/WearableAdapter.ts`, `server/src/wearable/GarminExportAdapter.ts` — **throwing stubs / interface only**
- `server/src/db/MetricStore.ts` — **throwing stub only**

## **CRITICAL**: Files You Must **NOT** Touch

- `shared/src/contract.ts` — the contract
- `engine/**` — this path does not reach the engine
- `server/src/db/TaskRepository.ts`, `server/src/db/UserStore.ts`, `server/src/db/mongo.ts` — existing packet-12 db surface; **reuse** `isValidObjectIdString` and the `Db`/`Collection` pattern, do not modify them
- `server/src/api/**`, `server/src/reschedule/**`
- **Any working implementation** — no parsing, no merging, no availability logic. If you write a function that computes the answer, you have written the implementation.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] `npm run test` (server) shows the new suites **RED** — every new test fails, and fails because the stub throws, **not** because of a compile error.
- [ ] The diff contains **only** test files, fixtures, and throwing stubs / the interface. No working logic anywhere.
- [ ] **Every test name cites the requirement ID it verifies** — e.g. `it('FR-WER-06: an unmeasured night leaves the sleep metric unavailable and the calorie metric untouched', …)`. This is the traceability matrix (Appendix B); the grader reads test output as evidence.
- [ ] Fixtures are **derived**, minimal, and contain **no** real person's dated health record copied wholesale (§8.4).
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)* — a throwing stub still type-checks.
- [ ] The suite is **frozen** after the human gate: `npm run freeze -- --packet 08 --path server/test/wearable` (and the db/fixture paths). RED-freeze commit per §8.3.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to Ryan — do not work around it — if:**

- You need to change the contract, or the two metrics don't fit `Metric`/`DailyMetricSet` as-is.
- The OPEN-20 discriminator appears wrong for a fixture case. **Do not invent a different rule and encode it** — it is a stated team decision.
- Two requirements in scope appear to **contradict** each other. (Say which, and how.)
- A requirement is **ambiguous** for a case you must handle — e.g. a metric present but malformed, or a `calendarDate` in an unexpected form.
- Satisfying a requirement here would require touching a file on the **must NOT touch** list — in particular, if you find yourself wanting to edit `TaskRepository`/`mongo.ts`.

> **MANDATORY**: An escalation is a **success**. A RED packet that finishes with zero escalations on a real data format nobody has test-pinned before is the outcome to be suspicious of.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: This packet's single pass condition — **a frozen, RED test suite that pins how a derived Garmin export normalizes into a Daily Metric Set (FR-WER-02/03/06, DR-02/04/05) and how those metrics persist idempotently (FR-WER-09, DR-05), with the OPEN-20 discriminator asserted — and no implementation that answers it.**

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it.
