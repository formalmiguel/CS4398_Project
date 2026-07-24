# CRITICAL REQUIREMENTS — 06 Reschedule Service: TEST SUITE (🔴 RED)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer writing a test suite. **CRITICAL**: You are writing the test suite for the **RescheduleService** — the policy layer that decides *when the engine is called again*. **You will not write the service, and you will not touch the engine.**

| | |
|---|---|
| **Phase** | 🔴 **RED — tests only.** You will write **no implementation.** |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 03 (contract), 04 (frozen engine suite), **05 (the engine — merged and green)** |
| **Spec** | `docs/SRS-v2.md` §3.8.5 (FR-RSC), §3.8.4 (**FR-SCH-10**), §3.8.2 (**FR-TSK-04**), §3.6 (class diagram), §5 (DR-03, DR-06), §6 |

---

## ⛔ **CRITICAL**: READ THIS BEFORE ANYTHING ELSE

**MANDATORY**: There will be a strong pull to write the service — the tests will not compile against methods that do not exist, and fixing that will feel like your job. **IT IS NOT.**

**CRITICAL**: Create `server/src/reschedule/RescheduleService.ts` declaring the surface in *"The Service Surface"* below, where **every method body is `throw new Error('07')`**. Type declarations and empty-bodied signatures are the **only** non-test code you may write. **No method may contain a statement other than that throw.**

**MANDATORY**: **Your tests are supposed to fail.** A red suite is this packet **succeeding.** If your suite goes green, you have written the service, and you have destroyed the thing this process exists to protect:

> **A test written by whoever wrote the implementation encodes what the code *does*, not what the requirement *says*.** It will be green and it will be wrong, and nobody finds out until the demo re-places a task the user already completed. A separate agent (prompt 07) writes the implementation against your tests, and **may not edit them.**

---

## ⛔ **CRITICAL**: FOUR THINGS ALREADY SETTLED — DO NOT RE-DERIVE THEM

**MANDATORY**: Each of these was decided on **22 July 2026** and is binding on this packet. A test that contradicts one of them is wrong, however reasonable it looks.

### 1. There is exactly ONE placement function, and it is not yours

**FR-RSC-03 is binding**: the service **re-invokes `findCandidateSlots`**. It **never computes a placement itself.**

> **CRITICAL**: If a test you are writing would require the service to *find*, *compute*, *scan for*, or *choose the time of* a slot on its own — **that test is wrong, and it is wrong in the exact way FR-RSC-03 exists to prevent.** The service decides *when to call the engine*, *what the day looks like when it calls*, *in what order*, and *what to do with the answer*. **It does not decide where a task goes.**
>
> *`CLAUDE.md` §4.3: "If you ever find yourself writing a second function that computes a placement, **stop** — that's the bug FR-RSC-03 exists to prevent." The tidy little `findNextFreeSlot()` helper inside a reschedule service is the canonical way this project could fail while every test stays green.*

### 2. `Slot.explanation` is the ENGINE's and is already implemented. The user-facing sentence is `Placement.placementReason`, and it is the SERVICE's

**MANDATORY**: Read the comments on **both** fields in `shared/src/contract.ts` before you write an assertion about either.

| Field | Owned by | Contains |
|---|---|---|
| `Slot.explanation` | **The engine** — packet 05, already written, **frozen behaviour** | Only what the engine can know: times, whether the slot is inside the preferred window, which ranked alternative it is. |
| `Placement.placementReason` | **This service** — you specify it, packet 07 writes it | **FR-DSH-05's sentence.** It names the commitment responsible and the trigger — *"Moved to 5:45 PM — your 5:00 PM slot was taken by Advisor"*. Stored, per **DR-03**. |

> **CRITICAL**: The engine receives `busy` as bare `Interval`s **with no titles**, so it *cannot* produce FR-DSH-05's sentence; only the caller holding the schedule can. **Write no test that asserts anything about `Slot.explanation`** — that is packet 04's, it is frozen, and asserting on it here would create a second owner for one requirement.
>
> **⛔ The natural way to "fix" this is to start pushing task titles into the engine. That ends the purity argument (FR-SCH-05) and changes the frozen contract. Do not go there — escalate instead.**

### 3. FR-SCH-10 is a SERVICE-level obligation, and it is tested HERE — never in `engine/test/`

**MANDATORY**: Ascending priority order (1 first); **each resulting placement becomes a busy interval for every task placed after it**; equal priority breaks on **earlier-created**. The engine places **one** task and its signature cannot express an ordering across tasks. **This requirement governs only the order in which the engine is invoked.**

### 4. FR-SCH-07 / FR-SCH-08 (priority displacement) are **Conditional** and **out of scope**

**MANDATORY**: **Write no test for them.** Per §2.7.1 they shall not be started until every Essential requirement is complete and verified. §3.8.4's design note describes how displacement *would* be built at service level — **it is a note about a future release, not an instruction to you.**

> *`CLAUDE.md` §6 calls this "the most seductive way to lose a week." It is. **Leave it alone.***

---

## **MANDATORY**: Requirements In Scope — Verbatim From `docs/SRS-v2.md`

> **CRITICAL**: Quoted **VERBATIM**. Do not paraphrase — *"It shall **not** silently discard the task"* is a testable obligation; *"handles the unplaceable case"* is not. **Paraphrasing is where the requirement quietly changes.**

### §3.8.5 — Automatic Rescheduling (FR-RSC)

> *This group adds **no new placement logic.** It specifies the events that cause the engine of 3.8.4 to be re-invoked, and the behavior required around that call.*

> **What the System passes to the engine, and which interval "elapsed" reads — added v2.17. These govern every trigger in this group.**
>
> **1. The busy set is `PLANNED` and `COMPLETED` occurrences only.** A `MISSED`, `SKIPPED` or `CANCELLED` occurrence **is not going to happen**, so it must not hold the day against a task that still could. *This is what satisfies FR-RSC-09's "free the interval it held" **by construction**: a withdrawn reschedule marked `CANCELLED` drops out of the busy set, and no cleanup code exists or is needed.*
>
> **2. The occurrence being re-placed is never in the busy set for its own re-placement**, for all four triggers. *Since v2.16 a displaced row **stays `PLANNED`**, so a service reading "every `PLANNED` placement" would route the task around itself.*
>
> **3. ⚠️ "Fully elapsed" in FR-RSC-01 means the OCCURRENCE's own interval — `placement.end` — not the task's preferred window.** The requirement says *"a flexible task's **window** has fully elapsed"* and the word does double duty: **the substitution rule (v2.14) reads `preferredWindow.end`, the miss condition reads the placed occurrence's end.** *Read the preferred window for the miss condition and **the System churns forever** — a 21:15 successor of a task whose window closed at 20:30 is elapsed the instant it is created, and FR-RSC-06's termination argument silently stops holding.*

