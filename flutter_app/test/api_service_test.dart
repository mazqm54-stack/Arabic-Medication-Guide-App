import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:dalili_app/services/api_service.dart';

void main() {
  group('ApiService Unit Tests', () {
    test('analyzeMedicineBox posts correct payload and parses clear response', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/analyze');
        expect(request.method, 'POST');
        expect(request.headers['content-type'], contains('application/json'));

        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['image'], 'dGVzdF9pbWFnZV9ieXRlcw==');
        expect(body['mimeType'], 'image/jpeg');

        final responsePayload = {
          'is_clear': true,
          'confidence': 'high',
          'retake_message': '',
          'evidence_text': 'Panadol Extra Paracetamol 500mg',
          'medicine_name_ar': 'بنادول إكسترا',
          'medicine_name_en': 'Panadol Extra',
          'active_ingredient': 'باراسيتامول 500 ملغ + كافيين 65 ملغ',
          'uses': ['تسكين آلام الصداع', 'خفض درجة الحرارة'],
          'how_and_when': ['قرص إلى قرصين كل 4 إلى 6 ساعات'],
          'usage_source': 'printed',
          'warnings': ['لا تتجاوز 8 أقراص يومياً'],
          'audio_summary': 'بنادول إكسترا لتسكين الآلام',
        };

        return http.Response(jsonEncode(responsePayload), 200, headers: {
          'content-type': 'application/json; charset=utf-8',
        });
      });

      final service = ApiService(
        baseUrl: 'https://test.workers.dev',
        client: mockClient,
      );

      final result = await service.analyzeMedicineBox('dGVzdF9pbWFnZV9ieXRlcw==');
      expect(result.isClear, true);
      expect(result.confidence, 'high');
      expect(result.medicineNameAr, 'بنادول إكسترا');
      expect(result.medicineNameEn, 'Panadol Extra');
      expect(result.activeIngredient, contains('باراسيتامول'));
      expect(result.uses.length, 2);
      expect(result.warnings.length, 1);
    });

    test('analyzeMedicineBox correctly parses unclear photo response', () async {
      final mockClient = MockClient((request) async {
        final responsePayload = {
          'is_clear': false,
          'confidence': 'low',
          'retake_message': 'الصورة غير واضحة تماماً، يرجى تشغيل الإضاءة وتثبيت الهاتف.',
          'evidence_text': '',
          'uses': <String>[],
          'how_and_when': <String>[],
          'warnings': <String>[],
        };
        return http.Response(jsonEncode(responsePayload), 200, headers: {
          'content-type': 'application/json; charset=utf-8',
        });
      });

      final service = ApiService(baseUrl: 'https://test.workers.dev', client: mockClient);
      final result = await service.analyzeMedicineBox('Ymx1cnJ5X2ltYWdl');
      expect(result.isClear, false);
      expect(result.retakeMessage, contains('غير واضحة'));
      expect(result.uses.isEmpty, true);
    });

    test('analyzePrescription posts mode=prescription and parses mixed confirmed/suggested items', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/prescription');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['mode'], 'prescription');

        final responsePayload = {
          'is_clear': true,
          'confidence': 'high',
          'deduced_condition': 'التهاب حاد بالجهاز التنفسي',
          'items': [
            {
              'line_text_as_written': 'Augmentin 1g 1x2',
              'is_confirmed': true,
              'status': 'confirmed',
              'medicine_name_ar': 'أوجمنتين 1 غرام',
              'medicine_name_en': 'Augmentin 1g',
              'active_ingredient': 'أموكسيسيلين + كلافولانات',
              'confidence': 'high',
              'written_instructions': 'قرص كل 12 ساعة بعد الأكل',
              'short_explanation': 'مضاد حيوي للالتهابات البكتيرية',
              'visible_letters': 'Augmentin',
              'suggested_medicines': <Map<String, dynamic>>[],
              'warning_note': '',
            },
            {
              'line_text_as_written': 'C...fl... 50',
              'is_confirmed': false,
              'status': 'suggested',
              'medicine_name_ar': 'كاتافلام 50 ملغ (محتمل)',
              'medicine_name_en': 'Cataflam 50mg (possible)',
              'active_ingredient': 'ديكلوفيناك بوتاسيوم',
              'confidence': 'medium',
              'written_instructions': '',
              'short_explanation': '',
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
              'warning_note': 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة',
            }
          ],
          'audio_summary': 'روشتة طبية تحتوي على أوجمنتين ودواء مقترح.',
        };

        return http.Response(jsonEncode(responsePayload), 200, headers: {
          'content-type': 'application/json; charset=utf-8',
        });
      });

      final service = ApiService(baseUrl: 'https://test.workers.dev', client: mockClient);
      final result = await service.analyzePrescription('cngfaW1hZ2U=');

      expect(result.isClear, true);
      expect(result.deducedCondition, contains('التهاب'));
      expect(result.items.length, 2);

      // Item 1: Confirmed
      expect(result.items[0].isConfirmedMedicine, true);
      expect(result.items[0].writtenInstructions, isNotEmpty);
      expect(result.items[0].suggestedMedicines.isEmpty, true);

      // Item 2: Suggested with zero dosage instructions
      expect(result.items[1].isConfirmedMedicine, false);
      expect(result.items[1].status, 'suggested');
      expect(result.items[1].writtenInstructions, isEmpty);
      expect(result.items[1].suggestedMedicines.length, 2);
      expect(result.items[1].warningNote, contains('اسأل الصيدلي'));
    });

    test('Throws ApiException with RATE_LIMIT_EXCEEDED on HTTP 429', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'is_clear': false,
            'retake_message': 'تم تجاوز حد الاستخدام المسموح. يرجى الانتظار دقيقة.',
            'error_code': 'RATE_LIMIT_EXCEEDED',
          }),
          429,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final service = ApiService(baseUrl: 'https://test.workers.dev', client: mockClient);
      expect(
        () => service.analyzeMedicineBox('aW1n'),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'RATE_LIMIT_EXCEEDED')),
      );
    });

    test('Throws ApiException on HTTP 500 server error', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'is_clear': false,
            'error': 'SERVER_ERROR',
            'retake_message': 'حدث خطأ في الخادم أثناء التحليل.',
          }),
          500,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final service = ApiService(baseUrl: 'https://test.workers.dev', client: mockClient);
      expect(
        () => service.analyzeMedicineBox('aW1n'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 500)),
      );
    });

    test('ApiService.fixture() returns offline fixtures with zero HTTP calls', () async {
      final service = ApiService.fixture();
      final box = await service.analyzeMedicineBox('dummy');
      expect(box.isClear, true);
      expect(box.medicineNameAr, 'بنادول إكسترا');

      final rx = await service.analyzePrescription('dummy');
      expect(rx.isClear, true);
      expect(rx.items.length, 2);
    });
  });
}
