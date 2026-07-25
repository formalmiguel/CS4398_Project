# CRITICAL REQUIREMENTS — 08b Wearable Adapter + Daily Metric Set (GREEN)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Make the **already-frozen** packet 08 test suite pass by writing **only** implementation, in **only** the two stub files listed. You **may not edit, skip, rename, or weaken a single test, fixture, or helper** — not to fix a typo, not to correct an assertion you believe is wrong. If you believe a test is wrong, **STOP and escalate** (§4.6).

| | |
|---|---|
| **Phase** | 🟢 GREEN (implementation only) |
| **Human owner** | Ryan Woosley |
| **Depends on** | **08 RED (frozen at `40a3447`, committed `1199d80`)** — the suite you implement against. Also 03 (the contract) and packet 12's `server/src/db` conventions. |
| **Spec** | `docs/SRS-v2.md` §3.9 (FR-WER), §5 (DR-02/04/05); the frozen tests are the executable form. |

> **The suite is frozen. It is the specification in executable form.** `npm run guard:tests-frozen` will fail the build if any file under `server/test/wearable/` changes. Your job is to make 20 red tests green **without touching one of them.**

---

## **MANDATORY**: Requirements In Scope

> Quoted **VERBATIM** from `docs/SRS-v2.md`. The frozen tests pin each; the requirement text is why.

- **FR-WER-01.** *(Essential, T)* The System shall obtain the user's health data for a date from a **wearable data source**, and shall be **indifferent to which source supplied it**.
- **FR-WER-02.** *(Essential, T)* Normalize data from any source into a **Daily Metric Set**: named metrics, each with a value, unit, and availability flag. The **only** representation any downstream component sees.
- **FR-WER-03.** *(Essential, T)* The Daily Metric Set shall contain **sleep score** and **active calories** — the complete set.
- **FR-WER-06.** *(Essential, T)* **Each metric carries its own availability flag.** No fabricated/zero/default value that could be mistaken for a measurement, and **the absence of one metric shall not render the others unavailable.**
- **FR-WER-09.** *(Essential, T)* Ingestion shall be **idempotent**: same export twice shall not duplicate; re-ingesting a date updates rather than duplicates.
- **DR-02.** distinguish "no data" from a measured zero, per metric. **DR-04.** record each metric's **origin**. **DR-05.** **one document per metric per date.**

### **CRITICAL**: Explicitly Out Of Scope

