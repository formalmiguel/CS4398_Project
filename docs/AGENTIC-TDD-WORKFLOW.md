# Agentic TDD — How We Build This

**Status:** Adopted 12 July 2026 · **Applies to:** every line of code in the project
**Audience:** Patrick, Miguel, Ryan. **Read this before you write or generate any code.**
**Companion files:** `SRS-v2.md` (the spec) · `../prompts/` (the work packets) · `TEAM-MEETING.md` (the decision log) · `../CLAUDE.md` (project context for AI sessions)

---

## How to read this document

You do not need to have been in any prior conversation. Everything is here.

| If you have… | Read |
|---|---|
| **5 minutes** | §1 (the summary) and §4 (the loop diagram). That's enough to not break anything. |
| **20 minutes** | Add §2 (why we work this way — **the part that actually convinces you**) and §6 (the human gate checklist — **the thing you will personally do**). |
| **Before you run your first agent session** | §5 (the mechanics, with commands) and §8 (what to do when it goes wrong). |
| **Before you write a new work packet** | §7. |

**The one section nobody may skip is §6.** It is the job that falls to a human, it is the job that carries the project, and it is the easiest one to do badly while believing you did it well.

---

## 1. The summary

We are building this with **agentic coding** (AI agents write the code; we direct and review) and **test-driven development** (tests are written before the implementation). Those two things interact badly by default, and this document is how we stop them from doing that.

Three ideas, and everything else is detail:

> **1. The SRS is the prompt.** We do not translate requirements into prompts. The SRS already has ~84 numbered, verifiable requirements — **FR-SCH-09 is literally a table of eight required test cases.** We quote it verbatim into work packets. Paraphrasing is where requirements quietly change.
>
> **2. The agent that writes the tests is never the agent that writes the code.** Different session, different permissions. **The implementer may not edit a test — ever.** If it can't pass one, it stops and a human decides whether the test or the code is wrong.
>
> **3. Between the two sits a human who reads the tests against the SRS.** Not "do the tests pass" — *"are the tests right."* This review is the bottleneck of the project and it is not optional.

If you remember nothing else: **the code is checked by the tests, and the tests are checked by nothing but us.**

### Vocabulary

| Term | Meaning |
|---|---|
| **The contract** | `shared/src/contract.ts` — the domain types (`Task`, `Interval`, `PlacementResult`, …). Written by a human, once. Every module imports from it. Nobody redefines anything in it. |
| **Work packet** | One file in `prompts/`. One agent session, one reviewable diff, one human owner. **Not** one per requirement, **not** one per module. |
| **RED** | An agent session that writes **tests only**. Its output is a suite that **fails**. |
| **GREEN** | An agent session that writes **implementation only**, to pass the frozen tests. **It cannot touch a test file.** |
| **The human gate** | The review between RED and GREEN. §6. |
| **Guard** | A test that enforces an *architectural* requirement — one the SRS marks **(I) Inspection**, which otherwise has no test and rots silently. §3, Rule 3. |
| **(E) / (T, D, I, A)** | SRS notation. Priority (Essential/Conditional/Optional) and verification method (Test / Demonstration / Inspection / Analysis). |

---

## 2. Why we work this way — the three ways this goes wrong

**This section is the argument.** If you skip it, the rules in §3 will look like ceremony, you will cut a corner under time pressure, and the corner you cut will be the one that mattered. So here is what each rule is actually buying.

The obvious way to use an AI agent is: *"Implement the scheduling engine per FR-SCH."* The agent writes `engine.ts` and `engine.test.ts`. The tests pass. It's green. It feels like TDD, and it took twenty minutes.

It is not TDD, and here is what it costs.

### 2.1 The agent grades its own homework

**When one agent writes the test and the implementation in the same pass, the test ends up describing what the code *does*, not what the requirement *says*.**

This is not the agent being lazy or deceptive. It's a natural consequence of the order it works in. It writes the engine. It runs the engine on an edge case. It sees the engine return `placed: false`. It writes `expect(result.placed).toBe(false)`. That assertion is now **a permanent, green, authoritative record of a bug**, and it is indistinguishable from a correct test by inspection.

**Here is what that actually looks like.** FR-SCH-09 requires:

> | Free interval **one minute short** | Rejected; engine continues searching |

An agent that wrote an engine which only searches the preferred window — a very common bug — will produce this test:

```ts
// ☠️ POISONED — written by an agent that also wrote the implementation
it('rejects a gap that is too short', () => {
  const busy = [{ start: 540, end: 600 }, { start: 629, end: 720 }]; // 29-min gap
  const task = { durationMinutes: 30, preferredWindow: { start: 540, end: 720 }, … };

  const result = findCandidateSlots(busy, task, DAY);

  expect(result.placed).toBe(false);   // ← the engine gave up. The test says that's correct.
});
```

