# CRITICAL REQUIREMENTS — 01 Project Scaffold and Package Boundaries

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Create the workspace structure and package boundaries exactly as specified below. **This packet contains NO product logic** — no engine, no rules, no API, no UI.

| | |
|---|---|
| **Phase** | SCAFFOLD |
| **Human owner** | **Patrick Rucker** *(repo owner)* |
| **Depends on** | Nothing. **This is the first thing that happens.** |
| **Spec** | `docs/SRS-v2.md` §3.1 (tools), §4.5 (NFR-MNT), §2.5 (CON-04) |

---

## **MANDATORY**: Repo Layout

An **npm workspaces** monorepo. One language across the stack so all three teammates can review any file (`docs/TEAM-MEETING.md` Q6).

```
/
├── package.json                 # workspaces root
├── tsconfig.base.json
├── .eslintrc.cjs
├── jest.config.base.cjs
├── .github/workflows/ci.yml
├── shared/
│   └── src/contract.ts          # ◄── THE CONTRACT. Nothing else in this file.
├── engine/                      # ◄── PURE. Zero runtime dependencies. Ever.
│   ├── src/
│   └── test/
├── server/
│   ├── src/
│   └── test/
└── web/
    ├── src/
    └── test/
```

> **CRITICAL**: `docs/` and `prompts/` already exist at the root and are **not** workspaces. Do not move, rename, or add them to `package.json`.

### ⛔ **CRITICAL**: The Engine Package Has Zero Runtime Dependencies — Permanently

**MANDATORY**: `engine/package.json` **has an empty `dependencies` block**, and it stays empty. Not "small." **EMPTY.**

> That is not tidiness. **FR-SCH-05** requires the engine to be a pure function — *no clock, no database, no side effects* — and **NFR-COR-01** requires it to be property-tested over 1,000 randomized days with no database and no browser. **An engine that cannot import anything cannot accidentally import a clock.** The dependency boundary is what enforces the purity requirement, so **let the packaging do the work rather than trusting everyone to remember.**

---

## **CRITICAL**: Files You May Create Or Edit

- The directory tree above, `package.json` files, and workspace configuration

## **CRITICAL**: Files You Must **NOT** Create

- **⛔ Any product logic.** No `findCandidateSlots`, no rules, no endpoints, no React components.

> **MANDATORY**: If you wrote a scheduling implementation, you have exceeded this packet — **delete it.** It belongs to prompt 05, and **prompt 04's tests must be written before it exists.**

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] The directory tree above exists exactly as shown
- [ ] **CRITICAL**: `engine/package.json` `dependencies` is `{}` — **empty, not "small"**
- [ ] `npm install` succeeds from a clean clone
- [ ] `shared/src/contract.ts` exists as an **empty placeholder** — it is authored in prompt 03
- [ ] **CRITICAL**: **No product logic exists anywhere in the repository**

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report — do not decide it yourself — if:**

- The layout here conflicts with anything in `docs/SRS-v2.md`. **The SRS wins**, and the conflict needs recording.
- You believe an additional package is required. **MANDATORY: Do not add it.** The four seams (`shared`, `engine`, `server`, `web`) are the module boundaries the SRS draws, and adding a fifth is a team decision with a decision-log row.

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when the tree exists, `npm install` succeeds, `engine`'s dependencies block is empty, and not one line of product logic has been written.**
