# Packet 06 (RED) — Agent Report and Escalations

**Packet:** `prompts/engine/06-reschedule-service-tests-RED.md` · **Phase:** 🔴 RED · **Human owner:** Patrick Rucker
**Run:** 22 July 2026 · **Branch:** `wp-06-reschedule-red` · **Spec:** SRS **v2.16** *(ratified 22 July)*
**Status:** ✅ **Gate held 22 July 2026 by Patrick Rucker (owner), reviewing ALONE.** The second-human review required by `AGENTIC-TDD-WORKFLOW.md` §6 was **waived, deliberately and on the record**: Ryan and Miguel have not yet worked with this method, and a nominal sign-off would assert a review that did not happen — **worse than no gate, because the assertion outlives everyone's memory of how it was obtained.** **All fourteen escalations adjudicated into SRS v2.16; none open.** *If a later reading finds a test wrong, the remedy is a RED-style correction commit carrying a human's reasoning (`CLAUDE.md` §8.3) — never a quiet edit inside a GREEN diff.*

> **This file exists to be read at the gate, before the freeze commit.** Its contents belong in
> that commit's body — `CLAUDE.md` §8.3: *"an ambiguity the RED agent found and refused to guess
> at is the highest-value line in the whole log, and it exists nowhere else once the session ends."*

> **Third pass, then a fourth.** The first run raised **ten escalations**; all ten were adjudicated into
> **SRS v2.14** and the suite was rewritten against it. **Two were decided against this run's
> recommendation** — recorded below, because a report that only preserves the answers it
> proposed is not a record. **E11 fell out of that rewrite and is still open.** Then **v2.15**
> closed **OPEN-18**, giving FR-TSK-04 a mechanism at last — a seventh method, a fourth trigger
> value, and a ninth test file. **E11–E14 fell out of those two passes and were adjudicated into v2.16 on 22 July** — their four SRS notes were **drafted by this session and ratified by the human owner after independent verification**, which is the distinction the paragraph below is about.
>
> ⚠️ **E11–E14 have proposed resolutions below, and this agent wrote tests against them. That is
> not adjudication.** A resolution becomes a requirement when a human writes it into the SRS —
> not when a suite encodes it. *The same reasoning that separates RED from GREEN separates a
> proposal from a specification: a suite justified by a document the same session wrote is
> checking itself.*

---

## Result

| | |
|---|---|
| **Test suites** | 9 failed, 9 total |
| **Tests** | **154 failed, 154 total** *(100 → 127 at v2.14 → 145 at v2.15 → 154 with the E11–E14 tests)* |
| **Every failure's cause** | `Error: 07` — the stub. Verified mechanically: stripped ANSI, extracted the message line under all 154 `●` headers, `sort \| uniq -c` → `154  07`. |
| `find server/src -type f` | **1 file** — `server/src/reschedule/RescheduleService.ts`: types, ports, and seven methods whose only statement is `throw new Error('07')` |
| `npm run typecheck` | ✅ zero errors |
| `npm run lint` | ✅ zero errors — **and no `eslint-disable` anywhere under `server/`** (E7 closed properly, in `.eslintrc.cjs`) |
| `npm run guard:tests-frozen` | ✅ `P04: engine/test unchanged since ac06e70 (30 tests frozen)` |
| `npm run guard:engine-deps` | ✅ engine and shared declare zero runtime dependencies |
| `grep -rn "Date.now\|new Date(\|setTimeout\|setInterval" server/` | ✅ **silent** (exit 1). Every time in every fixture is a literal the test wrote. |

**154 is packet 07's target.** It must turn all 154 green **without editing a test file**.

### Files written

