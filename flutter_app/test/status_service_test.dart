import 'package:flutter_test/flutter_test.dart';
import 'package:dalili_app/services/status_service.dart';

void main() {
  group('AppStatus Version Comparison', () {
    test('numeric comparison: 0.0.10 is higher than 0.0.9', () {
      expect(AppStatus.compareVersions('0.0.10', '0.0.9'), greaterThan(0));
      expect(AppStatus.compareVersions('0.0.9', '0.0.10'), lessThan(0));
    });

    test('equal versions return 0', () {
      expect(AppStatus.compareVersions('0.0.1', '0.0.1'), equals(0));
      expect(AppStatus.compareVersions('0.0.1+1', '0.0.1'), equals(0));
      expect(AppStatus.compareVersions('0.0.2', '0.0.2'), equals(0));
      expect(AppStatus.compareVersions('0.0.3', '0.0.3'), equals(0));
      expect(AppStatus.compareVersions('1.2.3', '1.2.3+4'), equals(0));
    });

    test('installed version equal or higher than latest_version does not trigger update', () {
      // When installed is 0.0.2 and latest is 0.0.2 -> compare is 0 (not < 0, so no banner)
      expect(AppStatus.compareVersions('0.0.2', '0.0.2') < 0, isFalse);
      // When installed is 0.0.3 and latest is 0.0.2 -> compare is > 0 (not < 0, so no banner)
      expect(AppStatus.compareVersions('0.0.3', '0.0.2') < 0, isFalse);
      // When installed is 0.0.1 and latest is 0.0.2 -> compare is < 0 (banner visible)
      expect(AppStatus.compareVersions('0.0.1', '0.0.2') < 0, isTrue);
    });

    test('major and minor comparisons work correctly', () {
      expect(AppStatus.compareVersions('1.0.0', '0.9.9'), greaterThan(0));
      expect(AppStatus.compareVersions('0.1.0', '0.0.9'), greaterThan(0));
      expect(AppStatus.compareVersions('0.0.1', '0.0.2'), lessThan(0));
    });

    test('handles different segment lengths', () {
      expect(AppStatus.compareVersions('0.0.1.1', '0.0.1'), greaterThan(0));
      expect(AppStatus.compareVersions('0.0.1', '0.0.1.1'), lessThan(0));
    });
  });

  group('AppStatus JSON Parsing', () {
    test('correctly parses full JSON payload', () {
      final json = {
        'maintenance': true,
        'maintenance_message': 'صيانة مؤقتة',
        'latest_version': '0.0.2',
        'min_version': '0.0.1',
        'update_url': 'https://example.com/download',
        'update_message': 'تحديث هام',
      };

      final status = AppStatus.fromJson(json);

      expect(status.maintenance, isTrue);
      expect(status.maintenanceMessage, equals('صيانة مؤقتة'));
      expect(status.latestVersion, equals('0.0.2'));
      expect(status.minVersion, equals('0.0.1'));
      expect(status.updateUrl, equals('https://example.com/download'));
      expect(status.updateMessage, equals('تحديث هام'));
    });

    test('handles missing or null fields gracefully', () {
      final status = AppStatus.fromJson({});

      expect(status.maintenance, isFalse);
      expect(status.latestVersion, equals('0.0.1'));
      expect(status.minVersion, equals('0.0.1'));
      expect(status.updateUrl, isEmpty);
      expect(status.maintenanceMessage, isNotEmpty);
      expect(status.updateMessage, isNotEmpty);
    });
  });
}
