import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/medicine_box.dart';
import '../models/prescription.dart';
import 'device_service.dart';
import 'status_service.dart';

/// Typed exception for Dalili API communication errors with localized Arabic messages.
class ApiException implements Exception {
  final String message;
  final String code;
  final int? statusCode;
  final dynamic originalError;

  const ApiException(
    this.message, {
    this.code = 'UNKNOWN_ERROR',
    this.statusCode,
    this.originalError,
  });

  @override
  String toString() => 'ApiException[$code] (HTTP $statusCode): $message';
}

/// Service handling API communication with the Cloudflare Worker backend.
class ApiService {
  static const String defaultBaseUrl =
      'https://dalili-medication-guide-worker.dalili-medication.workers.dev';

  final String baseUrl;
  final http.Client _client;
  final Duration timeout;
  final bool isFixtureMode;

  ApiService({
    String? baseUrl,
    http.Client? client,
    this.timeout = const Duration(seconds: 35),
    this.isFixtureMode = false,
  })  : baseUrl = (baseUrl ?? defaultBaseUrl).replaceAll(RegExp(r'/+$'), ''),
        _client = client ?? http.Client();

  /// Factory constructor for offline development and UI preview fixtures.
  factory ApiService.fixture() {
    return ApiService(isFixtureMode: true);
  }

  /// Closes the underlying HTTP client.
  void dispose() {
    _client.close();
  }

  /// Submits a base64-encoded JPEG image of a medicine box to `/api/analyze`.
  Future<MedicineBoxAnalysis> analyzeMedicineBox(String base64Image) async {
    if (isFixtureMode) {
      return _getMedicineBoxFixture();
    }

    final uri = Uri.parse('$baseUrl/api/analyze');
    final payload = {
      'image': base64Image,
      'mimeType': 'image/jpeg',
    };

    final response = await _postJson(uri, payload);
    return MedicineBoxAnalysis.fromJson(response);
  }

  /// Submits a base64-encoded JPEG image of a medical prescription to `/api/prescription`.
  Future<PrescriptionAnalysis> analyzePrescription(String base64Image) async {
    if (isFixtureMode) {
      return _getPrescriptionFixture();
    }

    final uri = Uri.parse('$baseUrl/api/prescription');
    final payload = {
      'image': base64Image,
      'mimeType': 'image/jpeg',
      'mode': 'prescription',
    };

    final response = await _postJson(uri, payload, requestTimeout: const Duration(seconds: 35));
    return PrescriptionAnalysis.fromJson(response);
  }

  /// Submits a prescription for deep, high-reasoning multi-pass analysis.
  /// Uses an extended 60-second timeout to allow thorough handwriting reasoning.
  Future<PrescriptionAnalysis> analyzePrescriptionDeep(String base64Image) async {
    if (isFixtureMode) {
      return _getPrescriptionFixture();
    }

    final uri = Uri.parse('$baseUrl/api/prescription');
    final payload = {
      'image': base64Image,
      'mimeType': 'image/jpeg',
      'mode': 'prescription',
      'deep': true,
    };

    final response = await _postJson(
      uri,
      payload,
      requestTimeout: const Duration(seconds: 60),
    );
    return PrescriptionAnalysis.fromJson(response);
  }

  /// In-memory session cache for medicine details: key -> MedicineBoxAnalysis
  final Map<String, MedicineBoxAnalysis> _detailsCache = {};

  /// Retrieves detailed information for a specific medicine on demand,
  /// sending only the medicine name to the Cloudflare Worker backend.
  /// Caches the result in memory during the session so re-tapping does not re-request.
  Future<MedicineBoxAnalysis> getMedicineDetails(String medicineName) async {
    final cleanName = medicineName.trim();
    if (cleanName.isEmpty) {
      throw const ApiException('اسم الدواء غير محدد.', code: 'INVALID_MEDICINE_NAME');
    }

    final cacheKey = cleanName.toLowerCase();
    if (_detailsCache.containsKey(cacheKey)) {
      return _detailsCache[cacheKey]!;
    }

    if (isFixtureMode) {
      final fixture = _getMedicineBoxFixture();
      _detailsCache[cacheKey] = fixture;
      return fixture;
    }

    final uri = Uri.parse('$baseUrl/details');
    final payload = {
      'mode': 'details',
      'medicine_name': cleanName,
    };

    final response = await _postJson(uri, payload);
    final details = MedicineBoxAnalysis.fromJson(response);
    _detailsCache[cacheKey] = details;
    return details;
  }

