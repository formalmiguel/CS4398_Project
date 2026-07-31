import { useCallback, useEffect, useRef, useState } from 'react';

import type { IntensityTier, Meal, MealType, Workout } from '@capstone/shared';

import { WellnessResult, getWellness, setWorkoutSelection, toErrorMessage } from '../api/client';
import { todayIso } from '../dateUtils';
import { TaskForm } from './TaskForm';

interface Props {
  readonly date: string;
}

const TIER_LABEL: Readonly<Record<IntensityTier, string>> = {
  LOW: 'a light recovery',
  MODERATE: 'a moderate',
  HIGH: 'a high-intensity',
};

const kcal = (n: number): string => `${n.toLocaleString()} kcal`;

// `Meal` (unlike `Workout`) has no duration field to prefill the task form from — there is
// nothing on the record to derive one, so scheduling a meal starts from a fixed default the
// user can still edit in the form itself, same as any other field.
const MEAL_DEFAULT_DURATION_MINUTES = 30;

/**
 * FR-WEL-05: the meta line under "Today's metrics". It states, accurately, whether the metrics
 * shown are the ones recorded for the date being VIEWED or a fallback to an earlier reading (the
 * backend substitutes the most recent prior set when the viewed date has none of its own):
 *   - set date === viewed date → "measured {date}"          (no fallback happened)
 *   - set date !== viewed date → "no data for {viewed} — showing {set date}" (fell back)
 * The viewed date is written as "today" only when it actually is the current day, so the common
 * case reads naturally; any other viewed date is named explicitly rather than mislabelled "today".
 */
const metricsSourceNote = (viewedDate: string, setDate: string): string => {
  if (setDate === viewedDate) return `measured ${setDate}`;
  const viewedLabel = viewedDate === todayIso() ? 'today' : viewedDate;
  return `no data for ${viewedLabel} — showing ${setDate}`;
};

/**
 * FR-WEL, UI-03: the wellness view. Renders the read-only `GET /wellness` payload (packet 14a).
 * Clicking a workout card records it as the user's pick for the date and opens the task form
 * pre-filled from it — the user still chooses the date, time and flexibility themselves; this
 * is a separate, user-driven path onto the schedule from FR-REC-04's engine-placed one.
 */
