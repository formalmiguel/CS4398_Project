# Packet 15a — Habit Analytics Computation — 🔴 RED report

**Owner:** Ryan Woosley · **Branch:** `wp-15-analytics` (off `wp-14a-wellness-backend`)
**Date:** 27 Jul 2026 · **Phase:** RED. **Status:** RED suite written and verified failing at the stub. **NOT frozen, NOT gated yet** — awaiting the second-human gate (§4.6/§8.3) before the freeze.

## What this is

The frozen-candidate test suite for FR-ANL-01/02/03/06 — the streak and completion-rate computation.
It is written against the SRS and the contract with **no implementation in view**; the unit under
test is a **pure** function over `Placement[]`, so all of FR-ANL is pinned in memory (no Mongo, no
clock), the way the engine's correctness is.

- **Surface (throwing stub):** `server/src/analytics/HabitAnalytics.ts` — `analyzeHabit(placements, period) → { streak, completed, scheduled, completionRate }`.
- **Suite:** `server/test/analytics/HabitAnalytics.test.ts` — **13 tests, all RED**, every failure at `Error('15b')` (0 assertion-against-real-code, 0 compile errors after the property-test index fix). `typecheck`/`lint` clean.

## The resolution rules pinned (RED author's reading of the SRS)

The load-bearing logic is the **per-date fold** — a date, not a placement, is the unit:
- A DATE resolves **COMPLETED** if any placement on it is `COMPLETED` (FR-ANL-03, FR-RSC-09); else
  **NOT_COMPLETED** if any is `MISSED`/`SKIPPED` (FR-ANL-06); else **UNRESOLVED**.
- `scheduled` = distinct resolved dates in the period; `completed` = distinct COMPLETED dates;
  `completionRate = scheduled === 0 ? 0 : completed/scheduled`.
- `streak` = consecutive COMPLETED resolved dates ending at the latest resolved date ≤ `period.end`.

Cases pinned: streak happy-path / gap-reset / most-recent-missed; rate 12÷20=0.6; empty→0 not NaN;
rescheduled-then-completed counts (with the trigger `MISSED` **and** `SKIPPED` — the trigger is
irrelevant, UC-11); CANCELLED (FR-RSC-09) not double-counted; skipped-never-completed = miss and
inescapable from the denominator (FR-ANL-06); skipped-then-completed = completed; the distinct-date
invariant; SUPERSEDED; and a property test (completed ≤ scheduled, rate is their quotient, 200 trials).

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

## Method

- **This session wrote the RED tests only.** It has written no analytics implementation, so the tests
  can only encode the spec (§4.6). **15b GREEN must be a separate session** and may not edit a test.
- **Freeze is post-gate** (§8.3): after a second human works `AGENTIC-TDD-WORKFLOW.md` §6,
  `npm run freeze -- --packet 15a --path server/test/analytics` records the digests and the RED commit
  freezes the suite. Not done here.
- **On its own branch** so `wp-14a` (14a/14b, green and mergeable) is not turned red by a by-design-red
  suite (§8.5). `wp-15-analytics` carries 15a RED + 15b GREEN and merges green together.

## Next
- Second-human gate → freeze → RED commit.
- 15b GREEN (separate session): implement `analyzeHabit` + `GET /analytics` + a `TaskRepository` query
  for a habit's placements.
- 15c: the analytics view (FR-ANL-04, UI-04). *(FR-ANL-05 trend chart is Conditional → out.)*