```
server/src/reschedule/RescheduleService.ts   the surface: async repo port, sync Clock, seven throwing methods
server/test/reschedule/support/harness.ts    doubles + fixtures. NOTHING in it computes a placement.
server/test/reschedule/triggers.test.ts        39  FR-RSC-01, FR-RSC-02, FR-RSC-08
server/test/reschedule/task-edited.test.ts     20  FR-TSK-04                        ← new at v2.15
server/test/reschedule/completion.test.ts      16  FR-RSC-07, FR-RSC-09
server/test/reschedule/unplaceable.test.ts     21  FR-RSC-05, NFR-REL-01
server/test/reschedule/reason.test.ts          14  DR-03, DR-06, FR-RSC-04 (data only)
server/test/reschedule/idempotence.test.ts     13  FR-RSC-06, NFR-REL-02
server/test/reschedule/placement-order.test.ts  11  FR-SCH-10
server/test/reschedule/single-engine.test.ts   11  FR-RSC-03 (the testable half) + the REAL engine
server/test/reschedule/elapsed-sweep.test.ts    9  FR-RSC-10
```

Every `it()` name cites its requirement ID. **Six tests run against the real `findCandidateSlots`
from `@capstone/engine`** — five in `single-engine.test.ts`, including **UC-05, UC-06 and UC-13
end to end**, and the FR-SCH-10 contention test, where the losing task's next-best alternative is
chosen by the engine rather than by the fixture.

**Nothing in `server/` finds a free gap, merges intervals, chooses among candidates by any
criterion other than the rank the engine returned, or computes a start time.** The only
arithmetic in the suite is `at(hour, minute)`, which turns a readable clock label into the
contract's `Minute`, and a clock-label renderer in `reason.test.ts` used to check that a stored
sentence *states a time at all* without freezing which format it states it in.

---

## What v2.14 changed in this suite

| # | Adjudication | What the suite does now |
|---|---|---|
| **E1** | A **fully elapsed** preferred window is **substituted** with the remainder of the day on the engine call; the **stored task is unchanged**; a **partly elapsed** window passes through as it stands; `now` at or past the day's end means the engine is **not called** and the reason is **`DAY_FULL`**. | A new `describe` block of seven, plus the partly-elapsed case on the skip path, plus the sweep. **And the real-engine UC-05 test that could not exist before**: a 20:00 reading missed at 20:35 lands at **21:15**, through `findCandidateSlots`, with nothing stubbed. |
| **E2** | `onCommitmentAdded(commitment, date)`. | Signature updated at every call site, plus a test that the **date argument selects the day, not the clock** — a commitment added for tomorrow at 17:00 leaves today's 17:00 alone. |
| **E9** | `TaskRepository` is **asynchronous**; `nextPlacementId` and `Clock` stay synchronous. | The port and the whole suite are `async`/`await`. The in-memory double is async **below the divider only** — its arrangement and assertion helpers stay synchronous, so a test still reads as a schedule rather than as promise plumbing. |
| **E10** | Displacement **moves the row in place**: same id, status stays `PLANNED`, trigger `DISPLACED`, no successor. Idempotency for displacement is **"no longer overlaps"**, not "no longer `PLANNED`". | A four-test block on the row's identity and status, a test contrasting the two shapes side by side (*only the missed trigger leaves a record of the old occurrence*), and a dedicated idempotence block asserting the **second route** to a no-op. |
| **E6** | FR-RSC-09 covers the **missed classification only**. | No test asks for a withdrawal on the other two paths, and two tests assert it does **not** happen — a skip-moved occurrence completes ordinarily, and a displaced one **has no earlier occurrence to withdraw at all.** |
| **E3** | FR-RSC-05 covers **skipped** too. | Kept, and the test now cites the requirement's own sentence rather than UC-10 and UC-13 alone. |
| **E5** | Order on **`(has instant, instant, id)`** — *not* pairwise `id`. | Four pair cases including **the mixed pair (known instant first, whatever the ids say)**, plus the SRS's own three-task counter-example `A(10:00,'a') B(absent,'b') C(09:00,'c')` → **`c, a, b`**, which is the case the rejected comparator turns into a cycle. |
| **E7** | `.eslintrc.cjs` carries `argsIgnorePattern: '^_'`. | File-level `eslint-disable` deleted; the `_` prefixes stay. `server/src` now contains no lint suppression of any kind. |
| **E4** | Two citations corrected to UC-10. | Documentation only — nothing in the suite depended on it. |
| **E8** | Deferred to packet 12 as **OPEN-17**. | **No test written.** `placement-order.test.ts` says so in its header, so the omission is visible rather than merely absent. |