- **FR-RSC-01.** *(Essential, T)* When a flexible task's window has fully elapsed and it is neither complete nor declared skipped, the System shall classify it **missed** and automatically invoke the engine to place it in the next valid slot remaining that day. *(This classification is **inferred from the absence of a completion**, because the user cannot be relied upon to report a miss — the person who skipped their 8 PM run is the least likely person to open the application and say so. The inference is therefore correct as a default and **wrong in one specific case**: the user did the task and did not mark it. **FR-RSC-09 is the remedy for that case**, and the two requirements shall be read together. Applies to **flexible** tasks only: a fixed commitment is immovable by definition (FR-RSC-02), so there is nothing to re-place and no missed classification is made.)*

  > **Which candidate the automatic path takes, added v2.12 (closing OPEN-16(1)). This rule governs all three triggers.** The System places the occurrence in the engine's **rank-1 candidate** — the first element of the returned `slots`. **The service does not choose among the candidates.** FR-SCH-03 has already ranked them, and a service applying its own criterion to that list is where the second placement function FR-RSC-03 forbids would begin.
  >
  > **"Remaining that day" is expressed by what the service passes in, not by a rule the engine applies**: the `schedulableDay` handed to the engine begins at the current time, so every candidate returned already lies in the remainder of the day. *The service shapes the day; the engine ranks within it. This is the same division as `schedulableDay` itself (FR-SCH-05) — the engine is told, it does not ask.*
  >
  > *For a **missed** task the two readings of "next" coincide: the preferred window has already elapsed, so FR-SCH-03's proximity criterion makes rank 1 the earliest remaining slot — which is exactly UC-05's 21:15. **They diverge only for a skip declared in advance (FR-RSC-08) or a displacement (FR-RSC-02)**, where the preferred window is still ahead. There, rank 1 places the task as near the user's stated preference as the day allows, and a literal "earliest remaining" would instead move a 17:00 gym session skipped at 15:00 to 15:30 — sooner, and further from what the user asked for.*

  > **When the preferred window has already elapsed — added v2.14, closing E1 from packet 06's RED run.** ⚠️ **Read with the note above, which is incomplete without it.** A missed task's preferred window lies **entirely in the past** by definition, and the day handed to the engine begins at `now` — at which point **FR-SCH-09's last boundary row obliges the engine to return an empty result**: *"preferred window entirely outside the schedulable day → empty result with reason."* **Taken literally, no missed task could ever be re-placed, UC-05's 21:15 would be unreachable, and §2.7.1's *"the schedule repairs itself"* would be false for the Core's own trigger.**
  >
  > **The resolution belongs to the caller, not the engine.** Where an occurrence's preferred window has **fully elapsed**, the System invokes the engine with a **derived task whose preferred window is the remainder of the day**. **The stored task is unchanged** — tomorrow's occurrence uses the user's real window again. Where the window has only **partly** elapsed it is passed **as it stands**, and the engine handles the surviving part normally; there is no substitution.
  >
  > *Why the caller: **the engine cannot tell the two cases apart.** "The user asked for 2 AM" and "the caller narrowed the day past the user's window" arrive as the identical input. A rule that needs information only the caller holds has to live in the caller — the same argument that made `schedulableDay` a parameter rather than something the engine works out (FR-SCH-05). Changing the engine instead would re-open the 30 tests frozen at `ac06e70` to repair a defect the engine does not have.*
  >
  > **Two consequences that must not be lost.** ⚠️ Every candidate returned by a substituted call is "within the preferred window" as far as the engine can see, so **`Slot.withinPreferredWindow` says nothing about the user's stated preference on such a call** and must not be presented as though it does (FR-DSH-05). And where **`now` is at or past the end of the schedulable day** there is no remainder to ask about and no valid `Interval` to pass: the System **does not call the engine** and reports the occurrence unplaceable with reason **`DAY_FULL`**. *That is the one case in which the reason shown to the user does not originate in the engine, and it is written down here so that it stays the only one.*
- **FR-RSC-02.** *(Essential, T)* When a new fixed commitment overlaps an already-placed flexible task, the System shall automatically invoke the engine to re-place that task, and shall **not** move the commitment.

  > **What displacement does to the stored occurrence — added v2.14, closing E10.** A displaced occurrence is **moved in place**: the same `Placement` row's start and end change, its status **stays `PLANNED`**, and its `rescheduleTrigger` records **`DISPLACED`** (DR-06). **No successor placement is created, and nothing is marked missed or skipped** — because nothing happened at the old time. The day was rearranged before the fact. *This is what §3.4's sequence diagram has always shown: **"Update Gym placement → 17:45."***
  >
  > *The contrast with FR-RSC-01 and FR-RSC-08 is deliberate and is the reason the shapes differ. There, the occurrence **elapsed** or was **declared skipped** — facts about the user's day that FR-ANL must still be able to read — so the original is kept as `MISSED` or `SKIPPED` and a **successor** is created. **A displacement leaves no such fact behind**, and inventing a `DISPLACED` status to record it would be recording that nothing happened.*
