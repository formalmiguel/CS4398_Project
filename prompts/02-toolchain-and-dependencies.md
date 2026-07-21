# CRITICAL REQUIREMENTS — 02 Toolchain, Dependencies, and CI Gates

### MANDATORY DIRECTIVE ###

You are an expert TypeScript engineer. **CRITICAL**: Configure the toolchain and the CI gates exactly as specified. **Every gate below must FAIL THE BUILD** when violated.

| | |
|---|---|
| **Phase** | SCAFFOLD |
| **Human owner** | **Patrick Rucker** *(repo owner)* |
| **Depends on** | 01 (scaffold) |
| **Spec** | `docs/SRS-v2.md` §3.1, §4.5 (NFR-MNT-01, NFR-MNT-04), §4.1 (NFR-COR-01), CON-10 |

---

## **MANDATORY**: Toolchain

Per SRS §3.1:

| | |
|---|---|
| Language | TypeScript, `strict: true`, **everywhere** |
| Test | **Jest** + `ts-jest` |
| Property testing | **fast-check** *(NFR-COR-01 requires ≥ 1,000 generated cases)* |
| Lint | ESLint + `@typescript-eslint` |
| Coverage | Jest's built-in reporter |

---

## ⛔ **CRITICAL**: CI Gates — `.github/workflows/ci.yml`

**MANDATORY**: Every one of these **FAILS THE BUILD.**

> **A gate that is not enforced is not a gate; it is a hope.**

- [ ] `tsc --noEmit` — **zero** errors *(NFR-MNT-04)*
- [ ] `eslint` — **zero** errors *(NFR-MNT-04)*
- [ ] `jest` — all tests pass
- [ ] **CRITICAL**: **Coverage: `engine/` at ≥ 90% lines** *(NFR-MNT-01, Essential)* — configured as a `coverageThreshold` in `engine`'s Jest config so it is **a failing build, not a number someone is supposed to look at.**
- [ ] **CRITICAL**: `engine/package.json` has an **empty `dependencies` block** — a CI step asserts this.

> **MANDATORY**: That last one is the **FR-SCH-05 purity guard.** It is three lines of shell and it makes an architectural requirement **structurally unbreakable** rather than merely documented.

---

## **CRITICAL**: Files You May Create Or Edit

- `tsconfig.base.json`, `.eslintrc.cjs`, `jest.config.base.cjs`, per-package configs
- `.github/workflows/ci.yml`
- `README.md` — the single documented command sequence

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ Any product logic.** This packet configures tools; it does not implement requirements.
- `shared/src/contract.ts` — authored in prompt 03

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] `npm ci && npm test` passes from a clean clone *(CON-10, NFR-PRT-05: one documented command sequence)*
- [ ] `tsc --noEmit` reports **zero** errors
- [ ] `eslint` reports **zero** errors
- [ ] **CRITICAL**: The 90% engine coverage threshold is a **Jest `coverageThreshold`**, verified by deliberately dropping coverage once and watching the build fail
- [ ] **CRITICAL**: The empty-dependencies check is verified by **adding a dependency once and watching CI fail**, then reverting
- [ ] `fast-check` is installed as a **dev** dependency where the property test will live
- [ ] `README.md` states the command sequence to run the project on a clean machine

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report if:**

- A gate cannot be enforced in CI as specified. **Say which and why.** A gate that is documented but not enforced is **worse than none, because it is trusted.**
- Enforcing the empty-dependencies check would require adding a dependency to `engine/`. *(It would not — it is three lines of shell. **If you conclude otherwise, report it rather than adding one.**)*

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **A gate that is not enforced is not a gate; it is a hope.** This packet passes when **all five gates fail the build on violation, verified by deliberately breaking each one once** and restoring it.
