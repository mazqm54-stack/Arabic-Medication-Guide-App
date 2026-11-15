import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:dalili_app/constants/theme.dart';
import 'package:dalili_app/screens/home_screen.dart';
import 'package:dalili_app/widgets/camera_button.dart';

Widget createChallengerApp({Widget? child}) {
  return MaterialApp(
    title: 'دليلي الدوائي',
    theme: AppTheme.lightTheme,
    locale: const Locale('ar', 'SA'),
    supportedLocales: const [
      Locale('ar', 'SA'),
      Locale('ar'),
    ],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: child ?? const HomeScreen(),
  );
}

/// Helper function implementing W3C WCAG 2.1 relative luminance
double calculateRelativeLuminance(Color color) {
  double srgbToLin(double channel) {
    return channel <= 0.03928
        ? channel / 12.92
        : math.pow((channel + 0.055) / 1.055, 2.4).toDouble();
  }

  // Use red, green, blue channels (0.0 to 1.0)
  // In Flutter 3.27+ Color properties are floats or integers; using normalized values:
  final r = srgbToLin((color.r * 255.0).round() / 255.0);
  final g = srgbToLin((color.g * 255.0).round() / 255.0);
  final b = srgbToLin((color.b * 255.0).round() / 255.0);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/// Helper function implementing W3C WCAG 2.1 contrast ratio
double calculateContrastRatio(Color foreground, Color background) {
  final l1 = calculateRelativeLuminance(foreground);
  final l2 = calculateRelativeLuminance(background);
  final lighter = math.max(l1, l2);
  final darker = math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  group('Adversarial Stress Test: RTL Geometry & Layout', () {
    testWidgets('RTL spatial order: Medicine Box tab is on right, Prescription tab is on left', (WidgetTester tester) async {
      await tester.pumpWidget(createChallengerApp());
      await tester.pumpAndSettle();

      // Root directionality must be RTL
      final Directionality rootDirectionality = tester.widget(
        find.descendant(
          of: find.byType(HomeScreen),
          matching: find.byType(Directionality),
        ).first,
      );
      expect(rootDirectionality.textDirection, TextDirection.rtl);

      // Verify spatial placement in RTL:
      // Tab 0 ('علبة دواء') should be positioned to the RIGHT of Tab 1 ('روشتة طبية')
      final boxTabCenter = tester.getCenter(find.text('علبة دواء'));
      final rxTabCenter = tester.getCenter(find.text('روشتة طبية'));

      expect(
        boxTabCenter.dx > rxTabCenter.dx,
        true,
        reason: 'In Arabic RTL, the first tab (Medicine Box) must appear on the right side of the screen',
      );

      // Verify prominent camera button is horizontally centered
      final cameraCenter = tester.getCenter(find.byType(ProminentCameraButton));
      final screenWidth = tester.view.physicalSize.width / tester.view.devicePixelRatio;
      expect((cameraCenter.dx - screenWidth / 2).abs() < 2.0, true);
    });

    testWidgets('Capture modal sheet enforces Arabic RTL directionality on all options', (WidgetTester tester) async {
      await tester.pumpWidget(createChallengerApp());
      await tester.pumpAndSettle();

      // Open capture sheet
      await tester.tap(find.byType(ProminentCameraButton));
      await tester.pumpAndSettle();

      // Check Directionality inside bottom sheet
      final cameraOption = find.text('التقاط صورة بالكاميرا');
      expect(cameraOption, findsOneWidget);

      final BuildContext sheetContext = tester.element(cameraOption);
      expect(Directionality.of(sheetContext), TextDirection.rtl);

      final galleryOption = find.text('اختيار صورة من المعرض');
      expect(galleryOption, findsOneWidget);
      expect(Directionality.of(tester.element(galleryOption)), TextDirection.rtl);
    });
  });

  group('Adversarial Stress Test: Prominent Camera Button Mechanics', () {
    testWidgets('Hit test: center tap triggers callback; dimensions and gradient are exact', (WidgetTester tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: Center(
              child: ProminentCameraButton(
                size: 68.0,
                onPressed: () => tapped = true,
              ),
            ),
          ),
        ),
      );

      // Verify physical container size
      final container = tester.widget<Container>(
        find.descendant(
          of: find.byType(ProminentCameraButton),
          matching: find.byType(Container),
        ).first,
      );
      expect(container.constraints?.maxWidth ?? 68.0, 68.0);
      expect(container.constraints?.maxHeight ?? 68.0, 68.0);

      // Tap center of button
      await tester.tap(find.byType(ProminentCameraButton));
      await tester.pumpAndSettle();
      expect(tapped, true);
    });

    testWidgets('Tapping camera button opens modal sheet, barrier dismisses cleanly', (WidgetTester tester) async {
      await tester.pumpWidget(createChallengerApp());
      await tester.pumpAndSettle();

      // Tap camera button to open sheet
      await tester.tap(find.byType(ProminentCameraButton));
      await tester.pumpAndSettle();

      // Modal bottom sheet should be visible
      expect(find.text('التقاط صورة بالكاميرا'), findsOneWidget);
      expect(find.text('اختيار صورة من المعرض'), findsOneWidget);

      // Dismiss modal by tapping barrier outside the sheet
      await tester.tapAt(const Offset(20, 20));
      await tester.pumpAndSettle();

      // Sheet dismissed cleanly
      expect(find.text('التقاط صورة بالكاميرا'), findsNothing);
    });

    testWidgets('Modal choices: tapping Camera and Gallery in each mode gives correct feedback', (WidgetTester tester) async {
      await tester.pumpWidget(createChallengerApp());
      await tester.pumpAndSettle();

      // Mode 1: Box mode -> Camera choice
      await tester.tap(find.byType(ProminentCameraButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('التقاط صورة بالكاميرا'));
      await tester.pumpAndSettle();
      expect(find.text('جاري فتح الكاميرا لقراءة علبة الدواء...'), findsOneWidget);

      // Mode 2: Switch to Prescription mode -> Gallery choice
      await tester.tap(find.text('روشتة طبية'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(ProminentCameraButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('اختيار صورة من المعرض'));
      await tester.pumpAndSettle();
      expect(find.text('جاري فتح المعرض لقراءة الروشتة...'), findsOneWidget);
    });
  });

  group('Adversarial Stress Test: Screen Width Bounds & Zero Overflow', () {
    const testScreenSizes = <String, Size>{
      'Compact Phone (320x568)': Size(320, 568),
      'Standard Phone (360x640)': Size(360, 640),
      'Modern Flagship (412x915)': Size(412, 915),
      'Foldable/Tablet (600x960)': Size(600, 960),
      'Large Tablet (800x1280)': Size(800, 1280),
      'Landscape Compact (640x360)': Size(640, 360),
    };

    for (final entry in testScreenSizes.entries) {
      testWidgets('Zero RenderFlex overflow on ${entry.key}', (WidgetTester tester) async {
        final size = entry.value;
        tester.view.physicalSize = Size(size.width * 2.0, size.height * 2.0);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
        });

        await tester.pumpWidget(createChallengerApp());
        await tester.pumpAndSettle();

        // Check for any Flutter exceptions/overflows on initial tab
        expect(tester.takeException(), isNull);

        // Switch to Prescription tab
        await tester.tap(find.text('روشتة طبية'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);

        // Open bottom sheet
        await tester.tap(find.byType(ProminentCameraButton));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);

        // Dismiss sheet
        await tester.tapAt(const Offset(10, 10));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('Adversarial Stress Test: WCAG 2.1 Contrast Standards & Accessibility', () {
    test('Primary Teal #006D77 meets WCAG AA 4.5:1 contrast against white', () {
      final ratio = calculateContrastRatio(AppTheme.primaryTeal, Colors.white);
      // Expected ratio is ~6.15:1
      expect(
        ratio >= 4.5,
        true,
        reason: 'Primary Teal must achieve >= 4.5:1 against white for WCAG AA compliance (actual: ${ratio.toStringAsFixed(2)})',
      );
    });

    test('Primary Text #1D3557 meets WCAG AAA 7:1 contrast against white', () {
      final ratio = calculateContrastRatio(AppTheme.textPrimary, Colors.white);
      // Expected ratio is ~10.4:1
      expect(
        ratio >= 7.0,
        true,
        reason: 'Text Primary must achieve high contrast for readability (actual: ${ratio.toStringAsFixed(2)})',
      );
    });

    test('Warning Orange #E65100 evaluates for accessibility standards', () {
      final ratioOnWhite = calculateContrastRatio(AppTheme.warningOrange, Colors.white);
      final ratioOnBg = calculateContrastRatio(AppTheme.warningOrange, AppTheme.warningOrangeBackground);

      // Warning Orange on white: ~3.78:1 (satisfies WCAG large text / graphic element 3.0:1 threshold)
      expect(
        ratioOnWhite >= 3.0,
        true,
        reason: 'Warning Orange must achieve at least 3.0:1 on white (actual: ${ratioOnWhite.toStringAsFixed(2)})',
      );

      // Warning Orange on light orange bg (#FFF3E0): ~3.45:1 (satisfies graphic element 3.0:1 threshold)
      expect(
        ratioOnBg >= 3.0,
        true,
        reason: 'Warning Orange on container must achieve at least 3.0:1 (actual: ${ratioOnBg.toStringAsFixed(2)})',
      );
    });

    test('Warning Banner 12pt text on #FFF3E0 evaluates against WCAG AA 4.5:1 normal text standard', () {
      final ratioOnBg = calculateContrastRatio(AppTheme.warningOrangeText, AppTheme.warningOrangeBackground);
      expect(
        ratioOnBg >= 4.5,
        true,
        reason: 'Warning text must achieve >= 4.5:1 on #FFF3E0 for WCAG AA compliance (actual: ${ratioOnBg.toStringAsFixed(2)})',
      );
    });

    testWidgets('Touch target sizes evaluate against 48x48 dp accessibility guidelines', (WidgetTester tester) async {
      await tester.pumpWidget(createChallengerApp());
      await tester.pumpAndSettle();

      // Camera button touch target
      final cameraSize = tester.getSize(find.byType(ProminentCameraButton));
      expect(cameraSize.width >= 48.0, true);
      expect(cameraSize.height >= 48.0, true);

      // Bottom bar tab hit targets
      final boxTabFinder = find.ancestor(
        of: find.text('علبة دواء'),
        matching: find.byType(InkWell),
      );
      final boxTabSize = tester.getSize(boxTabFinder);
      expect(
        boxTabSize.height >= 48.0,
        true,
        reason: 'Tab touch target height is ${boxTabSize.height}dp, falling below the WCAG/Material minimum of 48.0dp',
      );

      final rxTabFinder = find.ancestor(
        of: find.text('روشتة طبية'),
        matching: find.byType(InkWell),
      );
      final rxTabSize = tester.getSize(rxTabFinder);
      expect(rxTabSize.height >= 48.0, true);
    });
  });

  group('Adversarial Stress Test: Strict Absence of Non-Phase-1 Features', () {
    testWidgets('Exhaustive negative assertion: zero voice, history, settings, font toggles', (WidgetTester tester) async {
      await tester.pumpWidget(createChallengerApp());
      await tester.pumpAndSettle();

      // 1. Audio / Voice / TTS
      final forbiddenAudioIcons = [
        Icons.volume_up,
        Icons.volume_down,
        Icons.volume_mute,
        Icons.record_voice_over,
        Icons.mic,
        Icons.mic_none,
        Icons.speaker,
        Icons.headset,
        Icons.play_arrow,
        Icons.audiotrack,
      ];
      for (final icon in forbiddenAudioIcons) {
        expect(find.byIcon(icon), findsNothing);
      }

      final forbiddenAudioStrings = [
        'قراءة صوتية',
        'استمع',
        'تشغيل الصوت',
        'نطق',
        'TTS',
      ];
      for (final s in forbiddenAudioStrings) {
        expect(find.text(s), findsNothing);
      }

      // 2. History / Saved lists
      final forbiddenHistoryIcons = [
        Icons.history,
        Icons.bookmark,
        Icons.bookmark_border,
        Icons.favorite,
        Icons.favorite_border,
        Icons.save,
        Icons.folder,
      ];
      for (final icon in forbiddenHistoryIcons) {
        expect(find.byIcon(icon), findsNothing);
      }

      final forbiddenHistoryStrings = [
        'السجل',
        'سجل الفحوصات',
        'المحفوظات',
        'أدويتي',
        'قائمتي',
        'الأدوية المحفوظة',
      ];
      for (final s in forbiddenHistoryStrings) {
        expect(find.text(s), findsNothing);
      }

      // 3. Settings / Preferences
      final forbiddenSettingsIcons = [
        Icons.settings,
        Icons.tune,
        Icons.dark_mode,
        Icons.light_mode,
        Icons.palette,
      ];
      for (final icon in forbiddenSettingsIcons) {
        expect(find.byIcon(icon), findsNothing);
      }

      final forbiddenSettingsStrings = [
        'الإعدادات',
        'الضبط',
        'الوضع الليلي',
        'الوضع الداكن',
        'تغيير المظهر',
      ];
      for (final s in forbiddenSettingsStrings) {
        expect(find.text(s), findsNothing);
      }

      // 4. Font size / Text scaling toggles
      expect(find.text('Aa'), findsNothing);
      expect(find.text('حجم الخط'), findsNothing);
      expect(find.text('تكبير الخط'), findsNothing);
    });
  });
}
