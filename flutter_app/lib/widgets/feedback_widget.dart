import 'package:flutter/material.dart';
import '../constants/theme.dart';
import '../services/api_service.dart';

/// Lightweight, privacy-respecting user feedback widget.
/// Displays two small buttons: 👍 صحيح / 👎 غير صحيح.
/// Sends only the user's choice ('correct' / 'wrong'), the type ('box' / 'prescription'),
/// and the anonymous device ID. Never sends images, text, or personal data.
class FeedbackWidget extends StatefulWidget {
  final String type; // 'box' or 'prescription'
  final ApiService? apiService;

  const FeedbackWidget({
    super.key,
    required this.type,
    this.apiService,
  });

  @override
  State<FeedbackWidget> createState() => _FeedbackWidgetState();
}

class _FeedbackWidgetState extends State<FeedbackWidget> {
  bool _submitted = false;
  String? _selectedChoice;

  Future<void> _handleFeedback(String choice) async {
    if (_submitted) return;

    setState(() {
      _submitted = true;
      _selectedChoice = choice;
    });

    final service = widget.apiService ?? ApiService();
    try {
      await service.sendFeedback(choice: choice, type: widget.type);
    } catch (_) {
      // Fire-and-forget; feedback failures never disrupt the user experience
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.dividerColor, width: 1),
        ),
        child: _submitted
            ? Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.check_circle_rounded,
                    color: AppTheme.successGreen,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _selectedChoice == 'correct'
                        ? 'شكراً لمشاركتك رأيك! سعداء بدقة النتيجة.'
                        : 'شكراً لملاحظتك! سنعمل على تحسين الدقة.',
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ],
              )
            : Row(
                children: [
                  const Expanded(
                    child: Text(
                      'هل النتيجة دقيقة؟',
                      style: TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Thumbs Up: صحيح
                  InkWell(
                    onTap: () => _handleFeedback('correct'),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: const Color(0xFF86EFAC),
                          width: 1,
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('👍', style: TextStyle(fontSize: 14)),
                          SizedBox(width: 4),
                          Text(
                            'صحيح',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.successGreen,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Thumbs Down: غير صحيح
                  InkWell(
                    onTap: () => _handleFeedback('wrong'),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: const Color(0xFFFCA5A5),
                          width: 1,
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('👎', style: TextStyle(fontSize: 14)),
                          SizedBox(width: 4),
                          Text(
                            'غير صحيح',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFDC2626),
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
