# Project Context — Adaptive Habit, Schedule & Wellness System

> **Read this first.** It exists so a new AI session — or a new teammate — can get up to speed without re-deriving decisions that are already made. If you are an AI assistant, this file is loaded automatically; **read the "Decisions Already Made" section before proposing anything**, because several obvious-seeming suggestions have already been considered and rejected for reasons that still hold.

**Last updated:** 22 July 2026 *(**§8.5 — nothing is committed directly to `dev`**: all work goes on a branch off `dev` and merges only after `npm run verify` passes and its owner is satisfied. **§9 refreshed against the repo** — packets **01–05** are committed: the engine exists, its 30 tests are frozen at `ac06e70`, and **packet 06 is authored and next to run**. SRS is at **v2.13** — four gaps found while authoring packet 06 were **all closed before it runs**: `Task.createdAt` gives FR-SCH-10's tiebreak a field to read (OPEN-15); an automatic reschedule takes the engine's **rank-1** candidate; an unplaceable task is the **absence of a placement** with an actionable next-day offer; and FR-RSC-06's idempotency is a property of the **occurrence's state**, not a trigger log (OPEN-16, all parts). The build order is by **dependency, not date**. **Per-day deadlines abandoned 22 Jul; 31 July is the only hard date.** Earlier: §0.1 — never let generated code enter a prompt. §8 — git and commit conventions. §4.10 — missed tasks are inferred and the inference is correctable. §4.11 — prompt-pack format. §3 — the documents moved into the repo.)*

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

## 5. The Load-Bearing Requirement

**FR-REC-04** — *a recommended workout is created as a task and placed by the same engine, subject to the same conflict detection and rescheduling as any user-created task.*

This is what makes the project **one integrated system** rather than a scheduler and a fitness app sharing a login. **If everything else shipped and FR-REC-04 did not, the project would have failed at its own thesis while appearing complete.** Protect it above all else; if the schedule forces a cut, cut anything else first.

---

## 6. Scope Discipline

The SRS classifies every requirement **Essential / Conditional / Optional** (IEEE 830 §4.3.4). **Only Essential requirements are conditions of acceptance.**

§2.7.1 of the SRS defines the **Core Demonstrable Capability** — the irreducible set carrying the System's central claim. **Nothing in the Core may be cut.**

**Already demoted to Conditional for schedule reasons:** FR-REC-10 (weekly meal plan + prep windows) and NFR-MNT-02 (70% whole-system coverage). NFR-MNT-01 (**90% coverage on the engine**) remains Essential — the engine is where correctness lives.

**Deliberately NOT started until all Essential work is verified:** FR-SCH-07/08 (priority displacement — *the most seductive way to lose a week*), FR-WER-11 (live API), FR-REC-12 (extensibility proof), FR-LIB-09 (external content API).

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
| `engine` · `adapter` · `catalog` · `api` · `frontend` | module work outside a packet — these are the SRS module seams (§7.4) |
| `guard` | an executable CI guard for an **(I)** requirement (§4.8) |
| `seed` | workout / meal library data (§4.2) |
| `srs` | changes to `docs/SRS-v2.md` |
| `docs` | any other document under `docs/` or `prompts/`, and `CLAUDE.md` |
| `chore` | tooling, dependencies, config, scaffolding |

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
  - **A branch reaches `dev` only by merge, and only once it is finished, `npm run verify` passes, and its human owner is satisfied.** **Each person decides their own work** (§7.2) — Patrick for the engine and reschedule packets, Ryan for the wearable chain, Miguel for backend and frontend. That is what makes *"pull `dev` and start working"* safe: **`dev` is only ever advanced by something that has been verified and read.**
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

## 9. Current Status (22 July 2026 — implementation started)

**Documents:** **SRS v2.13** complete and internally consistent — cover page, annotated TOC, formal use cases, UML diagrams, wireframes, ~84 verifiable requirements, traceability matrix, sign-off page. Development method written down (`docs/AGENTIC-TDD-WORKFLOW.md`). Roles assigned. Contract amended against SRS v2.5 before first use.

**Code — this is the honest picture.** Committed: packets **01–02** (workspace scaffold, toolchain, CI gates), **03** (`shared/src/contract.ts`, the domain contract), **04 RED** (30 engine tests, **frozen at `ac06e70` and registered in `scripts/frozen-tests.json`**, escalations in `docs/P04-RED-REPORT.md`), and **05 GREEN** (`engine/src/index.ts` — `findCandidateSlots`, all 30 green). **That is all.** `server/src/` and `web/src/` are **still empty.** Packet **06** was authored on 22 Jul and is the next thing that runs.

**⚠️ Two things a new session must not be misled by:**
- **The 12 Jul dated schedule in `docs/TEAM-MEETING.md` is SUPERSEDED and marked as such.** It had the engine property-tested by 15 Jul and the FR-WER-10 midpoint gate cleared on the 16th; neither happened. **The team abandoned per-day deadlines on 22 Jul and now sequences work by dependency.** **31 July (presentation) is unchanged and is the only hard date.**
- **OPEN-01 — nobody has yet looked at a real Garmin export.** It was due 16 Jul. Until it is done, the sleep-score formula (OPEN-02) and the meal library's calorie assumptions are **guesses**, and it blocks Ryan's entire chain (packets 08 → 09 → 10).

### The build order — by dependency, not by date

**Authoritative copy: `docs/TEAM-MEETING.md` → "THE BUILD ORDER".** Summarised here because this is the file that loads automatically.

| Owner | Queue, in order |
|---|---|
| **Patrick** | 04 RED → **human gate** → freeze → 05 GREEN → author 06 → gate → 07 GREEN → **16 (the (I) guards)** → 17 + FR-REC-04 wiring + rehearsals |
| **Ryan** | **OPEN-01 (blocks everything below)** → 08 adapter + Daily Metric Set → 09 RED → gate → **10 GREEN ← FR-WER-10 clears here** → OPEN-04 → 11 libraries |
| **Miguel** | 12 backend (**answers OPEN-12 in flight**) → 13 dashboard → 14/15 unless Ryan takes them |

**Cross-person blocks — the only ones:** every RED gate needs **a second human**; packet **16** waits on **07 and 10**; **FR-REC-04** needs **05 + 10 + 12**; packet **17** waits on everything.

**Each owner authors their own packet immediately before running it** (§4.11). Authoring is the first half of the work item, not batchable overhead.

**⚠️ Open and unresolved: OPEN-09, the workload rebalance.** Ryan's queue empties after packet 11; Miguel has the backend plus three views alone. The original fix (*Patrick takes the backend*) is dead — 06/07/16/17 fill his queue. **Revised proposal: Ryan takes views 14 and 15.** Not yet agreed by Ryan and Miguel.

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