- **The recommendation rules (FR-REC-01/02/06/08)** — packets 09/10. **Do not map a score to an intensity tier or a calorie target here.** This packet stops at the Daily Metric Set and its persistence.
- **The `.env` / live Mongo wiring, any API route, injection endpoint (FR-WER-07's UI).** The store must not *prevent* an `INJECTED` origin (one test checks this), but no injection endpoint is built here.
- **Editing the contract, the interface, or any test.**

---

## **MANDATORY**: The Contract

**CRITICAL**: Import every domain type from `@capstone/shared` (`Metric`, `MetricOrigin`, `DailyMetricSet`, `IsoDate`). `Metric` is a **discriminated union on `isAvailable`** — the unavailable branch **has no `value` field**. Build the unavailable branch by **omitting `value`**, never by setting it to `0`, `null`, or `undefined`. Two tests assert `'value' in metric === false`.

**⛔ STOP** if the contract seems insufficient — do not change it. Report it (§4.7).

---

## **MANDATORY**: What To Build

Implement the throwing stubs. Their signatures and the source types already exist — **derive the bodies from the frozen tests.**

### `server/src/wearable/GarminExportAdapter.ts` — `toMetricSets()` and `fetch()`

- **`toMetricSets(): DailyMetricSet[]`** — one `DailyMetricSet` per `calendarDate`, over the **union** of dates across `source.activity` and `source.sleep`. Each set carries **exactly two** metrics, keyed `'sleepScore'` and `'activeCalories'`.
  - **`activeCalories`** — unit `'kcal'`, origin `'EXPORT'`. **Availability = presence of `totalSteps`** on the activity record (OPEN-20): present → available with `value: activeKilocalories` (*including a real `0`*); absent → **unavailable**. ⛔ **Not** `includesActivityData` (2026-02-13 carries 721 kcal with it `false` and must be available). ⛔ **Never** read `bmrKilocalories` (CON-05).
  - **`sleepScore`** — unit `'score'`, origin `'EXPORT'`. **Availability = `'overallScore' in sleepScores`**: present → available with `value: overallScore`; absent → **unavailable**. ⛔ **Not** `!= null` — the real export never emits a null score; an absent key is the unavailable signal.
  - A date present in **one source only** still emits **both** metrics: the missing side is **unavailable** (FR-WER-06).
  - A stray **duplicate `calendarDate`** collapses to **one** set (grouping by date does this for free). Which record wins is **not** asserted — do not add special resolution logic (OPEN-26).
- **`fetch(userId, date)`** — resolve to the single `DailyMetricSet` for `date` (i.e. the one `toMetricSets()` produces for it). FR-WER-01's source-indifference is already structural: the caller holds a `WearableAdapter`.

### `server/src/db/MetricStore.ts` — `ensureIndexes()`, `ingest()`, `getDailyMetricSet()`

- Collection **`metrics`**. **One document per metric per date** (DR-05), each carrying `userId`, `date`, the metric **`name` as a stored value**, and the metric's `unit`/`origin`/`isAvailable`/(`value` when available). ⛔ **Never** a document with `sleepScore`/`activeCalories` as *field names* — two tests assert the stored keys don't contain them.
- **`ensureIndexes()`** — a **unique** index on `(userId, date, name)`. This is what makes ingestion idempotent.
- **`ingest(userId, set)`** — **upsert** one document per metric on that key. Same set twice → no duplicates; changed value → updated in place (**last-write-wins** — this upsert IS FR-WER-09's mechanism). Persist `origin` (DR-04, incl. `INJECTED`); persist the **unavailable branch without a `value`** (DR-02).
- **`getDailyMetricSet(userId, date)`** — read the per-metric documents back into a `DailyMetricSet` that **`toEqual`s what was written** (one round-trip test asserts deep equality). Reconstruct each `Metric` with exactly its contract fields — **no `value` key on the unavailable branch**, no Mongo `_id`/`userId`/`date` leaking into the metric object.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/wearable/GarminExportAdapter.ts` — implement `toMetricSets`, `fetch`; keep the `Garmin*` source types.
- `server/src/db/MetricStore.ts` — implement the three methods.

## **CRITICAL**: Files You Must **NOT** Touch

- **Every file under `server/test/wearable/`** — the frozen suite (tests, `fixtures/garmin-export.json`, `wearableFixtures.ts`). Not one character.
- `scripts/frozen-tests.json` — the freeze manifest. **Re-running `npm run freeze` to go green is editing the test one level removed (§8.3).**
- `shared/src/contract.ts`, `server/src/wearable/WearableAdapter.ts` (the interface — it is complete), `server/src/db/{mongo,UserStore,TaskRepository}.ts`, any other package.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] `npm run test` (server): the **20** packet-08 tests pass; the pre-existing **217** still pass (237 total). No test was changed to achieve this.
- [ ] **`npm run guard:tests-frozen` passes** — `P08 … unchanged`. This is non-negotiable.
- [ ] **`git diff --stat 1199d80 -- server/test/wearable/` is EMPTY.** Nothing in the frozen suite changed.
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*.
- [ ] The two other frozen suites (P04 engine, P06 reschedule) are still green and unchanged; engine still at 100%.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to Ryan — do not work around it — if:**

- You **cannot make a test pass and believe the test is wrong.** Report it; a human adjudicates against the SRS. **Do not edit it.**
- A test appears to contradict the contract, the SRS, or another test. Say which.
- Making a test pass would require touching a **must-NOT-touch** file — in particular, if you feel the urge to adjust a fixture value or the manifest.

> An escalation is a **success**. But note: this suite was written *after* the export was read and its escalations already adjudicated (E1/E2/E3, decision log 25 Jul) — so a clean GREEN with no surprises is a plausible, good outcome here, unlike a RED run.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: This packet's single pass condition — **the 20 frozen packet-08 tests are green, `guard:tests-frozen` passes, and not one test, fixture, or manifest entry changed.**

**CRITICAL**: Where this prompt and a frozen test disagree, **the test wins and this prompt is a defect** — report it, do not reconcile it by editing the test. Where this prompt and `docs/SRS-v2.md` disagree, the SRS wins.
