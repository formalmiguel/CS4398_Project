# Final Presentation — Outline and Speaker Notes

**31 July 2026 · CS 4398 Software Engineering Capstone**
**Adaptive Habit, Schedule & Wellness System**

> **Companion deck:** `docs/PRESENTATION.html` — open it in a browser and press `F` for full screen. Arrow keys or space to advance. It is self-contained: no network, no fonts, no CDN, nothing to fail in front of the room.

---

## Why this outline is shaped the way it is

The professor's email set the expectations, and they are **not** what a capstone team usually plans for:

> *"I want all members of a group doing the final presentation to be present and mention their contribution to the project.*
>
> *I will want you to describe **how you used the agentic development most of all**. Present your context files, describe how you generated prompts based on that context.*
>
> *Describe the structure, process, V&V approach (especially if it is systematic testing with quantitative results as a demonstrable result such as "100% line coverage" etc).*
>
> *Demo the system too, of course."*

**Three of his four asks are about how the system was built. The demo is the fourth and he says "of course."** So the running order below front-loads method and treats the demo as the payoff, not the centrepiece.

**If time runs short, cut the demo — not the method.** Acts 1 and 2 of the demo can go; act 3 cannot, because it is the project's central claim.

---

## Verified numbers — and the command to prove each one

Every figure below was measured on 30 July 2026, not quoted from a document. **Every command in this section was run and its output checked before being written here**, in both Git Bash and PowerShell.

⚠️ **Run all of these once on the presentation machine before you go on.** Run them from the repository root.

### The five worth demonstrating live

These are the ones that answer his "quantitative results" ask directly. Times are from a warm run on the dev laptop.

**The table is in the order you should run them.**

| # | Metric | Value | Command | Time |
|---|---|---|---|---|
| 1 | Engine coverage — NFR-MNT-01 | **100%** stmts / branches / funcs / lines, 30 tests | `npx jest --selectProjects engine --coverage` | ~5 s |
| 2 | One placement function — FR-RSC-03 | prints the enforced invariant | `npm run guard:single-placement` | <1 s |
| 3 | Frozen suites — §4.12(b) | **8 suites**, each verified by sha256 | `npm run guard:tests-frozen` | <1 s |
| 4 | Property test — NFR-COR-01 | **1,000 randomized days**, no placement overlaps a busy interval | `npx jest engine/test/property.test.ts` | ~1 s |
| 5 | Full suite + typecheck + lint + all guards | **510 tests, 41 suites, exit 0** | `npm run verify` | ~31 s |

> **Why this order:** **#1 leads because it is five seconds and ends in a 100% coverage table — literally the example he named in the email.** Open on your strongest number, not on a progress bar. **#2 and #3** are instant and are the interesting ones conceptually. **#5 (`npm run verify`) closes**, because 31 seconds of scrolling output is something to talk *over*, not wait for — start it and narrate while it runs.
>
> ⚠️ **Do not run `npm run verify` cold on an unfamiliar machine** — the first run compiles TypeScript and can take considerably longer than 31 seconds. Run it once beforehand so the caches are warm.

### The other six guards, individually

All six run inside `npm run verify`; these are for showing one in isolation. Each prints a sentence naming the requirement it enforces.

```
npm run guard:engine-deps               # engine and shared declare zero runtime dependencies (FR-SCH-05)
npm run guard:engine-purity             # engine/src reaches no clock, RNG, timer, network or process global (FR-SCH-05)
npm run guard:single-placement          # exactly one placement definition (FR-RSC-03, NFR-MNT-03)
npm run guard:offline-recommendation    # recommendation path imports no network client (FR-LIB-02)
npm run guard:metric-extensibility      # metric names appear only in their own rule + adapter (FR-REC-11, FR-WER-04)
npm run guard:tests-frozen              # all 8 frozen suites unchanged, by sha256
```

### Counts — if someone asks where a number came from