  /// Clears in-memory details cache (optional).
  void clearDetailsCache() {
    _detailsCache.clear();
  }

  /// Checks system status, maintenance mode, and app versions from `/api/status`.
  /// Returns null if the request fails (e.g. no internet connection),
  /// allowing the application to gracefully continue offline/normally.
  Future<AppStatus?> getStatus() async {
    if (isFixtureMode || baseUrl.contains('fake') || baseUrl.contains('test.edge.dev')) {
      return const AppStatus(
        maintenance: false,
        maintenanceMessage: '',
        latestVersion: '0.0.1',
        minVersion: '0.0.1',
        updateUrl: '',
        updateMessage: '',
      );
    }

    try {
      final uri = Uri.parse('$baseUrl/api/status');
      final deviceId = await DeviceService.getDeviceId();
      final response = await _client
          .get(
            uri,
            headers: {
              'Accept': 'application/json',
              'x-device-id': deviceId,
            },
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded is Map<String, dynamic>) {
          return AppStatus.fromJson(decoded);
        }
      }
    } catch (_) {
      // Graceful offline degradation: return null so app continues normally
    }
    return null;
  }

  /// Sends user feedback (thumbs up / thumbs down) to `/api/feedback`.
  /// Sends only choice, type, and anonymous deviceId. Never sends images or medicine names.
  Future<bool> sendFeedback({
    required String choice,
    required String type,
  }) async {
    if (isFixtureMode) return true;

    try {
      final uri = Uri.parse('$baseUrl/api/feedback');
      final deviceId = await DeviceService.getDeviceId();
      final payload = {
        'choice': choice,
        'type': type,
        'device_id': deviceId,
      };

      await _client
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Accept': 'application/json',
              'x-device-id': deviceId,
            },
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 10));

      return true;
    } catch (_) {
      return false;
    }
  }

  /// Core HTTP POST handler with timeout, error translation, and JSON parsing.
  Future<Map<String, dynamic>> _postJson(
    Uri uri,
    Map<String, dynamic> payload, {
    Duration? requestTimeout,
  }) async {
    final bodyString = jsonEncode(payload);

    try {
      final deviceId = await DeviceService.getDeviceId();
      final effectiveTimeout = requestTimeout ?? timeout;
      final response = await _client
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Accept': 'application/json',
              'x-device-id': deviceId,
            },
            body: bodyString,
          )
          .timeout(effectiveTimeout);

      final Map<String, dynamic> responseJson;
      try {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded is! Map<String, dynamic>) {
          throw const FormatException('Expected JSON object');
        }
        responseJson = decoded;
      } catch (e) {
        if (response.statusCode >= 400) {
          throw ApiException(
            'حدث خطأ في استجابة الخادم (${response.statusCode}). يرجى المحاولة بعد قليل.',
            code: 'HTTP_${response.statusCode}',
            statusCode: response.statusCode,
            originalError: e,
          );
        }
        throw ApiException(
          'تعذر قراءة بيانات الاستجابة من الخادم.',
          code: 'INVALID_JSON',
          statusCode: response.statusCode,
          originalError: e,
        );
      }

      if (response.statusCode >= 400) {
        final serverMessage = responseJson['retake_message'] as String?;
        final serverError = responseJson['error'] as String?;
        final serverErrorCode = responseJson['error_code'] as String?;

        final message = (serverMessage != null && serverMessage.trim().isNotEmpty)
            ? serverMessage
            : _defaultErrorMessageForStatus(response.statusCode);

        throw ApiException(
          message,
          code: serverErrorCode ?? serverError ?? 'HTTP_${response.statusCode}',
          statusCode: response.statusCode,
        );
      }

      return responseJson;
    } on TimeoutException catch (e) {
      throw ApiException(
        'استغرقت عملية التحليل وقتاً أطول من المتوقع. يرجى التأكد من اتصال الإنترنت والضغط على زر إعادة المحاولة.',
        code: 'TIMEOUT',
        originalError: e,
      );
    } on SocketException catch (e) {
      throw ApiException(
        'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.',
        code: 'NETWORK_ERROR',
        originalError: e,
      );
    } on http.ClientException catch (e) {
      throw ApiException(
        'حدث خطأ أثناء إرسال البيانات. يرجى التحقق من الاتصال بالإنترنت والضغط على إعادة المحاولة.',
        code: 'CLIENT_ERROR',
        originalError: e,
      );
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        'حدث خطأ غير متوقع أثناء معالجة الطلب.',
        code: 'UNEXPECTED_ERROR',
        originalError: e,
      );
    }
  }

  String _defaultErrorMessageForStatus(int statusCode) {
    switch (statusCode) {
      case 400:
        return 'صيغة الطلب غير صالحة. يرجى إعادة المحاولة.';
      case 403:
        return 'خدمة التحليل الذكي غير متاحة في هذا النطاق حالياً.';
      case 413:
        return 'حجم الصورة كبير جداً. يرجى التقاط صورة بحجم أصغر.';
      case 429:
        return 'تم تجاوز حد الطلبات المسموح. يرجى الانتظار دقيقة قبل المحاولة مجدداً.';
      case 503:
        return 'خدمة التحليل الذكي تحت ضغط مؤقت لدى مزود الخدمة. يرجى الانتظار بضع ثوانٍ ثم الضغط على زر إعادة المحاولة.';
      case 504:
        return 'استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم. يرجى الضغط على زر إعادة المحاولة.';
      default:
        return 'حدث خطأ في الخادم ($statusCode). يرجى المحاولة بعد قليل.';
    }
  }

  // --- Offline Fixture Data ---
  static MedicineBoxAnalysis _getMedicineBoxFixture() {
    return const MedicineBoxAnalysis(
      isClear: true,
      confidence: 'high',
      evidenceText: 'Panadol Extra Paracetamol 500mg + Caffeine 65mg',
      medicineNameAr: 'بنادول إكسترا',
      medicineNameEn: 'Panadol Extra',
      activeIngredient: 'باراسيتامول 500 ملغ + كافيين 65 ملغ',
      uses: [
        'تسكين آلام الصداع، الأسنان، وآلام العضلات',
        'تخفيض درجة الحرارة عند الحمى',
      ],
      howAndWhen: [
        'قرص إلى قرصين كل 4 إلى 6 ساعات حسب الحاجة',
        'يفضل تناوله بعد الطعام مع كوب ماء كامل',
      ],
      usageSource: 'printed',
      warnings: [
        'لا تتجاوز 8 أقراص خلال 24 ساعة لتجنب الإضرار بالكبد',
        'لا تتناوله مع أدوية أخرى تحتوي على الباراسيتامول',
        'استشر الطبيب أو الصيدلي في حال استمرار الأعراض',
      ],
      audioSummary: 'بنادول إكسترا مسكن للآلام وخافض للحرارة.',
    );
  }

  static PrescriptionAnalysis _getPrescriptionFixture() {
    return const PrescriptionAnalysis(
      isClear: true,
      confidence: 'high',
      deducedCondition: 'التهاب بكتيري بالجهاز التنفسي',
      items: [
        PrescriptionItem(
          lineTextAsWritten: 'Augmentin 1g tab 1x2',
          isConfirmed: true,
          status: 'confirmed',
          medicineNameAr: 'أوجمنتين 1 غرام',
          medicineNameEn: 'Augmentin 1g',
          activeIngredient: 'أموكسيسيلين + كلافولانات البوتاسيوم',
          confidence: 'high',
          writtenInstructions: 'قرص كل 12 ساعة بعد الطعام لمدة 7 أيام',
          shortExplanation: 'مضاد حيوي واسع المجال لعلاج الالتهابات البكتيرية',
        ),
        PrescriptionItem(
          lineTextAsWritten: 'C...fl... 500',
          isConfirmed: false,
          status: 'suggested',
          medicineNameAr: 'سيبروفلوكساسين 500 ملغ (محتمل)',
          medicineNameEn: 'Ciprofloxacin 500mg (possible)',
          activeIngredient: 'سيبروفلوكساسين',
          confidence: 'medium',
          writtenInstructions: '',
          shortExplanation: '',
          visibleLetters: 'C...fl...',
          suggestedMedicines: [
            SuggestedMedicine(
              nameAr: 'سيبروفلوكساسين 500 ملغ',
              nameEn: 'Ciprofloxacin 500mg',
              confidence: 'medium',
            ),
            SuggestedMedicine(
              nameAr: 'سيفالكسين 500 ملغ',
              nameEn: 'Cephalexin 500mg',
              confidence: 'low',
            ),
          ],
          warningNote: 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة',
        ),
      ],
      audioSummary: 'روشتة طبية تحتوي على مضاد حيوي أوجمنتين ودواء مقترح سيبروفلوكساسين.',
    );
  }
}
