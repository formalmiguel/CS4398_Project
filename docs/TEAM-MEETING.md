# Team Meeting — Agenda, Questions, and Decision Log

**Project:** Adaptive Habit, Schedule & Wellness System
**Team:** Patrick Rucker · Miguel Alvarez · Ryan Woosley

> **How to use this file.** The top section is the agenda for the next meeting. Below it is a **permanent decision log** — every decision the team makes gets a row, with the date and the reasoning. The reasoning matters more than the decision: six months from now, and three weeks from now, the *why* is what stops you re-arguing something you already settled.

---

# 🔨 THE BUILD ORDER — *adopted 22 July 2026. This is what we are working to.*

> **⚠️ The dated schedule further down this file (“The Schedule We’re Committing To”, 12 Jul) is SUPERSEDED.** The team stopped working to per-day deadlines on 22 Jul. It is kept as a record of what was committed at Meeting 1 — **do not read it as the current plan.** The presentation date (**31 July**) is unchanged and is still the only hard date.
>
> **Order here is by dependency, not by calendar.** Each owner works their queue top to bottom and starts the next item when the one above it lands.

**Standing rules that apply to every item below** *(they are not repeated per row)*: one packet = one fresh agent session · **the owner authors their own packet before running it** (copy `prompts/_TEMPLATE.md`, quote the SRS verbatim, include the *files you must NOT touch* list) · a 🔴 RED packet and its 🟢 GREEN partner are never the same session, and **the freeze commit sits between them** · merge to `main` as each item lands (`CLAUDE.md` §7.1) · **an agent does not commit unless a human asks** (§8.5).

### Patrick Rucker — Scheduling Algorithm Lead

| # | Item | Done when |
|---|---|---|
| 1 | Run `prompts/engine/04-engine-tests-RED.md` → **human gate** (§6 of the workflow doc, with one other person) → freeze commit | Suite **fails**. A green suite means the agent wrote the engine and the packet is compromised. |
| 2 | Run `prompts/engine/05-engine-implementation-GREEN.md` | Engine coverage **≥90%** (NFR-MNT-01) · property test **≥1,000 cases** (NFR-COR-01) · `engine/package.json` dependencies block **empty** · `git diff --stat engine/test/ <RED-sha>..HEAD` **empty** |
| 3 | Author **06** (reschedule RED) → run → gate → freeze | All three triggers covered: missed (FR-RSC-01), declared skip (FR-RSC-08), displacement (FR-RSC-02) — plus the correction path (FR-RSC-09) |
| 4 | Run **07** (reschedule GREEN) | The service **re-invokes the engine**. No second placement function anywhere (FR-RSC-03). |
| 5 | Author + run **16** — the **(I)** guards. **Blocked by 07 and 10**, which are what it guards. | Executable CI guards for FR-RSC-03, FR-LIB-02, FR-SCH-05, FR-REC-11 |
| 6 | Author **17**; wire **FR-REC-04**; integration; **≥3 full demo rehearsals** | The demo sequence below runs end to end **with the network disabled** |

### Ryan Woosley — Data & Wearable Integration Lead

| # | Item | Done when |
|---|---|---|
| 1 | ⚠️ **OPEN-01 — pull the Garmin export and read the actual field names.** **Blocks every item below it.** | We know whether there is a published **sleep score** and whether **active calories** are present. Fixtures are **derived** from it — the real export never enters the repo (§8.4). |
| 2 | Author + run **08** — adapter + Daily Metric Set | **One document per metric per date, not one field per metric** (DR-05). An absent metric and a measured zero stay distinguishable (FR-WER-06, NFR-ROB-01). |
| 3 | Author **09** (rules RED) → run → gate → freeze | Boundary values are **exactly** 49, 50, 74, 75 (FR-REC-01). An off-by-one in the test becomes a permanent green off-by-one in the code. |
| 4 | Run **10** (rules GREEN) | ✅ **FR-WER-10 clears here** — one real metric, from a real device, driving one real recommendation. This is the go/no-go the project's whole claim rests on. |
| 5 | OPEN-04 (exercise dataset + licence), then author + run **11** | Libraries seeded locally, **with calorie counts** — without them FR-REC-08 has nothing to target |
| 6 | *(Proposed — see the rebalance note below)* frontend views **14** and **15** | |

### Miguel Alvarez — Frontend & Backend Lead

| # | Item | Done when |
|---|---|---|
| 1 | Author + run **12** — accounts, tasks, commitments, persistence | **OPEN-12 answered in flight** — Miguel's call, made with the API in front of him. **Copy the ⛔ escalation block from `prompts/00-prompt-collection-summary.md` into the packet anyway**, so the packet records that the question was asked. Also: **FR-CAL-05** — an all-day commitment is *not* a busy interval, or the engine can place nothing. |
| 2 | **13** — schedule dashboard | The view the demo runs through. Complete/skip actions (FR-DSH-07) and reschedule notices. |
| 3 | **14**, **15** — *unless Ryan takes them* | |

### 🔗 Cross-person dependencies — the only places one queue blocks another

| Sync point | Needs |
|---|---|
| Gate on **04** | Patrick **+ one other person**, same day as the RED run |
| Gate on **06** | Patrick + one other |
| Gate on **09** | Ryan + one other |
| Packet **16** | **07 and 10 both landed** |
| **FR-REC-04 wiring** | **05 + 10 + 12** — the seam where the System stops being a scheduler and a fitness app sharing a login. **The load-bearing requirement; protect it above everything else.** |
| Packet **17** | everything |

### ⚠️ Still needs a yes from Ryan and Miguel

**Ryan's queue runs dry after packet 11; Miguel has the backend plus three views alone.** OPEN-09's original fix — *Patrick takes the backend after the engine* — **no longer works**, because packets 06, 07, 16 and 17 fill Patrick's queue. **The rebalance that fits: Ryan takes views 14 and 15 once his wearable chain is green.** This is a proposal until both of them agree to it. *(OPEN-09.)*

---

# ✅ MEETING 1 — 12 July 2026 — **HELD. OUTCOMES BELOW.**

## What we decided

| # | Decision |
|---|---|
| **Roles** | **Patrick Rucker → Scheduling Algorithm Lead.** **Ryan Woosley → Data & Wearable Integration Lead.** **Miguel Alvarez → Frontend & Backend Lead.** |
| **Garmin export** | **Ryan owns it.** *(Still due 16 July — see OPEN-01. Nobody has looked at the file yet.)* |
| **Database** | **MongoDB, not PostgreSQL.** |
| **Calendar** | **Not importing.** Instead we will **export an `.ics` file** the user can import into Google Calendar. |
| **Repo** | **Patrick creates it.** |
| **Working agreements** | **Agreed** — daily integration, one human owner per module who can explain it aloud, nobody merges code they haven't read. |
| **Scheduling / cadence** | Each member manages their own working schedule; no fixed standup. |

## ⚠️ Still open after Meeting 1 — carry to Meeting 2

- [ ] **Scope cuts were NOT ratified** — the team didn't recall what they were. **They are re-stated below. Confirm them.**
- [ ] **FR-REC-04** — did everyone confirm they understand why it's untouchable?
- [ ] **Workload imbalance** — Miguel has frontend **and** backend. See the risk note below. **This needs 10 minutes.**
- [ ] Who owns the demo environment (making sure it actually runs on 31 July)?
- [ ] Demo rehearsal dates (SRS assumes ≥3 full run-throughs, 28–30 July)?
- [ ] Availability during graduation week — anyone with conflicts?
- [ ] Questions for the professor (see below).

---

## 🔁 THE SCOPE CUTS — *re-stated, still needing ratification*

Two requirements were demoted from **Essential** to **Conditional** to protect the 31 July date:

| Requirement | What it is | Why it's safe to cut |
|---|---|---|
| **FR-REC-10** | The **weekly** meal plan, with meal-prep windows placed on the schedule | **FR-REC-08 stays Essential** — active calories drive a daily calorie target, and meals are recommended against it. **That is the adaptive claim.** Weekly *planning* just rides on top of it. |
| **NFR-MNT-02** | 70% test coverage across the **whole system** | Frontend coverage is expensive and reveals little. **NFR-MNT-01 stays Essential: 90% coverage on the scheduling engine** — the number that actually matters, because the engine is where correctness lives. |

**Also confirm these are NOT started until all Essential work is verified:** FR-SCH-07/08 (priority displacement), FR-WER-11 (live wearable API), FR-REC-12 (extensibility proof), FR-LIB-09 (external content API), **FR-CAL-07 (the `.ics` export)**.

- [ ] **Ratified by the team** ☐ yes ☐ objections: ______________________

---

## 🔴 RISK RAISED AFTER THE MEETING: workload imbalance

**Miguel has the frontend *and* the entire backend API.** The frontend alone was already the most likely thing to run out of time — three views, one with a calendar-style time axis. The backend API is what every other module plugs into.

Meanwhile the **scheduling engine is small and deep** — probably ~3 days — and then Patrick has spare capacity for two weeks.

**Suggested rebalance:**

| Person | Suggested |
|---|---|
| **Patrick** | Scheduling engine + rescheduling triggers → **then the backend API** |
| **Ryan** | Garmin ingest + metric adapter + recommendation rules + workout/meal libraries |
| **Miguel** | **Frontend only** — three views, starting 17 July against a mocked API |

**This is worth ten minutes.** If Miguel is the critical path and he's also the only person who can unblock everyone else, a single bad week sinks the demo.

---

## ❓ QUESTIONS FOR THE PROFESSOR

*Raised 12 July. These are course-policy questions, not technical ones, and we should not codify answers before asking.*

1. **Is AI-generated prompting acceptable**, or does he expect the human direction of agents to be human-authored?
2. **Does he expect tests to be human-written?** This one has teeth: our SRS commits to **90% engine coverage (NFR-MNT-01)** and **property-based testing of the core invariant (NFR-COR-01)**. If an agent writes both the tests and the implementation it tests, those numbers stop meaning what they appear to mean — and a software engineering professor is likely to care about that distinction.
3. Any expectation on deliverable format for the SRS (PDF? Word? page numbers in the Index)?

---
---

# MEETING 2 — *date TBD*

**Purpose:** Ratify the scope cuts, resolve the workload imbalance, review the Garmin export findings.

