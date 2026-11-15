import 'dart:convert';

/// Represents a single saved analysis result in local history.
class HistoryItem {
  final String id;
  final DateTime timestamp;
  final String type; // 'box' | 'prescription'
  final String title;
  final String subtitle;
  final String confidence; // 'high' | 'medium' | 'low'
  final String thumbnailBase64;
  final Map<String, dynamic> rawJson;

  const HistoryItem({
    required this.id,
    required this.timestamp,
    required this.type,
    required this.title,
    this.subtitle = '',
    this.confidence = 'medium',
    this.thumbnailBase64 = '',
    required this.rawJson,
  });

  /// Human-friendly Arabic formatted date and time.
  String get formattedDateTime {
    final year = timestamp.year;
    final month = timestamp.month.toString().padLeft(2, '0');
    final day = timestamp.day.toString().padLeft(2, '0');
    final hour24 = timestamp.hour;
    final hour12 = hour24 == 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
    final hourFormatted = hour12.toString().padLeft(2, '0');
    final minute = timestamp.minute.toString().padLeft(2, '0');
    final period = hour24 >= 12 ? 'م' : 'ص';
    return '$year/$month/$day - $hourFormatted:$minute $period';
  }

  factory HistoryItem.fromJson(Map<String, dynamic> json) {
    return HistoryItem(
      id: json['id'] as String? ?? DateTime.now().millisecondsSinceEpoch.toString(),
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now()
          : DateTime.now(),
      type: json['type'] as String? ?? 'box',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      confidence: json['confidence'] as String? ?? 'medium',
      thumbnailBase64: json['thumbnail_base64'] as String? ?? '',
      rawJson: json['raw_json'] is Map<String, dynamic>
          ? json['raw_json'] as Map<String, dynamic>
          : (json['raw_json'] is String
              ? jsonDecode(json['raw_json'] as String) as Map<String, dynamic>
              : {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'timestamp': timestamp.toIso8601String(),
      'type': type,
      'title': title,
      'subtitle': subtitle,
      'confidence': confidence,
      'thumbnail_base64': thumbnailBase64,
      'raw_json': rawJson,
    };
  }
}