| Metric | Value |
|---|---|
| Packet files | **26** |
| FR/NFR requirements defined | **136** |
| CON/DR/SI/DEP/UI defined | **33** |
| Executable guards | **6** |
| Commits | **193** |
| RED/GREEN boundary commits | **20** |
| Frozen files | **33** across 8 suites (`npm run guard:tests-frozen` lists them) |

⚠️ **Two shells, two syntaxes.** The `npm`/`npx` commands above work identically everywhere; these do not. **Copy from the fenced blocks below, not from a table** — table cells would need their pipes escaped, and an escaped pipe pasted into a terminal is a broken command.

**Git Bash:**

```bash
find prompts -name "*.md" | grep -cE "/[0-9]"                                   # 26 packets
grep -cE "^\s*[-*] \*\*(FR|NFR)-[A-Z]{3}-[0-9]{2}\.\*\*" docs/SRS-v2.md         # 136 requirements
grep -cE "^\s*[-*] \*\*(CON|DR|SI|DEP|UI)-[0-9]{2}\.\*\*" docs/SRS-v2.md        # 33 constraints etc
ls scripts/guard-*.mjs | wc -l                                                  # 6 guards
git log --oneline | wc -l                                                       # 193 commits
git log --format="%s" | grep -cE "^P[0-9]+[a-d]? (RED|GREEN)"                   # 20 RED/GREEN
```

**PowerShell:**

```powershell
(Get-ChildItem prompts -Recurse -Filter *.md | Where-Object { $_.Name -match '^\d' }).Count
(Select-String -Path docs/SRS-v2.md -Pattern '^\s*[-*] \*\*(FR|NFR)-[A-Z]{3}-\d{2}\.\*\*').Count
(Select-String -Path docs/SRS-v2.md -Pattern '^\s*[-*] \*\*(CON|DR|SI|DEP|UI)-\d{2}\.\*\*').Count
(Get-ChildItem scripts -Filter guard-*.mjs).Count
(git log --oneline | Measure-Object -Line).Lines
(git log --format=%s | Select-String -Pattern '^P\d+[a-d]? (RED|GREEN)').Count
```

> ⚠️ **The commit counts move.** 193 and 20 were true at commit `8343003` on 30 July. Re-run before quoting, or say "about 190."

> ⚠️ **`CLAUDE.md` §3 still describes the SRS as having "~84 numbered verifiable requirements." That is stale** — 136 FR/NFR are defined today. Quote 136, and fix the context file when someone has a spare minute.

---

## Running order

| # | Slide | Owner | Time |
|---|---|---|---|
| 1 | Title + contributions | All three | 1.5 min |
| 2 | What we were asked to show | Anyone | 0.5 min |
| 3–5 | Context files and prompt generation | Patrick | 4 min |
| 6–7 | Where we differ from the example pack ⭐ | Patrick | 3 min |
| 8–9 | Structure and process | Patrick | 3 min |
| 10–12 | V&V, quantitative ⭐ | Patrick | 4 min |
| 13 | V&V working, this week ⭐ | Patrick | 2 min |
| 14 | Demo — three acts | Ryan + Miguel | 4 min |
| 15 | Honest gaps | Whoever owns each | 1 min |
| 16 | Close | All | 0.5 min |

**Total ≈ 23 minutes.** Slides marked ⭐ are the ones that differentiate this project. Protect them.

---

## Slide 1 — Title and contributions

Each person says **one sentence naming their packets.** Checkable beats impressive.

- **Patrick Rucker** — *Scheduling Algorithm Lead.* Packets 04–07 (engine, reschedule service), 16a/16b (executable guards), 17a–17d (acceptance suite and the recommendation wiring).
- **Ryan Woosley** — *Data & Wearable Integration Lead.* Packets 08–11 (Garmin adapter, Daily Metric Set, recommendation rules, seeded libraries), 14/15 (wellness and analytics), and the ingestion CLI that put **50 real metric sets** from his own Garmin export through the system.
- **Miguel Alvarez** — *Frontend & Backend Lead.* Packet 12 (API and persistence), 13/13b (dashboard, month navigator, theme), the `.ics` export, and the reschedule UI work.

