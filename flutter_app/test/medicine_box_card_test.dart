import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:dalili_app/constants/theme.dart';
import 'package:dalili_app/models/medicine_box.dart';
import 'package:dalili_app/widgets/medicine_box_card.dart';

Widget createCardTestApp({required Widget child}) {
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
  group('MedicineBoxCard Widget Tests', () {
    const testAnalysis = MedicineBoxAnalysis(
      isClear: true,
      confidence: 'high',
      evidenceText: 'Panadol Extra Paracetamol 500mg',
      medicineNameAr: 'بنادول إكسترا',
      medicineNameEn: 'Panadol Extra',
      activeIngredient: 'باراسيتامول 500 ملغ + كافيين 65 ملغ',
      uses: [
        'تسكين آلام الصداع والأسنان',
        'تخفيض درجة الحرارة عند الحمى',
      ],
      howAndWhen: [
        'قرص إلى قرصين كل 4 إلى 6 ساعات حسب الحاجة',
        'يفضل بعد الأكل مع كوب ماء كامل',
      ],
      usageSource: 'printed',
      warnings: [
        'لا تتجاوز 8 أقراص يومياً لتجنب الإضرار بالكبد',
        'استشر الصيدلي إذا استمرت الأعراض',
      ],
      audioSummary: 'بنادول إكسترا لتسكين الآلام',
    );

    testWidgets('Renders Arabic and English medicine names and active ingredient chip', (WidgetTester tester) async {
      await tester.pumpWidget(
        createCardTestApp(
          child: const MedicineBoxCard(analysis: testAnalysis),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('بنادول إكسترا'), findsOneWidget);
      expect(find.text('Panadol Extra'), findsOneWidget);
      expect(find.text('المادة الفعالة: باراسيتامول 500 ملغ + كافيين 65 ملغ'), findsOneWidget);
    });

    testWidgets('Renders all uses, how and when instructions, and warnings', (WidgetTester tester) async {
      await tester.pumpWidget(
        createCardTestApp(
          child: const MedicineBoxCard(analysis: testAnalysis),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('دواعي الاستعمال'), findsOneWidget);
      expect(find.text('تسكين آلام الصداع والأسنان'), findsOneWidget);
      expect(find.text('تخفيض درجة الحرارة عند الحمى'), findsOneWidget);

      expect(find.text('طريقة ومواعيد الاستخدام'), findsOneWidget);
      expect(find.text('قرص إلى قرصين كل 4 إلى 6 ساعات حسب الحاجة'), findsOneWidget);

      expect(find.text('تحذيرات واحتياطات هامة'), findsOneWidget);
      expect(find.text('لا تتجاوز 8 أقراص يومياً لتجنب الإضرار بالكبد'), findsOneWidget);
    });

    testWidgets('New scan action button fires onNewScan callback', (WidgetTester tester) async {
      bool newScanTapped = false;
      await tester.pumpWidget(
        createCardTestApp(
          child: MedicineBoxCard(
            analysis: testAnalysis,
            onNewScan: () {
              newScanTapped = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      final newScanBtn = find.text('تحليل علبة جديدة');
      expect(newScanBtn, findsOneWidget);
      await tester.ensureVisible(newScanBtn);
      await tester.pumpAndSettle();
      await tester.tap(newScanBtn);
      await tester.pumpAndSettle();

      expect(newScanTapped, true);
    });

    testWidgets('Negative assertion: Zero audio/TTS, history, settings, or font toggles', (WidgetTester tester) async {
      await tester.pumpWidget(
        createCardTestApp(
          child: const MedicineBoxCard(analysis: testAnalysis),
        ),
      );
      await tester.pumpAndSettle();

      // Audio / TTS negative check
      expect(find.byIcon(Icons.volume_up), findsNothing);
      expect(find.byIcon(Icons.record_voice_over), findsNothing);
      expect(find.byIcon(Icons.play_arrow), findsNothing);

      // History & saved negative check
      expect(find.byIcon(Icons.history), findsNothing);
      expect(find.byIcon(Icons.bookmark), findsNothing);

      // Settings & font toggle negative check
      expect(find.byIcon(Icons.settings), findsNothing);
      expect(find.text('Aa'), findsNothing);
    });

    testWidgets('Gracefully handles empty optional fields', (WidgetTester tester) async {
      const emptyBox = MedicineBoxAnalysis(
        isClear: true,
        confidence: 'low',
        medicineNameAr: '',
        medicineNameEn: '',
        activeIngredient: '',
        uses: [],
        howAndWhen: [],
        warnings: [],
        evidenceText: '',
      );

      await tester.pumpWidget(
        createCardTestApp(
          child: const MedicineBoxCard(analysis: emptyBox),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('اسم الدواء غير محدد'), findsOneWidget);
      expect(find.text('دقة قراءة منخفضة'), findsOneWidget);
      expect(find.text('دواعي الاستعمال'), findsNothing);
      expect(find.text('تحذيرات واحتياطات هامة'), findsNothing);
    });
  });
}
