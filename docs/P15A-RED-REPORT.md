# Packet 15a — Habit Analytics Computation — 🔴 RED report

**Owner:** Ryan Woosley · **Branch:** `wp-15-analytics` (off `wp-14a-wellness-backend`)
**Date:** 27–28 Jul 2026 · **Phase:** RED. **Status:** ✅ **GATED (Patrick, 28 Jul) and FROZEN at `3fd6371`** — `npm run guard:tests-frozen` now enforces the 18-test suite (all RED at the `Error('15b')` stub, 0 assertions against real code). Both gate questions confirmed: the `date < asOf` date-granularity boundary, and the elapsed-unswept `PLANNED` breaking the streak like a miss. **Next: 15b GREEN in a fresh session (§4.6).**

## What this is

The frozen-candidate test suite for FR-ANL-01/02/03/06 — the streak and completion-rate computation.
It is written against the SRS and the contract with **no implementation in view**; the unit under
test is a **pure** function over `Placement[]`, so all of FR-ANL is pinned in memory (no Mongo, no
clock), the way the engine's correctness is.

- **Surface (throwing stub):** `server/src/analytics/HabitAnalytics.ts` — `analyzeHabit(placements, period, asOf) → { streak, completed, scheduled, completionRate }`. *(`asOf` added in the pre-freeze refinement below — see "Patrick's second read".)*
- **Suite:** `server/test/analytics/HabitAnalytics.test.ts` — **17 tests, all RED**, every failure at `Error('15b')` (0 assertion-against-real-code, 0 compile errors). `typecheck`/`lint` clean; the property tests are `fast-check`, seeded.

## The resolution rules pinned (RED author's reading of the SRS)

The load-bearing logic is the **per-date fold** — a date, not a placement, is the unit:
- A DATE resolves **COMPLETED** if any placement on it is `COMPLETED` (FR-ANL-03, FR-RSC-09); else
  **NOT_COMPLETED** if any is `MISSED`/`SKIPPED` (FR-ANL-06); else **UNRESOLVED**.
- `scheduled` = distinct resolved dates in the period; `completed` = distinct COMPLETED dates;
  `completionRate = scheduled === 0 ? 0 : completed/scheduled`. A still-`PLANNED` date resolves against
  `asOf`: **elapsed** (`date < asOf`) ⇒ NOT_COMPLETED (counted, even if unswept); **not yet elapsed** ⇒
  UNRESOLVED (excluded). *(Added in the pre-freeze refinement below.)*
- `streak` = consecutive COMPLETED resolved dates ending at the latest resolved date ≤ `period.end`.

Cases pinned: streak happy-path / gap-reset / most-recent-missed; rate 12÷20=0.6; empty→0 not NaN;
future `PLANNED` excluded **and** elapsed-unswept `PLANNED` counted (both against `asOf`, GATE-2);
rescheduled-then-completed counts (with the trigger `MISSED` **and** `SKIPPED` — the trigger is
irrelevant, UC-11); CANCELLED (FR-RSC-09) not double-counted; skipped-never-completed = miss and
inescapable from the denominator (FR-ANL-06); skipped-then-completed = completed; the distinct-date
invariant; SUPERSEDED; and two seeded `fast-check` properties (per-date-fold invariants + non-event
inertness) — see "Patrick's second read".

## ✅ Escalations — RATIFIED (SRS v2.31, decision log 27 Jul)

Both were checked against the SRS and ratified into FR-ANL before the freeze, so the frozen suite
encodes stated requirements, not a RED run's guess (§0.1):
- **GATE-1 → new FR-ANL-07:** a `SUPERSEDED` occurrence counts as **neither completed nor missed**
  (excluded from both terms, not a streak-breaker) — extends FR-ANL-03's principle. The suite's
  SUPERSEDED test already matches this.
- **GATE-2 → FR-ANL-02 amended:** the denominator counts only occurrences whose window has **elapsed**;
  a future `PLANNED` occurrence is in neither term.

