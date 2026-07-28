# CRITICAL REQUIREMENTS — 15c Frontend Analytics View

### MANDATORY DIRECTIVE ###

You are an expert React + TypeScript engineer. **CRITICAL**: Implement **only** what is specified below, and **only** in the files listed. This packet is one reviewable diff with one human owner. It renders the JSON packet 15b already serves — it adds **no** backend and touches **no** computation. The streak and completion-rate math is `analyzeHabit`, a frozen, property-tested pure function (packet 15a/15b); this view only displays what `GET /analytics` returns.

| | |
|---|---|
| **Phase** | BUILD — no frozen suite. FR-ANL-04 / UI-04 are (D), verified by demonstration in a browser. |
| **Human owner** | Ryan Woosley |
| **Depends on** | Packet 15b (`GET /analytics`, on this same branch — see the 15b GREEN commit `6df4f23` and `docs/P15A-RED-REPORT.md`) |
| **Spec** | `docs/SRS-v2.md` §3.7.3 (wireframe UI-04), §3.8.10 (FR-ANL), UC-11 |

---

## **MANDATORY**: Requirements In Scope

> Quoted **VERBATIM** from `docs/SRS-v2.md`.

- **FR-ANL-04.** *(Essential, D)* Display each habit's current streak and completion rate.
- **UI-04.** *(Essential, D)* An **analytics view** showing completion rate and streak per habit. *(Wireframe: §3.7.3)*

**Rendered, not recomputed — these are (T) requirements 15b already satisfies; this view only presents their output faithfully:**

- **FR-ANL-01.** Per habit, the count of consecutive completed days ending at the most recent day — its **streak**. *(Arrives as `streak`.)*
- **FR-ANL-02.** Per habit, its **completion rate**: occurrences completed ÷ occurrences scheduled, the denominator counting only occurrences whose window has **elapsed**. *(Arrives as `completed`, `scheduled`, `completionRate`. Render the fraction the server sent — never divide in the view.)*
- **FR-ANL-03.** A task automatically rescheduled and then completed counts as **completed, not missed**. *(This is the sentence the §3.7.3 footnote states to the user — build it into the view as static explanatory text.)*

### **CRITICAL**: Explicitly Out Of Scope

- ⛔ **FR-ANL-05 — the completion-trend chart** shown in the §3.7.3 wireframe. It is **Conditional**, and the 26 Jul scope freeze (`CLAUDE.md` §6, `docs/TEAM-MEETING.md` 26 Jul) put every remaining Conditional **definitively out**. **Do not build the "COMPLETION TREND" panel.** Build the habit table and the explainer note only.
- ⛔ **A user-driven period selector** ("Last 30 days ▾" in the wireframe). `GET /analytics` computes over a **fixed trailing-365-day window** it chooses server-side (`from`/`to`/`asOf`); a selectable period would require a 15b backend change, and this is a display-only frontend packet. **State the window the server returned** (e.g. "Last 365 days, through {to}") rather than offering a dropdown.
- ⛔ **Any backend change.** `GET /analytics` already returns everything. If you find yourself editing `server/`, **stop** — the number is `analyzeHabit`'s, and it is frozen.
- ⛔ **Recomputing streak or rate in the view.** Do not derive `completionRate` from `completed`/`scheduled` yourself — render the server's `completionRate`. The bar width is a *presentation* of `completionRate`, the fraction text is `completed`/`scheduled`; both come from the payload.

---

## **MANDATORY**: The Contract & the 15b payload

There are **no domain types** to import for this view — an analytics row is a frontend read-model, not a contract type. Declare the `GET /analytics` response shape in `web/src/api/client.ts` (like `WellnessResult`/`ScheduleResult`) and add a `getAnalytics()` function. Its shape (from `server/src/api/app.ts`, the `/analytics` route, and `HabitAnalytics`):

```
{ from: string, to: string, asOf: string,          // IsoDate "YYYY-MM-DD"
  habits: Array<{
    taskId: string,
    title: string,
    streak: number,          // FR-ANL-01
    completed: number,       // FR-ANL-02 numerator (distinct COMPLETED dates)
    scheduled: number,       // FR-ANL-02 denominator (distinct ELAPSED-and-resolved dates)
    completionRate: number   // completed/scheduled, exactly 0 when scheduled === 0 (never NaN)
  }> }
```

`getAnalytics = () => request('/analytics')` — **no query parameter**; the server chooses the window.

---

## **MANDATORY**: What To Build

### `web/src/api/client.ts`
- An `AnalyticsResult` interface (and an exported `HabitStat` row interface) for the shape above, and `getAnalytics = () => request('/analytics')`.

