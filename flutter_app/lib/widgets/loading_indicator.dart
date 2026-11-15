import 'dart:async';
import 'package:flutter/material.dart';
import '../constants/theme.dart';

/// Warm Arabic loading indicator with smooth spinner and rotating reassurance messages.
/// Designed for Phase 1 image analysis waiting states.
class ArabicLoadingIndicator extends StatefulWidget {
  final String? initialMessage;
  final bool isPrescriptionMode;

  const ArabicLoadingIndicator({
    super.key,
    this.initialMessage,
    this.isPrescriptionMode = false,
  });

  @override
  State<ArabicLoadingIndicator> createState() => _ArabicLoadingIndicatorState();
}

class _ArabicLoadingIndicatorState extends State<ArabicLoadingIndicator> {
  late final List<String> _reassuranceMessages;
  int _currentMessageIndex = 0;
  Timer? _rotationTimer;

  @override
  void initState() {
    super.initState();
    _reassuranceMessages = widget.isPrescriptionMode
        ? const [
            'جاري مسح الروشتة وقراءة خط الطبيب بالذكاء الاصطناعي...',
            'نحلل الأدوية المؤكدة ونستنتج سياق الحالة الطبية...',
            'نطابق الحروف المقروءة مع قواعد الأمان الصيدلي...',
            'لحظات وتكون النتيجة الطبية جاهزة...',
          ]
        : const [
            'جاري قراءة الدواء وتحليله بالذكاء الاصطناعي...',
            'نتحقق من الاسم العلمي والجرعات الموصى بها...',
            'نراجع دواعي الاستعمال والتحذيرات الهامة...',
            'لحظات وتكون النتيجة جاهزة...',
          ];

    if (widget.initialMessage != null && widget.initialMessage!.trim().isNotEmpty) {
      _currentMessageIndex = 0;
    }

    // Smooth message rotation every 2.5 seconds
    _rotationTimer = Timer.periodic(const Duration(milliseconds: 2500), (timer) {
      if (mounted) {
        setState(() {
          _currentMessageIndex = (_currentMessageIndex + 1) % _reassuranceMessages.length;
        });
      }
    });
  }

  @override
  void dispose() {
    _rotationTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeMessage = widget.initialMessage ?? _reassuranceMessages[_currentMessageIndex];

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
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Circular progress indicator with layered icon
              Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: const BoxDecoration(
                      color: AppTheme.primaryContainer,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(
                    width: 64,
                    height: 64,
                    child: CircularProgressIndicator(
                      strokeWidth: 4,
                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primaryTeal),
                      backgroundColor: Colors.transparent,
                    ),
                  ),
                  Icon(
                    widget.isPrescriptionMode
                        ? Icons.receipt_long_rounded
                        : Icons.medication_rounded,
                    size: 28,
                    color: AppTheme.primaryTeal,
                  ),
                ],
              ),
              const SizedBox(height: 24),
              // Rotating animated message
              SizedBox(
                height: 48,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 400),
                  transitionBuilder: (child, animation) {
                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0.0, 0.15),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    );
                  },
                  child: Text(
                    activeMessage,
                    key: ValueKey<String>(activeMessage),
                    style: const TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              // Friendly reassurance subtitle
              const Text(
                'يرجى الانتظار، نقرأ التفاصيل بعناية لضمان سلامتك.',
                style: TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 12,
                  color: AppTheme.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
