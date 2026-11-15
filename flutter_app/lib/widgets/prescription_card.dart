import 'package:flutter/material.dart';
import '../constants/theme.dart';
import '../models/medicine_box.dart';
import '../models/prescription.dart';
import '../services/api_service.dart';
import 'feedback_widget.dart';

/// Clinical Condition Banner displayed at top of prescription results
/// when an underlying medical condition has been deduced.
class PrescriptionConditionBanner extends StatelessWidget {
  final String condition;

  const PrescriptionConditionBanner({
    super.key,
    required this.condition,
  });

  @override
  Widget build(BuildContext context) {
    if (condition.trim().isEmpty) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0D3B40) : const Color(0xFFE6F3F4),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? AppTheme.secondaryTeal : AppTheme.secondaryTeal,
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: AppTheme.primaryTeal,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.medical_services_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'التشخيص الطبي المستنتج',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: isDark ? AppTheme.secondaryTeal : AppTheme.primaryTeal,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    condition,
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : AppTheme.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Unified, minimal Prescription Medicine Card.
/// Displays ONLY:
/// - Generic medicine name
/// - Trade/brand name
/// - Confidence level (high / medium / low)
/// All cards share the exact same clean Material 3 design and color.
/// Tapping the card opens the details sheet.
class PrescriptionMedicineCard extends StatelessWidget {
  final PrescriptionItem item;
  final int index;
  final ApiService? apiService;
  final VoidCallback? onTap;

  const PrescriptionMedicineCard({
    super.key,
    required this.item,
    this.index = 1,
    this.apiService,
    this.onTap,
  });

  String _getTradeName() {
    if (item.medicineNameAr.trim().isNotEmpty) {
      return item.medicineNameAr.trim();
    }
    if (item.medicineNameEn.trim().isNotEmpty) {
      return item.medicineNameEn.trim();
    }
    if (item.suggestedMedicines.isNotEmpty) {
      final first = item.suggestedMedicines.first;
      if (first.nameAr.trim().isNotEmpty) return first.nameAr.trim();
      if (first.nameEn.trim().isNotEmpty) return first.nameEn.trim();
    }
    final letters = item.visibleLetters.trim();
    if (letters.isNotEmpty) {
      return 'سطر غير واضح ($letters)';
    }
    return 'سطر غير واضح';
  }

  String _getGenericName() {
    if (item.activeIngredient.trim().isNotEmpty) {
      return item.activeIngredient.trim();
    }
    if (item.medicineNameEn.trim().isNotEmpty &&
        item.medicineNameEn.trim() != item.medicineNameAr.trim()) {
      return item.medicineNameEn.trim();
    }
    return '';
  }

  void _handleTap(BuildContext context) {
    if (onTap != null) {
      onTap!();
      return;
    }

    final trade = _getTradeName();
    final lookupName = (!trade.startsWith('سطر غير واضح'))
        ? trade
        : (_getGenericName().isNotEmpty
            ? _getGenericName()
            : (item.visibleLetters.trim().isNotEmpty
                ? item.visibleLetters.trim()
                : item.lineTextAsWritten));

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => MedicineDetailsSheet(
        medicineName: lookupName,
        item: item,
        apiService: apiService,
      ),
    );
  }