### `web/src/components/AnalyticsView.tsx`
A new component `AnalyticsView` taking no props (it fetches its own window), following `WellnessView.tsx`'s fetch/error/loading pattern (`useState`/`useEffect`/`toErrorMessage`, a `Loading…` and an error branch). It renders, matching §3.7.3:

1. **HABIT CONSISTENCY** — a header naming the window the server returned (e.g. `Last 365 days, through {to}`), **not** a period dropdown.
2. **The habit table** — one row per `habits[]` entry: **title**, **streak** ("{streak} days" — and "day" singular when `streak === 1`), a **completion-rate bar** whose fill width is `completionRate` (0–1), the **percentage** (`Math.round(completionRate * 100)`%), and the **fraction** `({completed}/{scheduled})`. The bar is decorative reinforcement of the number it sits beside — the percentage and fraction are the accessible carriers of the value, never the bar alone (same discipline as the schedule's color legend).
3. **Empty state** — when `habits.length === 0` (a user with no HABIT tasks, or none with any placements in the window), say so plainly ("No recurring habits yet — create a habit to start tracking your streak."). Do **not** render an empty table or a `0/0` row.
4. **The FR-ANL-03 explainer note** — the static ⓘ line from the wireframe, verbatim in spirit: *"Tasks that were automatically rescheduled and then completed count as completed. Recovering from a missed task does not break a streak."* This is a requirement rendered as UI text, not decoration — keep it.

**Edge to get right:** a habit with `scheduled === 0` (a brand-new habit whose first window has not elapsed) has `completionRate === 0` from the server. Render its rate as **"—" or "no elapsed occurrences yet"**, *not* "0%" — 0% asserts the user failed every occurrence, which is false when none have come due (this is the display-side mirror of FR-ANL-02's elapsed-denominator rule). Its streak is legitimately `0`.

### `web/src/App.tsx`
- Extend the `view` state union to `'schedule' | 'wellness' | 'analytics'`, add a third **Analytics** nav button beside Schedule and Wellness (UI-04: reachable in one action from the schedule), and render `<AnalyticsView />` when selected. `AnalyticsView` needs no `date` prop — it reports a server-chosen window, not the day being viewed.

### `web/src/styles.css`
- Styles for the analytics table and the completion-rate bar. **Reuse existing tokens** and the `.icon-button`/panel patterns; theme-aware (light/dark) like the rest. The bar's fill should use an existing accent token, not a new hard-coded color.

---

## **CRITICAL**: Calls to get right

1. **Render the server's number; never recompute (FR-ANL-02).** `completionRate`, `completed`, `scheduled` all come from `analyzeHabit`. The view divides nothing. The whole point of the RED/GREEN split (§4.6) is that the frozen function owns the math — a second division in the view is a second, un-pinned implementation of the rate.
2. **`scheduled === 0` is "—", not "0%".** A no-elapsed-occurrences habit has not failed; presenting its rate as 0% contradicts FR-ANL-02's own elapsed-denominator rule.
3. **The bar is never the sole carrier of the value.** Percentage + fraction are always shown as text beside it (accessibility + the project's standing rule that color/length never solely carries meaning).
4. **No trend chart, no period selector.** Both are out (§ above). The view shows a table and a note over the window the server chose.
5. **Display only.** No mutation; opening this tab must not place, complete, or reschedule anything — `GET /analytics` is read-only by construction, and the view issues only that one GET.

---

## **MANDATORY**: Files You May NOT Touch
- ⛔ `shared/src/contract.ts`, `server/**`, `engine/**`, any frozen suite (including `server/test/analytics/**`), `scripts/**`.

## **MANDATORY**: Done Criteria (D)
1. `npm run verify` green (**unchanged count** — this packet adds no server test), `typecheck`/`lint` clean across `web`.
2. **Exercised in a browser** against the running dev server: register, create at least two recurring HABIT tasks, complete/skip some occurrences across a few days (and, ideally, let one be auto-rescheduled-then-completed to show FR-ANL-03), open the **Analytics** tab in one click, and confirm the table renders each habit with a streak, a rate bar, a percentage, and the `completed/scheduled` fraction — plus the empty state for a user with no habits, and the "—" rate for a habit with no elapsed occurrences. **Record what was and was not observed** — be honest if no browser-automation tool is available, exactly as `docs/P13-REPORT.md` and `docs/P14B-REPORT.md` did (an honest `curl`-only confirmation of the payload plus a stated gap is acceptable; a claimed browser render that did not happen is not).
3. Report at `docs/P15C-REPORT.md`, noting explicitly that FR-ANL-05 (trend chart) and the period selector were deliberately omitted, with the §6 reason.

*(House-style techniques — Sandwich Method, Attention Anchoring, Visual Emphasis, Clear Delimiters, Selective Context — as in packets 13 / 14a / 14b.)*
