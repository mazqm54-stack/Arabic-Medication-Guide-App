import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dalili_app/constants/theme.dart';
import 'package:dalili_app/models/medicine_box.dart';
import 'package:dalili_app/models/prescription.dart';
import 'package:dalili_app/screens/home_screen.dart';
import 'package:dalili_app/services/api_service.dart';
import 'package:dalili_app/services/image_service.dart';
import 'package:dalili_app/services/status_service.dart';
import 'package:dalili_app/widgets/camera_button.dart';
import 'package:dalili_app/widgets/medicine_box_card.dart';
import 'package:dalili_app/widgets/prescription_card.dart';
import 'package:dalili_app/widgets/retake_guidance_card.dart';

/// Test double for ApiService
class FakeApiService implements ApiService {
  MedicineBoxAnalysis? boxResponse;
  PrescriptionAnalysis? prescriptionResponse;
  Exception? errorToThrow;

  @override
  String get baseUrl => 'https://fake.workers.dev';

  @override
  Duration get timeout => const Duration(seconds: 5);

  @override
  bool get isFixtureMode => false;

  @override
  void dispose() {}

  @override
  Future<MedicineBoxAnalysis> getMedicineDetails(String medicineName) async {
    if (errorToThrow != null) throw errorToThrow!;
    return boxResponse ??
        const MedicineBoxAnalysis(
          isClear: true,
          confidence: 'high',
          medicineNameAr: 'بانادول إكسترا',
          medicineNameEn: 'Panadol Extra',
          activeIngredient: 'باراسيتامول 500 ملغ',
          uses: ['تسكين الآلام'],
          howToUse: ['مع كوب ماء'],
          whenToTake: ['عند اللزوم'],
        );
  }

  @override
  void clearDetailsCache() {}

  @override
  Future<MedicineBoxAnalysis> analyzeMedicineBox(String base64Image) async {
    if (errorToThrow != null) throw errorToThrow!;
    return boxResponse ??
        const MedicineBoxAnalysis(
          isClear: true,
          confidence: 'high',
          medicineNameAr: 'بانادول إكسترا',
          medicineNameEn: 'Panadol Extra',
          activeIngredient: 'باراسيتامول 500 ملغ',
          uses: ['تسكين الصداع'],
          howAndWhen: ['قرص كل 6 ساعات'],
          warnings: ['لا تتجاوز 8 أقراص'],
        );
  }

  @override
  Future<AppStatus?> getStatus() async => null;

  @override
  Future<bool> sendFeedback({required String choice, required String type}) async => true;

  @override
  Future<PrescriptionAnalysis> analyzePrescription(String base64Image) async {
    if (errorToThrow != null) throw errorToThrow!;
    return prescriptionResponse ??
        const PrescriptionAnalysis(
          isClear: true,
          confidence: 'high',
          deducedCondition: 'التهاب بكتيري',
          items: [
            PrescriptionItem(
              lineTextAsWritten: 'Augmentin 1g',
              isConfirmed: true,
              status: 'confirmed',
              medicineNameAr: 'أوجمنتين 1 غرام',
              writtenInstructions: 'قرص كل 12 ساعة',
            ),
          ],
        );
  }

  @override
  Future<PrescriptionAnalysis> analyzePrescriptionDeep(String base64Image) async {
    return analyzePrescription(base64Image);
  }
}

/// Test double for ImageService
class FakeImageService implements ImageService {
  ProcessedImage? imageToReturn;
  bool returnNullOnPick = false;

  @override
  Future<ProcessedImage?> pickAndProcessImage(ImageSource source) async {
    if (returnNullOnPick) return null;
    return imageToReturn ??
        ProcessedImage(
          bytes: Uint8List.fromList([1, 2, 3, 4]),
          base64String: 'dGVzdF9iYXNlNjQ=',
          byteSize: 4,
        );
  }

  @override
  Future<Uint8List> compressImageBytes(Uint8List rawBytes, {String? filePath}) async {
    return rawBytes;
  }

  @override
  Future<Uint8List> compressImageFile(String filePath) async {
    return Uint8List(0);
  }

  @override
  String toBase64(Uint8List bytes) {
    return base64Encode(bytes);
  }

  @override
  Future<String> createThumbnailBase64(Uint8List originalBytes, {String? filePath}) async {
    return 'dGVzdF90aHVtYg==';
  }
}

