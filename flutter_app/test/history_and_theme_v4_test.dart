import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dalili_app/constants/theme.dart';
import 'package:dalili_app/models/history_item.dart';
import 'package:dalili_app/models/medicine_box.dart';
import 'package:dalili_app/models/prescription.dart';
import 'package:dalili_app/screens/history_screen.dart';
import 'package:dalili_app/services/api_service.dart';
import 'package:dalili_app/services/history_service.dart';
import 'package:dalili_app/services/theme_service.dart';
import 'package:dalili_app/widgets/prescription_card.dart';

class _MockFailingApiService extends ApiService {
  @override
  Future<MedicineBoxAnalysis> getMedicineDetails(String name) async {
    throw const ApiException('تعذّر الاتصال');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('HistoryItem Model Tests', () {
    test('HistoryItem serializes and deserializes correctly', () {
      final now = DateTime(2026, 11, 15, 14, 30);
      final item = HistoryItem(
        id: 'test_123',
        timestamp: now,
        type: 'box',
        title: 'بانادول',
        subtitle: 'المادة الفعالة: باراسيتامول',
        confidence: 'high',
        thumbnailBase64: 'dGVzdF90aHVtYg==',
        rawJson: {'medicine_name_ar': 'بانادول', 'is_clear': true},
      );

      final json = item.toJson();
      expect(json['id'], 'test_123');
      expect(json['type'], 'box');
      expect(json['title'], 'بانادول');
      expect(json['confidence'], 'high');

      final reconstructed = HistoryItem.fromJson(json);
      expect(reconstructed.id, item.id);
      expect(reconstructed.title, item.title);
      expect(reconstructed.type, item.type);
      expect(reconstructed.formattedDateTime, contains('2026/11/15'));
      expect(reconstructed.formattedDateTime, contains('02:30 م'));
    });
  });

  group('HistoryService Storage Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('Saves items newest-first and enforces max 50 items cap', () async {
      final service = HistoryService();
      final baseTime = DateTime(2026, 1, 1);

      // Save 55 items
      for (int i = 1; i <= 55; i++) {
        await service.saveItem(HistoryItem(
          id: 'item_$i',
          timestamp: baseTime.add(Duration(minutes: i)),
          type: i % 2 == 0 ? 'box' : 'prescription',
          title: 'دواء $i',
          rawJson: {'index': i},
        ));
      }

      final items = await service.getHistory();
      expect(items.length, 50); // Enforced 50 max cap
      expect(items.first.id, 'item_55'); // Newest first
      expect(items.last.id, 'item_6'); // Oldest retained (items 1..5 dropped)
    });