- **FR-RSC-03.** *(Essential, **I**)* Automatic rescheduling shall use **the identical engine** of FR-SCH — not a second, parallel implementation. Verified by inspection: **exactly one function in the codebase produces placements**, and both the manual and automatic paths call it.
- **FR-RSC-04.** *(Essential, **D**)* When the System reschedules automatically, it shall notify the user in the schedule view, stating the task, its new time, and the trigger.
- **FR-RSC-05.** *(Essential, T)* Where a missed, **skipped**, or displaced task cannot be re-placed in the remainder of the day, the System shall say so and offer to move it to the next day. **It shall not silently discard the task.**

  > ***"Skipped" was added at v2.14 (closing E3): the requirement previously read "missed or displaced" while **FR-RSC-08, UC-10 and UC-13 all give a skipped occurrence the same offer.** A skip is a reschedule trigger like the other two — FR-RSC-08 invokes the engine "exactly as FR-RSC-01 does" — so an unplaceable skipped task was already covered everywhere except in the sentence that governs it.*

  > **How "unplaced" is represented, and what the offer produces — added v2.13 (closing OPEN-16(2)).** **Unplaced is the ABSENCE of a placement, not a stored state.** The task remains listed for the date with **no `PLANNED` placement**; where it was missed, its original placement remains `MISSED` (**UC-10**: *"the task remains visible and retrievable in an unplaced state"*). **No `UNPLACED` status is added to `PlacementStatus`** — a stored flag can drift out of step with the schedule, an absence cannot, and a `Placement` that is not placed anywhere would still have to carry a `start` and an `end` that mean nothing (§3.6, DR-03).
  >
  > The reason shown to the user is the engine's own `NoSlotReason` and explanation (FR-SCH-06), **recomputed when the schedule is retrieved rather than stored.** *The engine is pure and answers in well under 200 ms (NFR-PERF-01), so re-asking costs nothing — and it buys a property storage does not: **if the day later frees up, the next retrieval simply places the task and the offer disappears**, with nothing to clean up and no stale row claiming otherwise.*
  >
  > **The offer is acted upon, not merely displayed.** Accepting it invokes **the same engine** (FR-RSC-03) against the next day and produces an ordinary placement there; `RescheduleService.moveToNextDay` (§3.6) is that path.
  >
  > *Deliberately **not** in this release, recorded so it is not re-proposed: **discarding** the task for that day (FR-RSC-08's skip explicitly re-invokes the engine, so a discard-without-re-placement is a different obligation, and no Essential requirement asks for it), and **rearranging the current day** to make room — that is **FR-SCH-07**, Conditional, which §2.7.1 forbids starting until every Essential requirement is complete and verified.*
- **FR-RSC-06.** *(Essential, T)* Automatic rescheduling shall be **idempotent and terminating**: the same trigger processed twice shall not produce two placements, and one trigger shall not cause an unbounded chain of reschedules. Verified by firing a trigger repeatedly and asserting a stable final schedule.

  > **What makes two triggers "the same" — added v2.13, generalised at v2.14 (closing OPEN-16(3), then E10).** **A trigger is a no-op when the condition that fires it is no longer true of the stored schedule.** Idempotency is therefore a property of **the schedule itself**, never of a record of past triggers — and the three triggers reach that state by two different routes, both of which must hold:
  >
  > - **Missed and skipped** — the trigger acts only on a **`PLANNED`**, incomplete occurrence, and handling it moves that occurrence out of `PLANNED` (to `MISSED` or `SKIPPED`) while creating the successor. A second firing finds nothing to act on.
  > - **Displaced** — the occurrence **stays `PLANNED`** and is moved in place (FR-RSC-02 note), so a second firing for the same commitment finds **no overlap** and does nothing.
  >
  > This matters because FR-RSC-10 re-evaluates on **every** schedule retrieval: a user refreshing five times fires the missed check five times, and exactly one placement must result.
  >
  > *Rejected: **a stored record of processed triggers.** It is a second source of truth about what happened, and it must be kept in step with the schedule by hand — FR-RSC-09's cancellation would have to unwind it, and any divergence between the two is invisible. The state of the occurrence already carries the fact; recording it twice creates the opportunity for the two copies to disagree.*
  >
  > **Termination needs no counter and no cap.** The engine is handed a `schedulableDay` that begins at the current time (FR-RSC-01 note), so each successor starts **strictly later** than the occurrence it replaces; a strictly increasing sequence bounded by the end of the day terminates. Where it runs out of day, **FR-RSC-05** ends the chain by offering the next day. *An arbitrary "at most N reschedules" cap was rejected for the same reason: it would silently refuse a legitimate reschedule while everything continued to look correct, and it fixes a problem the design does not have.*
- **FR-RSC-07.** *(Essential, T)* A task the user has marked complete shall **never** be rescheduled.
- **FR-RSC-08.** *(Essential, T)* The System shall allow a user to declare a placed, incomplete, flexible occurrence **skipped**, and shall thereupon classify it skipped and invoke the engine exactly as FR-RSC-01 does for a missed task. **The declaration shall be accepted before the occurrence's window has elapsed**, not only after. *(This is the third reschedule trigger and the only one available in advance. It is not a substitute for FR-RSC-01: a user who forgets the task will also forget to declare it, so the automatic path must remain. It is offered only for flexible occurrences — a fixed commitment cannot be re-placed.)*
- **FR-RSC-09.** *(Essential, T)* Where an occurrence was automatically rescheduled under FR-RSC-01 and the user subsequently marks **the original occurrence** complete, the System shall **cancel the reschedule**, withdraw the later placement, free the interval it held, record the occurrence as completed, and state that it has done so. *(The classification in FR-RSC-01 is an inference from silence and can be wrong in exactly one direction — the task was done and not marked. **Without this requirement that error is permanent and uncorrectable**, and the user is left with a phantom task on their evening. This is what makes the automatic classification a proposal rather than a verdict. See FR-ANL-03: the occurrence counts as completed.)*

  > **Scope — added v2.14, closing E6.** This remedy is **for the missed classification only**, and deliberately not for the other two triggers. **A miss is inferred from silence and can be wrong without anyone having said anything; a skip and a displacement are events the user witnessed** — one they declared themselves, one they caused by adding a commitment. *The correction exists because the System guessed, not because the schedule changed.* Completing an occurrence that a skip or a displacement moved is **ordinary completion** (FR-ANL-03) and needs no withdrawal — and in the displacement case there is no earlier occurrence to withdraw at all, since the placement was moved in place (FR-RSC-02 note).
- **FR-RSC-10.** *(Essential, T)* The System shall evaluate FR-RSC-01 against every placed, incomplete, flexible occurrence whose window has elapsed **at each point a user's schedule for that date is retrieved**. A background scheduler or timer is **permitted but not required**. *(FR-RSC-01 states the condition for a miss but not what observes it. **An unstated mechanism is decided by whichever module is implemented first**, which is how a requirement acquires an accidental design. Evaluation on retrieval is sufficient because FR-RSC-04 requires the user to be told what moved and why — a reschedule nobody has been shown yet has no observable behavior to be late for. Verification: with the clock advanced past a placed occurrence's window, retrieving the schedule yields the occurrence re-placed and the reason recorded, with no background process running.)*

