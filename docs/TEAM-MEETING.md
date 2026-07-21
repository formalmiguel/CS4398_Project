# Team Meeting — Agenda, Questions, and Decision Log

**Project:** Adaptive Habit, Schedule & Wellness System
**Team:** Patrick Rucker · Miguel Alvarez · Ryan Woosley

> **How to use this file.** The top section is the agenda for the next meeting. Below it is a **permanent decision log** — every decision the team makes gets a row, with the date and the reasoning. The reasoning matters more than the decision: six months from now, and three weeks from now, the *why* is what stops you re-arguing something you already settled.

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
| **21 Jul** | **Runtime dependencies chosen — Miguel's call, as backend owner.** `server/`: **Express** (HTTP), **the official `mongodb` driver** (not Mongoose), **bcrypt** (hashing), **jsonwebtoken** (sessions), plus `cors` and `dotenv`. `web/`: **React + Vite**. `engine/` and `shared/`: **nothing, permanently.** Pinned into `prompts/02-toolchain-and-dependencies.md`; exact versions come from the committed root `package-lock.json`. | **These were about to be decided by an agent.** Packet 02 named tool *categories* (Jest, ESLint, fast-check) but no runtime packages, so whoever ran it would have picked the framework, the data layer, the hashing library and the session strategy by default — and *"we use Mongoose"* would have become true because an agent typed it, not because anyone chose it. **The `mongodb` driver over Mongoose is the choice that carries weight:** DR-05 requires *one document per metric per date, not one field per metric*, so a new metric is an insert rather than a change to every reader. **A Mongoose schema can quietly fight that shape and nothing would fail a test** — FUT-02 would just become expensive months later. The raw driver has no opinion, so DR-05 ends up satisfied by code the team wrote rather than a library default nobody reviewed. **Express 4 and React 18 (not 5 / 19)** for documentation maturity — on nineteen days the boring option ships. ⚠️ **Watched risk: `bcrypt` is a native module.** If it ever attempts compilation on a machine without build tools, `npm ci` fails and **CON-10 breaks**; packet 02 now verifies a clean-machine install explicitly, and `bcryptjs` is the drop-in fallback **if the team decides so**. | Miguel (decided) · Patrick + AI (framed) |
| **21 Jul** | **Work packets restructured to the professor's prompt-pack format.** Renumbered `WP-00/01/02` → **`01`…`17`**, delivered in exact numerical order, with a `00-prompt-collection-summary.md` index and a `README-prompts.md` phase map. Adopted his five named techniques (Sandwich Method, Attention Anchoring, Visual Emphasis, Clear Delimiters, Selective Context). **`WP-00` split into three** — scaffold / toolchain / contract — mirroring his `01-setup` / `02-gradle` / `03-interface` sequence. | He supplied an example pack (MVC calculator, 15 prompts) that **names those five techniques in two separate files** — they are lecture terms and almost certainly rubric lines, so conforming costs nothing. Our substance survives intact: the escalation clause, must-not-touch lists, verbatim SRS quotes and mechanical done-criteria are all **stronger than his example**, whose verification is *"compiles without errors."* **His prompts contain finished `.java` files; ours contain requirements — and that is NOT a disagreement about method.** Patrick's reading, and it is correct: **a prompt pack is a generator.** Run it in order and the agent creates the code. His `.java` blocks are residue from a run he had **already** performed — his pack was written *backwards* from a finished program, ours *forwards* to one that does not exist yet. Same artifact, opposite ends of its life. **Nothing here needs the professor's adjudication.** **The consequence worth recording: re-running the pack may produce different code, so (a) generated code is NEVER pasted back into a prompt — that would freeze one run's arbitrary choices into the spec and make NFR-MNT-01's coverage figure measure the code against itself — and (b) the frozen tests are the only invariant across runs, which is the strongest argument yet for the RED/GREEN order.** *Demonstrable claim: delete `engine/src/`, re-run prompt 05, the suite still passes.* **Prompts 06–17 are enumerated with requirement IDs but deliberately unwritten** — a prompt authored before its module is designed encodes guesses, and an agent implements a guess as faithfully as a requirement. **Also: ~30 `WP-` cross-references across `CLAUDE.md`, `AGENTIC-TDD-WORKFLOW.md` and this file had to be remapped** — §0 rule 3 in miniature. | Patrick + AI |
| 12 Jul | **SRS → v2.3: the §3.6 engine signature was corrected. It could not satisfy its own requirements.** Now returns `PlacementResult` (a discriminated union), and takes `schedulableDay` as a parameter. | The diagram said `findCandidateSlots(busy, task) → Slot[]`. But **FR-SCH-06 demands an "explicit empty result *with a reason*" — and an empty array carries no reason**, so the signature made its own requirement unsatisfiable at the type level and let a caller ignore the failure by iterating nothing. And FR-SCH-04 requires staying inside the schedulable day, which the engine can't know while FR-SCH-05 denies it a clock — so the caller must **tell** it. **No requirement changed; the design was brought into conformance with requirements it already had.** Found by deriving the code contract from the SRS — which is an argument for doing that early. | Patrick + AI |

---

# 🔓 OPEN ISSUES

*Mirrors Appendix C of the SRS. Close them here as they're resolved.*

