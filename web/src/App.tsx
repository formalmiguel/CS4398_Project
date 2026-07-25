import { useEffect, useState } from 'react';

import { AuthResult, Profile, clearToken, getProfile, getToken, setToken } from './api/client';
import { AuthScreen } from './components/AuthScreen';
import { ScheduleView } from './components/ScheduleView';
import { todayIso } from './dateUtils';
import { Theme, applyTheme, getStoredTheme, systemTheme } from './theme';

export const App = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkedSession, setCheckedSession] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [theme, setThemeState] = useState<Theme>(systemTheme);

  useEffect(() => {
    // Only an explicit prior toggle (below) sets the DOM override — with nothing stored, the
    // OS-preference media query in styles.css keeps governing on its own.
    const stored = getStoredTheme();
    if (stored !== null) {
      document.documentElement.dataset.theme = stored;
      setThemeState(stored);
    }
  }, []);

  const toggleTheme = (): void => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setThemeState(next);
  };

  useEffect(() => {
    // A stored token surviving a page reload has no wakeMinute/sleepMinute of its own —
    // GET /user/me is what re-reads FR-USR-07's schedulable day for it.
    const restore = async (): Promise<void> => {
      if (getToken() === null) {
        setCheckedSession(true);
        return;
      }
      try {
        const p = await getProfile();
        setProfile(p);
      } catch {
        clearToken();
      } finally {
        setCheckedSession(true);
      }
    };
    void restore();
  }, []);

  const onAuthenticated = (result: AuthResult): void => {
    setToken(result.token);
    setProfile({ userId: result.userId, email: '', wakeMinute: result.wakeMinute, sleepMinute: result.sleepMinute });
  };

  const logOut = (): void => {
    clearToken();
    setProfile(null);
  };

  if (!checkedSession) return null;

  if (profile === null) {
    return <AuthScreen onAuthenticated={onAuthenticated} />;
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Adaptive Scheduler</h1>
        <nav>
          <span>Schedule</span>
        </nav>
        <button
          type="button"
          className="icon-button icon-button--filled icon-button--lg"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button type="button" className="app__logout" onClick={logOut}>
          Log out
        </button>
      </header>
      <ScheduleView
        date={date}
        onDateChange={setDate}
        schedulableDay={{ start: profile.wakeMinute, end: profile.sleepMinute }}
      />
    </div>
  );
};