*Original escalation notes, for the record:*

## ⚠️ Escalations for the gate (decide, then the freeze ratifies them)

- **GATE-1 — SUPERSEDED.** A `SUPERSEDED` occurrence (a workout the recommender replaced, FR-REC-02 —
  nothing happened at the old time) is pinned as **UNRESOLVED**: excluded from both numerator and
  denominator, and it does **not** break a streak. Rationale: it is neither a completion nor a *miss*
  of the user's habit. The SRS does not state this directly (FR-ANL predates SUPERSEDED), so it is a
  RED-author decision the gate should ratify — a SUPERSEDED row **will** appear in real data, so the
  suite must state some rule.
- **GATE-2 — PLANNED (not-yet-elapsed).** A `PLANNED`-only date is **UNRESOLVED** (not yet had a chance
  to complete), so it is not in the denominator. This keeps a future occurrence from depressing the
  rate before its window elapses (consistent with FR-RSC-10 evaluating on retrieval). Not stress-tested
  here; flagged so the gate is aware the denominator excludes future PLANNED dates.

## Patrick's second read (pre-freeze refinements, 28 Jul) — items 1 & 3 applied; 2 held

A second read of the RED suite before the freeze raised four points. Two were cheaper to fix before
freezing than after, and are **applied**; one is Patrick's SRS call and is **held**; one is the freeze
mechanics. Nothing is frozen or committed — all of this remains gate-reviewable.