**Read that test again.** It is well-named. It's clear. It tests a real boundary case from the SRS. It passes. **And it asserts that the engine may silently fail to place a task that the day had plenty of room for** — which violates FR-SCH-09 ("continues searching"), FR-SCH-06 ("shall not silently drop the task"), and NFR-REL-01 ("**the System shall never lose a task**").

Nobody reading that test in review would blink. You would find out on **31 July**, in front of the class, when a task vanishes.

Here is what the same requirement looks like when the test author never saw an implementation:

```ts
// ✅ CORRECT — written from the requirement, by an agent with no implementation in context
it('FR-SCH-09: a free interval one minute short is rejected, and the engine KEEPS SEARCHING', () => {
  // Preferred window 09:00–12:00. The only gap inside it is 10:00–10:29 — 29 minutes,
  // one minute short of the 30-minute task. But the day has a wide-open 14:00 onward.
  const SHORT_GAP = { start: 600, end: 629 };
  const busy = [{ start: 540, end: 600 }, { start: 629, end: 840 }];
  const task = { durationMinutes: 30, preferredWindow: { start: 540, end: 720 }, … };

  const result = findCandidateSlots(busy, task, { start: 480, end: 1320 });

  expect(result.placed).toBe(true);                            // ← it did NOT give up
  expect(result.slots[0].start).toBe(840);                     // ← it found the later slot
  expect(result.slots[0].withinPreferredWindow).toBe(false);   // ← and is honest that it's outside
  expect(result.slots.every(s => !overlaps(s, SHORT_GAP))).toBe(true); // ← never used the short gap
});
```

**Same requirement. Opposite assertion.** The difference is entirely in what the test author had seen. That is the whole ballgame.

> **You cannot fix this by prompting.** "Be careful," "write the tests first," "don't cheat" — none of it works, because the agent isn't cheating. It's writing down what it observed. **The fix has to be structural: don't let it observe.**

**→ Rule 2.**

### 2.2 Three agents invent three incompatible `Task` types

Patrick's engine agent writes `Task { window: { from, to } }`. Miguel's rules agent writes `Task { preferredStart, preferredEnd }`. Ryan's frontend agent writes `Task { startTime: Date }`.

Every one of those is locally reasonable. Every one passes its own tests. Every one is defensible in isolation.

Day 5, we integrate, and we are not merging — **we are rewriting.** This is precisely the *"merge chaos nobody has the context to untangle"* that `CLAUDE.md` §7 warns about, and **agents make it worse rather than better**, because they produce plausible-looking types far faster than a human notices that they disagree.

**→ Rule 1.**

### 2.3 Architecture requirements get violated cheerfully, silently, and while doing exactly what you asked

Look at what the SRS marks **(I) — verified by Inspection**:

| Requirement | What it demands |
|---|---|
| **FR-RSC-03 / NFR-MNT-03** | **Exactly one function in the whole codebase produces placements.** |
| **FR-LIB-02** | **No component of the recommendation path makes an external network call.** |
| **FR-REC-11 / NFR-MNT-06** | Adding a new metric is **two additions and zero modifications**. |
| **FR-WER-05 / NFR-PRT-03** | Nothing downstream ever references a source-specific field. |

Now ask an agent to implement FR-RSC-02 (*"when a new fixed commitment overlaps a placed task, re-place that task"*). It needs to find a free slot. Importing the engine means threading the schedulable day through three layers. Writing a small local `findNextFreeSlot()` helper right there in the reschedule service is **twenty lines and obviously simpler**, so that is what it does.

It has done exactly what you asked. FR-RSC-02 works. The tests pass.

**And FR-RSC-03 is now false.** There are two placement implementations. They will drift. One of them will get the merge-adjacent-intervals fix and the other won't, and on 29 July the rescheduler will start putting tasks on top of lectures while the main scheduler works perfectly — **and no test will fail.**

> **An (I) requirement has no test, so it rots by default.** On a hand-written codebase, code review catches a second placement function. With three agents generating more code per day than three people can read (`CLAUDE.md` §7.3: *"the bottleneck is reviewing, not writing"*), **it will not be caught.**

**→ Rule 3.**

---

## 3. The three rules

### Rule 1 — The contract is written by a human, once, before any agent runs

**The contract is `shared/src/contract.ts`: the domain types, and nothing else.** No logic, no functions, no constants with behavior. It is the seam that the SRS's module boundaries — engine / adapter / catalog / frontend — are *made of*.