**Bring:** The SRS (`SRS-v2.md`). Everyone should have skimmed §1.2 (Scope), §2.7.1 (what we're cutting), and §3.3 (the use cases).

---

## ⏱ The 60-Second Status Update (say this first)

> We have a complete SRS — ~84 numbered, verifiable requirements, use cases, UML diagrams, and wireframes, written to IEEE 830-1998 and matching the format of the professor's examples. **We also have a written development method (`AGENTIC-TDD-WORKFLOW.md`) and the first three work packets ready to run (`prompts/`).**
>
> **We have 19 days until we present on 31 July, and the midpoint go/no-go gate is in FOUR.** The documents are done. **What's blocking us is three decisions, and one small piece of work nobody has done yet** — nobody has looked at a real Garmin export.

---

## 🚨 IF WE ONLY GET THROUGH FOUR THINGS TONIGHT, MAKE IT THESE

There is more agenda below than there is evening. **These four block all other work — do not leave without them.** Everything else can be settled in Slack tomorrow.

| # | The decision | Why it can't wait |
|---|---|---|
| **1** | **Roles** (Q1) | **Every work packet in `prompts/` assigns its owner by role.** Until roles exist, literally nobody can start. It is OPEN-08 and it was due today. |
| **2** | **Who pulls the Garmin export — and when** (Q4) | **The 16 July gate depends on it and it has not been started.** It is small work. It is on the critical path. It should be done before Monday. |
| **3** | **Who creates the repo, tonight or tomorrow** (Q10) | Everything downstream is blocked on packets 01–03. |
| **4** | **Ratify the scope cuts** (Q2) | The entire point of writing them down is that **nobody is surprised on 29 July.** |

**Everything else — the workflow doc, the contract, PR conventions — is *reading*, not *deciding*.** Assign it and move on.

---

## 🔴 DECISIONS WE MUST MAKE TONIGHT

These block other work. Don't leave without them.

### Q1. Who takes which role?

The SRS is built around three module boundaries so we can work in parallel without colliding. **Whoever owns a module owns its section of the SRS and must be able to explain its code aloud.**

| Role | Owns | Hardest part |
|---|---|---|
| **Scheduling Algorithm Lead** | The engine (a pure function), rescheduling triggers, the test suite | The engine **is** the grade. It's also the most testable thing in the project. |
| **Data & Wearable Integration Lead** | Garmin ingest, the metric adapter, the recommendation rules, the workout/meal libraries, the DB schema | Owns the **only external unknown** in the project (the Garmin export). |
| **Frontend & Analytics Lead** | Schedule dashboard, wellness view, analytics view | **The most likely thing to run out of time.** Three views with a calendar-style time axis is real work. |

- [ ] **Patrick Rucker →** ______________________
- [ ] **Miguel Alvarez →** ______________________
- [ ] **Ryan Woosley →** ______________________

**Ask the team:** *"Who's strongest at algorithms and testing? Who wants the frontend, knowing it's the biggest time sink? Whoever takes Data owns the one thing we can't predict."*

---

### Q2. Do we ratify the scope cuts?

I've already marked two requirements **Conditional** in the SRS to protect the timeline. **The team needs to actually agree to this out loud** — the whole point of writing it down is that nobody is surprised on 29 July.

| Requirement | Cut to Conditional | Why it's safe to cut |
|---|---|---|
| **FR-REC-10** — weekly meal plan + scheduled meal-prep windows | ☐ agree ☐ disagree | FR-REC-08 already gives us wearable-driven meal recommendations against a daily calorie target. That **is** the adaptive claim. Weekly planning rides on top of it. |
| **NFR-MNT-02** — 70% test coverage across the whole system | ☐ agree ☐ disagree | Frontend coverage is expensive and reveals little. **We keep 90% coverage on the engine** — that's the number that actually matters. |

**Also confirm we do NOT start these until everything Essential is done and verified:**
- ☐ **FR-SCH-07/08** — priority-based task displacement. *This is the most intellectually interesting thing in the project and the fastest way to lose a week we don't have.*
- ☐ **FR-WER-11** — live wearable API
- ☐ **FR-REC-12** — the extensibility proof
- ☐ **FR-LIB-09** — external recipe/exercise API

**Ask the team:** *"Does anyone object to cutting these? If we're going to fight about it, let's fight now, not on the 29th."*

---

### Q3. Does everyone understand what FR-REC-04 is, and why it's untouchable?

**FR-REC-04:** *a recommended workout is created as a task and placed by the same engine, subject to the same conflict detection and rescheduling as any user-created task.*

This is the **load-bearing requirement of the whole project.** It's what makes us one integrated system instead of a scheduler and a fitness app sharing a login.

> **If everything else shipped and FR-REC-04 didn't, we would have failed at our own thesis while appearing to have built the whole product.**

**Ask the team:** *"Can each of us say, in our own words, why cutting this would sink the project? If not, we don't understand our own thesis yet."*

- [ ] Everyone can articulate it

---

### Q4. Who pulls the Garmin export, and when? ⚠️ **CRITICAL PATH**

**Nobody has looked at a real Garmin export yet.** Until someone does:
- We don't know if it contains a **sleep score** *(needed for FR-REC-01)*
- We don't know if it contains **active calories** *(needed for FR-REC-08 — without this, the meal plan has nothing to target)*
- The sleep-score derivation formula (OPEN-02) is a **guess**
- The meal library's calorie assumptions are a **guess**

**This is small work. It is on the critical path. It should be the first thing anyone does.**

- [ ] **Owner:** ______________________  **Due: 16 July (midpoint)**

**Ask the team:** *"Whoever has the Garmin — can you export your data and just look at what fields are actually in it, before Thursday?"*

---

## 🟡 DECISIONS WE SHOULD MAKE TONIGHT

### Q5. Calendar source — Google Calendar integration, or manual entry?

**Recommendation: BOTH, layered. Manual entry is the Essential path; Google Calendar is a Conditional upgrade we build only after everything Essential is done and verified.** *(SRS: SI-05 already says exactly this. OPEN-03.)*

**Google Calendar is genuinely feasible — it does NOT have Garmin's approval problem.** You create your own Google Cloud project, enable the Calendar API, and generate OAuth credentials yourself. **No partner review, no waiting on a human.** Calendar scopes are "sensitive," which normally triggers verification — but **you skip verification entirely by leaving the app in "Testing" mode and adding our three Google accounts as test users** (cap: 100). That works the same day.

**Cost: ~1–2 days** with agentic help. The OAuth flow and `events.list` are easy, and mapping events → busy intervals is trivial **because the engine already takes busy intervals and doesn't care where they came from.**

**⚠️ Four gotchas — the last two are where time actually disappears:**

1. **Refresh tokens expire after 7 days in Testing mode.** Survivable, but if we authorize on the 20th and demo on the 31st without re-authorizing, **it will be broken on stage.** *(Verify against current Google docs.)*
2. **Pass `singleEvents=true`** so Google expands recurring events for us. Without it we're parsing RRULE ourselves — a swamp that eats weeks.
3. **All-day events are a trap.** They return a `date`, not a `dateTime`. Handled naively, a "Mom's Birthday" all-day event marks the **entire schedulable day busy and the scheduler can place nothing.** We need an explicit rule — almost certainly *"ignore all-day events; they aren't time commitments."*
4. **Timezones.** Events carry timezone info; our schedulable day is local. Get this wrong and placements land an hour off.

**The argument FOR doing it:** our original pitch claimed technical depth partly from *"working with external APIs, handling authentication and data retrieval."* **When Garmin's live API came off the critical path, we quietly lost that story.** Google Calendar restores it cheaply — a real OAuth 2.0 flow against a real third-party API is a genuinely different skill from parsing an export file, and it's the kind of thing a grader notices.

**The argument for keeping manual entry as the Essential path:** our acceptance demo currently **runs with the network disabled** — a property we engineered on purpose. We should not casually give it up. **Demo with seeded commitments; *show* the Google import as a live feature if it's working.** If campus wifi dies on the 31st, we lose a feature, not the demonstration.

**Ask the team:** *"Does anyone want to own this as a stretch goal? It's real OAuth experience and it makes the demo feel real — but it does not start until the Essential set is verified."*

- [ ] **Manual entry = the Essential path** ☐ agreed
- [ ] **Google Calendar = Conditional stretch goal** ☐ agreed ☐ skip entirely
- [ ] **If yes, owner:** ______________________  **Not started before:** ______________

### Q6. Do we ratify the tech stack?

React + TypeScript (frontend) · Node.js + TypeScript (backend) · PostgreSQL.

**Rationale:** one language across the whole stack means all three of us can read and review the entire codebase — which matters enormously on a 3-person team with 19 days. TypeScript rather than plain JavaScript because the scheduling engine is interval math over multi-field records, exactly where a type system catches bugs we'd otherwise pay for in debugging time.

- [ ] **Agreed** ☐ **Objections:** ______________________

### Q7. How we work with AI agents — **this is now written down; do not re-derive it in the room**

**Read `AGENTIC-TDD-WORKFLOW.md` before tomorrow.** It is self-contained and assumes you've seen nothing. The two sections that matter: **§2** (why — *read the code block in §2.1, it's the whole argument in one example*) and **§6** (the checklist you will personally run).

**The 90-second version, so we can all nod and move on:**

- **The SRS is the prompt.** We don't rewrite requirements — we quote them verbatim into work packets (`prompts/`).
- **The agent that writes the tests is NEVER the agent that writes the code.** Different chat session, and **the implementer may not edit a test — ever.** If it can't pass one, it stops and a human decides whether the test or the code is wrong.
- **Between them sits a human who reads the tests against the SRS.** Not *"do they pass"* — ***"are they right."*** That review is the bottleneck of this project.
- **The contract** (`shared/src/contract.ts`, ~60 lines of types) is written **once, by a human**, and everything is built against it. **Nobody's agent redefines a type.**
- **TDD is scoped, not universal.** We TDD the engine, rules, catalog, analytics. **We do NOT TDD the frontend** — and we already decided that without noticing, when we demoted NFR-MNT-02 for *"frontend coverage is expensive and reveals little."*

