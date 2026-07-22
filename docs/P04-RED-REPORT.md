# Packet 04 (RED) — Agent Report and Escalations

**Packet:** `prompts/engine/04-engine-tests-RED.md` · **Phase:** 🔴 RED · **Human owner:** Patrick Rucker
**Run:** 22 July 2026 · **Status:** ⏳ awaiting the human gate (`docs/AGENTIC-TDD-WORKFLOW.md` §6)

> **This file exists to be read at the gate, before the freeze commit.** Its contents belong in
> that commit's body — `CLAUDE.md` §8.3: *"an ambiguity the RED agent found and refused to guess
> at is the highest-value line in the whole log, and it exists nowhere else once the session ends."*

---

## Result

| | |
|---|---|
| **Test suites** | 6 failed, 6 total |
| **Tests** | **30 failed, 30 total** |
| **Every failure's cause** | `Error: 05` — the stub. Verified by stripping ANSI and reading all 30. |
| `git diff --stat engine/src/` | **1 file, 6 insertions** — the throwing stub, one import, one comment line |
| `npm run typecheck` | ✅ zero errors |
| `npm run lint` | ✅ zero errors — *after* the E5 guard fix, which is a separate `guard:` commit |
| `npm run guard:engine-deps` | ✅ engine and shared declare zero runtime dependencies |

> **Status of the escalations: E1, E3 and E5 were decided on 22 Jul and are closed below.**
> **E2 became SRS OPEN-13 and is due before packet 05.** E4 and E6 still want a nod at the gate.
> The original count was 30 failed + 1 todo; the todo was E1's placeholder and is gone now that
> FR-SCH-03(b) is deleted.

**30 is packet 05's target.** It must turn all 30 green without editing a test file.

### Files written

```
engine/src/index.ts            the throwing stub — the only implementation code in this packet
engine/test/boundary.test.ts   FR-SCH-09, all eight rows (NFR-COR-03)
engine/test/ranking.test.ts    FR-SCH-02, FR-SCH-03, NFR-COR-02
engine/test/purity.test.ts     FR-SCH-05
engine/test/no-slot.test.ts    FR-SCH-06
engine/test/property.test.ts   NFR-COR-01, 1,000 cases, six invariants
engine/test/performance.test.ts NFR-PERF-01
```

No fixture module, no shared helper, no interval arithmetic beyond a two-line `overlaps`
assertion predicate that is redefined locally in each file that needs it. **Nothing in this
packet merges intervals or finds a free gap.**

---

## ⛔ Escalations — decide these at the gate

### E1. ✅ CLOSED 22 Jul — criterion (b) deleted from FR-SCH-03 (SRS v2.7)

**Patrick's decision: delete it.** Ranking is now (a) proximity to the preferred window, then
(b) earlier start — both already tested. The `it.todo` placeholder is removed; a comment in
`ranking.test.ts` records why no test exists. Priority is untouched on `Task` and untouched in
FR-SCH-07. Cross-references chased: SRS §3.8.4, revision history, Appendix C,
`AGENTIC-TDD-WORKFLOW.md` §4, `CLAUDE.md` §8.6, and packet 04's own verbatim quote.

<details><summary>Original escalation, kept for the record</summary>

#### FR-SCH-03(b) cannot be expressed against the contract — **the important one**

FR-SCH-03 ranks by *"(b) the task's priority relative to **neighbors**."*

The engine's signature is `(busy: readonly Interval[], task: Task, schedulableDay: Interval)`, and
`Interval` is `{ start, end }`. **There is no neighbour priority in the engine's inputs.** Busy
intervals do not carry a priority, an owner, or a task id — by design, since that is what keeps the
engine pure and re-invocable for FR-RSC.

**No test was written for criterion (b).** It stands as `it.todo` in `ranking.test.ts` so the gap is
visible in the test output rather than silently absent.

**The options, as I see them:**