- We write it **once, by hand** (it is given verbatim in `prompts/foundation/01-project-scaffold.md`), and **all three of us read it line by line and ratify it** before a single agent runs.
- Every work packet **imports from it and may never redefine, widen, or shadow a type in it.**
- **Changing it is a team decision with a row in the decision log** (`TEAM-MEETING.md`) — never an agent's unilateral refactor. **An agent that wants to change the contract must stop and escalate.**

It is about 60 lines of TypeScript and it takes an hour. **It is the highest-leverage hour in the project**, because it is the thing that lets three people work in parallel without colliding — which is the entire reason the SRS drew module seams in the first place.

Some choices inside it are load-bearing and deserve to be understood rather than just obeyed:

| Choice | Why it is not arbitrary |
|---|---|
| **Time is `Minute`** — an integer, minutes since local midnight. The engine never sees a `Date`. | FR-SCH-05 forbids the engine a clock. **An engine that cannot represent a timestamp cannot accidentally read one.** It makes the purity requirement *structurally* true instead of merely intended — and it kills an entire class of timezone bugs. |
| **`PlacementResult` is a union, not a `Slot[]`** | FR-SCH-06 requires an *"explicit empty result **with a reason**."* An empty array carries no reason, and lets a caller ignore a failed placement by iterating nothing — which is the exact silent task-dropping FR-SCH-06 forbids. **A bare `Slot[]` makes FR-SCH-06 unsatisfiable at the type level.** |
| **Metrics are a keyed map, not `{ sleepScore, activeCalories }`** | FR-WER-04 requires adding a metric to be an **addition, not a modification.** A struct with two named fields would ship this release fine and quietly make every future metric a type change *and* a schema migration. |
| **`priority` is 1–5, 1 = highest** | The ERD said only `int priority`. FR-SCH-03 uses it as a ranking tiebreak, so **the direction has to be pinned before an agent writes a comparator and silently picks the other one.** |
| **`engine/` has an empty `dependencies` block, permanently — CI fails if you add one** | Same reasoning as `Minute`, enforced by packaging rather than discipline. An engine that can't import anything can't import a clock, a DB client, or an HTTP library. |

### Rule 2 — RED and GREEN are separate agent sessions with different permissions

**This is the discipline. Everything else in this document is bookkeeping around it.**

| | 🔴 **RED agent** | 🟢 **GREEN agent** |
|---|---|---|
| **Sees** | The SRS requirements (verbatim) + the contract | The **failing tests** + the contract |
| **Never sees** | **Any implementation** | — |
| **Writes** | **Test files only** | **Implementation files only** |
| **Absolutely forbidden** | Writing any implementation (beyond a one-line throwing stub so the tests compile) | **Editing, deleting, renaming, skipping, or weakening any test file** |
| **Success looks like** | A suite that **fails** | A suite that passes with **`git diff --stat <tests>` empty** |

**The GREEN agent may not touch a test. Not to fix a typo. Not to correct an assertion that is *obviously* wrong. Not to add `.skip` to one that seems unreasonable.** If it cannot make a test pass, it **stops and reports the test as suspect**, naming the test and the requirement it cites — and a human adjudicates it against the SRS.

> **That escalation is the entire value of the split.** It converts *"the agent quietly made the test agree with the code"* — invisible, fatal, discovered on stage — into *"a human reads one assertion against one requirement and decides which is wrong"* — visible, five minutes, done. **That is the trade, and it is an extremely good trade.**

**An escalation is a success, not a delay.** A GREEN session that comes back with two questions is doing its job. A GREEN session that goes green on the first run with zero questions, on a spec as detailed as ours, is the outcome to be *suspicious* of.

### Rule 3 — Every (I) requirement becomes an executable guard

**If the SRS says a requirement is verified by *Inspection*, write the inspection as a test — or accept that it will silently become false.**

| Requirement | The guard we write |
|---|---|
| **FR-RSC-03, NFR-MNT-03** — one placement function | A test that scans `server/src/**` and asserts **no file outside `engine/` defines a function returning a placement**, and that the reschedule service **imports `findCandidateSlots` from the engine.** |
| **FR-LIB-02** — no network in the recommendation path | A Jest setup file for the recommendation suite that **replaces `fetch` and `node:http` with a throwing stub.** A network call in that path becomes a *failing test*, not a demo-day surprise. |
| **FR-SCH-05** — engine purity | A test that **deep-freezes every argument** before calling the engine (so mutation throws), plus a call-twice-assert-deep-equal test. Plus the CI check that `engine/package.json` has no dependencies. |
| **FR-WER-06, NFR-ROB-01** — absent ≠ zero | A test asserting an **absent metric and a measured zero remain distinguishable** at the API boundary. *(A rest day with 0 active calories is real data. A watch on the nightstand is not.)* |
| **NFR-MNT-01** — 90% engine coverage | A `coverageThreshold` in the engine's Jest config, so it is **a failing build**, not a number someone is supposed to go look at. |

