# Rebuilding the System From Its Specification

> **The claim this document makes, and it is meant to be performed rather than asserted:**
> **delete every generated source file, execute the work packets in order, and the application comes back** — satisfying the same requirements, with each test suite **written and frozen by that run** rather than restored from this one.
>
> **It does not claim the same code.** It claims the same requirements met by an implementation derived independently each time, which is the only thing that makes NFR-MNT-01's 90% coverage figure and NFR-COR-01's 1,000-case property test mean anything at all. *(SRS **NFR-MNT-09**, Conditional.)*

**Last updated:** 24 July 2026

---

## 1. What is generated, and what is not

**Three things are human-authored inputs to the generator. Everything else is output.** They are named here rather than implied, because the difference is the whole argument.

| Human-authored input | Where | Why it may not be regenerated |
|---|---|---|
| **The requirements** | `docs/SRS-v2.md` | It is the specification. Obviously. |
| **The domain contract** | `shared/src/contract.ts`, given verbatim in `prompts/foundation/03-shared-contract-types.md` | Three sessions produce three locally-reasonable, mutually incompatible `Task` types, each passing its own tests, and integration becomes a rewrite. *(`CLAUDE.md` §4.7)* |
| **The guards and the freeze** | `scripts/`, `.eslintrc.cjs`'s `engine/**` overrides — given verbatim in `prompts/foundation/02b-executable-guards.md` | **A regenerated safety net can come back weaker, and a weaker check passes.** Nothing fails, nobody is told, and the guard still prints its success line. **You cannot verify a verifier with the thing it verifies.** *(SRS NFR-MNT-09)* |

Everything under `engine/src/`, `server/src/`, `web/src/`, `engine/test/` and `server/test/` is **output**, and is expected to differ between runs.

---

## 2. What to delete

```
engine/src/          engine/test/
server/src/          server/test/
web/src/
```

and reset the freeze manifest to empty — `scripts/frozen-tests.json`, `"frozen": []`. *(Packet 02b creates it in that state; a replay that starts from a populated manifest is checking this run's tests against the previous run's digests, which will fail immediately and confusingly.)*

**Do not delete** `scripts/`, `shared/src/contract.ts`, `.eslintrc.cjs`, `docs/`, or `prompts/` — see §1.

---

## 3. The run sheet

**One packet, one agent session.** Never two packets in one session, and **never a RED packet and its GREEN partner in the same session** — see §5, which is the part that actually matters.

| # | Packet | Phase | After it, check |
|---|---|---|---|
| 01 | `foundation/01-project-scaffold.md` | SCAFFOLD | workspaces resolve |
| 02 | `foundation/02-toolchain-and-dependencies.md` | SCAFFOLD | `npm run typecheck` and `npm run lint` clean |
| **02b** | `foundation/02b-executable-guards.md` | **HUMAN-AUTHORED** | `npm run verify` passes; freeze guard prints *no frozen test suites recorded yet* |
| 03 | `foundation/03-shared-contract-types.md` | **HUMAN-AUTHORED** | contract transcribed byte-identically |
| 04 | `engine/04-engine-tests-RED.md` | 🔴 RED | **🚦 RED GATE** → **freeze** |
| 05 | `engine/05-engine-implementation-GREEN.md` | 🟢 GREEN | suite green, freeze guard green, engine coverage ≥ 90% |
| 06 | `engine/06-reschedule-service-tests-RED.md` | 🔴 RED | **🚦 RED GATE** → **freeze** |
| 07 | `engine/07-reschedule-service-GREEN.md` | 🟢 GREEN | suite green, both freeze entries green |
| 12 | `backend/12-backend-api.md` | BUILD | `npm run verify` |
| 13 | `frontend/13-frontend-schedule-dashboard.md` | BUILD | `npm run verify`; app serves |
| 16a | `verification/16a-guards-placement-purity.md` | GUARD | both new guards watched to fail, then pass |

> ⚠️ **Packets 08–11, 14, 15, 16b, 17a and 17b are not yet authored**, so a replay today reproduces exactly what has been built and no more. That is a gap in coverage, not a defect in the method — and it is why **NFR-MNT-09 is Conditional**: the claim cannot be demonstrated in full until every packet exists.

**Between packets, no commits are required.** The freeze is content-addressed (NFR-MNT-08) and works with no repository history at all. Commit at the end, once, as the human's assertion that they read the result — which is what `CLAUDE.md` §8.5 asks for anyway.

