import 'dart:math';

/// Remote application status configuration received from Cloudflare KV via `/api/status`.
class AppStatus {
  final bool maintenance;
  final String maintenanceMessage;
  final String latestVersion;
  final String minVersion;
  final String updateUrl;
  final String updateMessage;

  const AppStatus({
    required this.maintenance,
    required this.maintenanceMessage,
    required this.latestVersion,
    required this.minVersion,
    required this.updateUrl,
    required this.updateMessage,
  });

  factory AppStatus.fromJson(Map<String, dynamic> json) {
    return AppStatus(
      maintenance: json['maintenance'] == true,
      maintenanceMessage: (json['maintenance_message'] as String?)?.trim() ??
          'النظام قيد الصيانة حالياً. يرجى المحاولة لاحقاً.',
      latestVersion: (json['latest_version'] as String?)?.trim() ?? '0.0.1',
      minVersion: (json['min_version'] as String?)?.trim() ?? '0.0.1',
      updateUrl: (json['update_url'] as String?)?.trim() ?? '',
      updateMessage: (json['update_message'] as String?)?.trim() ??
          'يتوفر إصدار جديد من تطبيق دليلي الدوائي. يرجى التحديث للحصول على أحدث الميزات.',
    );
  }

  /// Compares two semantic version strings numerically part-by-part.
  /// Ignores build metadata suffix (+1).
  ///
  /// Examples:
  ///   compareVersions("0.0.10", "0.0.9") > 0
  ///   compareVersions("0.0.1", "0.0.1+1") == 0
  ///   compareVersions("0.0.1", "0.0.2") < 0
  static int compareVersions(String v1, String v2) {
    final clean1 = v1.split('+').first.trim();
    final clean2 = v2.split('+').first.trim();

    final parts1 = clean1.split('.').map((s) => int.tryParse(s) ?? 0).toList();
    final parts2 = clean2.split('.').map((s) => int.tryParse(s) ?? 0).toList();

    final maxLen = max(parts1.length, parts2.length);
    for (int i = 0; i < maxLen; i++) {
      final p1 = i < parts1.length ? parts1[i] : 0;
      final p2 = i < parts2.length ? parts2[i] : 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  }
}
