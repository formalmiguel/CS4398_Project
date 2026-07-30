# Project Context — Adaptive Habit, Schedule & Wellness System

> **Read this first.** It exists so a new AI session — or a new teammate — can get up to speed without re-deriving decisions that are already made. If you are an AI assistant, this file is loaded automatically; **read the "Decisions Already Made" section before proposing anything**, because several obvious-seeming suggestions have already been considered and rejected for reasons that still hold.

**Last updated:** 30 July 2026 *(✅ **The ad hoc frontend-follow-up work on `wp-frontend-jul29-followups`, requested directly by the module's own owner, is complete and MERGED TO `dev`** (`c12c334`, pushed) — the project's "queue empty, nothing tracked" status from 28 Jul is otherwise unchanged. Six commits, landed as five logically separate ones (see §8.4/§8.5): **reschedule unified** for FIXED and FLEXIBLE tasks (one `POST /tasks/:id/reschedule`, a **"Rescheduled"** history panel); **undo-completion** back to `MISSED` (the one deliberate exception to FR-RSC-07's "never"); **FIXED/FIXED conflict rejection** (409, closing a gap FR-CAL-03 always implied); the wellness "Last 7 days" panel **removed**, leaving **FR-WEL-04 unsatisfied** (flagged, SRS v2.38/OPEN-37, not silently dropped); an elapsed **FIXED** commitment now **classified `MISSED`** in place, where it previously sat `PLANNED` forever (SRS v2.39); a real bug fixed where a reschedule could **land back on its own just-vacated slot** (SRS v2.40); an opt-in, NOT-adopted `ELAPSED_CLASSIFICATION=COMPLETED` env var recorded as a future-release candidate (**OPEN-38**); and a new **wellness click-to-schedule** path (`WorkoutSelectionStore`, explicitly not an SRS requirement), plus a **ScheduleView panel split/legend** cleanup. `npm run verify` **507 green**, checked before AND after the merge, on `dev` itself. Full account: §9 below; `docs/TEAM-MEETING.md` decision log, 30 Jul; `docs/SRS-v2.md` v2.38–v2.40.)*

**Previous update:** 29 July 2026 *(✅ **OPEN-35 FOUND AND FIXED THE SAME DAY — a retrieved PAST date's schedule no longer re-classifies its own occurrences as freshly missed forever.** Found by directly querying the Atlas database behind `practice@test.com`'s account: `2026-07-24` (a date that had already closed) had **8–10 duplicate `MISSED` placement rows** for the same three tasks, every one re-landing in the exact same time slot. **Root cause:** `RescheduleService.onTaskMissed`/`sweepElapsed` (`server/src/reschedule/RescheduleService.ts`) decided "has this occurrence elapsed" by comparing `clock.nowMinute()` to the placement's minute-of-day only — never checking the placement's `date` against `clock.today()`. **Fixed**: a new private `hasElapsed(date, endMinute)` makes a date strictly before today unconditionally elapsed and a date strictly after today never elapsed, with the minute comparison surviving only for `date === today`; `remainderOfDay` now returns no remainder at all for a closed date instead of handing back the full day (which is what let the re-placed successor land right back in the same slot); a new `dayAlreadyPassedExplanation` gives that outcome its own honestly-worded reason. **Pinned by two new tests** in a new, unfrozen directory (`server/test/reschedule-past-date/`, using the frozen suite's own harness/real engine), both watched to FAIL against the pre-fix source first. `npm run verify` **500 green** (498 + 2), all **8** freeze entries verified unchanged, engine 100%, all four (I) guards green. ⚠️ **On branch `wp-open35-tracking` (off `dev`) — NOT committed.** ⚠️ **Residual, not addressed by this fix**: the ~30 duplicate rows already sitting in the real Atlas database for that account/date are untouched — the fix stops further growth, it does not retroactively clean up what already accumulated; that's a data operation left for the owner to authorize. Full account: `docs/TEAM-MEETING.md`, OPEN-35 (Open Issues + decision log, 29 Jul).)*

**Earlier update:** 28 July 2026 *(✅ **READ THIS FIRST — every owner's queue is now empty, and the System demonstrates its own central claim end to end.** **Packet 17d is GREEN**: the recommendation path is wired into the running application, **OPEN-30 and OPEN-28 are closed**, and **SRS §6 was performed against a live server** — sleep score 40 injected → calorie target 2,000 → **2,850**, the scheduled HIGH run **`SUPERSEDED`**, a SYSTEM/LOW recovery session **`PLANNED` at 17:00**, identical across two retrievals, and a `FIXED` commitment dropped on it **displaced and re-placed by the same engine at 17:30** — which is **FR-REC-04's "defended identically to a user task" clause shown rather than asserted.** New: `server/src/recommendation/WorkoutSource.ts` (the narrow port renamed, plus an adapter over packet 11's real catalog), a **per-user `RecommendationScheduler` factory** in `index.ts` (per-user because `CaloriesToTargetRule` takes *that user's* baseline — FR-REC-09/CON-05; a boot-time singleton would bake one user's baseline into everyone's, and **no test would catch it because every test uses one user**), and one route, **`POST /recommendations/apply-workout`**. `npm run verify` **498 green** *(483 at 17d; +15 from the 28 Jul metric-validation fix below)*, all **8** freeze entries intact, engine **100%**, all four (I) guards green, contract untouched. ⚠️ **On branch `wp-17d-wire-recommendation` (off `dev`) — NOT committed, NOT merged** (§8.5: the commit is the owner's assertion that they read the diff). Report: `docs/P17D-REPORT.md`. **Two things carried forward, both recorded rather than hidden:** **(1)** FR-LIB-08's `relaxed`/`satisfiable` cannot cross the narrow port, so the adapter **logs** them — `GET /wellness` already surfaces both for meals and `satisfiable` for workouts, and that file is Ryan's and was not touched; closing it properly means widening a frozen port, which is a post-freeze decision. **(2)** `server/test/support/testApp.ts` was edited although the packet did not list it — adding a required `AppDependencies` field forces it (one of only two `buildApp` call sites, and unfrozen); *rejected: making the dependency optional*, which would let the app boot with the FR-REC-04 path silently absent, the exact failure 17d existed to end.*
>
> ✅ **THE PACKET WORK IS COMPLETE. THERE IS NO OUTSTANDING WORK ITEM, AND NOTHING IS BEING TRACKED.** Packet 17d is committed (`bb82f18`), merged (`ba35195`) and pushed; `dev` and `origin/dev` are at parity and the working tree is clean. Every Conditional was definitively cut on 26 Jul (§6); OPEN-05 and OPEN-06 close unattempted, "having lost nothing"; the two Conditionals already shipped (FR-CAL-07, FR-DSH-08) stay. **⛔ Three things were deliberately DROPPED FROM TRACKING on 28 Jul, by the owner's decision — do not re-raise them as open work, and do not re-add them to a queue, an issue table or an action list:** **(1)** promoting `main` *(it remains behind `dev`; the §8.5 policy still describes how it would be done if anyone chooses to, but it is **not a tracked item and its trigger conditions being met is not a prompt to act**)*; **(2)** demo rehearsals; **(3)** **OPEN-10**, the three questions for the professor. ⚠️ **This note exists precisely so the next session does not "helpfully" rediscover them** — a default branch sitting behind an active one is exactly the kind of thing an assistant flags on sight, and it has already been considered and set aside.
>
> ✅ **Everything below this line is DONE and merged to `dev`.** **Patrick:** 04/05 (engine), 06/07 (reschedule), **16a** (FR-RSC-03 + FR-SCH-05 guards), **17a RED** → **17b GREEN** (the FR-REC-04 wiring) → **17c** (OPEN-27, `SUPERSEDED` — the replacement is durable across a sweep), **16b** *(27 Jul — the FR-LIB-02 + FR-REC-11/FR-WER-04/NFR-MNT-06 guards; **NFR-MNT-07 now satisfied for all four (I) requirements**; 14 must-fail transcripts where 11 were required, **no violation found anywhere**, and the extensibility guard **derives** its metric names from source and was proven self-maintaining against a temporary third rule — `docs/P16B-REPORT.md`)*. **Ryan:** 08 (Garmin adapter + Daily Metric Set), 09 RED → 10 GREEN (the two rules + a content-agnostic `RecommendationEngine`), **OPEN-04** → **11** (catalog + seeded libraries), **14a/14b** (wellness backend + view), **15a/15b/15c** (analytics), and ✅ **OPEN-33 — the Garmin ingestion CLI, run against his real export: 50 real metric sets ingested, real sleep scores driving real tiers (14/40/37 → LOW, 76/83 → HIGH) and real active calories driving real targets. FR-WER-10 — the midpoint gate, slipped for a fortnight because it was nobody's queue item — is DEMONSTRATED.** ⛔ §8.4 honored throughout: the real health data lived in a scratchpad and was deleted; fixtures are *derived*, never copies. **Miguel:** 12 (backend API + persistence), 13 + 13b (dashboard, month navigator, theme), FR-CAL-07 (`.ics`). ✅ **The frontend views were observed RENDERING IN A BROWSER on 28 Jul** (headless Chrome via `puppeteer-core` against the installed browser — not a repo dependency), closing the "never seen in a browser" caveat that had stood across three reports; **FR-WEL / FR-ANL-04 / UI-03 / UI-04 are (D) and clear by being shown.** The Wellness frame shows the whole integrated system in one screen: wearable metric → engine → tier + calorie target → catalog → dietary-honoring meal plan.
>
> ⚠️ **Standing traps a new session still needs, because they are invisible-if-wrong.** **(1)** ⛔ **`export type Catalog = WorkoutSource` in `RecommendationScheduler.ts` is LOAD-BEARING, not vestigial** — the frozen acceptance harness (`8809158`) imports that exact name. Deleting it as a tidy-up reddens a frozen suite at compile time. **(2)** ⛔ **A wrong freeze provenance sha is fixed BY HAND with a `shaCorrectedFrom` note, NEVER by re-running `npm run freeze`** — which re-hashes, and is §4.12's *editing the test one level removed*. (OPEN-31 confirmed the digests never moved.) **(3)** **§4.12(a) has TWO routes for a guard, not one** — transcription **or** generation from a human-authored spec **with every individual check watched to fail**; a check never observed to fail does not satisfy NFR-MNT-07. **(4)** ⛔ **`bmrKilocalories` must never seed the calorie baseline** (CON-05, §4.9 — the System *asks*); it is the most tempting trap in the Garmin export. **(5)** **The 12 Jul dated schedule in `docs/TEAM-MEETING.md` is SUPERSEDED** — per-day deadlines were abandoned 22 Jul; **31 July is the only hard date.** **(6)** **Two different interfaces are named `Catalog`** (packet 11's library seam and the scheduler's narrow port) — import one aliased. **Full decision history with reasoning: `docs/TEAM-MEETING.md`'s decision log. Per-packet detail: the `docs/P*-REPORT.md` files.**)*

---

## ⚠️ 0. STANDING INSTRUCTION FOR AI ASSISTANTS: WRITE IT DOWN

**The documents in this repository are the project's memory. Your chat context is not.**

When a decision is made or something changes, **update the affected files in the same turn — do not just say it in chat.** A conversation ends and takes its context with it. A file does not. The team is running a 19-day project across three people and multiple AI sessions; **anything that exists only in a chat log is effectively lost**, and will be re-argued from scratch by the next session.

The user has said this explicitly: *"I can't remember everything. Documentation lets us catch things we missed or wanted to do."*

### When X happens → update Y (do this without being asked)

| When this happens | Update this | With what |
|---|---|---|
| **A decision is made** (technical, scope, process — anything) | `docs/TEAM-MEETING.md` → **Decision Log** | A row: date, decision, **and the reasoning.** The reasoning is the valuable part — it's what stops the team re-arguing a settled question. |
| **A requirement changes** (added, removed, reworded, **re-prioritized**) | `docs/SRS-v2.md` | The requirement itself, **plus the Revision History table**, **plus any cross-references** (use cases, traceability matrix, index). Reclassifying a requirement almost always leaves contradictions elsewhere — go find them. |
| **An architectural decision is made or reversed** | `CLAUDE.md` → §4 "Decisions Already Made" | The decision **and why the rejected option was rejected**, so a future session doesn't propose it again. |
| **An open issue is resolved** | `docs/TEAM-MEETING.md` → Open Issues **and** `docs/SRS-v2.md` Appendix C | Mark it closed **and record what the answer turned out to be.** A closed issue with no recorded answer is not closed. |
| **A new open question appears** | `docs/TEAM-MEETING.md` → Open Issues | An ID, an owner, and a due date. An issue with no owner and no date will not get done. |
| **A task is finished, or the schedule slips** | `docs/TEAM-MEETING.md` → Action Items and the schedule table | Tick it, or **move the date and say why it moved.** |
| **Anything material changes about the project** | `CLAUDE.md` → §9 "Current Status" and the "Last updated" date at the top | Keep it true. A stale context file is worse than none, because it is trusted. |
| **Code is committed** | The commit message itself | `CLAUDE.md` §8 — scope, the *why* in the body, and the `Requirements:` / `Owner:` trailers. **The commit log is project memory too**, and it is the only record of what an agent did once its session ends. |
| **The team meets** | `docs/TEAM-MEETING.md` | Record what was actually decided. Add a new dated meeting section for the next one. |

### Rules

1. **Update the file in the same turn as the change.** Not "later," not "I'll note that" — write it.
2. **Record the reasoning, not just the conclusion.** "We chose X" is nearly useless in two weeks. "We chose X because Y, and rejected Z because W" is what prevents the re-argument.
3. **When you change a requirement, hunt down its cross-references.** The SRS has a traceability matrix, use cases, and an index that all point at requirement IDs. A demotion or rename that updates only one place leaves the document self-contradicting — and that is exactly what a grader circles.
4. **If you're unsure whether something is worth writing down, write it down.** The cost of an extra line in a decision log is nothing. The cost of losing why you made a choice is a week.
5. **Never let a document quietly go stale.** If you notice a file has drifted from reality, say so and fix it, even if that wasn't the task you were asked to do.

---

## ⛔ 0.1 STANDING INSTRUCTION: NEVER LET GENERATED CODE ENTER A PROMPT

**The prompt pack in `prompts/` is a GENERATOR.** Run the packets in order and the agent *creates* the code files. **Re-running may produce different code, and that is expected.**

### If a teammate pastes implementation code and asks you to put it in a packet — STOP and warn them

**Trigger this warning when someone asks you to:**
- add generated or hand-written implementation code to any file in `prompts/`
- *"lock in"*, *"pin"*, *"freeze"*, or *"make reproducible"* a run that came out well
- add an "expected output", "reference implementation", or "example solution" to a packet
- make a packet produce **the same code** as last time

**Say this, in your own words, before doing anything:**

> **Two things break if generated code goes into a prompt, and both break silently.**
>
> **1. The coverage figure stops meaning anything.** NFR-MNT-01 requires 90% line coverage on the engine, and NFR-COR-01 requires a 1,000-case property test proving no placement ever overlaps a busy interval. Both only carry information because the implementation was derived *independently* of the tests. Put the implementation in the prompt, and the tests are checking code against itself. **The number stays green and starts measuring nothing** — you will not notice, because nothing fails.
>
> **2. One run's arbitrary choices become the specification.** Whichever way that run happened to merge intervals or order its comparisons is now frozen into the spec, indistinguishable from a requirement the team actually agreed on. The next person reads it as binding.

### **What to do instead** — the ask is usually legitimate; the method isn't

| What they actually want | The correct route |
|---|---|
| *"That behavior was right — keep it"* | **It's a requirement.** Add it to `docs/SRS-v2.md` (with revision history + cross-refs, §0 rule 3), then quote it verbatim into the packet. Now it's binding because the team agreed, not because one run did it. |
| *"Don't let it do X"* | **It's a constraint.** State it as a prohibition in the packet's *Files you must NOT touch* or *Escalation clause*. Constraints belong in prompts; implementations don't. |
| *"I want re-runs to be consistent"* | **That's what the frozen tests are for.** They are the only invariant across runs — which is exactly why they're written first (packet 04) and committed before any implementation exists (packet 05). |
| *"These types must be exact"* | **Already handled.** `prompts/foundation/03-shared-contract-types.md` is human-authored and transcribed verbatim, by design (§4.7). |

### ✅ Pasting code is FINE in all of these cases — do not over-apply this rule

- Pasting code **into the chat** to review, debug, explain, or fix it
- **Type signatures, interfaces, and the contract** — those are obligations the code must satisfy, not implementations
- **Boundary tables and required test cases** quoted from the SRS
- Error messages, stack traces, failing test output
- Anything in `prompts/foundation/03-shared-contract-types.md`

> **The prohibition is narrow and specific: implementation code must not enter a file in `prompts/`.** Everything else is ordinary work. Full reasoning: §4.11.

---

## 1. The Project in One Paragraph

A web application that combines an **adaptive scheduling engine** with **real wearable health data**. Every commitment in a user's day — class, meeting, habit, workout, meal — is a *task* with a duration, priority, preferred time window, and flexibility flag. A single scheduling function places tasks around fixed commitments, and **re-invokes itself** to repair the schedule when a task is missed, when the user declares one skipped, or when a new commitment displaces one. Separately, the System reads the user's Garmin data (sleep score, active calories) and adapts its recommendations: poor sleep lowers workout intensity, high activity raises the day's calorie target. **The recommendations are not advisory — they become real scheduled tasks on the real calendar, defended by the same rescheduling logic as everything else.**

---

## 2. Hard Facts

| | |
|---|---|
| **Course** | Summer 2026 Software Engineering Capstone — **five weeks total** |
| **Team** | **Patrick Rucker** — Scheduling Algorithm Lead · **Ryan Woosley** — Data & Wearable Integration Lead · **Miguel Alvarez** — Frontend & Backend Lead *(assigned 12 Jul)* |
| **Midpoint** | **16 July 2026** |
| **Presentation** | **31 July 2026** ← the deadline everything is measured against |
| **Graduation** | 1 August 2026 |
| **How it's built** | **Agentic programming.** The team directs requirements; AI agents write the code. |
| **Stack** | React + TypeScript (frontend), Node.js + TypeScript (backend), **MongoDB** *(changed from PostgreSQL on 12 Jul)* |

**The nineteen-day window is the governing constraint on every technical decision in this project.** It is encoded in the SRS as CON-06, and it is why no Essential requirement may depend on a third party's approval.

---

## 3. Documents and What They're For

**These documents live in this repository, alongside the code they specify** *(moved here 21 Jul — see §3.1)*. Paths below are repo-relative.

| File | Purpose |
|---|---|
| **`CLAUDE.md`** *(this file, repo root)* | Project context for a new session or teammate. **Must stay at the root** — that is where it is auto-loaded from. |
| **`docs/SRS-v2.md`** | **The current SRS.** The submission document. Formal use cases, UML diagrams, wireframes, ~84 numbered verifiable requirements. **This is the source of truth — edit this, never a generated copy.** |
| **`docs/build-pdf.sh`** | **Builds the submission PDF.** Run `./build-pdf.sh` **from inside `docs/`** → `docs/build/SRS-v2-CS4398.pdf` (65pp). Pre-renders the four Mermaid diagrams to SVG, inlines them, prints via the installed Chrome. **Everything under `build/` is generated, gitignored, and disposable — never edit it.** *(Mermaid diagrams are code blocks; most Markdown→PDF exporters emit the raw code rather than the picture, which is worse than no diagram at all. This script exists so that cannot happen. It needs Node.js and Chrome on the machine — both are checked at startup.)* |
| **`docs/AGENTIC-TDD-WORKFLOW.md`** | **How the code actually gets written.** The RED/GREEN agent split, the contract rule, the executable guards. **Read §1 before running any agent** — it is the three ways this method fails silently. |
| **`docs/TEAM-MEETING.md`** | Agenda, open questions, and the running decision log. §0 requires decisions to be written here **as they are made**. |
| **`docs/TESTING.md`** | **What the System is tested with, and why those tools.** The five third-party frameworks (Jest, fast-check, supertest, mongodb-memory-server, ESLint/`tsc`), the 498-test inventory by area, the five levels represented, the six hand-written guards and why no framework could replace them, and **where each tool choice came from** — the SRS names testing *properties*, a packet binds the *package*. ⚠️ **Written 28 Jul to answer "use existing testing suites" — no new framework was adopted.** The three that were costed and rejected (Postman/Newman, Vitest+RTL, Playwright/Cypress) are recorded in `docs/TEAM-MEETING.md`'s decision log, 28 Jul, so they are not re-proposed; `TESTING.md` itself describes only what the System *does* use. |
| **`prompts/`** | **The work packets.** One packet ≈ one agent session ≈ one reviewable diff ≈ one human owner. **Numbered `01`…`17` and delivered in exact numerical order**, and **grouped into folders by owner** so nobody has to ask whose packet a file is. `00-prompt-collection-summary.md` is the index, `README-prompts.md` the phase map, `_TEMPLATE.md` for new ones. **Packets `07`–`17` are enumerated with their requirement IDs but not yet authored** *(deliberately — §4.11)*.<br><br>`foundation/` **01–03** *(Patrick)* · `engine/` **04–07** *(Patrick)* · `wearable/` **08–11** *(Ryan)* · `backend/` **12** *(Miguel)* · `frontend/` **13–15** *(Miguel)* · `verification/` **16–17** *(Patrick)*<br><br>⚠️ **The numbers are the delivery order and the folders are the ownership** — they are two different axes and both matter. **The `Human owner` field inside each packet is authoritative**; the folder is a convenience, and if the two ever disagree, the packet wins. |

### 3.1 What deliberately did NOT come into the repo

Background and reference material stayed in the original planning folder (`…/Summer 2026 Capstone Class Documents/planning and brainstorming/`). It is **not** version-controlled and is not needed to build or understand the System:

`SRS.md` (v1 — superseded; do not cite) · `project-overview.md` and `Project Description.md` (the original pitch) · `SRS planning.md` (the professor's directions) · **four example SRS PDFs the professor supplied** (3.5 MB of course handouts — someone else's documents, and §8.4 keeps generated and third-party bulk out of the repo).

> **They were *moved*, not copied.** Two copies of `SRS-v2.md` would diverge within a week, and the sentence "this is the source of truth" would quietly become false. If you find a second copy of any file above, **one of them is wrong and it is probably the one you are reading.**

---

## 4. Decisions Already Made — Do Not Re-Litigate

These were each debated and settled. **The reasoning still holds. Do not propose the rejected option again.**

### 4.1 The official Garmin Health API is OFF the critical path
A teammate **owns a Garmin device**, so the *data* is available. But Garmin's Health API is gated behind a **partner-approval review** with a lead time the team cannot schedule — incompatible with 31 July. **Apple Watch is excluded entirely**: HealthKit is on-device and iOS-only, so it cannot reach a web backend without an iOS app.

**Instead:** a *layered* data strategy. The baseline (Essential) is **real sleep and activity data exported from the teammate's Garmin account** and ingested by the System. A live API is a *Conditional* upgrade, attempted only after all Essential work is verified.

> **Owning the device solves the data dependency, not the API dependency. Conflating those two is the exact error this decision prevents.**

**⚠️ Re-affirmed 22 Jul, with one correction to the wording above.** *"HealthKit … cannot reach a web backend without an iOS app"* is true of the **API** but **overstated for the export path**: the iOS Health app can export manually (Health → Export All Health Data → `export.xml`), which is a *file*, not an API, and would fit DEP-02 Layer 1 and FR-WER-08 without any iOS app. **The exclusion still holds, but for a different and stronger reason: Apple publishes no 0–100 sleep score** — only stages and durations — **so adopting it would reopen OPEN-02**, the question the Garmin export closed for free, trading a published number for a formula the team would have to defend. Secondarily it costs a second adapter, parser and fixture set for data already held, and it only helps if the watch is worn overnight — the same behavioural fix that yields fresh Garmin sleep data. **Revisit only if an Apple Watch is owned AND worn overnight AND the Garmin re-export does not arrive**; even then it is Conditional, and **FR-WER-05 means it costs one adapter and no change to the recommendation engine.** *(Recorded because the gap in the original wording is the kind a future session would find and treat as grounds to reopen a settled question.)*

### 4.2 Workout and meal libraries are LOCAL SEEDED DATA, not runtime API calls
Workouts and recipes are static — a push-up is the same push-up in July as in January. Calling an external service at recommendation time would reintroduce rate limits, API keys, and network failure on demo day in exchange for nothing. Workouts are seeded once from a freely licensed exercise dataset; meals are hand-authored with calorie counts and dietary flags.

**Consequence: the entire acceptance demonstration runs with outbound network access disabled**, and FR-LIB-02 requires the team to *prove* that rather than assume it.

### 4.3 There is exactly ONE scheduling engine
`FR-SCH` specifies a **pure function** — *given a day's busy intervals and a task, return valid slots.* `FR-RSC` specifies **when that same function is called again**. Rescheduling is **not** a second algorithm. If you ever find yourself writing a second function that computes a placement, **stop** — that's the bug FR-RSC-03 exists to prevent.

The engine must stay pure: **no clock, no database, no side effects.** That purity is what lets it be property-tested over 1,000 randomized days with no database and no browser, and held to 90% coverage.

### 4.4 Metrics are extensible by ADDITION
Two metrics ship: **sleep score → workout intensity**, and **active calories → daily calorie target**. Adding a third (stress, HRV) must be *two additions and zero modifications*: add it to the Daily Metric Set, register a rule that consumes it. This requires the database to store **one document per metric per date, not one field per metric** (DR-05).

⚠️ **MongoDB makes this easy but does not make it automatic.** A schema-free store happily accepts the *wrong* shape — a single daily document with `sleep_score` and `active_calories` as named fields would work fine today and quietly turn every future metric into a change to every reader. **DR-05 forbids that shape. The absence of a schema is not the absence of a design.**

### 4.5 We EXPORT a calendar file; we do not IMPORT from a calendar API *(decided 12 Jul)*
The team **declined** calendar *import* (SI-05 — reading Google Calendar over OAuth) and instead adopted calendar **export**: the System writes an **`.ics` file** (RFC 5545) that the user imports into Google Calendar themselves. *(SRS: SI-06, FR-CAL-07 — **Conditional**.)*

**These are opposite directions, and the distinction is load-bearing:**
- **Export gives the scheduler nothing.** Fixed commitments therefore come from **manual entry only** (FR-CAL-01). Do not describe the `.ics` export as "calendar integration" that feeds the scheduler — it doesn't.
- Export is **text generation** — no OAuth, no API, no network — so it preserves the offline acceptance demo and adds **no security surface** (CON-07).
- **The "external API + OAuth" dimension of the project's technical scope is now genuinely absent**, having left with the Garmin API. Don't claim it.

*Import was declined on cost, **not** availability — Google issues credentials self-service, with no partner review of the kind that excluded Garmin. If a future release wants it, that door is open (SRS: SI-05).*

**If import is ever revisited, the known traps are:** refresh tokens expire after 7 days in Testing mode; use `singleEvents=true` or you're parsing RRULE yourself; and **all-day events return a `date` not a `dateTime` — handled naively they mark the whole schedulable day busy and the scheduler can place nothing.** *(That last one is already guarded: **FR-CAL-05 is Essential regardless**, because a manually entered all-day commitment causes the identical bug.)*

### 4.6 One agent NEVER writes both a test and the code it tests
**RED and GREEN are separate agent sessions.** The RED agent sees the SRS and the contract, and never an implementation. The GREEN agent sees the failing tests, and **may not edit, skip, or weaken one — ever.** If it believes a test is wrong it **stops and a human adjudicates it against the SRS.**

**Do not propose collapsing these into one pass "for speed."** When a single agent writes the test and the implementation together, the test encodes what the code *does* rather than what the requirement *says*. It goes green, it looks reasonable, and it is wrong — and you find out on 31 July. **This is not a prompting problem and cannot be fixed by asking the agent to be careful.** It is structural, and the split is the fix. Full reasoning: `AGENTIC-TDD-WORKFLOW.md` §1.1.

### 4.7 The contract is human-owned and frozen
`shared/src/contract.ts` (the domain types) is written by a human **once, before any agent runs**, and given verbatim to every packet. **An agent that wants to change it must stop and escalate** — it is a team decision with a row in the decision log, not a refactor.

Rejected: letting each module's agent define the types it needs. Three agents produce three locally-reasonable, mutually incompatible `Task` types, each passing its own tests, and day-5 integration becomes a rewrite. **Agents make this worse rather than better, because they generate plausible types faster than a human notices they disagree.**

**`Task.createdAt` is not a counter-example** *(added 22 Jul, SRS v2.11)*: it is an ISO instant read by `RescheduleService` to break FR-SCH-10's priority tie, and **the engine never reads it.** Purity forbids the engine *consulting* a clock — not the caller *passing* it data, which is what `schedulableDay` already does.

Fixed conventions inside it: **time is `Minute`** (integer, minutes since local midnight — the engine never sees a `Date`, which is what makes FR-SCH-05's purity structural); **priority is 1–5, 1 = highest**; **`engine/` has an empty `dependencies` block, permanently** (an engine that can't import anything can't import a clock).

### 4.8 Inspection-only requirements become executable CI guards
Anything the SRS marks **(I)** — FR-RSC-03 (exactly one placement function), FR-LIB-02 (no network in the recommendation path), FR-SCH-05 (purity), FR-REC-11 (extensibility) — **gets a test that enforces it, or it silently becomes false.**

Ask an agent for FR-RSC-02 and it will write a tidy little `findNextFreeSlot()` inside the reschedule service, because that is locally the simplest thing. FR-RSC-03 is now false. **No test fails.** Code review catches that on a hand-written codebase; with three agents out-generating three reviewers (§7.3), it does not.

### 4.9 The System is NOT a medical device
It does not estimate basal metabolic rate — **it asks the user** for a baseline calorie target. It never recommends anything violating a user's dietary preference; that constraint **does not relax, at any point, for any reason**, even when no compliant item can be found.

### 4.10 A missed task is INFERRED, not reported — and the inference is correctable *(decided 21 Jul)*
The System classifies an occurrence **missed** when its window elapses with no completion (FR-RSC-01). It does **not** wait to be told.

**Rejected: making the user's declaration the only way a task becomes missed.** Two reasons, and the second is the one that actually kills it:
1. FR-RSC-01 is in the **Core Demonstrable Capability** (SRS §2.7.1) — *"the schedule repairs itself."* A schedule that repairs itself only when asked is a weaker claim, and it is the claim any todo app's snooze button already makes.
2. **The miss is the signal the user has the least incentive to send.** Somebody who skipped their 8pm run does not open the app to confess it. A declaration-only design fails precisely in the case the feature exists for.

**But the inference is wrong in one specific direction** — the user did the task and never tapped complete — so three requirements were added rather than one: **FR-RSC-08** (declare a task *skipped*, available **before** the window elapses — the third reschedule trigger), **FR-RSC-09** (marking the original complete *cancels* an automatic reschedule), and **FR-RSC-10** (what actually observes the elapsed window: evaluation **when the schedule is retrieved**; a background job is permitted, not required).

> **The shape to keep in mind: the System's classification is a proposal the user can overturn, not a verdict.** All three triggers call the same `RescheduleService`, which calls the same engine — so §4.3 still holds, and there is still exactly one placement function.

### 4.11 Prompts follow the professor's house style — but never contain the implementation *(decided 21 Jul)*
The professor supplied an example prompt pack (an MVC calculator, 15 prompts). **We conform to its format**: numbered `01`…`17` delivered in exact order, a `00-` summary, a `README-prompts.md` phase map, and the five named techniques he lists — **Sandwich Method, Attention Anchoring, Visual Emphasis, Clear Delimiters, Selective Context.** Those are almost certainly lecture terms and therefore rubric lines; conforming costs us nothing.

**His prompts contain finished `.java` files; ours contain requirements. This is not a disagreement about method — it is the same artifact at opposite ends of its life.** His pack was written **backwards from a program he had already generated**, so the output got pasted back in. Ours is written **forwards to one that does not exist yet.** A prompt pack is a **generator**: run it in order and the agent creates the code files.

**Therefore: re-running the pack may produce different code, and that is expected.** Two consequences that matter:

1. **The tests are the only thing constant across runs.** That is precisely why they are written first (`04`) and frozen before the implementation (`05`) — a differently-shaped implementation must still satisfy the same 1,000-case property test. **The implementation is disposable; the specification and its executable form are not.**
2. **Never paste generated code back into a prompt.** It would freeze one run's arbitrary choices into the spec, and NFR-MNT-01's coverage figure would start measuring agreement between the code and itself. **§0.1 is the standing instruction that enforces this — an AI session must warn a teammate who asks for it, and it lists the correct route for each version of the request.**

> **Delete `engine/src/`, re-run prompt 05, and the suite still passes. That is the claim this structure makes, and it is demonstrable in front of a room.**

**Prompts `07`–`17` are enumerated with scope, phase, and requirement IDs — but not yet authored.** *(`06` was authored on 22 Jul immediately before its run, which is the pattern §9 requires: authoring is the first half of the work item.)* A prompt written weeks before its module is designed encodes guesses, and an agent implements a guess as faithfully as a requirement.

> **A prompt that does not exist is visibly missing. A prompt written from speculation is invisibly wrong.**

---

### 4.12 The guards are human-owned like the contract, and the freeze is content-addressed, not commit-based *(decided 24 Jul)*

Two decisions, one argument. **SRS v2.21 states both in binding form — NFR-MNT-07, NFR-MNT-08, NFR-MNT-09 — and `prompts/foundation/02b-executable-guards.md` transcribes the result verbatim. The full run sheet is `docs/REPLAY.md`.**

**(a) `scripts/` and the `engine/**` lint overrides are exempt from §4.11's generator rule** — the *second* exemption after `shared/src/contract.ts`, earned for a reason that is not the contract's:

> **You cannot verify a verifier with the thing it verifies.** A regenerated guard that came back 10% weaker is indistinguishable, from outside, from one that came back right — **both exit 0.** Every other packet is checked by something downstream; the guards are what that something *is*.

**This does not weaken §0.1, and do not cite it as precedent for anything else.** §0.1 exists because an implementation pasted into a prompt makes NFR-MNT-01's coverage and NFR-COR-01's property test measure the code against itself. **No coverage figure or property test measures `scripts/`**, so transcribing it costs exactly nothing — which is precisely why the same move on `engine/src/` would be fatal and this one is not. *(Rejected: specifying the guards in prose and letting each run derive them **with nothing else required**. It preserves a tidier claim — "the pack generates everything, including its own safety nets" — at the price of trusting the thing that catches untrustworthy output to itself be untrustworthy output.)*

> ### ⚠️ **Corrected 27 Jul — there are TWO routes, not one, and this section claimed one for three days.** *(SRS **v2.33**, NFR-MNT-07 + NFR-MNT-09.)*
>
> This section used to read *"`scripts/` … **is human-authored and transcribed verbatim**"*. **That was false of half of `scripts/` when it was written.** Packet 16a (merged 24 Jul) gave an agent a human-authored *specification* and had it derive `guard-single-placement.mjs` and `guard-engine-purity.mjs`; packet 16b does the same for two more. **The document was wrong, not the practice** — and a claim this file makes about its own method is exactly the kind a grader disproves with one `git log`.
>
> **A guard may enter the build by either route, and by no other:**
>
> | Route | What it is | Where it is used |
> |---|---|---|
> | **1. Transcription** | Human-authored, copied in verbatim, exactly like `shared/src/contract.ts`. | `02b`'s guards — `guard-engine-deps`, `guard-tests-frozen`, the `freeze` helper, the `engine/**` lint overrides. |
> | **2. Generation + proof of failure** | Derived by a packet from a **human-authored specification**, **and every individual check watched to fail on a deliberately introduced violation before the packet closes**, with the failing output recorded in the packet's report. | `16a`'s two guards; `16b`'s two. |
>
> **⛔ Neither route permits a guard that has never been observed to fail.** That is the actual rule, and it is what both routes are for.
>
> **Why route 2 is acceptable — and, for the property at issue, stronger.** The danger is *a guard that enforces nothing while exiting 0*. **Route 2 tests that behaviourally; transcription only attests to provenance** — a hand-typed guard with a typo in its regex is inert, and nothing about having been typed by a human reveals it. What transcription *does* contribute — assurance the guard checks the **right** thing — route 2 gets from the specification being human-authored. **This project has twice shipped a guard that was green while enforcing nothing**, and neither time would transcription have caught it.
>
> ⚠️ **Do not read this as licence to relax the must-fail exercise.** It is not paperwork; it is the entire consideration route 2 pays for the exemption. **A packet that skips it has not produced a guard, it has produced a file.**

**(b) A frozen test suite is pinned by a sha256 per file, not by a commit.** `npm run freeze -- --packet NN --path <dir>` records the digests; `npm run guard:tests-frozen` re-hashes and compares.

- **Why:** a commit-based freeze needs a repository *and* that commit reachable. Neither holds in a shallow CI checkout, and **neither holds during a rebuild from the specification**, which freezes its suites before it commits anything. **A freeze that only works in the repository that created it cannot protect a rebuild — the case it most needs to protect.**
- **It is strictly stronger than what it replaced**, not a relaxation: it catches an edited test, an edited-*and-committed* one, a deleted one, **and a file quietly added to a frozen suite.**
- **The git sha is still recorded, and is not decoration.** It is provenance — it attests *when* the freeze happened from something other than the manifest, and it is what catches a suite edited and then re-frozen to cover the edit (the guard reports a *provenance mismatch*). When no commit exists, the entry simply has none and the hashes verify it fully.
- ⛔ **Re-running `npm run freeze` to make a build go green is editing the test, one level removed** — the same act §8.3 already forbids for the manifest.

> **The consequence worth remembering: the freeze commit was never the wall. The session boundary is** (§4.6). A replay needs one agent session per packet with a human gate at each RED — but it needs **no commits at all** until a human is ready to assert they read the result.

---

## 5. The Load-Bearing Requirement

**FR-REC-04** — *a recommended workout is created as a task and placed by the same engine, subject to the same conflict detection and rescheduling as any user-created task.*

This is what makes the project **one integrated system** rather than a scheduler and a fitness app sharing a login. **If everything else shipped and FR-REC-04 did not, the project would have failed at its own thesis while appearing complete.** Protect it above all else; if the schedule forces a cut, cut anything else first.

---

## 6. Scope Discipline

The SRS classifies every requirement **Essential / Conditional / Optional** (IEEE 830 §4.3.4). **Only Essential requirements are conditions of acceptance.**

§2.7.1 of the SRS defines the **Core Demonstrable Capability** — the irreducible set carrying the System's central claim. **Nothing in the Core may be cut.**

**Already demoted to Conditional for schedule reasons:** FR-REC-10 (weekly meal plan + prep windows) and NFR-MNT-02 (70% whole-system coverage). NFR-MNT-01 (**90% coverage on the engine**) remains Essential — the engine is where correctness lives.

**Deliberately NOT started until all Essential work is verified:** FR-SCH-07/08 (priority displacement — *the most seductive way to lose a week*), FR-WER-11 (live API), FR-REC-12 (extensibility proof), FR-LIB-09 (external content API).

> ⛔ **26 Jul — NO Conditional work will be undertaken at all.** The presentation is imminent and the remaining Essential work leaves no room for it, so every Conditional above (plus FR-REC-10, FR-ANL-05, NFR-MNT-02, NFR-MNT-09) is **definitively out** — OPEN-05 and OPEN-06 close unattempted, "having lost nothing." **All remaining work is Essential.** ⚠️ **The two Conditionals already shipped stay** — FR-CAL-07 (`.ics`) and FR-DSH-08 (month nav) are merged, tested, working; a forward-looking scope cut does not un-build sunk work. Full decision + reasoning: `docs/TEAM-MEETING.md` decision log, 26 Jul.

---

## 7. Working Agreements (Agentic Development)

The failure mode of agentic programming on a team is **not slow code** — it is a codebase nobody understands at 11pm the night before the demo.

1. **Integrate daily.** Three agents writing into one repo in parallel produces merge chaos that nobody has the context to untangle.
2. **Every module has a human owner who can explain it aloud without opening the file.** If a section of the codebase has no such human, **it is not done**, regardless of whether the tests pass.
3. **The bottleneck is reviewing, not writing.** Agents can generate more code in a day than three people can review in a week. Plan around that.
4. Work along the module seams the SRS already draws — engine / adapter / catalog / frontend — so parallel work doesn't collide.
5. **This file is version-controlled and shared, so `git pull` before starting an agent session.** A rule added here reaches your teammates' agents **only when they pull.** ⚠️ **A stale `CLAUDE.md` fails silently and confidently:** an agent running on last week's copy doesn't know a rule exists, so it won't warn you it's missing one — it will just behave the way the old file said, fluently. This is the strongest practical argument for rule 1.

---

## 8. Git and Commit Conventions

**The commit log is the third piece of the project's memory,** after the documents and the SRS. On an agentic project it is the *only* durable record of what an agent actually did — the session that wrote the code is gone, and the diff is what's left. It is also read by the grader.

**The governing rule: a commit is the unit of *review*, not the unit of *work*.** Agents out-generate reviewers (§7.3). The commit is where that gets bounded — one packet, one reviewable diff, one human who has read it.

### 8.1 The message schema

```
<scope>: <imperative summary, ≤72 chars>

<why — the problem this solves, and what was rejected. Wrap at 72.>

Requirements: FR-SCH-01, FR-SCH-04
Packet: 04
Owner: Patrick Rucker
```

**Scope is a closed vocabulary.** Adding to it is a decision-log row, not an ad-hoc choice:

| Scope | Use for |
|---|---|
| `PNN RED` | the frozen test-suite commit from a packet's RED session |
| `PNN GREEN` | the implementation that makes that suite pass |
| `engine` · `reschedule` · `adapter` · `catalog` · `api` · `frontend` | module work outside a packet — these are the SRS module seams (§7.4) |
| `guard` | an executable CI guard for an **(I)** requirement (§4.8) |
| `seed` | workout / meal library data (§4.2) |
| `srs` | changes to `docs/SRS-v2.md` |
| `docs` | any other document under `docs/` or `prompts/`, and `CLAUDE.md` |
| `chore` | tooling, dependencies, config, scaffolding |

> **`reschedule` was added 22 Jul, and it exists to stop one specific misfiling.** It covers `server/src/reschedule/` — the FR-RSC policy layer that decides **when** the engine is called again. ⚠️ **It is not `engine`, and the distinction is §4.3's**: there is exactly one function in this System that produces a placement, it lives in `engine/src`, and the whole point of FR-RSC-03 is that the reschedule service *re-invokes* it rather than being it. **A log where both modules read `engine:` is a log that quietly asserts the thing FR-RSC-03 forbids** — and the guard in packet 16a checks the code, not the commit messages. *(Rejected: `api:`, which packet 12 already uses for `server/src/api/` and which names the wrong layer.)*

**Subject line:** imperative mood (*"add"*, not *"added"*), no trailing period, ≤72 characters, and **name the behavior, not the file** — `engine: keep searching after a too-short gap`, never `engine: update scheduler.ts`. A summary that names a file tells a reviewer nothing they couldn't get from `git diff --stat`.

### 8.2 The trailers — and which are mandatory

| Trailer | Required on | Why |
|---|---|---|
| `Requirements:` | **every commit that changes behavior** | This is the traceability matrix as running evidence (SRS Appendix B). **A behavior change that cites no requirement is somebody's opinion** — the same rule that governs test names (`AGENTIC-TDD-WORKFLOW.md` §6, item 3). If you can't name the requirement, either find it or don't make the change. *(Omit it on pure doc/tooling commits — a trailer that appears on everything is a trailer nobody reads.)* |
| `Packet:` | any commit produced by an agent session | Ties the diff back to the prompt that produced it. Without it, in two weeks nobody can tell which packet wrote a given file — and that's exactly when you need to know. |
| `Owner:` | **every commit** | §7.2 requires a human who can explain the module aloud. `Owner:` is that person naming themselves. **It is never the agent.** |

> **No AI credit lines. No `Co-Authored-By`, no generated-with footers, no tool attribution — on any commit, ever.** *(Team decision, 21 Jul.)* Authorship of the commit is the human named in `Owner:`, because that trailer means "I read this diff and I can defend it," which is a thing only a person can assert. That the project is built agentically is stated where it belongs — in the SRS and in `AGENTIC-TDD-WORKFLOW.md` — not repeated on every line of `git log`.

### 8.3 RED and GREEN commits are special — they *are* the boundary

These two commits are the git half of the RED/GREEN split (`AGENTIC-TDD-WORKFLOW.md` §5) — and it's the half a fresh chat session does **not** give you. A new session buys context isolation; only the commit buys a permission boundary.

**The RED freeze commit** — `P04 RED: engine test suite (frozen)`
- Contains **only test files plus the one throwing stub.** Anything else in the diff — a helper, an "obvious" little utility — means the tests were written against an implementation, and **the packet is compromised.** Revert and re-run RED.
- Happens **after** the human gate (`AGENTIC-TDD-WORKFLOW.md` §6), never before. The commit is what freezes the tests — and that includes freezing them against you.
- **Record the agent's escalations in the body.** An ambiguity the RED agent found and refused to guess at is the highest-value line in the whole log, and it exists nowhere else once the session ends.

**The GREEN commit**
- **`npm run guard:tests-frozen` must pass**, and the body must state it: `Tests unchanged since a1b2c3d.` The guard reads `scripts/frozen-tests.json` and compares the **working tree** against each freeze sha, so it catches an edited-and-committed test as well as an uncommitted one. By hand: `git diff --stat <RED-sha> -- <test dir>` — **revisions before paths, separated by `--`**, which is the order git actually takes. *(This line previously gave that command with the path first, which errors out, and the packets gave it with no revision at all — a form that compares the working tree to `HEAD` and therefore **cannot detect a test that was edited and committed.** That is the one case §8.3 exists for. Corrected 22 Jul, and made executable so it cannot rot again.)*
- If a test genuinely was wrong, it is fixed in a **separate RED-style commit** with a human's reasoning in the body — **never quietly inside a GREEN diff.** A test edited inside a GREEN commit is indistinguishable, forever after, from a test that was weakened to go green.

### 8.4 What never enters a commit

- **Generated output** — `build/`, `node_modules/`, coverage reports, any PDF built from `docs/SRS-v2.md`. Generated and disposable (§3). **Already handled: `.gitignore` was written 21 Jul, before the first commit** — which is the only time doing it is free.
- **A real person's health data.** The Garmin export is a teammate's actual sleep and activity record. It stays out of the repo; test fixtures are *derived* from it, not copies of it. Same for any credential or key.
- **Two unrelated changes.** If the summary needs an "and", it is two commits.

### 8.5 Mechanics

- **Never `--no-verify`.** The hooks are the (I)-requirement guards (§4.8). Skipping them is precisely how an inspection-only requirement silently becomes false while no test fails.
- **Never force-push a shared branch; never rewrite a pushed commit.** Integrate daily (§7.1) — a branch older than a day is a merge nobody has the context to untangle.
- ⛔ **NOTHING is committed directly to `dev`.** *(Patrick, 22 Jul. This **reverses** an earlier allowance the same day for documents, SRS edits and guard fixes to go to `dev` directly — an exemption defined by file type cannot tell a typo from a contract amendment, and the change that slips through is by definition the one nobody read.)*
  - **The model:** long-lived **`dev`** off **`main`**; **every** piece of work — code, documents, SRS, guards — on a branch off `dev`, named for its packet: `wp-06-reschedule-red`. **`main` holds only what is ready to be seen.**
  - ⚠️ **`main` is the SHIPPABLE PRODUCT branch and would be promoted ONCE, in a single merge** *(policy decided 27 Jul)*. **`dev` merges into it when the build is complete and the test suites are done — not before.** ⛔ **NOT A TRACKED ITEM — dropped from tracking 28 Jul by the owner, and the policy is kept as a description, not a to-do.** The conditions it once named (17d landed, the §6 transcript captured, all suites complete, `verify` green) are **all now met, and that is deliberately not a prompt to act.** ⚠️ **Know the standing consequence: `main` is the repository's DEFAULT branch and sits well behind `dev`, at the 21 Jul pre-implementation state** — anyone opening the project lands there and sees no engine, no server, no web app, no guards and no tests, with the entire build one dropdown away. **That is accepted, and it has been considered more than once.** ✅ Promotion would be one merge with zero conflicts (`dev` is strictly ahead; `git rev-list --count dev..main` is **0**), so nothing is lost by leaving it. *(Rejected then: promoting early so the default branch reflects the work. Settled now: whether to promote at all is the owner's call, made outside any tracked list — **do not raise it as an open item.**)*
  - **A branch reaches `dev` only by merge, and only once it is finished, `npm run verify` passes, and its human owner is satisfied.** **Each person decides their own work** (§7.2) — Patrick for the engine and reschedule packets, Ryan for the wearable chain, Miguel for backend and frontend. That is what makes *"pull `dev` and start working"* safe: **`dev` is only ever advanced by something that has been verified and read.**
  - ⚠️ **A RED branch cannot satisfy that gate, and does not try. The RED freeze and its GREEN implementation share one branch and merge together, green.** *(Patrick, 22 Jul.)* A RED packet's tests **fail by design** — that is its pass condition — so `npm run verify` can never pass on it, and merging it red breaks the very thing this rule protects: a teammate pulls `dev`, runs `verify`, and it fails for reasons that have nothing to do with their work. **The freeze does not need `dev` to work**: `guard:tests-frozen` compares the working tree against a **sha**, which exists the moment the commit does, on any branch — and §8.3 is explicit that the **commit** is what buys the RED/GREEN permission boundary. **The split needs a session boundary, not a branch boundary.** So `wp-06-reschedule-red` carries P06 RED *and* P07 GREEN, and reaches `dev` once the suite is green.
  - ⚠️ **Do not confuse this with the RED review gate.** An owner may merge their own branch; **nobody freezes their own test suite** — `AGENTIC-TDD-WORKFLOW.md` §6 requires a **second** human there, and that is unchanged.
  - **This does not relax §7.1's daily integration — it moves the pressure onto branch size.** A branch that cannot be merged today has grown too big. **The gate is a reason to keep branches small, never a licence to let one age.**
- **An agent does not commit unless a human asks it to.** The commit is the human's assertion that they read the diff. If an agent commits on its own, that assertion is fabricated and §7.2 quietly stops being true — while still *looking* true in the log.
- **A commit that implements a decision carries the decision-log row with it.** Same commit, per §0. A decision that exists only in a chat log is lost.

### 8.6 Worked examples

✅ **Good:**
```
P05 GREEN: implement findAvailableSlots

Scans the day's free gaps in preferred-window order and returns
every gap that fits the task's duration. A gap one minute short is
rejected and the scan continues to the next one, rather than
returning a partial fit or silently dropping the task
(FR-SCH-06, FR-SCH-09).

Ranking resolves on proximity to the preferred window, then
earliest start, per FR-SCH-03.

Tests unchanged since a1b2c3d.

Requirements: FR-SCH-01, FR-SCH-03, FR-SCH-04, FR-SCH-06, FR-SCH-09
Packet: 05
Owner: Patrick Rucker
```

❌ **Bad — and what each one costs:**

| Message | What's wrong |
|---|---|
| `fix stuff` | No scope, no requirement, no owner. Unreviewable in a week, worthless as evidence. |
| `engine: update scheduler.ts and add reschedule helper` | Two changes in one commit — and the second is **FR-RSC-03 being violated in plain sight** (§4.3). This is exactly what §4.8's guard exists to catch. |
| `P05 GREEN: implement engine, adjust one test assertion` | The boundary is gone. **This is the commit that ends the project's correctness argument**, and it will look perfectly reasonable when it lands. |

> **The repository exists** — **`github.com/formalmiguel/CS4398_Project`**, created by Miguel and cloned 21 Jul to `C:\Users\maste\source\repos\Software Engineering Capstone`. It was **empty at clone time**: no commits, no branches, no default branch. The documents in §3 were moved into it the same day, so **these conventions apply from the very first commit** — there is no grandfathered history to be inconsistent with.
>
> *(Renamed twice on 21 Jul — `CS4839` → `CS4389` → `CS4398` — to match the course number on the SRS cover page and the professor's own example file. **Caught before anyone else had a clone**, which is the only cheap time to catch it. If you have an old clone, `git remote set-url origin https://github.com/formalmiguel/CS4398_Project.git`; GitHub redirects the old URL, so a stale remote keeps working and you will not notice it is wrong.)*

---

## 9. Current Status (30 July 2026 — **build complete, §6 demonstrated, everything merged and pushed, including the ad hoc frontend follow-ups; nothing tracked**)

---

> ✅ **30 Jul (latest): `wp-frontend-jul29-followups` MERGED to `dev` and pushed** (`c12c334`, fast-forward-able merge commit, `dev` had not moved since the branch point). Three commits landed: **(1)** `reschedule:` the elapsed-FIXED classification fix + the vacated-slot bug fix, bundled together since both required the same packet 06 re-freeze (SRS v2.39/v2.40, OPEN-38); **(2)** `frontend:` the wellness click-to-schedule feature (`WorkoutSelectionStore`); **(3)** `frontend:` the ScheduleView panel split/legend/skip-button cleanup — kept as three separate commits per §8.4, each carrying its own decision-log row per §8.5, rather than one bundled diff. `npm run verify` **507 green on `dev` itself**, checked before AND after the merge. Full detail in the three blocks below, which describe the same work pre-merge.
>
> ⚠️ **30 Jul (later): elapsed FIXED commitments are now classified, a reschedule can no longer land back on its own vacated slot, and the wellness view gained a click-to-schedule path.** Continuing ad hoc frontend-follow-up work on `wp-frontend-jul29-followups`, requested directly by the module's owner. **Two SRS-level corrections, both because the SRS's own wording had papered over a design accident:** **(1)** `RescheduleService.sweepElapsed` previously skipped every FIXED task before checking whether its occurrence had elapsed at all — a term-old class that was never marked complete stayed `PLANNED` forever, indistinguishable from one still upcoming. Now classified `MISSED` in place (new `AUTO_MISSED` outcome — no successor, no reschedule trigger, since a fixed commitment is immovable and re-placement was never the issue). SRS → **v2.39**, FR-RSC-01 corrected in place (re-placement stays flexible-only; classification no longer does). **(2)** A real bug, found by re-reading a frozen packet 06 fixture: `classifyAndReplace` (the shared path behind FR-RSC-01/08/09) excluded the retiring occurrence from the busy set, which left its interval genuinely free — and the engine's own proximity ranking then frequently re-selected the exact slot the task was just skipped or missed from, a "reschedule" indistinguishable from nothing happening. `askEngine` gained an `avoid?: Interval` param; the vacated interval is now forced busy for that one search. SRS → **v2.40**, §3.8.5 rule 2 corrected in place. **Both fixes required correcting a frozen packet 06 test** (`elapsed-sweep.test.ts`, `single-engine.test.ts`, `triggers.test.ts`) **and re-freezing it** (`npm run freeze -- --packet 06 …`) — a team decision per §4.12(b), recorded in `docs/TEAM-MEETING.md`, not treated as routine; the manifest's `sha` is cleared until this lands in a commit. **Also added, opt-in, NOT adopted as default:** an `ELAPSED_CLASSIFICATION` env var (default `MISSED`) whose `COMPLETED` alternative marks an elapsed occurrence complete in place instead — a genuine candidate for relaxing FR-RSC-01 in a **future release**, recorded as **OPEN-38** rather than built now (§6: no Conditional work is undertaken); and an optional background sweep timer (`SWEEP_INTERVAL_MINUTES`), which FR-RSC-10 already explicitly permits. **New, ad hoc, explicitly NOT an SRS requirement**: clicking a workout or meal card on the wellness view now opens the Add Task form pre-filled from it — a second, user-driven scheduling path alongside FR-REC-04's automatic one, backed by a new `WorkoutSelectionStore` (`server/src/db/WorkoutSelectionStore.ts`) that persists which card was last clicked per date as a pure display preference. **Also**: the "Rescheduled" panel split into "Rescheduled" (done) and "Needs Rescheduling" (still needs the user to act), a task-type color legend was added above the timeline, and the "Unplaced" section's filter was narrowed to flexible tasks only — a fixed commitment newly classified `MISSED` by fix (1) above was briefly rendering there too, which is wrong: "no valid slot found" describes an engine failure a fixed commitment (never engine-placed) cannot have. `npm run verify` **507 green**, all 8 freeze entries verified by hash, engine 100%, all guards green. ⚠️ **No new automated test coverage for the wellness click-to-schedule feature, the `WorkoutSelectionStore`, the background sweep, or the `ELAPSED_CLASSIFICATION=COMPLETED` path** — consistent with this branch's established practice of ad hoc frontend work going unverified by the suite, but the two SRS-level corrections above (FR-RSC-01, §3.8.5 rule 2) ARE pinned, in the re-frozen packet 06. Full account: `docs/TEAM-MEETING.md` decision log, 30 Jul; `docs/SRS-v2.md` v2.39/v2.40, Appendix C OPEN-38.

> ⚠️ **30 Jul (earlier): `wp-frontend-jul29-followups` (off `dev`) unifies Reschedule for FIXED and FLEXIBLE tasks, adds undo-completion, and rejects FIXED/FIXED scheduling conflicts.** Ad hoc work requested directly by the module's owner, not a packet. **Reschedule**: one `POST /tasks/:id/reschedule` replaces the old split (candidate-list for FLEXIBLE, direct restate for FIXED) — every task field is editable, not just the time; the old occurrence is retired as history (DR-06) rather than overwritten, so a new **"Rescheduled"** panel (replacing "Missed") can show old-time → new-time for every retirement (miss, skip, or either reschedule path). **Undo-completion**: `RescheduleService.onCompletionUndone` + `POST /tasks/:id/undo-completion` reverts a mistaken "complete" click to `MISSED`, re-placed exactly as a real miss — the one deliberate exception to FR-RSC-07's "never," gated on the user's own explicit correction. **FIXED/FIXED conflict rejection**: FR-CAL-03 already forbade displacing a fixed commitment to resolve a conflict, but nothing stopped a NEW one from landing directly on an existing one (or a `COMPLETED` occurrence) — now a 409, at both creation and reschedule. **Two bugs found by manually driving the app in a real browser before commit** (not caught by `npm run verify` alone): `allTasksForDate` matched a task to a day by `intendedDate`/`recurrence` only, so a rescheduled task's title rendered `"(task unavailable)"` on whichever side of the move wasn't its `intendedDate` — fixed by unioning in any task with a real placement on the date; reschedule left `intendedDate` unchanged, so the ORIGINAL date's sweep (FR-RSC-05) re-placed the task there too, a duplicate "ghost" occurrence — fixed by keeping `intendedDate` in sync with the new date. **Also removed the wellness view's "Last 7 days" panel at the requirement owner's request — FR-WEL-04 (Essential, D) is consequently NOT satisfied**, flagged and recorded (SRS v2.38, OPEN-37) rather than left silent, per §0. `npm run verify` **507 green**, all 8 freeze entries intact, engine 100%, all guards green, no frozen file touched. Two commits (reschedule/overlap/undo-completion; wellness panel removal, kept separate as unrelated per §8.4), pushed to `origin/wp-frontend-jul29-followups`. Full account: `docs/TEAM-MEETING.md` decision log, 30 Jul.

---

> ⚠️ **28 Jul: a metric-validation fix is IN THE WORKING TREE, UNCOMMITTED AND ON `dev` — it needs a branch (§8.5) before it is committed.** Found by a wiring audit against a running server, not by a failing test: **`POST /wearable/metrics` validated only the envelope**, so `{"sleepScore": 40}` — a bare number where the `Metric` union belongs — was accepted with a `204`, stored, and read back as **`isAvailable: false`**, i.e. indistinguishable from a metric that was never recorded. That is the absent-vs-measured-zero collapse **FR-WER-06 / NFR-ROB-01** exist to prevent, at the one layer where the union buys nothing (the body arrives as `unknown`). Fixed by `validateDailyMetricSet` in `server/src/api/validation.ts` + the route, with `server/test/api/metricValidation.test.ts` (**15 tests, 10 watched to fail against the pre-fix source**). ✅ **The Garmin CLI posts to this same route, so a dedicated test replays `GarminExportAdapter.toMetricSets()` over the *derived* fixture and asserts every set still returns `204`** — including the unscored night, the case a naive "always require a value" rule would break. `npm run verify` **498 green**, 8 freeze entries intact, engine 100%, four (I) guards green, contract untouched. **Files: 2 `src` + 1 new test + these docs. Nothing frozen was touched.** *(Reasoning and the two rejected alternatives: `docs/TEAM-MEETING.md` decision log, 28 Jul.)* ⚠️ **This does not re-open tracking** — it is a completed fix awaiting a human's commit, not a work item.

---

> ✅ **The 27 Jul "RYAN — READ THIS FIRST" block has been DELETED because it was fully worked through, exactly as it instructed.** For the record, all four of its items landed on 28 Jul: the **OPEN-32** fixes (the `asOf` denominator, the weekly-gap test, the seeded property test, and the freeze at `3fd6371`), the **`wp-14a` merge**, **OPEN-33** (the Garmin ingestion CLI, run against the real export — **FR-WER-10 demonstrated**), and the **OPEN-29** FYI, which required no work. *(Kept as a single line rather than removed outright, so a reader who remembers the block can see it was completed rather than dropped.)*

---

> ⛔ **27 Jul (latest): OPEN-33 — THE GARMIN EXPORT HAS NO INGESTION PATH, and it has never been tracked as work anywhere.** `GarminExportAdapter` is referenced **nowhere outside `server/src/wearable/`** on any branch — no route, no CLI, no script. It parses the real export and is frozen-tested (packet 08, `1199d80`), and **nothing calls it.** **FR-WER-08, FR-WER-09 and FR-WER-10 therefore have no live path** — and FR-WER-10 *(a real metric from a real device driving a real recommendation)* **was the midpoint gate.** ⚠️ **OPEN-30/packet 17d does NOT close this**: 17d gives FR-WER-07 an *injection* route, which is synthetic by design — FR-WER-10 exists precisely so the injection path cannot be mistaken for satisfying it. The pieces exist (`MetricStore.ingest` already upserts on `(userId, date, name)`); **what is missing is the thing that reads the export file and connects them.** ⛔ **§8.4 — the export is a teammate's real health data and must not enter the repo**; read a local path or an upload, fixtures stay *derived*. ✅ **OWNERSHIP SETTLED 27 Jul — RYAN, all of it**, on every axis: the adapter is his (08), the route is his (`POST /wearable/metrics`, 14a), and the export is his own health data on his own machine, which is also why nobody else can run it. **The work is a ~60-line standalone Node script**: read the two export files from a local path passed as an argument, build `GarminExport { activity, sleep }`, `toMetricSets()`, POST each day to the existing route. ⛔ **No new route, no browser upload page** (both rejected on the record — surface area vs. legibility, four days out, for something that runs once), and ⛔ **do not write straight to Mongo.** ✅ **FR-WER-09 needs no work** — `MetricStore.ingest` already upserts idempotently and is tested. ⚠️ **Needs `wp-14a` merged**; ⚠️ **query a 2023–24 date** (the export has no 2026 sleep score); ✅ **NOT blocked by 17d** — FR-WER-10 needs a real metric to *drive a decision*, which `GET /wellness` already does; 17d is what makes it become a *task* (FR-REC-04). The build order (08 → 09 → 10 → OPEN-04 → 11 → 14/15) never included this, which is how it stayed invisible.
>
> ✅ **27 Jul: PACKET 16b IS RUN — NFR-MNT-07 is now satisfied for ALL FOUR (I) requirements, and this is the first guard in the project that was a real check which found nothing.** New `scripts/guard-offline-recommendation.mjs` (**FR-LIB-02**) and `scripts/guard-metric-extensibility.mjs` (**FR-REC-11 / FR-WER-04 / NFR-MNT-06**), both in `verify` and `ci.yml`; the duplicated 46-line lexer extracted to `scripts/lib/strip-code.mjs`. `npm run verify` **453 green, test count unchanged** (guards add no tests), engine 100%, seven freeze entries intact. **Fourteen must-fail transcripts where eleven were required; no violation found anywhere**, including on `wp-14a` and `wp-15` (validated read-only via worktrees) — ⚠️ **and those passes were checked for VACUITY, not just reported green**: an injected metric name in `wp-14a`'s wellness read surface was proven to fire. **The extensibility guard DERIVES its metric names and `Decision` kinds from source at run time** and was demonstrated self-maintaining — a temporary third rule declaring `stressLevel` was policed with **zero script edits** — and its derivation **fails loudly** rather than falling back to a hard-coded list. ✅ **Escalation ratified: `strip-code.mjs` exports a second function `stripComments()`**, because 16b's guards match on **import specifiers and metric-name literals, which ARE string bodies** that the verbatim lexer blanks — without it both guards exit 0 enforcing nothing. **The verbatim rule was NOT broken** (byte-compared against `dev`: character-identical). ⚠️ **One report claim corrected: the invariant `stripCommentsAndStrings(stripComments(src)) === stripCommentsAndStrings(src)` proves the new function does not CORRUPT the code view, not that it removes comments — it holds for the identity function too (tested).** The real evidence is behavioural: the DR-05 comments in `MetricStore.ts`/`contract.ts` proven silent. ⚠️ **The 16b packet had a defect and is corrected**: it claimed a source URL in `server/src/catalog/attribution.ts`; there is none (it is in a `.md`). **Report: `docs/P16B-REPORT.md`, with the owner's ratification at §13.**
>
> ⛔ **27 Jul: packet 17d RESCOPED after reading `wp-14a` — and `wp-14a` is now a HARD PREREQUISITE, not a footnote.** Ryan's unmerged branch already has **`POST /wearable/metrics`** (FR-WER-07's injection — 17d's `POST /metrics` was a duplicate), **`GET /wellness`** (the tier, FR-REC-13's reason, FR-REC-03's options, the calorie target — 17d's `GET /recommendations` was a duplicate), **the `MetricStore`/`WorkoutCatalog`/`MealCatalog` wiring in `index.ts`** (most of 17d's composition root), and **`baselineCalories` captured at registration** (17d's escalation clause had guessed at this). All cut or resolved; **`GET /wellness` also already answers 17d's open design question — it builds the engine per request from the loaded user**, because `CaloriesToTargetRule` needs *that* user's baseline. **What survives is the load-bearing part, and no branch has it:** `grep -rn "new RecommendationScheduler" server/src` **returns nothing anywhere** — so the `WorkoutSource` port + **required** `Catalog` alias + adapter (OPEN-28), the scheduler factory, **`POST /recommendations/apply-workout`**, and the §6 transcript. **`GET /wellness` reads and deliberately does not apply; FR-REC-02/03/04 live in applying.** ⛔ **17d STOPS if `wp-14a` is not on `dev`** (both edit `index.ts` and `app.ts`), and ⛔ **must not add `GET /recommendations`.** ⚠️ **Naming collision flagged in the packet:** `index.ts` already imports `Catalog` from `./catalog/Catalog` — import one aliased; **deleting the alias reddens a frozen suite.**
>
> ⛔ **27 Jul: OPEN-30 — the recommendation path is wired into NOTHING, and packet 17d now goes first.** `server/src/index.ts` composes only users/tasks/clock/reschedule/auth; `MetricStore`, both catalogs, `RecommendationEngine`, both rules and `RecommendationScheduler` are constructed **nowhere outside tests**; `app.ts` has **no metric route and no recommendation route**. **So §6's demonstration cannot be run on the running System** — only inside the acceptance suite. Hits **FR-WER-07** (Essential (D), and *untracked until today*), **FR-WER-10**, **FR-REC-04** and §6. **`prompts/verification/17d-wire-recommendation-path.md` is authored, not run**: composition root, three authenticated routes (`POST /metrics`, `GET /recommendations`, `POST /recommendations/apply-workout`), transport-only tests, and **a Definition of Done requiring a §6 transcript against the running server — a green suite does not close it.** **OPEN-28 rides along and its original instruction was impossible** (widening the port breaks frozen `8809158`): the port is renamed **`WorkoutSource`**, `Catalog` stays as a **required** alias, and packet 11's catalog is **adapted**. ⚠️ **FR-LIB-08's relaxation report is not surfaced — recorded as a gap.** ⚠️ **§6's calorie half needs `wp-14a` merged.** **16b is unchanged and still authored — it simply runs second.**
>
> **27 Jul: packet 16b is AUTHORED, not run** — `prompts/verification/16b-guards-network-extensibility.md` on `wp-16b-guards` (off `dev`, nothing committed). The last two (I) requirements — **FR-LIB-02** and **FR-REC-11**, plus **FR-WER-04 / NFR-MNT-06** — get executable guards, closing NFR-MNT-07 for all four. Unblocked by 10 and 11 both being on `dev`. It specifies two new scripts (`guard-offline-recommendation.mjs`, `guard-metric-extensibility.mjs`), seven checks, a **must-fail proof for every one of them plus the four documented false-positive cases**, and read-only validation against `origin/wp-14a-wellness-backend` and `origin/wp-15-analytics` — where the dashboard, one of FR-WER-04's five named surfaces, actually lives. ✅ **OPEN-29 raised and closed the same day — SRS v2.32**: a two-series wellness chart is **presentation**, so the **dashboard is removed** from FR-WER-04's protected surfaces (and from FR-REC-11's verification clause), and the guard does not scan `web/src/**` — *because the requirement makes no claim there*, which the script header must state. ⚠️ **Its justification was corrected the same day (SRS v2.34)** — v2.32's *"a view is not obliged to display it"* contradicts **FR-WEL-01**, which requires the current date's metrics rendered generically and is verified by **(D)**. **The view layer sits outside FR-WER-04 because that obligation is FR-WEL-01's, not because it is absent — and `WellnessView.tsx` already complies**, its literal metric names belonging to the **FR-WEL-04** seven-day chart, a requirement that names both metrics itself. **Outcome, guard scope and "no work for Ryan" all unchanged.** ⚠️ **`server/src/api/**` stays in scope.** ⚠️ **`wp-15-analytics` already claimed v2.31, so this took v2.32.** ⚠️ **§4.12(a) corrected the same day (SRS v2.33)** — it claimed all of `scripts/` is transcribed verbatim, which 16a already contradicted. **Two routes now: transcription, or generation from a human-authored spec with every check watched to fail.** 16b also **extracts the duplicated `stripCommentsAndStrings` into `scripts/lib/strip-code.mjs`** (verbatim; the two copies were verified identical) and **re-proves 16a's four checks after the move — eleven must-fail transcripts in total.** **Next for 16b: Patrick reads the packet, then runs it in a FRESH session** (this one has read the code it guards) — **but after 17d**, per the re-order above. **Also on `dev` since 27 Jul: packet 11** (RED `4b1fd4e` + GREEN `a40d46d`) — the catalog and seeded workout/meal libraries, `npm run verify` **453 green**, OPEN-04 closed.
>
> **26 Jul: packet 17c GREEN — OPEN-27 fixed, the replacement is now durable — on `wp-open27-replacement-durability` (off `dev`).** The frozen 17c durability test (`server/test/replacement/`, frozen `47bb301`) is GREEN. Three changes, **zero test files touched**: **(1)** `SUPERSEDED` added to `PlacementStatus` in `shared/src/contract.ts` — the human-authored amendment transcribed **verbatim** (§4.7); **(2)** `RecommendationScheduler.applyWorkoutRecommendation` vacates the replaced above-tier run as `SUPERSEDED` (not `CANCELLED`); **(3)** `RescheduleService.sweepElapsed` excludes a task whose date-occurrence is `SUPERSEDED` from FR-RSC-05's re-attempt branch, so the replaced run no longer resurrects across two idempotent sweeps (FR-RSC-06). `SUPERSEDED` stays out of `OCCUPIES_TIME`, so it frees the slot for the recovery exactly as `CANCELLED` did. FR-RSC-03 held (`guard:single-placement` green, no second placement fn); `npm run verify` **319 green** (318 + the 17c test), engine 100%; `git diff` of every frozen dir (04/06/08/09/17a/17c) empty. Other `PlacementStatus` consumers checked, unchanged (`app.ts` `OCCUPYING`/`EXPORTABLE_STATUSES`, `TaskRepository.plannedDatesForTask`, `OccurrenceBlock.tsx`). **SRS → v2.28** (§3.6 note + §3.8.5 rule 4 + §5/DR-06). **OPEN-27 CLOSED.** ✅ **Merged to `dev` and pushed to `origin`.** Report: `docs/P17C-GREEN-REPORT.md`; decision-log row: `docs/TEAM-MEETING.md`, 26 Jul. **With 17b's wiring now durable across a retrieval, FR-REC-04/FR-REC-02 are demo-safe** (still (D) — clears when shown on the real §6 run with packet 11's real catalog).
>
> **26 Jul (later): packet 17b GREEN — the FR-REC-04 wiring — is done and committed on `wp-17-acceptance`.** `RecommendationScheduler` turns a recommendation into a `SYSTEM`/`WORKOUT`/`FLEXIBLE` task, places it via the injected engine (FR-RSC-03 held), and the existing `RescheduleService` defends it. Acceptance **8/8**, `npm run verify` **318 green**, engine 100%, diff 4 `src` / 0 test files. **OPEN-24 closed.** ⚠️ **NOT pushed/merged.** ⚠️ **OPEN-27 (demo-blocking):** the replaced workout resurrects on the next sweep — the replacement isn't durable; fix before rehearsals. ⚠️ `source?` added to `TaskRepository.createTask` (Miguel's `db/` — heads-up). **FR-REC-04's wiring is tested; the replacement is NOT yet demo-safe, so it is not (D)-demonstrated.**
>
> **26 Jul (earlier): packet 17a (the acceptance suite — FR-REC-04 + the §6 demonstration) is authored, RED-run, self-gated, frozen, and committed on `wp-17-acceptance` (off `dev`). NOT merged.** Suite `server/test/acceptance/` (8 tests) fails 6/8 — 5 §6-spine tests at the throwing `RecommendationScheduler` wiring stub (`server/src/recommendation/RecommendationScheduler.ts`), 1 (OPEN-24) at an honest-reason assertion against existing code; the 2 passing are OPEN-22(2) regression guards. Frozen hash-only (no commit sha yet; backfills at the RED freeze commit). SRS → **v2.27** (§3.6 ratifies `RecommendationScheduler`; §6 amended so the withdrawal is demonstrated on a *miss*, per FR-RSC-09). **OPEN-22 closed** (pinned); **OPEN-24 pinned RED, fix is 17b's**. All four prior freeze guards + single-placement + engine-purity green; typecheck/lint clean; contract untouched. ⚠️ **This is a RED branch — `npm run verify` fails by design** (the acceptance suite is red); it carries 17b GREEN too and the pair merges green (§8.5). **Next: Patrick's commit of the RED freeze, then 17b (the wiring).** Report: `docs/P17A-RED-REPORT.md`; decision-log row: `docs/TEAM-MEETING.md`, 26 Jul.
>
> **25 Jul: the wearable → recommendation chain (Ryan) is on `dev` and pushed to `origin`.** Packet **08** (Garmin adapter + Daily Metric Set), **09 RED** (recommendation rules, frozen at `59f4e8a`) and **10 GREEN** (`SleepToIntensityRule`, `CaloriesToTargetRule`, and a content-agnostic `RecommendationEngine` in `server/src/recommendation/`) all merged. Contract → **v2.26** (`Recommendation`/`Decision`/`CalorieTarget`/`RecommendationReason`, realizing the recommendation-output types the §3.6 class diagram already named). `npm run verify` on `dev`: **294 tests green**, engine 100%, four freeze suites (P04/P06/P08/P09) unchanged. ⚠️ **FR-WER-10 is code-complete** — a real Garmin metric → adapter → `DailyMetricSet` → rule → recommendation is a complete, tested path — **but it is (D)/demonstrated**, so it clears when that path is *shown* running on the real export, not by a passing unit suite. **FR-REC-04 (the load-bearing recommendation → task → engine-placement wiring) is untouched and remains Patrick's packet 17.** The P08 freeze provenance `sha` was corrected `40a3447` → `1199d80` (a provenance correction, not a re-freeze — §4.12; ⚠️ **Patrick to confirm as convention owner**). **Ryan's queue: OPEN-04 → packet 11 (libraries) → packets 14/15.** Decision-log rows: `docs/TEAM-MEETING.md`, 25 Jul.
>
> **24 Jul: `wp-replay-guards` (§4.12's reproducibility work) and `wp-13-frontend-dashboard` (packets 12/13 plus a cleanup pass, OPEN-25, OPEN-17) both merged to `dev` today**, in that order — the first cleanly, the second with conflicts confined to `CLAUDE.md`/`docs/TEAM-MEETING.md`/`docs/SRS-v2.md`'s narrative text and zero code conflicts. `npm run verify` on `dev` post-merge: **243 tests green**, both freeze entries verified by digest (the hash-based freeze from §4.12), engine still 100% coverage. **Packet 16a (the FR-RSC-03 + FR-SCH-05 executable guards) is now merged to `dev` too** — both guards run in `verify` and CI, re-validated clean against `dev` with 12/13 present, and `ci.yml` gained the previously-missing `guard:tests-frozen` step plus `fetch-depth: 0`; one Check C false positive on `wp-13`'s `placeTask` was narrowed by the owner (`docs/P16A-REPORT.md`). Test count unchanged at 243.

**Documents:** **SRS v2.21** complete and internally consistent — cover page, annotated TOC, formal use cases, UML diagrams, wireframes, ~84 verifiable requirements, traceability matrix, sign-off page. Development method written down (`docs/AGENTIC-TDD-WORKFLOW.md`); the reproducibility method (hash-based test freeze, `npm run freeze`, packet 02b, `docs/REPLAY.md`) is now on `dev` too (§4.12). Roles assigned. Contract amended against SRS v2.5 before first use.

**Code — this is the honest picture.** Committed to `dev`: packets **01–02** (workspace scaffold, toolchain, CI gates), **03** (`shared/src/contract.ts`, the domain contract), **04 RED** (30 engine tests, **frozen at `ac06e70`**, escalations in `docs/P04-RED-REPORT.md`), **05 GREEN** (`engine/src/index.ts` — `findCandidateSlots`, all 30 green), **06/07** (the reschedule service — 154 tests, frozen and re-frozen at `c30e784`, `RescheduleService` at `server/src/reschedule/`, all green). **On `wp-12-backend-api`, pushed, NOT yet merged to `dev`:** packet 12 in full — `server/src/db/` (`UserStore`, `TaskRepository` over Mongo) and `server/src/api/` (auth, `SystemClock`, the Express app, including the UC-02/UC-03 creation flow above), report at `docs/P12-REPORT.md`. `npm run verify` on that branch: **241 tests green**, both freeze guards intact, engine still at 100% coverage. Reconciled with `origin/dev` (OPEN-23, closed) as of the prior refresh. **On `wp-13-frontend-dashboard`, off `wp-12-backend-api`, pushed, NOT yet merged to `dev` or to `wp-12-backend-api`:** packet 13 in full — `web/` is a working Vite + React + TypeScript app (`web/src/`: `App.tsx`, `api/client.ts`, `components/{AuthScreen,ScheduleView,OccurrenceBlock,TaskForm,CandidatePicker}.tsx`), report at `docs/P13-REPORT.md`. Two additive corrections to `server/src/api/app.ts` came with it (auth responses now carry `wakeMinute`/`sleepMinute`; new `GET /user/me`) — see the decision log. `npm run verify`: still **241 tests green**, both freeze guards intact, engine still at 100% coverage. **A local `server/.env` now exists** (gitignored, never committed) — it briefly pointed at a real standalone `mongod` (the binary `mongodb-memory-server` already caches locally), then was switched the same day to **MongoDB Atlas** (a cloud cluster) once Miguel added credentials, since a locally-run `mongod` process wasn't wanted. Either way this is the first time this project's server has run against a persistent (non-`mongodb-memory-server`) Mongo. **Confirmed in an actual browser: register → login round-tripped through the real Express app to Mongo, reachable at `http://localhost:5173/` via Vite's dev proxy — done first against the local `mongod`, re-confirmed via a `curl` register/delete round trip once Atlas was live. Confirmed by `curl` against the running server, not in a browser: the full UC-02/UC-03/complete/skip flow and every `rescheduleTrigger` presence/absence case.** No component's actual rendered output was observed — see `docs/P13-REPORT.md`'s "Verification" section for the precise line between what was and wasn't checked. **Packet 14/15 (the wellness/analytics views) are Ryan's, per OPEN-09 (agreed 23 Jul).** **On `wp-cal-export`, off `dev`, pushed, NOT yet merged:** FR-CAL-07 (the `.ics` export) — `server/src/calendar/ics.ts`, `TaskRepository.placementsInRange`/`getTasksByIds`, `GET /schedule/export`, and an "Export .ics" button in `ScheduleView`. Started deliberately ahead of the documented sequencing (see the 24 Jul decision-log row for the reasoning) — this is the "something else" that came up. `npm run verify`: **263 tests green**, engine still 100%. Verified live via `curl` against the running dev server; **not** verified by an actual calendar-app import (FR-CAL-07's own verification line), which is flagged rather than assumed.

**⚠️ Two things a new session must not be misled by:**
- **The 12 Jul dated schedule in `docs/TEAM-MEETING.md` is SUPERSEDED and marked as such.** It had the engine property-tested by 15 Jul and the FR-WER-10 midpoint gate cleared on the 16th; neither happened. **The team abandoned per-day deadlines on 22 Jul and now sequences work by dependency.** **31 July (presentation) is unchanged and is the only hard date.**
- ✅ **OPEN-01 is CLOSED (22 Jul) — Ryan pulled and read the real Garmin export, and OPEN-02 closed with it.** Both metrics exist as **published** fields: **`activeKilocalories`** (`DI-Connect-Aggregator/UDSFile_*.json`) and **`sleepScores.overallScore`**, an integer 0–100 (`DI-Connect-Wellness/…_sleepData.json`), joined on `calendarDate` (`"YYYY-MM-DD"`, already the contract's `IsoDate`). **No sleep-score derivation formula is needed. Ryan's chain (08 → 09 → 10) is unblocked.** Three things a new session must carry forward: **(1)** ⚠️ **no 2026 sleep score exists anywhere in the export** — the sleep rule is demonstrated on the **20-day 2023–24 overlap** and the calorie rule on 2026 data; this mixed vintage is a recorded decision, not an oversight, and **FR-WER-10 requires the metric be real, not recent**; **(2)** **OPEN-20 is open** — `activeKilocalories: 0.0` means *unavailable* on a day the watch was not worn and *a measured zero* on a day it was, and the discriminator (presence of `totalSteps`) is a **team decision stated in packet 08**, never something an agent infers; **(3)** ⛔ **`bmrKilocalories` and the height/weight/VO2Max profile are in the export and must not be used to derive a calorie baseline** — CON-05 and §4.9 require the System to **ask** (FR-REC-09). They are the most tempting trap in the file. *(Still open and independent of the export: **OPEN-04**, the exercise dataset and the meal library's calorie counts.)*

### The build order — by dependency, not by date

**Authoritative copy: `docs/TEAM-MEETING.md` → "THE BUILD ORDER".** Summarised here because this is the file that loads automatically.

| Owner | Queue, in order |
|---|---|
| **Patrick** | ✅ 04 RED → gate → freeze → ✅ 05 GREEN → ✅ 06 → gate → ✅ 07 GREEN → ✅ **16a** → ✅ **17a RED** → ✅ **17b GREEN** → ✅ **17c** (OPEN-27) → ✅ **16b** *(27 Jul — NFR-MNT-07 closed for all four (I) requirements; 14 must-fail transcripts, no violation found; `docs/P16B-REPORT.md`)* → ✅ **17d — THE PATH IS WIRED INTO THE APP** *(28 Jul — OPEN-30 + OPEN-28 closed; §6 run against the running server; `verify` 483 green; `docs/P17D-REPORT.md`)* — committed `bb82f18`, merged `ba35195`, pushed. ✅ **Queue empty. Nothing is tracked** (see the note at the top of this file: `main` promotion, rehearsals and OPEN-10 were dropped from tracking on 28 Jul). |
| **Ryan** | ✅ OPEN-01 → ✅ 08 adapter + Daily Metric Set → ✅ 09 RED → ✅ **10 GREEN** → ✅ **OPEN-04** → ✅ **11 libraries** → ✅ **14a/14b** (wellness backend + view) → ✅ **15a RED / 15b GREEN / 15c view** (analytics) → ✅ **OPEN-32** (all four fixes; suite frozen `3fd6371`) → ✅ **OPEN-33 — the Garmin ingestion CLI, RUN AGAINST THE REAL EXPORT.** 50 real metric sets ingested; real sleep scores → tiers (14/40/37 → LOW, 76/83 → HIGH), real active calories → targets. **FR-WER-10 — the midpoint gate — is DEMONSTRATED.** ⛔ §8.4 honored: real health data stayed in a scratchpad and was deleted. **Queue empty.** |
| **Miguel** | ✅ 12 backend (`docs/P12-REPORT.md`) → ✅ 13 dashboard (`docs/P13-REPORT.md`) → ✅ 13b (month navigator, theme, cleanup) → ✅ **FR-CAL-07** (`.ics` export). Queue ended at 13 per OPEN-09 (agreed 23 Jul). **Queue empty.** |

**Cross-person blocks — the only ones:** every RED gate needs **a second human**; packet **16** waits on **07 and 10**; **FR-REC-04** needs **05 + 10 + 12**; packet **17** waits on everything.

**Each owner authors their own packet immediately before running it** (§4.11). Authoring is the first half of the work item, not batchable overhead.

**✅ OPEN-09, the workload rebalance — CLOSED 23 Jul.** Ryan's queue empties after packet 11; Miguel had the backend plus three views alone. The original fix (*Patrick takes the backend*) is dead — 06/07/16/17a/17b fill his queue. **Direction set 22 Jul, agreed 23 Jul: Ryan takes views 14 and 15; Miguel keeps 12 and the Core dashboard (13).** Miguel's queue now ends at packet 13.

---

## 10. If You're an AI Picking This Up

- **§0 is not optional.** When something is decided or changed, **write it into the files** — the documents are the project's memory, your context window isn't.
- **The SRS (`docs/SRS-v2.md`) is the spec.** It is unusually complete and is a better prompt corpus than most projects have. Use it.
- **⛔ If someone pastes implementation code and wants it in a packet, warn them first — §0.1.** It silently voids NFR-MNT-01's coverage figure and NFR-COR-01's property test. The ask is usually legitimate; §0.1 has the correct route for each version of it.
- **Do not commit unless a human asks you to**, and when you do, follow §8 exactly — including **no AI credit lines of any kind.**
- **Check §4 above before suggesting an architecture change.** Several natural-seeming ideas (call a recipe API, use the Garmin Health API, build a rescheduling engine) are already rejected, with reasons.
- **The timeline is real.** Prefer the boring option that ships. Flag scope risk early rather than discovering it late.
- **Don't gold-plate the scheduler.** Priority displacement is fascinating and out of scope.
- **Say what's actually true.** If tests fail, say so. If something was skipped, say that. On a 19-day project, a comfortable inaccuracy costs more than an uncomfortable fact.