---

## 4. The freeze, mechanically

At each 🚦 RED gate, once the gate is held (§5):

```
npm run freeze -- --packet 04 --path engine/test --tests <count the runner just printed>
```

That records a **sha256 per file** in `scripts/frozen-tests.json`. From that moment `npm run guard:tests-frozen` fails if any file in the suite is **edited, deleted, renamed, or added** — including by the GREEN session that runs next, and including if it commits the change.

**No commit is involved and none is needed.** A git sha is recorded alongside when one happens to be available; it is provenance, not enforcement, and its job is to catch a suite that was edited and then re-frozen to cover the edit.

> ⛔ **Never hand-edit `scripts/frozen-tests.json`, and never re-run `npm run freeze` to make a build go green.** Both are editing the test, one level removed. If a frozen test is genuinely wrong, a **human** adjudicates it against the SRS and re-freezes with the reasoning recorded — `CLAUDE.md` §8.3.

---

## 5. The gates — two are mechanical, one is not

### 🤖 Mechanical: the RED suite must FAIL

```
npx jest <suite path>     # must exit NON-ZERO
```

**A RED packet whose suite passes has failed.** It means the agent wrote the implementation as well as the tests, and the packet is compromised — discard it and re-run RED. Every failure should be the throwing stub (`Error: 05`, `Error: 07`); a failure for any *other* reason means a test is broken rather than merely unimplemented.

### 🤖 Mechanical: the GREEN suite must PASS with the freeze intact

```
npm run verify
```

### 🧑 Human: adjudicate escalations, and hold the gate

**This one cannot be automated, and automating it would void the method.**

A RED session reports the ambiguities it refused to guess at. Each is a requirements decision: it is answered in `docs/SRS-v2.md`, with a row in `docs/TEAM-MEETING.md`'s decision log — **not** by the agent picking something reasonable. `AGENTIC-TDD-WORKFLOW.md` §6 also requires **a second person** at the gate: an owner may merge their own branch, but **nobody freezes their own test suite.**

> **A replay should raise far fewer escalations than the first run did — and that is the system working.** Packet 06's first run raised fourteen; all fourteen were adjudicated into the SRS, so v2.21 now *states* the answers that run had to stop and ask for. **Zero escalations means zero pauses.** It also means a replay does not reproduce the original run's *questions*, only its requirements.

---

## 6. Why RED and GREEN can never share a session

**This is the one rule that cannot be relaxed for convenience, and it is not about commits or branches.**

When a single session writes the test and the code, it writes the test *after* watching the code behave. The assertion then records **what the code does** rather than **what the requirement says**. It goes green. It looks entirely reasonable. And NFR-MNT-01's coverage figure and NFR-COR-01's property test are now measuring the code against itself — **staying green while measuring nothing.**

`AGENTIC-TDD-WORKFLOW.md` §1.1 is blunt that this is **structural**: it is not a prompting problem, and it cannot be fixed by asking the session to be careful. The split is the fix.

> **So: "run the packets start to finish" means N sessions back to back, not one long one.** Everything else in this document is machinery around that sentence.

---

## 7. What "it came back" means, and what it does not

| Comes back identical | Comes back equivalent | Does not come back |
|---|---|---|
| `shared/src/contract.ts` — transcribed verbatim | The module seams, the endpoints, the screens | The implementation, line for line |
| `scripts/` and the `engine/**` lint overrides — transcribed verbatim | The requirements satisfied, and the (I) guards enforcing them | The test suite — different count, names, and assertions |
| | Engine coverage ≥ 90%; property test ≥ 1,000 cases | The freeze digests, which are that run's |

**Environmental preconditions are not produced by any packet and never will be:** a reachable MongoDB (`server/.env`, gitignored, holding a connection string — `CLAUDE.md` §8.4 keeps credentials out of the repository), Node ≥ 20, and a browser for the packet 13 check. If `server/.env` is absent, packets 12 and 13 build and test green and have nothing to connect to.

> **The honest summary, and the one to say out loud in a presentation:**
> *"The specification and its three human-authored inputs generate the application. Re-running produces different code and a different test suite — deliberately, because an implementation derived independently of its tests is the only reason our coverage number means anything. What is reproducible is that the requirements are met and that the safety nets are watching."*