**These guards are cheap — most are under 30 lines — and they are exactly what a grader probes**, because they are the properties the SRS makes a point of. Write them in week one, while they are still true. A guard added on 29 July doesn't protect anything; it just tells you what you broke.

---

## 3.5 Where TDD applies — and where it would be a mistake

**TDD is right for roughly 40% of this codebase, and it would actively cost us the schedule on another 40%.** Being clear about which is which, in advance, is what stops someone writing React component tests on the 25th while the analytics view isn't built.

### The SRS already made this decision — in the verification-method column

Every requirement carries a method: **(T) Test · (D) Demonstration · (I) Inspection · (A) Analysis.** That column *is* the TDD scope decision, and it has been sitting there unread:

| Method | What it means for us |
|---|---|
| **(T) Test** | **TDD it.** RED/GREEN, full loop. This is the automated-test set, and it is where correctness lives. |
| **(D) Demonstration** | **Do NOT TDD it.** The SRS is telling you this requirement is verified by *showing it working*. Build it, demo it, write a smoke test if it's cheap. Test-first here is the wrong tool and an expensive one. |
| **(I) Inspection** | **Neither — write a guard** (Rule 3). It has no natural test and will rot without one. |
| **(A) Analysis** | A measurement (coverage, latency). Enforce it in CI config, not with a TDD cycle. |

### The four places TDD earns its keep

These are pure functions with boundary cases the SRS **already enumerates for you.** You are not designing tests; you are transcribing them.

- **The scheduling engine** (FR-SCH) — FR-SCH-09 *is* eight test cases. NFR-COR-01 demands the property test. 90% coverage is Essential.
- **The recommendation rules** (FR-REC-01, -06, -08) — FR-REC-01 hands you the boundaries: 49, 50, 74, 75.
- **The catalog's constraint relaxation** (FR-LIB-07, -08) — *"shall **never** return an item violating a dietary preference"* is exactly what a test is for.
- **Analytics** (FR-ANL-01, -02, -03) — streaks and completion rates are pure arithmetic over a list, and FR-ANL-03 is a subtle rule that will be got wrong once.

**That's maybe 40% of the code and about 90% of the risk.**

### The three places TDD is the wrong tool

- **The frontend. Do not TDD React.** Three views with a calendar-style time axis is the biggest time sink in the project (`TEAM-MEETING.md` Q1) and the thing most likely to run out of clock. **The team has already ruled on this without noticing:** NFR-MNT-02 was demoted to Conditional with the reasoning *"frontend coverage is expensive and reveals little."* Nearly every FR-DSH and FR-WEL requirement is marked **(D)**. Build them, demo them, move on.
- **The Garmin adapter — not yet.** **OPEN-01 is still open: nobody has looked at a real export.** You cannot write a test first for a data shape you have never seen. Writing one means inventing a fixture that matches your *guess*, and then testing your guess. **Look at the file, then write the test.** Explore → fixture from real data → RED → GREEN.
- **The glue** — repositories, migrations, CRUD endpoints, wiring. Integration-test them **after**. Test-first on a Prisma call is ceremony.

### ⚠️ On "TDD gives us good design and makes future features easy"

**It doesn't, and believing it does is how you end up with a suite that makes refactoring *harder*.**

**The extensibility this project needs already exists, and it came from architecture, not testing:** the adapter interface every data source sits behind (FR-WER-05), the **keyed metric map** rather than a two-column struct (FR-WER-04), the **rule registry** that evaluates rules without knowing their content (FR-REC-11), the catalog interface (FR-LIB-01). Those are what make *"adding a metric is two additions and zero modifications"* true. **No amount of TDD would have produced a single one of them.**

What TDD actually buys for the future is narrower, and real: **it makes the code safe to change.** A regression net is what lets you refactor without fear. **It does not create the seams — it stops them eroding.** Claim that and no more.

And here is how TDD can make extensibility **worse**, which is a live risk with agents: **if you test implementation details instead of module boundaries, the suite cements the current structure.** Agents love to mock every collaborator and assert on internals. That gives you a suite that breaks every time you improve something — the opposite of maintainable. **Test at the contract boundary.** It is exactly why the engine exports **one** function and keeps `mergeBusyIntervals`, `freeIntervals`, and `rankSlots` private: they are free to change, forever, and no test will care.

> **The single biggest threat to this codebase's maintainability is not a design flaw — it is an agent quietly adding a second placement function** while FR-RSC-03 stays green and nothing fails. **For long-term maintainability on this project, the Rule 3 guards are worth more than the TDD is.**

