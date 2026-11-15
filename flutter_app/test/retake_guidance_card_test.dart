import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:dalili_app/constants/theme.dart';
import 'package:dalili_app/widgets/retake_guidance_card.dart';

Widget createRetakeTestApp({required Widget child}) {
  return MaterialApp(
    theme: AppTheme.lightTheme,
    locale: const Locale('ar', 'SA'),
    supportedLocales: const [Locale('ar', 'SA'), Locale('ar')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: Scaffold(
      body: SingleChildScrollView(child: child),
    ),
  );
}

void main() {
  group('RetakeGuidanceCard Widget Tests', () {
    testWidgets('Renders headline, retake message, and all 3 required guidance points', (WidgetTester tester) async {
      await tester.pumpWidget(
        createRetakeTestApp(
          child: RetakeGuidanceCard(
            retakeMessage: 'الصورة مهتزة وغير واضحة.',
            onRetake: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('نحتاج صورة أكثر وضوحاً'), findsOneWidget);
      expect(find.text('الصورة مهتزة وغير واضحة.'), findsOneWidget);

      // Verify the 3 mandatory guidance points
      expect(find.textContaining('إضاءة جيدة بدون ظلال أو لمعان قوي'), findsOneWidget);
      expect(find.textContaining('تصوير العلبة أو الروشتة كاملة داخل الإطار'), findsOneWidget);
      expect(find.textContaining('تثبيت الهاتف بوضوح لتجنب الاهتزاز'), findsOneWidget);
    });

    testWidgets('Tapping primary retake button fires onRetake callback', (WidgetTester tester) async {
      bool retakeTapped = false;
      await tester.pumpWidget(
        createRetakeTestApp(
          child: RetakeGuidanceCard(
            onRetake: () {
              retakeTapped = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('إعادة التقاط الصورة الآن'), findsOneWidget);
      await tester.tap(find.text('إعادة التقاط الصورة الآن'));
      await tester.pumpAndSettle();

      expect(retakeTapped, true);
    });

    testWidgets('Optional gallery button renders and triggers onPickGallery callback', (WidgetTester tester) async {
      bool galleryTapped = false;
      await tester.pumpWidget(
        createRetakeTestApp(
          child: RetakeGuidanceCard(
            onRetake: () {},
            onPickGallery: () {
              galleryTapped = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('اختيار صورة من المعرض'), findsOneWidget);
      await tester.tap(find.text('اختيار صورة من المعرض'));
      await tester.pumpAndSettle();

      expect(galleryTapped, true);
    });

    testWidgets('Negative assertion: Zero audio/TTS, history, settings, or font toggles', (WidgetTester tester) async {
      await tester.pumpWidget(
        createRetakeTestApp(
          child: RetakeGuidanceCard(onRetake: () {}),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.volume_up), findsNothing);
      expect(find.byIcon(Icons.history), findsNothing);
      expect(find.byIcon(Icons.settings), findsNothing);
    });
  });
}
