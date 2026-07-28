# CRITICAL REQUIREMENTS — 15a Analytics Computation (🔴 RED)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer writing a **frozen test suite**. **CRITICAL: you write ONLY tests and a throwing stub. You write NO implementation.** If you find yourself computing a streak or a completion rate in non-test code, **stop** — that is packet 15b's (GREEN) job, and writing it here voids the entire point of the split (`CLAUDE.md` §4.6).

| | |
|---|---|
| **Phase** | 🔴 **RED** — the tests fail because the stub throws, and they are FROZEN after a human gate. FR-ANL-01/02/03/06 are **(T)**, so they are pinned by tests written **independently of any implementation** (§4.6, §4.8). |
| **Human owner** | Ryan Woosley |
| **Second-human gate** | **REQUIRED before the freeze** (`AGENTIC-TDD-WORKFLOW.md` §6). Nobody freezes their own suite. |
| **Depends on** | The contract (`Placement`, `PlacementStatus`, `IsoDate`) — already frozen. Packet 12 (`TaskRepository`) exists but this suite does **not** touch Mongo: the computation is PURE. |
| **Spec** | `docs/SRS-v2.md` §3.8.10 (FR-ANL), UC-11 (Habit Streak), the FR-RSC-09/FR-REC-02 placement statuses. |

---

## **MANDATORY**: Requirements In Scope — quoted VERBATIM

- **FR-ANL-01.** *(Essential, T)* Compute, per recurring habit, the count of consecutive completed days ending at the most recent day — its **streak**.
- **FR-ANL-02.** *(Essential, T)* Compute, per habit over a selected period, its **completion rate**: occurrences completed ÷ occurrences scheduled.
- **FR-ANL-03.** *(Essential, T)* A task automatically rescheduled and **then completed** shall count as **completed, not missed**.
- **FR-ANL-06.** *(Essential, T)* An occurrence the user declared **skipped** (FR-RSC-08) and did not subsequently complete shall count as **not completed**, identically to a missed one. The System shall provide **no means of excluding an occurrence from its own completion rate.**

**From UC-11 (Habit Streak), the alternate flows that fix the folding:**
> • A habit rescheduled and then completed → **completed** — whether the reschedule was triggered by a miss or by the user declaring it skipped. **The trigger does not affect the record; only the outcome does.**
> • A habit **declared skipped and never completed that day** → **not completed**, exactly as a missed one. • A habit **deleted** → its historical completion records are **preserved**.

---

## **MANDATORY**: The surface you write tests against (and STUB, throwing)

Create `server/src/analytics/HabitAnalytics.ts` with a **pure** function that THROWS (the RED stub) —
no clock, no DB, no I/O (it is tested like the engine: pure, over in-memory data):

```ts
import type { IsoDate, Placement } from '@capstone/shared';

export interface HabitAnalytics {
  readonly streak: number;         // FR-ANL-01
  readonly completed: number;      // FR-ANL-02 numerator (distinct completed dates)
  readonly scheduled: number;      // FR-ANL-02 denominator (distinct scheduled dates in period)
  readonly completionRate: number; // completed / scheduled; 0 when scheduled === 0
}

/**
 * All of ONE habit's placements (every date, every status — originals AND reschedules), plus the
 * inclusive period the rate is measured over. Pure: given the same input it returns the same output.
 * 15b (GREEN) implements the body; this stub throws.
 */
export function analyzeHabit(
  placements: readonly Placement[],
  period: { readonly start: IsoDate; readonly end: IsoDate },
): HabitAnalytics {
  throw new Error('15b');
}
```

> **⚠️ ESCALATION, decide at the gate, do not guess:** if you judge that streak and completion rate
> need two separate functions, or that the input should be pre-resolved occurrences rather than raw
> `Placement[]`, **raise it** — do not silently reshape the surface. The single-function/raw-placement
> shape above is the default because the load-bearing logic is exactly the **per-date fold over
> multiple placements**, and hiding that behind a caller would move the (T) logic out of the frozen
> suite. Keep the fold inside the tested function.

---

## **MANDATORY**: The cases the frozen suite MUST pin

Write these as tests. Each must fail now (the stub throws) and pass only once 15b computes correctly.

1. **FR-ANL-01 streak — happy path.** Five consecutive dates each with a `COMPLETED` placement, the
   latest ≤ `period.end` → `streak === 5`.
