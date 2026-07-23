# Packet 12 (🔴/🟢, one session) — Agent Report

**Packet:** `prompts/backend/12-backend-api.md` · **Phase:** 🔴/🟢, tests and implementation in one session · **Human owner:** Miguel Alvarez
**Run:** 22 July 2026 · **Status:** ✅ `npm run verify` green

> Packet 12 is not a RED freeze — §4.11/§7.4 of `CLAUDE.md` puts 08, 11, and 12 in the cheaper,
> one-session "tests-first, same session" phase, not the engine/reschedule-service split. There
> is no gate and no freeze commit for this packet; this report exists for the same reason
> `docs/P04-RED-REPORT.md` does — so a decision made while running it isn't lost when the
> session ends.

---

## Result

| | |
|---|---|
| **Test suites (this packet)** | 5 — `server/test/db/{UserStore,TaskRepository}.test.ts`, `server/test/api/{auth,SystemClock,app}.test.ts` |
| **Tests (this packet)** | 49 |
| **Whole-workspace `npm run verify`** | ✅ typecheck, lint, both freeze guards, **233/233 tests**, engine coverage still 100% |
| `git diff --stat -- server/src/reschedule/ engine/` | **empty** — nothing touched |
| `git diff --stat -- shared/src/contract.ts` | 2 additive changes, both pre-authorized before this packet's code was written (see below) |

### Files written

```
server/src/db/mongo.ts                  production Mongo connection (memoized)
server/src/db/UserStore.ts              FR-USR persistence
server/src/db/TaskRepository.ts         the ratified §3.6 port, over Mongo, + app-level extensions
server/src/api/SystemClock.ts           the one place that reads the real system clock
server/src/api/auth.ts                  bcrypt hashing, JWT session, requireAuth middleware
server/src/api/validation.ts            FR-TSK-01's attribute table, executable
server/src/api/app.ts                   the Express app — every route
server/src/index.ts                     production entrypoint
server/.env.example                     documents MONGODB_URI, JWT_SECRET, PORT
server/test/support/testDb.ts           mongodb-memory-server harness (OPEN-19)
server/test/support/TestableClock.ts    a Clock a test can advance by hand
server/test/support/testApp.ts          full app over the real engine + memory Mongo
server/test/db/UserStore.test.ts        8 tests
server/test/db/TaskRepository.test.ts   11 tests
server/test/api/auth.test.ts            8 tests
server/test/api/SystemClock.test.ts     3 tests
server/test/api/app.test.ts             19 tests (incl. NFR-PERF-02)
```

---

## Two contract changes, both decided BEFORE this packet's code was written

Per §4.7, neither was made unilaterally — both are recorded in `docs/TEAM-MEETING.md`'s decision
log and `docs/SRS-v2.md`'s revision history before the corresponding code exists.

1. **OPEN-12 closed (SRS v2.18)** — no field added to the contract. The user identifier is the
   Mongo `_id` of the `User` document; ownership lives at the repository boundary
   (`TaskRepository.ownerOfTask`), never on `Task`/`Placement`.
2. **`Task.recurrence` added (SRS v2.19)** — found while authoring this packet: FR-TSK-01's own
   attribute table and §5's Data Requirements table both required a `recurrence` field that
   `shared/src/contract.ts` did not have, the same defect shape as `Task.createdAt` (OPEN-15).
   Optional, so it needed no re-freeze of the 30 engine tests.

---

## One design correction made DURING implementation, not before it

The packet, as first authored, proposed excluding a fixed commitment "spanning the whole
schedulable day" from the busy set as this packet's answer to FR-CAL-05. Implementing it showed
the guard had no seam to attach to: `RescheduleService.onCommitmentAdded` and `sweepElapsed`'s
internal `askEngine` both read busy intervals straight out of `TaskRepository.placementsForDate`
— code this packet does not own and must not edit — so there was no place to special-case one
saved placement out of that read.

**Corrected to: FR-CAL-05 is satisfied vacuously under this packet's scope**, the same shape the
SRS already uses for NFR-SEC-04. `validateTaskInput` makes `preferredWindow` a required numeric
field for every task, fixed or flexible, so no code path in this packet can construct a
placement with no specific span — the failure mode FR-CAL-05 guards against cannot occur while
FR-CAL-06/SI-05 (calendar import) stay unpursued. One test proves the vacuity structurally
(`FR-CAL-05: a missing preferredWindow, or start === end, is rejected`) rather than asserting a
behavior that can't be exercised. **The packet file was corrected in place** to carry this
reasoning for the next reader, rather than leaving the superseded guard as the record.

