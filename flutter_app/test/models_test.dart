import 'package:flutter_test/flutter_test.dart';
import 'package:dalili_app/models/medicine_box.dart';
import 'package:dalili_app/models/prescription.dart';

void main() {
  group('MedicineBoxAnalysis Model Tests', () {
    test('Correctly parses clear medicine box JSON response', () {
      final json = {
        'is_clear': true,
        'confidence': 'high',
        'retake_message': '',
        'evidence_text': 'Panadol Extra Paracetamol 500mg',
        'medicine_name_ar': 'بانادول إكسترا',
        'medicine_name_en': 'Panadol Extra',
        'active_ingredient': 'باراسيتامول 500 ملغ + كافيين 65 ملغ',
        'uses': ['تسكين الآلام الصداع', 'خفض درجة الحرارة'],
        'how_and_when': ['قرص إلى قرصين كل 4-6 ساعات'],
        'usage_source': 'printed',
        'warnings': ['لا تتجاوز 8 أقراص يومياً'],
        'audio_summary': 'بانادول إكسترا لتسكين الآلام الصداع',
        'error_code': null,
      };

      final analysis = MedicineBoxAnalysis.fromJson(json);
      expect(analysis.isClear, true);
      expect(analysis.confidence, 'high');
      expect(analysis.medicineNameAr, 'بانادول إكسترا');
      expect(analysis.medicineNameEn, 'Panadol Extra');
      expect(analysis.activeIngredient.contains('باراسيتامول'), true);
      expect(analysis.uses.length, 2);
      expect(analysis.howAndWhen.length, 1);
      expect(analysis.usageSource, 'printed');
      expect(analysis.warnings.length, 1);
    });

    test('Correctly parses unclear photo JSON response', () {
      final json = {
        'is_clear': false,
        'confidence': 'low',
        'retake_message': 'الصورة غير واضحة، يرجى إعادة التصوير في مكان جيد الإضاءة.',
        'uses': <String>[],
        'how_and_when': <String>[],
        'warnings': <String>[],
      };

      final analysis = MedicineBoxAnalysis.fromJson(json);
      expect(analysis.isClear, false);
      expect(analysis.confidence, 'low');
      expect(analysis.retakeMessage.contains('غير واضحة'), true);
      expect(analysis.uses.isEmpty, true);
    });
  });

  group('PrescriptionAnalysis Model Tests', () {
    test('Distinguishes confirmed medicines from suggested/unclear medicines', () {
      final json = {
        'is_clear': true,
        'confidence': 'high',
        'retake_message': '',
        'deduced_condition': 'التهاب بكتيري بالجهاز التنفسي',
        'items': [
          {
            'line_text_as_written': 'Augmentin 1g 1x2',
            'is_confirmed': true,
            'status': 'confirmed',
            'medicine_name_ar': 'أوجمنتين 1 غرام',
            'medicine_name_en': 'Augmentin 1g',
            'active_ingredient': 'أموكسيسيلين + كلافولانات',
            'confidence': 'high',
            'written_instructions': 'قرص كل 12 ساعة بعد الطعام',
            'short_explanation': 'مضاد حيوي واسع المجال',
            'visible_letters': 'Augmentin',
            'suggested_medicines': <Map<String, dynamic>>[],
            'warning_note': '',
          },
          {
            'line_text_as_written': 'C...fl... 50',
            'is_confirmed': false,
            'status': 'suggested',
            'medicine_name_ar': 'كاتافلام 50 ملغ (مقترح)',
            'medicine_name_en': 'Cataflam 50mg (Suggested)',
            'active_ingredient': 'ديكلوفيناك بوتاسيوم',
            'confidence': 'low',
            'written_instructions': '', // Strictly omitted dosage
            'short_explanation': 'مسكن ومضاد للالتهاب',
            'visible_letters': 'C...fl...',
            'suggested_medicines': [
              {
                'name_ar': 'كاتافلام 50 ملغ',
                'name_en': 'Cataflam 50mg',
                'confidence': 'medium',
              },
              {
                'name_ar': 'سيبروفلوكساسين 500 ملغ',
                'name_en': 'Ciprofloxacin 500mg',
                'confidence': 'low',
              }
            ],
            'warning_note': 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء',
          }
        ],
      };

      final analysis = PrescriptionAnalysis.fromJson(json);
      expect(analysis.isClear, true);
      expect(analysis.deducedCondition.contains('التهاب'), true);
      expect(analysis.items.length, 2);

      // Item 1: Confirmed
      final confirmedItem = analysis.items[0];
      expect(confirmedItem.isConfirmed, true);
      expect(confirmedItem.status, 'confirmed');
      expect(confirmedItem.isConfirmedMedicine, true);
      expect(confirmedItem.writtenInstructions.isNotEmpty, true);
      expect(confirmedItem.suggestedMedicines.isEmpty, true);

      // Item 2: Suggested (Handwritten Reasoning)
      final suggestedItem = analysis.items[1];
      expect(suggestedItem.isConfirmed, false);
      expect(suggestedItem.status, 'suggested');
      expect(suggestedItem.isConfirmedMedicine, false);
      expect(suggestedItem.writtenInstructions.isEmpty, true); // Dosage omitted
      expect(suggestedItem.suggestedMedicines.length, 2);
      expect(suggestedItem.suggestedMedicines[0].nameAr.contains('كاتافلام'), true);
      expect(suggestedItem.warningNote.contains('اسأل الصيدلي'), true);
    });
  });
}
