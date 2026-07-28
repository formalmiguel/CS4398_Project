# Packet 17d — Wire the Recommendation Path Into the Running System

**Branch:** `wp-17d-wire-recommendation` (off `dev` at `b91909e`)
**Owner:** Patrick Rucker
**Closes:** **OPEN-30** (the recommendation path was wired into nothing), **OPEN-28** (two interfaces named `Catalog`)
**Requirements:** FR-REC-02, FR-REC-03, **FR-REC-04**, FR-REC-13, FR-WER-07, FR-RSC-03, FR-RSC-06, FR-LIB-02, FR-LIB-08
**Status:** ✅ **GREEN — and the §6 sequence was RUN AGAINST THE RUNNING SERVER.** Not committed (§8.5: the commit is the owner's assertion that they read the diff).

---

## 1. What was actually wrong

`RecommendationScheduler` — the class holding FR-REC-02, FR-REC-03 and **FR-REC-04, the requirement `CLAUDE.md` §5 calls load-bearing** — was constructed **nowhere outside the acceptance test harness**, on every branch. `GET /wellness` (packet 14a) could *show* you a recommendation; nothing anywhere could *act* on one.

So the System's central claim — *recommendations are not advisory; they become real scheduled tasks defended by the same rescheduling logic as everything else* — was demonstrable only inside `server/test/acceptance/`. SRS §6 says **"observe"**, and observation requires a running server.

**That is now closed.** A person at a keyboard can inject a bad night's sleep into the running System and watch the calendar change, with no test runner involved. §4 below is the transcript.

---

## 2. What was built

| File | Change |
|---|---|
| `server/src/recommendation/WorkoutSource.ts` | **New.** The renamed narrow port + the adapter over packet 11's real catalog. |
| `server/src/recommendation/RecommendationScheduler.ts` | Port moved out; **`export type Catalog = WorkoutSource` kept as a required alias.** No method body touched. |
| `server/src/index.ts` | **Additive**: the per-user `RecommendationScheduler` factory. 14a's existing wiring untouched. |
| `server/src/api/app.ts` | One route — `POST /recommendations/apply-workout` — plus the dependency. |
| `server/test/support/testApp.ts` | Mirrors the production factory (see §6 — a file the packet did not list). |
| `server/test/api/recommendations.test.ts` | **New.** 5 transport tests. |

### 2.1 OPEN-28 — the two `Catalog` interfaces

The packet's corrected instruction was followed exactly, and the original one was confirmed impossible.

`server/test/acceptance/support/harness.ts` is **frozen at `8809158`** and does `import type { Catalog } from '.../RecommendationScheduler'`, implementing the two-argument `findWorkouts(tier, count)`. **Widening that interface breaks a frozen suite at compile time.** So:

- the narrow port moved to `WorkoutSource.ts` and was **renamed `WorkoutSource`** — which is what it always was, the *workout half* of the library seam, not the whole `Catalog`;
- **`export type Catalog = WorkoutSource` remains exported from `RecommendationScheduler.ts`.** ⛔ This alias is load-bearing, not vestigial — deleting it reddens a frozen suite;
- packet 11's real `Catalog` is **adapted** by `workoutSourceFrom`, passing FR-LIB-05's default (empty) preference set.

**Proof the alias did its job:** `npm run typecheck` is clean and the frozen acceptance and replacement suites both compile and pass unchanged.

### 2.2 Where the per-user engine is built, and why

**In a factory in `index.ts`, over the loaded user — never a process-level singleton.**

`CaloriesToTargetRule` is constructed with `user.baselineCalories`. That is **per-user state** (FR-REC-09; CON-05/§4.9 — *the System asks, it never estimates*). A scheduler built once at boot would bake the first user's baseline into every other user's recommendations — a bug that would never fail a test, because every test uses one user.

This mirrors the pattern `GET /wellness` already established on 14a. Everything else injected is the **same instance** the rest of the app uses: the same `findCandidateSlots` (FR-RSC-03), the same `RescheduleService` (so a placed recommendation is defended identically to a user task), the same repository, metric store and clock.

The route knows only that it can ask for a scheduler; **which rules exist stays in the composition root.**

---

## 3. Escalations and honest gaps

### 3.1 ⚠️ FR-LIB-08's relaxation report does not reach the apply-workout caller

Packet 11's catalog returns `CatalogResult<T>` carrying `relaxed` (which soft constraints it loosened) and `satisfiable`. **The narrow `WorkoutSource` port returns a bare array and has nowhere to put either.** Widening it would break the frozen harness — the exact constraint §2.1 describes.

**What the adapter does instead:** logs both to the console (`[catalog] relaxed … (FR-LIB-08)`), so the fact is at least visible to an operator rather than silently discarded at a type boundary.

**Precisely what is and is not surfaced** — this was over-stated in the packet's first draft and is worth stating narrowly:

| Surface | `relaxed` | `satisfiable` |
|---|---|---|
| `GET /wellness` — meals | ✅ surfaced | ✅ surfaced |
| `GET /wellness` — workouts | ❌ **missing** | ✅ surfaced |
| `POST /recommendations/apply-workout` | ❌ **missing** (logged only) | ❌ **missing** (logged only) |

⛔ The `/wellness` gap is **Ryan's file and was not touched** — recorded, not fixed. Closing the apply-workout gap properly means widening a frozen port, which is a post-freeze decision, not this packet's.

### 3.2 Error mapping — a deliberate narrow catch

`applyWorkoutRecommendation` throws for four *"nothing to apply"* preconditions (no above-tier workout, no catalog candidate, engine could not place, no recommendation for the day). Those are **409s, not faults** — the request was well-formed and the System simply has nothing to replace.

Every one of those messages is prefixed `applyWorkoutRecommendation:`, a stable property of that frozen-tested class. **The route maps only that prefix to 409 and rethrows everything else.** A blanket `catch` would turn a genuine defect into a tidy 409 and hide it.

### 3.3 No escalation fired for a missing baseline

The packet's escalation clause anticipated a user with no stored `baselineCalories`. **It did not fire** — 14a captures and validates it at registration, exactly as the rescope predicted.

---

## 4. ⛔ The §6 transcript — run against the running server

**This is the packet's actual Definition of Done.** A passing suite is not this.

**Setup:** local `mongod` (7.0.24, from the `mongodb-memory-server` binary cache) on `127.0.0.1:27017`; `npm run dev --workspace=server` on `:3001`; real date **2026-07-28**, server clock at **10:26** (minute 626), so the 17:00 run's window is genuinely ahead of `now` (FR-REC-07).

### Step 1 — register, baseline 2,000 (FR-REC-09)
```
POST /auth/register  ->  201
{ "userId": "6a68ca3ffe90ac97dd4c54ac", "wakeMinute": 360, "sleepMinute": 1380,
  "baselineCalories": 2000, "dietaryPreferences": [] }
```

### Step 2 — a HIGH-intensity run at 17:00–18:00
```
POST /tasks  ->  201
task:      "Evening run"  WORKOUT  HIGH  FLEXIBLE  source=USER
placement: 1020-1080  PLANNED  '"Evening run" placed at 5:00 PM.'
```

### Step 3 — inject the metrics (FR-WER-07)
```
POST /wearable/metrics  ->  204
{ "date":"2026-07-28", "metrics": {
    "sleepScore":      { "unit":"score", "origin":"INJECTED", "isAvailable":true, "value":40  },
    "activeCalories":  { "unit":"kcal",  "origin":"INJECTED", "isAvailable":true, "value":850 } } }
```
*(Units match what `GarminExportAdapter` really emits, so the injected shape is the shape the real export produces.)*

### Step 4 — `GET /wellness`: **the calorie half of §6**
```
workout.tier            : LOW
workout.reason          : {"metricName":"sleepScore","metricValue":40,"usedFallback":false}
workout.satisfiable     : true
options offered         : 3

meals.baseline          : 2000
meals.activity          : 850
meals.target            : 2850          <-- §6: "the day's calorie target rise from 2,000 to 2,850" ✅
madeWithoutCurrentData  : false
```
**FR-REC-13 ✅** — the reason names the metric (`sleepScore`) and its value (`40`), and says it used no fallback.
**FR-REC-03 ✅** — three options at the warranted tier.

### Step 5 — `POST /recommendations/apply-workout`: **the workout half**
```
HTTP 200
task.title         : 3/4 Sit-Up
task.source        : SYSTEM        <-- created as a task, System-authored (FR-REC-04)
task.type          : WORKOUT
task.intensityTier : LOW           <-- at the warranted tier, not above it
task.flexibility   : FLEXIBLE
placement          : 1020-1080  PLANNED
placementReason    : '"3/4 Sit-Up" placed at 5:00 PM — a lower-intensity recovery
                      session the System recommended for today.'
options            : ['3/4 Sit-Up', '90/90 Hamstring', 'Adductor']
```
The recovery session lands **exactly where the run was** — Appendix A's exact-fit case, and the engine's own answer, not this layer's.

### Step 6 — `GET /schedule`, twice (FR-RSC-06 / OPEN-27 durability)
```
retrieval #1                                   retrieval #2
 1020-1080  SUPERSEDED  Evening run  USER HIGH   1020-1080  SUPERSEDED  Evening run  USER HIGH
 1020-1080  PLANNED     3/4 Sit-Up   SYS  LOW    1020-1080  PLANNED     3/4 Sit-Up   SYS  LOW
```
**§6 ✅** — *"observe the scheduled high-intensity run replaced by a recovery session."* The run is `SUPERSEDED` (gone from the calendar, still distinguishable from one that never happened — DR-06); the recovery session is `PLANNED`. **Identical across two sweeps**, so OPEN-27's fix holds through HTTP, not just in the unit test.

### Step 7 — **FR-REC-04's actual claim**: defended identically to a user task
A `FIXED` "Team meeting" was dropped on the recovery session's slot:
```
POST /tasks  ->  201
displaced: [{ kind: "RESCHEDULED", trigger: "DISPLACED",
              placement: { start: 1050, end: 1110, status: "PLANNED",
                placementReason: '"3/4 Sit-Up" moved to 5:30 PM — your 5:00 PM
                                  slot was taken by Team meeting.' } }]

resulting schedule:
 1020-1050  PLANNED     Team meeting  USER
 1020-1080  SUPERSEDED  Evening run   USER  HIGH
 1050-1110  PLANNED     3/4 Sit-Up    SYSTEM LOW
```
**This is the whole thesis in four lines.** A System-authored recommendation was displaced by a user's fixed commitment and **re-placed by the same engine, through the same `RescheduleService`, with the same `DISPLACED` trigger and the same explanation a user task would get.** Nothing special-cased it. That "identically to a user task" clause is the *absence* of code, and this is what its absence looks like from outside.

*(The demo account was deleted from the dev database afterwards — `DELETE /user/me` → 204.)*

---

## 5. Verification checklist

| Definition of Done | Result |
|---|---|
| **§6 run against the running server, transcript in the report** | ✅ **§4 above** |
| `wp-14a` confirmed merged to `dev` before starting | ✅ its commits are in `dev`; `index.ts` already wired `MetricStore` + both catalogs |
| Replacement survives a second `GET /schedule` | ✅ §4 step 6, and a transport test |
| `npm run verify` passes | ✅ **483 tests, 38 suites** (478 + 5 new) |
| All freeze entries intact | ✅ **all 8** unchanged, including `8809158` and `47bb301` |
| Engine still 100% | ✅ 100% stmts/branch/funcs/lines |
| `guard:single-placement` green | ✅ no second placement function (FR-RSC-03) |
| `guard:offline-recommendation` green | ✅ FR-LIB-02 — no network in the recommendation path |
| `guard:metric-extensibility` green | ✅ FR-REC-11 / FR-WER-04 |
| `npm run lint` / `npm run typecheck` | ✅ zero errors |
| Frozen acceptance + replacement suites compile and pass | ✅ **proof the `Catalog` alias works** |
| Contract untouched | ✅ `shared/src/contract.ts` unchanged |
| Not committed | ✅ §8.5 — the owner's call |

---

## 6. Two things the next reader should know

1. **`server/test/support/testApp.ts` was edited, and the packet did not list it.** Adding a required field to `AppDependencies` forces it — that file is one of only two `buildApp` call sites. It is **not frozen** (the eight frozen paths do not include `server/test/support/`), so this is legitimate, but it is an edit outside the packet's stated file list and is flagged rather than buried. The alternative — making the dependency optional — would have let the app boot with the FR-REC-04 path silently absent, which is the failure this packet exists to end.

2. **The packet's rationale for the factory is now partly moot, and the factory is still right.** It argued for a factory in `index.ts` "so `app.ts` does not acquire knowledge of which rules exist" — but `app.ts` *already* has that knowledge, because 14a's `GET /wellness` constructs both rules inline. The factory was still the right call for the reason in §2.2 (per-user baseline), and it means the apply path has exactly one composition site instead of a second inline copy. **Worth knowing before someone "tidies up" by inlining it.**

---

## 7. What this does **not** finish

- **FR-WER-08/09/10** — the *real Garmin export* path. FR-WER-07's injection is **synthetic by design**, and OPEN-33's ingestion script (Ryan's, now merged) is what covers the real-data half. This packet does not touch it.
- **A UI trigger for applying a recommendation.** Out of scope and not added — `web/` is another owner's module (§7.2). The demonstration is driven by `curl` with the dashboard open beside it, exactly as the packet specifies.
- **FR-LIB-08's report through the apply path** — §3.1.
