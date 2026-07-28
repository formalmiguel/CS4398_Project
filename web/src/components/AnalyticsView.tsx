import { useCallback, useEffect, useState } from 'react';

import { AnalyticsResult, HabitStat, getAnalytics, toErrorMessage } from '../api/client';

/** FR-ANL-01: "12 days", but "1 day" — the streak is a count of resolved occurrences (OPEN-30). */
const streakLabel = (streak: number): string => `${streak} ${streak === 1 ? 'day' : 'days'}`;

/**
 * FR-ANL-02, display side: a habit with no ELAPSED occurrences yet has `scheduled === 0` and the
 * server sends `completionRate: 0`. Rendering that as "0%" would falsely assert the user failed
 * every occurrence — the mirror of the ratified elapsed-denominator rule (v2.31). Say "—" instead.
 */
const ratePercent = (habit: HabitStat): string =>
  habit.scheduled === 0 ? '—' : `${Math.round(habit.completionRate * 100)}%`;

/**
 * FR-ANL-04, UI-04: the analytics view. Renders the read-only `GET /analytics` payload (packet 15b) —
 * a per-habit streak and completion rate over a server-chosen trailing-year window. It computes no
 * statistics (the frozen pure `analyzeHabit` owns FR-ANL-01/02's math) and mutates nothing: opening
 * this tab issues one GET and never touches the schedule.
 *
 * Deliberately NOT built (docs/TEAM-MEETING.md, 28 Jul): the §3.7.3 wireframe's completion-trend chart
 * (FR-ANL-05 — Conditional, out per the 26 Jul scope freeze) and its period selector (the window is
 * fixed server-side, so a selector would need a 15b backend change).
 */
export const AnalyticsView = () => {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      setData(await getAnalytics());
    } catch (err) {
      setError(toErrorMessage(err, 'Could not load analytics.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return (
      <section className="analytics">
        <p className="error">{error}</p>
      </section>
    );
  }
  if (data === null) return <section className="analytics"><p>Loading…</p></section>;

  return (
    <section className="analytics">
      <div className="analytics__panel">
        <div className="wellness__panel-head">
          <h2>Habit consistency</h2>
          {/* The window is the server's, stated — never a period dropdown (window is fixed in 15b). */}
          <span className="wellness__meta">Last 365 days, through {data.to}</span>
        </div>

        {data.habits.length === 0 ? (
          <p className="wellness__muted">
            No recurring habits yet — create a habit to start tracking your streak.
          </p>
        ) : (
          <table className="analytics__table">
            <thead>
              <tr>
                <th scope="col">Habit</th>
                <th scope="col">Streak</th>
                <th scope="col" className="analytics__rate-head">Completion rate</th>
              </tr>
            </thead>
            <tbody>
              {data.habits.map((habit) => {
                const noneElapsed = habit.scheduled === 0;
                return (
                  <tr key={habit.taskId}>
                    <td className="analytics__title">{habit.title}</td>
                    <td className="analytics__streak">{streakLabel(habit.streak)}</td>
                    <td>
                      <div className="analytics__rate">
                        {/* The bar reinforces the value; the % and fraction are the accessible carriers. */}
                        <div className="analytics__bar" aria-hidden="true">
                          <div
                            className="analytics__bar-fill"
                            style={{ width: `${Math.round(habit.completionRate * 100)}%` }}
                          />
                        </div>
                        <span className="analytics__pct">{ratePercent(habit)}</span>
                        <span className="analytics__fraction">
                          {noneElapsed
                            ? 'no elapsed occurrences yet'
                            : `(${habit.completed}/${habit.scheduled})`}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* FR-ANL-03, rendered as UI text (the §3.7.3 ⓘ note): recovering from a miss is not a break. */}
      <p className="analytics__note">
        <span aria-hidden="true">ⓘ </span>
        Tasks that were automatically rescheduled and then completed count as completed. Recovering
        from a missed task does not break a streak.
      </p>
    </section>
  );
};
