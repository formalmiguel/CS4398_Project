/**
 * FR-TSK-01/02's attribute table, made executable, plus the NFR-SEC-05 discipline that applies
 * to every field before it can reach a Mongo filter or document: reject the wrong TYPE outright
 * rather than coercing it. A `{"$gt": ""}` submitted where a string belongs is a query-operator
 * injection attempt, not a string that needs trimming.
 */
import type { Flexibility, IntensityTier, Interval, Recurrence, TaskType } from '@capstone/shared';

export interface ValidationError {
  readonly field: string;
  readonly reason: string;
}

export interface ValidatedTaskInput {
  readonly title: string;
  readonly type: TaskType;
  readonly durationMinutes: number;
  readonly priority: number;
  readonly preferredWindow: Interval;
  readonly flexibility: Flexibility;
  readonly intendedDate: string;
  readonly recurrence?: Recurrence;
  readonly intensityTier?: IntensityTier;
}

const TASK_TYPES: readonly TaskType[] = ['CLASS', 'MEETING', 'HABIT', 'WORKOUT', 'MEAL', 'OTHER'];
const FLEXIBILITIES: readonly Flexibility[] = ['FIXED', 'FLEXIBLE'];
const INTENSITY_TIERS: readonly IntensityTier[] = ['LOW', 'MODERATE', 'HIGH'];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isString = (v: unknown): v is string => typeof v === 'string';
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * FR-TSK-01's table, validated field by field. Returns every violation found, not just the
 * first — FR-TSK-02 requires the System to STATE the reason, and a form that reports one error
 * at a time makes a user fix five things one at a time.
 */
export type TaskValidationResult =
  | { readonly ok: true; readonly value: ValidatedTaskInput }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

export const validateTaskInput = (body: unknown): TaskValidationResult => {
  const errors: ValidationError[] = [];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: [{ field: 'body', reason: 'must be an object' }] };
  }
  const b = body as Record<string, unknown>;

  if (!isString(b.title) || b.title.length < 1 || b.title.length > 100) {
    errors.push({ field: 'title', reason: '1-100 characters' });
  }
  if (!isString(b.type) || !TASK_TYPES.includes(b.type as TaskType)) {
    errors.push({ field: 'type', reason: `must be one of ${TASK_TYPES.join(', ')}` });
  }
  if (!isFiniteNumber(b.durationMinutes) || b.durationMinutes < 5 || b.durationMinutes > 480) {
    errors.push({ field: 'durationMinutes', reason: '5-480 minutes' });
  }
  if (!isFiniteNumber(b.priority) || b.priority < 1 || b.priority > 5 || !Number.isInteger(b.priority)) {
    errors.push({ field: 'priority', reason: 'integer 1 (highest) - 5 (lowest)' });
  }
  let preferredWindow: Interval | undefined;
  if (
    typeof b.preferredWindow !== 'object' ||
    b.preferredWindow === null ||
    !isFiniteNumber((b.preferredWindow as Record<string, unknown>).start) ||
    !isFiniteNumber((b.preferredWindow as Record<string, unknown>).end)
  ) {
    errors.push({ field: 'preferredWindow', reason: 'must be { start: Minute, end: Minute }' });
  } else {
    const w = b.preferredWindow as { start: number; end: number };
    if (w.end <= w.start) {
      errors.push({ field: 'preferredWindow', reason: 'end must be after start' });
    } else if (isFiniteNumber(b.durationMinutes) && w.end - w.start < b.durationMinutes) {
      // FR-TSK-02: rejected at entry, stating the reason, rather than discovered at scheduling time.
      errors.push({ field: 'preferredWindow', reason: 'FR-TSK-02: window is shorter than the duration' });
    } else {
      preferredWindow = { start: w.start, end: w.end };
    }
  }
  if (!isString(b.flexibility) || !FLEXIBILITIES.includes(b.flexibility as Flexibility)) {
    errors.push({ field: 'flexibility', reason: 'must be FIXED or FLEXIBLE' });
  }
  if (!isString(b.intendedDate) || !ISO_DATE.test(b.intendedDate)) {
    errors.push({ field: 'intendedDate', reason: 'must be an ISO date YYYY-MM-DD' });
  }

  let recurrence: Recurrence | undefined;
  if (b.recurrence !== undefined) {
    const r = b.recurrence as Record<string, unknown>;
    if (typeof r !== 'object' || r === null || (r.frequency !== 'DAILY' && r.frequency !== 'WEEKLY')) {
      errors.push({ field: 'recurrence.frequency', reason: 'must be DAILY or WEEKLY' });
    } else if (r.frequency === 'WEEKLY') {
      const days = r.daysOfWeek;
      if (
        !Array.isArray(days) ||
        days.length === 0 ||
        !days.every((d) => WEEKDAYS.includes(d as number))
      ) {
        errors.push({ field: 'recurrence.daysOfWeek', reason: 'required, non-empty, 1(Mon)-7(Sun)' });
      } else {
        recurrence = { frequency: 'WEEKLY', daysOfWeek: days as number[] };
      }
    } else {
      recurrence = { frequency: 'DAILY' };
    }
  }

  let intensityTier: IntensityTier | undefined;
  if (b.type === 'WORKOUT') {
    if (!isString(b.intensityTier) || !INTENSITY_TIERS.includes(b.intensityTier as IntensityTier)) {
      errors.push({ field: 'intensityTier', reason: 'required for WORKOUT: LOW, MODERATE, or HIGH' });
    } else {
      intensityTier = b.intensityTier as IntensityTier;
    }
  } else if (b.intensityTier !== undefined) {
    errors.push({ field: 'intensityTier', reason: 'only valid for type WORKOUT' });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title: b.title as string,
      type: b.type as TaskType,
      durationMinutes: b.durationMinutes as number,
      priority: b.priority as number,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      preferredWindow: preferredWindow!,
      flexibility: b.flexibility as Flexibility,
      intendedDate: b.intendedDate as string,
      ...(recurrence === undefined ? {} : { recurrence }),
      ...(intensityTier === undefined ? {} : { intensityTier }),
    },
  };
};

/** NFR-SEC-05: the guard every route applies to a value about to become a query filter. */
export const isSafeQueryString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
