import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image_picker/image_picker.dart';

/// Data class encapsulating processed image bytes and base64 payload.
class ProcessedImage {
  final Uint8List bytes;
  final String base64String;
  final String mimeType;
  final int byteSize;
  final String? originalPath;

  const ProcessedImage({
    required this.bytes,
    required this.base64String,
    this.mimeType = 'image/jpeg',
    required this.byteSize,
    this.originalPath,
  });

  /// Approximate size in megabytes.
  double get sizeInMb => byteSize / (1024 * 1024);
}

/// Pluggable compressor function type for seamless unit testing and dependency injection.
typedef ImageCompressor = Future<Uint8List> Function(
  Uint8List inputBytes, {
  required int minWidth,
  required int minHeight,
  required int quality,
});

/// Service managing camera capture, gallery selection, client-side JPEG compression (<1MB),
/// and base64 encoding.
class ImageService {
  /// Maximum target size before upload: 1MB (1,048,576 bytes).
  static const int maxTargetSizeBytes = 1024 * 1024;

  final ImagePicker _picker;
  final ImageCompressor? _customCompressor;

  ImageService({
    ImagePicker? picker,
    ImageCompressor? compressor,
  })  : _picker = picker ?? ImagePicker(),
        _customCompressor = compressor;

  /// Picks or captures an image from [source] (camera or gallery), compresses it
  /// to JPEG under 1MB, and returns a [ProcessedImage].
  /// Returns `null` if the user cancels or if picking fails.
  Future<ProcessedImage?> pickAndProcessImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 2048,
        maxHeight: 2048,
        imageQuality: 92,
      );

      if (pickedFile == null) {
        return null;
      }

      final Uint8List originalBytes = await pickedFile.readAsBytes();
      final Uint8List compressedBytes = await compressImageBytes(
        originalBytes,
        filePath: pickedFile.path,
      );

      final String base64Payload = base64Encode(compressedBytes);

      return ProcessedImage(
        bytes: compressedBytes,
        base64String: base64Payload,
        mimeType: 'image/jpeg',
        byteSize: compressedBytes.lengthInBytes,
        originalPath: pickedFile.path,
      );
    } catch (e) {
      debugPrint('[ImageService] pickImage unavailable or failed: $e');
      return null;
    }
  }

  /// Compresses given raw image bytes to JPEG under 1MB.
  /// Employs adaptive multi-pass compression:
  /// - Pass 1: 1600x1600 max, 80% quality
  /// - Pass 2 (if > 1MB): 1200x1200 max, 65% quality
  /// - Pass 3 (if still > 1MB): 960x960 max, 50% quality
  /// Includes graceful fallback to original bytes if running on platforms without
  /// native compression plugin (e.g. host test runners).
  Future<Uint8List> compressImageBytes(
    Uint8List rawBytes, {
    String? filePath,
  }) async {
    try {
      // Pass 1: Standard high-quality compression
      Uint8List compressed = await _executeCompress(
        rawBytes,
        filePath: filePath,
        minWidth: 1600,
        minHeight: 1600,
        quality: 80,
      );

      // Pass 2: If still exceeds 1MB, apply moderate compression
      if (compressed.lengthInBytes > maxTargetSizeBytes) {
        compressed = await _executeCompress(
          compressed,
          minWidth: 1200,
          minHeight: 1200,
          quality: 65,
        );
      }

      // Pass 3: If still exceeds 1MB, apply compact compression
      if (compressed.lengthInBytes > maxTargetSizeBytes) {
        compressed = await _executeCompress(
          compressed,
          minWidth: 960,
          minHeight: 960,
          quality: 50,
        );
      }

      return compressed;
    } catch (e) {
      debugPrint('[ImageService] Native compression unavailable or failed: $e. Falling back to raw bytes.');
      return rawBytes;
    }
  }

  /// Compresses an image file from local path [filePath] to JPEG under 1MB.
  Future<Uint8List> compressImageFile(String filePath) async {
    final file = File(filePath);
    final rawBytes = await file.readAsBytes();
    return compressImageBytes(rawBytes, filePath: filePath);
  }

  /// Encodes raw bytes to base64 string.
  String toBase64(Uint8List bytes) {
    return base64Encode(bytes);
  }

  /// Creates a small thumbnail (max ~200px width/height, ~60% quality) encoded in base64.
  Future<String> createThumbnailBase64(
    Uint8List originalBytes, {
    String? filePath,
  }) async {
    try {
      final compressed = await _executeCompress(
        originalBytes,
        filePath: filePath,
        minWidth: 200,
        minHeight: 200,
        quality: 60,
      );
      return base64Encode(compressed);
    } catch (_) {
      if (originalBytes.lengthInBytes > 100 * 1024) {
        return '';
      }
      return base64Encode(originalBytes);
    }
  }

  /// Internal compression dispatcher supporting custom compressor injection or native plugin.
  Future<Uint8List> _executeCompress(
    Uint8List bytes, {
    String? filePath,
    required int minWidth,
    required int minHeight,
    required int quality,
  }) async {
    final customCompressor = _customCompressor;
    if (customCompressor != null) {
      return customCompressor(
        bytes,
        minWidth: minWidth,
        minHeight: minHeight,
        quality: quality,
      );
    }

    if (filePath != null && filePath.isNotEmpty && !kIsWeb) {
      try {
        final result = await FlutterImageCompress.compressWithFile(
          filePath,
          minWidth: minWidth,
          minHeight: minHeight,
          quality: quality,
          format: CompressFormat.jpeg,
        );
        if (result != null && result.isNotEmpty) {
          return Uint8List.fromList(result);
        }
      } catch (_) {
        // Fall back to compressWithList below
      }
    }

    final result = await FlutterImageCompress.compressWithList(
      bytes,
      minWidth: minWidth,
      minHeight: minHeight,
      quality: quality,
      format: CompressFormat.jpeg,
    );

    if (result.isNotEmpty) {
      return Uint8List.fromList(result);
    }

    return bytes;
  }
}
