# ✅ RESOLVED — Dependency Decisions (was: for Miguel)

> **CLOSED 21 July 2026. Miguel decided all six.** Express · **official `mongodb` driver** (not Mongoose) · bcrypt · JSON Web Tokens · React + Vite · `engine`/`shared` empty.
>
> **The decisions now live in two places, and this file is neither of them:**
> - **`prompts/02-toolchain-and-dependencies.md`** — the pinned manifest an agent installs from
> - **`docs/TEAM-MEETING.md`** — the decision log row, with the reasoning
>
> **This file is kept only as the record of what was asked and why.** It is not authoritative and must not be updated — if it ever disagrees with the two above, they are right. *(Safe to delete once everyone has read it.)*

---

**From:** Patrick · **Date:** 21 July 2026 · **Blocked:** work packet `prompts/02-toolchain-and-dependencies.md`

**What I needed:** a yes/no or a counter-proposal on **six package choices** below. They're backend and frontend, which is your module. Ten minutes of reading, and the Mongoose one is worth actually thinking about.

---

## The situation

Packet 02 names *categories* — "Jest," "fast-check," "ESLint" — and never lists the actual packages.

**An agent running it will pick the runtime packages itself**, which means it would be choosing our stack: Express or Fastify, Mongoose or the raw MongoDB driver, bcrypt or argon2, Vite or Create React App.

Those aren't derivable from the SRS. **They're team decisions**, and per `CLAUDE.md` §0 they need decision-log rows — otherwise *"we use Mongoose"* becomes true because an agent typed it at 11pm and nobody noticed.

---

## What's settled, and what isn't

The tooling half is already decided — SRS §3.1 names TypeScript, Jest, fast-check, and ESLint. The application half isn't:

| Package | Needed for | Decided? |
|---|---|---|
| `typescript`, `jest`, `ts-jest`, `@types/jest`, `fast-check`, `eslint`, `@typescript-eslint/*` | Root devDeps — all four workspaces | ✅ SRS §3.1 |
| **HTTP framework** — Express or Fastify | `server/` — FR-USR, FR-TSK, FR-CAL | ❌ Nobody's chosen |
| **MongoDB access** — `mongodb` driver or Mongoose ODM | `server/` — DR-05 | ❌ **And this one has teeth** |
| **Password hashing** — bcrypt or argon2 | FR-USR-01, NFR-SEC | ❌ |
| **Sessions** — `express-session` or JWT | FR-USR-02, FR-USR-04 | ❌ |
| `react`, `react-dom`, **Vite** | `web/` | ❌ *(Vite is near-automatic though)* |
| *(nothing)* | `shared/`, `engine/` | ✅ **Empty, permanently** |

---

## ⚠️ The Mongoose choice is worth ten minutes rather than a coin flip

**Mongoose imposes schemas on a schema-free store.** That's usually good — but **DR-05** requires:

> one document per metric per date, **not** one field per metric

…precisely so that adding a new wearable metric is an *insert* rather than a change to every reader.

**A Mongoose schema can either enforce that shape or quietly fight it**, depending on how it's written. The raw driver has no opinion. Either works — but **picking without noticing the interaction is how DR-05 gets violated by a library default**, and it wouldn't fail any test. It would just make FUT-02 expensive six months from now, which is exactly the outcome DR-05 exists to prevent.

---

## Why `engine/` and `shared/` get nothing

`engine/package.json` has an **empty `dependencies` block, permanently**, and CI fails if one is added.

That's not tidiness. **FR-SCH-05** requires the engine to be a pure function — no clock, no database, no side effects — and **NFR-COR-01** requires it to be property-tested over 1,000 randomized days with no database and no browser. **An engine that can't import anything can't accidentally import a clock.**

*(This applies to runtime `dependencies` only. Jest and fast-check are dev tooling, live in the root `devDependencies`, and get hoisted by npm workspaces. The CI guard checks the `dependencies` field specifically — otherwise it would fire the moment anyone added a test runner, and people would turn it off.)*

---

## What I'd like back

**Either:**

- **"Go ahead"** — I'll write a fully pinned manifest into packet 02 with a recommendation and reasoning for each of the six rows. You review it and change anything you disagree with; it becomes a decision-log row in `TEAM-MEETING.md`.

**Or:**

- **Your picks for the six rows**, and I'll write those in instead.

Either way it takes minutes. What I want to avoid is the third option — **letting an agent decide by default**, which is what happens if packet 02 runs as currently written.

---

## Notes on how dependencies work here

- **One lock file, not four.** npm workspaces hoists everything: a root `package.json` with a `workspaces` array, per-package `package.json` files, and a **single `package-lock.json` at the root**. One `npm ci` at the root installs for all four packages.
- **`package-lock.json` is committed.** It pins the exact resolved version of every package *and every transitive dependency*. Without it, you and I run `npm install` a week apart and get different trees — and **CON-10** ("runnable on a clean machine by a single documented command sequence") stops being true.
- **`npm ci`, not `npm install`, on a fresh clone and in CI.** `npm install` may silently update the lock file; `npm ci` installs exactly what the lock says and fails if they disagree. That reproducibility is what satisfies CON-10.