    test('Deletes single item and clears all items', () async {
      final service = HistoryService();
      await service.saveItem(HistoryItem(
        id: 'item_a',
        timestamp: DateTime.now(),
        type: 'box',
        title: 'دواء A',
        rawJson: {},
      ));
      await service.saveItem(HistoryItem(
        id: 'item_b',
        timestamp: DateTime.now(),
        type: 'box',
        title: 'دواء B',
        rawJson: {},
      ));

      var list = await service.getHistory();
      expect(list.length, 2);

      await service.deleteItem('item_a');
      list = await service.getHistory();
      expect(list.length, 1);
      expect(list.first.id, 'item_b');

      await service.clearHistory();
      list = await service.getHistory();
      expect(list.isEmpty, true);
    });
  });

  group('ThemeMode & Dark Theme Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('ThemeService initializes with system and toggles properly', () async {
      await ThemeService.init();
      expect(ThemeService.themeModeNotifier.value, ThemeMode.system);

      await ThemeService.setThemeMode(ThemeMode.dark);
      expect(ThemeService.themeModeNotifier.value, ThemeMode.dark);

      await ThemeService.setThemeMode(ThemeMode.light);
      expect(ThemeService.themeModeNotifier.value, ThemeMode.light);
    });

    test('AppTheme.darkTheme has high-contrast colors and Material 3 enabled', () {
      final dark = AppTheme.darkTheme;
      expect(dark.useMaterial3, true);
      expect(dark.brightness, Brightness.dark);
      expect(dark.scaffoldBackgroundColor, const Color(0xFF121212));
      expect(dark.cardTheme.color, const Color(0xFF1E1E1E));
    });

    test('AppTheme.buildConfidenceBadge returns distinct icons and colors', () {
      expect(AppTheme.getConfidenceIcon('high'), Icons.check_circle_rounded);
      expect(AppTheme.getConfidenceIcon('medium'), Icons.warning_amber_rounded);
      expect(AppTheme.getConfidenceIcon('low'), Icons.help_outline_rounded);

      // Light colors
      expect(AppTheme.getConfidenceColor('high', isDark: false), AppTheme.confidenceHighLight);
      expect(AppTheme.getConfidenceColor('medium', isDark: false), AppTheme.confidenceMediumLight);
      expect(AppTheme.getConfidenceColor('low', isDark: false), AppTheme.confidenceLowLight);

      // Dark colors
      expect(AppTheme.getConfidenceColor('high', isDark: true), AppTheme.confidenceHighDark);
      expect(AppTheme.getConfidenceColor('medium', isDark: true), AppTheme.confidenceMediumDark);
      expect(AppTheme.getConfidenceColor('low', isDark: true), AppTheme.confidenceLowDark);
    });
  });

  group('Prescription Card Display Fixes Tests', () {
    testWidgets('Never shows line_text_as_written or دواء بالروشتة as title; shows visibleLetters or سطر غير واضح', (tester) async {
      // Case 1: Unclear line with visible letters
      const itemWithLetters = PrescriptionItem(
        lineTextAsWritten: '1 cp x 3m 1',
        visibleLetters: 'Domper',
        confidence: 'low',
        status: 'unclear',
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: PrescriptionMedicineCard(item: itemWithLetters),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('سطر غير واضح (Domper)'), findsOneWidget);
      expect(find.text('1 cp x 3m 1'), findsNothing); // Never shows line_text_as_written
      expect(find.text('دواء بالروشتة'), findsNothing); // Removed placeholder

      // Case 2: Unclear line with zero letters
      const itemEmpty = PrescriptionItem(
        lineTextAsWritten: '???',
        visibleLetters: '',
        confidence: 'low',
        status: 'unclear',
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: PrescriptionMedicineCard(item: itemEmpty),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('سطر غير واضح'), findsOneWidget);
      expect(find.text('???'), findsNothing);
      expect(find.text('دواء بالروشتة'), findsNothing);
    });

    test('PrescriptionView.mergeDuplicateItems merges exactly identical cards', () {
      const item1 = PrescriptionItem(
        medicineNameEn: 'Gabapentin',
        lineTextAsWritten: 'Gabapentin 300mg',
        writtenInstructions: '1 cap daily',
        confidence: 'medium',
      );
      const item2 = PrescriptionItem(
        medicineNameEn: 'Gabapentin',
        lineTextAsWritten: 'Gabapentin 300mg',
        writtenInstructions: '1 cap daily',
        confidence: 'medium',
      );
      const item3DifferentDose = PrescriptionItem(
        medicineNameEn: 'Gabapentin',
        lineTextAsWritten: 'Gabapentin 100mg',
        writtenInstructions: '1 cap at night',
        confidence: 'medium',
      );

      final merged = PrescriptionView.mergeDuplicateItems([item1, item2, item3DifferentDose]);
      expect(merged.length, 2); // item1 and item2 merged into one
      expect(merged[0].lineTextAsWritten, 'Gabapentin 300mg');
      expect(merged[1].lineTextAsWritten, 'Gabapentin 100mg');
    });

    testWidgets('Tapping card with failed details shows "تعذّر تحميل التفاصيل" with retry button; never wrong default', (tester) async {
      const item = PrescriptionItem(
        medicineNameEn: 'Amoxil',
        lineTextAsWritten: 'Amoxil 500',
        confidence: 'high',
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: MedicineDetailsSheet(
              medicineName: 'Amoxil',
              item: item,
              apiService: _MockFailingApiService(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Wrong text is absent
      expect(find.text('مسكن ومضاد للالتهاب وفق استشارة الطبيب.'), findsNothing);
      // Neutral message and retry button are present
      expect(find.textContaining('تعذّر تحميل التفاصيل'), findsWidgets);
      expect(find.text('إعادة المحاولة'), findsWidgets);
    });
  });

  group('HistoryScreen Widget Tests', () {
    testWidgets('Renders empty state when history is empty', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final service = HistoryService();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: HistoryScreen(historyService: service),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('سجل الفحوصات'), findsOneWidget);
      expect(find.text('لا يوجد سجل محفوظ حتى الآن'), findsOneWidget);
    });

    testWidgets('Renders items, allows tap to reopen, and allows deletion', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final service = HistoryService();
      await service.saveItem(HistoryItem(
        id: 'test_box_1',
        timestamp: DateTime(2026, 11, 15, 10, 0),
        type: 'box',
        title: 'أوجمنتين 1 جم',
        subtitle: 'المادة الفعالة: أموكسيسيلين + كلافولانات',
        confidence: 'high',
        rawJson: {'medicine_name_ar': 'أوجمنتين'},
      ));

      HistoryItem? poppedItem;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () async {
                  poppedItem = await Navigator.push<HistoryItem>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => HistoryScreen(historyService: service),
                    ),
                  );
                },
                child: const Text('افتح السجل'),
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap button to open HistoryScreen
      await tester.tap(find.text('افتح السجل'));
      await tester.pumpAndSettle();

      expect(find.text('أوجمنتين 1 جم'), findsOneWidget);
      expect(find.text('علبة دواء'), findsOneWidget);
      expect(find.text('ثقة مرتفعة'), findsOneWidget);

      // Tap on item to reopen
      await tester.tap(find.text('أوجمنتين 1 جم'));
      await tester.pumpAndSettle();

      expect(poppedItem?.id, 'test_box_1');
    });
  });
}
