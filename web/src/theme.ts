export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'capstone.theme';

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark';

export const getStoredTheme = (): Theme | null => {
  const value = localStorage.getItem(STORAGE_KEY);
  return isTheme(value) ? value : null;
};

export const systemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/** Sets the `data-theme` attribute the CSS in styles.css reads, and remembers the choice. */
export const applyTheme = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
};