export const WellnessView = ({ date }: Props) => {
  const [data, setData] = useState<WellnessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [schedulingWorkout, setSchedulingWorkout] = useState<Workout | null>(null);
  const [schedulingMeal, setSchedulingMeal] = useState<{ mealType: MealType; meal: Meal } | null>(null);
  // No backend concept of "skip" exists for a wellness-panel meal suggestion (unlike a scheduled
  // occurrence's FR-RSC-08 skip) — this is purely a client-side dismissal, reset on every reload.
  const [skippedMeals, setSkippedMeals] = useState<ReadonlySet<MealType>>(new Set());
  const schedulingFormRef = useRef<HTMLDivElement | null>(null);

  // The form renders at the bottom of the panel stack, well below the workout/meal cards near
  // the top — without this, clicking a card opens a form the user can't see without scrolling
  // down themselves and has to go hunting for.
  useEffect(() => {
    if (schedulingWorkout !== null || schedulingMeal !== null) {
      schedulingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [schedulingWorkout, schedulingMeal]);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const result = await getWellness(date);
      setData(result);
      // Restore the user's saved pick for this date. No fallback to the recommendation — the
      // recommended option is a suggestion, not a pre-made choice, so nothing shows as selected
      // until the user actually clicks one.
      setSelectedWorkoutId(result.workout.selectedWorkoutId ?? null);
      setSkippedMeals(new Set());
    } catch (err) {
      setError(toErrorMessage(err, 'Could not load wellness data.'));
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectWorkout = useCallback(
    (workoutId: string): void => {
      setSelectedWorkoutId(workoutId);
      setWorkoutSelection(date, workoutId).catch((err: unknown) => {
        setError(toErrorMessage(err, 'Could not save your workout pick.'));
      });
    },
    [date],
  );

  const toggleMealSkip = useCallback((mealType: MealType): void => {
    setSkippedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealType)) next.delete(mealType);
      else next.add(mealType);
      return next;
    });
  }, []);

  if (error !== null) {
    return (
      <section className="wellness">
        <p className="error">{error}</p>
      </section>
    );
  }
  if (data === null) return <section className="wellness"><p>Loading…</p></section>;

  const { metrics, workout, meals } = data;
  // Skipping is client-side only (no backend concept — see `skippedMeals` above), so the total
  // has to be recomputed here rather than trusting the server's `planTotalCalories`, which knows
  // nothing about what the user has skipped in this view.
  const displayedTotalCalories = meals.plan.reduce(
    (sum, slot) => (slot.meal === null || skippedMeals.has(slot.mealType) ? sum : sum + slot.meal.calories),
    0,
  );

  return (
    <section className="wellness">
      {/* ── TODAY'S METRICS (FR-WEL-01, FR-WEL-05) ── */}
      <div className="wellness__panel">
        <div className="wellness__panel-head">
          <h2>Today&rsquo;s metrics</h2>
          <span className="wellness__meta">{metricsSourceNote(date, metrics.date)}</span>
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
              {[workout.recommended, ...workout.alternatives].map((option) => {
                const isSelected = selectedWorkoutId === option.id;
                const isRecommended = option.id === workout.recommended?.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`wellness__workout${isSelected ? ' wellness__workout--selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      selectWorkout(option.id);
                      setSchedulingWorkout(option);
                    }}
                  >
                    <strong>{option.name}</strong>
                    <span>{option.targetArea}</span>
                    {isRecommended && <span className="wellness__workout-badge">Recommended</span>}
                  </button>
                );
              })}
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
          {meals.plan.map((slot) => {
            const isSkipped = slot.meal !== null && skippedMeals.has(slot.mealType);
            return (
              <li key={slot.mealType} className="wellness__meal">
                <span className="wellness__meal-type">{slot.mealType}</span>
                {slot.meal === null ? (
                  <span className="wellness__muted">no meal found for this slot</span>
                ) : (
                  <>
                    <span className={`wellness__meal-name${isSkipped ? ' wellness__meal--skipped-text' : ''}`}>
                      {slot.meal.name}
                    </span>
                    <span className={`wellness__meal-kcal${isSkipped ? ' wellness__meal--skipped-text' : ''}`}>
                      {kcal(slot.meal.calories)}
                    </span>
                    {slot.meal.dietaryFlags.length > 0 && (
                      <span className="wellness__flags">[{slot.meal.dietaryFlags.join(', ').toLowerCase()}]</span>
                    )}
                    <div className="wellness__meal-actions">
                      <button
                        type="button"
                        className={`wellness__meal-action${isSkipped ? ' wellness__meal-action--active' : ''}`}
                        aria-pressed={isSkipped}
                        onClick={() => toggleMealSkip(slot.mealType)}
                      >
                        {isSkipped ? 'Skipped' : 'Skip'}
                      </button>
                      <button
                        type="button"
                        className="wellness__meal-action wellness__meal-action--primary"
                        onClick={() => setSchedulingMeal({ mealType: slot.mealType, meal: slot.meal as Meal })}
                      >
                        Schedule
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
          <li className="wellness__meal wellness__meal--total">
            <span className="wellness__meal-type" />
            <span className="wellness__meal-name" />
            <span className="wellness__meal-kcal">{kcal(displayedTotalCalories)}</span>
          </li>
        </ul>
      </div>

      {(schedulingWorkout !== null || schedulingMeal !== null) && (
        <div className="modal" ref={schedulingFormRef}>
          <TaskForm
            date={date}
            prefill={
              schedulingWorkout !== null
                ? {
                    title: schedulingWorkout.name,
                    type: 'WORKOUT',
                    durationMinutes: schedulingWorkout.typicalDurationMinutes,
                    intensityTier: schedulingWorkout.intensityTier,
                  }
                : {
                    title: (schedulingMeal as { mealType: MealType; meal: Meal }).meal.name,
                    type: 'MEAL',
                    durationMinutes: MEAL_DEFAULT_DURATION_MINUTES,
                  }
            }
            onDone={() => {
              setSchedulingWorkout(null);
              setSchedulingMeal(null);
            }}
            onCancel={() => {
              setSchedulingWorkout(null);
              setSchedulingMeal(null);
            }}
          />
        </div>
      )}
    </section>
  );
};
