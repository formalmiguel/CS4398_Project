# CRITICAL REQUIREMENTS — 04 Scheduling Engine: TEST SUITE (🔴 RED)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer writing a test suite. **CRITICAL**: You are writing the test suite for the scheduling engine. **You will not write the engine.**

| | |
|---|---|
| **Phase** | 🔴 **RED — tests only.** You will write **no implementation.** |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 01 (scaffold), 02 (toolchain), 03 (contract) |
| **Spec** | `docs/SRS-v2.md` §3.8.4 (FR-SCH), §4.1 (NFR-COR), Appendix A (worked example) |

---

## ⛔ **CRITICAL**: READ THIS BEFORE ANYTHING ELSE

**MANDATORY**: There will be a strong pull to write the implementation — the tests will not compile against a function that does not exist, and fixing that will feel like your job. **IT IS NOT.**

**CRITICAL**: Create `engine/src/index.ts` exporting a `findCandidateSlots` that satisfies the `FindCandidateSlots` type and **throws `new Error('05')`**. That is the **only** implementation code you may write. **One line.**

**MANDATORY**: **Your tests are supposed to fail.** A red suite is this packet **succeeding.** If your suite goes green, you have written the engine, and you have destroyed the thing this process exists to protect:

> **A test written by whoever wrote the implementation encodes what the code *does*, not what the requirement *says*.** It will be green and it will be wrong, and nobody will find out until the demo places a workout on top of a lecture. A separate agent (prompt 05) writes the implementation against your tests, and **may not edit them.** That separation is the only thing standing between this project and a confidently broken engine.

---

## **MANDATORY**: Requirements In Scope — Verbatim From `docs/SRS-v2.md` §3.8.4

> **There is exactly one scheduling engine in this System.** […] The engine is required to be a **pure function** (FR-SCH-05): no clock, no database, no side effects. […] its purity is exactly what allows it to be property-tested over a thousand randomized days with no database and no browser (NFR-COR-01), and held to 90% coverage (NFR-MNT-01).

- **FR-SCH-01.** *(Essential, T)* Given busy intervals and a task, the engine shall determine whether the task's preferred window contains a free interval of length ≥ its duration, and if so return a placement within that window.
- **FR-SCH-02.** *(Essential, T)* If the preferred window contains no sufficient free interval, the engine shall search the remainder of the schedulable day and return **up to three ranked candidate slots**. Where a free interval is **longer than the task's duration**, the candidate's start shall be the fitting position **closest to the preferred window**; where several positions are equally close, the **earliest** shall be used.

  > *The positioning sentence was added at SRS **v2.9** (22 Jul), closing OPEN-13. It matters only for free intervals lying **before** the preferred window — after it, closest and earliest coincide. **Inside** the preferred window every position is equally close, so **earliest** governs there, which is what FR-SCH-09's first boundary row already requires. Raised by this packet's first run; Appendix A could not settle it, because all three of its ranked candidates sit in intervals where the two readings agree.*
- **FR-SCH-03.** *(Essential, T)* The engine shall rank candidates by, in order: (a) proximity of start time to the preferred window; (b) earlier start time as final tiebreaker. **Ranking shall be deterministic**: identical inputs always produce identical output ordering.

  > *Quoted at SRS **v2.7**. A former criterion (b), "the task's priority relative to neighbors", was removed on 22 Jul: `Interval` carries no priority, so the engine cannot evaluate it. **This packet's first run is what found that** — it escalated instead of inventing a tiebreak. See `docs/P04-RED-REPORT.md`, E1.*
