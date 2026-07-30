# CRITICAL REQUIREMENTS — 15b Analytics Computation (🟢 GREEN)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Make the **already-frozen** packet 15a test suite pass by writing **only** implementation, in **only** the files listed. You **may not edit, skip, rename, or weaken a single test or fixture** — not to fix a typo, not to correct an assertion you believe is wrong. If you believe a test is wrong, **STOP and escalate** (§4.6).

| | |
|---|---|
| **Phase** | 🟢 GREEN (implementation only) |
| **Human owner** | Ryan Woosley |
| **Depends on** | **15a RED (frozen at `3fd6371`)** — the 18-test suite you implement against. Also 03 (the contract), 12 (`TaskRepository`, `app.ts`). |
| **Spec** | `docs/SRS-v2.md` §3.8.10 (FR-ANL), UC-11, DR-06; the frozen tests are the executable form. |

> **The suite is frozen. It is the specification in executable form.** `npm run guard:tests-frozen` fails the build if any file under `server/test/analytics/` changes. Your job is to make **18 red tests green without touching one of them.**

---

## **MANDATORY**: Requirements In Scope

> Quoted **VERBATIM** from `docs/SRS-v2.md`. The frozen tests pin each; the requirement text is why.

- **FR-ANL-01.** *(Essential, T)* Compute, per recurring habit, the count of **consecutive completed occurrences** ending at the most recent occurrence — its **streak**.
- **FR-ANL-02.** *(Essential, T)* Compute, per habit over a selected period, its **completion rate**: occurrences completed ÷ occurrences scheduled. An **occurrence scheduled** is one whose window has **elapsed** within the period; an occurrence still in the future — a `PLANNED` placement whose window has not yet passed — is counted in neither term, so a habit is never penalised for a day that has not happened.
- **FR-ANL-03.** *(Essential, T)* A task automatically rescheduled and **then completed** shall count as **completed, not missed.**
- **FR-ANL-06.** *(Essential, T)* An occurrence the user declared **skipped** (FR-RSC-08) and did not subsequently complete shall count as **not completed**, identically to a missed one. The System shall provide **no means of excluding an occurrence from its own completion rate.**
- **FR-ANL-07.** *(Essential, T)* An occurrence marked **`SUPERSEDED`** — a workout the System **replaced** with a warranted-tier recommendation for that date (FR-REC-02) — shall count as **neither completed nor missed**: it is excluded from **both** the numerator and the denominator of FR-ANL-02, and it does **not** break a streak.

**From UC-11, the alternate flows that fix the folding:**
> • A habit rescheduled and then completed → **completed** — whether the reschedule was triggered by a miss or by the user declaring it skipped. **The trigger does not affect the record; only the outcome does.**
> • A habit **declared skipped and never completed that day** → **not completed**, exactly as a missed one. • A habit **deleted** → its historical completion records are **preserved**.

### **CRITICAL**: Explicitly Out Of Scope — do not build these here

- ⛔ **FR-ANL-04 / UI-04 — the analytics view.** Packet **15c**. This packet ends at JSON. Write no React.
- ⛔ **FR-ANL-05 — the completion-trend chart.** **Conditional**, and definitively out under the 26 Jul scope freeze (`CLAUDE.md` §6).
- ⛔ **A user-selectable period.** The endpoint chooses its own window (below). A selector is a later decision, not this packet's.
- ⛔ **Editing the contract, the frozen suite, or `scripts/frozen-tests.json`.**

---

## **MANDATORY**: The Contract

**CRITICAL**: Import every domain type from `@capstone/shared` — `Placement`, `PlacementStatus`, `IsoDate`, `Task`, `TaskType`. You **may not redefine, extend, widen, or shadow** any of them.

`HabitAnalytics` and `analyzeHabit`'s signature already exist in `server/src/analytics/HabitAnalytics.ts` as the RED stub, and they are **an obligation, not a suggestion** — the frozen suite imports them by name:

```ts
export function analyzeHabit(
  placements: readonly Placement[],
  period: { readonly start: IsoDate; readonly end: IsoDate },
  asOf: IsoDate,
): HabitAnalytics
```

**⛔ STOP** if you believe the signature or the contract is insufficient — do not change either. Report it (§4.7).

---

## **MANDATORY**: What To Build

