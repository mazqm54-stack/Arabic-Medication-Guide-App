import 'dart:io';
import 'dart:math';

/// Service managing anonymous, privacy-safe device identification.
/// Generates a single random device ID on first launch and persists it locally.
/// Never collects, tracks, or transmits any personal data.
class DeviceService {
  static String? _cachedDeviceId;

  /// Returns the persistent anonymous device ID, generating it if needed.
  static Future<String> getDeviceId() async {
    if (_cachedDeviceId != null && _cachedDeviceId!.isNotEmpty) {
      return _cachedDeviceId!;
    }

    try {
      final file = _getStorageFile();
      if (file != null && await file.exists()) {
        final content = (await file.readAsString()).trim();
        if (content.isNotEmpty) {
          _cachedDeviceId = content;
          return content;
        }
      }

      // Generate random anonymous UUID-like string
      final random = Random.secure();
      final now = DateTime.now().millisecondsSinceEpoch;
      final randPart1 = random.nextInt(0xFFFFFF).toRadixString(16).padLeft(6, '0');
      final randPart2 = random.nextInt(0xFFFFFF).toRadixString(16).padLeft(6, '0');
      final newId = 'dev_${now}_${randPart1}${randPart2}';

      if (file != null) {
        try {
          if (!await file.parent.exists()) {
            await file.parent.create(recursive: true);
          }
          await file.writeAsString(newId, flush: true);
        } catch (_) {}
      }

      _cachedDeviceId = newId;
      return newId;
    } catch (_) {
      // In-memory fallback
      _cachedDeviceId = 'dev_${DateTime.now().millisecondsSinceEpoch}_anon';
      return _cachedDeviceId!;
    }
  }

  static File? _getStorageFile() {
    final candidateDirs = [
      '/data/user/0/com.dalili.medicationguide/files',
      '/data/data/com.dalili.medicationguide/files',
      Directory.systemTemp.path,
    ];

    for (final dirPath in candidateDirs) {
      try {
        final dir = Directory(dirPath);
        if (dir.existsSync()) {
          return File('$dirPath/dalili_device_id.txt');
        }
      } catch (_) {}
    }

    try {
      final fallbackDir = Directory(Directory.systemTemp.path);
      return File('${fallbackDir.path}/dalili_device_id.txt');
    } catch (_) {
      return null;
    }
  }
}
