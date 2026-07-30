/**
 * SI-04: the only place this app calls `fetch`. The frontend consumes the REST API exclusively
 * — no direct database access, no direct third-party calls.
 */
import type { DailyMetricSet, DietaryFlag, Flexibility, IntensityTier, Interval, Meal, MealType, Minute, Placement, PlacementResult, Recurrence, Slot, Task, TaskType, Workout } from '@capstone/shared';

const TOKEN_KEY = 'capstone.token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

/** NFR-USE-03: a message the UI can show — never a raw status code or stack trace. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: readonly { field: string; reason: string }[],
  ) {
    super(message);
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== null) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...init, headers: { ...headers, ...init?.headers } });

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof body.error === 'string' ? body.error : 'Something went wrong. Please try again.';
    const fieldErrors = Array.isArray(body.errors)
      ? (body.errors as { field: string; reason: string }[])
      : undefined;
    throw new ApiError(message, res.status, fieldErrors);
  }
  return body as T;
};

// ─── Auth (FR-USR-01/02/07) ───────────────────────────────────────────────

export interface AuthResult {
  readonly userId: string;
  readonly token: string;
  readonly wakeMinute: Minute;
  readonly sleepMinute: Minute;
  /** FR-REC-09 / UC-01: the baseline the user set at registration. */
  readonly baselineCalories: number;
  /** FR-REC-05 / UC-01: the user's stated dietary preferences. */
  readonly dietaryPreferences: readonly DietaryFlag[];
}

export const register = (input: {
  email: string;
  password: string;
  wakeMinute: Minute;
  sleepMinute: Minute;
  baselineCalories: number;
  dietaryPreferences: readonly DietaryFlag[];
}): Promise<AuthResult> => request('/auth/register', { method: 'POST', body: JSON.stringify(input) });

export const login = (input: { email: string; password: string }): Promise<AuthResult> =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(input) });

export interface Profile {
  readonly userId: string;
  readonly email: string;
  readonly wakeMinute: Minute;
  readonly sleepMinute: Minute;
  readonly baselineCalories: number;
  readonly dietaryPreferences: readonly DietaryFlag[];
}

export const getProfile = (): Promise<Profile> => request('/user/me');

// ─── Tasks (FR-TSK, UC-02/UC-03) ──────────────────────────────────────────