### And a reality check on "future features"

**We present on 31 July and graduate on 1 August. There is no v2.**

The extensibility requirements exist because **the grader wants the principle demonstrated** — which is precisely what FR-REC-12 is: *add one metric, report the diff.* **Optimize for demonstrating the architecture, not for serving a future that will not arrive.** Gold-plating for an imaginary v2 is a real and attractive way to lose a week we do not have — the same trap as FR-SCH-07 (`CLAUDE.md` §6).

---

## 4. The loop

```
   ┌─ CONTRACT ────────────────────────────────────────────────┐
   │  Human. Once. Before anything else. (packet 03)                │
   │  All three of us read it and ratify it.                    │
   └───────────────────────────┬───────────────────────────────┘
                               ▼
   ┌─ 🔴 RED ──────────────────────────────────────────────────┐
   │  Fresh session. Agent sees: SRS + contract.                │
   │  Agent writes: TEST FILES ONLY.                            │
   │                                                            │
   │  ► The suite MUST FAIL. That is the pass condition.        │
   │  ► If it passes, the agent wrote an implementation.        │
   │    Revert and re-run. Do not "just keep it."               │
   └───────────────────────────┬───────────────────────────────┘
                               ▼
   ┌─ 🚦 HUMAN GATE ───────────────────────────────────────────┐
   │  Read every assertion against the requirement it cites.    │
   │  NOT "do they pass" — "ARE THEY RIGHT."                    │
   │  Fix anything wrong HERE. This is your last chance.        │
   │                                                            │
   │  ► Then COMMIT the tests. They are now FROZEN.             │
   │  ► §6 is the checklist. Use it. Do not freestyle this.     │
   └───────────────────────────┬───────────────────────────────┘
                               ▼
   ┌─ 🟢 GREEN ────────────────────────────────────────────────┐
   │  Fresh session. Agent sees: the failing tests + contract.  │
   │  Agent writes: IMPLEMENTATION ONLY.                        │
   │                                                            │
   │  ► MAY NOT EDIT A TEST. Stuck ⇒ escalate to a human.       │
   │  ► Verify: `git diff --stat <tests>` is EMPTY.             │
   └───────────────────────────┬───────────────────────────────┘
                               ▼
   ┌─ 👤 OWNER CHECK ──────────────────────────────────────────┐
   │  The module's human owner explains it ALOUD, without       │
   │  opening the file.                                         │
   │                                                            │
   │  ► If they can't, IT IS NOT DONE — regardless of whether   │
   │    the tests pass. (CLAUDE.md §7.2)                        │
   └───────────────────────────────────────────────────────────┘
```

**The bottleneck is the two human boxes, not the two agent boxes.** The agents will finish in an hour and will happily give you more code tomorrow than the three of us can read in a week. **Plan each day around how much you can review, not how much they can write.** A day where the agents produce four packets and we review one is a day we went backwards, because we now have three packets of unreviewed code that somebody will be trusting on the 30th.

---

## 5. The mechanics — how you actually run a session

**One packet = one fresh chat session.** `/clear`, paste the packet, let it work, `/clear` again.

But the fresh session is only *half* of what separates RED from GREEN, and it's the cheaper half. There are **two distinct properties** you're buying and it's worth keeping them apart:

| | What it prevents | How you get it |
|---|---|---|
| **Context isolation** | The RED agent writing tests that describe an implementation *it just designed*. | **A new chat.** If one session designs the engine and then writes tests, the tests describe the design it talked itself into — **even if you told it to write the tests first.** |
| **A permission boundary** | The GREEN agent "fixing" a test it can't pass. | **The tests being frozen in git.** ⚠️ **A fresh chat does NOT give you this.** |

> **The permission boundary is the one that actually saves you.** A brand-new GREEN session with write access to the test folder will, when it is stuck on the last failing assertion, **weaken that assertion** — and hand you a fluent, entirely reasonable paragraph about why the test was subtly incorrect. **It will not feel like cheating to it, and it will not look like cheating to you.** Do not rely on it being *forbidden*. Make it *impossible*.

### The sequence, concretely

```bash
# 1. RED — fresh session
/clear
# paste prompts/engine/04-engine-tests-RED.md
npx jest engine
#   ✅ EXPECT: every test FAILS with `Error: 05` (the stub).
#   ❌ A failure for any OTHER reason  = a broken test. Fix it.
#   ☠️ A test that PASSES              = the agent wrote the engine. Revert engine/src, re-run.
git diff --stat engine/src/    # must be ~1 line (the throwing stub) and nothing else

# 2. HUMAN GATE — §6. Work the checklist. This is the important part.

# 3. FREEZE
git add engine/test/ && git commit -m "P04 RED: engine test suite (frozen)"

# 4. GREEN — fresh session
/clear
# paste prompts/engine/05-engine-implementation-GREEN.md
npx jest engine --coverage
git diff --stat engine/test/
#   ✅ EXPECT: empty. Nothing in engine/test/ changed.
#   ☠️ NOT empty = GREEN touched a test. `git checkout -- engine/test/`, re-run,
#      and ASK IT WHAT IT WAS TRYING TO FIX.
#      That question is usually where you discover the requirement was ambiguous —
#      which is worth more than the fix was.
```

