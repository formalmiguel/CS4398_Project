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

**Build complete. The System demonstrates its own central claim end to end.**

The SRS is at **v2.34** — ~84 numbered verifiable requirements, formal use cases, UML diagrams, wireframes, a traceability matrix, and a sign-off page.

**All work packets `01`–`17d` are implemented, verified, and merged to `dev`.** `npm run verify` is **498 tests green**: the engine at 100% coverage, four `(I)`-requirement guards passing, and eight frozen test suites intact. The full spine is wired into the running application and was exercised against a live server — a wearable metric drives the recommendation engine, which produces a real scheduled task that the same rescheduling logic defends (FR-REC-04). Real Garmin data has been ingested end to end (FR-WER-10), and the frontend has been observed rendering in a browser.

| Layer | State |
|---|---|
| **Engine** (scheduling + rescheduling) | ✅ packets 04–07, 100% coverage, property-tested over 1,000 days |
| **Wearable → recommendation** (adapter, rules, libraries, ingest CLI) | ✅ packets 08–11, real export ingested |
| **Backend** (API, accounts, persistence, `.ics` export) | ✅ packet 12 + FR-CAL-07 |
| **Frontend** (schedule, wellness, analytics) | ✅ packets 13–15 |
| **Verification** (`(I)`-requirement guards, acceptance suite) | ✅ packets 16a/16b, 17a–17d |

Work was sequenced by dependency, not by date — see **THE BUILD ORDER** in `docs/TEAM-MEETING.md`.

> ⚠️ **`main` deliberately sits behind `dev`.** All the work above lives on **`dev`**; `main` is held at the 21 Jul pre-implementation state and would be promoted in a single merge if the team chooses to. **If you clone and land on `main`, you will see the documents but none of the build — switch to `dev` (`git checkout dev`).** This is intentional, not a mistake.

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
├── prompts/           # The agent work packets, 01…17, run in exact numerical order.
│   ├── 00-prompt-collection-summary.md   # Start here — the index.
│   ├── README-prompts.md                 # Phase map and formatting conventions.
│   ├── _TEMPLATE.md
│   ├── foundation/    # 01–03  scaffold, toolchain, the contract   (Patrick)
│   ├── engine/        # 04–07  scheduling + rescheduling           (Patrick)
│   ├── wearable/      # 08–11  adapter, rules, libraries           (Ryan)
│   ├── backend/       # 12     API, accounts, persistence          (Miguel)
│   ├── frontend/      # 13–15  schedule, wellness, analytics       (Miguel)
│   └── verification/  # 16–17  (I)-requirement guards, integration (Patrick)
│
├── shared/            # The domain contract. Types only. Zero dependencies.
├── engine/            # The pure scheduling function. Zero dependencies, permanently.
├── server/            # API, persistence, sessions.
└── web/               # React frontend.
```

**Numbers are the delivery order; folders are the ownership.** Two different axes, and both matter — run `01` → `17` regardless of which folder a packet lives in. The `Human owner` field *inside* each packet is authoritative; the folder is a convenience.

---

## Dependencies and Setup

### The shape: four packages, one install

This is an **npm workspaces** monorepo. One language across the whole stack, so any of the three of us can review any file.

```
package.json          { "workspaces": ["shared", "engine", "server", "web"] }
├── shared/           dependencies: {}          the domain contract — types only
├── engine/           dependencies: {}          PURE. Empty permanently. See below.
├── server/           dependencies: express, mongodb, bcrypt, jsonwebtoken, cors, dotenv
└── web/              dependencies: react, react-dom
```

You run **one command at the root**. npm reads all five manifests, resolves the entire graph at once, and produces:

- **one `package-lock.json` at the root** — every package *and every transitive dependency*, pinned to an exact version
- **one `node_modules/` at the root** — installed once and "hoisted", not four copies
- **symlinks** for our own packages, which is what lets `engine/` and `server/` write `import { Task } from '@capstone/shared'` instead of `../../shared/src`

### Commands

| Command | What it does | When to use it |
|---|---|---|
| **`npm ci`** | Wipes `node_modules` and installs **exactly** what the lock file says. Fails if manifest and lock disagree. | **Fresh clone, and CI** |
| `npm install` | Resolves version ranges and **may update** `package-lock.json` | Only when adding or changing a dependency |
| `npm install <pkg> -w server` | Adds one package to one workspace | Adding a dependency to a specific package |

**Full setup from scratch:**

```bash
git clone https://github.com/formalmiguel/CS4398_Project.git
cd CS4398_Project
git checkout dev          # the build lives on dev; main is held behind it (see Status)
npm ci
npm run verify           # typecheck, lint, the (I)-requirement guards, and the 498-test suite
```

**Use `npm ci`, not `npm install`, on a fresh clone.** `npm install` can silently drift the lock file, which means your tree and Miguel's stop being identical — and **CON-10** requires this project to be runnable on a clean machine from one documented command sequence. `npm ci` is what makes that true rather than hopeful.

`npm run verify` is the full gate — typecheck, ESLint, all five executable `(I)`-requirement guards, the frozen-test check, and the coverage suite. It needs **no database and no network**: the server tests spin up `mongodb-memory-server` in-process. **Running the server itself** does need a Mongo connection — copy `server/.env.example` to `server/.env` and set `MONGODB_URI` (a local `mongod` or an Atlas string) and a `JWT_SECRET`. `.env` is gitignored and never committed; only `.env.example` is tracked.

### Why `package-lock.json` is committed

`package.json` says *"Express 4-ish."* The lock file says *"Express 4.21.2, and these 400 transitive packages at these exact versions."* Without it committed, two people installing a week apart get subtly different trees — the classic *"works on my machine"*, discovered the night before a demo.

`node_modules/` is **never** committed. It is reproducible from the lock file, and it is gitignored.

### ⚠️ `engine/` has zero runtime dependencies — permanently

`engine/package.json` has an **empty `dependencies` block**, and CI fails if one is added.

That is not tidiness. **FR-SCH-05** requires the engine to be a pure function — no clock, no database, no side effects — and **NFR-COR-01** requires it to be property-tested over 1,000 randomized days with no database and no browser. **An engine that cannot import anything cannot accidentally import a clock.**

*(This constrains runtime `dependencies` only. Jest, ts-jest and fast-check are dev tooling, live in the **root** `devDependencies`, and are hoisted to all four packages — otherwise the guard would fire the moment anyone added a test runner, and people would switch it off.)*

**One caveat contributors should know:** because npm hoists everything to the root `node_modules/`, Node will happily resolve `import { MongoClient } from 'mongodb'` *from inside `engine/`*, even though `engine/package.json` declares nothing. The `guard:engine-deps` script checks the **manifest** — so it catches `npm install mongodb -w engine` but not a stray import line. That gap is closed by `guard:engine-purity` and an `engine/**` lint override restricting the engine to relative imports plus the contract; both landed with packet 16's other **(I)**-requirement guards and run on every `npm run verify`.

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
