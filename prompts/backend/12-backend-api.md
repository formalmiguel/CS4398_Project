# CRITICAL REQUIREMENTS — 12 Backend API and Persistence (🔴/🟢, ONE session)

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer building the HTTP API and MongoDB persistence layer for accounts, tasks, and fixed commitments. **CRITICAL**: Implement **only** what is specified below, and **only** in the files listed. This packet is one reviewable diff with one human owner.

| | |
|---|---|
| **Phase** | 🔴/🟢 — **tests written first, implementation in the SAME session.** This is cheaper and a weaker guarantee than the engine's and the reschedule service's strict two-session split, and that is deliberate: most failures in an HTTP API are loud (a 500, a failing assertion), not silent the way a scheduling defect is. **You still write no implementation before a test exists for it.** |
| **Human owner** | **Miguel Alvarez** — Frontend & Backend Lead |
| **Depends on** | 03 (contract), 05 (engine, merged and green), 06/07 (`RescheduleService`, merged and green, 154 tests frozen at `c30e784`) |
| **Spec** | `docs/SRS-v2.md` §3.8.1 (FR-USR), §3.8.2 (FR-TSK), §3.8.3 (FR-CAL), §3.8.4 (**FR-SCH-10**, this packet's to invoke), §4.8 (NFR-SEC), §4.7 (NFR-PERF-02), §3.6 (class diagram — `TaskRepository`, `Clock`), §5 (DR-01, DR-03, DR-05, DR-06) |

---

## ⛔ **CRITICAL**: READ THIS BEFORE ANYTHING ELSE

**MANDATORY**: This packet does **not** write a second placement algorithm. Two things reach the engine from here:

1. **A single flexible task, once** — through the exact same `findCandidateSlots` from `@capstone/engine` that packets 05 and 07 already call. You invoke it directly for FR-SCH-10's day-planning path, in the order §3.8.4 requires, exactly as `RescheduleService` invokes it for its own triggers.
2. **Nothing else.** Every other placement-adjacent event — a task missed, skipped, displaced, edited, or an unplaced task's next-day offer — is **already implemented** in `server/src/reschedule/RescheduleService.ts`. This packet **calls** its seven methods. **It does not reimplement, wrap, or duplicate any of them.**

> If you find yourself writing a function that finds a free gap, merges intervals, or chooses among candidates by anything other than the rank the engine returned — **stop.** That is the second placement function FR-RSC-03 forbids, and it is exactly as forbidden here as it was in packet 06.

---

## ⛔ **CRITICAL**: THREE QUESTIONS ALREADY ASKED AND ANSWERED — DO NOT RE-ASK OR RE-DERIVE THEM

The SRS requires three separate escalations before this packet could be written at all. All three were put to the human owner (Miguel) directly, on 22 July, before this file was authored. **Use the answers. Do not treat any of them as open.**

### 1. OPEN-12 — the user identifier

The original escalation, preserved verbatim because it is the reason the question got asked rather than silently decided:

> **MANDATORY**: **`shared/src/contract.ts` carries no `userId` field, and that is deliberate.**
>
> FR-USR-04 requires every request to be scoped to its own user, and FR-ANL, FR-TSK, FR-WER and the dashboard all need to know whose data they are reading. But the SRS **deliberately does not say**:
>
> - whether a user is keyed by **email address**, an **opaque internal id**, or something else, and
> - whether ownership rides on the **domain types** (`Task`, `Placement`, `Metric`) or is applied at the **API boundary** around them.
>
> **⛔ ANY agent working on packet 12, on persistence, or on any query that filters by user MUST STOP AND ASK MIGUEL. Do not choose a scheme and propagate it.**

**✅ ANSWERED, 22 Jul, SRS v2.18:** the identifier is the **Mongo `_id` of the `User` document, stringified**, minted at account creation, carried in the JWT session. Email (unique, FR-USR-01) is used **only** to look the id up at login — it is never itself stored as an owner reference. **Ownership lives at the API/persistence boundary**: `shared/src/contract.ts` gains **no `userId` field**, and every ownership check goes through `TaskRepository.ownerOfTask(taskId)` (§3.6, already ratified) — which is a repository lookup precisely *because* ownership was never going to live on `Task`.

### 2. `Task.recurrence` — the contract gap found authoring this packet

FR-TSK-01's attribute table and DR's Data Requirements table (§5) both list `recurrence` as a Task attribute, and FR-TSK-05 (Essential, **Core**) requires expanding a recurring task into one placement per matching day. Until today's revision, `Task` in `shared/src/contract.ts` had no field to hold it — the identical shape to `Task.createdAt`'s gap (OPEN-15) and FR-SCH-03's removed criterion (b).

**✅ ANSWERED, 22 Jul, SRS v2.19:** `Task.recurrence?: Recurrence` is now in the contract, where `Recurrence = { frequency: 'DAILY' | 'WEEKLY'; daysOfWeek?: readonly number[] }` (ISO weekdays, 1=Monday…7=Sunday, required and non-empty for `'WEEKLY'`). **Optional**, so absence means "does not recur" — FR-TSK-01's own default — and no existing `Task` literal anywhere in the frozen suites needed to change. **Import it; do not redefine it.**

### 3. FR-CAL-05 — an all-day commitment is not a busy interval

**MANDATORY, read carefully — this is a design decision made while authoring this packet, revised once during implementation, with an escape hatch if it's still wrong.**

FR-CAL-05 requires an all-day event to be excluded from the busy set the engine sees. The first draft of this packet proposed a runtime guard — excluding a commitment whose interval spans the whole schedulable day from the busy set. **That guard turned out not to be implementable cleanly**: `RescheduleService.onCommitmentAdded` and `sweepElapsed`'s internal `askEngine` both read busy intervals straight out of `TaskRepository.placementsForDate` — code this packet does not own and must not edit (§ above) — so there is no seam to special-case one saved `PLANNED` placement out of that read without abusing `PlacementStatus` for a meaning it does not have.

**Stepping back, the guard was solving a problem that cannot occur under this packet's scope.** FR-CAL-01 requires manual entry to carry an explicit start **and** end time, and `validateTaskInput` (this packet's own validation) makes `preferredWindow: { start: Minute, end: Minute }` a required, numeric field for every task — fixed or flexible. **There is no code path anywhere in packet 12 that can construct a Placement with no specific span.** An all-day event, in the sense FR-CAL-05 means it, can only arise from calendar *import* — FR-CAL-06, Conditional, dependent on SI-05, which is declined and not pursued.

