import 'package:flutter_test/flutter_test.dart';
import 'package:dalili_app/models/medicine_box.dart';
import 'package:dalili_app/models/prescription.dart';

void main() {
  group('Empirical Challenger 2: PrescriptionItem Safety & Logic Stress Tests', () {
    test('CHALLENGE-01: Suggested medicine with confidence "high" must NOT be considered confirmed', () {
      final json = {
        'line_text_as_written': 'Aug... 500',
        'is_confirmed': false,
        'status': 'suggested',
        'medicine_name_ar': 'أوجمنتين (محتمل)',
        'medicine_name_en': 'Augmentin (possible)',
        'confidence': 'high', // Model rated the suggestion as high confidence
        'written_instructions': '',
        'suggested_medicines': [
          {'name_ar': 'أوجمنتين 500 ملغ', 'name_en': 'Augmentin 500mg', 'confidence': 'high'}
        ],
        'warning_note': 'محتمل، غير مؤكد - اسأل الصيدلي',
      };

      final item = PrescriptionItem.fromJson(json);

      expect(item.isConfirmed, false, reason: 'isConfirmed must be false');
      expect(item.status, 'suggested', reason: 'status must be suggested');

      // The critical safety getter:
      // If isConfirmedMedicine is true, the UI renders this suggestion as confirmed in teal!
      expect(item.isConfirmedMedicine, false,
          reason: 'SAFETY BUG: A suggested unconfirmed medicine with confidence="high" evaluates to isConfirmedMedicine=true!');
    });

    test('CHALLENGE-02: Unclear item with confidence "high" must NOT be considered confirmed', () {
      final json = {
        'line_text_as_written': '????',
        'is_confirmed': false,
        'status': 'unclear',
        'confidence': 'high',
        'warning_note': 'غير واضح، اسأل الصيدلي',
      };

      final item = PrescriptionItem.fromJson(json);
      expect(item.isConfirmedMedicine, false,
          reason: 'SAFETY BUG: An unclear item with confidence="high" evaluates to isConfirmedMedicine=true!');
    });

    test('CHALLENGE-03: Suggested item with leaked dosage instructions should be noted', () {
      final json = {
        'line_text_as_written': 'Am... 250mg',
        'is_confirmed': false,
        'status': 'suggested',
        'written_instructions': 'Take 1 tablet every 8 hours', // Leaked dosage
        'confidence': 'low',
        'warning_note': 'محتمل، غير مؤكد',
      };

      final item = PrescriptionItem.fromJson(json);
      expect(item.isConfirmed, false);
      // Model defensively sanitizes written_instructions if isConfirmed is false
    });

    test('CHALLENGE-04: Unicode & BiDi stress test (Arabic, Hebrew, RTL marks, Rx symbol)', () {
      final json = {
        'is_clear': true,
        'confidence': 'high',
        'deduced_condition': 'זيهوم בדרכי הנשימה \u200F(التهاب الجهاز التنفسي)',
        'items': [
          {
            'line_text_as_written': '℞ אקמول פראצטמول 500 ملغ \u200E(Paracetamol) \u{1F48A}',
            'is_confirmed': true,
            'status': 'confirmed',
            'medicine_name_ar': 'باراسيتامول \u064E\u064F\u0650', // with Tashkeel
            'medicine_name_en': 'Paracetamol 500mg',
            'confidence': 'high',
            'written_instructions': 'קח כדור אחד كل 8 ساعات \u200Fعند اللزوم',
            'suggested_medicines': <Map<String, dynamic>>[],
          }
        ]
      };

      final analysis = PrescriptionAnalysis.fromJson(json);
      expect(analysis.isClear, true);
      expect(analysis.deducedCondition.contains('זيهوم'), true);
      expect(analysis.items.length, 1);
      final item = analysis.items[0];
      expect(item.lineTextAsWritten.contains('℞'), true);
      expect(item.lineTextAsWritten.contains('\u{1F48A}'), true);
      expect(item.medicineNameAr.contains('\u064E'), true);
      expect(item.writtenInstructions.contains('קח'), true);
    });

    test('CHALLENGE-05: Empty payload and missing fields robustness', () {
      final emptyAnalysis = PrescriptionAnalysis.fromJson({});
      expect(emptyAnalysis.isClear, false);
      expect(emptyAnalysis.confidence, 'low');
      expect(emptyAnalysis.retakeMessage, '');
      expect(emptyAnalysis.items, isEmpty);
      expect(emptyAnalysis.deducedCondition, '');

      final emptyItem = PrescriptionItem.fromJson({});
      expect(emptyItem.lineTextAsWritten, '');
      expect(emptyItem.isConfirmed, false);
      expect(emptyItem.status, 'suggested');
      expect(emptyItem.isConfirmedMedicine, false);
      expect(emptyItem.suggestedMedicines, isEmpty);
    });

    test('CHALLENGE-06: SuggestedMedicine parsing edge cases (missing fields, legacy "name" key)', () {
      final s1 = SuggestedMedicine.fromJson({'name': 'كاتافلام'});
      expect(s1.nameAr, 'كاتافلام');
      expect(s1.nameEn, '');
      expect(s1.confidence, 'low');

      final s2 = SuggestedMedicine.fromJson({});
      expect(s2.nameAr, '');
      expect(s2.nameEn, '');
      expect(s2.confidence, 'low');
    });
  });

  group('Empirical Challenger 2: MedicineBoxAnalysis Stress Tests', () {
    test('CHALLENGE-07: Incomplete JSON and null safety', () {
      final box = MedicineBoxAnalysis.fromJson({});
      expect(box.isClear, false);
      expect(box.confidence, 'low');
      expect(box.uses, isEmpty);
      expect(box.howAndWhen, isEmpty);
      expect(box.warnings, isEmpty);
      expect(box.usageSource, 'common');
    });

    test('CHALLENGE-08: List fields with mixed non-string types and Unicode', () {
      final json = {
        'is_clear': true,
        'confidence': 'high',
        'medicine_name_ar': 'أوميبرازول 20 ملغ \u200F(Omeprazole)',
        'uses': [123, true, 'تسكين آلام المعدة \u200E'],
        'how_and_when': ['قرص صباحاً قبل الإفطار'],
        'warnings': ['لا ينصح به للحوامل دون استشارة'],
      };

      final box = MedicineBoxAnalysis.fromJson(json);
      expect(box.isClear, true);
      expect(box.uses.length, 3);
      expect(box.uses[0], '123');
      expect(box.uses[1], 'true');
      expect(box.uses[2].contains('المعدة'), true);
    });

    test('CHALLENGE-09: MedicineBox behavior when uses/how_and_when/warnings are non-list', () {
      // Test what happens if the backend sends a single string instead of a list:
      final json = {
        'is_clear': true,
        'confidence': 'high',
        'uses': 'تسكين الصداع',
      };

      expect(
        () => MedicineBoxAnalysis.fromJson(json),
        throwsA(isA<TypeError>()),
        reason: 'Raw cast (json["uses"] as List<dynamic>?) throws TypeError if backend sends a String',
      );
    });

    test('CHALLENGE-10: PrescriptionAnalysis behavior when items contains non-Map', () {
      final json = {
        'is_clear': true,
        'items': ['invalid_item_format'],
      };

      expect(
        () => PrescriptionAnalysis.fromJson(json),
        throwsA(isA<TypeError>()),
        reason: 'Raw cast (e as Map<String, dynamic>) throws TypeError if an item in items is not a Map',
      );
    });
  });
}