| ID | Issue | Owner | Due | Status |
|---|---|---|---|---|
| **OPEN-01** | **Pull a real Garmin export; confirm it has a sleep score AND active calories.** Critical path — the sleep-score formula and the meal library's calorie assumptions are guesses until this is done. | **Ryan Woosley** | **16 Jul** | 🔴 Open |
| **OPEN-02** | Sleep-score derivation formula (if the export has no single published score). Depends on OPEN-01. | | 16 Jul | 🔴 Open |
| **OPEN-03** | ~~Calendar source.~~ **CLOSED 12 Jul.** Import declined; **`.ics` export adopted** (SI-06 / FR-CAL-07, Conditional). Fixed commitments come from **manual entry only**. | Miguel | — | ✅ **Closed** |
| **OPEN-09** | **Workload imbalance: Miguel has frontend AND backend.** He is the critical path while the engine owner has spare capacity from ~day 4. **Rebalance proposal: Patrick takes the backend API after the engine ships.** | Patrick | **Meeting 2** | 🔴 Open |
| **OPEN-10** | **Questions for the professor** — (1) is AI-generated prompting acceptable? (2) does he expect tests to be human-written? *(This one has teeth: NFR-MNT-01's 90% coverage and NFR-COR-01's property tests stop meaning what they appear to mean if one agent writes both the tests and the code.)* (3) deliverable format for the SRS? | Patrick | Before 16 Jul | 🔴 Open |
| **OPEN-11** | **Scope cuts not yet ratified** — team didn't recall them at Meeting 1. FR-REC-10 and NFR-MNT-02 → Conditional. Re-stated at the top of this file. | Patrick | **Meeting 2** | 🔴 Open |
| **OPEN-04** | Pick the exercise dataset + confirm its license. Author the meal library **with calorie counts** — without them FR-REC-08 has nothing to target. | | 20 Jul | 🔴 Open |
| **OPEN-05** | Whether to attempt a live wearable API at all. **Do not open until all Essential work is verified.** | | 27 Jul | ⚪ Deferred |
| **OPEN-06** | Whether priority displacement (FR-SCH-07/08) is in scope. | | 27 Jul | ⚪ Deferred |
| **OPEN-07** | ~~Garmin Developer Program application.~~ | — | — | ✅ **Closed — excluded** |
| **OPEN-08** | **Team roles.** Blocks the SRS's annotated TOC and signature page. | Patrick | **12 Jul** | 🔴 Open |

---

# ✅ ACTION ITEMS

| # | Action | Owner | Due | Done |
|---|---|---|---|---|
| 1 | **Pull the Garmin export and report what fields it actually contains.** ⚠️ **Critical path** — the sleep-score formula and the meal library's calorie assumptions are guesses until this is done. | **Ryan** | **16 Jul** | ☐ |
| 2 | ~~Send role assignments~~ — **done. SRS cover page, all 49 TOC annotations, and the signature block are updated.** | Patrick | 12 Jul | ✅ |
| 3 | **Read `AGENTIC-TDD-WORKFLOW.md`** — all three of us, before any code is written. It is self-contained; it assumes you've seen none of this. **§2 is the argument** (the three ways agentic TDD fails silently — **read the worked example in §2.1**, it's the whole thing in one code block). **§6 is the checklist you will personally run.** | All | 13 Jul | ☐ |
| 4 | **Ratify the contract** (`prompts/03-shared-contract-types.md`) — read it line by line, together. **This is the hour that lets us work in parallel.** Once agents are running, changing it is expensive. | All | 13 Jul | ☐ |
| 5 | Create the repo — **run `prompts/01-project-scaffold.md`** | **Patrick** | 13 Jul | ☐ |
| 6 | **Engine RED** — run `prompts/04-engine-tests-RED.md`. Output is a **failing** suite. *(A green suite means the agent wrote the engine and the packet failed.)* | **Patrick** | 14 Jul | ☐ |
| 7 | **HUMAN GATE** — read every engine test against the requirement it cites. Not *"do they pass"* — **"are they right."** ⚠️ **Do not skip this. It is the review that carries the project; the code is checked by the tests, and the tests are checked by nothing but us.** | **Patrick + 1 other** | 14 Jul | ☐ |
| 8 | **Engine GREEN** — run `prompts/05-engine-implementation-GREEN.md`. Agent **may not edit a test**; escalations come to a human. | **Patrick** | 15 Jul | ☐ |
| 9 | **Mongo collections** — **one document per metric per date**, *not* one field per metric (DR-05). ⚠️ **A schema-free store permits the wrong shape; DR-05 still forbids it.** | **Miguel** | 15 Jul | ☐ |
| 10 | Frontend scaffolding against a **mocked** API, typed from the contract so it can't drift. **Do not wait for the backend.** | **Miguel** | 17 Jul | ☐ |
| 11 | Write the (I)-requirement CI guards: **one-placement-function** (FR-RSC-03), **no-network-in-recommendation** (FR-LIB-02) | **Patrick** | 18 Jul | ☐ |
| 12 | **Ask the professor the three questions in OPEN-10** (AI-written prompts? AI-written tests? deliverable format?) | Patrick | Before 16 Jul | ☐ |
| 13 | **Resolve the workload imbalance** (OPEN-09) — Miguel currently owns frontend *and* backend | Patrick | Meeting 2 | ☐ |
| 14 | **Ratify the scope cuts** (OPEN-11) — FR-REC-10 and NFR-MNT-02 → Conditional | Patrick | Meeting 2 | ☐ |
| 15 | `.ics` export (FR-CAL-07) — **Conditional. Do not start until all Essential work is verified.** | Miguel | after 27 Jul | ☐ |
| | | | | ☐ |
