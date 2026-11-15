import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:dalili_app/constants/theme.dart';
import 'package:dalili_app/screens/home_screen.dart';
import 'package:dalili_app/widgets/camera_button.dart';

Widget createTestApp({Widget? child}) {
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

void main() {
  group('HomeScreen Shell Widget Tests', () {
    testWidgets('Renders app title, advisory banner, RTL directionality, and bottom navigation', (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Verify App Bar Title
      expect(find.text('دليلي الدوائي'), findsOneWidget);

      // Verify Slim Advisory Header Banner
      expect(find.text('تنبيه: راجع أسماء الأدوية والجرعات دائماً مع الصيدلي'), findsOneWidget);

      // Verify Bottom Navigation Bar Tabs
      expect(find.text('علبة دواء'), findsOneWidget);
      expect(find.text('روشتة طبية'), findsOneWidget);

      // Verify Prominent Center Camera Button
      expect(find.byType(ProminentCameraButton), findsOneWidget);

      // Verify initial active tab is Medicine Box (Tab 0)
      expect(find.text('قراءة علبة الدواء'), findsOneWidget);
      expect(find.text('نصائح لتصوير مثالي للعلبة'), findsOneWidget);
    });

    testWidgets('Switches to Prescription tab when tapped and shows safety warning note', (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Tap Prescription Tab
      await tester.tap(find.text('روشتة طبية'));
      await tester.pumpAndSettle();

      // Verify Prescription View is active
      expect(find.text('تحليل الروشتة الطبية'), findsOneWidget);
      expect(find.text('نصائح لقراءة دقيقة للروشتة'), findsOneWidget);

      // Verify Orange Safety Warning Note is present
      expect(
        find.text('الأدوية غير المؤكدة أو المقترحة تظهر ببطاقة برتقالية تحذيرية للتأكد منها مع الصيدلي.'),
        findsOneWidget,
      );
    });

    testWidgets('Center camera button opens capture modal with Camera and Gallery choices', (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Tap prominent central camera button
      await tester.tap(find.byType(ProminentCameraButton));
      await tester.pumpAndSettle();

      // Verify bottom sheet appears with choices
      expect(find.text('قراءة علبة دواء'), findsOneWidget);
      expect(find.text('التقاط صورة بالكاميرا'), findsOneWidget);
      expect(find.text('اختيار صورة من المعرض'), findsOneWidget);

      // Tap camera choice and verify action
      await tester.tap(find.text('التقاط صورة بالكاميرا'));
      await tester.pumpAndSettle();

      // Bottom sheet is dismissed and snackbar feedback shown
      expect(find.text('التقاط صورة بالكاميرا'), findsNothing);
      expect(find.byType(SnackBar), findsOneWidget);
    });

    testWidgets('Strictly excludes non-Phase-1 features (voice/read-aloud, history, saved lists, settings, font toggles)', (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Strictly no voice / read-aloud buttons or audio icons
      expect(find.byIcon(Icons.volume_up), findsNothing);
      expect(find.byIcon(Icons.record_voice_over), findsNothing);
      expect(find.byIcon(Icons.play_arrow), findsNothing);

      // Strictly no history or saved lists tabs/icons
      expect(find.text('السجل'), findsNothing);
      expect(find.text('أدويتي'), findsNothing);
      expect(find.text('المحفوظات'), findsNothing);
      expect(find.byIcon(Icons.history), findsNothing);

      // Strictly no settings modal or font size toggle (Aa)
      expect(find.byIcon(Icons.settings), findsNothing);
      expect(find.text('Aa'), findsNothing);
      expect(find.text('الإعدادات'), findsNothing);
    });
  });
}
