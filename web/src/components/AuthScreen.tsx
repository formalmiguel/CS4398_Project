import { useState } from 'react';

import { ApiError, AuthResult, login, register } from '../api/client';
import { timeToMinute } from '../dateUtils';

interface Props {
  readonly onAuthenticated: (result: AuthResult) => void;
}

/** FR-USR-01/02/07: register (which defines the schedulable day) or log in to an existing one. */
export const AuthScreen = ({ onAuthenticated }: Props) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
            });
      onAuthenticated(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
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
