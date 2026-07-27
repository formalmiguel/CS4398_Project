# Packet 14a — Wellness Backend Endpoints (+ UC-01 registration capture) — BUILD report

**Owner:** Ryan Woosley · **Branch:** `wp-14a-wellness-backend` (off `dev`) · **Date:** 27 Jul 2026
**Phase:** BUILD (FR-WEL is (D) — verified by demonstration; no frozen suite added).
**Status:** Done, verified. `npm run verify` **460 green** (453 + 7 new wellness tests), engine 100%, every frozen suite unchanged. **NOT committed / NOT pushed / NOT merged** (awaiting Ryan's read + the Miguel heads-up).

---

## What was built

A read-only wellness surface that composes the already-tested packet-08/10/11 modules, plus the
UC-01 registration capture the schedule dashboard never built.

| Requirement | Where |
|---|---|
| FR-WEL-01 (metric set, render-whatever-it-contains) | `GET /wellness` → `metrics: DailyMetricSet` passed through by key |
| FR-WEL-02 (workout + tier + 2 alternatives) | `RecommendationEngine.recommend` for the tier + reason; `Catalog.findWorkouts(tier, {}, 3)` |
| FR-WEL-03 (meal plan + baseline/activity separately) | per-slot day plan (0.30/0.35/0.35) via `Catalog.findMeals`; `baseline`/`activity`/`target` as three fields |
| FR-WEL-04 (7-day history) | new `MetricStore.getMetricsInRange`, `date-6 … date` |
| FR-WEL-05 (stale/unavailable stated, never zero) | `Metric` union + set date carried through; `madeWithoutCurrentData` flag on the calorie target |
| FR-REC-09 / FR-REC-05 / UC-01 (baseline + dietary prefs at registration) | `UserRecord` fields + `POST /auth/register` (required, validated) + `/auth/login` + `/user/me` + `AuthScreen` form |
| FR-WER-07 / FR-WER-09 (inject metrics, idempotent) | `POST /wearable/metrics` → `MetricStore.ingest` (idempotency untouched) |

**Files (10 src/test + 1 report):** `server/src/db/UserStore.ts`, `server/src/db/MetricStore.ts`,
`server/src/api/app.ts`, `server/src/index.ts`, `web/src/api/client.ts`,
`web/src/components/AuthScreen.tsx`, `web/src/App.tsx`; tests `server/test/api/wellness.test.ts`
(new, 7 tests) + updated call sites in `server/test/{support/testApp,api/app,api/export,db/UserStore,db/TaskRepository}`.

**`AppDependencies` change:** gained `metrics: MetricStore` and `catalog: Catalog`. The two seeded
libraries (`WorkoutCatalog`/`MealCatalog`) each implement half of the §3.6 `Catalog` port, so
`index.ts` (and the test app) compose them into one `Catalog` object.

---

## The load-bearing calls (as the packet framed them)

1. **`GET /wellness` reads, never writes.** It uses `RecommendationEngine.recommend` + `Catalog`,
   NOT `RecommendationScheduler.applyWorkoutRecommendation` (which places a task). Verified live:
   two `GET /wellness` calls returned byte-identical bodies and `GET /schedule` showed 0 placements / 0 tasks after.
2. **Baseline and activity shown separately.** `baseline: 2000, activity: 850, target: 2850` are three
   fields; the view never reverse-engineers them from the sum.
3. **Unavailable ≠ zero.** Injecting an unavailable `activeCalories` yields `target: 2000, activity: 0,
   madeWithoutCurrentData: true` — never a `2850` that looks measured.
4. **The engine is built per request from the user's baseline** (`CaloriesToTargetRule(user.baselineCalories)`),
   never a boot-time constant (§4.9: the System asks).

---

## Live transcript (real `index.ts` over `mongodb-memory-server`, no `.env` on this machine)

```
register {baselineCalories:2000, dietaryPreferences:["VEGETARIAN"]} -> 201 (echoes both back)
POST /wearable/metrics (sleepScore 42, activeCalories 850) -> 204
GET /wellness:
  workout.tier = LOW (42 ≤ 49), recommended "3/4 Sit-Up" + 2 LOW alternatives, reason {sleepScore, 42, usedFallback:false}
  meals: baseline 2000 + activity 850 = target 2850, planTotalCalories 2905 (within ±10%)
    BREAKFAST slot 855  -> "Seed granola & fruit bowl" 795 kcal (VEGETARIAN…)
    LUNCH     slot 997  -> "Burrito bowl with rice & beans" 1055 kcal
    DINNER    slot 997  -> "Tempeh & vegetable rice bowl" 1055 kcal
  history: 3 injected days present (FR-WEL-04)
read-only: two GET /wellness identical; /schedule empty afterwards
unavailable activeCalories: target 2000, activity 0, madeWithoutCurrentData true
```

---

## Decisions / escalations

- **⚠️ Miguel heads-up (cross-owner touch).** This edits `server/src/db/UserStore.ts`,
  `server/src/api/app.ts` (register/login/me), `web/src/components/AuthScreen.tsx`, `web/src/App.tsx`,
  `web/src/api/client.ts` — his packet 12/13 surface. Additive: existing route shapes only *gain*
  fields (`baselineCalories`, `dietaryPreferences`). Flag before merge (per the 27 Jul "Ryan builds
  it, flags Miguel" ownership decision).
- **`UserStore.create`'s new fields are OPTIONAL, not required.** The instinct was to require them
  (type-enforce the load-bearing register → create path), but the **frozen** acceptance harness
  (`server/test/acceptance/support/harness.ts:154`) calls `create` with the old 4-field shape, and a
  frozen test may not be edited (§4.12). So the fields default in the store, and the "user must supply
  a baseline" rule is enforced at the **register route** (400 if absent/absurd — 500–10000 kcal) —
  the boundary where the user actually supplies it. Recorded because it looks like a weaker choice than
  it is.
- **Bug caught by the live curl, invisible to the first unit test.** My initial meal wiring called
  `findMeals(dayTarget, prefs)` with the whole-day 2850 — but the catalog is a *library, not a planner*
  (packet 11): `findMeals` takes a PER-SLOT target, so it returned `items: []` (no single meal ≈ 2850).
  The first test asserted `Array.isArray(items)` — which `[]` passes — so it went green while the plan
  was empty. Fixed by replicating packet 11's ratified day-plan split (0.30/0.35/0.35 across
  breakfast/lunch/dinner, SRS v2.30) in the endpoint, and the test now asserts every slot found a real
  meal and the total lands in ±10%. **This is the FR-WEL-is-(D) lesson in miniature: the demonstration
  caught what the shape check could not.**
- **Workout preferences deferred** (UC-01 lists them; nothing in scope reads them — they only drive
  FR-LIB-08 equipment relaxation, not shown in the wellness view). Recorded, not forgotten.

## Not done (next packets)

- **14b** — the wellness VIEW (`WellnessView.tsx`, sparklines, workout carousel, meal list) against this JSON.
- **15a/15b** — analytics computation (FR-ANL, **(T)**, RED/GREEN).
- **15c** — the analytics view.
