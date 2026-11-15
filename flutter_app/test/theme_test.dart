import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dalili_app/constants/theme.dart';

void main() {
  group('AppTheme Unit Tests', () {
    test('Dalili color tokens match Phase 1 design specifications', () {
      // Primary Teal brand color (#006D77)
      expect(AppTheme.primaryTeal, const Color(0xFF006D77));
      expect(AppTheme.primaryTeal.toARGB32(), 0xFF006D77);

      // Warning Orange for suggested/unclear prescription items (#E65100)
      expect(AppTheme.warningOrange, const Color(0xFFE65100));
      expect(AppTheme.warningOrange.toARGB32(), 0xFFE65100);

      // Secondary and container tokens
      expect(AppTheme.primaryContainer, const Color(0xFFE0F2F1));
      expect(AppTheme.secondaryTeal, const Color(0xFF83C5BE));
      expect(AppTheme.warningOrangeBackground, const Color(0xFFFFF3E0));

      // Offline Arabic font family
      expect(AppTheme.fontFamily, 'Cairo');
    });

    test('Material 3 is enabled in lightTheme', () {
      final theme = AppTheme.lightTheme;
      expect(theme.useMaterial3, true);
      expect(theme.colorScheme.primary, AppTheme.primaryTeal);
      expect(theme.colorScheme.brightness, Brightness.light);
      expect(theme.textTheme.bodyLarge?.fontFamily, AppTheme.fontFamily);
    });

    test('AppBar and BottomNavigationBar themes are styled properly', () {
      final theme = AppTheme.lightTheme;

      // AppBar
      expect(theme.appBarTheme.backgroundColor, AppTheme.primaryTeal);
      expect(theme.appBarTheme.centerTitle, true);
      expect(theme.appBarTheme.titleTextStyle?.fontFamily, AppTheme.fontFamily);
      expect(theme.appBarTheme.titleTextStyle?.color, Colors.white);

      // BottomNavigationBar
      expect(theme.bottomNavigationBarTheme.selectedItemColor, AppTheme.primaryTeal);
      expect(theme.bottomNavigationBarTheme.unselectedItemColor, AppTheme.textMuted);
    });

    test('Card theme and typography adhere to design specifications', () {
      final theme = AppTheme.lightTheme;
      expect(theme.cardTheme.elevation, 1);
      expect(theme.textTheme.headlineMedium?.fontFamily, AppTheme.fontFamily);
      expect(theme.textTheme.titleLarge?.fontFamily, AppTheme.fontFamily);
      expect(theme.textTheme.bodyLarge?.fontFamily, AppTheme.fontFamily);
    });
  });
}
