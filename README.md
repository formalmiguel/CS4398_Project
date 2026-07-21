# Adaptive Habit, Schedule & Wellness System

**CS 4398 — Software Engineering Capstone · Summer 2026 · Texas State University**

A web application that combines an **adaptive scheduling engine** with **real wearable health data**.

Every commitment in a user's day — class, meeting, habit, workout, meal — is a *task* with a duration, priority, preferred time window, and flexibility flag. A single scheduling function places tasks around fixed commitments and **re-invokes itself** to repair the schedule when a task is missed, when the user declares one skipped, or when a new commitment displaces one.

Separately, the System reads the user's Garmin data — sleep score and active calories — and adapts its recommendations: poor sleep lowers workout intensity, high activity raises the day's calorie target.

> **The recommendations are not advisory. They become real scheduled tasks on the real calendar, defended by the same rescheduling logic as everything else.** That single property (FR-REC-04) is what makes this one integrated system rather than a scheduler and a fitness app sharing a login.

---

## Team

| Name | Role |
|---|---|
| **Patrick Rucker** | Scheduling Algorithm Lead |
| **Ryan Woosley** | Data & Wearable Integration Lead |
| **Miguel Alvarez** | Frontend & Backend Lead |

**Presentation: 31 July 2026.** The nineteen-day window is the governing constraint on every technical decision in this project — encoded in the SRS as CON-06, and the reason no Essential requirement depends on a third party's approval.

---

## Status

**Specification complete. No code yet.**

The SRS is at **v2.5** — ~84 numbered verifiable requirements, formal use cases, UML diagrams, wireframes, a traceability matrix, and a sign-off page. The development method is written down and the first five work packets are ready to run.

---

## Repository Layout

```
├── CLAUDE.md          # The shared rulebook. Loaded automatically by every AI session.
│                      #   Read §0 and §0.1 before running an agent.
├── docs/
│   ├── SRS-v2.md              # THE SPEC. Source of truth. Edit this, never a copy.
│   ├── AGENTIC-TDD-WORKFLOW.md # How the code gets written. Read §1 first.
│   ├── TEAM-MEETING.md         # Decision log, open issues, action items.
│   └── build-pdf.sh            # Builds the submission PDF.
└── prompts/           # The agent work packets, 01…17, run in exact order.
    ├── 00-prompt-collection-summary.md   # Start here — the index.
    └── README-prompts.md                 # Phase map and formatting conventions.
```

---

## Building the SRS PDF

Requires **Node.js** and **Chrome** (or Edge). From a Bash shell:

```bash
cd docs
./build-pdf.sh          # → docs/build/SRS-v2-CS4398.pdf  (65 pages)
```

The script pre-renders the Mermaid diagrams to SVG and inlines them before printing. *(Most Markdown→PDF exporters emit the raw diagram source instead of the picture, which is worse than no diagram at all. This script exists so that cannot happen.)*

Everything under `build/` is generated, gitignored, and disposable.

---

## How the Code Gets Written

This project is built with **agentic programming**: the team directs requirements, AI agents write the code. Two structural rules make that trustworthy rather than merely fast.

**1. The prompt pack is a generator.** Run `prompts/01` … `prompts/17` in exact numerical order and the agent *creates* the code files. Re-running may produce different code, and that is expected — which is why **generated code is never pasted back into a prompt.** Doing so would freeze one run's arbitrary choices into the specification and quietly turn the coverage figure into a measurement of the code against itself.

**2. The agent that writes the tests is never the agent that writes the code.** Separate sessions, and the tests are **committed and frozen** in between. The implementer may not edit a test — if it cannot make one pass, it stops and a human adjudicates the test against the SRS.

> When one agent writes both, the test ends up describing what the code *does* rather than what the requirement *says*. It goes green, it looks reasonable, and it is wrong. **The tests are the only artifact that stays constant across runs** — so they had better be right before any implementation exists.

Full reasoning, including the worked example that makes the case: [`docs/AGENTIC-TDD-WORKFLOW.md`](docs/AGENTIC-TDD-WORKFLOW.md) §2.

---

## Design Constraints Worth Knowing Up Front

- **There is exactly one scheduling engine.** Rescheduling re-invokes the same pure function; it is not a second algorithm. Enforced by CI guard, not by good intentions (FR-RSC-03).
- **The engine is pure** — no clock, no database, no side effects. `engine/`'s `dependencies` block is empty **permanently**, because an engine that cannot import anything cannot import a clock (FR-SCH-05).
- **Time inside the engine is an integer** — minutes since local midnight. The engine never sees a `Date`.
- **The whole acceptance demonstration runs with outbound network access disabled**, and FR-LIB-02 requires the team to *prove* that rather than assume it.
- **The System is not a medical device.** It asks the user for a baseline calorie target rather than estimating one, and never recommends anything violating a stated dietary preference — a constraint that does not relax, at any point, for any reason.

---

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) first — it is the project's memory, and several natural-seeming ideas have already been considered and rejected there with reasons.

- **`git pull` before starting an agent session.** A stale `CLAUDE.md` fails silently: an agent running on last week's copy doesn't know a rule exists, so it won't warn you it's missing one.
- **Commit messages follow `CLAUDE.md` §8** — a scope, the *why* in the body, and `Requirements:` / `Owner:` trailers.
- **Every test name cites the requirement ID it verifies.** Those names are the traceability matrix; a grader reads the test output as evidence.