### The two that were decided against this run's recommendation

Both are worth keeping in the record, because in both cases the recommendation was *plausible*
and *wrong*, and the reason it was wrong is not obvious from the requirement text.

- **E5 — "if either is absent, compare that pair by `id`" is not transitive.** It gives
  `A < B`, `B < C` and `C < A` for `A(10:00,'a')`, `B(absent,'b')`, `C(09:00,'c')`, and **a sort
  handed a cycle returns whatever its pivots produce** — which is exactly the non-repeatable
  order FR-SCH-10 exists to eliminate. *A pairwise rule can look total while defining no order
  at all, and every pairwise test anyone thinks to write still passes.* The single ranking key
  is total by construction. **The suite now contains the three-task case, so the cycle cannot
  come back unnoticed.**
- **E9 — the repository had to be asynchronous.** The argument for synchronous was that it keeps
  the frozen assertions about rescheduling rather than about promises. The argument against is
  decisive: **packet 12 implements this port over the promise-based MongoDB driver, and a port
  its only real implementer cannot satisfy is the wrong port.** Discovering that after the freeze
  would mean editing frozen tests. `await` costs one keyword per call; a re-freeze costs the
  correctness argument.

---

## What v2.15 added — FR-TSK-04 (OPEN-18)

FR-TSK-04 is **Essential** and, before v2.15, **appeared exactly once in the SRS**: no use case,
no sequence diagram, no class, nothing in §3.6 that answered *"the task's own attributes
changed."* It is now `RescheduleService.onTaskEdited(task, date)`, `RescheduleTrigger` has a
fourth member `EDITED`, and this suite has `task-edited.test.ts` — **17 tests**, plus one added to
`completion.test.ts`, because *"a completed task shall **never** be rescheduled"* is a quantifier
and there is now a fourth trigger for it to range over.

The four obligations, and what carries each:

| Obligation | Tests |
|---|---|
| **A still-valid placement is left alone** — engine not called, nothing stored | 3. **This is the block that matters.** A service that re-places unconditionally satisfies every other assertion in the file — right trigger, right reason, engine called — while moving the user's tasks for no reason. One of the three asserts that a placement which did not move keeps its original `placementReason` and **acquires no trigger**: a schedule that says "moved because you edited it" about a task that never moved is false in the one place the user reads. |
| **An invalidated placement is re-placed through the engine** | 6, covering both ways an edit invalidates — the new duration no longer fits the placed interval, and the placed interval no longer lies inside the new window — plus the control case, rank-1 selection, the day beginning at `now`, and the occurrence's own interval being excluded from `busy`. |
| **`EDITED` trigger and a distinguishable sentence** (DR-06, DR-03) | 3, including an edited sentence differing from **both** a missed and a skipped one. |
| **The check may only reject, never choose** (FR-RSC-03) | 3: every re-placement traces to a `findCandidateSlots` return value, the engine saying no means the service places nothing, and NFR-REL-01's task survives regardless. |

Plus two on occurrences this trigger does not touch: a **FIXED** task edit (`NOT_FLEXIBLE`, engine
not called) and a task with **no `PLANNED` occurrence** on that date (`NOT_PLANNED`).

**Deliberately absent, per v2.15:** anything about FR-SCH-10 — it orders *several* flexible tasks
and this re-places *one* — and anything about a recurring task's other dates, which are the
caller's business under FR-TSK-05. One test asserts that boundary directly: an edit given `TODAY`
leaves tomorrow's occurrence of the same task untouched.

---

## E11–E14 — proposed resolutions, ⏳ AWAITING ADJUDICATION

⛔ **Nothing in this section is settled.** Ten escalations were adjudicated by the owner into
v2.14 and v2.15. **These four have not been**, and the tests written against them stand or fall
with the decision. Three of the four are consequences of v2.14 and v2.15 rather than defects in
the original specification — which is what a spec looks like while it is being made precise.

