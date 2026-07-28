# Packet 15c — Frontend Analytics View — BUILD report

**Owner:** Ryan Woosley · **Branch:** `wp-15-analytics` (same branch as 15a/15b) · **Date:** 28 Jul 2026
**Phase:** BUILD (FR-ANL-04 / UI-04 are (D)). **Status:** Built, verified by typecheck/lint/build/verify. **NOT committed** (awaiting Ryan's read).

## What was built

The analytics view that renders packet 15b's `GET /analytics` payload — **no backend change, no recomputation**. The streak/completion-rate math is `analyzeHabit`, a frozen, property-tested pure function (packets 15a/15b); this view only presents its output.

| File | Change |
|---|---|
| `web/src/api/client.ts` | `AnalyticsResult` (+ `HabitStat`) and `getAnalytics()` — a frontend-only shape (no query param; the window is server-chosen), not a contract type |
| `web/src/components/AnalyticsView.tsx` | new — the habit-consistency table + the FR-ANL-03 explainer note |
| `web/src/App.tsx` | `view` union extended to `'schedule' \| 'wellness' \| 'analytics'`; a third **Analytics** nav tab (UI-04: one action from the schedule); render branch |
| `web/src/styles.css` | analytics table + completion-rate bar styles, reusing the existing `--accent`/panel tokens, theme-aware |

**Sections (FR-ANL-04, UI-04, §3.7.3):**
- **Habit consistency table:** one row per habit — title, streak ("12 days", "1 day" singular), a completion-rate **bar** (fill = `completionRate`), the **percentage**, and the **fraction** `(completed/scheduled)`. The bar is decorative reinforcement; the % and fraction are the accessible carriers of the value (bar is `aria-hidden`).
- **Empty state:** a user with no HABIT tasks gets a plain "No recurring habits yet…" message, not an empty table or a `0/0` row.
- **FR-ANL-03 explainer note:** the §3.7.3 ⓘ line, rendered as UI text — "…rescheduled and then completed count as completed. Recovering from a missed task does not break a streak."

## The load-bearing calls
1. **Render the server's number; never recompute (FR-ANL-02).** The view does no division — `completionRate`, `completed`, `scheduled` all come from the frozen `analyzeHabit`. A second division in the view would be a second, un-pinned implementation of the rate (§4.6's point, at the UI).
2. **`scheduled === 0` renders "—", not "0%".** A habit with no elapsed occurrences yet has not failed; 0% would falsely assert failure, contradicting the elapsed-denominator rule ratified at the 15a gate (v2.31). The bar is empty and the fraction reads "no elapsed occurrences yet".
3. **The bar never solely carries the value.** Percentage + fraction are always shown as text beside it (accessibility + the project's standing color/length rule).
4. **Display only.** One GET, no mutation — opening the tab never places, completes, or reschedules anything.

## Deliberately NOT built (per the packet's scope, recorded in `docs/TEAM-MEETING.md` 28 Jul)
- **FR-ANL-05 — the completion-trend chart** in the §3.7.3 wireframe. It is **Conditional**, and the 26 Jul scope freeze (`CLAUDE.md` §6) put every remaining Conditional definitively out. The view shows the table and the note only.
- **The "Last 30 days ▾" period selector** in the wireframe. `GET /analytics` computes over a **fixed** server-chosen trailing-365-day window; a user-selectable period would require a 15b backend change, out of bounds for a display-only view packet. The view states the window the server returned ("Last 365 days, through {to}") instead of offering a dropdown.

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build --workspace=web` — all clean.
- `npm run verify` — **478 green** (unchanged — this packet adds no server test), engine 100%, all frozen suites (P04/06/08/09/11/15a/17a/17c) verified unchanged by digest.
- ✅ **`GET /analytics` exercised LIVE against the real Mongo** (the real Express server on `:3001`, `server/.env` populated 28 Jul). A `curl` sequence hit **all three branches the view renders**, confirming the payload is exactly the `AnalyticsResult` shape `AnalyticsView` is typed against:
  1. **Empty state** — a fresh user, no habits → `{from:"2025-07-29", to:"2026-07-28", asOf:"2026-07-28", habits:[]}` (the fixed trailing-365-day window, confirming there is no period parameter).
  2. **A real streak + rate** — a DAILY habit "Read 30 minutes" anchored 2026-07-24, with 25/26/27 completed (consecutive, ending at the most recent *elapsed* day) and the 24th missed → `streak:3, completed:3, scheduled:4, completionRate:0.75`. This confirms **FR-ANL-01** (streak over resolved occurrences) and **FR-ANL-02** live: today (the 28th) is `PLANNED` and un-elapsed, so it is correctly **excluded** from `scheduled` (4, not 5), exactly the elapsed-denominator rule ratified at the 15a gate.
  3. **The `scheduled === 0` case** — a second DAILY habit anchored today only → `streak:0, completed:0, scheduled:0, completionRate:0`. This is the row the view must render as **"—" + "no elapsed occurrences yet"**, never "0%".
  - The throwaway account was then removed via `DELETE /user/me` (`204`, then `GET /analytics` returned `404` — user and all its tasks/placements gone), so no test data was left in the real database (the `docs/P13-REPORT.md` precedent). Server stopped.
- ⚠️ **NOT observed rendered in a browser.** No browser-automation tool was available this session, so the *visual* output — the table layout, the bar fill, the theme — was not seen; only the data path (compile-time types + the three live payloads above) is verified. **Same honest limitation as `docs/P13-REPORT.md` / `docs/P14B-REPORT.md`.** The remaining (D) step is a human opening the Analytics tab in a browser to confirm those three payloads render as intended (and, ideally, an auto-rescheduled-then-completed occurrence to show FR-ANL-03 visually — the note text is present regardless).

## Where this leaves the 14/15 chain
This is the last frontend piece of Ryan's queue. With 15c built, the whole stack on `wp-15-analytics` (14a/14b/15a/15b + this view) is ready to be read and merged to `dev` once the manual browser pass is done and the owner is satisfied (§8.5).
