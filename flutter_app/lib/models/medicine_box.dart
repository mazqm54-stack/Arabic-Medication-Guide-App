/// Data model for medicine box analysis response from /api/analyze
class MedicineBoxAnalysis {
  final bool isClear;
  final String confidence; // 'high' | 'medium' | 'low'
  final String retakeMessage;
  final String evidenceText;
  final String medicineNameAr;
  final String medicineNameEn;
  final String activeIngredient;
  final List<String> uses;
  final List<String> howAndWhen;
  final List<String> howToUse;
  final List<String> whenToTake;
  final String usageSource; // 'printed' | 'common'
  final List<String> warnings;
  final String audioSummary;
  final String? errorCode;

  const MedicineBoxAnalysis({
    required this.isClear,
    this.confidence = 'medium',
    this.retakeMessage = '',
    this.evidenceText = '',
    this.medicineNameAr = '',
    this.medicineNameEn = '',
    this.activeIngredient = '',
    this.uses = const [],
    this.howAndWhen = const [],
    this.howToUse = const [],
    this.whenToTake = const [],
    this.usageSource = 'common',
    this.warnings = const [],
    this.audioSummary = '',
    this.errorCode,
  });

  factory MedicineBoxAnalysis.fromJson(Map<String, dynamic> json) {
    final rawHowAndWhen = (json['how_and_when'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [];
    final rawHowToUse = (json['how_to_use'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [];
    final rawWhenToTake = (json['when_to_take'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [];

    return MedicineBoxAnalysis(
      isClear: json['is_clear'] as bool? ?? false,
      confidence: json['confidence'] as String? ?? 'low',
      retakeMessage: json['retake_message'] as String? ?? '',
      evidenceText: json['evidence_text'] as String? ?? '',
      medicineNameAr: json['medicine_name_ar'] as String? ?? '',
      medicineNameEn: json['medicine_name_en'] as String? ?? '',
      activeIngredient: json['active_ingredient'] as String? ?? '',
      uses: (json['uses'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      howAndWhen: rawHowAndWhen,
      howToUse: rawHowToUse.isNotEmpty ? rawHowToUse : rawHowAndWhen,
      whenToTake: rawWhenToTake.isNotEmpty ? rawWhenToTake : rawHowAndWhen,
      usageSource: json['usage_source'] as String? ?? 'common',
      warnings: (json['warnings'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      audioSummary: json['audio_summary'] as String? ?? '',
      errorCode: json['error_code'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'is_clear': isClear,
      'confidence': confidence,
      'retake_message': retakeMessage,
      'evidence_text': evidenceText,
      'medicine_name_ar': medicineNameAr,
      'medicine_name_en': medicineNameEn,
      'active_ingredient': activeIngredient,
      'uses': uses,
      'how_and_when': howAndWhen,
      'how_to_use': howToUse,
      'when_to_take': whenToTake,
      'usage_source': usageSource,
      'warnings': warnings,
      'audio_summary': audioSummary,
      'error_code': errorCode,
    };
  }
}
