# Testing — Frameworks, Layers, and Evidence

**Adaptive Habit, Schedule & Wellness System — CS 4398 Capstone**
**Last verified:** 28 July 2026 — `npm run test:coverage`, **39 suites / 498 tests passed** in 24.7 s, engine coverage **100%**.

---

## 1. Summary

The System is tested with **five established third-party testing frameworks**, each applied to the layer it is designed for. No test framework was written in-house.

Testing is not a separate phase in this project. It is a **build gate**: `npm run verify` runs type checking, linting, six architectural guard scripts, and the full suite with coverage thresholds. A failure in any one of them fails the build.

```
npm run verify
  → typecheck (tsc)                    → lint (ESLint)
  → 6 guard scripts                    → 498 tests with coverage
```

---

## 2. The frameworks, and what each one tests

| Framework | Version | What it is | The part of the System it tests |
|---|---|---|---|
| **Jest** | 30.4.2 | The most widely used JavaScript/TypeScript test runner. Discovers tests, runs them, reports results, measures coverage. | All workspaces. It is the harness every other tool below runs inside. |
| **ts-jest** | 29.4.11 | Jest transformer for TypeScript. | Lets tests be written in TypeScript against the same types as production code, so a test cannot compile against a stale interface. |
| **fast-check** | 4.9.0 | **Property-based testing.** Instead of asserting one example, it generates hundreds of random inputs and checks that a stated property holds for all of them. | The scheduling engine (`engine/src`). Proves over **1,000 randomly generated days** that no placement ever overlaps a busy interval — NFR-COR-01. |
| **supertest** | 7.0.0 | HTTP assertion library for Node services. Issues real requests against a real Express app. | The REST API — all 21 routes, exercised over HTTP with real authentication, not by calling handler functions directly. |
| **mongodb-memory-server** | 10.1.4 | Runs a genuine MongoDB instance in-process for the duration of a test run. | The persistence layer. Repository tests run against real MongoDB semantics — real indexes, real upserts — with no external database and no mocks. |
| **ESLint + TypeScript** | 8.57.1 / 5.9.3 | Static analysis. | All source. Includes a per-module import restriction that prevents the engine from importing anything at all (see §5). |

### Where each choice came from

The specification names testing **properties**; it deliberately does not name products. §3.1's tooling table lists *"Jest (or equivalent)"*, *"A property-based testing library"*, *"A coverage reporter"* — a category and a purpose, with the binding obligation carried by the requirement instead. The concrete package was then pinned by a work packet, which is where a tool choice is cheap to change and easy to audit.

| Framework | What forced it | Where it was named |
|---|---|---|
| Jest + ts-jest | SRS §3.1 — *"Jest (or equivalent)"* | Pinned in `prompts/foundation/02-toolchain-and-dependencies.md` |
| fast-check | **NFR-COR-01** — *"≥ 1,000 generated cases"*. A number that large is only reachable with a generator, so the requirement selects the category. | Packet 02 named the package; packet 04 mandated `numRuns: 1000` |
| Coverage thresholds | **NFR-MNT-01** — 90% engine lines | Packet 02, with the threshold proven by deliberately dropping coverage and watching the build fail |
| ESLint + `tsc` | SRS §3.1, named directly | Packet 02 |
| mongodb-memory-server | **OPEN-19** — packet 12 needed a strategy for testing the real Mongo repository | Decided 22 July: a real local `mongod` was rejected as environment-dependent; a hand-rolled in-memory fake was rejected because it could pass while the same query fails against real Mongo |
| supertest | Not specified in advance. Packet 12 stated *what* to test — cross-user access on every data-bearing endpoint (NFR-SEC-03), injection payloads returned as literal text (NFR-SEC-05), p95 latency under 10 concurrent users (NFR-PERF-02) — and left the mechanism open. | Selected during packet 12 (22 July) and adopted as house style thereafter |

**The pattern is deliberate and worth stating: a requirement fixes the obligation, a packet fixes the package.** NFR-COR-01 does not say "use fast-check" — it says the engine's non-overlap invariant must hold across at least 1,000 generated days, which is a claim that stays true if the library is replaced. That separation is what lets the tooling table read *"or equivalent"* without weakening anything.

---

## 3. Test inventory — 498 tests across 11 areas

| Area | Tests | What it covers | Primary framework |
|---|---|---|---|
| [`server/test/reschedule/`](../server/test/reschedule/) | 154 | The FR-RSC policy layer — when the engine is re-invoked, and on which trigger | Jest |
| [`server/test/catalog/`](../server/test/catalog/) | 134 | Workout and meal libraries; tier mapping; dietary-flag compliance | Jest (table-driven) |
| [`server/test/api/`](../server/test/api/) | 74 | All 21 HTTP routes — auth, tasks, schedule, metrics, wellness, recommendations, analytics | **supertest** |
| [`engine/test/`](../engine/test/) | 30 | The scheduling engine — boundaries, ranking, no-slot cases, purity, performance, the property test | Jest + **fast-check** |
| [`server/test/recommendation/`](../server/test/recommendation/) | 27 | Sleep→intensity and calories→target rules; the rule-agnostic engine | Jest (table-driven) |
| [`server/test/db/`](../server/test/db/) | 25 | `UserStore`, `TaskRepository`, connection handling | **mongodb-memory-server** |
| [`server/test/wearable/`](../server/test/wearable/) | 20 | Garmin export adapter; metric storage and idempotent ingestion | Jest |
| [`server/test/analytics/`](../server/test/analytics/) | 18 | Streaks and completion rates | Jest (table-driven) |
| [`server/test/acceptance/`](../server/test/acceptance/) | 8 | SRS §6's demonstration sequence over the real stack | Jest |
| [`server/test/calendar/`](../server/test/calendar/) | 7 | `.ics` export (RFC 5545) | Jest |
| [`server/test/replacement/`](../server/test/replacement/) | 1 | A superseded workout stays superseded across repeated schedule retrievals | Jest |

