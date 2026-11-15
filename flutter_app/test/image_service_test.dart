import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dalili_app/services/image_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ImageService Unit Tests', () {
    test('toBase64 correctly encodes bytes to valid base64 string', () {
      final service = ImageService();
      final bytes = Uint8List.fromList([72, 101, 108, 108, 111]); // "Hello"
      final encoded = service.toBase64(bytes);

      expect(encoded, 'SGVsbG8=');
      expect(utf8.decode(base64Decode(encoded)), 'Hello');
    });

    test('ProcessedImage data class computes byteSize and sizeInMb accurately', () {
      final bytes = Uint8List(1024 * 1024); // Exactly 1MB
      final processed = ProcessedImage(
        bytes: bytes,
        base64String: 'dummy',
        byteSize: bytes.lengthInBytes,
        originalPath: '/path/to/image.jpg',
      );

      expect(processed.byteSize, 1048576);
      expect(processed.sizeInMb, 1.0);
      expect(processed.mimeType, 'image/jpeg');
      expect(processed.originalPath, '/path/to/image.jpg');
    });

    test('compressImageBytes applies custom compressor and respects size thresholds', () async {
      int compressionPasses = 0;
      final customCompressor = (
        Uint8List bytes, {
        required int minWidth,
        required int minHeight,
        required int quality,
      }) async {
        compressionPasses++;
        // First pass returns 1.2MB (>1MB), second pass returns 600KB (<1MB)
        if (compressionPasses == 1) {
          return Uint8List(1200 * 1024);
        } else {
          return Uint8List(600 * 1024);
        }
      };

      final service = ImageService(compressor: customCompressor);
      final rawInput = Uint8List(2 * 1024 * 1024); // 2MB raw

      final result = await service.compressImageBytes(rawInput);

      // Should have run pass 1 and pass 2
      expect(compressionPasses, 2);
      expect(result.lengthInBytes, 600 * 1024);
      expect(result.lengthInBytes <= ImageService.maxTargetSizeBytes, true);
    });

    test('compressImageBytes falls back to raw bytes when compression throws', () async {
      final failingCompressor = (
        Uint8List bytes, {
        required int minWidth,
        required int minHeight,
        required int quality,
      }) async {
        throw Exception('Native plugin not initialized');
      };

      final service = ImageService(compressor: failingCompressor);
      final rawInput = Uint8List.fromList([1, 2, 3, 4, 5]);

      final result = await service.compressImageBytes(rawInput);
      expect(result, rawInput);
    });

    test('pickAndProcessImage returns null when user cancels picker', () async {
      // In host test environment without mocked ImagePicker, pickImage returns null gracefully
      final service = ImageService();
      final result = await service.pickAndProcessImage(ImageSource.camera);
      expect(result, isNull);
    });
  });
}