- **FR-SCH-04.** *(Essential, T)* No placement shall overlap any busy interval, and none shall fall outside the schedulable day.
- **FR-SCH-05.** *(Essential, T)* The engine shall be a **pure function**: called twice with identical inputs it returns identical outputs; it performs no database write, no HTTP call, and no mutation of its arguments.
- **FR-SCH-06.** *(Essential, T)* Where no valid slot exists, the engine shall return an **explicit empty result with a reason**, and the System shall tell the user the task could not be placed and why. It shall **not** silently drop the task, and shall **not** place it in violation of its constraints.
- **FR-SCH-09.** *(Essential, T)* The engine shall correctly handle these boundary cases. **Each row is a required test case.**

  | Case | Required behavior |
  |---|---|
  | Day entirely empty | Task placed at the start of its preferred window |
  | Day entirely full | Empty result with reason (FR-SCH-06) |
  | Free interval **exactly equals** duration | Placed; the slot is valid |
  | Free interval **one minute short** | Rejected; engine continues searching |
  | Duration equals the whole schedulable day | Placed only if the day is empty |
  | Two busy intervals **adjacent, no gap** | Treated as one; no zero-length slot returned |
  | Busy intervals **overlap each other** | Merged; no placement produced in the overlap |
  | Preferred window entirely outside the schedulable day | Empty result with reason |

- **NFR-COR-01.** *(Essential, T)* **The engine shall never produce a placement that overlaps a busy interval.** This is the System's central correctness invariant. Verification: a **property-based test** that generates randomized days and tasks, invokes the engine, and asserts non-overlap over **no fewer than 1,000 generated cases.**
- **NFR-COR-02.** *(Essential, T)* The engine shall be **deterministic**: identical inputs shall always produce identical outputs, including the ordering of ranked alternatives.
- **NFR-COR-03.** *(Essential, T)* Every boundary case in FR-SCH-09 shall pass as an explicit test.
- **NFR-PERF-01.** *(Essential, A)* The engine shall return a placement decision for a day of up to **50 busy intervals in under 200 ms**, at the 95th percentile over 100 consecutive invocations.

### **CRITICAL**: Explicitly Out Of Scope

**MANDATORY**: **FR-SCH-07 and FR-SCH-08** (priority displacement). They are **Conditional** and per §2.7.1 **shall not be started until every Essential requirement is complete and verified.** Write **no** test for them.

> *`CLAUDE.md` §6 calls this "the most seductive way to lose a week." It is. **Leave it alone.***

---

## **MANDATORY**: The Contract

**CRITICAL**: Import every type from `shared/src/contract.ts`: `Interval`, `Minute`, `Task`, `Slot`, `PlacementResult`, `NoSlotReason`, `FindCandidateSlots`.

**⛔ STOP**: **Redefine nothing.** If you need a type that is not there, **report it — do not add it.**

---

## **MANDATORY**: What To Write

### `engine/test/boundary.test.ts` — FR-SCH-09

**CRITICAL**: **All eight rows.** One `it()` per row, each naming the case. This table is the SRS handing you your test cases; **transcribe it faithfully rather than interpreting it.**

**MANDATORY**: Two rows deserve care, because they are where an engine is actually wrong:

- **"one minute short"** — assert the engine **continues searching** and places the task *elsewhere*. **It is not enough to assert the short gap was rejected**; the bug you are hunting is an engine that rejects the gap and then gives up.
- **"adjacent, no gap"** — assert **no zero-length slot is returned.** A merge bug produces a `{start: 600, end: 600}` slot that satisfies "does not overlap anything" and is nonsense.

### `engine/test/ranking.test.ts` — FR-SCH-02, FR-SCH-03

- **CRITICAL**: At most **three** slots, ever.
- Ranks are `1, 2, 3` — dense and ascending.
- Each ranking criterion isolated: proximity to the preferred window dominates; priority breaks a proximity tie; **earlier start** breaks the remaining tie.
- **MANDATORY — Determinism:** call with the same input 10× and assert **deep-equal output including array order.** Then **shuffle the `busy` array** and assert the output is *still identical* — the engine must not inherit the caller's input ordering. *(That is a real bug and this is the test that finds it.)*

### `engine/test/purity.test.ts` — FR-SCH-05

- `Object.freeze` (deep) every argument, call the engine, assert **no throw and no mutation.**
- Call twice, assert deep-equal results.
- Assert the returned `slots` array is **not** a reference to any input array.

### `engine/test/no-slot.test.ts` — FR-SCH-06