## A second correction, found the same way: OPEN-17's placement path

The first design called `RescheduleService.sweepElapsed` from `POST /tasks` for "immediate
feedback" on a flexible task's placement. Implementing it and thinking through FR-SCH-10's own
wording surfaced a bug before it shipped: `sweepElapsed` places everything **currently unplaced**
against the busy set that exists **at that moment**. Two tasks created via separate requests,
lower priority first, would let the lower-priority one claim the good slot before the
higher-priority one exists to contend for it — and once placed, nothing re-examines it. This
silently violates FR-SCH-10 for ordinary sequential task creation, while a test that creates all
its fixtures before checking the result would never catch it.

**Corrected to: `POST /tasks` never sweeps.** A flexible task is persisted with no placement and
the response carries `placement: null`; only `GET /schedule` calls `sweepElapsed`, so everything
still unplaced for a date is swept and placed **together**, in one correctly-ordered pass — which
is what the frozen `placement-order.test.ts` suite already proves that mechanism does correctly.
Verified with a test that creates three tasks out of priority order across separate requests and
checks the final schedule, not just the order of calls.

**OPEN-17 is therefore closed without a new placement-adjacent function.** The only two things
this packet had to get right were `TaskRepository.tasksForDate` (visibility: does a never-placed
or recurring task count as a candidate for this date) and wiring `sweepElapsed` into exactly the
one retrieval point FR-RSC-10 already requires.

---

## Known limitation, not a defect: NFR-SEC-06 and packet 08

`DELETE /user/me` deletes everything this packet owns — the user record, every task, every
placement, every completion record — and makes a best-effort delete against a `wearableMetrics`
collection by name, since packet 08 (Ryan's wearable adapter) has not created that collection
yet. Full NFR-SEC-06 compliance depends on that collection existing with this same `userId`
convention; this is Conditional on packet 08 landing, not something packet 12 can close alone.

---

## ⚠️ OPEN-21 — a real defect found in ALREADY-FROZEN code, outside this packet's authority

Running a full end-to-end smoke test after `npm run verify` passed (register → create a flexible
task → `GET /schedule`, against the real `server/src/index.ts` entrypoint and a throwaway Mongo,
not just the test suite) surfaced something no test caught: a brand-new task's first-ever
placement comes back with `rescheduleTrigger: 'MISSED'`.

**Root cause is in `RescheduleService.sweepElapsed` (packets 06/07, frozen at `c30e784`)**, not in
anything this packet wrote: its reattempt branch calls `placeFresh` without `{ stamped: false }`,
so `triggerFromHistory([])` — empty history, meaning no prior placement ever existed — falls
through to a hardcoded `'MISSED'` default. This contradicts the contract's own documented
semantics (`RescheduleTrigger`'s comment: *"Absent means it has never been rescheduled"*), and
would make FR-DSH-05 (packet 13) tell a user "this was missed" about a task that was simply
placed for the first time. **Full reasoning, the exact code path, and a candidate fix (not
adopted — Patrick's call) are recorded as `docs/TEAM-MEETING.md`'s OPEN-21.**

**Why packet 12 didn't catch this in its own tests**: every route test creates a task and reads
the schedule back, but none happened to assert `rescheduleTrigger` on a first-time placement —
they checked `status`, `start`/`end`, and (for the FR-RSC-10 test) the *second* retrieval's
trigger, which is correctly `'MISSED'` there because that occurrence really was missed. Only the
manual smoke test's raw JSON output made the first-retrieval value visible. **This packet is not
touching `server/src/reschedule/` to fix it** — that file is explicitly off-limits, and a fix
there needs its own RED-style commit with Patrick's reasoning (§8.3), not a quiet patch inside
someone else's GREEN diff.

---

## Escalations

**OPEN-21 above is the one that required stopping.** Two other questions the SRS explicitly
requires be asked before writing this packet's code (OPEN-12, and the `Task.recurrence` gap found
while authoring it) were asked and answered before implementation began — see the decision-log
rows cited above. No test
was found to be wrong; no requirement contradicted another.
