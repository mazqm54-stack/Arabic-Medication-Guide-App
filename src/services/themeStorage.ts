/**
 * Senior Accessibility & App Theme Storage Service
 * Manages user theme preferences ('system' | 'light' | 'dark'), DOM class synchronization,
 * dynamic <meta name="theme-color"> updates, and OS system scheme listeners.
 */

import { ThemePreference } from '../types';

export const THEME_STORAGE_KEY = 'dalili_theme_preference';
export const LIGHT_THEME_COLOR = '#006D77';
export const DARK_THEME_COLOR = '#0E1517';

let systemMediaListener: ((e: MediaQueryListEvent) => void) | null = null;
let currentMediaQuery: MediaQueryList | null = null;

/**
 * Checks whether dark mode is currently active based on stored preference (or provided preference) and system scheme.
 */
export function isDarkMode(preference?: ThemePreference): boolean {
  const pref = preference || getStoredThemePreference();
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  // If 'system'
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    return mq ? Boolean(mq.matches) : false;
  }
  return false;
}

/**
 * Initializes the theme based on stored preference and returns a cleanup function.
 */
export function initTheme(): () => void {
  const pref = getStoredThemePreference();
  applyThemeToDOM(pref);
  return () => {
    if (currentMediaQuery && systemMediaListener) {
      if (typeof currentMediaQuery.removeEventListener === 'function') {
        currentMediaQuery.removeEventListener('change', systemMediaListener);
      } else if (typeof (currentMediaQuery as any).removeListener === 'function') {
        (currentMediaQuery as any).removeListener(systemMediaListener);
      }
      systemMediaListener = null;
      currentMediaQuery = null;
    }
  };
}

/**
 * Retrieves the stored theme preference ('system' | 'light' | 'dark').
 * Defaults to 'system'.
 */
export function getStoredThemePreference(): ThemePreference {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved;
      }
    }
  } catch {
    // Return default on storage access failure
  }
  return 'system';
}

/**
 * Persists the user's theme preference to localStorage and applies it to the DOM.
 */
export function setStoredThemePreference(theme: ThemePreference): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch (e) {
    console.warn('[ThemeStorage] Failed to save theme preference:', e);
  }
  applyThemeToDOM(theme);
}

/**
 * Helper to update DOM classes and meta theme-color tag.
 */
function updateDOMTheme(dark: boolean): void {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement;
  if (dark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

/**
 * Applies the given theme preference to the DOM:
 * - Adds or removes the 'dark' class on document.documentElement.
 * - Sets the <meta name="theme-color"> to #0E1517 (dark) or #006D77 (light).
 * - When in 'system' mode, attaches a change listener to window.matchMedia('(prefers-color-scheme: dark)').
 */
export function applyThemeToDOM(theme: ThemePreference = getStoredThemePreference()): void {
  if (typeof document === 'undefined' || !document.documentElement) return;

  // Cleanup any previously registered system media change listener
  if (currentMediaQuery && systemMediaListener) {
    if (typeof currentMediaQuery.removeEventListener === 'function') {
      currentMediaQuery.removeEventListener('change', systemMediaListener);
    } else if (typeof (currentMediaQuery as any).removeListener === 'function') {
      (currentMediaQuery as any).removeListener(systemMediaListener);
    }
    systemMediaListener = null;
    currentMediaQuery = null;
  }

  if (theme === 'dark') {
    updateDOMTheme(true);
  } else if (theme === 'light') {
    updateDOMTheme(false);
  } else {
    // 'system'
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      currentMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const isSystemDark = currentMediaQuery ? Boolean(currentMediaQuery.matches) : false;
      updateDOMTheme(isSystemDark);

      if (currentMediaQuery) {
        systemMediaListener = (e: MediaQueryListEvent) => {
          updateDOMTheme(e.matches);
        };

        if (typeof currentMediaQuery.addEventListener === 'function') {
          currentMediaQuery.addEventListener('change', systemMediaListener);
        } else if (typeof (currentMediaQuery as any).addListener === 'function') {
          (currentMediaQuery as any).addListener(systemMediaListener);
        }
      }
    } else {
      updateDOMTheme(false);
    }
  }
}