**Want the boundary enforced rather than merely checked?** Add a `PreToolUse` hook to `.claude/settings.json` that blocks `Edit` and `Write` against `engine/test/**` during GREEN. That turns the rule into a wall. The `git diff` check above is the zero-setup version and is good enough to start with.

**Two things that don't matter,** since they're everyone's first two questions: it does **not** need to be a different model, and it does **not** need to be a different teammate. **Same model, same person — different context, different permissions.**

### ⚠️ The gate is where a human leaks the contamination across the wall

**At step 2, you are the one holding the isolation.**

If you read the tests, decide assertion #7 looks wrong, and then open your GREEN session with *"…and by the way, test 7 is a bit off, feel free to relax it"* — **you have just carried the contamination across the wall yourself.** The whole apparatus was theatre and you now have a green suite that proves nothing, plus the false confidence of having followed a process.

**Fix the test in RED, against the SRS, before you commit. After the commit, the tests are frozen — and that includes frozen against you.**

---

## 6. The human gate — the checklist ⭐

**This is your job. It is the review the project rests on.** Everything else can be delegated to an agent; this cannot, because it is the only point where a human compares what was written against what was *required*.

The failure mode here is **reading the tests, finding them clear and well-organized and plausible, and approving them** — because a poisoned test is clear and well-organized and plausible. **That is what makes it poisoned.** So do not freestyle this. Work the list.

**Budget 30–45 minutes for the engine suite. Do it with two people if you can.**

#### ☐ 1. Did the agent secretly write an implementation?
`git diff engine/src/` should show **one throwing stub and nothing else.** If there is a `mergeIntervals` helper "just to make the tests readable," **the tests were written against an implementation** and the whole packet is compromised. Revert and re-run RED.

#### ☐ 2. Do the tests actually fail — and for the right reason?
Every failure should be `Error: 05`. **A test that already passes means an implementation exists.** A test failing for some *other* reason (a type error, a bad import) is just broken — fix it, but it isn't a red flag.

#### ☐ 3. Does every test cite a requirement ID in its name?
`it('FR-SCH-09: rejects a free interval one minute short and keeps searching', …)`.

**A test citing no requirement is the agent's opinion**, and its opinion will be different next session. Either find the requirement it's testing and name it, or **delete the test.** *(Bonus: these names are our traceability matrix — Appendix B. A grader can read the test output as evidence.)*

#### ☐ 4. Does every requirement in the packet have a test?
Go down the packet's "Requirements in scope" list — **out loud, one at a time** — and find the test for each. This catches *omission*, which is the failure mode a checklist of the tests themselves will never catch, because **you cannot notice a test that isn't there by reading the tests that are.**

#### ☐ 5. For each assertion: open the SRS, read the sentence, and ask *"does this assertion follow from that sentence?"*
Not *"is this a reasonable thing to check."* **Does it follow.**

The specific trap — and it is the one that will actually get us: **does the test assert the *positive* behavior the requirement demands, or only the *negative*?** "Rejected; **engine continues searching**" has two halves, and **an implementation with a bug will happily satisfy the first half.** See §2.1 — that exact test is the worked example, and it is worth re-reading before you start.

#### ☐ 6. Are the "shall not" requirements tested?
Agents systematically under-test **negative space**, because it's about what *doesn't* happen and there's nothing obvious to assert on. These are ours, and they're the ones that will embarrass us:

- FR-SCH-06 — *"shall **not** silently drop the task"* → **is there a test proving there is no input for which the engine gives up and places it somewhere invalid anyway?**
- FR-SCH-04 / NFR-COR-01 — *"**no** placement shall overlap any busy interval"*
- FR-RSC-07 — *"a completed task shall **never** be rescheduled"*
- FR-REC-05 — *"shall **never** recommend anything violating a dietary preference"* — **hard constraint, does not relax, ever**
- NFR-REL-01 — *"**the System shall never lose a task**"*

#### ☐ 7. Look at the property test's generators — actually read them.
NFR-COR-01 demands ≥1,000 randomized cases. **A property test whose generator only produces tidy, sorted, disjoint busy intervals is decorative.** It will run 1,000 cases, pass every one, and prove nothing.

