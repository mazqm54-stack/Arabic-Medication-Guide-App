/**
 * Senior Accessibility & App Preferences Storage Service
 * Manages user UI preferences (e.g. font size) and purges legacy credentials.
 * Zero secrets are stored or managed here.
 */

import { FontSizePreference } from '../types';

export const FONT_SIZE_STORAGE_KEY = 'dalili_font_size_preference_v1';

/**
 * Retrieves the stored font size preference ('large' | 'extra-large').
 * Defaults to 'large' (20px body font).
 */
export function getStoredFontSize(): FontSizePreference {
  try {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (saved === 'extra-large' || saved === 'large') {
      return saved;
    }
    return 'large';
  } catch {
    return 'large';
  }
}

/**
 * Persists the user's font size preference.
 */
export function setStoredFontSize(pref: FontSizePreference): void {
  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, pref);
  } catch (e) {
    console.warn('[PreferencesStorage] Failed to save font preference:', e);
  }
}

/**
 * Security Remediation: Actively purges legacy stored API keys from localStorage
 * to ensure users upgrading from v1 do not retain secrets on their devices.
 */
export function purgeLegacyStoredApiKey(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('api_key') || key.includes('gemini_api'))) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
}
