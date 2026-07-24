/**
 * SI-04: the only place this app calls `fetch`. The frontend consumes the REST API exclusively
 * — no direct database access, no direct third-party calls.
 */
import type { Flexibility, IntensityTier, Interval, Minute, Placement, PlacementResult, Recurrence, Slot, Task, TaskType } from '@capstone/shared';

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
}

export const register = (input: {
  email: string;
  password: string;
  wakeMinute: Minute;
  sleepMinute: Minute;
}): Promise<AuthResult> => request('/auth/register', { method: 'POST', body: JSON.stringify(input) });

export const login = (input: { email: string; password: string }): Promise<AuthResult> =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(input) });

export interface Profile {
  readonly userId: string;
  readonly email: string;
  readonly wakeMinute: Minute;
  readonly sleepMinute: Minute;
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
  readonly displaced?: readonly unknown[];
}

export const createTask = (input: TaskInput): Promise<CreateTaskResult> =>
  request('/tasks', { method: 'POST', body: JSON.stringify(input) });

export const placeTask = (
  taskId: string,
  choice: { date: string; start: Minute; end: Minute },
): Promise<{ placement: Placement }> =>
  request(`/tasks/${taskId}/place`, { method: 'POST', body: JSON.stringify(choice) });

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

/** NFR-USE-03: the one-line ternary every component's catch block was repeating. */
export const toErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof ApiError ? err.message : fallback;
