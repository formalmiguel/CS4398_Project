# Adaptive Habit, Schedule & Wellness System — Complete Agent Prompt Collection

## **CRITICAL PROJECT OVERVIEW**

This directory contains **18 prompts** (a summary plus 17 sequential packets) designed to guide an AI coding agent through the complete implementation of a web application that combines an **adaptive scheduling engine** with **real wearable health data**.

The System demonstrates a **pure-function scheduling core** with **observer-free, side-effect-free placement logic**, a **registry-based recommendation engine**, and an **adapter-isolated wearable data layer**, built against a formal SRS of ~84 verifiable requirements (`docs/SRS-v2.md`, v2.5).

---

## **MANDATORY EXECUTION SEQUENCE**

### **Phase 1: Project Foundation (Prompts 1–3)**
- **`01-project-scaffold.md`** — Creates the workspace layout and package boundaries
- **`02-toolchain-and-dependencies.md`** — Configures TypeScript, Jest, fast-check, ESLint, and the CI gates
- **`03-shared-contract-types.md`** — Defines the domain contract every other package imports

> **CRITICAL**: Prompt 03 is **human-authored and ratified before any agent runs.** See "The Contract Is Frozen" below.

### **Phase 2: The Scheduling Engine (Prompts 4–5)**
- **`04-engine-tests-RED.md`** — Writes the failing test suite. **No implementation.**
- **`05-engine-implementation-GREEN.md`** — Makes the suite pass. **May not edit a test.**

### **Phase 3: Automatic Rescheduling (Prompts 6–7)**
- **`06-reschedule-service-tests-RED.md`** — Trigger tests: missed, skipped, displaced, corrected
- **`07-reschedule-service-GREEN.md`** — The service. **Calls the engine of Phase 2 — no new placement logic.**

### **Phase 4: Wearable Data and Recommendations (Prompts 8–10)**
- **`08-wearable-adapter-and-metric-set.md`** — Source-independent metric ingestion
- **`09-recommendation-rules-tests-RED.md`** — Sleep→intensity and calories→target rule tests
- **`10-recommendation-rules-GREEN.md`** — The rule registry and the two shipping rules

### **Phase 5: Content and Backend (Prompts 11–12)**
- **`11-catalog-and-seeded-libraries.md`** — Workout and meal libraries behind a catalog interface
- **`12-backend-api.md`** — Accounts, tasks, commitments, persistence

### **Phase 6: Frontend (Prompts 13–15)**
- **`13-frontend-schedule-dashboard.md`** — The day view, complete/skip actions, reschedule notices
- **`14-frontend-wellness-view.md`** — Metrics, recommended workout, meal plan
- **`15-frontend-analytics-view.md`** — Streaks and completion rates

### **Phase 7: Guards and Integration (Prompts 16–17)**
- **`16-inspection-requirement-guards.md`** — Executable CI guards for every **(I)** requirement
- **`17-complete-implementation-guide.md`** — Integration, acceptance demonstration, verification

---

## **ARCHITECTURE SPECIFICATIONS**

### **Module Seams**
- **`engine/`** — The pure scheduling function. **Zero runtime dependencies, permanently.**
- **`shared/`** — The domain contract. Human-owned, frozen.
- **`adapter/`** — Wearable data normalization behind one interface
- **`catalog/`** — Workout and meal libraries behind one interface
- **`api/`** — Backend, persistence, session management
- **`frontend/`** — Three views

### **Design Principles Enforced by Requirement**
- **Purity** — the engine takes a `schedulableDay` parameter because FR-SCH-05 denies it a clock (FR-SCH-04/05)
- **Single Placement Function** — rescheduling re-invokes the engine; it is **not** a second algorithm (FR-RSC-03)
- **Extension by Addition** — a new metric is an insert plus a rule registration, never a modification (FR-WER-04, FR-REC-11, DR-05)
- **Adapter Isolation** — the recommendation engine cannot tell an exported file from a live API from an injected test value (FR-WER-01, FR-WER-05)
- **Explicit Failure** — no valid slot returns a reason, never an empty array (FR-SCH-06)

### **Technical Stack**
- **TypeScript** — across frontend and backend, so all three team members can review the whole codebase
- **Node.js + React** — backend and frontend
- **MongoDB** — one document per metric per date, **not** one field per metric (DR-05)
- **Jest + fast-check** — unit and property-based testing

---

## **CRITICAL: THE CONTRACT IS FROZEN**

**MANDATORY**: `shared/src/contract.ts` is written **by a human, once, before any agent runs**, and given verbatim to every subsequent prompt.

**CRITICAL**: An agent that wants to change it **must stop and escalate.** It is a team decision with a row in the decision log (`docs/TEAM-MEETING.md`), not a refactor.

