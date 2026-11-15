import 'package:flutter/material.dart';
import '../constants/theme.dart';

/// Prominent circular camera action button for the Dalili home shell
class ProminentCameraButton extends StatelessWidget {
  final VoidCallback onPressed;
  final double size;
  final String tooltip;

  const ProminentCameraButton({
    super.key,
    required this.onPressed,
    this.size = 68.0,
    this.tooltip = 'التقاط صورة',
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      hint: 'انقر لفتح الكاميرا أو اختيار صورة من المعرض',
      child: Tooltip(
        message: tooltip,
        child: Container(
          width: size,
          height: size,
          margin: const EdgeInsets.only(top: 8),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                AppTheme.primaryTealLight,
                AppTheme.primaryTeal,
              ],
            ),
            border: Border.all(
              color: Colors.white,
              width: 3.5,
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x55006D77),
                blurRadius: 14,
                spreadRadius: 2,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              splashColor: Colors.white.withValues(alpha: 0.3),
              highlightColor: Colors.white.withValues(alpha: 0.15),
              onTap: onPressed,
              child: const Center(
                child: Icon(
                  Icons.camera_alt_rounded,
                  color: Colors.white,
                  size: 32,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
