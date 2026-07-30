import { useCallback, useEffect, useState } from 'react';

import type { IntensityTier } from '@capstone/shared';

import { WellnessResult, getWellness, toErrorMessage } from '../api/client';
import { todayIso } from '../dateUtils';

interface Props {
  readonly date: string;
}

const TIER_LABEL: Readonly<Record<IntensityTier, string>> = {
  LOW: 'a light recovery',
  MODERATE: 'a moderate',
  HIGH: 'a high-intensity',
};

const kcal = (n: number): string => `${n.toLocaleString()} kcal`;

/** FR-WEL-05: a metric is "current" only when the set's date is today. */
const dateNote = (setDate: string): string | null =>
  setDate === todayIso() ? null : `as of ${setDate}`;

/**
 * FR-WEL, UI-03: the wellness view. Renders the read-only `GET /wellness` payload (packet 14a) —
 * it never mutates the schedule and offers no "accept" action (a recommendation becomes a task
 * through FR-REC-04's path, not a click here).
 */
export const WellnessView = ({ date }: Props) => {
  const [data, setData] = useState<WellnessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      setData(await getWellness(date));
    } catch (err) {
      setError(toErrorMessage(err, 'Could not load wellness data.'));
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return (
      <section className="wellness">
        <p className="error">{error}</p>
      </section>
    );
  }
  if (data === null) return <section className="wellness"><p>Loading…</p></section>;

  const { metrics, workout, meals } = data;
  const staleNote = dateNote(metrics.date);

  return (
    <section className="wellness">
      {/* ── TODAY'S METRICS (FR-WEL-01, FR-WEL-05) ── */}
      <div className="wellness__panel">
        <div className="wellness__panel-head">
          <h2>Today&rsquo;s metrics</h2>
          <span className="wellness__meta">
            {staleNote === null ? `measured ${metrics.date}` : `no data for today — showing ${metrics.date}`}
          </span>
        </div>
        {Object.keys(metrics.metrics).length === 0 ? (
          <p className="wellness__muted">No metrics recorded for this date.</p>
        ) : (
          <ul className="wellness__metrics">
            {/* FR-WEL-01: rendered by whatever the set contains — never a hard-coded metric list. */}
            {Object.entries(metrics.metrics).map(([name, metric]) => (
              <li key={name} className="wellness__metric">
                <span className="wellness__metric-name">{name}</span>
                {metric.isAvailable ? (
                  <span className="wellness__metric-value">
                    {metric.value.toLocaleString()} <em>{metric.unit}</em>
                  </span>
                ) : (
                  // FR-WEL-05 / NFR-ROB-01: an absent metric is stated as unavailable, never shown as 0.
                  <span className="wellness__metric-value wellness__metric-value--unavailable">
                    no data
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── TODAY'S WORKOUT (FR-WEL-02) ── */}
      <div className="wellness__panel">
        <div className="wellness__panel-head">
          <h2>Today&rsquo;s workout</h2>
          <span className="wellness__tier">Tier: {workout.tier}</span>
        </div>
        {workout.recommended === null || !workout.satisfiable ? (
          <p className="wellness__muted">No workout could be offered at this tier.</p>
        ) : (
          <>
            {workout.reason !== null && (
              <p className="wellness__reason">
                {workout.reason.usedFallback || workout.reason.metricValue === null
                  ? 'No current sleep data — defaulting to a moderate session.'
                  : `${TIER_LABEL[workout.tier]} session — your sleep score was ${workout.reason.metricValue}.`}
              </p>
            )}
            <div className="wellness__workouts">
              <div className="wellness__workout wellness__workout--selected">
                <strong>{workout.recommended.name}</strong>
                <span>{workout.recommended.targetArea}</span>
              </div>
              {workout.alternatives.map((alt) => (
                <div key={alt.id} className="wellness__workout">
                  <strong>{alt.name}</strong>
                  <span>{alt.targetArea}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── TODAY'S MEAL PLAN (FR-WEL-03) ── */}
      <div className="wellness__panel">
        <div className="wellness__panel-head">
          <h2>Today&rsquo;s meal plan</h2>
          <span className="wellness__tier">Target: {kcal(meals.target)}</span>
        </div>
        {/* FR-WEL-03: baseline and activity contribution shown SEPARATELY. */}
        <p className="wellness__reason">
          {kcal(meals.target)} today — baseline {meals.baseline.toLocaleString()} + {meals.activity.toLocaleString()} active calories.
          {meals.madeWithoutCurrentData && ' (no current activity data — this is the baseline target.)'}
        </p>
        <ul className="wellness__meals">
          {meals.plan.map((slot) => (
            <li key={slot.mealType} className="wellness__meal">
              <span className="wellness__meal-type">{slot.mealType}</span>
              {slot.meal === null ? (
                <span className="wellness__muted">no meal found for this slot</span>
              ) : (
                <>
                  <span className="wellness__meal-name">{slot.meal.name}</span>
                  <span className="wellness__meal-kcal">{kcal(slot.meal.calories)}</span>
                  {slot.meal.dietaryFlags.length > 0 && (
                    <span className="wellness__flags">[{slot.meal.dietaryFlags.join(', ').toLowerCase()}]</span>
                  )}
                </>
              )}
            </li>
          ))}
          <li className="wellness__meal wellness__meal--total">
            <span className="wellness__meal-type" />
            <span className="wellness__meal-name" />
            <span className="wellness__meal-kcal">{kcal(meals.planTotalCalories)}</span>
          </li>
        </ul>
      </div>
    </section>
  );
};