### §3.8.2 — FR-TSK-04, added to this packet on 22 Jul (OPEN-18)

- **FR-TSK-04.** *(Essential, T)* When a user changes a task's duration or preferred window, the System shall re-evaluate its placement and re-place it if the current placement is no longer valid.

  > **What performs this — added v2.15, closing OPEN-18.** **`RescheduleService.onTaskEdited(task, date)`** (§3.6), re-evaluating that task's occurrence on that date. Until v2.15 this requirement named **no mechanism at all**: it is Essential, and it was cited nowhere else in the SRS — no use case, no sequence diagram, no class.
  >
  > **The boundary: does the occurrence already exist?** **Re-placing an occurrence that exists** — missed, skipped, displaced, or **edited** — belongs to `RescheduleService`. **Placing a task that has no occurrence yet** — creation, and planning a day's tasks under FR-SCH-10 — belongs to the API layer (packet 12).
  >
  > ⛔ **The validity check may only REJECT, never CHOOSE.** *"Does this placement still fit the new duration, still lie inside the new window, still avoid every busy interval?"* is a predicate over an existing placement. **Where the task should go instead is the engine's, always** (FR-RSC-03). *This is the closest any requirement comes to licensing a second placement function.*
  >
  > **FR-SCH-10 does not apply** — it orders **several** flexible tasks; this re-places **one** against the existing busy set. **One call re-evaluates one occurrence**: under FR-TSK-05 a recurring task has many, and the caller invokes this once per date it has materialised.

### §3.8.4 — FR-SCH-10, and it is yours

- **FR-SCH-10.** *(Essential, T)* Where the System places **more than one flexible task** into the same schedulable day, it shall place them in **ascending order of priority** (1 first), each resulting placement becoming a busy interval for every task placed after it. Where two tasks share a priority, the **earlier-created** task shall be placed first, so that the order is total and repeatable.

  > **This is an obligation on the caller, not a behaviour of the engine.** The engine remains per-task and pure (FR-SCH-05); this requirement governs only the **order in which it is invoked**, and adds nothing to its inputs.
  >
  > **Consequence, and the reason this requirement exists:** when two flexible tasks compete for the same slot, **the higher-priority task receives it** and the lower-priority task receives its next-best alternative under FR-SCH-03. Without this rule the winner is decided by whatever order the tasks happen to come out of the database — which is not a decision anyone made, and which can differ between two runs of the same day.
  >
  > *Note what this does **not** do: a task **already placed** is not evicted by a higher-priority task created later. That is displacement, and it is **FR-SCH-07** (Conditional).*
  >
  > **What "earlier-created" reads, added v2.11 (closing OPEN-15).** The tie is broken on **`Task.createdAt`**, an ISO 8601 UTC instant recorded when the task is created. **Until v2.11 there was no such field**, so the tiebreak named a fact the System did not hold and *"total and repeatable"* could not be satisfied — the same defect shape as FR-SCH-03's criterion (b), removed in v2.7. **It is an instant, not a calendar date**, because two tasks created minutes apart on one day are the ordinary case and a date would tie them again. **Where `createdAt` is absent, or where two tasks share one instant, the order falls through to ascending `id`** — so the order is total in every case, which is what the requirement demands. *The engine does not read this field: FR-SCH-10 governs the order in which the engine is invoked, not anything inside a placement, and FR-SCH-05's purity forbids the engine **consulting** a clock, not the caller **passing** it data.*
  >
  > **Where only one of a pair has a creation instant — clarified v2.14 (closing E5).** `createdAt` is optional, so **a partly backfilled store is the ordinary state, not an edge case.** The order is: **tasks with a known instant are ordered by it; a task with no known instant sorts after every task that has one; any remaining tie breaks on ascending `id`.**
  >
  > ⚠️ *The alternative packet 06 proposed — "if either is absent, compare that pair by `id`" — **is not transitive and therefore does not define an order at all.** With **A** (10:00, id `a`), **B** (absent, id `b`) and **C** (09:00, id `c`) it gives A before B, B before C, and C before A. A sort handed that comparator returns whatever its pivot choices happen to produce, which can differ between two runs of the same day — **precisely the outcome this requirement exists to eliminate.** The rule above ranks on a single key, `(has instant, instant, id)`, which is total by construction.*

### Supporting requirements this suite must respect

- **DR-03.** *(Essential, I)* A placement shall **record why it is where it is**, so FR-DSH-05 is satisfied from stored data rather than reconstructed.
- **DR-06.** *(Essential, I)* A placement's reschedule trigger shall distinguish **missed** (inferred by the System), **skipped** (declared by the user), and **displaced** (a conflicting commitment); and a reschedule cancelled under FR-RSC-09 shall remain distinguishable from one that never occurred. *(…Without the second, FR-RSC-06's idempotency cannot be checked against stored state, and a cancelled reschedule could be re-applied by the next evaluation under FR-RSC-10.)*
- **NFR-REL-01.** *(Essential, T)* **The System shall never lose a task.** A task missed, displaced, or unplaceable shall be surfaced to the user (FR-SCH-06, FR-RSC-05) and remain retrievable. Verification: a test asserting the **count of tasks is conserved** across a sequence of conflicts and reschedules.
- **NFR-REL-02.** *(Essential, T)* Rescheduling shall be **idempotent and terminating** (FR-RSC-06). A trigger fired repeatedly shall converge on a stable schedule.

### **CRITICAL**: How To Treat The Two Non-`T` Requirements

**MANDATORY**: FR-RSC-03 is **(I)** and FR-RSC-04 is **(D)**. They are in scope for the service's *shape*, **not** for a test that pretends to verify them here.

| | What you **may** assert at service level | What you must **not** write |
|---|---|---|
| **FR-RSC-03** *(Inspection)* | That **every** placement the service produces came back from the injected `FindCandidateSlots` — a recording test double proves the service asked rather than answered. | The inspection itself. **The executable (I) guard is packet 16.** Do not write it, and do not write a test that greps the source tree. |
| **FR-RSC-04** *(Demonstration)* | That the data the notification needs — **the task, its new time, and the trigger** — is present in what the service returns and stores (`Placement.placementReason`, `Placement.rescheduleTrigger`). | Any UI or schedule-view test. **The view is packets 13–15**, and the demonstration is §6's acceptance sequence. |

