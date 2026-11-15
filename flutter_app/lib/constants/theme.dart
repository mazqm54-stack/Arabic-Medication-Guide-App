import 'package:flutter/material.dart';

/// Dalili Material 3 Arabic Theme and Color Tokens
class AppTheme {
  // Primary brand palette
  static const Color primaryTeal = Color(0xFF006D77);
  static const Color primaryTealLight = Color(0xFF0A8F9C);
  static const Color primaryContainer = Color(0xFFE0F2F1);
  static const Color secondaryTeal = Color(0xFF83C5BE);

  // Warning & suggested item palette (Mandatory for unclear/suggested prescriptions)
  static const Color warningOrange = Color(0xFFE65100);
  static const Color warningOrangeLight = Color(0xFFF57C00);
  static const Color warningOrangeBackground = Color(0xFFFFF3E0);
  static const Color warningOrangeBorder = Color(0xFFFFB74D);
  static const Color warningAmberSurface = Color(0xFFFEF3C7);
  /// WCAG AA compliant darkened warning text token (contrast ratio 5.11:1 on #FFF3E0, 5.60:1 on white).
  static const Color warningOrangeText = Color(0xFFBF360C);

  // Neutral & background tokens
  static const Color surfaceLight = Color(0xFFF8F9FA);
  static const Color surfaceWhite = Colors.white;
  static const Color backgroundLight = Color(0xFFF4F6F8);
  static const Color textPrimary = Color(0xFF1D3557);
  static const Color textSecondary = Color(0xFF457B9D);
  static const Color textMuted = Color(0xFF6C757D);
  static const Color dividerColor = Color(0xFFE2E8F0);

  // Success tokens
  static const Color successGreen = Color(0xFF2E7D32);
  static const Color successGreenBackground = Color(0xFFE8F5E9);

  // Confidence palette tokens for high, medium, and low confidence
  // High - Green
  static const Color confidenceHighLight = Color(0xFF2E7D32);
  static const Color confidenceHighLightBg = Color(0xFFE8F5E9);
  static const Color confidenceHighDark = Color(0xFF4ADE80);
  static const Color confidenceHighDarkBg = Color(0xFF14301B);

  // Medium - Orange
  static const Color confidenceMediumLight = Color(0xFFBF360C);
  static const Color confidenceMediumLightBg = Color(0xFFFFF3E0);
  static const Color confidenceMediumDark = Color(0xFFFB923C);
  static const Color confidenceMediumDarkBg = Color(0xFF381E08);

  // Low / Unclear - Red
  static const Color confidenceLowLight = Color(0xFFC62828);
  static const Color confidenceLowLightBg = Color(0xFFFFEBEE);
  static const Color confidenceLowDark = Color(0xFFF87171);
  static const Color confidenceLowDarkBg = Color(0xFF380E0E);

  // Bundled Arabic font family name
  static const String fontFamily = 'Cairo';

  /// Resolves the card accent/border color by confidence level and brightness.
  static Color getConfidenceColor(String confidence, {required bool isDark}) {
    switch (confidence.toLowerCase()) {
      case 'high':
        return isDark ? confidenceHighDark : confidenceHighLight;
      case 'medium':
        return isDark ? confidenceMediumDark : confidenceMediumLight;
      default:
        return isDark ? confidenceLowDark : confidenceLowLight;
    }
  }

  /// Resolves the badge background color by confidence level and brightness.
  static Color getConfidenceBgColor(String confidence, {required bool isDark}) {
    switch (confidence.toLowerCase()) {
      case 'high':
        return isDark ? confidenceHighDarkBg : confidenceHighLightBg;
      case 'medium':
        return isDark ? confidenceMediumDarkBg : confidenceMediumLightBg;
      default:
        return isDark ? confidenceLowDarkBg : confidenceLowLightBg;
    }
  }

  /// Resolves the badge icon by confidence level:
  /// check = high, alert/minus = medium, question mark = low or unclear
  static IconData getConfidenceIcon(String confidence) {
    switch (confidence.toLowerCase()) {
      case 'high':
        return Icons.check_circle_rounded;
      case 'medium':
        return Icons.warning_amber_rounded;
      default:
        return Icons.help_outline_rounded;
    }
  }

