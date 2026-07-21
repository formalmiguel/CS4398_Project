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

## ⛔ **CRITICAL**: The Dependency Manifest — Install EXACTLY These

**MANDATORY**: These packages were **chosen by the team on 21 July** (`docs/TEAM-MEETING.md` decision log). **Do not substitute, add, or "upgrade" anything.** A package not listed here is a team decision, not a convenience.

### Root — `devDependencies` only, hoisted to all four workspaces

```
typescript  jest  ts-jest  @types/jest  @types/node
fast-check                       # NFR-COR-01 — ≥1,000 generated cases
eslint  @typescript-eslint/parser  @typescript-eslint/eslint-plugin
```

### `server/` — `dependencies`

```
express          # HTTP framework
mongodb          # the OFFICIAL DRIVER — NOT Mongoose. See below.
bcrypt           # password hashing (FR-USR-01, NFR-SEC)
jsonwebtoken     # sessions (FR-USR-02, FR-USR-04)
cors  dotenv
```
`devDependencies`: `@types/express  @types/cors  @types/bcrypt  @types/jsonwebtoken`

### `web/` — `dependencies`

```
react  react-dom
```
`devDependencies`: `vite  @vitejs/plugin-react  @types/react  @types/react-dom`

### `engine/` and `shared/` — **`"dependencies": {}`**

**⛔ CRITICAL: EMPTY. Permanently. CI fails if either gains one.** *(FR-SCH-05 — an engine that cannot import anything cannot import a clock. This applies to runtime `dependencies` only; the root `devDependencies` above are hoisted for testing, and the CI guard checks the `dependencies` field specifically.)*

### **MANDATORY**: Version policy

**Install with `npm install <pkg>` and let `package-lock.json` pin the exact resolved versions. Commit the lock file.** Two constraints on major versions, and both are deliberate:

- **Express 4, not 5.** Express 5 is stable but most middleware documentation and Stack Overflow answers still assume 4. **On a nineteen-day timeline the boring option ships** (`CLAUDE.md` §10).
- **React 18, not 19**, for the same reason.

---

## ⚠️ **CRITICAL**: Why the MongoDB Driver and NOT Mongoose

**MANDATORY**: **DR-05** requires **one document per metric per date, not one field per metric**, so that adding a wearable metric is an *insert* rather than a change to every reader.

> **Mongoose imposes schemas on a schema-free store, and a Mongoose schema can quietly fight that shape** — nothing would fail a test; FUT-02 would simply become expensive six months later. **The official driver has no opinion**, so DR-05 is satisfied by the code the team wrote rather than by a library default nobody reviewed.

**⛔ STOP and escalate if you find yourself wanting an ODM.** That is a team decision with a decision-log row.

---

## ⚠️ **MANDATORY**: `bcrypt` Is a Native Module — Watch CON-10

`bcrypt` compiles native bindings. It normally installs from a prebuilt binary, **but if compilation is attempted and no build toolchain exists, `npm ci` fails on a clean machine** — which breaks **CON-10** (*"deployable and runnable on a clean machine by a single documented command sequence"*).

**CRITICAL**: **Verify `npm ci` succeeds from a clean clone on a machine with no build tools** as part of this packet's done criteria. If it does not, **report it** — the drop-in fallback is `bcryptjs` (pure JavaScript, no compile step, same API, slower), but **swapping it is a team decision, not yours to make.**

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
- [ ] **CRITICAL**: `package-lock.json` exists **at the root**, is committed, and is the **only** lock file in the repository
- [ ] **CRITICAL**: **`npm ci` succeeds from a clean clone on a machine with no build toolchain** — this is the CON-10 check, and `bcrypt` is the package most likely to fail it
- [ ] **Every installed package appears in the manifest above.** If anything else was pulled in as a direct dependency, **report it** — it was a decision nobody made
- [ ] `README.md` states the command sequence to run the project on a clean machine

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report if:**

- A gate cannot be enforced in CI as specified. **Say which and why.** A gate that is documented but not enforced is **worse than none, because it is trusted.**
- Enforcing the empty-dependencies check would require adding a dependency to `engine/`. *(It would not — it is three lines of shell. **If you conclude otherwise, report it rather than adding one.**)*

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **A gate that is not enforced is not a gate; it is a hope.** This packet passes when **all five gates fail the build on violation, verified by deliberately breaking each one once** and restoring it.