- Every `NoSlotReason` variant is reachable, and each is produced by the situation it names.
- On failure: `placed === false`, `slots` is empty, `reason` is set, **and `explanation` is a non-empty human-readable string.**
- **CRITICAL**: **The task is never placed in violation of its constraints as a fallback.** *There must be no input for which the engine "gives up and puts it somewhere."* That is FR-SCH-06's actual teeth, and **the test that proves it should be the one you write most carefully.**

### `engine/test/property.test.ts` — NFR-COR-01 ⭐

**MANDATORY**: **This is the most valuable test in the project.** Using **fast-check**, with `numRuns: 1000` minimum:

Generate a random schedulable day, a random set of busy intervals (**deliberately including overlapping and adjacent ones**), and a random task. Invoke the engine. Then assert the invariants that must hold **for every input**:

1. **No returned slot overlaps any busy interval.** ← *the System's central correctness invariant*
2. Every returned slot lies **entirely within the schedulable day.**
3. Every returned slot has `end - start === task.durationMinutes` **exactly.**
4. **At most three** slots.
5. Ranks are exactly `1..n`, ascending, no duplicates.
6. `placed === false` ⟹ `slots` is empty **and** `reason` is set.

> **CRITICAL**: Enumerated tests verify the cases you thought of. **This one verifies the ones you did not** — and non-overlap is the single defect the System cannot be allowed to ship. Make the generators genuinely adversarial: **zero-length busy intervals, intervals spanning the whole day, a preferred window of exactly the task's duration, a window straddling the day's edge.** **A generator that only produces tidy inputs is a property test in name only.**

### `engine/test/performance.test.ts` — NFR-PERF-01

50 busy intervals, 100 consecutive invocations, assert p95 < 200 ms.

---

## **CRITICAL**: Files You May Create Or Edit

- `engine/test/**` — everything
- `engine/src/index.ts` — **only** the throwing stub described above. **Nothing more.**

## **CRITICAL**: Files You Must **NOT** Touch

- `shared/src/contract.ts`
- **⛔ Any implementation.** No helpers, no `mergeIntervals`, no "just a small utility to make the test readable."

> **MANDATORY**: **If you write a function that merges intervals or finds free gaps, you have written the engine** — and this packet has failed even though every file looks reasonable.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] All eight FR-SCH-09 rows have an explicit `it()`
- [ ] Property test runs **≥ 1,000** cases and asserts **all six** invariants
- [ ] **Every test name cites its requirement ID** — e.g. `it('FR-SCH-09: rejects a free interval one minute short and keeps searching', …)`. This is the traceability matrix (Appendix B); a grader reads the test output as evidence.
- [ ] `npm run lint` and `npm run typecheck` pass with zero errors
- [ ] **CRITICAL**: **`npx jest engine` FAILS, and every failure is `Error: 05`.** ← *This is the pass condition for this packet.*
  - A failure for any **other** reason means a test is broken rather than merely unimplemented — **fix it.**
  - **⛔ A test that PASSES means you wrote the engine.**
- [ ] `git diff --stat engine/src/` shows **~1 line** — the throwing stub — and nothing else
- [ ] Post the failing-test count to the team. **That number is prompt 05's target.**

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report — do not resolve it yourself — if:**

- Two requirements appear to **contradict.** *(Say which and how. **Finding one is a genuinely valuable outcome of this packet, not an obstacle to it** — the SRS is precise enough that a contradiction is likely to be real.)*
- **FR-SCH-03's ranking rule is ambiguous** for a case you need to test. **MANDATORY: Do not invent a tiebreak and encode it in a test.** An invented rule, once it is in a test, becomes a requirement nobody agreed to — **and prompt 05 will faithfully implement it.**
- The contract cannot express an assertion you need.

> **An escalation is a success, not a failure.** A RED packet that finishes with zero questions about a specification this detailed is the outcome to be suspicious of.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when `npx jest engine` fails on every test with `Error: 05`, and `engine/src/` contains one throwing stub and nothing else.**

**CRITICAL**: You are writing tests. **You are not writing the engine.** Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect** — report it rather than reconciling it.