### **CRITICAL**: Explicitly Out Of Scope

**MANDATORY**: **Write no test for any of these.**

- **FR-SCH-07, FR-SCH-08** — displacement. Conditional. See settled decision 4.
- **FR-DSH-05, FR-DSH-07** — the dashboard's rendering of the reason and the skip control. Frontend, packets 13–15. *You specify the **stored sentence**; you do not test how it is drawn.*
- **FR-CAL-\*, FR-TSK-\*, FR-REC-\*** — a conflicting commitment arrives at `onCommitmentAdded` as a `Task` with `flexibility: 'FIXED'`. **How it got there is not this packet.**
- **Persistence, HTTP, MongoDB, authentication** — packet 12. Your store is an in-memory test double.
- **FR-ANL-\*** — analytics. FR-ANL-03 is quoted inside FR-RSC-09 only as context for *why* cancellation records a completion.

---

## **MANDATORY**: The Contract

**CRITICAL**: You **import** every domain type from `shared/src/contract.ts` (as `@capstone/shared`, exactly as `engine/test` does): `Interval`, `Minute`, `Task`, `Slot`, `PlacementResult`, `NoSlotReason`, `FindCandidateSlots`, `Placement`, `PlacementStatus`, `RescheduleTrigger`, `IsoDate`, `IsoTimestamp`.

**CRITICAL**: You **may not redefine, extend, widen, or shadow** any type in it. `RescheduleTrigger` and `PlacementStatus` already carry the four states DR-06 requires — including `'CANCELLED'`, which exists **because a cancelled reschedule is marked, never deleted.**

**⛔ STOP**: If you believe the contract is wrong or insufficient — **do not change it, and do not work around it with a local type.** Report what you need and why. The contract is a team decision with a row in `docs/TEAM-MEETING.md`, not a refactor.

---

## **MANDATORY**: The Service Surface — From §3.6, Verbatim

```
class RescheduleService {
    -engine: SchedulingEngine
    -repo: TaskRepository
    +onTaskMissed(placement: Placement) void
    +onUserSkipped(placement: Placement) void
    +onCommitmentAdded(commitment: Task) void
    +onCompletionRecorded(placement: Placement) void
    +onTaskEdited(task: Task, date: IsoDate) void
    +sweepElapsed(userId, date) void
    +moveToNextDay(taskId, date) void
}

class TaskRepository {          <<interface>>
    +getTask(taskId) Promise~Task~
    +ownerOfTask(taskId) Promise~string~
    +tasksForDate(userId, date) Promise~Task[]~
    +placementsForDate(userId, date) Promise~Placement[]~
    +schedulableDay(userId, date) Promise~Interval~
    +savePlacement(placement) Promise~void~
    +nextPlacementId() string
}

class Clock {                   <<interface>>
    +nowMinute() Minute
    +today() IsoDate
    +nextDate(date) IsoDate
}
```

**MANDATORY — `onCommitmentAdded` takes a `date` (v2.14, closing E2).** `Task` records *when in a day* and never *which day*; without the parameter the method silently means "today" and is wrong for a commitment added for next Tuesday.

**MANDATORY — the repository is ASYNCHRONOUS. `Clock` is not.** Every storage method returns a `Promise`; `nextPlacementId` stays synchronous because identity generation is local. *Packet 12 implements this port over the promise-based MongoDB driver (CON-08), and **a port its only real implementer cannot satisfy is the wrong port** — finding that out after this suite is frozen would mean editing frozen tests. `await` in a test costs one keyword; a re-freeze costs the correctness argument.*

**MANDATORY**: These **seven** methods are the surface. **The SRS names them; you do not rename them.** *(`moveToNextDay` was added to §3.6 at v2.13 as the path that acts on FR-RSC-05's offer. It re-invokes the same engine against the next day; it is **not** a second placement path. The two ports were ratified into §3.6 at v2.14 — they had been named and left empty, which is why packet 06's first run had to draft them.)* Return types are yours to specify — `void` in a class diagram means "the diagram does not say", not "returns nothing" — and whatever you choose must let a test assert FR-RSC-04's three facts and FR-RSC-05's offer.

### **CRITICAL**: Two Structural Constraints On That Surface

**MANDATORY — 1. The engine arrives by injection, typed `FindCandidateSlots`.** The service takes it as a constructor dependency. This is what makes FR-RSC-03 checkable by a test double rather than only by inspection, and it is why `server/` may not grow its own placement code.

> **CRITICAL**: **At least one test must run the service against the REAL `findCandidateSlots` from `@capstone/engine`** — end to end, engine included. A suite that only ever sees a stubbed engine proves the service calls *something*; §6's claim is that it calls *the engine*.

**MANDATORY — 2. The service is told the time; it never asks.** `now` — and the date being retrieved — reach the service as **data** (a `Minute`, an `IsoDate`, or an injected clock port). **No `Date.now()`, no `new Date()` inside `server/src/reschedule/`.**

> This is not stylistic. **FR-RSC-10's verification is *"with the clock advanced past a placed occurrence's window … with no background process running"*** — a test cannot advance a clock the service reads for itself, and a suite that tries becomes time-of-day dependent and fails at midnight for reasons nobody will diagnose at 11pm on 30 July. It is the same reasoning that made `Minute` the engine's time type (§4.7).

---

## **MANDATORY**: What To Write

**CRITICAL**: Files under `server/test/reschedule/`. One `it()` per obligation, **every test name citing its requirement ID.**

### `triggers.test.ts` — FR-RSC-01, FR-RSC-02, FR-RSC-08

**MANDATORY**: **All three triggers, and all three reaching the same engine.** §6's verification approach requires a *"trigger suite covering all three triggers."*

- **Missed (FR-RSC-01)** — window fully elapsed, not complete, not skipped ⟹ classified missed and the engine invoked. **Flexible only**: an elapsed **FIXED** commitment is *not* classified missed and *not* re-placed.
  - **MANDATORY (v2.14, E1):** assert the engine is invoked with a **derived task whose preferred window is the remainder of the day**, and that the **stored task still carries the user's original window.** *Without the substitution the engine must reject every missed task — FR-SCH-09's last boundary row — so this assertion is the one standing between UC-05 and a Core requirement that cannot fire.*
  - **A partly elapsed window is passed as it stands** — no substitution. Assert that too; the two cases are one `if` apart and an implementation will get exactly one of them right.
  - **`now` at or past the end of the schedulable day** ⟹ the engine is **not called at all**, and the outcome is unplaceable with reason **`DAY_FULL`**.