> **Decision: FR-CAL-05 is satisfied VACUOUSLY under this packet's scope** — the same shape the SRS itself already uses for NFR-SEC-04 ("where no live source is used… satisfied vacuously and verifiably"). Write **one** test proving the vacuity rather than a behavior that cannot be exercised: `POST /tasks` with `preferredWindow` absent, or with `start === end`, is rejected by validation (400) — proving structurally, not by convention, that nothing without a specific span ever reaches a placement.

**⛔ If you find a real path (present or near-future) that produces a spanless event, STOP and escalate — that is exactly the case this vacuous satisfaction stops covering, and it needs a real field on the contract, not a runtime guess.**

---

## **MANDATORY**: Requirements In Scope — Verbatim From `docs/SRS-v2.md`

> Quoted **VERBATIM**. Do not paraphrase.

### §3.8.1 — Account and Session Management (FR-USR)

- **FR-USR-01.** *(Essential, T)* The System shall allow a person to create an account with a unique email address and a password.
- **FR-USR-02.** *(Essential, T)* The System shall authenticate a user by email and password and establish a session.
- **FR-USR-03.** *(Essential, T)* The System shall store passwords **only as salted cryptographic hashes**. Verified by inspecting the stored record: the plaintext shall not be recoverable.
- **FR-USR-04.** *(Essential, T)* The System shall deny any request for a user's tasks, metrics, recommendations, or history unless the request carries a valid session **for that same user**. A request authenticated as user A for user B's data shall be rejected.
- **FR-USR-07.** *(Essential, T)* The System shall allow a user to define their **schedulable day** (wake and sleep times) and shall never place a task outside those bounds.

