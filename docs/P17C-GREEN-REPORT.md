# Packet 17c (GREEN) — Replacement Durability (OPEN-27): Agent Report

**Packet:** `prompts/verification/17c-replacement-durability.md` · **Phase:** 🟢 GREEN · **Human owner:** Patrick Rucker
**Run:** 26 July 2026 · **Branch:** `wp-open27-replacement-durability` (off `dev`) · **Spec:** SRS v2.28 (§3.6, §3.8.5 rule 4, §5/DR-06)
**Status:** 🟢 **GREEN achieved.** The frozen 17c durability test (`server/test/replacement/`, frozen `47bb301`) passes. `npm run verify` **319 green**, engine 100%, all guards green, every frozen dir's `git diff` empty. **Not committed** (§8.5 — awaits the owner's ask).

> Separate session from the RED author (§4.6). This session **did not edit any test.** It read the SRS, the contract, the packet, `docs/P17C-RED-REPORT.md`, and the frozen 17c test (to know what outcome to satisfy), then implemented the ratified `SUPERSEDED` fix.

---

## The defect (OPEN-27), restated

`RecommendationScheduler.applyWorkoutRecommendation` replaced an above-tier workout by marking its `Placement` **`CANCELLED`** and placing a new recovery task. `CANCELLED` is neither `PLANNED` nor occupying, so the replaced task was left with **no `PLANNED` placement** — and `RescheduleService.sweepElapsed`'s FR-RSC-05 re-attempt branch re-places **any** task with no `PLANNED` placement. On the next `GET /schedule` the replaced run **resurrected** beside the recovery session, silently undoing the replacement.

Root cause: the domain had no durable, per-occurrence "set aside" concept, and `CANCELLED` is a semantic overload (the contract defines it as an FR-RSC-09 *withdrawal*).

---

## The fix — the ratified `SUPERSEDED` status (option (b))

Three changes, **zero test files touched**:

### 1. Contract — the human-authored `SUPERSEDED` amendment (§4.7), transcribed VERBATIM

`shared/src/contract.ts`: added `'SUPERSEDED'` as a sixth `PlacementStatus` member, with the packet's comment word-for-word. A GREEN agent may not invent a `PlacementStatus` member — this is the packet's text, not the agent's.

### 2. `RecommendationScheduler` — vacate as `SUPERSEDED`, not `CANCELLED`

`applyWorkoutRecommendation` step 5 now writes `status: 'SUPERSEDED'` for the replaced occurrence. It remains outside `OCCUPIES_TIME` (`['PLANNED','COMPLETED']`), so the vacated slot is still freed for the recovery session exactly as before — only the re-attempt eligibility changes.

### 3. `RescheduleService.sweepElapsed` — exclude a `SUPERSEDED` occurrence from re-attempt

The re-attempt branch (`plannedRows.length === 0`) now `continue`s past a task whose date-occurrence is `SUPERSEDED`:

```ts
if (mine.some((p) => p.status === 'SUPERSEDED')) continue;
```

This is **the actual fix**: FR-RSC-05's self-heal never reaches a deliberately-replaced run. `mine` is already scoped to the retrieval's date, so the exclusion is **per-occurrence** — a recurring workout's other dates still self-heal normally. The `OCCUPIES_TIME` doc-comment was updated to name `SUPERSEDED` alongside `CANCELLED`.

---

## FR-RSC-03 held — no second placement function

`guard:single-placement` is green. Nothing in this change finds a free gap, ranks, merges intervals, or computes a start time. The recovery session is still placed by the injected `findCandidateSlots`, verbatim; the fix is two status *exclusions*, not a placement.

---

## Every other `PlacementStatus` consumer — checked, and unchanged

Grepped every `PlacementStatus` / status consumer under `server/src`, `web/src`, and confirmed each still type-checks and behaves:

