import { learnGet, learnSet } from './learnLocal';

export const THEME_STORAGE_KEY = 'english_theme';
export const THEME_CHANGED_EVENT = 'superme-theme-changed';

export function isThemeStale(currentTheme: string, packTheme: string): boolean {
  const current = String(currentTheme || '').trim();
  const pack = String(packTheme || '').trim();
  return Boolean(current && pack && current !== pack);
}

export function readCurrentTheme(): string {
  try {
    return String(learnGet(THEME_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function applyCurrentTheme(theme: string): string {
  const next = String(theme || '').trim();
  if (!next) return '';
  learnSet(THEME_STORAGE_KEY, next);
  window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: { theme: next } }));
  return next;
}