⚠️ **Read the reasoning below as an argument, not as a record.** Each is what this agent
recommended and would implement; **each needs a human to accept it, reject it, or replace it**,
and then to write it into the SRS with a revision row before it binds anything.

### E11 — a displaced or edited occurrence the engine cannot re-place has its **row removed**

`TaskRepository` gains `deletePlacement`, **the only deletion the domain performs**, with a note
in §3.6 to question any second caller.

A missed or skipped occurrence is already out of `PLANNED` by the time the engine is asked, so
FR-RSC-05's *"no `PLANNED` placement"* costs nothing. A displaced or edited one is still
`PLANNED`. **Leaving it stores the flexible task overlapping the commitment that displaced it** —
and, far worse, FR-RSC-05 recognises an unplaced task by the **absence** of a `PLANNED`
placement, so an occurrence that keeps one still *looks placed*: **the next-day offer silently
stops being made, and a day that later frees up never heals it.** The overlap would be visible;
the missing offer would not.

*Rejected: a new `PlacementStatus` member — v2.13 had already refused one, because a `Placement`
that is nowhere carries a `start` and an `end` that mean nothing.*

**Six tests** in `unplaceable.test.ts`, including the overlap assertion, the re-derived offer, and
the day freeing up.

### E12 — FR-RSC-05 no longer enumerates its triggers

Now: *"Where **a task's occurrence** cannot be re-placed…"*. **The list is gone rather than
extended**, because the list is the defect: it read *"missed or displaced"* until E3 added
*"skipped"* at v2.14, and six hours later v2.15 added a fourth trigger without revisiting it —
the identical omission in the identical place. *An enumeration inside a requirement must be
updated every time the set it names grows, and **nothing fails when it is not.*** A fifth trigger
cannot reopen this. **One test**, asserting the offer for an edited task.

### E13 — the validity predicate is exact, and the window is part of it

**Any duration change invalidates, including a shorter one.** Every placement leaves the engine
with `end = start + duration`, so a 60-minute block held for a 30-minute task is not a roomy
booking — **it is the wrong occurrence**: it blocks half an hour of the day from everything else,
skews FR-SCH-10's contention, and shows the user a block of the wrong length. *Trimming `end` in
place was rejected — it computes a time outside the engine.*

**And "lies inside the window" is genuinely part of validity**, despite FR-SCH-02 legitimately
placing tasks outside their window: without it, **editing the preferred window could never
invalidate anything** — the old slot still fits and is still free — and half of FR-TSK-04's own
sentence would be dead text. The consequence is accepted: an edit re-evaluates a task sitting on
a ranked alternative, and the engine returns the same slot unless something nearer the preference
has opened up. **One test.**

> ⚠️ **This one reversed a recommendation I had already given.** I argued `≥` — "the placement
> violates nothing" — and that was wrong: a `Placement`'s interval *is* the occurrence, not a
> booking with slack, and every busy-interval reader propagates the error. Recorded because a
> report that quietly drops its own bad calls is not a record.

### E14 — an edited occurrence is **moved in place**

Same row, still `PLANNED`, trigger `EDITED`, no successor — FR-RSC-02's reasoning unchanged: the
original is kept as `MISSED` or `SKIPPED` only where **something happened** at the old time, and
nothing happened here. A successor would also need a status for the row left behind, and
`PlacementStatus` has none.

⚠️ **E14 is the one worth remembering, because it was an absence.** Nothing in the suite pinned
the shape — every assertion passed under both designs — so there was nothing to notice. Packet 07
would have picked one by instinct and frozen it into the data model FR-ANL and the dashboard
read. *A missing assertion cannot be found by reading the assertions that are there; it was found
by asking, of a requirement, "what does this do to the stored row?" and getting no answer from the
document.* **Two tests.**


## Interpretations that remain — sanity-check these, they are cheap to change now

Each is a place where the SRS is silent and a test had to take *some* position. None invents a
rule the SRS argues against; all are one edit away from being changed.

