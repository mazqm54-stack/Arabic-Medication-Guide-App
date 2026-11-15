import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:image_picker/image_picker.dart';

import 'package:dalili_app/screens/home_screen.dart';
import 'package:dalili_app/services/api_service.dart';
import 'package:dalili_app/services/image_service.dart';

/// Test double for ImageService enabling deterministic UI state simulation
class StubImageService implements ImageService {
  final ProcessedImage? returnImage;
  final bool shouldReturnNull;

  StubImageService({
    this.returnImage,
    this.shouldReturnNull = false,
  });

  @override
  Future<ProcessedImage?> pickAndProcessImage(ImageSource source) async {
    if (shouldReturnNull) return null;
    return returnImage ??
        ProcessedImage(
          bytes: Uint8List.fromList([1, 2, 3, 4]),
          base64String: 'dGVzdF9iYXNlNjQ=',
          byteSize: 4,
          mimeType: 'image/jpeg',
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Adversarial Stress Test: Network Fault Injection & Error Codes', () {
    test('HTTP 400 Bad Request with custom error message maps to ApiException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': 'BAD_REQUEST',
            'error_code': 'INVALID_IMAGE_FORMAT',
            'retake_message': 'الصورة لا تحتوي على علبة دواء صالحة.',
          }),
          400,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzeMedicineBox('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 400)
            .having((e) => e.code, 'code', 'INVALID_IMAGE_FORMAT')
            .having((e) => e.message, 'message', 'الصورة لا تحتوي على علبة دواء صالحة.')),
      );
    });

    test('HTTP 400 Bad Request without retake_message falls back to default Arabic message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'BAD_REQUEST'}),
          400,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzePrescription('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 400)
            .having((e) => e.message, 'message', contains('صيغة الطلب غير صالحة'))),
      );
    });

    test('HTTP 413 Payload Too Large maps to clean Arabic message and 413 code', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'PAYLOAD_TOO_LARGE'}),
          413,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzeMedicineBox('huge_payload_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 413)
            .having((e) => e.message, 'message', contains('حجم الصورة كبير جداً'))),
      );
    });

    test('HTTP 429 Rate Limit Exceeded maps to clean Arabic rate limit message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error_code': 'RATE_LIMIT_EXCEEDED',
            'retake_message': 'تم تجاوز حد الطلبات المسموح. يرجى الانتظار دقيقة قبل المحاولة مجدداً.',
          }),
          429,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzeMedicineBox('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 429)
            .having((e) => e.code, 'code', 'RATE_LIMIT_EXCEEDED')
            .having((e) => e.message, 'message', contains('تجاوز حد الطلبات'))),
      );
    });

    test('HTTP 500 Server Error maps to clean Arabic server error message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'INTERNAL_SERVER_ERROR'}),
          500,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzePrescription('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 500)
            .having((e) => e.message, 'message', contains('حدث خطأ في الخادم (500)'))),
      );
    });

    test('HTTP 503 Service Overloaded maps to clean Arabic overloaded message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'OVERLOADED'}),
          503,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzeMedicineBox('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 503)
            .having((e) => e.message, 'message', contains('تحت ضغط مؤقت'))),
      );
    });

    test('HTTP 504 Gateway Timeout maps to clean Arabic timeout message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'UPSTREAM_TIMEOUT'}),
          504,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzePrescription('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 504)
            .having((e) => e.message, 'message', contains('استغرقت عملية التحليل وقتاً'))),
      );
    });

    test('HTML error response on HTTP 502/503 is caught and mapped to ApiException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          '<html><body><h1>502 Bad Gateway</h1><p>Cloudflare error</p></body></html>',
          502,
          headers: {'content-type': 'text/html; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzeMedicineBox('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 502)
            .having((e) => e.code, 'code', 'HTTP_502')
            .having((e) => e.message, 'message', contains('حدث خطأ في استجابة الخادم (502)'))),
      );
    });

    test('Corrupted non-JSON 200 OK response throws ApiException with INVALID_JSON', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          'INVALID RAW TEXT PAYLOAD',
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzeMedicineBox('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.code, 'code', 'INVALID_JSON')
            .having((e) => e.message, 'message', contains('تعذر قراءة بيانات الاستجابة'))),
      );
    });

    test('Client-side timeout triggers TimeoutException and maps to TIMEOUT ApiException', () async {
      final mockClient = MockClient((request) async {
        // Simulate hanging connection
        await Future.delayed(const Duration(milliseconds: 300));
        return http.Response('{"is_clear": true}', 200);
      });

      // ApiService with 50ms short timeout to test enforcement
      final api = ApiService(
        baseUrl: 'https://test.edge.dev',
        client: mockClient,
        timeout: const Duration(milliseconds: 50),
      );

      expect(
        () => api.analyzeMedicineBox('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.code, 'code', 'TIMEOUT')
            .having((e) => e.message, 'message', contains('وقتاً أطول من المتوقع'))),
      );
    });

    test('Network failure (SocketException) maps to NETWORK_ERROR ApiException', () async {
      final mockClient = MockClient((request) async {
        throw const SocketException('Failed host lookup');
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzeMedicineBox('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.code, 'code', 'NETWORK_ERROR')
            .having((e) => e.message, 'message', contains('تعذر الاتصال بالخادم'))),
      );
    });

    test('HTTP client exception (connection reset) maps to CLIENT_ERROR ApiException', () async {
      final mockClient = MockClient((request) async {
        throw http.ClientException('Connection closed before full header was received');
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);

      expect(
        () => api.analyzePrescription('dummy_base64'),
        throwsA(isA<ApiException>()
            .having((e) => e.code, 'code', 'CLIENT_ERROR')
            .having((e) => e.message, 'message', contains('حدث خطأ أثناء إرسال البيانات'))),
      );
    });
  });

  group('Adversarial Stress Test: Image Compression Engine', () {
    test('ImageService guarantees < 1MB on multi-pass compression for 5MB raw payload', () async {
      final passes = <int>[];
      final customCompressor = (
        Uint8List bytes, {
        required int minWidth,
        required int minHeight,
        required int quality,
      }) async {
        passes.add(quality);
        if (passes.length == 1) {
          // Pass 1: 1600px @ 80% yields 1.8MB (>1MB)
          return Uint8List(1800 * 1024);
        } else if (passes.length == 2) {
          // Pass 2: 1200px @ 65% yields 1.1MB (>1MB)
          return Uint8List(1100 * 1024);
        } else {
          // Pass 3: 960px @ 50% yields 450KB (<1MB)
          return Uint8List(450 * 1024);
        }
      };

      final service = ImageService(compressor: customCompressor);
      final raw5MbInput = Uint8List(5 * 1024 * 1024); // 5MB

      final output = await service.compressImageBytes(raw5MbInput);

      expect(passes.length, 3);
      expect(passes, [80, 65, 50]);
      expect(output.lengthInBytes, 450 * 1024);
      expect(output.lengthInBytes <= ImageService.maxTargetSizeBytes, isTrue);
    });

    test('ImageService terminates early on pass 1 when output is already < 1MB', () async {
      final passes = <int>[];
      final customCompressor = (
        Uint8List bytes, {
        required int minWidth,
        required int minHeight,
        required int quality,
      }) async {
        passes.add(quality);
        // Pass 1 immediately yields 650KB (<1MB)
        return Uint8List(650 * 1024);
      };

      final service = ImageService(compressor: customCompressor);
      final raw2MbInput = Uint8List(2 * 1024 * 1024);

      final output = await service.compressImageBytes(raw2MbInput);

      expect(passes.length, 1);
      expect(output.lengthInBytes, 650 * 1024);
      expect(output.lengthInBytes <= ImageService.maxTargetSizeBytes, isTrue);
    });

    test('ImageService handles extreme 10MB payload with 3-pass convergence', () async {
      int executedPasses = 0;
      final customCompressor = (
        Uint8List bytes, {
        required int minWidth,
        required int minHeight,
        required int quality,
      }) async {
        executedPasses++;
        if (executedPasses == 1) {
          return Uint8List(3 * 1024 * 1024); // 3MB
        } else if (executedPasses == 2) {
          return Uint8List(1200 * 1024); // 1.2MB
        } else {
          return Uint8List(750 * 1024); // 750KB
        }
      };

      final service = ImageService(compressor: customCompressor);
      final raw10Mb = Uint8List(10 * 1024 * 1024);

      final result = await service.compressImageBytes(raw10Mb);

      expect(executedPasses, 3);
      expect(result.lengthInBytes, 750 * 1024);
      expect(result.lengthInBytes <= ImageService.maxTargetSizeBytes, isTrue);
    });

    test('ImageService gracefully falls back to raw bytes when native compressor throws', () async {
      final throwingCompressor = (
        Uint8List bytes, {
        required int minWidth,
        required int minHeight,
        required int quality,
      }) async {
        throw Exception('PlatformException(error, Native compressor plugin not available on host)');
      };

      final service = ImageService(compressor: throwingCompressor);
      final sampleBytes = Uint8List.fromList([10, 20, 30, 40, 50, 60]);

      final result = await service.compressImageBytes(sampleBytes);
      expect(result, equals(sampleBytes));
    });

    test('ProcessedImage correctly computes sizeInMb and base64 encoding', () {
      final bytes = Uint8List(512 * 1024); // 512KB
      final base64String = base64Encode(bytes);

      final processed = ProcessedImage(
        bytes: bytes,
        base64String: base64String,
        byteSize: bytes.lengthInBytes,
      );

      expect(processed.sizeInMb, closeTo(0.5, 0.001));
      expect(processed.mimeType, 'image/jpeg');
      expect(base64Decode(processed.base64String).length, bytes.length);
    });
  });

  group('Adversarial Stress Test: HomeScreen UI State Under Faults', () {
    testWidgets('HomeScreen transitions to error state on HTTP 500 without crashing', (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'SERVER_ERROR', 'retake_message': 'فشل الاتصال بالخادم'}),
          500,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);
      final stubImageService = StubImageService();

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            apiService: api,
            imageService: stubImageService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap on capture button in idle state
      final cameraBtn = find.text('التقاط بالكاميرا');
      expect(cameraBtn, findsOneWidget);
      await tester.tap(cameraBtn);
      await tester.pump();
      await tester.pumpAndSettle();

      // Verify that the error view is displayed with clean Arabic message and recover buttons
      expect(find.byKey(const ValueKey('error_view')), findsOneWidget);
      expect(find.text('تعذر إتمام التحليل'), findsOneWidget);
      expect(find.text('فشل الاتصال بالخادم'), findsOneWidget);
      expect(find.text('إعادة المحاولة'), findsOneWidget);
      expect(find.text('العودة للرئيسية'), findsOneWidget);

      // Recover back to idle by tapping "العودة للرئيسية"
      await tester.tap(find.text('العودة للرئيسية'));
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('medicine_box_view')), findsOneWidget);
    });

    testWidgets('HomeScreen transitions to error state on HTTP 429 Rate Limit in Prescription mode', (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error_code': 'RATE_LIMIT_EXCEEDED',
            'retake_message': 'تم تجاوز حد الطلبات المسموح. يرجى الانتظار دقيقة قبل المحاولة مجدداً.',
          }),
          429,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);
      final stubImageService = StubImageService();

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            apiService: api,
            imageService: stubImageService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Switch to Prescription tab (index 1)
      await tester.tap(find.text('روشتة طبية'));
      await tester.pumpAndSettle();

      // Tap capture
      await tester.tap(find.text('تصوير الروشتة'));
      await tester.pump();
      await tester.pumpAndSettle();

      // Verify error view
      expect(find.byKey(const ValueKey('error_view')), findsOneWidget);
      expect(find.textContaining('تجاوز حد الطلبات'), findsOneWidget);
    });

    testWidgets('HomeScreen transitions to error state on 30s timeout and allows retry', (tester) async {
      final mockClient = MockClient((request) async {
        await Future.delayed(const Duration(milliseconds: 100));
        return http.Response('{}', 200);
      });

      final api = ApiService(
        baseUrl: 'https://test.edge.dev',
        client: mockClient,
        timeout: const Duration(milliseconds: 20),
      );
      final stubImageService = StubImageService();

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            apiService: api,
            imageService: stubImageService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('التقاط بالكاميرا'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('error_view')), findsOneWidget);
      expect(find.textContaining('وقتاً أطول من المتوقع'), findsOneWidget);
    });

    testWidgets('HomeScreen handles unclear photo response and shows RetakeGuidanceCard', (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'is_clear': false,
            'confidence': 'low',
            'retake_message': 'الصورة غير واضحة يرجى تثبيت الهاتف وتحسين الإضاءة.',
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });

      final api = ApiService(baseUrl: 'https://test.edge.dev', client: mockClient);
      final stubImageService = StubImageService();

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            apiService: api,
            imageService: stubImageService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Trigger via camera button
      await tester.tap(find.text('التقاط بالكاميرا'));
      await tester.pump();
      await tester.pumpAndSettle();

      // Verify unclear photo view
      expect(find.byKey(const ValueKey('unclear_photo_view')), findsOneWidget);
      expect(find.text('نحتاج صورة أكثر وضوحاً'), findsOneWidget);
      expect(find.text('الصورة غير واضحة يرجى تثبيت الهاتف وتحسين الإضاءة.'), findsOneWidget);
      expect(find.text('إعادة التقاط الصورة الآن'), findsOneWidget);
      expect(find.text('اختيار صورة من المعرض'), findsOneWidget);

      // Verify the 3 guidance points
      expect(find.textContaining('إضاءة جيدة'), findsOneWidget);
      expect(find.textContaining('كاملة داخل الإطار'), findsOneWidget);
      expect(find.textContaining('٣. تثبيت الهاتف'), findsOneWidget);
    });

    testWidgets('Strict Scope Negative Assertion: Zero non-Phase-1 features present anywhere', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: HomeScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Strictly zero audio/TTS
      expect(find.byIcon(Icons.volume_up), findsNothing);
      expect(find.byIcon(Icons.record_voice_over), findsNothing);
      expect(find.textContaining('استماع'), findsNothing);
      expect(find.textContaining('قراءة صوتية'), findsNothing);

      // Strictly zero history
      expect(find.byIcon(Icons.history), findsNothing);
      expect(find.textContaining('سجل'), findsNothing);
      expect(find.textContaining('المحفوظات'), findsNothing);

      // Strictly zero settings
      expect(find.byIcon(Icons.settings), findsNothing);
      expect(find.textContaining('إعدادات'), findsNothing);

      // Strictly zero font toggles
      expect(find.byIcon(Icons.format_size), findsNothing);
      expect(find.textContaining('حجم الخط'), findsNothing);
    });
  });
}