### 1. `server/src/analytics/HabitAnalytics.ts` — replace the `throw new Error('15b')` with the body

**CRITICAL: `analyzeHabit` is PURE.** No clock, no database, no I/O, no `Date.now()`. `asOf` is **passed in**, exactly as the engine receives `schedulableDay` — that is what lets FR-ANL be property-tested in memory (§4.7). **A clock read here is the same defect FR-SCH-05 forbids in the engine.**

**⚠️ The unit of account is a DATE, not a placement.** This is the load-bearing fold and every requirement above is a rule about it. One date may carry several placements — an original and its reschedules — and the date resolves **once**.

**Resolve each date** carrying at least one of the habit's placements:

| The date's placements include… | The date resolves | Because |
|---|---|---|
| any `COMPLETED` | **COMPLETED** | FR-ANL-03 — a rescheduled-then-completed occurrence counts completed. **The `rescheduleTrigger`'s value is irrelevant** — `MISSED` and `SKIPPED` both credit (UC-11). |
| else any `MISSED` or `SKIPPED` | **NOT COMPLETED** | FR-ANL-06 — a declared skip never made up is a miss, and there is **no way to exclude it**. |
| else any `PLANNED` whose date is **strictly before `asOf`** | **NOT COMPLETED** | FR-ANL-02's elapsed rule. ⚠️ **This case is not hypothetical:** FR-RSC-10 sweeps elapsed→`MISSED` **only on retrieval**, so a day the user never opened stays `PLANNED` forever. Dropping it would silently **overstate** the rate. |
| else *(future `PLANNED`, `CANCELLED`, `SUPERSEDED`)* | **UNRESOLVED** | FR-ANL-02 (a day that has not happened cannot penalise), FR-RSC-09 (`CANCELLED` is a withdrawn duplicate, not a second occurrence), FR-ANL-07 (`SUPERSEDED` is the System's own act — neither term, and not a streak-breaker). |

- **`scheduled`** = count of **distinct resolved dates within `period`** (inclusive of both ends). **`completed`** = count of distinct dates resolving COMPLETED.
- **`completionRate`** = `completed / scheduled`, and **exactly `0` when `scheduled === 0`** — never `NaN`. *(The frozen suite asserts this directly.)*
- **`streak`** = consecutive COMPLETED **resolved occurrences**, walking backward from the latest resolved date `≤ period.end`.
  - ⚠️ **Read FR-ANL-01's "occurrences" literally — it does not mean calendar days.** A date with **no** occurrence is skipped over, not treated as a break; a weekly habit completed three Mondays running has a streak of **3**, not 1. This is not a liberty: **FR-ANL-07 forbids the calendar-day reading**, because a `SUPERSEDED` day must not break a streak, and a strict day-count cannot express that. A date the habit was never scheduled cannot break a streak either — otherwise the System *replacing* a workout would be better for the streak than an ordinary rest day.
  - An UNRESOLVED date is **transparent** to the walk: it neither continues nor breaks the streak.

**⚠️ `scheduled` and `streak` must resolve a date identically.** They are two readings of one fold, not two folds. If an elapsed unswept `PLANNED` counts in the denominator but does not break the streak, the two disagree about the same day and the suite will catch it.

### 2. `server/src/db/TaskRepository.ts` — a read for one habit's whole history

Add a read returning **every** `Placement` for a task — every date, every status, originals and reschedules alike. `analyzeHabit` does the folding; this method does no arithmetic and filters no status.

> ⚠️ **Cross-owner change — `server/src/db/` is Miguel's module** (§7.2). It is a read: it stores nothing and computes no placement, so **FR-RSC-03 is untouched**. Note it in your report so its owner knows, exactly as packet 17b did for `createTask`'s `source` parameter.

### 3. `server/src/api/app.ts` — `GET /analytics`

Authenticated, **read-only**, one route. For the caller it must return:

```
{ from, to, asOf,                                    // IsoDate "YYYY-MM-DD"
  habits: [ { taskId, title, streak, completed, scheduled, completionRate } ] }
```

- **The server chooses the window** — a **trailing 365 days ending today** — and reports it back as `from`/`to`/`asOf`. There is **no query parameter**; packet 15c renders the window the server states rather than offering a selector.
- One entry per **`HABIT`** task belonging to the authenticated user. A habit with no placements at all in the window still resolves honestly through `analyzeHabit` (`scheduled: 0`, `completionRate: 0`) — do **not** special-case it here; 15c decides how to *display* a zero-denominator habit.
- ⛔ **The route computes nothing.** It loads placements, calls `analyzeHabit`, and serialises. **A second division, a second streak walk, or a "quick" filter in the route is a second, un-pinned implementation of a (T) requirement** — the exact thing the RED/GREEN split exists to prevent (§4.6).
- ⛔ **Read-only.** Retrieving analytics must not place, complete, sweep, or reschedule anything. Do **not** call `RescheduleService` from this route: a sweep on an analytics GET would silently change the very numbers it is reporting.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/analytics/HabitAnalytics.ts` *(the stub body)*
- `server/src/db/TaskRepository.ts` *(the placements read — additive only)*
- `server/src/api/app.ts` *(the one route)*
- `docs/P15B-GREEN-REPORT.md` *(new)*

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ `server/test/analytics/**`** — the frozen suite (`3fd6371`). Not one character.
- **⛔ `scripts/frozen-tests.json`** — **re-running `npm run freeze` to go green is editing the test one level removed (§8.3, §4.12(b)).**
- **⛔ Every other frozen suite** — `engine/test/**`, `server/test/reschedule/**`, `server/test/wearable/**`, `server/test/recommendation/**`, `server/test/catalog/**`, `server/test/acceptance/**`, `server/test/replacement/**`.
- **⛔ `shared/src/contract.ts`** (§4.7); `engine/**`; `server/src/reschedule/**`; `server/src/recommendation/**`; `web/**`.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] `npx jest server/test/analytics`: the **18** packet-15a tests pass. No test was changed to achieve this.
- [ ] **`npm run guard:tests-frozen` passes** — `P15a … unchanged`, and every other entry unchanged. Non-negotiable.
- [ ] **`git diff --stat 3fd6371 -- server/test/analytics/` is EMPTY.**
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*.
- [ ] `npm run verify` is **green end to end** — RED + GREEN together on this branch (§8.5), so it is ready to merge to `dev`.
- [ ] `GET /analytics` confirmed against the **running server** (a `curl` round trip is sufficient and honest — the browser is 15c's job): a user with a habit returns a populated `habits[]`; a user with none returns `habits: []`, not an error.
- [ ] Report at `docs/P15B-GREEN-REPORT.md` — the `TaskRepository` cross-owner note, and anything the fold made you think twice about.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to Ryan — do not work around it — if:**

- You **cannot make a test pass and believe the test is wrong.** A human adjudicates it against the SRS. **Do not edit it.**
- A test appears to contradict the SRS, the contract, or another test. Say which two, and how.
- Making a test pass would require touching a **must-NOT-touch** file — in particular, if you feel the urge to adjust the signature, a fixture, or the manifest.
- **The date-resolution table above and a frozen test disagree.** ⚠️ **The test wins and this prompt is the defect** — the suite was gated and ratified into the SRS (v2.31) before it was frozen, and this table is a reading of that. Report the discrepancy; do not reconcile it by editing the test.
- You find yourself needing a clock inside `analyzeHabit`. That is a design smell worth reporting, not coding around — `asOf` is the parameter that exists so you do not need one.

> An escalation is a **success.** Note, though, that 15a's own escalations (`SUPERSEDED`, the elapsed-`PLANNED` denominator, the date-granularity boundary, and the "days vs occurrences" reading) were **all adjudicated at the RED gate and ratified into the SRS** — so a clean GREEN with no surprises is a plausible, good outcome here, unlike a RED run.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: This packet's single pass condition — **the 18 frozen packet-15a tests are green, `GET /analytics` serves what 15c will render, `guard:tests-frozen` passes, `npm run verify` is green, and not one test or manifest entry changed.**

**CRITICAL**: Where this prompt and a frozen test disagree, **the test wins and this prompt is a defect** — report it, do not reconcile it by editing the test. Where this prompt and `docs/SRS-v2.md` disagree, the SRS wins.

*(House-style techniques — Sandwich Method, Attention Anchoring, Visual Emphasis, Clear Delimiters, Selective Context — as in packets 05 / 07 / 10.)*