| # | Interpretation taken | Why |
|---|---|---|
| 1 | **`moveToNextDay(taskId, date)`'s `date` is the day the task could NOT be placed on**, and the placement is made on `clock.nextDate(date)` | FR-RSC-05's offer is *made* on the failing day, so that is the date the caller is holding. The alternative reading makes the method name redundant. |
| 2 | **The next day is offered in full — its `schedulableDay` is not narrowed, and the task's real preferred window is used** *(now asserted, having survived the v2.14 review)* | `now` is not on that day. Both of v2.14's rules — narrowing and substitution — are about a window's relationship to the **current** day. |
| 3 | **FR-RSC-09's successor is found as: the task's `PLANNED` placement on the same date carrying a `rescheduleTrigger`** | No link field was added to `Placement` — the contract is not mine to change (§4.7) — and one `PLANNED` placement per task per date makes the lookup unambiguous. |
| 4 | **The commitment is already recorded for the date when `onCommitmentAdded` is called** | §3.4's sequence diagram: *insert the fixed commitment*, **then** *find placed flexible tasks that overlap*. |
| 5 | **A task with no `PLANNED` placement and no completion is re-attempted on every retrieval**, and where it was missed the re-attempt records `MISSED` | This is FR-RSC-05's *"free the day up and the next retrieval places the task"* made operational. |
| 6 | **`sweepElapsed` and `onCommitmentAdded` return outcomes only for occurrences they acted on or offered** | Otherwise *"a retrieval when nothing has elapsed changes nothing"* is an assertion about noise. |
| 7 | **`onTaskMissed` on an occurrence whose window has not fully elapsed is a no-op** (`WINDOW_NOT_ELAPSED`) | FR-RSC-01's condition, read literally — and it is what keeps FR-RSC-08 meaningful, since a skip must be accepted in exactly the case a miss must not. |
| 8 | **The occurrence being moved is not in the busy set for its own re-placement** — asserted for **all four** triggers | UC-13 step 3: *"re-invokes the same engine with the **updated** busy set."* It matters more since E10: a displaced row stays `PLANNED`, so a service reading "all `PLANNED` placements" would route the task around itself. An edited occurrence is in the same position. |
| 11 | **`onTaskEdited` narrows `schedulableDay` to begin at `now`**, like the other three | v2.12's rule is written as governing "all three triggers" because there were three when it was written. Its rationale — every candidate returned lies in the remainder of the day — is about re-placement, not about which trigger asked. |
| 12 | **A FIXED task's edit is a no-op here** (`NOT_FLEXIBLE`, engine not called) | A fixed commitment's placement is the user's statement, not the engine's answer — §3.4 inserts it directly — and FR-RSC-02 makes it immovable by the scheduler. Moving one belongs to the creation path (packet 12); computing where it goes *here* would be the second placement function. |
| 13 | **An edit to a task with no `PLANNED` occurrence on that date is a no-op** (`NOT_PLANNED`) | v2.15's boundary: `RescheduleService` re-places occurrences that exist. An unplaced task is re-attempted by the sweep on retrieval (FR-RSC-05), not by the edit. |
| 14 | **The engine is handed the EDITED task**, with the new attributes, not the stored one | Otherwise the re-placement is computed against the values the user just replaced. Asserted directly (`asked.task.durationMinutes` is the new duration). |
| 9 | **`RescheduleOutcome` and `CompletionOutcome` are the return types** (§3.6 says `void`, which means "the diagram does not say") | They carry FR-RSC-04's three facts and FR-RSC-05's offer, which the packet requires a test to be able to assert. |
| 10 | **UC-13's *"subject to FR-RSC-06's termination bound"*** is read as the end of the day, not a count | FR-RSC-06: *"Termination needs no counter and no cap."* No test asserts a maximum number of reschedules — writing one into a frozen test would **create** the cap the SRS refused. Minor wording tension worth tidying in UC-13. |

### ⚠️ One trap this suite cannot catch, recorded for packet 07 and for the gate

v2.14 warns that on a **substituted** call *every* candidate is "within the preferred window" as
far as the engine can see, so **`Slot.withinPreferredWindow` says nothing about the user's stated
preference** and must not be presented as though it does.