2. **FR-ANL-01 — a gap resets.** …COMPLETED, COMPLETED, MISSED, COMPLETED (most recent) → `streak === 1`.
   A `MISSED` most-recent day → `streak === 0`.
3. **FR-ANL-02 rate.** 12 distinct `COMPLETED` dates out of 20 distinct scheduled dates in the period →
   `completed === 12`, `scheduled === 20`, `completionRate === 0.6`.
4. **FR-ANL-02 — empty.** No scheduled occurrences in the period → `scheduled === 0`, `completionRate === 0`
   (not `NaN`).
5. **FR-ANL-03 — rescheduled-then-completed counts completed.** One date carrying a `MISSED` original
   placement AND a later `COMPLETED` placement (its `rescheduleTrigger` present) → that date counts as
   **completed** for both streak and rate. **The trigger value is irrelevant** — assert with `MISSED`
   and again with `SKIPPED` as the trigger; both count completed (UC-11).
6. **FR-RSC-09 — a withdrawn reschedule (CANCELLED) does not double-count.** One date with a `COMPLETED`
   original AND a `CANCELLED` reschedule → the date counts as **one** completed occurrence (not two, not
   not-completed). `scheduled` counts the date **once**.
7. **FR-ANL-06 — skipped-never-completed = not completed.** A date whose only terminal placement is
   `SKIPPED` → counts as **scheduled but not completed**, identical to `MISSED`; it breaks a streak and
   lowers the rate. **There is no way to exclude it** — assert it is in the denominator.
8. **FR-ANL-06 + FR-ANL-03 — skipped then rescheduled then completed = completed.** A `SKIPPED` original
   + a later `COMPLETED` placement on the same date → **completed**.
9. **Distinct-date invariant.** Multiple placements on the SAME date never inflate `scheduled` or
   `completed` beyond 1 for that date.
10. **`SUPERSEDED` is not a user miss.** A `SUPERSEDED` occurrence (a workout recommendation replaced,
    FR-REC-02 — nothing happened at the old time, it was overtaken) must be decided explicitly: **it is
    neither completed nor a scheduled-but-missed occurrence of the habit.** Pin the chosen rule with a
    test and a comment citing the `PlacementStatus` definition. *(If you judge the SRS underdetermines
    this, escalate at the gate rather than guessing — but the suite must state SOME rule, since a
    `SUPERSEDED` row will appear in real data.)*

**Property-style coverage (optional but encouraged):** a randomized set of dated statuses where the
completion rate computed two independent ways agrees — mirrors the engine's property test discipline
(NFR-COR-01), and cheap because the function is pure.

---

## **CRITICAL**: RED invariants (the freeze depends on these)

- **Every test fails because the STUB THROWS**, not because of an assertion against real code. A test
  that passes now pins nothing (the 17a lesson — a green regression guard is allowed only when it
  guards *existing* behaviour, which analytics has none of yet).
- **No implementation anywhere.** The only non-test file is the throwing stub above. If a helper computes
  a real streak, the packet is compromised (§8.3) — revert and re-run RED.
- **Own directory:** put the suite in `server/test/analytics/` (a fresh frozen dir, like 17c's
  `server/test/replacement/`), so no existing freeze is disturbed.
- **Freeze after the gate:** a second human works `AGENTIC-TDD-WORKFLOW.md` §6, THEN
  `npm run freeze -- --packet 15a --path server/test/analytics` records the digests, and the RED commit
  freezes the suite. `guard:tests-frozen` must show every other frozen suite unchanged.

---

## ⚠️ **MANDATORY**: Escalation Clause
If a requirement is ambiguous (case 10 is the likely one; the `period` boundary semantics are another),
**stop and record it for the human gate** — do not encode a guess as a frozen test. A wrong frozen test
is worse than an open question, because 15b GREEN is forbidden from changing it (§4.6).

## **MANDATORY**: Files You May NOT Touch
- ⛔ `shared/src/contract.ts`, `engine/**`, `server/src/**` except the one throwing stub, every existing
  frozen suite, `scripts/**`.

## **MANDATORY**: Done Criteria (RED)
1. `server/test/analytics/` fails (all new tests red at the `Error('15b')` stub); `typecheck`/`lint` clean.
2. Every OTHER frozen suite still green and unchanged (`guard:tests-frozen`), guards green.
3. Second-human gate worked and recorded; then freeze + RED commit.
4. Report at `docs/P15A-RED-REPORT.md`, with the escalations (case 10 especially) and the gate record.

*(House-style techniques as in 04/09/17a.)*