**Framing line, said once, up front:**

> *"The team wrote the requirements and directed the agents. The agents wrote the code. Everything we're about to show you is about how we kept that honest."*

---

## Slide 2 — What we were asked to show

Put his four asks on screen and tick them off as you go. It signals you read the email and it gives the audience a map.

---

## Slide 3 — "Your chat context is not the project's memory"

**Show:** `CLAUDE.md` §0 — the *when X happens → update Y* table.

**Say:** A conversation ends and takes its context with it. A file does not. Three people, multiple AI sessions, nineteen days — anything that exists only in a chat log is effectively lost and gets re-argued from scratch by the next session. So the first thing in our context file is a standing instruction to every agent: **when something is decided, write it into the affected file in the same turn.**

**If asked "did that actually happen?"** — `docs/TEAM-MEETING.md` has a dated decision log with the reasoning for every significant call, including the ones made this week.

---

## Slide 4 — Decisions Already Made — Do Not Re-Litigate

**Show:** the §4 headings.

**Say:** This section exists because agents re-propose rejected ideas fluently and confidently. §4.1 records that the official Garmin Health API is off the critical path, and *why* — partner approval with a lead time we cannot schedule against 31 July. Without the reasoning written down, every new session suggests it again, and someone re-argues it every time.

**The line:**

> *"We're not just documenting what we did. We're documenting what we decided **not** to do, and why — because that's what an agent will otherwise undo."*

---

## Slide 5 — How prompts are generated from the context

**Show:** the `prompts/` tree — 26 files across `foundation/`, `engine/`, `wearable/`, `backend/`, `frontend/`, `verification/`.

**Say:**
- One packet ≈ one agent session ≈ one reviewable diff ≈ one human owner.
- **Numbers are the delivery order; folders are the ownership.** Two different axes, both load-bearing.
- The SRS is the prompt corpus. A packet quotes requirement IDs, boundary tables and constraints **verbatim** — because those are obligations the code must satisfy.
- **Each owner authors their own packet immediately before running it.** A prompt written weeks before its module is designed encodes guesses, and an agent implements a guess as faithfully as it implements a requirement.

> *"A prompt that doesn't exist yet is visibly missing. A prompt written from speculation is invisibly wrong."*

---

## Slide 6 ⭐ — Where we deliberately differ from the example pack

**Do not skip this slide. It is the strongest thing you have.**

**Show:** two columns — *Example pack: finished `.java` files* / *Ours: requirements only*.

**Say:** We conform to the house style — numbered `01`…`17` in delivery order, a `00-` summary, a phase map, and the five named techniques (Sandwich Method, Attention Anchoring, Visual Emphasis, Clear Delimiters, Selective Context).

**But his prompts contain the implementation and ours do not — and that is not a disagreement about method:**

> *"His pack was written backwards from a program he already had, so the output got pasted back in. Ours is written forwards to one that didn't exist yet. A prompt pack is a generator: run it in order and the agent creates the code."*

**Therefore re-running the pack may produce different code, and that is expected.**

---

## Slide 7 ⭐ — Why the implementation must never enter a prompt

**The sharpest thing you will say all presentation. Say it slowly.**

> *"If you paste the implementation into the prompt, the tests start checking the code against itself. The coverage number stays green and stops measuring anything. And you don't find out — because nothing fails."*

**Then the second cost:** whichever way that one run happened to merge intervals or order its comparisons becomes the specification, indistinguishable from a requirement the team actually agreed on.

**Close with the falsifiable claim:**

> *"Delete `engine/src/`, re-run packet 05, and the 30 frozen engine tests still pass. The implementation is disposable. The specification and its executable form are not."*