> **The rejected alternative was letting each module's agent define the types it needs.** Three agents produce three locally-reasonable, mutually incompatible `Task` types, each passing its own tests, and integration becomes a rewrite. **Agents make this worse rather than better, because they generate plausible types faster than a human notices they disagree.**

Fixed conventions inside it:
- **Time is `Minute`** — an integer, minutes since local midnight. The engine never sees a `Date`.
- **Priority is 1–5, where 1 is highest.**
- **`engine/` has an empty `dependencies` block, permanently.** An engine that cannot import anything cannot import a clock.

---

## **CRITICAL: THE RED/GREEN SEPARATION**

**MANDATORY**: Prompts marked 🔴 **RED** and 🟢 **GREEN** are **separate agent sessions with a human gate between them.**

| | What it prevents | How it is obtained |
|---|---|---|
| **Context isolation** | The RED agent writing tests that describe an implementation it just designed | **A fresh session** |
| **Permission boundary** | The GREEN agent "fixing" a test it cannot pass | **The tests being committed and frozen in git** |

> **CRITICAL**: A fresh chat gives you the first and **not** the second. A brand-new GREEN session with write access to the test folder will, when stuck on the last failing assertion, **weaken that assertion** — and produce a fluent, entirely reasonable explanation of why the test was subtly incorrect. **Do not rely on it being forbidden. Make it impossible.**

**MANDATORY GATE PROCEDURE**: `docs/AGENTIC-TDD-WORKFLOW.md` §6 — a ten-item checklist a human works before the freeze commit. **Budget 30–45 minutes. Do it with two people.**

---

## **PROMPT FORMATTING FEATURES**

Each prompt implements **five critical formatting techniques**:

### **1. Sandwich Method**
- A `CRITICAL REQUIREMENTS` block opens each prompt and a mirrored block closes it
- The **escalation clause** and the **pass condition** are restated at the end, where an agent's attention returns before it acts

### **2. Attention Anchoring**
- Explicit **MANDATORY** and **CRITICAL** directives at each decision point
- **⛔ STOP** markers on the two irreversible mistakes: writing an implementation during RED, and editing a test during GREEN

### **3. Visual Emphasis**
- Bold for every obligation; tables for requirement sets and boundary cases
- Code blocks for type signatures and shell commands
- Blockquotes for the reasoning behind a rule — **so a reader who disagrees can see what they would be overruling**

### **4. Clear Delimiters**
- `###` headers for distinct sections; `---` rules between major divisions
- Consistent section order across all prompts (see `_TEMPLATE.md`)

### **5. Selective Context**
- Each prompt carries **only the requirements it implements**, quoted verbatim
- The full SRS is referenced by section, never pasted — **an agent given 84 requirements optimizes for none of them**

---

## **VERIFICATION AND TESTING**

### **Compilation Requirements**
- All packages compile and type-check with **zero** errors
- `npm run lint` passes with zero errors (NFR-MNT-04)
- `engine/package.json` `dependencies` block is **empty** — CI fails if changed

### **Functional Testing**
- Engine unit suite plus a **≥1,000-case property test** (NFR-COR-01)
- **Engine line coverage ≥ 90%** (NFR-MNT-01)
- Every boundary row in FR-SCH-09 has an explicit test (NFR-COR-03)
- Acceptance demonstration runs **with outbound network disabled** (FR-LIB-02)

### **Architecture Validation**
- **Exactly one function in the codebase produces placements** (FR-RSC-03) — verified by executable guard, not by inspection alone
- The engine imports no clock, no database client, and no HTTP library (FR-SCH-05)
- Adding a third metric is an **addition**, proven by doing it (FR-REC-12)

---

## **QUALITY ASSURANCE**

### **Code Standards**
- **Every test name cites the requirement ID it verifies.** These names are the traceability matrix (Appendix B); a grader reads the test output as evidence.
- A test citing no requirement is the agent's opinion — **find its requirement or delete the test**
- Consistent naming; no implementation helpers in a RED packet

### **Escalation Is a Success Condition**
**CRITICAL**: Every prompt ends with an escalation clause. An agent that finds a contradiction between two requirements, or an ambiguity it cannot resolve from the SRS, **must stop and report rather than choose.**

> **MANDATORY**: An invented rule, once encoded in a test, becomes a requirement nobody agreed to — and the GREEN agent will faithfully implement it. **A packet that finishes with zero escalations on a genuinely ambiguous specification is the outcome to be suspicious of.**

---

This prompt collection provides comprehensive guidance for implementing a professional-quality adaptive scheduling system with proper architecture, enforced design constraints, and requirement-level traceability from the SRS through to the test output.
