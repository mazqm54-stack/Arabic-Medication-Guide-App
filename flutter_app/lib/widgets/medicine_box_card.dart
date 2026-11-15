import 'package:flutter/material.dart';
import '../constants/theme.dart';
import '../models/medicine_box.dart';
import '../services/api_service.dart';
import 'feedback_widget.dart';

/// Presentation card displaying structured medicine box analysis results.
/// Features RTL Arabic layout, Material 3 styling, active ingredient chip,
/// usage guidelines, and high-visibility warning section.
class MedicineBoxCard extends StatelessWidget {
  final MedicineBoxAnalysis analysis;
  final VoidCallback? onNewScan;
  final ApiService? apiService;

  const MedicineBoxCard({
    super.key,
    required this.analysis,
    this.onNewScan,
    this.apiService,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final confidenceColor = AppTheme.getConfidenceColor(analysis.confidence, isDark: isDark);
    final cardBgColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            margin: EdgeInsets.zero,
            elevation: 2,
            color: cardBgColor,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
              side: BorderSide(
                color: confidenceColor.withValues(alpha: isDark ? 0.45 : 0.35),
                width: 1.5,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildHeaderRow(context),
                  const SizedBox(height: 14),
                  _buildMedicineTitle(),
                  if (analysis.activeIngredient.trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _buildActiveIngredientChip(),
                  ],
                  const SizedBox(height: 18),
                  Divider(
                    color: isDark ? const Color(0xFF334155) : AppTheme.dividerColor,
                    height: 1,
                  ),
                  const SizedBox(height: 18),
                  if (analysis.uses.isNotEmpty) ...[
                    _buildUsesSection(),
                    const SizedBox(height: 18),
                  ],
                  if (analysis.howAndWhen.isNotEmpty) ...[
                    _buildHowAndWhenSection(),
                    const SizedBox(height: 18),
                  ],
                  if (analysis.warnings.isNotEmpty) ...[
                    _buildWarningsSection(),
                    const SizedBox(height: 18),
                  ],
                  if (analysis.evidenceText.trim().isNotEmpty) ...[
                    _buildEvidenceSection(),
                    const SizedBox(height: 18),
                  ],
                  _buildAdvisoryFooter(),
                ],
              ),
            ),
          ),
          FeedbackWidget(type: 'box', apiService: apiService),
          if (onNewScan != null) ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onNewScan,
              icon: const Icon(Icons.refresh_rounded, size: 20),
              label: const Text('تحليل علبة جديدة'),
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

  /// Top badge and confidence rating row
  Widget _buildHeaderRow(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: AppTheme.primaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.medication_rounded,
                size: 16,
                color: AppTheme.primaryTeal,
              ),
              SizedBox(width: 6),
              Text(
                'علبة دواء مؤكدة',
                style: TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryTeal,
                ),
              ),
            ],
          ),
        ),
        _buildConfidenceBadge(context, analysis.confidence),
      ],
    );
  }

  /// Dynamic confidence indicator badge with color and icon
  Widget _buildConfidenceBadge(BuildContext context, String confidence) {
    String label;
    switch (confidence.toLowerCase()) {
      case 'high':
        label = 'دقة قراءة عالية';
        break;
      case 'medium':
        label = 'دقة قراءة متوسطة';
        break;
      default:
        label = 'دقة قراءة منخفضة';
        break;
    }

    return AppTheme.buildConfidenceBadge(
      context: context,
      confidence: confidence,
      labelText: label,
    );
  }

  /// Arabic and English medicine names
  Widget _buildMedicineTitle() {
    final arName = analysis.medicineNameAr.trim().isNotEmpty
        ? analysis.medicineNameAr
        : 'اسم الدواء غير محدد';
    final enName = analysis.medicineNameEn.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          arName,
          style: const TextStyle(
            fontFamily: AppTheme.fontFamily,
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
            height: 1.3,
          ),
        ),
        if (enName.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            enName,
            style: const TextStyle(
              fontFamily: AppTheme.fontFamily,
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppTheme.textSecondary,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ],
    );
  }

  /// Active ingredient chip
  Widget _buildActiveIngredientChip() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.science_outlined,
            size: 18,
            color: Color(0xFF166534),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'المادة الفعالة: ${analysis.activeIngredient}',
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF166534),
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Uses / Indications section
  Widget _buildUsesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionHeader(
          icon: Icons.check_circle_outline_rounded,
          iconColor: AppTheme.primaryTeal,
          title: 'دواعي الاستعمال',
        ),
        const SizedBox(height: 10),
        for (final use in analysis.uses)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 6, left: 10),
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: AppTheme.primaryTeal,
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(
                  child: Text(
                    use,
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 14,
                      color: AppTheme.textPrimary,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  /// How and when to use section
  Widget _buildHowAndWhenSection() {
    final isPrinted = analysis.usageSource == 'printed';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildSectionHeader(
              icon: Icons.schedule_rounded,
              iconColor: AppTheme.primaryTeal,
              title: 'طريقة ومواعيد الاستخدام',
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: isPrinted
                    ? AppTheme.primaryContainer
                    : AppTheme.warningOrangeBackground,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                isPrinted ? 'مطبوع على العلبة' : 'إرشادات شائعة',
                style: TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: isPrinted
                    ? AppTheme.primaryTeal
                    : AppTheme.warningOrangeText,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (final instruction in analysis.howAndWhen)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.arrow_left_rounded,
                  size: 20,
                  color: AppTheme.primaryTeal,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    instruction,
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 14,
                      color: AppTheme.textPrimary,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  /// High-visibility warnings section with WCAG AA compliant contrast
  Widget _buildWarningsSection() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.warningOrangeBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.warningOrangeBorder, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.warning_amber_rounded,
                color: AppTheme.warningOrange,
                size: 20,
              ),
              SizedBox(width: 8),
              Text(
                'تحذيرات واحتياطات هامة',
                style: TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.warningOrangeText,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final warning in analysis.warnings)
            Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 6, left: 8),
                  width: 5,
                  height: 5,
                  decoration: const BoxDecoration(
                    color: AppTheme.warningOrangeText,
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(
                  child: Text(
                    warning,
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.warningOrangeText,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Collapsible / expandable or subtle evidence text section
  Widget _buildEvidenceSection() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.backgroundLight,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.document_scanner_outlined,
                size: 16,
                color: AppTheme.textSecondary,
              ),
              SizedBox(width: 6),
              Text(
                'النص المقروء من العلبة للتحقق:',
                style: TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            analysis.evidenceText,
            style: const TextStyle(
              fontFamily: AppTheme.fontFamily,
              fontSize: 12,
              color: AppTheme.textMuted,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  /// Standard clinical safety footer
  Widget _buildAdvisoryFooter() {
    return const Center(
      child: Text(
        'دليلي الدوائي أداة استرشادية ذكية ولا تغني عن استشارة الصيدلي أو الطبيب المعالج.',
        style: TextStyle(
          fontFamily: AppTheme.fontFamily,
          fontSize: 11,
          color: AppTheme.textMuted,
          height: 1.4,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  Widget _buildSectionHeader({
    required IconData icon,
    required Color iconColor,
    required String title,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: iconColor),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontFamily: AppTheme.fontFamily,
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
      ],
    );
  }
}
