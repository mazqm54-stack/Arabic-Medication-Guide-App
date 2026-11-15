import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Lightweight theme manager persisting user preference ('system', 'light', 'dark').
class ThemeService {
  static const String _storageKey = 'dalili_user_theme_mode';
  static final ValueNotifier<ThemeMode> themeModeNotifier =
      ValueNotifier<ThemeMode>(ThemeMode.system);

  /// Initializes the theme mode from SharedPreferences. Defaults to ThemeMode.system.
  static Future<void> init([SharedPreferences? injectedPrefs]) async {
    try {
      final prefs = injectedPrefs ?? await SharedPreferences.getInstance();
      final saved = prefs.getString(_storageKey);
      if (saved == 'dark') {
        themeModeNotifier.value = ThemeMode.dark;
      } else if (saved == 'light') {
        themeModeNotifier.value = ThemeMode.light;
      } else {
        themeModeNotifier.value = ThemeMode.system;
      }
    } catch (_) {
      themeModeNotifier.value = ThemeMode.system;
    }
  }

  /// Toggles between light and dark modes based on current active brightness.
  static Future<void> toggleTheme(BuildContext context, [SharedPreferences? injectedPrefs]) async {
    final Brightness currentBrightness = Theme.of(context).brightness;
    final ThemeMode newMode = currentBrightness == Brightness.dark
        ? ThemeMode.light
        : ThemeMode.dark;

    themeModeNotifier.value = newMode;

    try {
      final prefs = injectedPrefs ?? await SharedPreferences.getInstance();
      await prefs.setString(
        _storageKey,
        newMode == ThemeMode.dark ? 'dark' : 'light',
      );
    } catch (_) {}
  }

  /// Explicitly sets and persists the chosen theme mode.
  static Future<void> setThemeMode(ThemeMode mode, [SharedPreferences? injectedPrefs]) async {
    themeModeNotifier.value = mode;

    try {
      final prefs = injectedPrefs ?? await SharedPreferences.getInstance();
      if (mode == ThemeMode.dark) {
        await prefs.setString(_storageKey, 'dark');
      } else if (mode == ThemeMode.light) {
        await prefs.setString(_storageKey, 'light');
      } else {
        await prefs.remove(_storageKey);
      }
    } catch (_) {}
  }
}
