# CRITICAL REQUIREMENTS — 13 Frontend Schedule Dashboard

### MANDATORY DIRECTIVE ###

You are an expert React + TypeScript engineer. **CRITICAL**: Implement **only** what is specified below, and **only** in the files listed. This packet is one reviewable diff with one human owner.

| | |
|---|---|
| **Phase** | BUILD — no frozen test suite; verified by demonstration in a browser (`CLAUDE.md` §4.11: 08, 11, 12, 13 are the cheaper one-session BUILD phase, not the RED/GREEN split). |
| **Human owner** | Miguel Alvarez |
| **Depends on** | Packet 12 (`server/src/api/app.ts`, on this same branch — see `docs/P12-REPORT.md` for the full route surface) |
| **Spec** | `docs/SRS-v2.md` §3.7.1 (wireframe), §3.8.8 (FR-DSH), §3.9.1 (UI) |

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`. Do not paraphrase.

- **FR-DSH-01.** *(Essential, D)* Display the schedule for a selected day in a calendar-style layout.
- **FR-DSH-02.** *(Essential, D)* Allow navigation to the previous and next day.
- **FR-DSH-03.** *(Essential, D)* Allow marking any occurrence complete directly from the schedule view.
- **FR-DSH-04.** *(Essential, D)* Visually distinguish fixed commitments from flexible tasks, and system-generated recommendations from user-created tasks.
- **FR-DSH-05.** *(Essential, D)* Where the System placed or moved a task, **state the reason in plain language** — e.g. *"Moved to 4:00 PM — your 2:00 PM slot was taken by CS 401 Lecture."* Verified by demonstration: **an evaluator with no knowledge of the algorithm shall be able to read why a task is where it is.**
- **FR-DSH-06.** *(Essential, D)* Where a task's preferred slot is unavailable, present the ranked alternatives from FR-SCH-02 and allow the user to accept one.
- **FR-DSH-07.** *(Essential, D)* Allow the user, directly from the schedule view, to **declare an occurrence skipped** (FR-RSC-08), and — where the System has automatically rescheduled an occurrence — to **overturn that reschedule by marking the original complete** (FR-RSC-09). The correction shall be reachable **from the reschedule notice itself** (FR-RSC-04), not from a separate screen.

- **UI-01.** *(Essential, D)* A **schedule view** displaying one day as a vertical time axis, each placed task a block whose position and height correspond to its start time and duration. *(Wireframe: §3.7.1)*
- **UI-02.** *(Essential, D)* A **task entry form** capturing every attribute of FR-TSK-01, rejecting submission if a mandatory attribute is missing and stating which.
- **UI-05.** *(Essential, D)* Every schedule-changing action shall produce a visible change **without requiring a manual page reload.**
- **UI-07.** *(Essential, D)* Tasks the System moved shall be **visually distinguished** from tasks the user placed, with the reason stated in plain language.

**Supporting, not building against directly** — FR-TSK-01's attribute table (already executable server-side in `server/src/api/validation.ts`) and FR-TSK-02 (window shorter than duration, rejected with a reason) define what UI-02's form must collect and what error text to surface when the API returns `400 { errors: ValidationError[] }`.

### **CRITICAL**: Explicitly Out Of Scope

- **UI-03/UI-04** (wellness view, analytics view) and **UI-06** (1280px+ Conditional layout requirement) — later packets (14/15), not this one.
- **FR-DSH-04's "system recommendation" (✦) styling has no data to render yet** — no packet has built the recommendation engine (FR-REC) or ever sets `Task.source === 'SYSTEM'`. Build the visual rule (per SRS §3.7.1's legend: `✦` for `source === 'SYSTEM'`) but do not expect to demonstrate it live; every task created through this packet's own form is `source: 'USER'`.
- **Editing or deleting a task** (FR-TSK-03/04, `PATCH`/`DELETE /tasks/:id`) — the routes exist server-side but no FR-DSH requirement in scope calls for an edit/delete UI. Do not build one.
- **`.ics` export (SI-06)** — a later, Conditional packet.
- **Recurrence entry in the task form** — `Task.recurrence` is optional and FR-TSK-01 lists it as non-mandatory; you may omit a recurrence control entirely rather than build UI against a feature no packet has wired end-to-end yet. *(If omitted, do not send a `recurrence` field at all — the API treats its absence as "no recurrence," which is correct.)*

---

## **MANDATORY**: The Contract

**CRITICAL**: You **import** every domain type from `shared/src/contract.ts` (via `@capstone/shared`). You **may not redefine, extend, widen, or shadow** any type in it — including `Task`, `Placement`, `PlacementStatus`, `RescheduleTrigger`, `Slot`, `Interval`, `Minute`.

**⛔ STOP**: If you believe the contract is wrong or insufficient — **do not change it.** Report what you need and why.

### The one field this packet must get exactly right

`Placement.rescheduleTrigger` and `RescheduleOutcome.trigger` (see `server/src/reschedule/RescheduleService.ts`'s return types) are **optional** (SRS v2.20, closing OPEN-21). **Absent means "this placement has never been rescheduled" — not "moved for an unknown reason."**

- Gate the ⓘ reason line and the ↻ / ✦ markers **on whether `rescheduleTrigger` is present**, not on whether `placementReason` is non-empty (every placement, including an ordinary fixed commitment, always has a `placementReason` string — see `commitmentReason`/`fitsPreferredReason` in `server/src/api/app.ts`). Rendering the ⓘ line for every task because `placementReason` always exists would put an inference-sounding sentence — *"you chose this after your preferred time was unavailable"* or worse, an invented default — under a plain "Lunch" block, which is precisely the shape of bug OPEN-21 was.
- **When `rescheduleTrigger` is absent: render no ⓘ line, no ↻ marker.** This matches §3.7.1's wireframe exactly — the "Lunch" block has neither.
- **When `rescheduleTrigger` is present** (`'MISSED' | 'SKIPPED' | 'DISPLACED' | 'EDITED'`): render the ↻ marker and the ⓘ line using `placement.placementReason` verbatim (it is already the plain-language sentence DR-03/FR-DSH-05 require — do not construct your own text from the trigger enum).
- **Do not invent a fallback reason string for the absent case.** No `"placed"`, no `"no reason recorded"`, nothing. Absence of the field means render nothing, full stop.
- A task with `source === 'SYSTEM'` gets the ✦ marker regardless of `rescheduleTrigger` (that marker means *recommended*, not *moved* — see the legend, §3.7.1: `✦ system recommendation` and `↻ automatically rescheduled` are two independent facts about the same block and can co-occur, e.g. a system-recommended workout that was later displaced).

---

## **MANDATORY**: What To Build

*State the obligation and the shape it must satisfy. Derive the implementation from the requirement and the wireframe — do not expect a finished component tree handed to you.*

### `web/src/api/client.ts` — the only place `fetch` is called (SI-04: frontend consumes the REST API exclusively)

A thin typed client over the routes packet 12 already built. At minimum:
- `register`, `login` → `POST /auth/register`, `POST /auth/login`; store the returned JWT (`localStorage` is acceptable for a 19-day capstone demo — this is not a security-hardening packet).
- `getSchedule(date)` → `GET /schedule?date=` → `{ tasks, placements, awaitingChoice }`.
- `createTask(input)` → `POST /tasks` → the three-way response shape in `docs/P12-REPORT.md`: `{ task, placement, candidates, unplaceable }` for a flexible task (`placement` set = UC-02 auto-placed; `candidates` set = UC-03, present the picker; `unplaceable` set = FR-SCH-06, show the reason), or `{ task, placement, displaced }` for a fixed commitment.
- `placeTask(taskId, choice)` → `POST /tasks/:id/place`.
- `completeTask(taskId, date)`, `skipTask(taskId, date)`, `moveToNextDay(taskId, date)` → their respective routes.
- Attach the stored JWT as `Authorization: Bearer <token>` on every authenticated call. Surface a non-2xx response as a typed error the UI can read a message out of (NFR-USE-03: no raw status code shown to the user).

### `web/src/App.tsx` + `web/src/pages/` or equivalent — app shell

- A login/register screen (thin — this packet is about the dashboard, not auth UX) and, once authenticated, the schedule view.
- Hold the selected date in state, defaulting to today.

### `web/src/components/ScheduleView.tsx` — FR-DSH-01, FR-DSH-02, UI-01, UI-05

- Per §3.7.1: a vertical time axis from the user's `wakeMinute` to `sleepMinute` (the schedulable day — fetch/hold this from the user record, or accept it as a prop from whatever holds the authenticated user), each placement drawn as a block positioned and sized proportionally to its `start`/`end` (`Minute`, i.e. minutes since local midnight — convert to a wall-clock label for display only at the render boundary, per the contract's own convention).
- **◄ / ►** controls that change the selected date and re-fetch (FR-DSH-02). Changing the date must re-render without a page reload (UI-05) — this is what a client-side re-fetch-and-re-render naturally gives you; do not add a `window.location.reload()` anywhere.
- Free space between placements rendered as `(free)`, per the wireframe — not required to be pixel-exact, but the visual language (═ fixed, ─ flexible, ✦ recommendation, ↻ rescheduled, per the §3.7.1 legend) should be present and readable.

### `web/src/components/OccurrenceBlock.tsx` — FR-DSH-03, FR-DSH-04, FR-DSH-05, FR-DSH-07, UI-07

One placement's block. Must show, per the wireframe:
- Title, time range.
- **Visual distinction** (FR-DSH-04, UI-07): a fixed commitment (`Placement` written directly at creation for a `FIXED` task — you'll need to know the task's `flexibility` to draw this, so `ScheduleView` must join `Placement` against its `Task` by `taskId`) drawn with a heavier/double border (═) vs. a flexible task's lighter one (─); `task.source === 'SYSTEM'` gets a ✦ prefix.
- **○ complete** and **⤼ skip** actions (FR-DSH-03, FR-DSH-07) — call `completeTask`/`skipTask` and re-fetch the schedule (or optimistically update, then reconcile) so the change is visible without reload (UI-05).
- **The `rescheduleTrigger`-gated ⓘ line and ↻ marker described above.** This is the packet's single most load-bearing rendering rule — re-read the contract section above before writing this component.
- The reschedule correction path (FR-DSH-07's second half, FR-RSC-09): where `rescheduleTrigger` is present, marking that occurrence **complete** is itself the "overturn the reschedule" action (`completeTask` already triggers `RescheduleService.onCompletionRecorded` server-side per FR-RSC-09 — no separate button or endpoint is needed; the ○ complete action on a ↻-marked block already reaches from the reschedule notice itself, satisfying "reachable from the reschedule notice, not a separate screen").

### `web/src/components/TaskForm.tsx` — UI-02, FR-TSK-01, FR-TSK-02

- Every mandatory FR-TSK-01 attribute: title, type, duration (minutes), priority (1–5), preferred window (start/end, converted to `Minute` at submission), flexibility, plus intensity tier when type is `WORKOUT`.
- Client-side: block submission and state which field is missing/invalid — but **do not duplicate `validateTaskInput`'s exact numeric boundaries as the source of truth**; the server is authoritative (NFR-ROB-02). Treat client-side checks as a UX nicety (required-field presence, an obvious `end <= start`) and **always** render whatever `errors: ValidationError[]` the server returns on a `400`, per field, since that is the one guaranteed to be correct.
- On submit, call `createTask`. Branch on the response:
  - `placement` present → close the form, show the task placed (UC-02).
  - `candidates` present (non-null array) → **FR-DSH-06**: render the ranked alternatives picker (see below) instead of closing.
  - `unplaceable` present → show its `explanation` in plain language (FR-SCH-06) and leave the task visible/unplaced, matching UC-03's "user declines all alternatives → the task remains unplaced and visible, not deleted" — i.e. do not require the user to do anything further; the task already exists server-side.

### `web/src/components/CandidatePicker.tsx` — FR-DSH-06, UC-03

- Given `Slot[]` (up to three, ranked — `rank`, `start`, `end`, `withinPreferredWindow`, `explanation`), render each as an option labeled with its own `explanation` (the engine's plain-language account already computed server-side — do not reconstruct one).
- On accept, call `placeTask(taskId, { date, start, end })`. Handle the `409` re-validation-failure response (`docs/P12-REPORT.md`: "the offer may be stale by the time they choose") by surfacing that the slot is no longer available rather than crashing (NFR-ROB-02/NFR-USE-03).

### Scaffold — `web/index.html`, `web/vite.config.ts`, `web/src/main.tsx`

`web/` currently has only `package.json` and `tsconfig.json` — no `src/`, no Vite entry point. You must scaffold the app (standard Vite + React + TypeScript layout) before any of the above can run. Confirm `npm run dev` (add the script to `web/package.json` if absent) serves the app and it is reachable in a browser.

---

## **CRITICAL**: Files You May Create Or Edit

- `web/**` (all of it — this is a from-scratch scaffold)
- `web/package.json` (add `dev`/`build` scripts and any dependency you need — e.g. a router, if you want one; keep additions minimal and justified)

## **CRITICAL**: Files You Must **NOT** Touch

- `shared/src/contract.ts` — the contract
- `server/**` — packet 12's territory; if the dashboard needs a route or shape that doesn't exist, **escalate, do not add it yourself**
- `engine/**`, `server/src/reschedule/**` — off-limits per `CLAUDE.md` §4.3/§8.1, and this packet has no reason to touch either

---

## **MANDATORY**: Verification Steps — Definition of Done

*Mechanical and checkable. **Not** "the code is good."*

- [ ] `npm run dev` (in `web/`, or via a root script) serves the app; register → log in → land on the schedule view, in a real browser.
- [ ] Create a **flexible** task whose preferred window is free → UC-02: it is auto-placed, no picker shown, block appears with **no** ⓘ line and **no** ↻ marker.
- [ ] Create a **flexible** task whose preferred window conflicts with an existing placement → UC-03: the ranked-alternatives picker appears; accepting one places it and the resulting block **does** show a ↻ marker and an ⓘ line reading the server's `placementReason` verbatim.
- [ ] Create a **fixed** commitment → placed immediately with the ═ heavier-border styling, **no** ⓘ line, **no** ↻ marker (its `rescheduleTrigger` is absent — it was never rescheduled, only ever placed by the user's own statement).
- [ ] ◄ / ► navigate days and re-fetch without a full page reload (check: no network waterfall reset / no visible white-flash reload).
- [ ] ○ complete and ⤼ skip both work from the schedule view and update visibly without a manual reload.
- [ ] `npm run typecheck` and `npm run lint` pass with zero errors across the whole workspace (`NFR-MNT-04`) — run the root `npm run verify` and confirm it doesn't regress the 241 tests already green on this branch.
- [ ] `git diff --stat -- server/ engine/ shared/` is **empty**.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to the human owner — do not work around it — if:**

- You need a route or response shape `server/src/api/app.ts` does not provide.
- You need to change the contract.
- A requirement is ambiguous for a case you must handle (e.g. how exactly to render a task whose `rescheduleTrigger` is present but whose `source` is also `'SYSTEM'`) — say what you chose and why, don't silently pick one.
- Satisfying a requirement here would require touching `server/**`, `engine/**`, or `shared/src/contract.ts`.

> **MANDATORY**: An escalation is a **success**, not a failure.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: The single pass condition — a user can log in, see a day's schedule rendered per §3.7.1's wireframe, add both a fixed commitment and a flexible task (including one that triggers the FR-DSH-06 picker), complete/skip an occurrence, and never see an invented ⓘ reason on a block whose `rescheduleTrigger` is absent.

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it.