**Q&A prep — "so how do you keep runs consistent?"** The frozen tests are the only invariant across runs. That's exactly why they're written first (packet 04) and committed before any implementation exists (packet 05).

---

## Slide 8 — Structure

**Show:** `engine` (pure, zero dependencies) → `server` (`reschedule` / `recommendation` / `api` / `db`) → `web`.

**Say:**
- **Exactly one function in this system produces a placement.** Rescheduling is not a second algorithm — it re-invokes the same one.
- The engine has an **empty dependency block, permanently**: an engine that cannot import anything cannot import a clock.
- Time is an integer `Minute` — minutes since local midnight. The engine never sees a `Date`. That is what makes its purity structural rather than aspirational, and it is what lets it be property-tested with no database and no browser.

---

## Slide 9 — Process: RED and GREEN are different agent sessions

**Show:** RED agent (sees SRS + contract, never an implementation) → **human gate** → frozen → GREEN agent (sees failing tests, may not edit one).

**Say:** If the GREEN agent believes a test is wrong, it **stops and a human adjudicates it against the SRS**. It may not edit, skip, or weaken a test — ever.

**Why it can't be collapsed "for speed":** when one agent writes the test and the implementation together, the test encodes what the code *does* rather than what the requirement *says*. It goes green, it looks reasonable, and it is wrong — and you find out on presentation day. **This is structural. It cannot be fixed by asking the agent to be careful.**

**Numbers to have ready:** ~193 commits, 20 of them explicit RED/GREEN boundary commits.

---

## Slide 10 ⭐ — V&V, quantitative

**Show the table big. Then run `npm run verify` live.** It takes ~31 seconds and ends in a coverage table showing 100%. He named "100% line coverage" as his example of what he wants to see — this is literally it.

**Say while it runs:** the suite covers five levels — unit, property, integration, contract, and acceptance — using Jest, fast-check, supertest and `mongodb-memory-server`. `docs/TESTING.md` records which tool was chosen for what and, importantly, the three that were **costed and rejected** (Postman/Newman, Vitest + RTL, Playwright/Cypress) so nobody re-proposes them.

---

## Slide 11 — Two mechanisms, 30 seconds each

**`npm run guard:single-placement`**

> *"Ask an agent for FR-RSC-02 — repair the schedule when a commitment displaces a task — and it will write a tidy little `findNextFreeSlot()` inside the reschedule service, because that is locally the simplest thing to do. FR-RSC-03 is now false. **No test fails.**"*

Then show the guard's own output: *exactly one placement definition (`findCandidateSlots`, `engine/src`)*.

**`npm run guard:tests-frozen`**

Hashes, not commits — because a commit-based freeze needs the repository *and* that commit reachable, and neither holds in a shallow CI checkout or during a rebuild from the specification. Hashes catch an edited test, an edited-**and-committed** test, a deleted test, **and a file quietly added to a frozen suite.**

---

## Slide 12 ⭐ — The rule that makes a guard mean anything

> *"A guard that has never been observed to fail doesn't count."*

Every guard is watched failing against a deliberately introduced violation before it is trusted. Packet 16b produced **14 must-fail transcripts where 11 were required.**

**Why this matters:** a green guard that enforces nothing exits 0 exactly like a working one. From the outside they are indistinguishable. **This project has shipped that mistake twice and caught it both times** — which is the reason the rule exists in writing rather than as good intentions.

---

## Slide 13 ⭐ — V&V working, this week

**Use the bug found on 30 July. It is the best evidence that the process is real rather than decorative — and volunteering it is far stronger than being asked.**

**Say:** While rehearsing this demonstration, applying a recommendation to *tomorrow's* schedule returned "no workout above LOW to replace" — for a workout that had not started. The code asked `placement.start <= clock.nowMinute()`: a minute-of-day comparison carrying no calendar. Wrong in both directions — a future date's workout read as already begun, and a past date's read as still upcoming, so a finished day's history could be rewritten.