| Option | Consequence |
|---|---|
| **Delete (b) from FR-SCH-03**, leaving proximity then earlier-start | Cleanest. (b) may be a leftover from the FR-SCH-07 displacement design, which *does* need neighbour priorities — and FR-SCH-07 is Conditional and out of scope. **This is my read, but it is a requirements decision, not mine to take.** |
| **Widen `busy` to carry priority** | Changes the contract → team decision, decision-log row (§4.7), and it touches every module that calls the engine. |
| **Reinterpret (b) as the placed task's own priority** | Cannot break a tie between two candidate slots for the *same* task — the value is identical for both. It would be a no-op dressed as a rule. |

Whatever is decided, **the SRS needs the edit and the revision history and traceability matrix need
chasing** (§0 rule 3).

</details>

### E2. ➡️ BECAME SRS **OPEN-13** — owner Patrick, due **before packet 05**

Nothing in the frozen suite depends on the answer, so it does not block the freeze. But packet 05
**will** settle it silently if nobody settles it first, and it would then be an unstated requirement
living only in the implementation.

#### How a candidate's start is chosen inside a longer free interval is unspecified

FR-SCH-03 ranks candidate slots but the SRS never says *where inside a free interval a candidate
starts*. Two rules are both consistent with Appendix A:

- **earliest start in the interval**, or
- **the start closest to the preferred window.**

Appendix A cannot discriminate: in all three of its ranked candidates the two rules give the same
answer. They diverge whenever a free interval is longer than the task and sits *before* the
preferred window — e.g. free 07:00–10:00, task 60 min, preferred 10:00: earliest gives 07:00,
closest gives 09:00.

**No test asserts a start position where the two rules disagree.** The Appendix A test and the
tiebreak test both use intervals where they agree, so they stay valid under either decision.

### E3. ✅ CLOSED 22 Jul — exactly one slot; the test stays

**Patrick's decision: keep the strict reading.** FR-SCH-02's "up to three" therefore applies only
when the preferred window fails. The test remains in `boundary.test.ts` labelled `(E3 — confirm at
gate)`; that label can now be read as confirmed.

#### Does a successful in-window placement return exactly one slot?

FR-SCH-01 says *"return **a** placement"* (singular) and Appendix A returns one. But FR-SCH-02's
"up to three" is right next to it, and the SRS never states the cardinality outright.

Encoded as the strict reading — `slots).toHaveLength(1)` — but deliberately isolated in its own
`it()` named `(E3 — confirm at gate)`, so **if you disagree you delete one test rather than unpick
an assertion.**

### E4. ⏳ Confirm at the gate — zero-length busy intervals: packet vs contract

Packet 04 asks the property generators to include *"zero-length busy intervals."* The ratified
contract declares `Interval`'s invariant as **`end > start`**.

Generating them would test behaviour outside the type's domain and push packet 05 into defending
against an input that cannot occur. **The generators respect the contract** (`min: 1` length). The
zero-*gap* concern the instruction was reaching for is covered properly by the FR-SCH-09
"adjacent, no gap" row, which asserts no zero-length **slot** is ever returned.

Per the packet's own rule — *where the prompt and the SRS disagree, the SRS wins and the prompt is
a defect* — I believe the packet line should be corrected. Confirm.

### E5. ✅ CLOSED 22 Jul — guard fixed; `npm run lint` now passes

**Patrick's decision: fix it now, as its own `guard:` commit** so the RED freeze diff stays purely
test files (§8.3).

**The fix was not the obvious one, and the reason is worth keeping.** `no-restricted-imports` matches
with **gitignore semantics**, under which *a file cannot be re-included if its parent directory is
excluded.* So `'*'` excluded the `@capstone` **directory**, and `'!@capstone/shared'` silently failed
to rescue it — the first repair attempt looked correct and still produced 7 errors. The working form
re-includes the scope directory, re-denies the sibling workspaces, then permits exactly one:

```js
['*', '!@capstone', '@capstone/*', '!@capstone/shared', '!.', '!./**', '!..', '!../**']
```