**Still-standing rules from before:** integrate daily · every module has **one human owner who can explain it aloud** (if nobody can, **it isn't done**, even if tests pass) · **nobody merges code they haven't read.**

**Ask the team:** *"Does anyone disagree with the test-writer / code-writer split? It's the one thing everything else hangs on."*

- [ ] All three have read the workflow doc ☐ (due 13 Jul)
- [ ] Nobody objects to the RED/GREEN split ☐

---

### Q8. ⚠️ Are we going to make the 16 July midpoint gate? **Be honest.**

**The gate is FR-WER-10: one real metric, from a real device, driving one real recommendation.** It is four days away.

The path to it is **export → adapter → Daily Metric Set → rule → decision.** Note what is *not* on that path: **the engine.** So the Data Lead **does not wait for the engine** — they start the moment the contract is ratified, in parallel.

**What has to happen, and by when:**

| | By | Who |
|---|---|---|
| Pull the Garmin export and **look at the actual fields** (OPEN-01) | **ASAP — it is small and it is blocking** | |
| Contract ratified + repo up (packets 01–03) | 13 Jul | |
| DB schema — **one row per metric per date**  (packet 08) | 15 Jul | Data Lead |
| Sleep-score → intensity rule (packets 09–10) | 15 Jul | Data Lead |

**Ask the team:** *"Is this real, or are we going to walk into the 16th and hand-wave? **If we're going to miss it, I'd rather know tonight than on Thursday.**"*

- [ ] We believe the gate is achievable ☐ yes ☐ **no — and here's what we cut:** ______________

---

### Q9. Dev logistics for agentic work — **not yet decided, and they'll bite**

- [ ] **Does everyone actually have Claude Code (or equivalent) working?** *This is a three-person agentic project. If one of us doesn't have the tool running tonight, that person is blocked and we don't find out until the 15th.*
- [ ] **Branch per work packet, PR to main?** *A packet is already one reviewable diff with one owner — it maps onto a PR exactly. And it's how we honor "nobody merges code they haven't read."*
- [ ] **Who reviews whose PRs?** *The human gate (§6) needs a second pair of eyes on the engine tests specifically.*
- [ ] **Where do the prompt files live?** *Proposal: `prompts/` goes in the repo, so packets are versioned alongside the code they produced. A grader can see exactly what we asked for.*

### Q10. Logistics

- [ ] **Who creates the repo?** ______________________
- [ ] **How often do we sync?** ______________________
- [ ] **Who owns the demo environment** (making sure it actually runs on 31 July)? ______________________
- [ ] **Demo rehearsal dates** — the SRS assumes **at least three full end-to-end rehearsals** between 28–30 July. Agreed? ______________________
- [ ] **Reality check: is everyone actually available?** It's graduation week. Who has conflicts? ______________________

---

## 📅 The Schedule We're Committing To

> **⛔ SUPERSEDED 22 July 2026 — this is a historical record, not the plan.** The team stopped working to per-day deadlines; work is now sequenced by dependency in **THE BUILD ORDER** at the top of this file. **31 July (presentation) is unchanged and is still the only hard date.** Kept here because the dates below are what was actually committed to at Meeting 1, and deleting them would erase the evidence of how far the plan moved.

| Dates | Milestone | Owner |
|---|---|---|
| **12–15 Jul** | Repo, DB schema, **scheduling engine + full test suite**. Garmin export pulled and inspected. | |
| **16 Jul — MIDPOINT** | **GO/NO-GO GATE:** engine done and property-tested; **one real Garmin metric in the database driving one real recommendation.** *(SRS: FR-WER-10)* | |
| **17–21 Jul** | Backend API, task CRUD, reschedule triggers, recommendation rules, libraries seeded. | |
| **17 Jul** | ⚠️ **Frontend starts NOW, against a mocked API.** Do not wait for the backend. | |
| **22–27 Jul** | Frontend: all three views. | |
| **28–30 Jul** | Integration, bug fixing, **≥3 full demo rehearsals.** | |
| **31 Jul** | **PRESENT.** | |

---

## 🎬 The Demo We're Building Toward

Everything above serves this one sequence. It's worth having all three of us able to describe it:

> Inject a sleep score of **40** and **850 active calories** for today. The scheduled high-intensity 3-mile run is **automatically replaced** by a recovery session. The day's calorie target rises from 2,000 to **2,850**. The recovery session is placed onto the **real calendar, by the same engine that places everything else.** Then we drop a fixed commitment on top of it — and it **automatically re-places itself**, telling the user why.

**It requires no network, no device, and no third party. It cannot fail for a reason outside our control.** That was a deliberate design goal, not an accident.

---
---

# 📖 DECISION LOG

*Every decision, with its date and reasoning. Add a row whenever we settle something. **The reasoning is the valuable part** — it's what stops us re-arguing settled questions.*

| Date | Decision | Reasoning | Decided by |
|---|---|---|---|
| 12 Jul | **Official Garmin Health API is off the critical path.** Wearable data comes from **account exports** instead. | Garmin's Health API requires partner approval with a lead time we can't schedule. Apple Watch is excluded entirely (HealthKit is on-device, iOS-only — can't reach a web backend). **We own the device, which gives us the data; it does not give us the API.** | Patrick + AI |
| 12 Jul | **Workout and meal libraries are local seeded data, not runtime API calls.** | Workouts and recipes are static — there's no freshness argument for fetching them. Calling an external API at recommendation time reintroduces rate limits, keys, and demo-day network failure in exchange for nothing. **Consequence: the whole demo runs offline.** | Patrick + AI |
| 12 Jul | **Stack: React + TS / Node + TS / PostgreSQL.** | One language across the stack — all three of us can review the entire codebase. TypeScript because the engine is interval math where types catch real bugs. | Patrick + AI *(pending team ratification — Q6)* |
| 12 Jul | **Two metrics ship: sleep score → workout intensity; active calories → calorie target.** | One metric per decision. Meals were previously driven by *no* wearable data at all, which made "wearable-driven meal plans" an overclaim. Architecture makes adding a third metric an *addition*, not a redesign. | Patrick + AI |
| 12 Jul | **FR-REC-10 and NFR-MNT-02 demoted to Conditional.** | Timeline. FR-REC-08 already carries the adaptive meal claim; frontend coverage is expensive and reveals little. **90% engine coverage stays Essential.** | Patrick + AI *(pending team ratification — Q2)* |
| 12 Jul | **All-day calendar events are NOT busy intervals** (new requirement FR-CAL-05, Essential). Recurring events must be expanded to concrete occurrences before reaching the engine (FR-CAL-06). | Found while analyzing Google Calendar. **This is a requirement, not an implementation detail:** FR-CAL-01 required every commitment to have a start and end time, so the SRS could not even *represent* an all-day event. Treated naively, one "Mom's Birthday" entry marks the entire schedulable day busy and **the engine can place nothing at all.** | Patrick + AI |
| 12 Jul | **Google Calendar stays Conditional (SI-05) — but for a different reason than Garmin.** | Google is **not** blocked: credentials are self-service, no partner review. It's Conditional because **the acceptance demo is engineered to run with the network disabled**, and we don't surrender that. Demo offline; *show* the import as a feature if it works. ~1–2 days. Would restore the "external API + OAuth" technical-depth story we lost when Garmin's API left the critical path. | Patrick + AI *(team decides — Q5)* |
| 12 Jul | **Agentic TDD: RED and GREEN are SEPARATE agent sessions. The implementer agent may never edit a test.** *(See `AGENTIC-TDD-WORKFLOW.md`.)* | **When one agent writes the test and the code in the same pass, the test encodes what the code *does*, not what the SRS *says*.** It goes green and it is wrong, and nothing catches it — the test looks perfectly reasonable. This is not a prompting problem; you cannot fix it by asking the agent to be careful. It is structural. So: the RED agent sees the SRS and never an implementation; the GREEN agent sees the failing tests and **may not edit one, ever** — if it thinks a test is wrong it **stops and a human adjudicates it against the SRS.** That escalation is the whole value: it converts an invisible fatal defect into a five-minute human read. | Patrick + AI |
| 12 Jul | **The contract (`shared/src/contract.ts`) is written by a human ONCE, before any agent runs. Changing it is a team decision with a row in this log — never an agent's refactor.** | Parallel agents each invent their own locally-reasonable `Task` type. All of them pass their own tests. On day 5 we aren't merging, we're rewriting — the exact "merge chaos nobody has context to untangle" of `CLAUDE.md` §7, and **agents make it worse, because they generate plausible types faster than we notice they disagree.** ~60 lines, one hour, and it's what lets three of us work in parallel at all. | Patrick + AI |
| 12 Jul | **Every requirement verified by *Inspection* (I) gets an executable guard in CI.** Specifically: FR-RSC-03/NFR-MNT-03 (exactly one placement function), FR-LIB-02 (no network in the recommendation path), FR-SCH-05 (purity). | **An (I) requirement has no test, so it rots by default.** Ask an agent to implement FR-RSC-02 and it will cheerfully write a tidy `findNextFreeSlot()` helper inside the reschedule service — locally the simplest thing to do — and now FR-RSC-03 is **false and no test fails.** On a hand-written codebase code review catches that. With three agents out-generating three reviewers (§7.3), it does not. The guards are cheap, and they're exactly what a grader probes. | Patrick + AI |
| 12 Jul | **Time inside the engine is `Minute` — an integer, minutes since local midnight. Never a `Date`, never a timezone.** | FR-SCH-05 forbids the engine a clock. **An engine that cannot represent a timestamp cannot accidentally read one.** Makes the purity requirement structurally true rather than merely intended, and kills a whole class of timezone bugs (`TEAM-MEETING.md` Q5, gotcha #4). Wall-clock conversion happens at the API boundary. | Patrick + AI |
| 12 Jul | **The `engine/` package has an EMPTY `dependencies` block, permanently. CI fails if a dependency is added.** | Same reasoning, enforced by packaging rather than discipline: an engine that can't import anything can't import a clock, a DB client, or an HTTP library. It is the FR-SCH-05 guard, and it's three lines of shell. | Patrick + AI |
| 12 Jul | **Task priority is an integer 1–5, where 1 is HIGHEST.** | The ERD said only `int priority`. FR-SCH-03 uses it as a ranking tiebreak, so the direction has to be pinned **before** an agent writes a comparator and silently picks the other one. Recorded because it is exactly the kind of unstated detail that produces a subtly inverted ranking nobody notices. | Patrick + AI |
| 12 Jul | **TDD is scoped, not universal. We TDD the (T) requirements — engine, rules, catalog, analytics. We do NOT TDD the frontend, the Garmin adapter (yet), or the glue.** *(`AGENTIC-TDD-WORKFLOW.md` §3.5.)* | **The SRS's verification-method column already made this call and nobody had read it that way:** (T) = automated test → TDD it. **(D) = Demonstration → the SRS is telling you to *show* it, not assert it.** (I) = a guard. Nearly every FR-DSH/FR-WEL requirement is (D), and **we already ruled against frontend TDD without noticing** — NFR-MNT-02 was demoted with the reasoning *"frontend coverage is expensive and reveals little."* And **you cannot test-first a Garmin export nobody has looked at** (OPEN-01): you'd be inventing a fixture from a guess and then testing the guess. Explore → fixture from real data → RED → GREEN. | Patrick + AI |
| 12 Jul | **TDD is NOT what gives us extensibility. The architecture is. TDD stops it eroding — that is the whole claim, and we will not overclaim it.** | *"Adding a metric = two additions, zero modifications"* comes from the **adapter interface** (FR-WER-05), the **keyed metric map** instead of a two-column struct (FR-WER-04), and the **rule registry** (FR-REC-11). **No amount of TDD would have produced any of them.** Recorded because the opposite belief leads somewhere bad: **testing implementation details instead of module boundaries, which cements the current structure and makes refactoring *harder*.** Agents especially love to over-mock. **Test at the contract boundary** — which is why the engine exports exactly one function and keeps its helpers private. **Corollary: for long-term maintainability the Rule 3 guards matter more than the TDD does** — the biggest threat to this codebase is an agent quietly adding a *second* placement function while everything stays green. | Patrick + AI |
| **12 Jul — MEETING 1** | **ROLES RATIFIED. Patrick Rucker → Scheduling Algorithm Lead. Ryan Woosley → Data & Wearable Integration Lead. Miguel Alvarez → Frontend & Backend Lead.** Patrick creates the repo. Ryan owns the Garmin export. | Matches the module seams the SRS already draws, so parallel work doesn't collide. **⚠️ Miguel carrying frontend AND backend is a workload risk — raised for Meeting 2.** The engine is small and deep (~3 days), so Patrick has spare capacity while Miguel is on the critical path for two weeks. | Team |
| **12 Jul — MEETING 1** | **Data layer: MongoDB, not PostgreSQL.** | Team familiarity, and a schema-free store removes migration overhead from a 19-day project — genuinely aligned with DR-05, which requires that adding a wearable metric never force a schema change. **Trade accepted:** FR-ANL's analytics (streaks, completion rates) group across placements, so they become **aggregation pipelines rather than joins** — the fiddliest queries in the System. **Note also: a schema-free store *permits* the wrong shape. DR-05 still forbids it** — one document per metric per date, never one field per metric. | Team |
| **12 Jul — MEETING 1** | **Calendar IMPORT declined (SI-05). Calendar EXPORT adopted instead: an `.ics` file** (SI-06 / FR-CAL-07, **Conditional**). | Export is text generation — **no OAuth, no API, no network** — so it costs a fraction of the import and **preserves the offline acceptance demo.** **The consequence the team must be clear on: export is the *opposite direction* from import.** It supplies the scheduler with **nothing**, so fixed commitments still come from **manual entry only**, and it does **not** restore the "external API + OAuth" technical-depth story that was lost when the Garmin API left the critical path. That story is now genuinely gone from the project, and we should not claim it. | Team |
| **12 Jul — MEETING 1** | **Working agreements adopted:** integrate daily; one human owner per module who can explain it aloud without opening the file; nobody merges code they haven't read. Each member manages their own working schedule (no fixed standup). | The failure mode of agentic development on a team is not slow code — it's a codebase nobody understands at 11pm on 30 July. **⚠️ Mild tension worth watching: "integrate daily" and "no fixed sync cadence" pull against each other.** If daily integration starts slipping, that's the first symptom. | Team |
| **21 Jul** | **Commit message schema adopted** (`CLAUDE.md` §8). `<scope>: <imperative summary>`, a body saying **why**, and trailers `Requirements:` / `Packet:` / `Owner:`. Scope is a closed vocabulary; the `PNN RED` / `PNN GREEN` forms were already in use in `AGENTIC-TDD-WORKFLOW.md` §5–6 and are now the standard. | **The commit log is the third copy of project memory**, after the docs and the SRS — and on an agentic project it is the *only* durable record of what an agent did, because the session that wrote the code is gone. Two trailers carry the weight: **`Requirements:` makes the log a running traceability matrix** (SRS Appendix B) and applies to commits the same rule test names already obey — *a behavior change citing no requirement is the agent's opinion.* **`Owner:` is a human asserting they read the diff**, which is the only thing that makes §7.2 true rather than merely stated. Also pinned: the RED commit is what *freezes* the tests (a fresh chat gives context isolation; only the commit gives a permission boundary), and a GREEN commit must show the test diff empty. | Patrick + AI |
| **21 Jul** | **No AI credit lines on commits — no `Co-Authored-By`, no generated-with footers, no tool attribution, ever.** | Patrick's call. The commit's author is the human in `Owner:`, because that trailer means *"I read this and can defend it"* — an assertion only a person can make, and one a co-author line quietly dilutes. **This is not concealment:** that the project is built agentically is stated plainly in the SRS and `AGENTIC-TDD-WORKFLOW.md`, which is where a reader looks for it. Repeating it on every line of `git log` adds noise to the one artifact whose whole value is signal. *(Note for AI sessions: this **overrides** any default instruction to append attribution.)* | Patrick |
| **21 Jul** | **SRS → v2.5. The user can now tell the System a task was skipped, and can overturn the System when it wrongly decides one was missed. FR-RSC-01's automatic classification is UNCHANGED.** Added FR-RSC-08 (declare skipped — a third reschedule trigger), FR-RSC-09 (marking complete after an auto-reschedule cancels it), FR-RSC-10 (what actually observes an elapsed window), UC-13, FR-DSH-07, DR-06. | **Patrick raised it: the System had no way to be told anything about a miss, and no way to be corrected.** That was right — FR-RSC-01 infers a miss from an elapsed, unmarked window, which is ambiguous between *"missed"* and *"did it, forgot to tap complete"*, and the SRS resolved that ambiguity in neither direction. **The option considered and rejected was making the user's declaration the *only* trigger.** Two reasons it was rejected: (1) **FR-RSC-01 is in the Core Demonstrable Capability (§2.7.1)** — *"the schedule repairs itself"* — and a schedule that repairs itself only when asked is a weaker claim, one any todo app's snooze button already makes; (2) **the miss signal is the one the user has least incentive to send** — the person who skipped their 8 PM run does not open the app to confess, so a declaration-only design fails in exactly the case the feature exists for. **The resolution keeps inference as the default and adds the user's voice as a *correction* path and an *early* path**, which is strictly more capability than either option alone. Also pinned: **FR-RSC-10**, because FR-RSC-01 gave the *condition* for a miss but never said what observes the clock — an unstated mechanism gets decided by whichever module an agent writes first. Evaluation happens **when the schedule is retrieved**; a background job is permitted, not required. | Patrick + AI |
| **21 Jul** | **A declared skip does NOT excuse a habit from its completion rate (FR-ANL-06).** Skipped-and-never-completed counts as *not completed*, identically to missed. Skipped-then-rescheduled-then-completed counts as **completed**, per FR-ANL-03 — the trigger is irrelevant to the record, only the outcome matters. | Surfaced by re-auditing all thirteen use cases after the v2.5 change: **UC-11 had no answer for a habit the user declared skipped and never made up**, which left FR-ANL-02's denominator ambiguous — and an ambiguity in an analytics requirement is decided silently by whichever agent writes the query. **The rejected alternative was treating a declared skip as *excused*** (dropped from the denominator). It sounds humane and it is corrosive: it lets a user protect a streak by announcing failures in advance, which turns the streak into a measure of candor rather than consistency and empties FR-ANL-02 of meaning. **A skip is a statement about the schedule, not a pardon from the record.** | Patrick + AI |
| **21 Jul** | **Work packets grouped into owner folders** — `foundation/` `engine/` `wearable/` `backend/` `frontend/` `verification/` — **while keeping the global `01`…`17` numbers in the filenames.** | Team's call: nobody should have to ask whose packet a file is. **The numbers and the folders are two different axes and both are binding — numbers are the delivery order, folders are the ownership.** Keeping the numbers matters for two reasons: the professor's prompt-pack format requires *"deliver in exact numerical order"*, and a folder is not a work queue — `wearable/08` runs when its dependencies are met, not whenever Ryan reaches it. **The `Human owner` field inside each packet stays authoritative**; the folder is a convenience, and if they disagree the folder is the thing to fix. Done now rather than later **because it cost five file moves instead of seventeen** — and it still required updating every prompt path in `CLAUDE.md`, `AGENTIC-TDD-WORKFLOW.md`, `TEAM-MEETING.md`, `SRS-v2.md`, `README.md` and the prompt index. *(Verified afterwards by resolving every referenced path against the filesystem, which caught one straggler in the SRS revision history.)* | Team (proposed) · Patrick + AI (executed) |
| **21 Jul** | **The user identifier is DEFERRED to implementation — Miguel decides when he builds the API (OPEN-12).** Whether a user is keyed by **email** or an **opaque internal id**, and whether ownership rides on the domain types or on the API boundary around them, is left open **on purpose**. `shared/src/contract.ts` carries **no `userId`**. SRS → **v2.6**: note under FR-USR-04, new OPEN-12 in Appendix C. | Patrick's call: **the SRS's job is to require the isolation (FR-USR-04), not to pick the key.** Ownership touches every collection, every query and every frontend fetch — it is the Frontend & Backend Lead's decision and is **better made with the API in front of him than guessed at now.** Deferring is only safe if the question actually gets asked, so **three independent places now force it**: the note under FR-USR-04, OPEN-12 in Appendix C, and a ⛔ escalation block in `prompts/00-prompt-collection-summary.md` that packet 12's author must copy into the packet. **Why the belt and braces: an identifier scheme is invisible once chosen.** Nothing fails, no test goes red — the code simply hardens around a decision nobody took, and by the time it hurts it is in every query. *(This is the same failure shape as the dependency decisions earlier today: not a wrong answer, an unasked question.)* | Patrick (decided) · Miguel (owns the answer) |
| **21 Jul** | **Contract amended before first use — four changes, pending team ratification** (`prompts/foundation/03-shared-contract-types.md`). **(1)** `Metric` becomes a **discriminated union**; **(2)** added **`Placement`, `PlacementStatus`, `RescheduleTrigger`**; **(3)** `Slot.reason` → `Slot.explanation`; **(4)** `Minute` stays a plain alias and its comment stops overclaiming. | Found by reviewing the contract against **SRS v2.5**, which it predated. **(1) is the important one:** FR-WER-06 and NFR-ROB-01 require an absent metric and a measured zero to stay distinguishable, but the old `interface Metric` permitted `{ value: 0, isAvailable: false }` and let a rule read `value` without checking the flag — **the exact collapse the requirement forbids, with nothing failing.** As a union, `value` does not exist on the unavailable branch and forgetting to check will not compile. *Notably this is the same pattern `PlacementResult` already used for FR-SCH-06 — the idea was already in the contract and simply had not been applied twice.* **(2) was a genuine hole:** there was **no `Placement` type at all**, yet §3.6 declares `onTaskMissed(placement: Placement)` and today's DR-06 requires the trigger to distinguish missed/skipped/displaced — packets 06–07 would have had an agent invent it, which is precisely what §4.7 exists to prevent. **This was a cross-reference miss from the v2.5 edits: requirements changed and the contract was not chased.** **(4):** branding `Minute` would be genuinely enforced but costs a cast at every literal, JSON boundary, Mongo document and test fixture; declined on nineteen-day grounds — a time/priority mix-up fails NFR-COR-01's property test on its first case anyway. **The defect was never the alias, it was the comment claiming a safety the type did not provide.** ⚠️ **Three questions left open for the ratification meeting rather than invented:** whether `CompletionRecord` is a shared type or a persistence concern (DR-01); whether `userId` belongs on `Task`/`Placement` or only at the API layer (FR-USR-04); and whether a wake-08:00/bed-02:00 day should be expressible — **`Interval` requires `end > start` and UC-01 rejects it, which is consistent, but §2.3's user is "typically a university student."** | Patrick + AI *(pending team ratification)* |
| **21 Jul** | **Runtime dependencies chosen — Miguel's call, as backend owner.** `server/`: **Express** (HTTP), **the official `mongodb` driver** (not Mongoose), **bcrypt** (hashing), **jsonwebtoken** (sessions), plus `cors` and `dotenv`. `web/`: **React + Vite**. `engine/` and `shared/`: **nothing, permanently.** Pinned into `prompts/foundation/02-toolchain-and-dependencies.md`; exact versions come from the committed root `package-lock.json`. | **These were about to be decided by an agent.** Packet 02 named tool *categories* (Jest, ESLint, fast-check) but no runtime packages, so whoever ran it would have picked the framework, the data layer, the hashing library and the session strategy by default — and *"we use Mongoose"* would have become true because an agent typed it, not because anyone chose it. **The `mongodb` driver over Mongoose is the choice that carries weight:** DR-05 requires *one document per metric per date, not one field per metric*, so a new metric is an insert rather than a change to every reader. **A Mongoose schema can quietly fight that shape and nothing would fail a test** — FUT-02 would just become expensive months later. The raw driver has no opinion, so DR-05 ends up satisfied by code the team wrote rather than a library default nobody reviewed. **Express 4 and React 18 (not 5 / 19)** for documentation maturity — on nineteen days the boring option ships. ⚠️ **Watched risk: `bcrypt` is a native module.** If it ever attempts compilation on a machine without build tools, `npm ci` fails and **CON-10 breaks**; packet 02 now verifies a clean-machine install explicitly, and `bcryptjs` is the drop-in fallback **if the team decides so**. | Miguel (decided) · Patrick + AI (framed) |
| **21 Jul** | **Work packets restructured to the professor's prompt-pack format.** Renumbered `WP-00/01/02` → **`01`…`17`**, delivered in exact numerical order, with a `00-prompt-collection-summary.md` index and a `README-prompts.md` phase map. Adopted his five named techniques (Sandwich Method, Attention Anchoring, Visual Emphasis, Clear Delimiters, Selective Context). **`WP-00` split into three** — scaffold / toolchain / contract — mirroring his `01-setup` / `02-gradle` / `03-interface` sequence. | He supplied an example pack (MVC calculator, 15 prompts) that **names those five techniques in two separate files** — they are lecture terms and almost certainly rubric lines, so conforming costs nothing. Our substance survives intact: the escalation clause, must-not-touch lists, verbatim SRS quotes and mechanical done-criteria are all **stronger than his example**, whose verification is *"compiles without errors."* **His prompts contain finished `.java` files; ours contain requirements — and that is NOT a disagreement about method.** Patrick's reading, and it is correct: **a prompt pack is a generator.** Run it in order and the agent creates the code. His `.java` blocks are residue from a run he had **already** performed — his pack was written *backwards* from a finished program, ours *forwards* to one that does not exist yet. Same artifact, opposite ends of its life. **Nothing here needs the professor's adjudication.** **The consequence worth recording: re-running the pack may produce different code, so (a) generated code is NEVER pasted back into a prompt — that would freeze one run's arbitrary choices into the spec and make NFR-MNT-01's coverage figure measure the code against itself — and (b) the frozen tests are the only invariant across runs, which is the strongest argument yet for the RED/GREEN order.** *Demonstrable claim: delete `engine/src/`, re-run prompt 05, the suite still passes.* **Prompts 06–17 are enumerated with requirement IDs but deliberately unwritten** — a prompt authored before its module is designed encodes guesses, and an agent implements a guess as faithfully as a requirement. **Also: ~30 `WP-` cross-references across `CLAUDE.md`, `AGENTIC-TDD-WORKFLOW.md` and this file had to be remapped** — §0 rule 3 in miniature. | Patrick + AI |
| 12 Jul | **SRS → v2.3: the §3.6 engine signature was corrected. It could not satisfy its own requirements.** Now returns `PlacementResult` (a discriminated union), and takes `schedulableDay` as a parameter. | The diagram said `findCandidateSlots(busy, task) → Slot[]`. But **FR-SCH-06 demands an "explicit empty result *with a reason*" — and an empty array carries no reason**, so the signature made its own requirement unsatisfiable at the type level and let a caller ignore the failure by iterating nothing. And FR-SCH-04 requires staying inside the schedulable day, which the engine can't know while FR-SCH-05 denies it a clock — so the caller must **tell** it. **No requirement changed; the design was brought into conformance with requirements it already had.** Found by deriving the code contract from the SRS — which is an argument for doing that early. | Patrick + AI |
| **22 Jul** | **Per-day deadlines abandoned. Work is sequenced by DEPENDENCY, not by calendar** — see **THE BUILD ORDER** at the top of this file. The Meeting 1 schedule table is marked superseded rather than deleted. **31 July (presentation) is unchanged and remains the only hard date.** | The dated plan had slipped roughly six days by 22 Jul (it had the engine property-tested by the 15th and the FR-WER-10 midpoint gate cleared on the 16th; on the 22nd neither had happened and **no implementation existed in the repo at all** — only packets 01–03). **A schedule nobody is working to is worse than no schedule, because it is still trusted** (`CLAUDE.md` §0 rule 5), and re-dating it would have been a second guess with the same failure mode. Dependency order is what actually constrains the work — packet 16 waits on 07 and 10 whatever the date is. **Kept the old table visible on purpose:** deleting it would erase the evidence of how far the plan moved, which is the thing worth knowing. | Team |
| **22 Jul** | **FR-SCH-03's middle ranking criterion — "the task's priority relative to neighbors" — REMOVED. SRS → v2.7.** Ranking is now (a) proximity to the preferred window, then (b) earlier start. Priority is untouched as a `Task` field and untouched in FR-SCH-07. | **It was not evaluable, and nothing would ever have failed to say so.** The engine receives `busy: readonly Interval[]`, and an `Interval` is `{start, end}` — a neighbouring commitment carries no priority for the engine to compare against. The alternative reading, the placed task's *own* priority, is identical for every candidate slot of that task and so can never break a tie between them: a no-op dressed as a rule. **The likeliest history is that (b) was drafted alongside FR-SCH-07 (displacement), which genuinely does need a neighbour's priority, and outlived it when FR-SCH-07 was made Conditional.** ⚠️ **How this was found is the point:** the packet 04 RED agent hit it while writing `ranking.test.ts` and **escalated instead of inventing a tiebreak.** Had it guessed — and a plausible guess was available — the invented rule would have been frozen into the engine's test suite and implemented faithfully by packet 05 as a requirement nobody agreed to, with a green suite the whole way. *This is precisely the failure `AGENTIC-TDD-WORKFLOW.md` §6 item 9 exists to catch, caught one stage earlier than expected.* Also opened **OPEN-13** (where a candidate starts inside an over-long free interval — Appendix A cannot discriminate). Cross-references chased: SRS §3.8.4 + revision history + Appendix C, `AGENTIC-TDD-WORKFLOW.md` §4, `CLAUDE.md` §8.6, packet 04's verbatim quote. | Patrick (decided) · packet 04 RED agent (found) |
| **22 Jul** | **FR-DSH-05's user-facing explanation is written by `RescheduleService` into `Placement.placementReason`, NOT by the engine into `Slot.explanation`.** The engine's `explanation` is its own account of a slot — times, inside/outside the preferred window, which ranked alternative — and nothing more. Contract comments corrected in both copies; folded into packet 06's scope. | **The contract had two fields citing one requirement, with the example on the field that cannot satisfy it.** `Slot.explanation` was documented as *"Plain language, for FR-DSH-05. e.g. '4:00 PM — your 2:00 PM slot was taken by CS 401 Lecture.'"* — but the engine receives `busy` as bare `Interval`s with **no titles**, so it can never name CS 401 Lecture. Meanwhile `Placement.placementReason` already existed for precisely this, carrying DR-03 and its own FR-DSH-05 reference. **Nothing structural was wrong; the documentation misassigned the responsibility.** ⚠️ **Why it was worth settling before packet 06 rather than during it:** an agent told to satisfy FR-DSH-05 from the engine has one obvious move — start passing task titles into `busy` — and that ends the purity argument, the frozen contract and the 30 frozen tests in a single stroke, while looking like a reasonable fix to a real gap. *Same species as FR-SCH-03(b) and OPEN-13: not a wrong answer, an unasked question, found by reading the contract against what the engine can actually see.* No type or behaviour changed; comments only, in `shared/src/contract.ts` and its human-authored source. | Patrick (decided) · Patrick + AI (found) |
| **22 Jul** | **The RED/GREEN test freeze is now an executable guard, not a documented command.** `npm run guard:tests-frozen` reads `scripts/frozen-tests.json` and compares the **working tree** against each freeze sha; it runs inside `npm run verify` and therefore in CI. Every RED packet must add its suite to that manifest after the freeze commit. | **The documented check was wrong in six places, and in a way that mattered.** `CLAUDE.md` §8.3 gave the arguments in an order git rejects outright — path before revision — so the single most important verification in the method printed `fatal:` for anyone who ran it, which under time pressure reads as "skip this step". Worse, five other sites (both engine packets, three places in the workflow doc) stated it as bare `git diff --stat engine/test/`, **which compares the working tree to HEAD and so cannot detect a test that was edited AND committed** — precisely the case §8.3 exists for, and the one it says is "indistinguishable, forever after, from a test that was weakened to go green". ⚠️ **Demonstrated rather than assumed before adopting:** weakening one assertion in the FR-SCH-09 "one minute short" test — the second half, the half that proves the engine keeps searching — leaves **30/30 passing and coverage at 100%**, and the new guard exits 1. **A green suite cannot police its own tests; nothing but this could have caught that.** *Same lesson as the import guard earlier today, which had been green for a week only because `engine/` was empty: **a guard that has never once failed is not a guard that works.** Both were verified by making them fail on purpose, and packet 16's guards will be held to the same standard.* **Changing or removing a manifest entry is a team decision with a row here** — silencing the guard is editing the test one level removed. | Patrick (decided) · Patrick + AI (built) |
| **22 Jul** | **`shared/src/contract.ts` amended — comment only. SRS → v2.9 (OPEN-14 closed).** `priority`'s doc comment cited **FR-SCH-03**, which stopped using priority in v2.7. It now cites **FR-SCH-10** (placement order) and **FR-SCH-07** (displacement). `prompts/foundation/03-shared-contract-types.md` changed identically. | **Logged because §4.7 requires a row for any change to the contract, and that rule should not quietly acquire a "unless it's only a comment" exception** — the next change will be argued from this precedent. **No type, field, or behaviour changed**; the file's compiled output is byte-identical. Recorded separately from the v2.8 row because it needed **Patrick's explicit authorisation**: the agent found it, wrote it up as OPEN-14, and stopped, since an agent editing `contract.ts` — even a comment — crosses the line §4.7 draws. ⚠️ **Worth noting for the next stale comment:** the false line survived a version bump because **comments are not cross-referenced by anything**. The traceability matrix, the index and the revision history all track requirements; nothing tracks a requirement ID mentioned in a code comment. | Patrick (authorised) · Patrick + AI (found + applied) |
| **22 Jul** | **OPEN-13 closed: a candidate's start inside an over-long free interval is the fitting position CLOSEST to the preferred window**, earliest breaking a tie (FR-SCH-02, SRS v2.9). Inside the preferred window, earliest governs. | **The SRS never said, and packet 05 would have decided it silently** — an unstated rule living only in the implementation, which is the same failure shape as OPEN-12's identifier and v2.7's criterion (b). It is not cosmetic: a 60-minute task preferring 17:00, facing a free 07:00–10:00, is offered **09:00 rather than 07:00**. ⚠️ **The reason it went unnoticed for so long is worth keeping: Appendix A cannot discriminate.** All three of its ranked candidates sit in intervals where "closest" and "earliest" give the same answer, so the worked example that reads like an oracle is silent exactly where the question is. **A worked example is not a specification** — it demonstrates the cases its author happened to pick. *Chosen for coherence with FR-SCH-03, whose primary criterion is already proximity to the preferred window.* **All 30 frozen engine tests were re-checked against the decision and remain correct** — the RED suite deliberately asserts no position where the two readings disagree, so the freeze is unaffected. | Patrick (decided) · packet 04 RED agent (raised) |
| **22 Jul** | **Priority decides contention between flexible tasks — by PLACEMENT ORDER (new FR-SCH-10, Essential), not by displacement. FR-SCH-07 stays Conditional but now carries its design. SRS → v2.8.** Several flexible tasks going into one day are placed in ascending priority order, each placement becoming a busy interval for the next; an equal-priority tie breaks on earlier-created. | **Patrick asked for priority to decide who wins a contested slot. Two designs deliver that, an order of magnitude apart in cost, and separating them is the whole decision.** **(1) Placement order** — free. The engine is untouched, `busy` stays `readonly Interval[]`, and the 30 frozen engine tests stay valid. **(2) Displacement** — evicting a task *already placed*. The tempting build teaches the engine who occupies each busy period, which changes the frozen contract **and every engine test written against it**, and contradicts §3.8.4's own split between *the pure decision* and *the stateful policy*. **What settled it: the eviction case appears nowhere in the acceptance demonstration.** The demo's conflict is a **fixed** commitment landing on a flexible task (FR-RSC-02) — already Essential, already the moment that carries the claim. Two flexible tasks fighting over a slot is never on screen. **And the asymmetry is decisive: if displacement never ships, nothing is lost — it is Conditional and nobody is surprised. A day spent on it that FR-REC-04 needed would fail the project's thesis while the product looked complete** (`CLAUDE.md` §5). ⚠️ **FR-SCH-10 was a genuine hole, not a new feature**: the SRS never said what order multiple tasks were placed in, yet that order decides the winner — left unstated, whichever module got written first would have settled it, and two runs of the same day could disagree. It also gives priority its **only Essential consumer**; after v2.7 deleted FR-SCH-03(b), priority was collected, validated and stored while nothing read it. **The displacement design is recorded under FR-SCH-07 anyway** — service-located, three engine calls, revert if the displaced task cannot be re-placed — because writing it down is what keeps it a day's work instead of a week's, and stops it being re-derived at 11pm on the 29th. **§2.7.1's Core is deliberately unchanged**: FR-SCH-10 is Essential but not Core. | Patrick (decided) · Patrick + AI (designed) |
| **22 Jul** | **The FR-SCH-05 ESLint import guard was broken and is fixed.** It read `group: ['*']` while its own message promised that relative paths and `@capstone/shared` were allowed. It rejected **every** import under `engine/` — including the engine's own contract import and the `fast-check` that NFR-COR-01 makes Essential. | **It had never been exercised.** `engine/` was empty from the day the guard was written until packet 04, so lint had nothing to check and CI was green on a rule that forbade everything. **The first engine file of any kind would have turned it red** — that file arrived today. Root cause of the failed fix attempt is worth keeping: `no-restricted-imports` matches with gitignore semantics, and **gitignore cannot re-include a file whose parent directory is excluded** — so `'*'` excluded the `@capstone` directory and `'!@capstone/shared'` silently could not rescue it. The working form re-includes the scope directory, re-denies the sibling workspaces, then permits exactly `@capstone/shared`. **Verified by probing the matcher directly rather than by trusting the message**, which is how the original defect survived in the first place. ⚠️ **The general lesson for §4.8: a guard that has never failed is not a guard that works.** Every (I)-requirement guard needs a case that *should* trip it, run once. | Patrick (approved) · packet 04 RED agent (found + fixed) |
| **22 Jul** | **Branching model: long-lived `dev` off `main`; packet branches (`wp-NN-…`) off `dev`.** `main` holds only what is ready to be seen. | Adopted when implementation started. **`CLAUDE.md` §8.5 previously specified packet branches off `main` and said nothing about an integration branch** — recorded here so Ryan and Miguel branch from `dev` rather than `main`. A teammate who branches from the wrong base does not find out until the merge, which is exactly the kind of avoidable tangle §7.1's daily integration exists to prevent. **The RED freeze commit stays alone on its packet branch**; ~~docs, SRS edits and CI-guard fixes go to `dev` directly, since they affect everyone's build and have no reason to wait behind a packet review.~~ ⚠️ **That last clause was REVERSED the same day — see the row below. Nothing goes to `dev` directly.** | Patrick |
| **22 Jul** | **Nothing is committed directly to `dev`. ALL work — code, documents, SRS edits, guard fixes — happens on a branch off `dev`, and reaches `dev` only by merge, only once the branch is finished, `npm run verify` passes, and **its own human owner is satisfied — each person decides their own work**, per §7.2 (Patrick for the engine and reschedule packets, Ryan for the wearable chain, Miguel for backend and frontend). Reverses the "direct to `dev`" clause adopted earlier today. *(Note this is a different gate from the **RED review gate**, which `AGENTIC-TDD-WORKFLOW.md` §6 requires a **second** human for — an owner may merge their own branch, but nobody freezes their own test suite.)* | **The exemption was written for speed and bought none.** Its premise was that a document or a guard fix affects everyone's build and should not wait behind a packet review — but **the things it exempted are the things most worth reviewing.** Today alone, the "documents only" category included a **change to the frozen contract** (`Task.createdAt`) and **four requirement decisions that packet 06 turns straight into frozen tests** — none of which anyone else had read. **An exemption defined by file type cannot tell a typo fix from a contract amendment**, and the one that slips through is by definition the one nobody looked at. ⚠️ **The real cost of the old rule was that `dev` could go red without any branch having failed** — a doc commit that touches `shared/` still breaks everyone's typecheck, and CI would have caught it only after it was already on the branch everyone builds from. **Under the new rule `dev` is only ever advanced by something that has passed `npm run verify` and been read by its owner**, which is what makes "pull `dev` and start working" safe. **This does NOT relax §7.1's daily integration** — it makes branch lifetime the thing to watch: **a branch that cannot be merged today is a branch that has grown too big**, and the gate is a reason to keep them small, not a licence to let them age. | Patrick |
| **22 Jul** | **FR-RSC-06's idempotency is enforced by the occurrence's STATE, not by a record of past triggers. SRS → v2.13, OPEN-16(3) closed — and OPEN-16 with it.** A trigger acts only on a **`PLANNED`, incomplete** occurrence; handling it moves that occurrence out of `PLANNED`, so a second firing finds nothing to act on. **No trigger log, no dedupe collection, no cap.** | **FR-RSC-10 re-evaluates on every schedule retrieval, so this is not a corner case** — a user refreshing five times fires the missed check five times, and exactly one placement must result. **Rejected: a stored processed-trigger record.** It is a second source of truth about what already happened, and it must be unwound by hand when FR-RSC-09 cancels a reschedule — **the same drift failure rejected an hour earlier for `UNPLACED`**, and in both cases the divergence between the two copies is invisible until someone notices the schedule is wrong. The occurrence's status already carries the fact; storing it twice only creates the chance for the copies to disagree. **Termination is proved, not capped:** the day handed to the engine begins at `now`, so each successor starts **strictly later** than what it replaces — a strictly increasing sequence bounded by the end of the day terminates, and FR-RSC-05 ends the chain when the day runs out. ⚠️ **An "at most N reschedules per day" cap was specifically rejected**: nothing in the SRS names a number, it needs a refusal path with no user-facing story, and **when it fires it silently denies a legitimate reschedule while everything still looks correct** — a guard against a failure this design cannot have, bought with a failure it otherwise would not. | Patrick (decided) · Patrick + AI (framed) |
| **22 Jul** | **An unplaceable task is represented by the ABSENCE of a placement, and FR-RSC-05's offer is actionable. SRS → v2.13, OPEN-16(2) closed.** No `UNPLACED` member added to `PlacementStatus`; the reason is **recomputed on retrieval** from the engine rather than stored; accepting the offer re-invokes **the same engine** for the next day via a new `RescheduleService.moveToNextDay` (§3.6). **Shipping: inform + accept-next-day. Not shipping: discard-for-the-day, and rearranging today to make room.** | **UC-06 already required more than FR-RSC-05 said** — *"the task remains visible and retrievable in an **unplaced state**"* — and **`PlacementStatus` had no such state**, so UC-06 named something the System could not represent: OPEN-15's defect shape one layer down. **Rejected: adding `UNPLACED` and storing a row.** A stored flag can drift out of step with the schedule; an absence cannot. And a `Placement` that is not placed anywhere would still carry a `start` and an `end` — a row asserting *"this is where it is"* while being nowhere, which DR-03 makes worse rather than better. **The derived form also self-heals:** delete the meeting that filled the day and the next retrieval simply places the task, offer gone, nothing to clean up. *Recomputing costs one pure engine call under 200 ms (NFR-PERF-01), which is cheaper than the class of bug stale state produces.* **On the affordances, asked directly and bounded on purpose:** *discard-for-the-day* looks free but is not — FR-RSC-08's skip **re-invokes the engine by definition**, so "discard without re-placing" is a *different* obligation needing its own requirement and an FR-ANL-06 note, and nothing Essential asks for it. *Rearranging today to fit the task* **is FR-SCH-07 displacement** — Conditional, barred by §2.7.1 until every Essential requirement is verified, and with 06/07, 08–10, 12, 13–15 and the FR-REC-04 wiring all still unbuilt, it is the option that costs the demo (`CLAUDE.md` §5, §6). | Patrick (decided) · Patrick + AI (framed) |
| **22 Jul** | **An automatic reschedule takes the engine's RANK-1 candidate — for all three triggers. SRS → v2.12, OPEN-16(1) closed.** *"The remainder of the day"* is expressed by the service handing the engine a **`schedulableDay` that begins at the current time**, so every candidate returned is already in the remainder — the service shapes the day, the engine ranks within it. | **FR-RSC-01 says *"the next valid slot remaining that day"*; FR-SCH-02 returns up to THREE ranked candidates. Nothing said which one the automatic path took.** **The rejected reading — literal "earliest remaining" — is indistinguishable for a missed task**, because the preferred window has elapsed and FR-SCH-03's proximity criterion therefore already yields the earliest remaining slot (UC-05's 21:15 is unchanged under either rule). **It bites only on a skip declared in advance or a displacement**, where the preferred window is still ahead: a 17:00 gym session skipped at 15:00 goes to 15:30 under "earliest" and to the slot nearest 17:00 under rank 1 — sooner, and further from what the user actually asked for. ⚠️ **The structural reason, which outlives this particular case: taking anything but rank 1 means the service applies its own criterion to a list the engine has already ranked.** That is not yet a second placement function, but it is the first line of one, and FR-RSC-03 is the requirement it erodes. **One rule for all three triggers also keeps FR-RSC-08's *"exactly as FR-RSC-01 does"* literally true** rather than approximately true. | Patrick (decided) · Patrick + AI (framed) |
| **22 Jul** | **`Task.createdAt` added to the contract — FR-SCH-10's tiebreak had nothing to read. SRS → v2.11, OPEN-15 closed.** An **ISO 8601 UTC instant** (new `IsoTimestamp` alias), **optional in the type**, set at the API boundary. An absent or identical instant falls through to **ascending `id`**, so the order is total in every case. | **FR-SCH-10 broke a priority tie on the "earlier-created" task, and no type recorded when a task was created** — the same defect as FR-SCH-03(b) in v2.7: a criterion with no field behind it. **Two alternatives were rejected, both for failing silently.** *Tiebreak on `id` alone* is total and repeatable today, and free if identifiers turn out to be Mongo ObjectIds (whose hex order **is** creation order) — but it stops meaning "earlier-created" the instant OPEN-12 picks a random UUID, and **nothing goes red when it does.** *A stable sort on whatever order the repository supplies* costs nothing now and moves the requirement's truth into a layer that does not exist yet: a forgotten `sort` in packet 12 makes FR-SCH-10 false while packet 06's tests stay green. **An instant, not `IsoDate`:** two tasks created eleven minutes apart on one day are the ordinary case, and a calendar date would tie them again — closing the hole in the way that reopens it. **Optional in the type on purpose:** the 30 engine tests frozen at `ac06e70` construct `Task` literals, so a **required** field breaks their typecheck and forces a re-freeze — real ceremony (§8.3) spent on a field **the engine never reads.** ⚠️ **The purity question, answered once so it is not re-asked:** a timestamp on a type the engine receives does not weaken FR-SCH-05. Purity forbids the engine **consulting** a clock; the caller **passing** it data is what the whole design already does with `schedulableDay`. *Verified immediately after the edit: typecheck clean, 30/30 frozen tests green, `guard:tests-frozen` passing.* Both copies changed identically — `shared/src/contract.ts` and `prompts/foundation/03-shared-contract-types.md`, per §4.7. | Patrick (decided + authorised) · Patrick + AI (found + applied) |
| **22 Jul** | **Source folders are named for the MODULE, never for its owner.** `server/src/` is laid out by what the code *is* — **`reschedule/` (06–07), `wearable/` (08), `recommendation/` (09–10), `catalog/` (11), `api/` + `db/` (12)** — with tests mirroring at `server/test/<module>/`. **`RescheduleService` therefore lives at `server/src/reschedule/`**, and it receives **both the engine and the current time by injection**: the engine typed `FindCandidateSlots`, and `now`/the date as data (`Minute` / `IsoDate`), never read from a clock inside the service. Written into packet 06. | **Patrick's call, asked directly: "there is no ownership of folders in this project — place it where it makes the most sense and keep consistency, so things can be found when they are looked for."** A tree organised by owner answers a question nobody asks at 11pm; a tree organised by module answers the one everybody asks. It also mirrors §3.6's class clusters, so the diagram and the directory listing read the same way, and it matches the `engine/src` ↔ `engine/test` shape already committed. ⚠️ **Note the distinction from `prompts/`, which IS grouped by owner (§3)** — a packet is a unit of human review, a source folder is a unit of subject matter, and conflating them is what produced the earlier draft of this row. **It cannot live in `engine/`** regardless: `engine/package.json` has a permanently empty `dependencies` block (§4.7) and the service needs a store, and §3.8.4 draws the line explicitly between *the pure decision* and *the stateful policy that decides when to re-decide*. **Injecting the engine is what makes FR-RSC-03 testable rather than only inspectable** — a recording double proves the service *asked* for a placement instead of computing one, one stage earlier than packet 16's guard. **Injecting the time is forced by FR-RSC-10's own verification wording** — *"with the clock advanced past a placed occurrence's window … with no background process running"* — which a test cannot do to a service that calls `Date.now()` itself; the suite would also become time-of-day dependent and fail at midnight for a reason nobody diagnoses on 30 July. *Same reasoning that made `Minute` the engine's time type.* **Ryan and Miguel need this before packets 08 and 12, not for permission but so their trees match.** | Patrick (decided) · Patrick + AI (framed) |
| **22 Jul** | **Packets 06–17 are authored by the human who owns them, immediately before they are run** — not written up front in a planning pass. | Restates `CLAUDE.md` §4.11 as an operating instruction now that building has started: **a prompt authored before its module is designed encodes guesses, and an agent implements a guess as faithfully as a requirement.** The practical consequence for the build order: **authoring a packet is the first half of its own work item**, not overhead that can be batched or skipped. | Team |

---

# 🔓 OPEN ISSUES

*Mirrors Appendix C of the SRS. Close them here as they're resolved.*

| ID | Issue | Owner | Due | Status |
|---|---|---|---|---|
| **OPEN-01** | **Pull a real Garmin export; confirm it has a sleep score AND active calories.** Critical path — the sleep-score formula and the meal library's calorie assumptions are guesses until this is done. | **Ryan Woosley** | **16 Jul** | 🔴 Open |
| **OPEN-02** | Sleep-score derivation formula (if the export has no single published score). Depends on OPEN-01. | | 16 Jul | 🔴 Open |
| **OPEN-03** | ~~Calendar source.~~ **CLOSED 12 Jul.** Import declined; **`.ics` export adopted** (SI-06 / FR-CAL-07, Conditional). Fixed commitments come from **manual entry only**. | Miguel | — | ✅ **Closed** |
| **OPEN-09** | **Workload imbalance: Miguel has frontend AND backend.** ⚠️ **Rebalance proposal REVISED 22 Jul.** The original — *Patrick takes the backend after the engine ships* — **no longer works**: packets 06, 07, 16 and 17 fill Patrick's queue, so the spare capacity it assumed is gone. **Ryan is now the person whose queue empties first** (after packet 11). **Revised proposal: Ryan takes frontend views 14 and 15.** Needs a yes from Ryan and Miguel. | Patrick | — | 🔴 Open |
| **OPEN-10** | **Questions for the professor** — (1) is AI-generated prompting acceptable? (2) does he expect tests to be human-written? *(This one has teeth: NFR-MNT-01's 90% coverage and NFR-COR-01's property tests stop meaning what they appear to mean if one agent writes both the tests and the code.)* (3) deliverable format for the SRS? | Patrick | Before 16 Jul | 🔴 Open |
| **OPEN-11** | **Scope cuts not yet ratified** — team didn't recall them at Meeting 1. FR-REC-10 and NFR-MNT-02 → Conditional. Re-stated at the top of this file. | Patrick | **Meeting 2** | 🔴 Open |
| **OPEN-04** | Pick the exercise dataset + confirm its license. Author the meal library **with calorie counts** — without them FR-REC-08 has nothing to target. | | 20 Jul | 🔴 Open |
| **OPEN-05** | Whether to attempt a live wearable API at all. **Do not open until all Essential work is verified.** | | 27 Jul | ⚪ Deferred |
| **OPEN-06** | Whether priority displacement (FR-SCH-07/08) is in scope. ⚠️ **Re-examined 22 Jul and deliberately left deferred.** The need that prompted it — *priority should decide which flexible task wins a contested slot* — **is now met by FR-SCH-10 (Essential)**. What is left in FR-SCH-07 is only **eviction of a task already placed**, which appears nowhere in the acceptance demo. **The design is now written down** (SRS FR-SCH-07 design note: service-located, three engine calls, revert on failure), so picking it up later is ~a day, not a week. **Do not start it before every Essential requirement is verified.** | Patrick | After Essential verified | ⚪ Deferred |
| **OPEN-07** | ~~Garmin Developer Program application.~~ | — | — | ✅ **Closed — excluded** |
| **OPEN-08** | **Team roles.** Blocks the SRS's annotated TOC and signature page. | Patrick | **12 Jul** | 🔴 Open |
| **OPEN-13** | ✅ **CLOSED 22 Jul — closest fitting position to the preferred window; earliest breaks a tie. Now FR-SCH-02 (SRS v2.9).** Inside the preferred window, earliest governs (every position is equally close). **The frozen engine tests were checked against the decision and all 30 remain correct** — every asserted position sits in an interval either exactly the task's length or after the preferred window. *Original question:* ~~**Where a candidate slot starts inside a free interval longer than the task.**~~ Two plausible rules — **earliest start in the interval**, or **start closest to the preferred window**. ⚠️ **Appendix A cannot tell them apart**: in all three of its ranked candidates they give the same answer, so the example that reads like an oracle is silent here. They diverge whenever an over-long free interval sits *before* the preferred window (free 07:00–10:00, 60-min task, 10:00 preferred → 07:00 vs 09:00). **The frozen engine suite deliberately asserts no start position in a case where they disagree**, so either answer can be adopted without touching a test — but if nobody adopts one, **packet 05 settles it silently** and it becomes an unstated requirement living only in the implementation. *(SRS Appendix C OPEN-13; raised by the packet 04 RED agent.)* | **Patrick Rucker** | **Before packet 05** | ✅ **Closed** |
| **OPEN-15** | ✅ **CLOSED 22 Jul — `Task.createdAt` added (ISO 8601 UTC instant, optional in the type); absent or identical instants fall through to ascending `id`. FR-SCH-10 note added, SRS v2.11.** Rejected `id`-only and repository-supplied-order, both of which fail silently — see the decision-log row above. Frozen engine suite verified unaffected. *Original below.* ~~**FR-SCH-10's "earlier-created" tiebreak has nothing to read.**~~ The requirement says equal-priority tasks are placed earlier-created first *"so that the order is total and repeatable"* — but `Task` in the frozen contract carries **no creation timestamp**: `id`, `title`, `type`, `durationMinutes`, `priority`, `preferredWindow`, `flexibility`, `source`, `intensityTier`, and nothing else. **As written, the tiebreak cannot be evaluated.** ⚠️ **Structurally identical to the FR-SCH-03(b) defect closed this morning** — a criterion the code has no field to read — and the available workarounds are all silent: tiebreaking on `id`, on insertion order, or on whatever Mongo returns would satisfy every test while making *"total and repeatable"* false. **Adding a field to `contract.ts` is a §4.7 team decision**, so packet 06's RED agent is instructed to escalate rather than guess. *(Found while authoring packet 06.)* | **Patrick Rucker** | **Before packet 06's gate** | ✅ **Closed** |
| **OPEN-16** | ✅ **CLOSED 22 Jul — all three parts, before packet 06 ran.** **(1)** rank 1, all three triggers, day narrowed to start at `now` (v2.12). **(2)** unplaced is the absence of a placement; offer acted on via `moveToNextDay` (v2.13). **(3)** idempotency by occurrence state, no trigger log, termination proved from strictly-later successors (v2.13). *Originals below.* ~~**(1) FR-RSC-01** says the missed task goes in *"the next valid slot remaining that day"* — but FR-SCH-02 returns **up to three ranked candidates**, and the SRS never says whether the automatic path takes the engine's **rank 1** or the **earliest remaining**; they are not always the same slot.~~ ~~**(2) FR-RSC-05** says the System *"shall offer to move it to the next day"* — whether the service **creates** a next-day placement or **surfaces an offer** the user must accept produces different stored state, different task counts, and therefore different tests.~~ **(3) FR-RSC-06** requires *"the same trigger processed twice"* to be idempotent, without defining what makes two triggers the same one — placement? trigger kind? occurrence? — and idempotency cannot be tested without that answer. **All three are frozen into executable form by packet 06**, so an invented answer becomes a requirement nobody agreed to and packet 07 implements it faithfully. *(Found while authoring packet 06; listed in its escalation clause.)* | **Patrick Rucker** | **Before packet 06's gate** | ✅ **Closed** |
| **OPEN-14** | ✅ **CLOSED 22 Jul — corrected in both copies to `(FR-SCH-10 placement order; FR-SCH-07 displacement.)`.** Comment only; no type, field or behaviour changed. Authorised by Patrick, per §4.7. *Original:* ~~**`shared/src/contract.ts` line 71 documents `priority` as "(FR-SCH-03 ranking tiebreak)" — that is now false.** FR-SCH-03 no longer uses priority (SRS v2.7). The field itself is correct and unchanged; **only the comment's justification is stale**. It should now read **`(FR-SCH-10 placement order; FR-SCH-07 displacement.)`** — FR-SCH-10 being priority's Essential consumer as of v2.8. ⚠️ **Not edited by the agent on purpose:** §4.7 makes `contract.ts` human-owned, and an agent that edits it — even a comment — has crossed the line the rule draws. The same sentence appears in `prompts/foundation/03-shared-contract-types.md` line 121 and must change with it, or the two disagree. **A one-line fix, but it is Patrick's line to change.** | **Patrick Rucker** | **Before packet 05** | ✅ **Closed** |

---

# ✅ ACTION ITEMS

| # | Action | Owner | Due | Done |
|---|---|---|---|---|
| 1 | **Pull the Garmin export and report what fields it actually contains.** ⚠️ **Critical path** — the sleep-score formula and the meal library's calorie assumptions are guesses until this is done. | **Ryan** | **16 Jul** | ☐ |
| 2 | ~~Send role assignments~~ — **done. SRS cover page, all 49 TOC annotations, and the signature block are updated.** | Patrick | 12 Jul | ✅ |
| 3 | **Read `AGENTIC-TDD-WORKFLOW.md`** — all three of us, before any code is written. It is self-contained; it assumes you've seen none of this. **§2 is the argument** (the three ways agentic TDD fails silently — **read the worked example in §2.1**, it's the whole thing in one code block). **§6 is the checklist you will personally run.** | All | 13 Jul | ☐ |
| 4 | **Ratify the contract** (`prompts/foundation/03-shared-contract-types.md`) — read it line by line, together. **This is the hour that lets us work in parallel.** Once agents are running, changing it is expensive. | All | 13 Jul | ☐ |
| 5 | Create the repo — **run `prompts/foundation/01-project-scaffold.md`** | **Patrick** | 13 Jul | ☐ |
| 6 | **Engine RED** — run `prompts/engine/04-engine-tests-RED.md`. Output is a **failing** suite. *(A green suite means the agent wrote the engine and the packet failed.)* | **Patrick** | 14 Jul | ☐ |
| 7 | **HUMAN GATE** — read every engine test against the requirement it cites. Not *"do they pass"* — **"are they right."** ⚠️ **Do not skip this. It is the review that carries the project; the code is checked by the tests, and the tests are checked by nothing but us.** | **Patrick + 1 other** | 14 Jul | ☐ |
| 8 | **Engine GREEN** — run `prompts/engine/05-engine-implementation-GREEN.md`. Agent **may not edit a test**; escalations come to a human. | **Patrick** | 15 Jul | ☐ |
| 9 | **Mongo collections** — **one document per metric per date**, *not* one field per metric (DR-05). ⚠️ **A schema-free store permits the wrong shape; DR-05 still forbids it.** | **Miguel** | 15 Jul | ☐ |
| 10 | Frontend scaffolding against a **mocked** API, typed from the contract so it can't drift. **Do not wait for the backend.** | **Miguel** | 17 Jul | ☐ |
| 11 | Write the (I)-requirement CI guards: **one-placement-function** (FR-RSC-03), **no-network-in-recommendation** (FR-LIB-02) | **Patrick** | 18 Jul | ☐ |
| 12 | **Ask the professor the three questions in OPEN-10** (AI-written prompts? AI-written tests? deliverable format?) | Patrick | Before 16 Jul | ☐ |
| 13 | **Resolve the workload imbalance** (OPEN-09) — Miguel currently owns frontend *and* backend | Patrick | Meeting 2 | ☐ |
| 14 | **Ratify the scope cuts** (OPEN-11) — FR-REC-10 and NFR-MNT-02 → Conditional | Patrick | Meeting 2 | ☐ |
| 15 | `.ics` export (FR-CAL-07) — **Conditional. Do not start until all Essential work is verified.** | Miguel | after 27 Jul | ☐ |
| | | | | ☐ |
