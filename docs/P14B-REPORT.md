# Packet 14b — Frontend Wellness View — BUILD report

**Owner:** Ryan Woosley · **Branch:** `wp-14a-wellness-backend` (same branch as 14a) · **Date:** 27 Jul 2026
**Phase:** BUILD (FR-WEL is (D)). **Status:** Built, verified by typecheck/lint/build/verify. **NOT committed** (awaiting Ryan's read).

## What was built

The wellness view that renders packet 14a's `GET /wellness` payload — no backend change.

| File | Change |
|---|---|
| `web/src/api/client.ts` | `WellnessResult` (+ `WellnessWorkout`/`WellnessMeals`/`WellnessMealSlot`/`WellnessReason`) and `getWellness(date)` — a frontend-only shape, not a contract type |
| `web/src/components/WellnessView.tsx` | new — four sections per §3.7.2 |
| `web/src/App.tsx` | a `view` state and a Schedule/Wellness nav (UI-03: one action from the schedule) |
| `web/src/styles.css` | wellness + nav-tab styles, reusing the existing design tokens, theme-aware |

**Sections (FR-WEL):**
- **Today's metrics (FR-WEL-01/05):** iterates `metrics.metrics` **by key** (no hard-coded metric list — a third metric appears with no code change); an unavailable metric reads "no data", never `0`; when the set's date isn't today it says "no data for today — showing <date>".
- **Last 7 days (FR-WEL-04):** the sleep-score and active-calorie series from `history`; a missing day is an em-dash, not a zero.
- **Today's workout (FR-WEL-02):** tier, recommended, two alternatives, and a reason sentence built in the view from the machine-readable reason.
- **Today's meal plan (FR-WEL-03):** the target with **baseline + activity shown separately** ("2,850 kcal today — baseline 2,000 + 850 active calories"); the plan meals with calories and dietary flags; a fallback target says it was made without current data.

## The load-bearing calls
1. **Metrics rendered by key, not a fixed pair** — FR-WER-04 extensibility preserved at the view.
2. **Unavailable ≠ 0, stale ≠ current** — the `Metric` union's availability + the set/point date carried through; gaps em-dashed.
3. **Baseline / activity / target rendered as three facts** — FR-WEL-03.
4. **Display only** — no "accept this workout" action; the view never mutates the schedule.

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build --workspace=web` — all clean.
- `npm run verify` — **460 green**, engine 100%, all frozen suites unchanged. *(One run showed the intermittent OPEN-25 `mongodb-memory-server` port flake at `users.create` — a server test, unrelated to this frontend-only packet; `jest.retryTimes(2)` retried it and a clean re-run was deterministically 460 green.)*
- ⚠️ **NOT observed in a browser.** No browser-automation tool was available this session, so the *rendered* output was not visually confirmed — only the data path (types, the built bundle, and 14a's live `GET /wellness` transcript) is verified. This is the same honest limitation `docs/P13-REPORT.md` recorded; a manual browser pass (register → inject a metric → open the Wellness tab) is the remaining (D) step before this is called demonstrated.

## Not done (next)
- **15a/15b** — analytics computation (FR-ANL, **(T)** → RED/GREEN, separate sessions per §4.6).
- **15c** — the analytics view.