| Consumer | Behaviour with `SUPERSEDED` | Change? |
|---|---|---|
| `RescheduleService` `OCCUPIES_TIME` | excludes `SUPERSEDED` → frees the slot | doc-comment only |
| `RecommendationScheduler` `OCCUPIES_TIME` | excludes `SUPERSEDED` → busy set correct | none (already `['PLANNED','COMPLETED']`) |
| `app.ts` `OCCUPYING` (`GET /schedule` busy set) | excludes `SUPERSEDED` | none needed |
| `app.ts` `EXPORTABLE_STATUSES` (`.ics`) | `SUPERSEDED` not exportable — a replaced occurrence never happened, correctly a phantom avoided, exactly like `CANCELLED` | none needed |
| `TaskRepository.plannedDatesForTask` | queries `status: 'PLANNED'` only → a superseded date is not treated as planned | none needed |
| `OccurrenceBlock.tsx` | status equality comparisons only; a `SUPERSEDED` block renders without a done-marker/buttons | none needed, type-checks |

No exhaustive `switch`/`never` narrowing on `PlacementStatus` exists anywhere, so widening the union broke no compile.

---

## Verification

| Check | Result |
|---|---|
| `npx jest test/replacement` (the frozen 17c test) | ✅ 1 passed |
| `npm run typecheck` (root + `web`) | ✅ clean |
| `npm run lint` | ✅ clean |
| `npm run guard:single-placement` | ✅ green (FR-RSC-03 / NFR-MNT-03) |
| `npm run guard:engine-purity` / `guard:engine-deps` | ✅ green |
| `npm run guard:tests-frozen` | ✅ P04 `ac06e70` · P06 `c30e784` · P08 `1199d80` · P09 `59f4e8a` · P17a `8809158` · **P17c `47bb301`** — all unchanged |
| `npm run verify` | ✅ **319 passed** (318 + the 17c test), engine 100% coverage |
| `git diff` of every frozen dir (04/06/08/09/17a/17c) + `scripts/frozen-tests.json` | ✅ empty |
| Files changed | `shared/src/contract.ts`, `server/src/recommendation/RecommendationScheduler.ts`, `server/src/reschedule/RescheduleService.ts` — **3 files, 0 test files** |

---

## Escalations

**None.** The SRS and the packet agree; the ratified design (`SUPERSEDED`, option (b)) is exactly what was implemented, and the contract amendment was given verbatim. No `PlacementStatus` consumer needed behaviour invented for the new status beyond the packet's two exclusions.

---

## Documentation updated in the same turn (§0)

- **OPEN-27 CLOSED** in `docs/TEAM-MEETING.md` (Open Issues row + a GREEN decision-log row).
- **CLAUDE.md** — §9 status block + the "Last updated" header lead.
- **SRS → v2.28** — revision-history row; §3.6 ratification note; §3.8.5 rule 4 (re-attempt exclusion); §3.8.5 rule 1 + §5/DR-06 (the terminal-status set, `SUPERSEDED` distinct from the `CANCELLED` withdrawal).

## Integration (this session, at the owner's explicit instruction)

The owner (Patrick) reviewed and directed that everything needed reach `dev`. `dev` was found to already carry the full 17a/17b chain at tip `1a0864e`, and this branch sat directly on that tip, so the only outstanding work was the 17c GREEN commit and the merge.

- [x] **`P17c GREEN` commit** — the 3 code/contract files, trailers `Requirements: FR-REC-02, FR-REC-04, FR-RSC-05, FR-RSC-06` / `Packet: 17c` / `Owner: Patrick Rucker`, body `Tests unchanged since 47bb301.` No AI credit lines (§8.2).
- [x] **`docs:` commit** — this report + SRS v2.28 + TEAM-MEETING (OPEN-27 closed) + CLAUDE.md.
- [x] **Merged** `wp-open27-replacement-durability` → `dev` (`--no-ff`, per the repo's merge convention) and **pushed to `origin`**. `verify` green on the merge result.

⚠️ `TaskRepository.createTask`'s `source?` param (17b, Miguel's `db/`) was the cross-owner heads-up carried on this branch's base; the owner confirmed Miguel was informed before this merge.
