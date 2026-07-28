# OPEN-33 — Garmin Export Ingestion Path — BUILD report

**Owner:** Ryan Woosley · **Branch:** `wp-open33-garmin-ingest` (off `dev`) · **Date:** 28 Jul 2026
**Phase:** BUILD (wiring/glue — FR-WER-08/10 are (D); FR-WER-09's idempotency is already owned+tested by `MetricStore.ingest`). **Status:** Built, verified live against the real server with a *synthetic* fixture; the real-export (D) run is Ryan's. **NOT committed** (awaiting Ryan's read).

## What this closes

The gap OPEN-33 named: `GarminExportAdapter` (packet 08, frozen `1199d80`) parses the export, and `POST /wearable/metrics` (packet 14a) upserts each set — **but nothing read the export file and connected them.** Three Essential requirements (FR-WER-08 ingest, FR-WER-09 idempotent, FR-WER-10 real-metric-drives-a-recommendation — the midpoint gate) had no live path. This is that ~one missing piece.

## What was built

| File | Change |
|---|---|
| `server/src/tools/ingestGarminExport.ts` | new — the standalone CLI: read the two export files → `GarminExport` → `GarminExportAdapter.toMetricSets()` → POST each `DailyMetricSet` to `/wearable/metrics` |
| `server/package.json` | `ingest:garmin` script (`tsx src/tools/ingestGarminExport.ts`) |

**It composes; it re-implements nothing.** The adapter owns all interpretation (OPEN-20 availability, OPEN-26 unscored nights, CON-05's `bmr` exclusion); the store owns idempotency; this script only reads files and POSTs.

### Three placement/design calls
1. **`server/src/tools/`, not `server/src/wearable/`.** The script calls `fetch()` to POST to the API. `server/src/wearable/` is inside the FR-LIB-02 offline-recommendation guard's scope (an ambient `fetch` there is a violation — that guard's whole point). `tools/` is outside the guarded `{recommendation,catalog,wearable}` set, so the network call is legitimate where it lives. It imports the adapter *class* from `../wearable/` (an import, not a network call).
2. **POST through the public API — never straight to Mongo (§2.3 / OPEN-33).** FR-WER-08 asks that real records be *loaded through the System*; writing to Mongo would route the data around it and need a second composition root + DB creds in a script.
3. **Local path passed as an argument (§8.4).** The real export is a teammate's actual health data and must never enter the repo. `--export <dir>` (or `--activity`/`--sleep` overrides); a `--dry-run` prints the adapted sets without POSTing, so the data can be eyeballed before it touches the server.

### Metric names are DERIVED, never hard-coded
The run summary counts availability per metric by iterating `Object.keys(s.metrics)` — **not** by naming `sleepScore`/`activeCalories`. The first draft named them; the **16b metric-extensibility guard caught it** (FR-WER-04/FR-REC-11: a third metric must need no edit here) and it was fixed by derivation, not by exempting the file. Recorded because it's the guard working as designed on new code.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run verify` — all green (**478 tests**, engine 100%, all 8 frozen suites intact, **all four (I) guards pass** including 16b's metric-extensibility, which initially and correctly failed the un-fixed draft).
- ✅ **Exercised LIVE against the real server** (`npm run dev` on `:3001`, real Mongo) using a **synthetic, export-shaped fixture** in scratchpad — *never* real health data (§8.4). All three view branches of the path confirmed:
  - **`--dry-run`** parsed 3 days and adapted correctly, including the subtle adapter rules flowing through: `2024-03-12` had `activeCalories` **unavailable** (no `totalSteps` — OPEN-20; the `activeKilocalories:0` was *not* fabricated into a metric) and `sleepScore` **unavailable** (unscored night, no `overallScore` key — OPEN-26); `bmrKilocalories` was ignored throughout (CON-05).
  - **Real ingest** POSTed 3/3 → `204`s. Then `GET /wellness?date=2024-03-10` returned `workout.tier: LOW` with `reason {metricName: sleepScore, metricValue: 42, usedFallback: false}` and meals `2000 + 850 = 2850` — **a real (ingested) metric drove the recommendation, not a default** (FR-WER-10's exact claim). `2024-03-11` (sleep 88) returned `HIGH` and `2000 + 300 = 2300`.
  - **Idempotency (FR-WER-09):** re-running the script returned `3/3` again and `/wellness` was byte-identical (sleepScore 42, tier LOW, target 2850) — updated in place, not duplicated.
  - **`--from`/`--to`** filtered correctly (the 2023–24 sleep-overlap use case).
  - Throwaway user deleted (`DELETE /user/me` → `204`), server stopped, synthetic fixture removed — nothing left in the real DB.
- ⚠️ **Not yet run against the REAL Garmin export.** That is the actual FR-WER-10 (D) demonstration and it is Ryan's — his data, his machine (§8.4). The script's parsing assumes each export file is a JSON array (or a single-property wrapper) of records carrying `calendarDate`, with `sleepScores.overallScore` a direct integer (the shape OPEN-01/02 confirmed against the real files). If a field path differs, `--dry-run` reveals it (metrics showing unavailable that shouldn't), and `--activity`/`--sleep` allow pointing at the exact files.

## The real-export run (Ryan, for the FR-WER-10 (D) gate)
```
# terminal 1
npm run dev
# terminal 2 — dry-run first to eyeball the metrics, then ingest
npm run ingest:garmin -- --export <unzipped-export> --dry-run
npm run ingest:garmin -- --export <unzipped-export> --email you@x --password pw
# then observe a real metric driving a recommendation:
curl "localhost:3001/wellness?date=<a 2023-24 scored day>" -H "Authorization: Bearer <token>"
```
Query a **2023–24** date for the sleep half — no 2026 sleep score exists in the export (a recorded decision; FR-WER-10 requires *real*, not *recent*).