**Explicitly out of scope**: FR-USR-05, FR-USR-06 *(Conditional — live wearable OAuth; no live source exists)*.

### §3.8.2 — Task, Habit, and Goal Management (FR-TSK)

- **FR-TSK-01.** *(Essential, T)* The System shall allow a user to create a task with these attributes:

  | Attribute | Type | Mandatory | Constraint |
  |---|---|---|---|
  | Title | text | yes | 1–100 characters |
  | Type | enum | yes | Habit, Goal, Class, Meeting, Workout, Meal, Other |
  | Duration | integer minutes | yes | 5 ≤ duration ≤ 480 |
  | Priority | integer | yes | 1 (highest) – 5 (lowest) |
  | Preferred time window | start/end time | yes | end > start; window length ≥ duration |
  | Flexibility | enum | yes | FIXED or FLEXIBLE |
  | Recurrence | enum + days | no | none, daily, or specific weekdays |
  | Intensity tier | enum | workouts only | LOW, MODERATE, HIGH |

- **FR-TSK-02.** *(Essential, T)* The System shall **reject** a task whose preferred window is shorter than its duration, stating that reason.
- **FR-TSK-03.** *(Essential, T)* The System shall allow a user to read, update, and delete any task they created.
- **FR-TSK-04.** *(Essential, T)* When a user changes a task's duration or preferred window, the System shall re-evaluate its placement and re-place it if the current placement is no longer valid.

  > **This packet's obligation is narrow: your `PATCH /tasks/:id` handler calls `RescheduleService.onTaskEdited(task, date)` for every date on/after today that has a `PLANNED` placement for this task.** You implement **no** validity check and **no** placement logic — both already exist in `onTaskEdited`. *Past occurrences (already `MISSED`, `SKIPPED`, `COMPLETED`, or `CANCELLED`) are untouched — nothing happened at those dates, and editing a task today does not retroactively change what already occurred.*
- **FR-TSK-05.** *(Essential, T)* The System shall expand a recurring task into one placement per matching day, each **independently completable and independently reschedulable**.
- **FR-TSK-06.** *(Essential, T)* The System shall allow a user to mark an occurrence complete, recording the timestamp.
- **FR-TSK-07.** *(Essential, T)* Deleting a recurring task shall delete its **future** occurrences and **preserve its historical completion records**, so analytics over past behavior remain correct.

### §3.8.3 — Fixed Commitments and Calendar Data (FR-CAL)