  /// Builds a unified accessible confidence badge with color and icon
  static Widget buildConfidenceBadge({
    required BuildContext context,
    required String confidence,
    required String labelText,
    double fontSize = 11,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fg = getConfidenceColor(confidence, isDark: isDark);
    final bg = getConfidenceBgColor(confidence, isDark: isDark);
    final icon = getConfidenceIcon(confidence);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fg.withValues(alpha: 0.35), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: fontSize + 3, color: fg),
          const SizedBox(width: 4),
          Text(
            labelText,
            style: TextStyle(
              fontFamily: fontFamily,
              fontSize: fontSize,
              fontWeight: FontWeight.bold,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }

  /// Material 3 Light Theme configured for Dalili
  static ThemeData get lightTheme {
    final ColorScheme colorScheme = ColorScheme.fromSeed(
      seedColor: primaryTeal,
      primary: primaryTeal,
      onPrimary: Colors.white,
      primaryContainer: primaryContainer,
      onPrimaryContainer: primaryTeal,
      secondary: secondaryTeal,
      onSecondary: textPrimary,
      surface: surfaceWhite,
      onSurface: textPrimary,
      error: warningOrange,
      onError: Colors.white,
      brightness: Brightness.light,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: backgroundLight,
      fontFamily: fontFamily,
      appBarTheme: const AppBarTheme(
        backgroundColor: primaryTeal,
        foregroundColor: Colors.white,
        centerTitle: true,
        elevation: 0,
        scrolledUnderElevation: 2,
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
        iconTheme: IconThemeData(color: Colors.white),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surfaceWhite,
        selectedItemColor: primaryTeal,
        unselectedItemColor: textMuted,
        selectedLabelStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 13,
          fontWeight: FontWeight.bold,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 12,
          fontWeight: FontWeight.normal,
        ),
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primaryTeal,
        foregroundColor: Colors.white,
        elevation: 4,
        highlightElevation: 8,
      ),
      cardTheme: CardThemeData(
        color: surfaceWhite,
        elevation: 1,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: dividerColor, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryTeal,
          foregroundColor: Colors.white,
          elevation: 2,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryTeal,
          side: const BorderSide(color: primaryTeal, width: 1.5),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 26,
          fontWeight: FontWeight.bold,
          color: textPrimary,
        ),
        headlineMedium: TextStyle(
          fontFamily: fontFamily,
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: textPrimary,
        ),
        titleLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: textPrimary,
        ),
        titleMedium: TextStyle(
          fontFamily: fontFamily,
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: textPrimary,
        ),
        bodyLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 15,
          color: textPrimary,
          height: 1.5,
        ),
        bodyMedium: TextStyle(
          fontFamily: fontFamily,
          fontSize: 14,
          color: textSecondary,
          height: 1.4,
        ),
        labelLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: textPrimary,
        ),
      ),
    );
  }

  /// Material 3 Dark Theme configured for Dalili
  static ThemeData get darkTheme {
    const backgroundDark = Color(0xFF121212);
    const surfaceDark = Color(0xFF1E1E1E);
    const surfaceElevated = Color(0xFF282828);
    const textPrimaryDark = Color(0xFFF1F5F9);
    const textSecondaryDark = Color(0xFF94A3B8);
    const dividerDark = Color(0xFF334155);

    final ColorScheme colorScheme = ColorScheme.fromSeed(
      seedColor: primaryTeal,
      primary: primaryTealLight,
      onPrimary: Colors.white,
      primaryContainer: const Color(0xFF004D40),
      onPrimaryContainer: Colors.white,
      secondary: secondaryTeal,
      onSecondary: textPrimaryDark,
      surface: surfaceDark,
      onSurface: textPrimaryDark,
      error: confidenceLowDark,
      onError: Colors.black,
      brightness: Brightness.dark,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: backgroundDark,
      fontFamily: fontFamily,
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF004D40),
        foregroundColor: Colors.white,
        centerTitle: true,
        elevation: 0,
        scrolledUnderElevation: 2,
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
        iconTheme: IconThemeData(color: Colors.white),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surfaceDark,
        selectedItemColor: secondaryTeal,
        unselectedItemColor: textSecondaryDark,
        selectedLabelStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 13,
          fontWeight: FontWeight.bold,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 12,
          fontWeight: FontWeight.normal,
        ),
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primaryTealLight,
        foregroundColor: Colors.white,
        elevation: 4,
        highlightElevation: 8,
      ),
      cardTheme: CardThemeData(
        color: surfaceDark,
        elevation: 1.5,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: dividerDark, width: 1),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surfaceElevated,
        titleTextStyle: const TextStyle(
          fontFamily: fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: textPrimaryDark,
        ),
        contentTextStyle: const TextStyle(
          fontFamily: fontFamily,
          fontSize: 14,
          color: textSecondaryDark,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryTealLight,
          foregroundColor: Colors.white,
          elevation: 2,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: secondaryTeal,
          side: const BorderSide(color: secondaryTeal, width: 1.5),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 26,
          fontWeight: FontWeight.bold,
          color: textPrimaryDark,
        ),
        headlineMedium: TextStyle(
          fontFamily: fontFamily,
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: textPrimaryDark,
        ),
        titleLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: textPrimaryDark,
        ),
        titleMedium: TextStyle(
          fontFamily: fontFamily,
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: textPrimaryDark,
        ),
        bodyLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 15,
          color: textPrimaryDark,
          height: 1.5,
        ),
        bodyMedium: TextStyle(
          fontFamily: fontFamily,
          fontSize: 14,
          color: textSecondaryDark,
          height: 1.4,
        ),
        labelLarge: TextStyle(
          fontFamily: fontFamily,
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: textPrimaryDark,
        ),
      ),
    );
  }
}
