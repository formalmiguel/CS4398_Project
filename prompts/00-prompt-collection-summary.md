# Claude Code Agent Prompt Collection — Adaptive Habit, Schedule & Wellness System

## **CRITICAL SUMMARY**: Complete Prompt Pack for System Implementation

### **MANDATORY**: 17 Sequential Prompts

This prompt pack contains **17 detailed prompts** designed to guide an AI coding agent through the complete implementation of the Adaptive Habit, Schedule & Wellness System specified in `docs/SRS-v2.md` (v2.6, ~84 verifiable requirements).

Each prompt follows the required formatting techniques with **Sandwich Method**, **Attention Anchoring**, **Visual Emphasis**, **Clear Delimiters**, and **Selective Context**.

---

### **CRITICAL**: This Pack Is a GENERATOR — Read This First

**MANDATORY**: **Run these prompts in order and the agent creates the code files.** Nothing here is a transcription exercise. The project is **specified but not yet written**; every prompt states **the requirement the code must satisfy**, quoted verbatim from the SRS, and the agent derives the implementation.

**CRITICAL**: **Re-running this pack may produce different code, and that is expected and acceptable.** Two rules follow from it, and they are not optional:

1. **⛔ NEVER paste generated code back into a prompt.** It freezes one run's arbitrary choices into the specification. After that, **NFR-MNT-01's 90% coverage figure measures agreement between the code and itself** — and the number keeps looking fine while meaning nothing.
2. **The tests are the only thing constant across runs.** That is why they are written first (prompt 04) and **frozen before the implementation** (prompt 05). A differently-shaped implementation must still satisfy the same **1,000-case property test** (NFR-COR-01) and the same eight boundary rows (FR-SCH-09).

> **MANDATORY: The implementation is disposable. The specification and its executable form are not.**
>
> **CRITICAL**: Delete `engine/src/`, re-run prompt 05, and the suite still passes. **That is the claim this structure makes**, and it is demonstrable on request.

**MANDATORY**: Where a prompt shows a **type signature**, a **boundary table**, or the **contract**, that is **the shape the code must satisfy** — an obligation, not an implementation. The one exception is prompt 03, which is **human-authored and transcribed exactly** *(`CLAUDE.md` §4.7)*.

---

### **MANDATORY**: Folders Are Ownership. Numbers Are Order.

**CRITICAL**: Packets are grouped into folders by **who owns them**, and numbered by **when they run**. These are two different axes and **both are binding**:

| Folder | Packets | Human owner | Module |
|---|---|---|---|
| `foundation/` | 01–03 | **Patrick Rucker** | scaffold, toolchain, the contract |
| `engine/` | 04–07 | **Patrick Rucker** | FR-SCH, FR-RSC |
| `wearable/` | 08–11 | **Ryan Woosley** | FR-WER, FR-REC, FR-LIB |
| `backend/` | 12 | **Miguel Alvarez** | FR-USR, FR-TSK, FR-CAL |
| `frontend/` | 13–15 | **Miguel Alvarez** | FR-DSH, FR-WEL, FR-ANL |
| `verification/` | 16–17 | **Patrick Rucker** | the **(I)** guards, integration |

> **⛔ CRITICAL: Run packets in NUMERICAL order — `01` through `17` — regardless of folder.** A folder is not a work queue. `wearable/08` runs after `engine/07` is available, not whenever Ryan gets to it. *(Parallelism is real and documented in `docs/AGENTIC-TDD-WORKFLOW.md` §9 — but it is described there in terms of what each packet is BLOCKED BY, not by folder.)*
>
> **MANDATORY**: The **`Human owner` field inside each packet is authoritative.** The folder is a convenience for finding things. **If the two ever disagree, the packet wins** and the folder is the thing to fix.

### ⚠️ **CRITICAL**: That Applies To `prompts/` ONLY — **Source Folders Are Named For The MODULE**

**MANDATORY**: **There is no folder ownership in the source tree** *(Patrick, 22 Jul)*. A packet is a unit of human review; a source folder is a unit of subject matter. **Do not carve `server/src/` up by who wrote it** — name each folder for what the code *is*, so it can be found by the name of the thing you are looking for:

| Module | Source | Tests | Packets |
|---|---|---|---|
| Reschedule service | `server/src/reschedule/` | `server/test/reschedule/` | **06–07** |
| Wearable adapter + Daily Metric Set | `server/src/wearable/` | `server/test/wearable/` | 08 |
| Recommendation rules | `server/src/recommendation/` | `server/test/recommendation/` | 09–10 |
| Catalog + seeded libraries | `server/src/catalog/` | `server/test/catalog/` | 11 |
| HTTP API + persistence | `server/src/api/`, `server/src/db/` | `server/test/api/` | 12 |