export interface TaskInput {
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

/**
 * FR-RSC-02: what `RescheduleService.onCommitmentAdded` reports for one displaced task — the
 * `kind`/`taskId` common to all three `RescheduleOutcome` variants (`server/src/reschedule/
 * RescheduleService.ts`), which is all the frontend needs to know whether anything moved.
 */
export interface DisplacedOutcome {
  readonly kind: 'RESCHEDULED' | 'UNPLACEABLE' | 'NO_ACTION';
  readonly taskId: string;
}

/**
 * The three-way shape `POST /tasks` returns (docs/P12-REPORT.md):
 * `placement` set = auto-placed (UC-02, or a FIXED commitment). `candidates` set = the
 * preferred window had no room; present the FR-DSH-06 picker. `unplaceable` set = FR-SCH-06,
 * no valid slot exists anywhere today.
 */
export interface CreateTaskResult {
  readonly task: Task;
  readonly placement: Placement | null;
  readonly candidates?: readonly Slot[] | null;
  readonly unplaceable?: Extract<PlacementResult, { placed: false }> | null;
  readonly displaced?: readonly DisplacedOutcome[];
}

export const createTask = (input: TaskInput): Promise<CreateTaskResult> =>
  request('/tasks', { method: 'POST', body: JSON.stringify(input) });

export const placeTask = (
  taskId: string,
  choice: { date: string; start: Minute; end: Minute },
): Promise<{ placement: Placement }> =>
  request(`/tasks/${taskId}/place`, { method: 'POST', body: JSON.stringify(choice) });

/**
 * OPEN-36: recomputes fresh ranked candidates for a task that is STILL `awaitingChoice` on
 * `date` — read-only, writes nothing. Lets the schedule view reopen `CandidatePicker` after the
 * "+ Add Task" flow that originally offered it has long since closed (those candidates are never
 * persisted). 409s if the task isn't currently awaiting a choice for that date.
 */
export interface RefreshCandidatesResult {
  readonly candidates: readonly Slot[] | null;
  readonly unplaceable: Extract<PlacementResult, { placed: false }> | null;
}

export const refreshCandidates = (taskId: string, date: string): Promise<RefreshCandidatesResult> =>
  request(`/tasks/${taskId}/candidates?date=${encodeURIComponent(date)}`);

export interface ScheduleResult {
  readonly tasks: readonly Task[];
  readonly placements: readonly Placement[];
  readonly awaitingChoice: readonly string[];
}

export const getSchedule = (date: string): Promise<ScheduleResult> =>
  request(`/schedule?date=${encodeURIComponent(date)}`);

export const completeTask = (taskId: string, date: string): Promise<{ outcome: unknown }> =>
  request(`/tasks/${taskId}/complete`, { method: 'POST', body: JSON.stringify({ date }) });

export const skipTask = (taskId: string, date: string): Promise<{ outcome: unknown }> =>
  request(`/tasks/${taskId}/skip`, { method: 'POST', body: JSON.stringify({ date }) });

export const moveToNextDay = (taskId: string, date: string): Promise<{ outcome: unknown }> =>
  request(`/tasks/${taskId}/move-to-next-day`, { method: 'POST', body: JSON.stringify({ date }) });

/**
 * The month-grid's dots (server/src/db/TaskRepository.ts's `taskTypesInRange`). Frontend-only
 * response shape, like `DisplacedOutcome` above — no touch to the frozen `shared/src/contract.ts`.
 * A day absent from `days` has no matching task; this is a read of task DEFINITIONS, not
 * placements, so it is safe to call for a month nobody has ever opened via `getSchedule`.
 */
export interface MonthOverviewItem {
  readonly id: string;
  readonly title: string;
  readonly type: TaskType;
  readonly start: Minute;
}

export interface MonthOverviewDay {
  readonly date: string;
  readonly types: readonly TaskType[];
  readonly items: readonly MonthOverviewItem[];
}

export const getMonthOverview = (start: string, end: string): Promise<{ days: readonly MonthOverviewDay[] }> =>
  request(`/schedule/overview?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);

// ─── Wellness (FR-WEL-01…05, UI-03) ───────────────────────────────────────

/** FR-REC-13's machine-readable reason (the sentence is built in the view). */
export interface WellnessReason {
  readonly metricName: string;
  readonly metricValue: number | null;
  readonly usedFallback: boolean;
}

export interface WellnessWorkout {
  readonly tier: IntensityTier;
  readonly recommended: Workout | null;
  readonly alternatives: readonly Workout[];
  readonly reason: WellnessReason | null;
  readonly satisfiable: boolean;
}

export interface WellnessMealSlot {
  readonly mealType: MealType;
  readonly slotTarget: number;
  readonly meal: Meal | null;
  readonly relaxed: readonly string[];
  readonly satisfiable: boolean;
}

export interface WellnessMeals {
  readonly baseline: number;
  readonly activity: number;
  readonly target: number;
  readonly planTotalCalories: number;
  /** FR-WEL-05 / FR-REC-06: the target fell back to the baseline (no current active-calorie data). */
  readonly madeWithoutCurrentData: boolean;
  readonly plan: readonly WellnessMealSlot[];
}

/**
 * The `GET /wellness` response — a frontend-only shape (like `ScheduleResult`), NOT a
 * `shared/src/contract.ts` type. `metrics` and `history` carry the `DailyMetricSet` verbatim so
 * the view renders whatever metrics the set holds (FR-WEL-01) with each metric's availability
 * and the set's date intact (FR-WEL-05).
 */
export interface WellnessResult {
  readonly date: string;
  readonly metrics: DailyMetricSet;
  readonly history: readonly DailyMetricSet[];
  readonly workout: WellnessWorkout;
  readonly meals: WellnessMeals;
}

export const getWellness = (date: string): Promise<WellnessResult> =>
  request(`/wellness?date=${encodeURIComponent(date)}`);

// ─── Analytics (FR-ANL-01/02/03/04, UI-04) ────────────────────────────────

/**
 * One habit's row in the analytics table. Every number is `analyzeHabit`'s (server/src/analytics/
 * HabitAnalytics.ts) — a frozen, property-tested PURE function (packets 15a/15b). The view renders
 * these verbatim and never re-derives `completionRate`: the frozen function owns FR-ANL-02's math,
 * so a second division in the view would be a second, un-pinned implementation of the rate.
 */
export interface HabitStat {
  readonly taskId: string;
  readonly title: string;
  /** FR-ANL-01: consecutive completed occurrences ending at the most recent resolved one. */
  readonly streak: number;
  /** FR-ANL-02 numerator: distinct dates whose occurrence resolved COMPLETED. */
  readonly completed: number;
  /** FR-ANL-02 denominator: distinct dates whose occurrence has ELAPSED and resolved (v2.31). */
  readonly scheduled: number;
  /** completed / scheduled; exactly 0 when scheduled === 0 (never NaN). */
  readonly completionRate: number;
}

/**
 * The `GET /analytics` response — a frontend-only shape (like `WellnessResult`), NOT a
 * `shared/src/contract.ts` type. The window (`from`/`to`/`asOf`) is chosen SERVER-SIDE — a fixed
 * trailing year — so there is no query parameter and no client period selector (docs/TEAM-MEETING.md,
 * 28 Jul); the view states the window the server returned.
 */
export interface AnalyticsResult {
  readonly from: string;
  readonly to: string;
  readonly asOf: string;
  readonly habits: readonly HabitStat[];
}

export const getAnalytics = (): Promise<AnalyticsResult> => request('/analytics');

// ─── Calendar export (FR-CAL-07, SI-06) ───────────────────────────────────

/**
 * Not `request()` — the response is `text/calendar`, not JSON, so this is the second (and
 * only other) place this app calls `fetch` directly, for the same reason `request` exists:
 * SI-04 still holds, this is still the REST API, just a binary/file response instead of JSON.
 */
export const exportScheduleIcs = async (start: string, end: string): Promise<Blob> => {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `/api/schedule/export?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    { headers },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body.error === 'string' ? body.error : 'Could not export the schedule.';
    throw new ApiError(message, res.status);
  }
  return res.blob();
};

/** NFR-USE-03: the one-line ternary every component's catch block was repeating. */
export const toErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof ApiError ? err.message : fallback;