- **① FR-ANL-02 needed an `asOf` — APPLIED.** v2.31 defines the denominator as occurrences whose window
  has **elapsed**, but the old signature `analyzeHabit(placements, period)` had no reference instant, so
  it could only exclude *every* `PLANNED` date. Because **FR-RSC-10 sweeps elapsed→MISSED only on
  retrieval**, a day the user never opened stays `PLANNED` and was silently dropped from the denominator
  — **overstating** the completion rate (OPEN-27's seam-vs-unit shape, one layer down). Fixed by adding
  `asOf: IsoDate`, **passed in, never read from a clock** (purity — §4.7, exactly like `schedulableDay`).
  The old GATE-2 test is reframed as "future `PLANNED` excluded"; two tests added — an **elapsed unswept
  `PLANNED` counts** in the denominator as a miss, and it **breaks the streak** like a miss.
  - ⚠️ **New gate question (date-granularity boundary):** the rule is pinned as `date < asOf` ⇒ elapsed,
    so an occurrence on `asOf`'s own day is still in progress. At date granularity this is the only sound
    choice without a minute-precise clock, but it is a RED-author reading — **confirm at the gate.**
  - ⚠️ **The streak consequence goes beyond the raised denominator point** (it must, or `scheduled` and
    `streak` would resolve the same date differently) — flagged in the test and here for ratification.
- **③ Property test rewritten — APPLIED.** The old loop was unseeded `Math.random()` (unreproducible, and
  `jest.retryTimes(2)` from OPEN-25 would silently re-roll it until green) and its assertion
  `rate ≈ completed/scheduled` was a near-tautology. Replaced with two **seeded** `fast-check` properties
  (`seed: 15`, 300 runs) asserting invariants the tautology cannot: `scheduled ≤ distinct dates`,
  `streak ≤ completed`, rate ∈ [0,1] never NaN, and **a `CANCELLED`/`SUPERSEDED` row is inert** (adding
  one never changes `completed`/`scheduled` — FR-RSC-09 / GATE-1). A fixed seed also neutralises the
  retry-masking: every retry fails identically on the same shrunk counterexample.
- **② FR-ANL-01 "days" vs "occurrences" — RESOLVED 28 Jul (Ryan: "do what the SRS says"), NO amendment.**
  The literal "consecutive completed **days**" looked like calendar days (a weekly habit → streak 1), but
  **ratified FR-ANL-07 already forbids the strict reading** — so the SRS read *whole* compels the
  *resolved-occurrences* reading (weekly → 3) with **no wording change**. Now **pinned** by a new test
  (`a weekly habit … streak of 3, not 1`). The wording-change proposal is **withdrawn**; **OPEN-30 closed**.
  Full argument in **"Resolution: FR-ANL-01 (item ②)"** below.
- **④ Freeze mechanics.** `scripts/frozen-tests.json` has no `server/test/analytics` entry yet; the RED
  commits already contain the files, so the auto-adopted sha will be valid (no P08 trap). Run **after** the
  gate: `npm run freeze -- --packet 15a --path server/test/analytics`.

## Resolution: FR-ANL-01 (item ②) — no SRS change; FR-ANL-07 compels the occurrence reading

**Decided 28 Jul by Ryan (owner): "do what the SRS says."** FR-ANL-01 is **not** amended; the occurrence
reading is what the SRS already requires, and it is now pinned in the suite. OPEN-30 closed.

**Why "days" does not mean calendar days here.** Taken alone, FR-ANL-01's "consecutive completed **days**"
looks like calendar days, which would cap a weekly (Monday-only) habit's streak at 1. But the SRS says more
than FR-ANL-01:
- **FR-ANL-07 (ratified v2.31)** — a `SUPERSEDED` occurrence does **not** break a streak — and the suite's
  SUPERSEDED test pins it (day0 COMPLETED, day1 SUPERSEDED, day2 COMPLETED → streak **2**). A strict
  calendar-day count gives that same case **1**, so the strict reading is already **impossible**: it
  contradicts a ratified requirement and a test the team is about to freeze.
- Once a **System-excused** day cannot break a streak, a day the habit was **never scheduled** cannot
  either — otherwise the System *replacing* a workout would be **better** for the streak than an ordinary
  rest day. No coherent rule allows that.

So the SRS read **whole** admits exactly one rule: walk the habit's **resolved occurrences** backward,
skipping dates with no occurrence — a weekly habit completed three Mondays running has a streak of **3**.
Amending FR-ANL-01 would only have restated what FR-ANL-07 already implies, so no wording change was made.

**What changed:** one test added to the 15a suite — `a weekly habit: three completed occurrences 7 days
apart give a streak of 3, not 1` — RED at the stub like the rest. **The SRS is untouched**, so the earlier
draft's cross-reference list (UC-11 line 727, a revision-history row, the §1.4.2 glossary) is **moot** —
nothing in the SRS moves.

**The general lesson** (also in the decision log): reading FR-ANL-01 in isolation gives the wrong answer
*and* silently breaks FR-ANL-07. The §0-rule-3 cross-reference discipline is what resolves the ambiguity —
the same links that catch contradictions also disambiguate an under-specified clause.

## Method

- **This session wrote the RED tests only.** It has written no analytics implementation, so the tests
  can only encode the spec (§4.6). **15b GREEN must be a separate session** and may not edit a test.
- **Freeze is post-gate** (§8.3): after a second human works `AGENTIC-TDD-WORKFLOW.md` §6,
  `npm run freeze -- --packet 15a --path server/test/analytics` records the digests and the RED commit
  freezes the suite. Not done here.
- **On its own branch** so `wp-14a` (14a/14b, green and mergeable) is not turned red by a by-design-red
  suite (§8.5). `wp-15-analytics` carries 15a RED + 15b GREEN and merges green together.

## Next
- ✅ Second-human gate (Patrick, 28 Jul) → freeze (`3fd6371`) → RED commit — **done.**
- **15b GREEN (separate session — §4.6):** implement `analyzeHabit` + `GET /analytics` + a `TaskRepository`
  query for a habit's placements. May not edit, skip, or weaken a frozen test — if one looks wrong it
  stops and a human adjudicates it against the SRS.
- 15c: the analytics view (FR-ANL-04, UI-04). *(FR-ANL-05 trend chart is Conditional → out.)*