> **CRITICAL**: This mirrors **§3.6's class clusters**, so the class diagram and a directory listing read the same way, and it matches the committed `engine/src` ↔ `engine/test` shape. **A packet's *must-NOT-touch* list still fences one packet off from another's files — that is scope, not ownership.**

---

### **PROMPT FILES**:

| # | File | Phase | Status |
|---|---|---|---|
| 01 | `foundation/01-project-scaffold.md` | SCAFFOLD | ✅ Written |
| 02 | `foundation/02-toolchain-and-dependencies.md` | SCAFFOLD | ✅ Written |
| 03 | `foundation/03-shared-contract-types.md` | **HUMAN-AUTHORED** | ✅ Written |
| 04 | `engine/04-engine-tests-RED.md` | 🔴 RED | ✅ Written |
| 05 | `engine/05-engine-implementation-GREEN.md` | 🟢 GREEN | ✅ Written |
| 06 | `engine/06-reschedule-service-tests-RED.md` | 🔴 RED | ✅ Written *(22 Jul, immediately before its run)* |
| 07 | `engine/07-reschedule-service-GREEN.md` | 🟢 GREEN | ✅ Written *(22 Jul, before the implementation existed)* |
| 08 | `wearable/08-wearable-adapter-and-metric-set.md` | 🔴/🟢 | ⬜ Not yet written |
| 09 | `wearable/09-recommendation-rules-tests-RED.md` | 🔴 RED | ⬜ Not yet written |
| 10 | `wearable/10-recommendation-rules-GREEN.md` | 🟢 GREEN | ⬜ Not yet written |
| 11 | `wearable/11-catalog-and-seeded-libraries.md` | 🔴/🟢 | ⬜ Not yet written |
| 12 | `backend/12-backend-api.md` | 🔴/🟢 | ⬜ Not yet written — **⛔ must carry the OPEN-12 escalation, below** |
| 13 | `frontend/13-frontend-schedule-dashboard.md` | BUILD | ⬜ Not yet written |
| 14 | `frontend/14-frontend-wellness-view.md` | BUILD | ⬜ Not yet written |
| 15 | `frontend/15-frontend-analytics-view.md` | BUILD | ⬜ Not yet written |
| 16a | `verification/16a-guards-placement-purity.md` | GUARD | ⬜ Not yet written — **runnable now** |
| 16b | `verification/16b-guards-network-extensibility.md` | GUARD | ⬜ Not yet written — needs 10/11 |
| 17a | `verification/17a-acceptance-suite-RED.md` | 🔴 RED | ⬜ Not yet written |
| 17b | `verification/17b-integration-GREEN.md` | 🟢 GREEN | ⬜ Not yet written |

> **CRITICAL**: Prompts **08–17** are **enumerated but not yet authored.** Their scope, phase, and requirement IDs are fixed below and derived from the SRS; their detailed text is written when the packet is run. **This is deliberate.** A prompt authored weeks before its module is designed encodes guesses, and an agent will implement a guess as faithfully as a requirement. **A prompt that does not exist is visibly missing; a prompt written from speculation is invisibly wrong.**

---

### **MANDATORY**: Requirement Coverage Per Prompt