**No test here can enforce that**, because the only observable would be the wording of
`placementReason` — and asserting prose is precisely what this suite refuses to do (packet 07
would implement the assertion's phrasing as a requirement). So it is written down instead:

> ⛔ **Packet 07: do not build `placementReason` out of `slot.withinPreferredWindow`.** On a
> missed reschedule it is `true` and it means nothing. A sentence reading *"placed inside your
> preferred window"* on a task the user missed at 8 PM would be **false, plausible, and green.**

---

## What the gate should look at hardest

Per `docs/AGENTIC-TDD-WORKFLOW.md` §6, in priority order:

1. **The real-engine UC-05 test in `single-engine.test.ts`.** It is the whole of E1 in one
   assertion: 20:00 reading, missed at 20:35, a call holding 20:30–21:15, **placed at 21:15** by
   `findCandidateSlots` itself. Before v2.14 this test could not pass on any implementation. If
   the substitution rule is ever weakened, this is what goes red first — so check the fixture is
   really unstubbed and the number really comes from the engine.
2. **`unplaceable.test.ts` — the whole file, and NFR-REL-01's conservation test in particular.**
   The service-level twin of FR-SCH-06, and **it fails silently by construction**: a service that
   drops a task it cannot place raises nothing and reddens nothing unless a test goes looking for
   the task afterwards. Read the two "derived, not stored" tests especially — they are what stops
   packet 07 quietly adding an `UNPLACED` row. **Then read E11**, which lives in this file's gaps.
3. **`task-edited.test.ts` — the FIRST block, not the rest of the file.** *"Re-place it **if** the
   current placement is no longer valid"* is a condition, and a service that ignores it passes
   every other test in that file. Three tests assert an **absence** — no engine call, no stored
   change, no trigger stamped on a placement that never moved — and absences are what a reviewer
   skims past.
4. **The row-shape tests — `task-edited.test.ts`'s "moved in place" block, and
   `unplaceable.test.ts`'s "leaves no placement behind".** These are E14 and E11, and they are
   here because **nothing pinned either shape** — see E11 and E14, both open. They are also the assertions packet
   07 is most likely to satisfy accidentally and then break under a refactor, since both are about
   how many rows exist rather than about what any one row says.
5. **`completion.test.ts` — "frees the interval the withdrawn placement held."** The half an
   implementation forgets, and the only one of FR-RSC-09's five obligations that cannot be
   satisfied by setting a status.
6. **`placement-order.test.ts` — the second test, and the three-task one.** *"Each resulting
   placement becomes a busy interval for the next call"* is FR-SCH-10's substance: an
   implementation that sorts perfectly but passes a stale busy set puts two tasks on top of each
   other while every ordering assertion still passes. The three-task test is E5's cycle, and it
   is the one a future refactor is most likely to "simplify" back into a pairwise comparator.
7. **`support/harness.ts` — read the doubles for placement logic.** The one thing that would void
   this packet is a double that computes a placement. `scriptedEngine` and `engineByTask` return
   literals the test wrote; `realEngineSpy` delegates to `findCandidateSlots` and adds nothing.
   **If any of them starts searching, ranking, or merging, send it back.**
8. **The rank-1 fixtures.** Every one returns a rank 1 that is **not** the earliest candidate —
   including two real-engine tests, where the engine itself ranks 5:45 PM ahead of an earlier
   4:00 PM. A suite whose fixtures agreed would pass under both readings and prove nothing.

---

## After the gate

- [ ] Freeze commit — **test files plus the one throwing stub, nothing else** (`CLAUDE.md` §8.3),
      with these escalations in the body.
- [ ] **Register the suite in `scripts/frozen-tests.json`**: packet `06`, path
      `server/test/reschedule`, the freeze sha, the date, owner, `tests: 154`. *(Not done here —
      that file is read-only to this packet, and registration is the gate's step. **A frozen suite
      that is not in that file is not protected, and CI passes either way**, which is exactly why
      this is the step that gets skipped.)*
- [ ] Post **154** to the team. That number is packet 07's target.

---

# ⚠️ Post-freeze correction — one fixture, `triggers.test.ts`

**Raised during packet 07 (GREEN). Test changed: 1. Assertions changed: 0. Other tests changed: 0.**

> **This is a RED-style correction, and it is the only kind permitted after a freeze**
> (`CLAUDE.md` §8.3): the fixture was wrong, it is fixed in its own commit with the reasoning
> written down, and **it is not fixed quietly inside a GREEN diff** — where a weakened test and a
> corrected one look identical forever afterwards. **The re-freeze is a human's commit, and
> `scripts/frozen-tests.json` must move to the new sha in it**, or the guard goes on protecting a
> sha that no longer describes the suite.

## What was wrong

`DR-06: three reschedules on one day record three different triggers` walks one day through
skip → displace → miss and asserts `['SKIPPED', 'DISPLACED', 'MISSED']`. **It could not produce
the middle one.**

The skip was scripted with the shared `SKIP_CANDIDATES`, whose rank 1 is **20:00–21:00**. So
`onUserSkipped` moved Gym *clear* of the Advisor meeting (17:00–17:45) before the commitment was
ever added. By the time `onCommitmentAdded` ran, the only row still overlapping the meeting was
the **`SKIPPED`** one, and `READ_PLANNED` was not added to the store until afterwards — so there
was nothing to displace, `onCommitmentAdded` correctly returned `[]`, and the result was
`['SKIPPED', 'MISSED']`.

**The fixture contradicted its own intent, and the engine script is the evidence**: its second
entry is `GYM_CANDIDATES`, whose rank 1 is **17:45** — "just after the Advisor ends" — an answer
that only means anything if Gym were still sitting on the Advisor when it landed.

## What was NOT wrong

**The requirement, and the implementation's refusal to satisfy this test as written.** Two rules
would have made the old fixture pass, and both are defects:

| The rescue | Why it is wrong |
|---|---|
| Displace any non-`COMPLETED` row that overlaps | It moves the `SKIPPED` occurrence, **overwriting DR-06's record that the user skipped it** — the only thing that knows *"you skipped the 5:00 PM session"* is the true sentence rather than *"this was missed"* (FR-DSH-05). |
| Match the overlap at **task** level, then move a different row | The `SKIPPED` row never leaves `SKIPPED`, so the overlap survives the move and **the commitment displaces the task again on every retrieval** — FR-RSC-06 failing, and FR-RSC-10 firing it forever. |

⚠️ **Both are non-idempotent, and `idempotence.test.ts` would have stayed green under either**,
because none of its fixtures contain a `SKIPPED` row. *That is the more valuable half of this
finding: a suite can be idempotence-tested and still not test idempotence in the presence of the
one status that makes it hard.* **A fixture gap in one file was covering a rule gap in another.**

## The fix

A **local** result, `SKIP_ONTO_ADVISOR`, whose rank 1 is **17:15–18:15** — a genuine move that
**still overlaps** 17:00–17:45, so the displacement has something to act on. Rank 1 remains later
than rank 2, keeping this file's "rank 1 is not the earliest" convention.

**`SKIP_CANDIDATES` is untouched**, because the FR-RSC-08 block depends on it: there, landing at
20:00 is the point. The comment above the new constant says all of this, and says not to
"simplify" it back.

## How this was done, and the one thing to check

The correction was made **without reading `server/src/reschedule/` and without running the
reschedule suite** — the stub is gone, so a green run would only prove the fixture had been tuned
until the implementation liked it. `npm run typecheck` and `npm run lint` pass; neither gives
behavioural feedback. **The fix is verifiable by arithmetic alone**: does `17:15–18:15` overlap
`17:00–17:45`? That is the whole of it.

> ⚠️ **Disclosure.** While this correction was being made, the tooling injected a large excerpt of
> `RescheduleService.ts` into the session automatically — it was not opened, but it was in front
> of the agent. **Weigh the fix accordingly**, and note that it rests on interval arithmetic and
> the requirement text rather than on anything the implementation does.