  Widget _buildConfidenceBadge(BuildContext context, String confidence) {
    String label;
    switch (confidence.toLowerCase()) {
      case 'high':
        label = 'ثقة مرتفعة';
        break;
      case 'medium':
        label = 'ثقة متوسطة';
        break;
      default:
        label = 'ثقة منخفضة';
        break;
    }

    return AppTheme.buildConfidenceBadge(
      context: context,
      confidence: confidence,
      labelText: label,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tradeName = _getTradeName();
    final genericName = _getGenericName();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final confidenceColor = AppTheme.getConfidenceColor(item.confidence, isDark: isDark);
    final cardBgColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        elevation: 1.5,
        color: cardBgColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: confidenceColor.withValues(alpha: isDark ? 0.4 : 0.25),
            width: 1,
          ),
        ),
        child: InkWell(
          onTap: () => _handleTap(context),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardBgColor,
              borderRadius: const BorderRadius.all(Radius.circular(16)),
              border: Border(
                right: BorderSide(color: confidenceColor, width: 4),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top Row: index + confidence badge with icon & color
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'دواء #$index',
                      style: TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isDark ? const Color(0xFF94A3B8) : AppTheme.textSecondary,
                      ),
                    ),
                    _buildConfidenceBadge(context, item.confidence),
                  ],
                ),
                const SizedBox(height: 10),

                // Trade / Brand Name
                Text(
                  tradeName,
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : AppTheme.textPrimary,
                  ),
                ),

                // Generic Name (Active Ingredient)
                if (genericName.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'الاسم العلمي: $genericName',
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primaryTeal,
                    ),
                  ),
                ],

                const SizedBox(height: 12),

                // Tap for more details prompt
                const Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      'عرض التفاصيل',
                      style: TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryTeal,
                      ),
                    ),
                    SizedBox(width: 4),
                    Icon(
                      Icons.arrow_back_ios_new_rounded,
                      size: 13,
                      color: AppTheme.primaryTeal,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Modal Bottom Sheet that fetches and displays detailed medicine information
/// on demand in clearly separated sections:
/// 1. Generic medicine name
/// 2. Trade/brand name (as its own section)
/// 3. Uses (دواعي الاستعمال)
/// 4. How to use it (كيفية الاستخدام)
/// 5. When to take it (أوقات الاستخدام)
class MedicineDetailsSheet extends StatefulWidget {
  final String medicineName;
  final PrescriptionItem item;
  final ApiService? apiService;

  const MedicineDetailsSheet({
    super.key,
    required this.medicineName,
    required this.item,
    this.apiService,
  });

  @override
  State<MedicineDetailsSheet> createState() => _MedicineDetailsSheetState();
}

class _MedicineDetailsSheetState extends State<MedicineDetailsSheet> {
  late final ApiService _apiService;
  bool _isLoading = true;
  String? _errorMessage;
  MedicineBoxAnalysis? _details;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await _apiService.getMedicineDetails(widget.medicineName);
      if (mounted) {
        setState(() {
          _details = result;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _errorMessage = 'تعذّر تحميل التفاصيل';
          _isLoading = false;
        });
      }
    }
  }

  Widget _buildSection({
    required BuildContext context,
    required IconData icon,
    required String title,
    required Widget content,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF282828) : const Color(0xFFF8F9FA),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? const Color(0xFF383838) : const Color(0xFFE9ECEF),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppTheme.primaryTeal),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryTeal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          content,
        ],
      ),
    );
  }

  List<String> _extractUses() {
    if (_details != null && _details!.uses.isNotEmpty) {
      return _details!.uses;
    }
    return const [];
  }

  List<String> _extractHowToUse() {
    if (_details != null && _details!.howToUse.isNotEmpty) {
      return _details!.howToUse;
    }
    return ['تناول الدواء مع كوب كامل من الماء.', 'التزم بتعليمات الطبيب المكتوبة.'];
  }

  List<String> _extractWhenToTake() {
    if (_details != null && _details!.whenToTake.isNotEmpty) {
      return _details!.whenToTake;
    }
    if (widget.item.writtenInstructions.isNotEmpty) {
      return [widget.item.writtenInstructions];
    }
    return ['حسب التوجيهات الطبية أو عند اللزوم.'];
  }

  @override
  Widget build(BuildContext context) {
    final genericName = (_details?.activeIngredient.isNotEmpty == true)
        ? _details!.activeIngredient
        : (widget.item.activeIngredient.isNotEmpty
            ? widget.item.activeIngredient
            : widget.medicineName);

    final tradeNameAr = (_details?.medicineNameAr.isNotEmpty == true)
        ? _details!.medicineNameAr
        : widget.item.medicineNameAr;

    final tradeNameEn = (_details?.medicineNameEn.isNotEmpty == true)
        ? _details!.medicineNameEn
        : widget.item.medicineNameEn;

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF4B5563) : Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Sheet Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'تفاصيل الدواء',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : AppTheme.textPrimary,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: Icon(
                      Icons.close_rounded,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                    splashRadius: 20,
                  ),
                ],
              ),
            ),
            Divider(
              height: 1,
              color: isDark ? const Color(0xFF334155) : AppTheme.dividerColor,
            ),

            // Content body
            Flexible(
              child: _isLoading
                  ? Padding(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const CircularProgressIndicator(
                              color: AppTheme.primaryTeal,
                              strokeWidth: 3,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'جاري تحميل تفاصيل الدواء...',
                              style: TextStyle(
                                fontFamily: AppTheme.fontFamily,
                                fontSize: 13,
                                color: isDark
                                    ? const Color(0xFF94A3B8)
                                    : AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : _errorMessage != null
                      ? Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.info_outline_rounded,
                                size: 40,
                                color: AppTheme.textMuted,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontFamily: AppTheme.fontFamily,
                                  fontSize: 14,
                                  color: isDark
                                      ? const Color(0xFF94A3B8)
                                      : AppTheme.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadDetails,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.primaryTeal,
                                  foregroundColor: Colors.white,
                                ),
                                child: const Text('إعادة المحاولة'),
                              ),
                            ],
                          ),
                        )
                      : SingleChildScrollView(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // 1. Generic Name (الاسم العلمي / المادة الفعالة)
                              _buildSection(
                                context: context,
                                icon: Icons.science_outlined,
                                title: 'الاسم العلمي (المادة الفعالة)',
                                content: Text(
                                  genericName,
                                  style: TextStyle(
                                    fontFamily: AppTheme.fontFamily,
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: isDark
                                        ? Colors.white
                                        : AppTheme.textPrimary,
                                  ),
                                ),
                              ),

                              // 2. Trade/Brand Name (الاسم التجاري)
                              _buildSection(
                                context: context,
                                icon: Icons.medication_rounded,
                                title: 'الاسم التجاري',
                                content: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (tradeNameAr.isNotEmpty)
                                      Text(
                                        tradeNameAr,
                                        style: TextStyle(
                                          fontFamily: AppTheme.fontFamily,
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: isDark
                                              ? Colors.white
                                              : AppTheme.textPrimary,
                                        ),
                                      ),
                                    if (tradeNameEn.isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        tradeNameEn,
                                        style: TextStyle(
                                          fontFamily: AppTheme.fontFamily,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: isDark
                                              ? const Color(0xFF94A3B8)
                                              : AppTheme.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),

                              // 3. Uses (دواعي الاستعمال)
                              _buildSection(
                                context: context,
                                icon: Icons.healing_rounded,
                                title: 'دواعي الاستعمال',
                                content: _extractUses().isNotEmpty
                                    ? Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: _extractUses()
                                            .map((use) => Padding(
                                                  padding:
                                                      const EdgeInsets.only(bottom: 4),
                                                  child: Row(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment.start,
                                                    children: [
                                                      const Text('• ',
                                                          style: TextStyle(
                                                              color: AppTheme
                                                                  .primaryTeal,
                                                              fontWeight: FontWeight
                                                                  .bold)),
                                                      Expanded(
                                                        child: Text(
                                                          use,
                                                          style: TextStyle(
                                                            fontFamily:
                                                                AppTheme.fontFamily,
                                                            fontSize: 14,
                                                            color: isDark
                                                                ? const Color(
                                                                    0xFFF1F5F9)
                                                                : AppTheme
                                                                    .textPrimary,
                                                            height: 1.35,
                                                          ),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ))
                                            .toList(),
                                      )
                                    : Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'تعذّر تحميل التفاصيل',
                                            style: TextStyle(
                                              fontFamily: AppTheme.fontFamily,
                                              fontSize: 14,
                                              color: isDark
                                                  ? const Color(0xFF94A3B8)
                                                  : AppTheme.textSecondary,
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          OutlinedButton.icon(
                                            onPressed: _loadDetails,
                                            icon: const Icon(
                                                Icons.refresh_rounded,
                                                size: 16),
                                            label: const Text('إعادة المحاولة'),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor:
                                                  AppTheme.primaryTeal,
                                              padding: const EdgeInsets.symmetric(
                                                  horizontal: 12, vertical: 6),
                                              textStyle: const TextStyle(
                                                fontFamily: AppTheme.fontFamily,
                                                fontSize: 13,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                              ),

                              // 4. How to use (كيفية الاستخدام)
                              _buildSection(
                                context: context,
                                icon: Icons.menu_book_rounded,
                                title: 'كيفية الاستخدام',
                                content: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: _extractHowToUse()
                                      .map((item) => Padding(
                                            padding: const EdgeInsets.only(
                                                bottom: 4),
                                            child: Row(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                const Text('• ',
                                                    style: TextStyle(
                                                        color: AppTheme
                                                            .primaryTeal,
                                                        fontWeight:
                                                            FontWeight.bold)),
                                                Expanded(
                                                  child: Text(
                                                    item,
                                                    style: TextStyle(
                                                      fontFamily:
                                                          AppTheme.fontFamily,
                                                      fontSize: 14,
                                                      color: isDark
                                                          ? const Color(
                                                              0xFFF1F5F9)
                                                          : AppTheme.textPrimary,
                                                      height: 1.35,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ))
                                      .toList(),
                                ),
                              ),

                              // 5. When to take it (أوقات الاستخدام)
                              _buildSection(
                                context: context,
                                icon: Icons.schedule_rounded,
                                title: 'أوقات الاستخدام',
                                content: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: _extractWhenToTake()
                                      .map((item) => Padding(
                                            padding: const EdgeInsets.only(
                                                bottom: 4),
                                            child: Row(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                const Text('• ',
                                                    style: TextStyle(
                                                        color: AppTheme
                                                            .primaryTeal,
                                                        fontWeight:
                                                            FontWeight.bold)),
                                                Expanded(
                                                  child: Text(
                                                    item,
                                                    style: TextStyle(
                                                      fontFamily:
                                                          AppTheme.fontFamily,
                                                      fontSize: 14,
                                                      color: isDark
                                                          ? const Color(
                                                              0xFFF1F5F9)
                                                          : AppTheme.textPrimary,
                                                      height: 1.35,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ))
                                      .toList(),
                                ),
                              ),
                            ],
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Full Prescription Results View displaying condition banner, item cards, and action buttons.
class PrescriptionView extends StatelessWidget {
  final PrescriptionAnalysis analysis;
  final ApiService? apiService;
  final VoidCallback? onNewScan;

  const PrescriptionView({
    super.key,
    required this.analysis,
    this.apiService,
    this.onNewScan,
  });

  /// Merges cards that are exactly identical (same name, strength/line text, and directions).
  static List<PrescriptionItem> mergeDuplicateItems(List<PrescriptionItem> items) {
    final List<PrescriptionItem> merged = [];
    final Set<String> seen = {};

    for (final item in items) {
      final name = (item.medicineNameEn.isNotEmpty
              ? item.medicineNameEn
              : (item.medicineNameAr.isNotEmpty
                  ? item.medicineNameAr
                  : item.visibleLetters))
          .trim()
          .toLowerCase()
          .replaceAll(RegExp(r'\s+'), ' ');
      final line = item.lineTextAsWritten
          .trim()
          .toLowerCase()
          .replaceAll(RegExp(r'\s+'), ' ');
      final directions = item.writtenInstructions
          .trim()
          .toLowerCase()
          .replaceAll(RegExp(r'\s+'), ' ');

      final key = '$name|$line|$directions';
      if (!seen.contains(key)) {
        seen.add(key);
        merged.add(item);
      }
    }
    return merged;
  }

  @override
  Widget build(BuildContext context) {
    final displayItems = mergeDuplicateItems(analysis.items);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Clinical condition banner if deduced
          if (analysis.deducedCondition.trim().isNotEmpty)
            PrescriptionConditionBanner(condition: analysis.deducedCondition),

          // Medicine Item Cards (after deduplication)
          if (displayItems.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'لم يتم العثور على أدوية مقروءة في هذه الروشتة.',
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 15,
                    color: AppTheme.textMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          else
            for (int i = 0; i < displayItems.length; i++)
              PrescriptionMedicineCard(
                item: displayItems[i],
                index: i + 1,
                apiService: apiService,
              ),

          // User Feedback Buttons
          FeedbackWidget(type: 'prescription', apiService: apiService),

          // New Scan Action Button
          if (onNewScan != null) ...[
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: onNewScan,
              icon: const Icon(Icons.refresh_rounded, size: 20),
              label: const Text('تحليل روشتة جديدة'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: AppTheme.primaryTeal,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Backward compatibility alias
typedef PrescriptionCard = PrescriptionMedicineCard;
