import { useState } from 'react';

import type { DietaryFlag } from '@capstone/shared';

import { AuthResult, login, register, toErrorMessage } from '../api/client';
import { timeToMinute } from '../dateUtils';

interface Props {
  readonly onAuthenticated: (result: AuthResult, email: string) => void;
}

/** FR-REC-05: the five dietary preferences the user may declare at registration (UC-01). */
const DIETARY_OPTIONS: readonly { value: DietaryFlag; label: string }[] = [
  { value: 'VEGETARIAN', label: 'Vegetarian' },
  { value: 'VEGAN', label: 'Vegan' },
  { value: 'GLUTEN_FREE', label: 'Gluten-free' },
  { value: 'DAIRY_FREE', label: 'Dairy-free' },
  { value: 'NUT_FREE', label: 'Nut-free' },
];

/** FR-USR-01/02/07, FR-REC-09, FR-REC-05: register (defining the schedulable day, baseline calorie
 * target, and dietary preferences per UC-01) or log in to an existing account. */
export const AuthScreen = ({ onAuthenticated }: Props) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [baselineCalories, setBaselineCalories] = useState('2000');
  const [dietaryPreferences, setDietaryPreferences] = useState<readonly DietaryFlag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleDietary = (flag: DietaryFlag): void =>
    setDietaryPreferences((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === 'login'
          ? await login({ email, password })
          : await register({
              email,
              password,
              wakeMinute: timeToMinute(wakeTime),
              sleepMinute: timeToMinute(sleepTime),
              baselineCalories: Number(baselineCalories),
              dietaryPreferences,
            });
      onAuthenticated(result, email);
    } catch (err) {
      setError(toErrorMessage(err, 'Could not reach the server.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <h1>Adaptive Scheduler</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {mode === 'register' && (
          <>
            <label>
              Wake time
              <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} required />
            </label>
            <label>
              Sleep time
              <input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} required />
            </label>
            <label>
              Baseline calorie target (kcal/day)
              <input
                type="number"
                min={500}
                max={10000}
                value={baselineCalories}
                onChange={(e) => setBaselineCalories(e.target.value)}
                required
              />
            </label>
            {/* A native <legend> always renders straddling the fieldset's top border — there's
                no reliable cross-browser way to keep it fully above the box. A plain label
                above an aria-labelled fieldset gets the same accessible grouping without it. */}
            <p className="dietary-preferences-label">Dietary preferences</p>
            <fieldset className="dietary-preferences" aria-label="Dietary preferences">
              {DIETARY_OPTIONS.map((option) => (
                <label key={option.value} className="checkbox">
                  <input
                    type="checkbox"
                    checked={dietaryPreferences.includes(option.value)}
                    onChange={() => toggleDietary(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          </>
        )}
        {error !== null && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
      </button>
    </div>
  );
};