Verified by probing the matcher directly — `@capstone/shared` allowed; `@capstone/server`,
`@capstone/web`, `mongodb`, `express`, `node:fs` and (in `engine/src`) `fast-check` all still blocked.
`fast-check` is permitted **only** under `engine/test/**`.

> **The general lesson, which is bigger than this bug:** §4.8 turns inspection-only requirements into
> executable guards precisely so they cannot silently become false. **This guard was itself silently
> false for a week.** A guard that has never once failed is not a guard that works — every (I)-guard
> needs a case that *should* trip it, run at least once. Worth applying to packet 16.

<details><summary>Original escalation, kept for the record</summary>

#### The FR-SCH-05 import guard is broken and blocks the packet's definition of done

`.eslintrc.cjs` restricts `group: ['*']` for `engine/**`, with the message *"engine/ may import ONLY
relative paths and @capstone/shared."* **In practice it blocks those two as well** — all 14 errors
are `@capstone/shared`, `../src/index`, and `fast-check`. It even rejects the stub's own import.

**This has been green in CI only because `engine/` was empty.** The first engine file of any kind
turns it red, which is now.

`.eslintrc.cjs` is outside this packet's editable files, so **I have not touched it.** The fix is to
allow relative paths and `@capstone/shared` everywhere under `engine/`, plus `fast-check` under
`engine/test/**` only — NFR-COR-01 mandates a fast-check property test, so the guard as written
forbids a requirement the SRS makes Essential.

> **Worth noticing on its own terms:** this is exactly the failure §4.8 predicts for inspection-only
> requirements — a guard that looks right, is never exercised, and is wrong. It was caught because
> something finally ran against it.

</details>

### E6. ⏳ Confirm at the gate — FR-SCH-09's "window outside the day" row vs FR-SCH-02's fallback

FR-SCH-02 says that when the preferred window has no sufficient free interval, the engine searches
**the remainder of the schedulable day**. Read alone, a window outside the day would fall through to
that search and get placed somewhere.

FR-SCH-09's last row says **empty result with reason**. `NoSlotReason` also carries a dedicated
`WINDOW_OUTSIDE_SCHEDULABLE_DAY` code.

Two independent ratified artefacts agree, so this is encoded as the table states — reject, do not
fall back. **Flagged rather than silently resolved**, because it is a real tension in the SRS text
and the SRS should probably say so explicitly.

---

## Lower-priority interpretations — sanity-check these, they are cheap to change now

| Test | Interpretation taken | Why |
|---|---|---|
| Day entirely busy → `DAY_FULL` | rather than `NO_INTERVAL_LONG_ENOUGH` | The enum has a code that names this situation exactly. |
| Duration 240 on a 180-minute day → `DURATION_EXCEEDS_SCHEDULABLE_DAY` | rather than `NO_INTERVAL_LONG_ENOUGH` | The more specific code exists; both are literally true. |
| Whole-day-duration task on a non-empty day → `NO_INTERVAL_LONG_ENOUGH` | rather than `DAY_FULL` | The day is not full — one 60-minute commitment. No interval is long enough. |

---

## What the gate should look at hardest

Per `AGENTIC-TDD-WORKFLOW.md` §6, in the order the checklist gives them:

1. **`ranking.test.ts` — the Appendix A test.** It asserts an exact three-element ordering
   transcribed from the SRS. **If that transcription is wrong, packet 05 will faithfully implement
   the wrong ranking and every other test will still pass.** Read it against Appendix A line by line.
2. **`boundary.test.ts` — "one minute short."** §2.1's worked example and the trap the whole packet
   warns about. It asserts both halves: nothing lands at 1021, *and* the task is placed at 1200.
   Confirm the second half is really there and really asserted.
3. **`property.test.ts` — read the generators, not the assertions.** Busy intervals may overlap,
   abut, spill outside the day, and span it entirely; windows may straddle the day's edge; durations
   may be impossible. If they look polite to you, send it back.
4. **`no-slot.test.ts` — the last test.** Six hostile inputs, and for each the engine must either
   report failure or return only valid slots. This is FR-SCH-06's teeth and NFR-ROB-03.