> **A fixed commitment IS a `Task` with `flexibility: 'FIXED'`** (§1.4.2's glossary). There is no separate `Commitment` type or collection — the ERD's `TASK` entity covers both. `POST /tasks` handles creation for **both** flexibilities; they diverge inside the handler at the point described in "What To Build" below.

- **FR-CAL-01.** *(Essential, T)* The System shall accept fixed commitments, each with a title, date, start time, and end time.
- **FR-CAL-02.** *(Essential, T)* The engine shall treat every fixed commitment as a **hard constraint**: no placement shall overlap one by even one minute.
- **FR-CAL-03.** *(Essential, T)* The System shall **never** move, alter, or delete a fixed commitment to resolve a conflict. A fixed commitment is immovable by definition; only flexible tasks move.
- **FR-CAL-05.** *(Essential, T)* An **all-day event shall not be treated as a busy interval.** *(See "Question 3" above for how this packet satisfies it under manual-entry-only scope.)*

**Explicitly out of scope**: FR-CAL-04, FR-CAL-06, FR-CAL-07 *(all Conditional, all depend on an external calendar source — SI-05 declined, SI-06 not this packet)*.

### §3.8.4 — FR-SCH-10, and it is yours — but see the note below before writing any placement code

- **FR-SCH-10.** *(Essential, T)* Where the System places **more than one flexible task** into the same schedulable day, it shall place them in **ascending order of priority** (1 first), each resulting placement becoming a busy interval for every task placed after it. Where two tasks share a priority, the **earlier-created** task shall be placed first, so that the order is total and repeatable.

  > ⚠️ **MANDATORY — read `RescheduleService.sweepElapsed` before writing a day-planning function of your own.** It already contains a "reattempt" branch (`plannedRows.length === 0`): any flexible task returned by `tasksForDate` with **no `PLANNED` placement at all** — which includes a task that has **never** been placed, not only one that lost its placement — is collected, **sorted with `byPlacementOrder`**, and placed one at a time through `placeFresh`, whose `askEngine` **re-reads `placementsForDate` on every call**. Because each `savePlacement` is awaited before the loop's next iteration, the busy set each subsequent call sees already contains everything placed earlier in the same sweep. **This is FR-SCH-10, already implemented, already exercised by the 154 frozen tests in `placement-order.test.ts` and `unplaceable.test.ts`.**
  >
  > **OPEN-17 is therefore closed by wiring, not by new placement code.** Your obligation is narrower than "invoke `findCandidateSlots` in priority order" — it is: **(1)** make `TaskRepository.tasksForDate(userId, date)` correctly return a brand-new, never-placed flexible task as a candidate for its intended date (see `intendedDate` in "What To Build" below — a repository-internal field, not part of the shared `Task` type, since the contract has no per-task date), and correctly expand a `recurrence`-bearing task into a candidate for every date it matches; **(2)** call `sweepElapsed` after creating a flexible task, so its creator sees it placed immediately, instead of only at the next `GET /schedule`. **Do not write a second function that calls `findCandidateSlots` directly.** If `tasksForDate` and `sweepElapsed` together cannot produce a correct initial placement for some case, that is a real gap in `RescheduleService` — escalate it; do not route around it with parallel placement code here.

### Supporting requirements

- **DR-01.** *(Essential, I)* Completion history shall be retained even when the task that generated it is deleted.
- **DR-03.** *(Essential, I)* A placement shall **record why it is where it is.** *(A flexible task's first placement is written by `sweepElapsed`/`placeFresh`, already carrying a non-empty `placementReason` via `reattemptReason`. **This packet's own obligation is narrower**: the one placement it writes directly — a fixed commitment's — needs its own reason sentence. Reuse `clockLabel` from `../reschedule/reasons` for the wall-clock formatting; do not reimplement it.)*
- **DR-05.** *(Essential, I)* *(§3.5's note.)* One document per metric per date — **not this packet's collections**, cited only because your Mongo schema choices for `tasks`/`placements`/`users` should not repeat the mistake in miniature: **one document per task, one per placement, one per user — no single "everything" document.**
- **DR-06.** *(Essential, I)* A placement's reschedule trigger shall distinguish missed, skipped, and displaced… *(Already satisfied by the frozen contract's `RescheduleTrigger`. Your obligation: a placement **you** create directly has **no** `rescheduleTrigger` — that field is absent until `RescheduleService` moves it. Do not invent a trigger value for an initial placement.)*

### §4.8 — Security (NFR-SEC)

- **NFR-SEC-01.** *(Essential, T)* All application data in transit shall be **encrypted** (CI-01). *(Document, do not implement, a TLS certificate. This is a local demo server; note in `server/README.md` or an equivalent that TLS termination is a deployment-time concern, satisfied in production by a reverse proxy — do not hand-roll a self-signed cert into a 9-day project.)*
- **NFR-SEC-02.** *(Essential, I)* Passwords shall be stored **only as salted hashes** (FR-USR-03). *(`bcrypt`, already pinned.)*
- **NFR-SEC-03.** *(Essential, T)* **A user shall be able to access only their own data** (FR-USR-04). Verification: an automated test attempting **cross-user access on every data-bearing endpoint** and asserting rejection.
- **NFR-SEC-04.** *(Essential, I)* Any credential granting access to a wearable account shall be encrypted at rest… *(No live source exists. Satisfied **vacuously**, the same way the SRS itself already treats it — hold no such credential, write no such code.)*
- **NFR-SEC-05.** *(Essential, T)* The System shall be free of **injection vulnerabilities**. Verification: inspection confirming all queries are parameterized, plus a test submitting injection payloads to every text input and asserting they are stored and returned as **literal text**.

  > **MongoDB-specific reading, not just SQL's**: the injection risk here is **query-operator injection**, not string concatenation — a client sending `{ "email": { "$gt": "" } }` as a JSON body field can turn an equality lookup into a filter that matches everything, because the Mongo driver accepts a plain object as a query value. **Every field used to build a query filter (`email`, any id, any string used in a `$eq`) must be validated as a `string` before it reaches a filter object** — reject with 400 otherwise. Write a test that POSTs an object where a string is expected and asserts the request is rejected, not silently coerced.
- **NFR-SEC-06.** *(Essential, D)* A user shall be able to **delete their account and all associated health data.**

  > **This packet's obligation is bounded to what it owns**: deleting the `User` document, every `Task` and `Placement` and completion record for that user. **Wearable metrics live in a collection packet 08 has not created yet.** Attempt a best-effort delete by convention (a `wearableMetrics` collection filtered by the same user id) inside a helper clearly marked as the extension point, but **do not block this packet on packet 08's schema** — note in the verification report that full NFR-SEC-06 compliance is Conditional on packet 08 landing, and this is not a defect in this packet.

### §4.7 — Performance (NFR-PERF)

- **NFR-PERF-02.** *(Essential, A)* Any API request not calling an external source shall complete in **under 500 ms** at the 95th percentile under 10 concurrent users. *(Analytic requirement — write one lightweight timing test that fires 10 concurrent requests at a representative endpoint and asserts p95 latency; do not build a load-testing rig for this.)*

### §3.8.5 — the one FR-RSC requirement this packet triggers

- **FR-RSC-10.** *(Essential, T)* The System shall evaluate FR-RSC-01 against every placed, incomplete, flexible occurrence whose window has elapsed **at each point a user's schedule for that date is retrieved.**

  > **Your `GET /schedule` handler calls `RescheduleService.sweepElapsed(userId, date)` before reading placements back.** You do not implement the sweep — packet 07 already did. You are the retrieval point FR-RSC-10 requires one of.

**Explicitly out of scope, write no code or test for**: FR-SCH-07/08 (displacement, Conditional), FR-REC-\* (recommendations — packets 09/10; this packet's task-creation endpoint always sets `source: 'USER'`), FR-DSH-\*/FR-WEL-\*/FR-ANL-\* (frontend and analytics — packets 13–15), FR-LIB-\* (packet 11), FR-RSC-01/02/04/05/06/07/08/09 (already implemented in `RescheduleService`; you call, never reimplement), FR-CAL-04/06/07.

---

## **MANDATORY**: The Contract

Import every domain type from `shared/src/contract.ts` as `@capstone/shared`. **You may not redefine, extend, widen, or shadow** any type in it, including the two added today: `Recurrence`, `RecurrenceFrequency`.

**⛔ STOP**: If you believe the contract is wrong or insufficient beyond what today's two changes already cover — **do not change it.** Report what you need and why.

### The two ports you implement — from `server/src/reschedule/RescheduleService.ts`, verbatim, already ratified into §3.6

```ts
export interface Clock {
  nowMinute(): Minute;
  today(): IsoDate;
  nextDate(date: IsoDate): IsoDate;
}

export interface TaskRepository {
  getTask(taskId: string): Promise<Task | undefined>;
  ownerOfTask(taskId: string): Promise<string | undefined>;
  tasksForDate(userId: string, date: IsoDate): Promise<readonly Task[]>;
  placementsForDate(userId: string, date: IsoDate): Promise<readonly Placement[]>;
  schedulableDay(userId: string, date: IsoDate): Promise<Interval>;
  savePlacement(placement: Placement): Promise<void>;
  deletePlacement(placementId: string): Promise<void>;
  nextPlacementId(): string;
}
```

**Import these two interfaces from `../reschedule/RescheduleService` — do not redeclare them.** A second copy of either type, even a structurally identical one, is a second source of truth the compiler cannot catch drifting.

**MANDATORY — `deletePlacement` has exactly one legitimate caller in the whole codebase**, inside `RescheduleService`'s own displacement/edit failure path. **If your code calls it, that is a second caller and it is an escalation, not a convenience** — this domain marks rows (`MISSED`, `SKIPPED`, `CANCELLED`); it does not delete them, with that one documented exception.

---

## **MANDATORY**: What To Build

### `server/src/db/mongo.ts` — connection

- A single `MongoClient` connection, URI from `process.env.MONGODB_URI` (loaded via `dotenv`, `.env` — never committed). Export a function returning the connected `Db`, memoized so the app and the test suite each open one connection.

### `server/src/db/TaskRepository.ts` — FR-TSK, FR-CAL, DR-01, DR-05

- A class implementing `TaskRepository` over three collections: `tasks`, `placements`, `completionRecords`. **One document per task, one per placement, one per completion record** (DR-05's principle, restated for this schema).
- `nextPlacementId()` — synchronous, local (e.g. a UUID or an incrementing local counter seeded at construction) — **not a query.** The port is synchronous for exactly this reason (§3.6's note); if your implementation needs to `await` here, you have implemented the wrong port.
- Every method's filter values (`taskId`, `userId`, `date`) validated as plain strings before reaching a Mongo filter — NFR-SEC-05.
- **`tasksForDate(userId, date)` — the method OPEN-17 actually turns on.** A task document carries an `intendedDate` (Mongo-only, not on the shared `Task` type — see the FR-SCH-10 note above). Return every task where: **(a)** `recurrence` is absent and `intendedDate === date`, or **(b)** `recurrence.frequency === 'DAILY'` and `intendedDate <= date`, or **(c)** `recurrence.frequency === 'WEEKLY'` and `intendedDate <= date` and `date`'s ISO weekday is in `recurrence.daysOfWeek`. *(FR-TSK-05's "one placement per matching day" — this is the "matching" test.)* This governs whether `sweepElapsed` ever sees the task as a candidate at all; get it wrong and a task silently never places, or silently over-places on days nobody asked for.

### `server/src/db/UserStore.ts` — FR-USR

- Create (email + bcrypt hash + wake/sleep `Minute` + Mongo-minted `_id`), find by email (login), find by id, update schedulable day, delete cascade (NFR-SEC-06, scoped as described above).
- **`schedulableDay(userId, date): Promise<Interval>`** on `TaskRepository` reads the user's wake/sleep times from here — cross the two stores however is cleanest (constructor injection is fine); do not duplicate the user's wake/sleep fields into the `tasks` or `placements` collections.

### `server/src/api/SystemClock.ts` — implements `Clock`

- The **one legitimate place in this codebase that reads the real system clock** for scheduling purposes. `nowMinute()` reads the real local time as `Minute`; `today()`/`nextDate()` are calendar arithmetic on `IsoDate`. **This file is not under `server/src/reschedule/`, and nothing under `server/src/reschedule/` may read a clock — that prohibition is unchanged and this file is the reason it can stay absolute.**

### FR-SCH-10 / OPEN-17 — no new placement file

**Per the note above, this packet writes no code that calls `findCandidateSlots` for a flexible task.** `TaskRepository.tasksForDate` (see below) makes a never-placed and a recurring task visible as candidates; `RescheduleService.sweepElapsed` — called ONLY from `GET /schedule` (FR-RSC-10's own requirement) — does the placing, in FR-SCH-10's order, through the same `askEngine`/`placeFresh` machinery every other trigger uses. `placeFresh` already writes `placementReason` via `reattemptReason` (`server/src/reschedule/reasons.ts`) and leaves `rescheduleTrigger` absent for a first placement, satisfying DR-03 and DR-06 with no new code here.

**⛔ MANDATORY — do NOT call `sweepElapsed` from `POST /tasks`, even for "immediate feedback."** It is tempting and it is wrong: `sweepElapsed` sweeps and places everything **currently unplaced**, so calling it once per creation places each flexible task against only what exists **at that moment**. Two tasks created via separate requests, lower-priority first, means the lower-priority one claims the good slot **before the higher-priority one exists to contend for it** — and once placed, it is not re-examined by a later sweep. **This silently violates FR-SCH-10** for exactly the sequential-creation case a real user produces, while every test that creates all its tasks and only then checks the result would still pass. `POST /tasks` for a flexible task returns `placement: null`, always; the client calls `GET /schedule` next, which it must do anyway per FR-RSC-10, and that single sweep places everything still unplaced for the date **together**, in the correct order.

**`TaskDocument`'s `intendedDate` field (Mongo-only, not on the shared `Task` type)** is what makes this possible: `Task` carries no date, so a one-off task needs *something* to anchor it to the date its creator intended, and a recurring task needs an anchor for "starting from." `tasksForDate(userId, date)` reads it to decide inclusion — see below.

### `server/src/api/routes/*.ts` — the HTTP surface

- **Auth**: `POST /auth/register` (FR-USR-01), `POST /auth/login` (FR-USR-02, returns a JWT with `sub` = the Mongo-id user identifier), a `requireAuth` middleware attaching `req.userId` from the verified token and rejecting an absent/invalid one (FR-USR-04's mechanism).
- **User**: `PATCH /user/schedulable-day` (FR-USR-07), `DELETE /user/me` (NFR-SEC-06).
- **Tasks**: `POST /tasks` (FR-TSK-01/02 — validates the table above, requires an `intendedDate` the task is for; a `FIXED` task is saved with its given start/end directly as its `Placement` and then calls `RescheduleService.onCommitmentAdded(commitment, date)`; a `FLEXIBLE` task is persisted with **no placement and no sweep** — see the ⛔ note above — and the response carries `placement: null`), `GET /tasks/:id`, `GET /tasks?date=` (FR-TSK-03), `PATCH /tasks/:id` (FR-TSK-03 general edit; when `durationMinutes` or `preferredWindow` changes, calls `onTaskEdited` per FR-TSK-04's note above), `DELETE /tasks/:id` (FR-TSK-03; FR-TSK-07's future-only-deletion, preserving completion records).
- **Occurrences**: `POST /tasks/:id/complete` (FR-TSK-06 → calls `onCompletionRecorded`), `POST /tasks/:id/skip` (FR-RSC-08 → calls `onUserSkipped`), `POST /tasks/:id/move-to-next-day` (FR-RSC-05's offer → calls `moveToNextDay`).
- **Schedule**: `GET /schedule?date=` — calls `sweepElapsed(userId, date)` (FR-RSC-10) **before** reading `tasksForDate`/`placementsForDate` back for the response.
- Every handler beyond `/auth/*` runs behind `requireAuth`; every handler touching a specific task calls `ownerOfTask` and rejects (404, not 403 — do not reveal existence of another user's task) a mismatch (NFR-SEC-03).

---

## **CRITICAL**: Files You May Create Or Edit

- `server/src/db/**`
- `server/src/api/**`
- `server/src/index.ts` — the Express app entrypoint (middleware, route mounting)
- `server/test/**`
- `server/.env.example` — documents `MONGODB_URI`, `JWT_SECRET`; **never `server/.env` itself**
- `docs/P12-REPORT.md` — your escalations, if any, and a summary (follow `docs/P04-RED-REPORT.md`'s shape)

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ `server/src/reschedule/**`** — merged, green, 154 tests frozen at `c30e784`. You **import and call** `RescheduleService` and `clockLabel`. You do not edit any file in this tree, including to add a convenience export — if you need one, escalate.
- **⛔ `engine/src/**`, `engine/test/**`** — frozen at `ac06e70`.
- **⛔ `shared/src/contract.ts`** — already amended twice today for this packet's needs (OPEN-12's resolution required no contract change; `recurrence` did). Any further need is a fresh escalation.
- `web/**` — not this packet.
- `scripts/frozen-tests.json` — read-only.

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] Every requirement in scope has at least one `it()`, and **every test name cites its requirement ID.**
- [ ] **NFR-SEC-03**: a cross-user access test on **every** data-bearing endpoint (`GET`/`PATCH`/`DELETE /tasks/:id`, `POST /tasks/:id/complete`, `/skip`, `/move-to-next-day`, `GET /schedule`) — user A's valid token against user B's resource is rejected.
- [ ] **NFR-SEC-05**: an object-shaped injection payload (`{"$gt": ""}`) submitted where a string is expected is rejected with 400, not coerced into a query.
- [ ] **FR-SCH-10 / OPEN-17**: an integration test creates three-plus flexible tasks for one date with distinct priorities (out of priority order), retrieves the schedule, and asserts they landed in **ascending-priority order** with no two overlapping — proving the wiring into `sweepElapsed`, not re-proving `placement-order.test.ts`'s own frozen assertions. A repository-level test confirms `tasksForDate` includes a never-placed task and correctly expands a `WEEKLY` recurring task only on its matching weekdays.
- [ ] **FR-CAL-05**: a task/commitment submitted with `preferredWindow` absent or with `start === end` is rejected by validation (400) — proving no spanless placement can be constructed under this packet's scope.
- [ ] **FR-TSK-07**: deleting a recurring task removes future placements but a prior completion record for it is still readable afterward.
- [ ] **FR-RSC-10**: `GET /schedule` with the clock advanced past a placed occurrence's window returns it re-placed, with no timer or background process involved — reuse the same clock-injection pattern `elapsed-sweep.test.ts` established.
- [ ] `server/test/db/TaskRepository.test.ts` and `UserStore.test.ts` run against `mongodb-memory-server` (OPEN-19) — no real `mongod` required to run `npm test`.
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors.
- [ ] **`npm run guard:tests-frozen` passes** — proving `engine/test/` and `server/test/reschedule/` are untouched.
- [ ] `git diff --stat server/src/reschedule/ engine/` is **empty**.
- [ ] `npm run test:coverage` — this packet is not held to NFR-MNT-01's 90% (that is the engine's), but do not let coverage regress below what `dev` already carries.
- [ ] `docs/P12-REPORT.md` written: what was built, every escalation (there should be at least the three pre-answered ones, recorded as such, plus any new ones), and the NFR-SEC-06/packet-08 caveat restated.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to the human owner — do not resolve it yourself — if:**

- You need to change `shared/src/contract.ts` again.
- FR-CAL-05's whole-day-interval rule (Question 3 above) doesn't cover a real case you hit.
- A second caller for `deletePlacement` seems to be needed.
- Satisfying a requirement would require editing `server/src/reschedule/**` or `engine/**`.
- Any requirement is ambiguous for a case you must handle. **Do not invent a rule and encode it.**

> **An escalation is a success, not a failure.** This packet already contains three examples of exactly that mechanism working before a single line of code was written.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: This packet passes when the account, task, commitment, and schedule-retrieval HTTP surface is green against `mongodb-memory-server`, `npm run verify` passes in full, and `git diff --stat` touches nothing under `server/src/reschedule/`, `engine/`, or `shared/src/contract.ts` beyond what is already committed.

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it.
