# Packet 11b — GREEN Report (Catalog + Seeded Libraries)

**Branch:** `wp-11-libraries` · **RED freeze:** `4b1fd4e` (134 tests) · **GREEN:** `a40d46d`
**Owner:** Ryan Woosley · **Date:** 27 July 2026 · **Requirements:** FR-LIB-01/03/04/05/06/07/08/10, FR-REC-03, FR-REC-05

---

## Outcome

The frozen packet 11 suite is **green — 134/134 on the first implementation run.** `npm run verify` is **453 tests green end to end** (319 prior + 134), engine still **100%** coverage, all seven frozen suites unchanged. The branch (RED + GREEN together) now meets the §8.5 merge gate.

Every change is confined to `server/src/catalog/`. No test, fixture, `Catalog.ts` interface, contract, or freeze manifest was touched — `git diff --stat 4b1fd4e -- server/test/catalog/` is empty.

## What was built

| File | Role |
|---|---|
| `intensityTier.ts` | `resolveIntensityTier` — decision B, total over category × level |
| `WorkoutCatalog.ts` | `seedWorkouts` (reads the vendored subset from disk) + `findWorkouts` (hard ceiling, soft equipment relaxation) |
| `MealCatalog.ts` | `seedMeals` + `findMeals` (hard dietary, soft meal-type → calorie relaxation, "say so plainly" terminus) |
| `mealLibrary.ts` | Hand-authored meals: a 9×3 all-five-flag calorie backbone + 16 variety dishes |
| `attribution.ts` | `seedAttribution` → `free-exercise-db` / The Unlicense (FR-LIB-10) |
| `data/free-exercise-db.subset.json` | Vendored 36-record real subset (12 per tier) |
| `data/ATTRIBUTION.md` | FR-LIB-10 licence notice |

## Verification (what is actually true)

- **134/134 frozen packet-11 tests green**, first implementation run.
- **`npm run verify`: 453 tests green, 35 suites**, engine 100% coverage — re-run independently at the review gate, not merely reported.
- **`npm run guard:tests-frozen` green** — `P11: server/test/catalog unchanged, frozen at 4b1fd4e` (plus P04/P06/P08/P09/P17a/P17c).
- **`git diff --stat 4b1fd4e -- server/test/catalog/` empty.**
- **No network under `server/src/catalog/`** — only `node:fs`/`node:path`. The dataset was fetched **once by a developer** and committed; the catalog reads it from disk. This is what lets packet 16b's FR-LIB-02 guard pass (the vendored-not-fetched discipline).
- `npm run lint` + `npm run typecheck` clean.

## Two load-bearing design decisions (against the frozen tests)

1. **MODERATE-tier curation.** `WorkoutCatalog.test.ts` proves the equipment-relaxation path by asserting that a MODERATE query under impossible equipment, *if satisfiable*, reports `WORKOUT_PREFERENCE`. Because `equipmentSatisfied` is a subset check, a single bodyweight (empty-equipment) MODERATE workout would satisfy *any* preference vacuously (`[] ⊆ anything`), leaving `relaxed: []` and failing the test. The MODERATE seed is therefore curated to real-equipment exercises only; LOW/HIGH keep bodyweight freely (they are untested for equipment and supply the below-ceiling relaxation targets).
2. **The maximally-flagged calorie backbone.** A dietary query is a subset check, so one meal carrying all five flags satisfies all 32 combinations. Spacing those meals at a ~1.15 calorie ratio across ~450–1400 kcal guarantees every 0.30/0.35/0.35 slot target lands inside some backbone meal's closed ±10% band — so FR-LIB-07's 32-combination × 11-target sweep assembles with zero relaxation. Verified by running the real sweep, not by eye.

## Notes carried forward

- **`RELAXED_TOLERANCE = 0.25` is an unpinned implementation constant.** No frozen test fixes the calorie-tolerance widen factor — the tests pin the *order* and *reporting* of relaxation (decision D) and that an impossible target stays unsatisfiable, which any bounded value satisfies. It is not a documented requirement; if the team later wants a documented widen factor, it lives here.
- **OPEN-28 (catalog ↔ `RecommendationScheduler`)** — deliberately not touched. 17b left a minimal `findWorkouts(tier, count)` port; wiring the real `Catalog` in (replacing that port) is a separate integration item, to raise with the Scheduling Lead since 17b is theirs.
- **OPEN-04 is now fully closed** — its one remaining half was authoring the meal library, which `mealLibrary.ts` is.

## What this does and does not unlock

The workout and meal libraries now **exist**, tested, behind the FR-LIB-01 catalog seam: a recommendation can draw three real at-tier workout options (FR-REC-03) and the meal side can hit any FR-REC-08 target within ±10% for every dietary combination (FR-LIB-07). What remains for the real §6 demonstration is **wiring** (OPEN-28), not content — FR-REC-04's placement path must consume this catalog rather than 17b's stub double.