- **Displaced (FR-RSC-02)** — a new fixed commitment overlapping a placed flexible task ⟹ the flexible task is re-placed and **the commitment does not move.** Assert both halves; the second is the one an implementation gets wrong.
  - **MANDATORY (v2.14, E10):** the displaced occurrence is **moved in place** — same `Placement` id, **status still `PLANNED`**, `rescheduleTrigger` = `'DISPLACED'`, **no successor row.** Contrast a missed occurrence, which keeps the original as `MISSED` *and* creates a successor. **⛔ If a test wants a `DISPLACED` status, it is asserting a state that does not exist.**
  - `onCommitmentAdded` takes **the commitment and the date** it falls on (E2).
- **Skipped (FR-RSC-08)** — a placed, incomplete, **flexible** occurrence declared skipped ⟹ classified skipped and the engine invoked *exactly as FR-RSC-01 does*. **MANDATORY**: assert the declaration is **accepted before the window has elapsed** — that sentence is in the requirement precisely because the obvious implementation rejects it.
- Each trigger stores its own `rescheduleTrigger` (**DR-06**): `'MISSED'`, `'DISPLACED'`, `'SKIPPED'`. **A trigger the store cannot tell apart from another is DR-06 failing.**
- **MANDATORY — all three triggers, per the v2.12 rule above:** the placement lands on the engine's **rank-1** candidate, and the **`schedulableDay` the service passes begins at `now`.** Assert **both**: the resulting placement equals `slots[0]`, and the `schedulableDay` argument the engine received starts at the current time. *The second is the one that catches a service which searched the whole day and then filtered the past out afterwards — same answer today, and the rule silently relocated from the caller into the caller's post-processing.*
- **CRITICAL**: give the engine double a result whose **rank 1 is NOT the earliest** candidate, and assert the service still takes rank 1. **A suite whose fixtures always agree cannot tell the two rules apart** — which is exactly why the SRS was silent here for so long.

### `task-edited.test.ts` — FR-TSK-04

**MANDATORY**: `onTaskEdited(task, date)`, added to this packet on 22 Jul (OPEN-18). **Four obligations:**

- **A still-valid placement is left alone** — the engine is **not called**, and the stored placement is unchanged. *The requirement says "re-place it **if** the current placement is no longer valid"; an implementation that re-places unconditionally satisfies every other assertion here and moves the user's task for no reason.*
- **An invalidated placement is re-placed through the injected engine** — assert the three ways a placement is invalidated by an edit: the new **duration no longer fits** the placed interval, the placed interval now **falls outside** the new preferred window, and *(control case)* neither, so nothing happens.
- **The new placement carries `rescheduleTrigger: 'EDITED'`** (DR-06, contract v2.15) and a `placementReason` naming the edit — a different sentence from a miss or a skip.
- ⛔ **The validity check may only reject.** Assert **no start time is ever computed outside the engine**: every re-placement traces to a `findCandidateSlots` return value, exactly as `single-engine.test.ts` requires of the other triggers.

### `single-engine.test.ts` — FR-RSC-03 *(the testable half)*

- A recording `FindCandidateSlots` double: **every placement the service produced is traceable to one of its return values.**
- The service produces **no placement in any code path where the engine was not called** — including the paths where the engine returns `placed: false`.

> **CRITICAL**: This test is the reason a second placement function would be caught here rather than in week four. **The inspection guard (packet 16) is the belt; this is the braces.**

### `completion.test.ts` — FR-RSC-07, FR-RSC-09

- **FR-RSC-07** — a task marked complete is **never** rescheduled. Assert across **every** trigger and through a `sweepElapsed`, not just one path. *"Never" is a quantifier and the test should behave like one.*
- **FR-RSC-09 is scoped to the MISSED classification only** (v2.14, E6). Write no test asking it to withdraw a placement a *skip* or a *displacement* produced — and note a displacement leaves no earlier occurrence to withdraw at all.
- **FR-RSC-09** — original marked complete after an automatic reschedule ⟹ **all five obligations**, asserted separately: the reschedule is **cancelled**, the later placement **withdrawn**, **the interval it held is freed** (assert something else can now be placed there — this is the half an implementation forgets), the occurrence is **recorded completed**, and the System **states that it has done so.**
- **MANDATORY (DR-06)**: the cancelled placement stays **distinguishable from one that never happened** — `'CANCELLED'`, not deleted — **and a subsequent `sweepElapsed` does not resurrect it.** *(DR-06 says so explicitly, and it is the exact interaction between FR-RSC-09 and FR-RSC-10 that a naive sweep gets wrong.)*

### `idempotence.test.ts` — FR-RSC-06, NFR-REL-02

- **The same trigger processed twice produces one placement, not two.** Fire it repeatedly; assert a **stable final schedule** — deep-equal state after the second, third and tenth firing.
- **MANDATORY — the rule above: a trigger is a no-op when the condition that fires it is no longer true of the schedule.** Assert **both routes** (v2.14, E10): a missed or skipped occurrence is a no-op on the second firing **because it is no longer `PLANNED`**; a displaced one is a no-op **because it no longer overlaps the commitment**, having been moved in place while staying `PLANNED`. **⛔ If a test needs a store of processed triggers to pass, it is asserting the rejected design — stop.**
- **`sweepElapsed` is the case that matters**, since FR-RSC-10 runs it on **every** retrieval: ten retrievals of the same day ⟹ **one** successor placement.
- **No unbounded chain**: one trigger does not cascade. Assert a **bounded** number of engine invocations for a single trigger, and that the schedule converges. **Assert the property termination actually rests on: each successor starts strictly later than the occurrence it replaced.** *(Do not assert a maximum number of reschedules — no such cap exists, and writing one into a frozen test would create it.)*

### `unplaceable.test.ts` — FR-RSC-05, NFR-REL-01