| # | Requirements in scope | SRS section |
|---|---|---|
| 01 | CON-04, CON-08, NFR-MNT-03, NFR-PRT-02 | §2.5, §4.5 |
| 02 | NFR-MNT-01, NFR-MNT-04, NFR-COR-01 *(tooling only)* | §4.5 |
| 03 | §3.6 class diagram; `CLAUDE.md` §4.7 | §3.6 |
| 04–05 | FR-SCH-01…06, FR-SCH-09, NFR-COR-01…03, NFR-PERF-01 | §3.8.4, §4.1 |
| 06–07 | FR-RSC-01…10, **FR-SCH-10**, **FR-TSK-04** *(the re-placement mechanism only — OPEN-18)* | §3.8.5, §3.8.4, §3.8.2 |
| 08 | FR-WER-01…10, DR-02, DR-04, DR-05, NFR-ROB-01 | §3.8.6, §5 |
| 09–10 | FR-REC-01…07, FR-REC-11, FR-REC-13 · ⚠️ **FR-REC-04 moved to 17a/17b on 22 Jul** — see below | §3.8.7 |
| 11 | FR-LIB-01…08, FR-LIB-10 | §3.8.11 |
| 12 | FR-USR, FR-TSK *(**except FR-TSK-04's mechanism**, which is 06–07 — packet 12 **calls** `onTaskEdited`)*, FR-CAL, NFR-SEC, NFR-PERF-02, **the task-creation placement path incl. FR-SCH-10 ordering (OPEN-17)** | §3.8.1–3.8.3 |
| 13 | FR-DSH-01…07, UI-01, UI-05, UI-07 | §3.8.8, §3.9.1 |
| 14 | FR-WEL-01…05, UI-03 | §3.8.9 |
| 15 | FR-ANL-01…06, UI-04 | §3.8.10 |
| 16a | FR-RSC-03, FR-SCH-05 *(subjects exist now)* | §3.8.5, §3.8.4 |
| 16b | FR-LIB-02, FR-REC-11 *(need packets 10/11)* | §3.8.7, §3.8.11 |
| 17a–17b | §6 verification approach, Appendix D acceptance, **FR-REC-04** *(its test is frozen in 17a, the wiring written in 17b — see the note below)* | §6, §3.8.7 |

---

---

### ⛔ **CRITICAL**: OPEN-12 — Ask Before Choosing a User Identifier

**MANDATORY**: **`shared/src/contract.ts` carries no `userId` field, and that is deliberate.**

FR-USR-04 requires every request to be scoped to its own user, and FR-ANL, FR-TSK, FR-WER and the dashboard all need to know whose data they are reading. But the SRS **deliberately does not say**:

- whether a user is keyed by **email address**, an **opaque internal id**, or something else, and
- whether ownership rides on the **domain types** (`Task`, `Placement`, `Metric`) or is applied at the **API boundary** around them.

**CRITICAL**: This is **deferred, not overlooked** — it is a **Frontend & Backend Lead decision (Miguel Alvarez)**, correctly made when the API and its persistence are built.

> **⛔ ANY agent working on packet 12, on persistence, or on any query that filters by user MUST STOP AND ASK MIGUEL. Do not choose a scheme and propagate it.**
>
> **MANDATORY**: The identifier reaches every collection, every query, and every frontend fetch. It is **expensive to reverse and invisible once made** — nothing fails, the code simply hardens around a decision nobody took. *(SRS Appendix C, OPEN-12; note under FR-USR-04.)*

**Whoever authors packet 12 must copy this escalation into it.** A note that lives only here does not reach the session that needs it.

---

### **USAGE INSTRUCTIONS**:

**CRITICAL**: Deliver prompts to the agent in **exact numerical order.** Each prompt builds upon previous implementations and maintains dependency relationships.

**MANDATORY**: **One prompt = one fresh agent session.** Clear context between prompts. A session that has seen a previous prompt's reasoning is no longer independent, and independence is what prompts 04/05, 06/07, and 09/10 depend on.

**CRITICAL**: **A 🔴 RED prompt and its 🟢 GREEN partner must never be run in the same session, by the same context, or without a human gate between them.** The gate procedure is `docs/AGENTIC-TDD-WORKFLOW.md` §6. **Between them, the tests are committed and frozen** — the commit is the permission boundary, and a fresh chat alone does not provide it.

---

### **PROMPT FEATURES**:

- **Sandwich Method**: Critical requirements restated at the beginning **and** end of each prompt
- **Attention Anchoring**: "MANDATORY" and "CRITICAL" directives at each decision point
- **Visual Emphasis**: Bold text, code blocks, tables, and structured formatting
- **Clear Delimiters**: `###` headers, `---` rules, and code-block separators
- **Selective Context**: Each prompt carries only the requirements it implements — **not the whole SRS**

---

### **EXPECTED OUTCOMES**:

- **One pure scheduling engine** — no clock, no database, no side effects (FR-SCH-05)
- **Exactly one placement function in the entire codebase** (FR-RSC-03, enforced by CI guard)
- **Real wearable data driving a real scheduled commitment** (FR-WER-10, **FR-REC-04**)
- **A schedule that repairs itself** on a miss, a user-declared skip, or a displacement (FR-RSC-01, -08, -02)
- **90% line coverage on the engine** (NFR-MNT-01) and **≥1,000-case property test** (NFR-COR-01)
- **The entire acceptance demonstration running with outbound network disabled** (FR-LIB-02)

---

### **VERIFICATION CHECKLIST**:

✓ Project compiles and type-checks with zero errors
✓ `engine/package.json` has an **empty `dependencies` block** — CI fails if one is added
✓ Every test name cites the requirement ID it verifies
✓ Property test executes ≥ 1,000 generated cases
✓ Engine coverage ≥ 90%
✓ **Exactly one** function in the codebase produces placements
✓ Recommendation path demonstrated with the network disabled
✓ `git diff` across a GREEN packet shows **zero** changes to any test file

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: The requirements quoted in each prompt are drawn **verbatim** from `docs/SRS-v2.md`. Where a prompt and the SRS disagree, **the SRS wins and the prompt is a defect** — report it rather than resolving it. An agent that silently reconciles a contradiction has made a requirements decision that no human agreed to.