**The honest part, which is the valuable part:**

> *"507 passing tests did not catch it, because every frozen suite applies the recommendation to the clock's own date — the one configuration where the bug is invisible. We found it by running the system, not by running the suite."*

**Then:** fixed with a date-aware check mirroring the one the reschedule service already had; pinned by three new tests, **two of them watched failing first**; SRS corrected in place to v2.41; 510 green, all 8 freeze entries unchanged.

**Land it:**

> *"Systematic testing tells you what you checked. It does not tell you what you forgot to check. That's why we still rehearse against a running server."*

---

## Slide 14 — Demo, three acts

**Account:** `demo-31jul@test.com` · **Date:** 31 July 2026 · eight tasks already placed.

**Act 1 — The day.** Two fixed commitments (09:00 lecture, 13:00 standup) and six flexible tasks the engine placed around them.

**Act 2 — Repair.** Add *Dentist Appointment* at 14:00 → **Study CS4398 is displaced and re-placed at 15:00–16:30** by the same engine, and the Rescheduled panel shows old → new. Then try a second class at 09:00 → **409, "That time conflicts with CS4398 Capstone Lecture."**

**Act 3 — The claim.** Inject sleep score 40 → tier drops to **LOW**, calorie target rises above the 2,000 baseline → **apply the workout** → it becomes a real `SYSTEM` task placed by the same engine → then drop a commitment on it and watch it get displaced and re-placed exactly like a user task.

> *"That's the whole thesis. Not a scheduler and a fitness app sharing a login — one system. A recommendation is defended by the same logic as everything else on the calendar."*

**Rehearsed and verified 30 July:** all of acts 1 and 2, plus `.ics` export and analytics, were driven against the running server and behaved as described.

---

## Slide 15 — Honest gaps

**Say these before anyone finds them. A team that documents its own gaps is more credible than one that appears flawless.**

- **FR-WEL-04 is not satisfied.** The seven-day wellness panel was removed at the requirement owner's request. We flagged it, recorded it as OPEN-37, and updated the SRS to say so rather than let the document assert a capability the build no longer has.
- **No Conditional work was undertaken.** Priority displacement, the live Garmin API, and the external content API are all deliberately out of scope, recorded with reasons on 26 July.
- **The wellness click-to-schedule path and the background sweep have no automated coverage.** Ad hoc frontend work, flagged rather than implied.

---

## Slide 16 — Close

One sentence each on what you'd build next, then the thesis restated: **a recommendation that becomes a real task on a real calendar, defended by the same engine as everything else.**

---

## Pre-flight checklist

- [ ] **Run `npm run verify` on the presentation machine and projector** — slide 10 is the one with the most to lose.
- [ ] Start `mongod`, the API server, and Vite; confirm `demo-31jul@test.com` logs in.
- [ ] Confirm the demo date shows all eight tasks.
- [ ] Decide whether to promote `main` — see below.
- [ ] Have `CLAUDE.md`, `prompts/`, and a terminal open in separate windows, ready to show without hunting.
- [ ] Know who is driving the laptop for each section.

---

## Two decisions still open

**1. `main` is still the repository's default branch and sits at the 21 July pre-implementation state.**
The team dropped this from tracking on 28 July, which was reasonable when nobody outside the team was reading the repo. **The professor's email changes that calculus** — *"present your context files"* means he may well open the repository, and he would land on a branch with no engine, no server, no tests and no guards. Promotion is one merge with zero conflicts (`dev` is strictly ahead). **This is a judgment call for the owner, not a tracked work item.**

**2. `CLAUDE.md` §3 says the SRS has "~84 numbered verifiable requirements."**
It has **136** FR/NFR defined, plus 33 CON/DR/SI/DEP/UI. Quote 136 tomorrow; fix the context file when convenient.