- Engine returns `placed: false` ⟹ the System **says so**, carrying the engine's `NoSlotReason` and explanation, **and offers to move it to the next day.**
- **MANDATORY — the v2.13 rule above.** Assert **nothing is stored** on failure: **no new `Placement` is created**, and a **missed** task's original placement is still `MISSED`. **⛔ There is no `UNPLACED` status — if you find yourself wanting one, you are writing the rejected design; stop.**
- **CRITICAL**: **`It shall not silently discard the task.`** Assert the task is still **retrievable** afterwards, and assert **NFR-REL-01's conservation directly**: the count of tasks is unchanged across a sequence of conflicts and reschedules. *There must be no input for which the service quietly drops something.* **This is the test to write most carefully** — it is the service-level twin of FR-SCH-06, and it fails silently by construction.
- **The offer is derived, not stored** — assert **both** halves: retrieving the same day again still offers it *(nothing was needed to persist it)*, and **freeing the day up makes the task place normally with no offer** *(nothing was left behind to clean up)*.
- **`moveToNextDay` places the task on the next day through the injected engine**, producing an ordinary placement. Assert it went through `findCandidateSlots` — **FR-RSC-03 applies to this path exactly as it does to the automatic ones.**
- **⛔ Write no test for discarding a task for the day, and none for rearranging the day to make room.** Both are explicitly out of scope in the requirement note above; the second is FR-SCH-07.

### `elapsed-sweep.test.ts` — FR-RSC-10

- With `now` advanced past a placed occurrence's window, **retrieving the schedule** yields the occurrence re-placed and the reason recorded — **with no background process, no timer, and no `setTimeout`.**
- Evaluation covers **every** placed, incomplete, flexible occurrence whose window has elapsed — not merely the first one found.
- A retrieval when nothing has elapsed changes nothing.

### `placement-order.test.ts` — FR-SCH-10

- Several flexible tasks into one day ⟹ engine invoked in **ascending priority order, 1 first.** Assert the **order of invocations**, not only the outcome.
- **MANDATORY**: **Each placement becomes a busy interval for the next call.** Assert the `busy` argument of call *n+1* contains the slot returned by call *n*. **This is the requirement's substance** — an implementation that sorts correctly but passes a stale busy set produces two tasks on top of each other, and every "ordering" assertion still passes.
- Contention: where two flexible tasks want the same slot, **the higher-priority task gets it** and the lower-priority one takes its next-best alternative.
- **Equal priority ⟹ earlier-created first, "so that the order is total and repeatable."** **MANDATORY**: earlier-created means an earlier **`Task.createdAt`** *(SRS v2.11)*, ranked on the single key **`(has an instant, the instant, id)`** *(v2.14, E5)*. Assert **all four** cases: both instants known; **one known and one absent — the known one first, whatever the ids say**; both absent; and identical instants. *"Total" is a claim about the mixed pair too, and that pair is where the obvious rule produces a cycle.*
- Repeatability: same inputs, same resulting schedule, including order.

### `reason.test.ts` — DR-03, FR-RSC-04 *(data only)*

- Every rescheduled `Placement` carries a **non-empty** `placementReason` **and** the correct `rescheduleTrigger`, so FR-DSH-05 is satisfiable **from stored data rather than reconstructed** (DR-03).
- The stored sentence carries FR-RSC-04's three facts: **the task, its new time, and the trigger.** *(Assert the facts are present and that a missed sentence differs from a skipped one — DR-06's "different sentences". **Do not assert an exact string**; you would be freezing prose the SRS does not specify, and packet 07 would faithfully implement your wording as a requirement.)*
- **⛔ Assert nothing about `Slot.explanation`.** Settled decision 2.

---

## **CRITICAL**: Files You May Create Or Edit

- `server/test/reschedule/**` — the suite, plus its test doubles and fixtures
- `server/src/reschedule/RescheduleService.ts` — **only** the surface declaration with `throw new Error('07')` bodies. **Nothing more.**
  - **`.eslintrc.cjs` now has `argsIgnorePattern: '^_'`** *(added 22 Jul, closing E7)*. **Prefix a deliberately-unused parameter with `_` and delete any file-level `eslint-disable`** — the workaround is no longer needed, and leaving it would hide a genuinely unused argument from packet 07.
- `docs/P06-RED-REPORT.md` — your escalations and the failing-test count *(follow `docs/P04-RED-REPORT.md`)*

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ `engine/test/**`** — **frozen by packet 04 and registered in `scripts/frozen-tests.json`.** Not one character. If you believe an FR-SCH test is wrong, **report it**.
- **⛔ `engine/src/**`** — the engine is written, merged and green. **You are its caller, not its author.** Needing to change it means you have misread this packet or found a real defect: **stop and report.**
- **⛔ `shared/src/contract.ts`** — the contract.
- `scripts/frozen-tests.json` — **read it; never edit it to make something pass.** *(Registering **your** freeze is a step for the human owner after the gate — see the last checklist item.)*
- `docs/SRS-v2.md`, `prompts/**` — a requirements change is a human decision with revision history and cross-references (`CLAUDE.md` §0).
- `server/package.json`, `web/**`, `server/src/**` outside `reschedule/` — not this packet. *(Workspace imports already resolve; `engine/test` imports `@capstone/shared` with no declared dependency.)*

> **MANDATORY**: **If you write a function that finds a free gap, merges intervals, chooses among candidate slots by anything other than the rank the engine returned, or computes a start time — you have written a second placement function**, and this packet has failed even though every file looks reasonable. **Test doubles are fine** — an in-memory store, a recording engine spy, a fixture builder. **A double that computes a placement is not a double; it is the implementation.**

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] Every requirement in scope has at least one `it()`, and **every test name cites its requirement ID** — e.g. `it('FR-RSC-09: frees the interval the withdrawn placement held', …)`. This is the traceability matrix (Appendix B); a grader reads the test output as evidence.
- [ ] **All three triggers** covered (FR-RSC-01, -02, -08), each asserting its own stored `rescheduleTrigger` (DR-06)
- [ ] **FR-RSC-09's five obligations asserted separately**, including the freed interval and the non-resurrection by a later sweep
- [ ] **At least one test exercises the REAL `findCandidateSlots`** from `@capstone/engine`
- [ ] **The rank-1 rule is asserted against a fixture where rank 1 is NOT the earliest candidate** — otherwise the test passes under both readings and proves nothing *(FR-RSC-01 note, v2.12)*
- [ ] **NFR-REL-01's conservation** asserted as a count across a sequence of conflicts and reschedules
- [ ] `grep -rn "Date.now\|new Date(\|setTimeout\|setInterval" server/` returns **nothing** — times are literals, supplied by the test *(FR-RSC-10)*
- [ ] **No test asserts on `Slot.explanation`**, and no test names FR-SCH-07, FR-SCH-08, or a dashboard requirement
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*
- [ ] **`npm run guard:tests-frozen` passes** — proving `engine/test/` is untouched since packet 04 froze it *(the guard reads `scripts/frozen-tests.json`; take the freeze reference from there, never from this prompt)*
- [ ] **CRITICAL**: **`npx jest server` FAILS, and every failure is `Error: 07`.** ← *This is the pass condition for this packet.*
  - A failure for any **other** reason means a test is broken rather than merely unimplemented — **fix it.**
  - **⛔ A test that PASSES means you wrote the service.**
