import 'dart:convert';
import 'package:flutter/material.dart';
import '../constants/theme.dart';
import '../models/history_item.dart';
import '../services/history_service.dart';

/// Screen displaying locally saved prescription and medicine box scan history.
/// Fully offline, stores at most 50 items, lists newest first.
class HistoryScreen extends StatefulWidget {
  final HistoryService? historyService;

  const HistoryScreen({super.key, this.historyService});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late final HistoryService _historyService;
  List<HistoryItem> _items = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _historyService = widget.historyService ?? HistoryService();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() => _isLoading = true);
    final list = await _historyService.getHistory();
    if (mounted) {
      setState(() {
        _items = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteItem(HistoryItem item) async {
    await _historyService.deleteItem(item.id);
    if (!mounted) return;
    setState(() {
      _items.removeWhere((i) => i.id == item.id);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('تم حذف "${item.title}" من السجل'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _confirmClearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            title: const Text('مسح السجل بالكامل'),
            content: const Text(
              'هل أنت متأكد من مسح جميع عناصر السجل المحفوظة على هاتفك؟ لن تتمكن من استعادتها.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('إلغاء'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(
                  'مسح الكل',
                  style: TextStyle(
                    color: isDark ? AppTheme.confidenceLowDark : AppTheme.confidenceLowLight,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );

    if (confirmed == true) {
      await _historyService.clearHistory();
      if (mounted) {
        setState(() {
          _items.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('تم مسح جميع عناصر السجل بنجاح'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  Widget _buildThumbnail(HistoryItem item, bool isDark) {
    if (item.thumbnailBase64.isNotEmpty) {
      try {
        final bytes = base64Decode(item.thumbnailBase64);
        return ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Image.memory(
            bytes,
            width: 58,
            height: 58,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _buildFallbackIcon(item, isDark),
          ),
        );
      } catch (_) {}
    }
    return _buildFallbackIcon(item, isDark);
  }

  Widget _buildFallbackIcon(HistoryItem item, bool isDark) {
    final isBox = item.type == 'box';
    return Container(
      width: 58,
      height: 58,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF282828) : const Color(0xFFE0F2F1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(
        isBox ? Icons.medication_rounded : Icons.receipt_long_rounded,
        color: isDark ? AppTheme.secondaryTeal : AppTheme.primaryTeal,
        size: 30,
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE0F2F1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.history_toggle_off_rounded,
                size: 64,
                color: isDark ? AppTheme.secondaryTeal : AppTheme.primaryTeal,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'لا يوجد سجل محفوظ حتى الآن',
              style: TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : AppTheme.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'نتائج فحص علب الأدوية والروشتات الطبية ستُحفظ هنا تلقائياً على هاتفك فقط لتتمكن من الرجوع إليها وقراءتها في أي وقت دون اتصال بالإنترنت.',
              style: TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 14,
                color: isDark ? const Color(0xFF94A3B8) : AppTheme.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('سجل الفحوصات'),
          actions: [
            if (_items.isNotEmpty)
              IconButton(
                tooltip: 'مسح السجل',
                icon: const Icon(Icons.delete_sweep_rounded),
                onPressed: _confirmClearAll,
              ),
          ],
        ),
        body: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: AppTheme.primaryTeal),
              )
            : _items.isEmpty
                ? _buildEmptyState(isDark)
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = _items[index];
                      final isBox = item.type == 'box';
                      final typeLabel = isBox ? 'علبة دواء' : 'روشتة طبية';

                      return Dismissible(
                        key: Key(item.id),
                        direction: DismissDirection.endToStart,
                        background: Container(
                          alignment: Alignment.centerLeft,
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          decoration: BoxDecoration(
                            color: Colors.red.shade700,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Text(
                                'حذف',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                              ),
                              SizedBox(width: 8),
                              Icon(Icons.delete_outline_rounded, color: Colors.white),
                            ],
                          ),
                        ),
                        onDismissed: (_) => _deleteItem(item),
                        child: Card(
                          margin: EdgeInsets.zero,
                          elevation: 1.5,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: BorderSide(
                              color: isDark
                                  ? const Color(0xFF334155)
                                  : AppTheme.dividerColor,
                              width: 1,
                            ),
                          ),
                          child: InkWell(
                            onTap: () {
                              // Reopen result in HomeScreen
                              Navigator.pop(context, item);
                            },
                            borderRadius: BorderRadius.circular(16),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  // Small compressed thumbnail
                                  _buildThumbnail(item, isDark),
                                  const SizedBox(width: 12),

                                  // Details column
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        // Header row: Type badge & date/time
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                  horizontal: 8, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: isDark
                                                    ? const Color(0xFF0F3D40)
                                                    : AppTheme.primaryContainer,
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                typeLabel,
                                                style: TextStyle(
                                                  fontFamily: AppTheme.fontFamily,
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: isDark
                                                      ? AppTheme.secondaryTeal
                                                      : AppTheme.primaryTeal,
                                                ),
                                              ),
                                            ),
                                            Text(
                                              item.formattedDateTime,
                                              style: TextStyle(
                                                fontFamily: AppTheme.fontFamily,
                                                fontSize: 11,
                                                color: isDark
                                                    ? const Color(0xFF94A3B8)
                                                    : AppTheme.textMuted,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),

                                        // Item Title
                                        Text(
                                          item.title,
                                          style: TextStyle(
                                            fontFamily: AppTheme.fontFamily,
                                            fontSize: 15,
                                            fontWeight: FontWeight.bold,
                                            color: isDark
                                                ? Colors.white
                                                : AppTheme.textPrimary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),

                                        // Item Subtitle if available
                                        if (item.subtitle.isNotEmpty) ...[
                                          const SizedBox(height: 2),
                                          Text(
                                            item.subtitle,
                                            style: TextStyle(
                                              fontFamily: AppTheme.fontFamily,
                                              fontSize: 12,
                                              color: isDark
                                                  ? const Color(0xFFCBD5E1)
                                                  : AppTheme.textSecondary,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                        const SizedBox(height: 8),

                                        // Confidence badge with icon and color
                                        AppTheme.buildConfidenceBadge(
                                          context: context,
                                          confidence: item.confidence,
                                          labelText: item.confidence.toLowerCase() == 'high'
                                              ? 'ثقة مرتفعة'
                                              : (item.confidence.toLowerCase() == 'medium'
                                                  ? 'ثقة متوسطة'
                                                  : 'ثقة منخفضة'),
                                          fontSize: 10,
                                        ),
                                      ],
                                    ),
                                  ),

                                  // Explicit delete button for accessibility
                                  IconButton(
                                    icon: Icon(
                                      Icons.delete_outline_rounded,
                                      color: isDark
                                          ? const Color(0xFF94A3B8)
                                          : AppTheme.textMuted,
                                      size: 20,
                                    ),
                                    tooltip: 'حذف',
                                    onPressed: () => _deleteItem(item),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