Are the generators genuinely adversarial? **Overlapping busy intervals. Adjacent ones with no gap. Zero-length ones. An interval spanning the whole day. A preferred window exactly equal to the task's duration. A window straddling the day's edge.** If the generators are polite, send it back.

#### ☐ 8. Are boundary values *exactly* on the boundary?
FR-REC-01 maps sleep score → intensity at 49/50 and 74/75. **The test must use 49, 50, 74, and 75** — not 45 and 80. An off-by-one in the *test* becomes a permanent, green, off-by-one in the *code*, and it's the kind of thing a professor pokes at directly.

#### ☐ 9. Did the agent invent a rule the SRS doesn't state?
If FR-SCH-03's tiebreak is ambiguous for some case and the agent **picked one and encoded it in a test**, that invented rule is now a requirement nobody agreed to — and GREEN will faithfully implement it. **Find these, and either fix the SRS (and log it) or fix the test.** A good RED agent escalates these instead of guessing; check its report for them.

#### ☐ 10. Then, and only then, commit.
```bash
git add engine/test/ && git commit -m "P04 RED: engine test suite (frozen)"
```

---

## 7. Writing a new work packet

**A packet is a unit of *work*, not a unit of *requirement*.** One packet ≈ one agent session ≈ one reviewable diff ≈ one human owner.

- ❌ **Not one per requirement.** FR-SCH-01 through -09 are *one* packet, because they're one function.
- ❌ **Not one per module.** "Build the backend" is not a packet, it's a week.
- ✅ **Roughly: one thing a person could review in a sitting.**

Copy `prompts/_TEMPLATE.md`. Every packet has:

| Section | Why |
|---|---|
| **ID + phase** (RED / GREEN / GUARD / SCAFFOLD) | Which half of the loop this is. Determines the permissions. |
| **Human owner** | **A name.** Not "the team." This person must be able to explain the result aloud without opening the file. |
| **Requirements in scope — quoted VERBATIM** | See below. |
| **The contract** | Imported, never redefined. |
| **Files you may create/edit** | An explicit list. |
| **Files you must NOT touch** | An explicit list. **For GREEN packets this includes every test file.** |
| **Definition of done** | **Mechanical and checkable.** Not "the code is good." |
| **Escalation clause** | When to stop and ask a human. |

> **Quote the requirements verbatim. Do not paraphrase the SRS into the packet.**
>
> Paraphrasing is where the requirement quietly changes, and the SRS's phrasing is load-bearing in ways a paraphrase drops. *"It shall **not** silently drop the task"* is a testable obligation with teeth. *"Handle the no-slot case gracefully"* is a vibe. The agent will build the vibe.

---

## 8. When it goes wrong — what to do

| What happened | What it means | What you do |
|---|---|---|
| **The RED suite passes.** | The agent wrote an implementation. **The tests are now describing it.** | `git checkout -- engine/src/`, re-run RED in a fresh session, and say explicitly: *no implementation, a throwing stub only.* **Do not keep the tests.** |
| **GREEN says a test is wrong.** | Could go either way — **and this is the system working.** | **Read the test against the requirement yourself.** Either the test misread the SRS (fix the test, in a RED-style session, and re-commit) or the agent misread the test (tell it to keep going). **Five minutes. Do not delegate this.** |
| **GREEN edited a test anyway.** | The boundary leaked. | `git checkout -- engine/test/`. Re-run. **Then ask it what it was trying to fix** — that answer is usually a real ambiguity in the SRS and is worth more than the fix. Consider adding the `PreToolUse` hook. |
| **GREEN can't reach 90% coverage.** | Uncovered lines are **either dead code, or a case RED missed.** | **Both are worth five minutes of a human's time. Neither is fixed by GREEN writing a test** — that puts you straight back to grading your own homework. Delete the dead code, or add the case in a RED session. |
| **Two tests contradict each other.** | **Two requirements contradict each other.** | This is a genuinely valuable find. **Fix it in the SRS**, log the decision in `TEAM-MEETING.md`, then fix the test. Do not paper over it in code. |
| **An agent wants to change the contract.** | Maybe it's right. | **Stop.** It is a team decision with a decision-log row. Never a unilateral refactor. |
| **An agent adds a dependency to `engine/`.** | It has misunderstood the packet. | CI fails on this. Reject it. **The engine imports nothing.** |
| **The tests pass but nobody can explain the code.** | **It is not done.** | `CLAUDE.md` §7.2. The owner reads it until they can explain it aloud. **A module no human understands is a module that cannot be debugged at 11pm on the 30th — and that is exactly when you will need to.** |

---

## 9. Where we start, and who does what

