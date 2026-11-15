import 'package:flutter/material.dart';
import '../constants/theme.dart';

/// Friendly Arabic guidance card displayed when image quality is inadequate (`isClear == false`)
/// or on capture error. Features 3 actionable tips for capturing a clear photo.
class RetakeGuidanceCard extends StatelessWidget {
  final String? retakeMessage;
  final VoidCallback onRetake;
  final VoidCallback? onPickGallery;

  const RetakeGuidanceCard({
    super.key,
    this.retakeMessage,
    required this.onRetake,
    this.onPickGallery,
  });

  @override
  Widget build(BuildContext context) {
    final message = (retakeMessage != null && retakeMessage!.trim().isNotEmpty)
        ? retakeMessage!
        : 'الصورة غير واضحة بما يكفي للتعرف الدقيق على الدواء. يرجى اتباع الإرشادات التالية للحصول على أفضل نتيجة:';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Card(
        margin: EdgeInsets.zero,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppTheme.dividerColor, width: 1),
        ),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top illustration badge
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFFF8E1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.center_focus_strong_rounded,
                    size: 38,
                    color: Color(0xFFD97706),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Card title
              const Text(
                'نحتاج صورة أكثر وضوحاً',
                style: TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              // Empathetic message
              Text(
                message,
                style: const TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 14,
                  color: AppTheme.textSecondary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              // 3-Point Guidance Tiles
              _buildGuidanceTile(
                number: '١',
                icon: Icons.light_mode_outlined,
                iconColor: const Color(0xFFD97706),
                title: 'إضاءة جيدة بدون ظلال أو لمعان قوي',
                subtitle: 'صوّر في مكان مضاء جيداً وتجنب انعكاس فلاش الكاميرا أو سقوط الظلال على الكتابة.',
              ),
              const SizedBox(height: 10),
              _buildGuidanceTile(
                number: '٢',
                icon: Icons.crop_free_rounded,
                iconColor: AppTheme.primaryTeal,
                title: 'تصوير العلبة أو الروشتة كاملة داخل الإطار',
                subtitle: 'تأكد من ظهور كافة حواف العلبة أو كامل أسطر الروشتة دون اقتطاع لأي جزء.',
              ),
              const SizedBox(height: 10),
              _buildGuidanceTile(
                number: '٣',
                icon: Icons.stay_current_portrait_rounded,
                iconColor: const Color(0xFF4338CA),
                title: 'تثبيت الهاتف بوضوح لتجنب الاهتزاز',
                subtitle: 'أمسك الهاتف بكلتا يديك بثبات وانتظر ثانية حتى يركز الفوكس وتصبح الكلمات حادة.',
              ),
              const SizedBox(height: 24),
              // Primary Retake Action Button
              ElevatedButton.icon(
                onPressed: onRetake,
                icon: const Icon(Icons.camera_alt_rounded, size: 22),
                label: const Text('إعادة التقاط الصورة الآن'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  backgroundColor: AppTheme.primaryTeal,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  textStyle: const TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              // Optional Secondary Gallery Action Button
              if (onPickGallery != null) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: onPickGallery,
                  icon: const Icon(Icons.photo_library_outlined, size: 20),
                  label: const Text('اختيار صورة من المعرض'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    foregroundColor: AppTheme.primaryTeal,
                    side: const BorderSide(color: AppTheme.primaryTeal, width: 1.5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    textStyle: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGuidanceTile({
    required String number,
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.backgroundLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.dividerColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppTheme.dividerColor),
            ),
            child: Icon(icon, size: 20, color: iconColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$number. $title',
                  style: const TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 12,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