- [ ] `git diff --stat server/src/` shows **one file**, containing the surface and `throw new Error('07')` bodies **and no other statement**
- [ ] `docs/P06-RED-REPORT.md` written: failing-test count, files written, and **every escalation with the requirement text it turns on**
- [ ] Post the failing-test count to the team. **That number is prompt 07's target.**
- [ ] **After the human gate — and BEFORE packet 07 writes a line — freeze the suite:**

      npm run freeze -- --packet 06 --path server/test/reschedule --tests <the count you just posted>

  **MANDATORY: a frozen suite that is not in `scripts/frozen-tests.json` is not protected**, because `npm run guard:tests-frozen` only checks what it is told about — **and CI passes either way, which is exactly why this step is the one that gets skipped.** *(NFR-MNT-08. Hash-based: no commit required, so this happens the moment the gate is held. **Do not hand-edit the manifest.**)*

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to the human owner — do not resolve it yourself — if:**

- **You need to change `shared/src/contract.ts`**, or you want a type it does not have.
- **Two requirements appear to contradict.** *(Say which and how. Finding one is a genuinely valuable outcome of this packet.)*
- **A requirement is ambiguous for a case you must test. MANDATORY: do not invent a rule and encode it in a test.** An invented rule, once it is in a frozen test, **becomes a requirement nobody agreed to — and prompt 07 will faithfully implement it.** *(Packet 04 escalated FR-SCH-03's unevaluable priority tiebreak instead of guessing, and the SRS was corrected in v2.7. That is the behaviour wanted here.)*
- Satisfying a requirement would require touching a file on the **must NOT touch** list.
- Any test would require the service to compute a placement itself *(settled decision 1)*.

### **MANDATORY**: Where The Specification Is Known To Be Thin — Report, Do Not Decide

*Four were found while authoring this packet. **The first was closed before you started; items 2–4 are still open** and are flagged so you recognise them, **not** so you resolve them. Each is a human decision with a row in the decision log.*

1. ✅ **CLOSED before this packet ran — FR-SCH-10's "earlier-created" tiebreak.** `Task` carried no creation timestamp, so the criterion could not be evaluated. **`Task.createdAt` was added to the contract (SRS v2.11, OPEN-15)**; absent or identical instants fall through to ascending `id`. **The rule is stated under FR-SCH-10 above — use it, and do not re-derive it.** *Kept here because it is the example of what the remaining three look like: a criterion with no field behind it, structurally identical to the FR-SCH-03(b) defect packet 04 escalated.*
2. ✅ **CLOSED before this packet ran — which candidate an automatic reschedule takes.** FR-RSC-01's *"next valid slot remaining that day"* versus FR-SCH-02's *"up to three ranked candidate slots."* **Answer: rank 1, for all three triggers, with `schedulableDay` narrowed to begin at `now` (SRS v2.12, OPEN-16(1)).** The rule is quoted under FR-RSC-01 above — **use it, do not re-derive it.**
3. ✅ **CLOSED before this packet ran — FR-RSC-05's *"offer to move it to the next day."*** **Answer: unplaced is the absence of a placement (no `UNPLACED` status), the reason is recomputed on retrieval, and accepting the offer re-invokes the same engine for the next day via `moveToNextDay` (SRS v2.13, OPEN-16(2)).** The rule is quoted under FR-RSC-05 above — **use it, do not re-derive it.**
4. ✅ **CLOSED before this packet ran — FR-RSC-06's *"the same trigger."*** **Answer: identity is the occurrence's STATE — a trigger acts only on a `PLANNED`, incomplete occurrence, and handling it moves the occurrence out of `PLANNED`. No trigger log; termination is proved from strictly-later successors, not capped (SRS v2.13, OPEN-16(3)).** The rule is quoted under FR-RSC-06 above — **use it, do not re-derive it.**

> **CRITICAL**: **All four were found by reading the SRS while this packet was written, and all four were answered by a human before you started** — see `docs/TEAM-MEETING.md` for the reasoning and the rejected alternatives in each case. **That is exactly what the four above are examples of, and what you are expected to do with the next one you find.** *The specification is dense and was corrected four times in one day; assume there is a fifth.*

> **MANDATORY — and this packet's first run proves the point: there were ten more.** They are recorded in `docs/P06-RED-REPORT.md` and were adjudicated into **SRS v2.14** before the freeze. **The most valuable one, E1, was that a missed task could never be re-placed at all** — the engine was obliged by FR-SCH-09 to reject a preferred window that had already elapsed, so §2.7.1's *"the schedule repairs itself"* was false for the Core's own trigger, **with all 30 engine tests green throughout.** *An agent that had guessed a workaround, or quietly widened the day, would have buried it.* **Two of the ten were decided AGAINST the run's recommendation** — E5's tiebreak comparator was not transitive, and E9's repository port had to become asynchronous — **which is what adjudication is for, and is not a mark against the escalations.**

> **MANDATORY**: An escalation is a **success**, not a failure. It is the mechanism working. **A RED packet that finishes with zero escalations and zero questions on a specification this detailed is the outcome to be suspicious of.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when `npx jest server` fails on every test with `Error: 07`, `server/src/reschedule/` contains one surface declaration with throwing bodies and nothing else, and `npm run guard:tests-frozen` still passes.**

**CRITICAL**: You are writing tests for the service that **calls** the engine. **You are not writing the service, and there is exactly one placement function in this codebase — it is already written.**

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it — an agent that silently resolves a contradiction has made a requirements decision nobody agreed to.