> **Packets are numbered `01`…`17` and delivered in exact numerical order.** The index is `prompts/00-prompt-collection-summary.md`; the phase map is `prompts/README-prompts.md`.

| # | Packet | Phase | Owner | Produces |
|---|---|---|---|---|
| **01** | `prompts/foundation/01-project-scaffold.md` | Scaffold | *(whoever creates the repo)* | Repo, workspaces, package boundaries, the **empty `engine` dependencies block** |
| **02** | `prompts/foundation/02-toolchain-and-dependencies.md` | Scaffold | *(same)* | TS/Jest/lint/fast-check, CI with the 90% engine gate and the purity guard |
| **03** | `prompts/foundation/03-shared-contract-types.md` | **Human-authored** | **The whole team, together** | `shared/src/contract.ts` — **the contract** |
| **04** | `prompts/engine/04-engine-tests-RED.md` | 🔴 RED | Scheduling Lead | The engine's whole test suite: 8 boundary cases, ranking, determinism, purity, the 1,000-case property test |
| **05** | `prompts/engine/05-engine-implementation-GREEN.md` | 🟢 GREEN | Scheduling Lead | `findCandidateSlots` — and nothing else |

**We start with the engine, and we start now.** Not because it's easiest — because:

- **It is pure.** No DB, no clock, no network, no framework. It is the only module that can be built with *zero infrastructure standing up*, which means **nothing can block it.**
- **It is the grade.** (`TEAM-MEETING.md` Q1: *"the engine **is** the grade."*)
- **The SRS specifies it at test-case granularity**, so RED is nearly transcription — **the lowest-risk possible place to shake out this workflow** before we point it at something genuinely ambiguous.
- **Everything else is written against its contract.** FR-REC-04 — the load-bearing requirement of the entire project — *is* "the recommendation is placed by the engine." **There is no FR-REC-04 without an engine.**

**Nothing starts before packet 03.** `Interval`, `Task`, and `PlacementResult` are what all four modules are *written against*, and you do not want a flaw in them discovered by an agent halfway through a database migration. **The gate is the contract, not the engine.**

### ⚠️ But the rest of the team does NOT queue behind the engine

**Once packet 03 is ratified, everything below starts in parallel.** The engine is *first* in the sense that it is the highest-value and least-blocked thing — **not** in the sense that it blocks anyone else.

| Packet | Owner | Blocked by the engine? |
|---|---|---|
| **06–07** Reschedule triggers (FR-RSC) + **the FR-RSC-03 guard** | Scheduling Lead | **Yes** — it re-invokes the engine |
| **08** Metric adapter + Daily Metric Set (FR-WER) — **one document per metric per date** | Data Lead | **No — start the moment 03 lands** |
| **09–10** Recommendation rules + registry (FR-REC) + **the FR-LIB-02 no-network guard** | Data Lead | **No — start the moment 03 lands** |
| **13–15** Frontend against a **mocked** API (FR-DSH), typed from the contract so it cannot drift | Frontend Lead | **No — starts 17 Jul, does not wait for the backend** |

> **This is not a scheduling nicety — the midpoint gate depends on it.**
>
> The **16 July go/no-go gate is FR-WER-10**: *one real metric, from a real device, driving one real recommendation.* That path is **export → adapter → Daily Metric Set → rule → decision.** **The engine is not on it.**
>
> If the Data Lead waits for the engine to go green, **the gate is missed** — and the gate is the one thing separating this project from one built on synthetic data. **Packets 08 and 09 start in parallel with 04, on day one.**

---

## 10. Rules of thumb

1. **The tests are the requirements.** If a requirement has no test, it is a wish. If a test cites no requirement, it is an opinion — delete it.
2. **Never let one agent write both a test and the code it tests.** This is *the* rule. Everything else is support.
3. **Review the tests harder than you review the code.** The code is checked by the tests. **The tests are checked by nothing but you.**
4. **An escalation is a success.** A GREEN session that comes back with two questions is working. One that goes green instantly with no questions, against a spec this detailed, deserves *more* scrutiny, not less.
5. **If a green suite surprises you, distrust it.** Being pleasantly surprised by a test suite is a symptom, not a reward.
6. **An agent that wants to change the contract must stop.** Team decision, decision-log row.
7. **Cite the requirement ID in every test name.** It costs nothing, and it *is* the traceability matrix.
8. **Integrate daily** (`CLAUDE.md` §7.1). Three agents writing into one repo in parallel for a week produces a merge nobody has the context to untangle.
9. **The bottleneck is review, not generation.** Plan the day around what we can *read*.
10. **Say what's actually true.** If tests fail, say so. If a packet was rushed, say that. On a 19-day project, **a comfortable inaccuracy costs more than an uncomfortable fact.**