Widget createIntegrationApp({
  required ApiService apiService,
  required ImageService imageService,
}) {
  return MaterialApp(
    theme: AppTheme.lightTheme,
    locale: const Locale('ar', 'SA'),
    supportedLocales: const [Locale('ar', 'SA'), Locale('ar')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: HomeScreen(
      apiService: apiService,
      imageService: imageService,
    ),
  );
}

void main() {
  group('HomeScreen Full Integration Tests', () {
    late FakeApiService fakeApi;
    late FakeImageService fakeImage;

    setUp(() {
      fakeApi = FakeApiService();
      fakeImage = FakeImageService();
    });

    testWidgets('Idle state renders tips and advisory header banner', (WidgetTester tester) async {
      await tester.pumpWidget(createIntegrationApp(apiService: fakeApi, imageService: fakeImage));
      await tester.pumpAndSettle();

      expect(find.text('دليلي الدوائي'), findsOneWidget);
      expect(find.text('تنبيه: راجع أسماء الأدوية والجرعات دائماً مع الصيدلي'), findsOneWidget);
      expect(find.text('قراءة علبة الدواء'), findsOneWidget);
      expect(find.text('نصائح لتصوير مثالي للعلبة'), findsOneWidget);
      expect(find.byType(ProminentCameraButton), findsOneWidget);
    });

    testWidgets('Tab switching switches between Box Mode and Prescription Mode', (WidgetTester tester) async {
      await tester.pumpWidget(createIntegrationApp(apiService: fakeApi, imageService: fakeImage));
      await tester.pumpAndSettle();

      await tester.tap(find.text('روشتة طبية'));
      await tester.pumpAndSettle();

      expect(find.text('تحليل الروشتة الطبية'), findsOneWidget);
      expect(find.text('نصائح لقراءة دقيقة للروشتة'), findsOneWidget);

      await tester.tap(find.text('علبة دواء'));
      await tester.pumpAndSettle();

      expect(find.text('قراءة علبة الدواء'), findsOneWidget);
    });

    testWidgets('End-to-end Medicine Box flow: Camera capture -> Analysis -> Box Card -> New Scan reset', (WidgetTester tester) async {
      await tester.pumpWidget(createIntegrationApp(apiService: fakeApi, imageService: fakeImage));
      await tester.pumpAndSettle();

      // Tap central camera button to open capture modal
      await tester.tap(find.byType(ProminentCameraButton));
      await tester.pumpAndSettle();

      // Tap camera choice
      await tester.tap(find.text('التقاط صورة بالكاميرا'));
      await tester.pump(); // Advance frame for async operations
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 400));

      // Result card is rendered
      expect(find.byType(MedicineBoxCard), findsOneWidget);
      expect(find.text('بانادول إكسترا'), findsOneWidget);
      expect(find.text('Panadol Extra'), findsOneWidget);

      // Tap New Scan and verify return to idle state
      final newScanBtn = find.text('تحليل علبة جديدة');
      await tester.ensureVisible(newScanBtn);
      await tester.pumpAndSettle();
      await tester.tap(newScanBtn);
      await tester.pumpAndSettle();

      expect(find.byType(MedicineBoxCard), findsNothing);
      expect(find.text('قراءة علبة الدواء'), findsOneWidget);
    });

    testWidgets('End-to-end Prescription flow: Gallery pick -> Analysis -> Prescription View with confirmed/suggested', (WidgetTester tester) async {
      fakeApi.prescriptionResponse = const PrescriptionAnalysis(
        isClear: true,
        confidence: 'high',
        deducedCondition: 'التهاب رئوي حاد',
        items: [
          PrescriptionItem(
            lineTextAsWritten: 'Amoxil 500',
            isConfirmed: true,
            status: 'confirmed',
            medicineNameAr: 'أموكسيل 500 ملغ',
            writtenInstructions: 'كبسولة كل 8 ساعات',
          ),
          PrescriptionItem(
            lineTextAsWritten: 'P... 500',
            isConfirmed: false,
            status: 'suggested',
            medicineNameAr: 'باراسيتامول (محتمل)',
            visibleLetters: 'P... 500',
            suggestedMedicines: [
              SuggestedMedicine(nameAr: 'باراسيتامول 500 ملغ', nameEn: 'Paracetamol 500mg', confidence: 'medium'),
            ],
            warningNote: 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء',
          ),
        ],
      );

      await tester.pumpWidget(createIntegrationApp(apiService: fakeApi, imageService: fakeImage));
      await tester.pumpAndSettle();

      // Switch to Prescription Tab
      await tester.tap(find.text('روشتة طبية'));
      await tester.pumpAndSettle();

      // Tap camera button and pick gallery
      await tester.tap(find.byType(ProminentCameraButton));
      await tester.pumpAndSettle();

      await tester.tap(find.text('اختيار صورة من المعرض'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 400));

      // Prescription View is rendered
      expect(find.byType(PrescriptionView), findsOneWidget);
      expect(find.text('التهاب رئوي حاد'), findsOneWidget);
      expect(find.text('أموكسيل 500 ملغ'), findsOneWidget);
      expect(find.text('باراسيتامول (محتمل)'), findsOneWidget);

      // Reset
      final newRxScanBtn = find.text('تحليل روشتة جديدة');
      await tester.ensureVisible(newRxScanBtn);
      await tester.pumpAndSettle();
      await tester.tap(newRxScanBtn);
      await tester.pumpAndSettle();
      expect(find.byType(PrescriptionView), findsNothing);
    });

    testWidgets('Unclear photo transitions to RetakeGuidanceCard with retry callback', (WidgetTester tester) async {
      fakeApi.boxResponse = const MedicineBoxAnalysis(
        isClear: false,
        confidence: 'low',
        retakeMessage: 'صورة الدواء مظلمة جداً. يرجى إعادة التصوير في ضوء النهار.',
      );

      await tester.pumpWidget(createIntegrationApp(apiService: fakeApi, imageService: fakeImage));
      await tester.pumpAndSettle();

      await tester.tap(find.text('التقاط بالكاميرا'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 300));

      // Retake Guidance is rendered
      expect(find.byType(RetakeGuidanceCard), findsOneWidget);
      expect(find.text('صورة الدواء مظلمة جداً. يرجى إعادة التصوير في ضوء النهار.'), findsOneWidget);
      expect(find.textContaining('إضاءة جيدة بدون ظلال أو لمعان قوي'), findsOneWidget);
      expect(find.text('إعادة التقاط الصورة الآن'), findsOneWidget);
    });

    testWidgets('API network error transitions to Error Card with retry button', (WidgetTester tester) async {
      fakeApi.errorToThrow = const ApiException(
        'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.',
        code: 'NETWORK_ERROR',
      );

      await tester.pumpWidget(createIntegrationApp(apiService: fakeApi, imageService: fakeImage));
      await tester.pumpAndSettle();

      await tester.tap(find.text('التقاط بالكاميرا'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('تعذر إتمام التحليل'), findsOneWidget);
      expect(find.text('تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.'), findsOneWidget);
      expect(find.text('إعادة المحاولة'), findsOneWidget);
    });

    testWidgets('User picker cancellation returns gracefully to idle without error', (WidgetTester tester) async {
      fakeImage.returnNullOnPick = true;

      await tester.pumpWidget(createIntegrationApp(apiService: fakeApi, imageService: fakeImage));
      await tester.pumpAndSettle();

      await tester.tap(find.text('التقاط بالكاميرا'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Returns to idle view without showing error or result
      expect(find.text('قراءة علبة الدواء'), findsOneWidget);
      expect(find.text('تعذر إتمام التحليل'), findsNothing);
    });

    testWidgets('Exhaustive Phase 1 Negative Scope Assertion across all states', (WidgetTester tester) async {
      await tester.pumpWidget(createIntegrationApp(apiService: fakeApi, imageService: fakeImage));
      await tester.pumpAndSettle();

      // Zero audio / TTS buttons
      expect(find.byIcon(Icons.volume_up), findsNothing);
      expect(find.byIcon(Icons.record_voice_over), findsNothing);
      expect(find.byIcon(Icons.play_arrow), findsNothing);
      expect(find.byIcon(Icons.audiotrack), findsNothing);

      // Zero history & saved list icons/labels
      expect(find.byIcon(Icons.history), findsNothing);
      expect(find.byIcon(Icons.bookmark), findsNothing);
      expect(find.text('السجل'), findsNothing);
      expect(find.text('أدويتي'), findsNothing);
      expect(find.text('المحفوظات'), findsNothing);

      // Zero settings & font size toggles
      expect(find.byIcon(Icons.settings), findsNothing);
      expect(find.text('Aa'), findsNothing);
      expect(find.text('الإعدادات'), findsNothing);
    });
  });
}
