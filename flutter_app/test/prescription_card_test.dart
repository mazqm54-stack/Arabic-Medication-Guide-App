import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:dalili_app/constants/theme.dart';
import 'package:dalili_app/models/prescription.dart';
import 'package:dalili_app/models/medicine_box.dart';
import 'package:dalili_app/services/api_service.dart';
import 'package:dalili_app/widgets/prescription_card.dart';

class MockDetailsApiService extends ApiService {
  MockDetailsApiService() : super(isFixtureMode: true);

  @override
  Future<MedicineBoxAnalysis> getMedicineDetails(String medicineName) async {
    return const MedicineBoxAnalysis(
      isClear: true,
      confidence: 'high',
      medicineNameAr: 'أوجمنتين',
      medicineNameEn: 'Augmentin',
      activeIngredient: 'أموكسيسيلين + كلافولانات',
      uses: ['علاج الالتهابات البكتيرية', 'التهاب الجهاز التنفسي'],
      howToUse: ['تناول القرص مع كوب كامل من الماء', 'يفضل تناوله بعد الطعام'],
      whenToTake: ['قرص كل 12 ساعة', 'لمدة 7 أيام'],
    );
  }
}

Widget createRxTestApp({required Widget child}) {
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
  group('PrescriptionCard & View Widget Tests', () {
    const testAnalysis = PrescriptionAnalysis(
      isClear: true,
      confidence: 'high',
      deducedCondition: 'التهاب حاد بالجهاز التنفسي',
      items: [
        PrescriptionItem(
          lineTextAsWritten: 'Augmentin 1g tab 1x2',
          isConfirmed: true,
          status: 'confirmed',
          medicineNameAr: 'أوجمنتين 1 غرام',
          medicineNameEn: 'Augmentin 1g',
          activeIngredient: 'أموكسيسيلين + كلافولانات',
          confidence: 'high',
          writtenInstructions: 'قرص كل 12 ساعة بعد الطعام لمدة 7 أيام',
          shortExplanation: 'مضاد حيوي واسع المجال لعلاج الالتهابات البكتيرية',
        ),
        PrescriptionItem(
          lineTextAsWritten: 'C...fl... 50',
          isConfirmed: false,
          status: 'suggested',
          medicineNameAr: 'كاتافلام 50 ملغ',
          medicineNameEn: 'Cataflam 50mg',
          activeIngredient: 'ديكلوفيناك بوتاسيوم',
          confidence: 'medium',
          writtenInstructions: '',
          shortExplanation: '',
          visibleLetters: 'C...fl...',
          suggestedMedicines: [
            SuggestedMedicine(
              nameAr: 'كاتافلام 50 ملغ',
              nameEn: 'Cataflam 50mg',
              confidence: 'medium',
            ),
          ],
        ),
      ],
      audioSummary: 'روشتة طبية',
    );

    testWidgets('Renders clinical condition banner when deducedCondition is present', (WidgetTester tester) async {
      await tester.pumpWidget(
        createRxTestApp(
          child: const PrescriptionView(analysis: testAnalysis),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('التشخيص الطبي المستنتج'), findsOneWidget);
      expect(find.text('التهاب حاد بالجهاز التنفسي'), findsOneWidget);
    });

    testWidgets('Prescription cards have unified minimal style with generic & brand names', (WidgetTester tester) async {
      await tester.pumpWidget(
        createRxTestApp(
          child: const PrescriptionView(analysis: testAnalysis),
        ),
      );
      await tester.pumpAndSettle();

      // Card 1
      expect(find.text('أوجمنتين 1 غرام'), findsOneWidget);
      expect(find.text('الاسم العلمي: أموكسيسيلين + كلافولانات'), findsOneWidget);
      expect(find.text('ثقة مرتفعة'), findsOneWidget);

      // Card 2
      expect(find.text('كاتافلام 50 ملغ'), findsOneWidget);
      expect(find.text('الاسم العلمي: ديكلوفيناك بوتاسيوم'), findsOneWidget);
      expect(find.text('ثقة متوسطة'), findsOneWidget);

      // Card text is minimal (details loaded on demand, not in main card)
      expect(find.text('عرض التفاصيل'), findsNWidgets(2));
    });

    testWidgets('Tapping card opens bottom sheet with separated details sections', (WidgetTester tester) async {
      final mockApi = MockDetailsApiService();

      await tester.pumpWidget(
        createRxTestApp(
          child: PrescriptionView(
            analysis: testAnalysis,
            apiService: mockApi,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap first card
      final firstCard = find.text('أوجمنتين 1 غرام');
      await tester.tap(firstCard);
      await tester.pumpAndSettle();

      // Details Sheet opens with separated sections
      expect(find.text('تفاصيل الدواء'), findsOneWidget);
      expect(find.text('الاسم العلمي (المادة الفعالة)'), findsOneWidget);
      expect(find.text('الاسم التجاري'), findsOneWidget);
      expect(find.text('دواعي الاستعمال'), findsOneWidget);
      expect(find.text('كيفية الاستخدام'), findsOneWidget);
      expect(find.text('أوقات الاستخدام'), findsOneWidget);

      // Content inside sheet
      expect(find.text('علاج الالتهابات البكتيرية'), findsOneWidget);
      expect(find.text('تناول القرص مع كوب كامل من الماء'), findsOneWidget);
      expect(find.text('قرص كل 12 ساعة'), findsOneWidget);
    });

    testWidgets('New scan button triggers onNewScan callback', (WidgetTester tester) async {
      bool newScanTapped = false;
      await tester.pumpWidget(
        createRxTestApp(
          child: PrescriptionView(
            analysis: testAnalysis,
            onNewScan: () {
              newScanTapped = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      final newScanBtn = find.text('تحليل روشتة جديدة');
      expect(newScanBtn, findsOneWidget);
      await tester.ensureVisible(newScanBtn);
      await tester.pumpAndSettle();
      await tester.tap(newScanBtn);
      await tester.pumpAndSettle();

      expect(newScanTapped, true);
    });

    testWidgets('Negative assertion: Zero audio/TTS, history, settings, or font toggles', (WidgetTester tester) async {
      await tester.pumpWidget(
        createRxTestApp(
          child: const PrescriptionView(analysis: testAnalysis),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.volume_up), findsNothing);
      expect(find.byIcon(Icons.record_voice_over), findsNothing);
      expect(find.byIcon(Icons.history), findsNothing);
      expect(find.byIcon(Icons.settings), findsNothing);
    });
  });
}
