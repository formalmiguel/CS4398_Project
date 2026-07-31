# CRITICAL REQUIREMENTS — 14b Frontend Wellness View

### MANDATORY DIRECTIVE ###

You are an expert React + TypeScript engineer. **CRITICAL**: Implement **only** what is specified below, and **only** in the files listed. This packet is one reviewable diff with one human owner. It renders the JSON packet 14a already serves — it adds **no** backend.

| | |
|---|---|
| **Phase** | BUILD — no frozen suite. FR-WEL is (D), verified by demonstration in a browser. |
| **Human owner** | Ryan Woosley |
| **Depends on** | Packet 14a (`GET /wellness`, on this same branch — see `docs/P14A-REPORT.md`) |
| **Spec** | `docs/SRS-v2.md` §3.7.2 (wireframe), §3.8.9 (FR-WEL), UI-03 |

---

## **MANDATORY**: Requirements In Scope

> Quoted **VERBATIM** from `docs/SRS-v2.md`.

- **FR-WEL-01.** *(Essential, D)* Display **every metric in the Daily Metric Set** for the current date, each with value, unit, and measurement date. The view shall render whatever the set contains **rather than a hard-coded list**.
- **FR-WEL-02.** *(Essential, D)* Display today's recommended workout, its intensity tier, and the two alternatives from FR-REC-03.
- **FR-WEL-03.** *(Essential, D)* Display the current meal plan **and the daily calorie target it was built against**, showing the baseline and the activity contribution **separately**.
- **FR-WEL-04.** *(Essential, D)* Display sleep score and active calories over at least the previous seven days.
- **FR-WEL-05.** *(Essential, D)* Where a metric is not from the current day, or is unavailable, **say so and state the date of the value shown.** Never present an old measurement as current, nor an absent one as zero.
- **UI-03.** *(Essential, D)* A **wellness view** showing metrics, today's recommended workout, and the meal plan, reachable from the main navigation in **one action** from the schedule.

### **CRITICAL**: Explicitly Out Of Scope

- **The analytics view (FR-ANL, UI-04)** — packets 15a/15b/15c.
- **Any backend change** — `GET /wellness` already returns everything (14a). If you find yourself editing `server/`, stop.
- **Placing/booking a workout from this view** — it is display-only. There is no "accept" button here; a recommendation becomes a task through FR-REC-04's path, not a wellness click.

---

## **MANDATORY**: The Contract & the 14a payload

Import domain types (`Workout`, `Meal`, `IntensityTier`, `DailyMetricSet`, `Metric`, `DietaryFlag`) from `@capstone/shared`. **Do not redefine them.** The `GET /wellness` response is a frontend-only shape (like `ScheduleResult`) — declare it in `web/src/api/client.ts` and add a `getWellness(date)` function. Its shape (from `docs/P14A-REPORT.md` / `server/src/api/app.ts`):

```
{ date, metrics: DailyMetricSet,
  history: DailyMetricSet[],                                  // ≥7 days, ascending
  workout: { tier, recommended: Workout|null, alternatives: Workout[], reason: {metricName,metricValue,usedFallback}|null, satisfiable },
  meals:   { baseline, activity, target, planTotalCalories, madeWithoutCurrentData,
             plan: [{ mealType, slotTarget, meal: Meal|null, relaxed, satisfiable }] } }
```

---

## **MANDATORY**: What To Build

### `web/src/api/client.ts`
- A `WellnessResult` interface for the shape above and `getWellness = (date) => request('/wellness?date=...')`.

### `web/src/components/WellnessView.tsx`
Four sections, matching §3.7.2:
1. **TODAY'S METRICS** — iterate `metrics.metrics` **by its keys** (FR-WEL-01: never a hard-coded `sleepScore`/`activeCalories` pair). For each: name, value + unit, and — per **FR-WEL-05** — where `metrics.date !== today` or a metric `isAvailable === false`, say so and show the date; never render an unavailable metric as `0`.
2. **LAST 7 DAYS** — from `history`, the sleep-score and active-calorie series (a simple bar/number row is fine; this is the one place naming the two series is correct — FR-WEL-04 names them). A day with no value is a gap, not a zero.
3. **TODAY'S WORKOUT** — `workout.tier`, `recommended.name`, the two `alternatives`, and the reason line from `workout.reason` (build the sentence in the view from the machine-readable reason; e.g. *"Recovery session — your sleep score was 42."*). If `recommended === null` / `satisfiable === false`, say no workout could be offered.
4. **TODAY'S MEAL PLAN** — the `target` with **baseline and activity shown separately** (FR-WEL-03: e.g. *"2,850 kcal today — baseline 2,000 + 850 active"*). Where `madeWithoutCurrentData`, say the target was made without current data (FR-WEL-05). List the `plan` meals (type, name, calories, dietary flags) and `planTotalCalories`.

### `web/src/App.tsx`
- Add a `view` state (`'schedule' | 'wellness'`) and turn the placeholder `<nav>` into two buttons — **Schedule** and **Wellness** — switching the rendered view (UI-03: one action from the schedule). Pass the selected `date`.

### `web/src/styles.css`
- Styles for the wellness sections. Reuse existing tokens/`.icon-button` etc. Theme-aware (light/dark) like the rest.

---

## **CRITICAL**: Calls to get right

1. **Render metrics by key, never a fixed pair (FR-WEL-01).** A third metric added under FR-WER-04 must appear here with no code change.
2. **Unavailable ≠ 0, stale ≠ current (FR-WEL-05).** Use the `Metric` union's availability and the set/point date. Never coerce absence to zero.
3. **Baseline and activity are shown separately (FR-WEL-03)** — render all three of baseline / activity / target, not just the sum.
4. **Display only.** No mutation, no "accept this workout" action.

---

## **MANDATORY**: Files You May NOT Touch
- ⛔ `shared/src/contract.ts`, `server/**`, `engine/**`, any frozen suite, `scripts/**`.

## **MANDATORY**: Done Criteria (D)
1. `npm run verify` green (unchanged count — this packet adds no server test), `typecheck`/`lint` clean across `web`.
2. **Exercised in a browser** against the running dev server: register (with a baseline + a dietary pref), inject a metric set, open the Wellness tab in one click, and confirm all four sections render — metrics with dates, a 7-day series, the workout + 2 alternatives + reason, and the meal plan with baseline/activity separate. Record what was and was not observed (be honest if no browser tool is available — say so, as `docs/P13-REPORT.md` did).
3. Report at `docs/P14B-REPORT.md`.

*(House-style techniques — Sandwich, Anchoring, Visual Emphasis, Delimiters, Selective Context — as in packet 13/14a.)*