---

## 4. Levels of testing represented

Beyond ordinary unit tests, the suite covers five distinct levels:

| Level | Where | Note |
|---|---|---|
| **Unit** | Throughout | Individual rules, adapters, and pure functions in isolation |
| **Integration** | `server/test/api/`, `server/test/db/` | Real HTTP through a composed Express app, into real MongoDB |
| **System / acceptance** | `server/test/acceptance/` | The full SRS §6 sequence — wearable metric → recommendation → placed task → defended by rescheduling — with **no stub anywhere near a placement decision** |
| **Property-based** | `engine/test/property.test.ts` | 1,000 generated days per run; the assertion is a universal claim, not an example |
| **Performance** | `engine/test/performance.test.ts` | NFR-PERF-01 — a 50-interval day decided at the 95th percentile of 100 consecutive invocations |

---

## 5. What we built ourselves, and why

Four requirements in the SRS are marked **(I) — verified by inspection**: FR-RSC-03, FR-SCH-05, FR-LIB-02 and FR-REC-11. No off-the-shelf framework can check them, because they are claims about the *structure* of the code rather than about its output — for example, "exactly one function in the codebase produces a placement" is not something any assertion library can express.

**NFR-MNT-07 requires each of them to be enforced by an automated check that fails the build.** An inspection recorded only as an instruction to look has no failing state and rots silently. Six guard scripts satisfy this — four covering the (I) requirements, one reinforcing FR-SCH-05 from a second angle, and one enforcing the test freeze (NFR-MNT-08):

| Guard | Requirement | What it enforces |
|---|---|---|
| `guard-single-placement.mjs` | **FR-RSC-03** | Exactly one function in the entire codebase produces a placement. Both the manual and the automatic path call it. |
| `guard-engine-purity.mjs` | **FR-SCH-05 / CON-04** | The engine calls no ambient source of impurity — no clock, no randomness, no I/O. |
| `guard-engine-deps.mjs` | **FR-SCH-05 / NFR-MNT-03** | The engine declares zero runtime dependencies. An engine that cannot import anything cannot import a clock. |
| `guard-offline-recommendation.mjs` | **FR-LIB-02** | No component of the recommendation path makes an external network call. |
| `guard-metric-extensibility.mjs` | **FR-REC-11 / FR-WER-04** | The recommendation engine has no knowledge of any individual rule, so a third metric is two additions and zero modifications. |
| `guard-tests-frozen.mjs` | **NFR-MNT-08** | A frozen test suite has not been edited, deleted, or quietly added to. |

**Every one of these guards was watched to fail against a deliberately introduced violation before it was accepted** (NFR-MNT-07). A guard that has never been observed to fail is indistinguishable from a guard that enforces nothing — both exit 0.

---

## 6. Two disciplines that make the numbers mean something

**Coverage is a failing build, not a statistic.** [`jest.config.cjs`](../jest.config.cjs) sets a threshold of 90% lines, statements and functions on `engine/src`. The engine currently measures **100% on all four metrics**. The threshold exists so that coverage cannot silently erode; the number is not something a person is expected to remember to look at.

**Tests were written before the implementation, by a separate agent session, and then frozen.** Under the project's RED/GREEN method (`docs/AGENTIC-TDD-WORKFLOW.md`), the session that writes a test suite never sees an implementation, and the session that writes the implementation **may not edit, skip, or weaken a test** — if it believes a test is wrong, it stops and a human adjudicates it against the SRS. Eight suites are pinned by a SHA-256 per file in `scripts/frozen-tests.json`:

| Packet | Frozen suite | Packet | Frozen suite |
|---|---|---|---|
| 04 | `engine/test` | 11 | `server/test/catalog` |
| 06 | `server/test/reschedule` | 15a | `server/test/analytics` |
| 08 | `server/test/wearable` | 17a | `server/test/acceptance` |
| 09 | `server/test/recommendation` | 17c | `server/test/replacement` |

This is what makes the coverage figure and the property test carry information: the implementation was derived independently of the tests, so the tests are not checking the code against itself.

---

## 7. How to run it

```bash
npm run verify          # everything — typecheck, lint, 6 guards, 498 tests, coverage gates
npm test                # the test suite alone
npm run test:coverage   # the suite plus the coverage report
npm run guard:tests-frozen   # verify no frozen test has been altered
```

### Continuous integration

`.github/workflows/ci.yml` runs the same gates as **ten separately named steps** — a clean `npm ci` from the lock file, typecheck, lint, each of the six guards individually, then the suite with coverage — so a failure reports *which* gate failed rather than only that something did.

⚠️ **It is triggered by a push to `main`, or by any pull request — not by a push to `dev` or to a work branch.**

```yaml
on:
  push:
    branches: [main]
  pull_request:
```

**The primary gate is therefore local, by design** (`CLAUDE.md` §8.5): a branch reaches `dev` only once its owner has run `npm run verify` and read the diff. CI is the backstop that catches what a machine-specific environment hides — a missing lock-file entry, a dependency that only resolves locally, a guard that passes because of an untracked file. **A work branch pushed without an open pull request runs no CI at all**, so a green local `verify` is the only evidence that branch has.
