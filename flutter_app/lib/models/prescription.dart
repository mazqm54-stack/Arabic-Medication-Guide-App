/// Data models for prescription analysis response from /api/prescription

class SuggestedMedicine {
  final String nameAr;
  final String nameEn;
  final String confidence; // 'high' | 'medium' | 'low'

  const SuggestedMedicine({
    required this.nameAr,
    required this.nameEn,
    this.confidence = 'medium',
  });

  factory SuggestedMedicine.fromJson(Map<String, dynamic> json) {
    return SuggestedMedicine(
      nameAr: json['name_ar'] as String? ?? json['name'] as String? ?? '',
      nameEn: json['name_en'] as String? ?? '',
      confidence: json['confidence'] as String? ?? 'low',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name_ar': nameAr,
      'name_en': nameEn,
      'confidence': confidence,
    };
  }
}

class PrescriptionItem {
  final String lineTextAsWritten;
  final bool isConfirmed;
  final String status; // 'confirmed' | 'suggested' | 'unclear'
  final String medicineNameAr;
  final String medicineNameEn;
  final String activeIngredient;
  final String confidence; // 'high' | 'medium' | 'low'
  final String writtenInstructions;
  final String shortExplanation;
  final String visibleLetters;
  final List<SuggestedMedicine> suggestedMedicines;
  final String warningNote;

  const PrescriptionItem({
    required this.lineTextAsWritten,
    this.isConfirmed = false,
    this.status = 'suggested',
    this.medicineNameAr = '',
    this.medicineNameEn = '',
    this.activeIngredient = '',
    this.confidence = 'medium',
    this.writtenInstructions = '',
    this.shortExplanation = '',
    this.visibleLetters = '',
    this.suggestedMedicines = const [],
    this.warningNote = '',
  });

  bool get isConfirmedMedicine => isConfirmed && status == 'confirmed';

  factory PrescriptionItem.fromJson(Map<String, dynamic> json) {
    final status = json['status'] as String? ??
        ((json['is_confirmed'] == true) ? 'confirmed' : 'suggested');
    final isConfirmed = json['is_confirmed'] as bool? ?? (status == 'confirmed');
    final isFullyConfirmed = isConfirmed && status == 'confirmed';

    final rawSuggestions = json['suggested_medicines'] as List<dynamic>?;
    final List<SuggestedMedicine> suggestions = rawSuggestions != null
        ? rawSuggestions
            .map((e) => e is Map<String, dynamic>
                ? SuggestedMedicine.fromJson(e)
                : SuggestedMedicine(nameAr: e.toString(), nameEn: ''))
            .toList()
        : const [];

    return PrescriptionItem(
      lineTextAsWritten: json['line_text_as_written'] as String? ?? '',
      isConfirmed: isConfirmed,
      status: status,
      medicineNameAr: json['medicine_name_ar'] as String? ?? '',
      medicineNameEn: json['medicine_name_en'] as String? ?? '',
      activeIngredient: json['active_ingredient'] as String? ?? '',
      confidence: json['confidence'] as String? ?? 'medium',
      writtenInstructions: isFullyConfirmed
          ? (json['written_instructions'] as String? ?? '')
          : '',
      shortExplanation: isFullyConfirmed
          ? (json['short_explanation'] as String? ?? '')
          : '',
      visibleLetters: json['visible_letters'] as String? ?? '',
      suggestedMedicines: suggestions,
      warningNote: json['warning_note'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'line_text_as_written': lineTextAsWritten,
      'is_confirmed': isConfirmed,
      'status': status,
      'medicine_name_ar': medicineNameAr,
      'medicine_name_en': medicineNameEn,
      'active_ingredient': activeIngredient,
      'confidence': confidence,
      'written_instructions': writtenInstructions,
      'short_explanation': shortExplanation,
      'visible_letters': visibleLetters,
      'suggested_medicines': suggestedMedicines.map((e) => e.toJson()).toList(),
      'warning_note': warningNote,
    };
  }
}

class PrescriptionAnalysis {
  final bool isClear;
  final String confidence;
  final String retakeMessage;
  final String evidenceText;
  final String deducedCondition;
  final List<PrescriptionItem> items;
  final String audioSummary;
  final String? errorCode;
  final bool isHard;
  final bool deepImproved;

  const PrescriptionAnalysis({
    required this.isClear,
    this.confidence = 'medium',
    this.retakeMessage = '',
    this.evidenceText = '',
    this.deducedCondition = '',
    this.items = const [],
    this.audioSummary = '',
    this.errorCode,
    this.isHard = false,
    this.deepImproved = false,
  });

  factory PrescriptionAnalysis.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>?;
    final List<PrescriptionItem> parsedItems = rawItems != null
        ? rawItems
            .map((e) => PrescriptionItem.fromJson(e as Map<String, dynamic>))
            .toList()
        : const [];

    return PrescriptionAnalysis(
      isClear: json['is_clear'] as bool? ?? false,
      confidence: json['confidence'] as String? ?? 'low',
      retakeMessage: json['retake_message'] as String? ?? '',
      evidenceText: json['evidence_text'] as String? ?? '',
      deducedCondition: json['deduced_condition'] as String? ?? '',
      items: parsedItems,
      audioSummary: json['audio_summary'] as String? ?? '',
      errorCode: json['error_code'] as String?,
      isHard: json['hard'] as bool? ?? false,
      deepImproved: json['deep_improved'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'is_clear': isClear,
      'confidence': confidence,
      'retake_message': retakeMessage,
      'evidence_text': evidenceText,
      'deduced_condition': deducedCondition,
      'items': items.map((e) => e.toJson()).toList(),
      'audio_summary': audioSummary,
      'error_code': errorCode,
      'hard': isHard,
      'deep_improved': deepImproved,
    };
  }
}
