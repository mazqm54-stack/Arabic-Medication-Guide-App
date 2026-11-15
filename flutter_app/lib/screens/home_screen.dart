import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/theme.dart';
import '../models/history_item.dart';
import '../models/medicine_box.dart';
import '../models/prescription.dart';
import '../services/api_service.dart';
import '../services/history_service.dart';
import '../services/image_service.dart';
import '../services/status_service.dart';
import '../services/theme_service.dart';
import '../widgets/camera_button.dart';
import '../widgets/loading_indicator.dart';
import '../widgets/medicine_box_card.dart';
import '../widgets/prescription_card.dart';
import '../widgets/retake_guidance_card.dart';
import 'history_screen.dart';

/// Screen operational states for Dalili Phase 1
enum AppScreenState {
  idle,
  compressing,
  analyzing,
  successBox,
  successPrescription,
  unclearPhoto,
  error,
}

/// Backward compatibility enum
enum ImageCaptureSource { camera, gallery }

/// Dalili Phase 1 Main Screen
/// Features Arabic RTL layout, dual operational modes (علبة دواء / روشتة),
/// prominent central camera button, client-side compression, and structured card presentations.
class HomeScreen extends StatefulWidget {
  final ApiService? apiService;
  final ImageService? imageService;
  final HistoryService? historyService;
  final String? initialAppVersion;

  const HomeScreen({
    super.key,
    this.apiService,
    this.imageService,
    this.historyService,
    this.initialAppVersion,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final ApiService _apiService;
  late final ImageService _imageService;
  late final HistoryService _historyService;
  bool _ownsApiService = false;

  late String _appVersion;

  int _currentTabIndex = 0; // 0 = علبة دواء (Medicine Box), 1 = روشتة (Prescription)
  AppScreenState _screenState = AppScreenState.idle;

  MedicineBoxAnalysis? _boxResult;
  PrescriptionAnalysis? _prescriptionResult;
  String? _retakeMessage;
  String? _errorMessage;
  String _statusMessage = '';

  AppStatus? _appStatus;
  bool _isMaintenanceMode = false;
  bool _isForceUpdateRequired = false;
  bool _isUpdateBannerVisible = false;

  @override
  void initState() {
    super.initState();
    _appVersion = widget.initialAppVersion ?? '0.0.3';
    if (widget.apiService != null) {
      _apiService = widget.apiService!;
    } else {
      _apiService = ApiService();
      _ownsApiService = true;
    }
    _imageService = widget.imageService ?? ImageService();
    _historyService = widget.historyService ?? HistoryService();
    _checkAppStatus();
  }

  Future<void> _checkAppStatus() async {
    String currentVersion = _appVersion;
    try {
      final info = await PackageInfo.fromPlatform();
      currentVersion = info.version;
      if (mounted) {
        setState(() {
          _appVersion = currentVersion;
        });
      }
    } catch (_) {
      // Keep existing _appVersion if platform channels are unavailable
    }

    final status = await _apiService.getStatus();
    if (!mounted || status == null) return;

    setState(() {
      _appStatus = status;
      if (status.maintenance) {
        _isMaintenanceMode = true;
      } else if (AppStatus.compareVersions(currentVersion, status.minVersion) < 0) {
        _isForceUpdateRequired = true;
      } else if (AppStatus.compareVersions(currentVersion, status.latestVersion) < 0) {
        _isUpdateBannerVisible = true;
      } else {
        _isUpdateBannerVisible = false;
      }
    });
  }

  Future<void> _launchUpdateUrl(String? rawUrl) async {
    if (rawUrl == null || rawUrl.trim().isEmpty) return;
    final cleanUrl = rawUrl.trim();
    final uri = Uri.tryParse(cleanUrl);
    if (uri == null) return;

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'جاري فتح صفحة التحديث في المتصفح...',
            style: TextStyle(fontFamily: AppTheme.fontFamily),
          ),
          duration: Duration(seconds: 2),
          backgroundColor: Color(0xFF0369A1),
        ),
      );
    }

    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'تعذر فتح الرابط تلقائياً. يرجى زيارة الرابط يدوياً.',
              style: TextStyle(fontFamily: AppTheme.fontFamily),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'حدث خطأ أثناء فتح الرابط: $e',
              style: const TextStyle(fontFamily: AppTheme.fontFamily),
            ),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    if (_ownsApiService) {
      _apiService.dispose();
    }
    super.dispose();
  }

  void _onTabSelected(int index) {
    if (_currentTabIndex == index && _screenState == AppScreenState.idle) {
      return;
    }
    setState(() {
      _currentTabIndex = index;
      // Switching tabs resets the screen to idle for the selected mode
      _screenState = AppScreenState.idle;
      _boxResult = null;
      _prescriptionResult = null;
      _retakeMessage = null;
      _errorMessage = null;
    });
  }

  void _resetToIdle() {
    setState(() {
      _screenState = AppScreenState.idle;
      _boxResult = null;
      _prescriptionResult = null;
      _retakeMessage = null;
      _errorMessage = null;
      _statusMessage = '';
    });
  }

  void _openCaptureSheet() {
    final isBoxMode = _currentTabIndex == 0;
    final modeTitle = isBoxMode ? 'قراءة علبة دواء' : 'تحليل روشتة طبية';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (BuildContext sheetContext) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 16,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 48,
                    height: 5,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF4B5563) : AppTheme.dividerColor,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  modeTitle,
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : AppTheme.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  isBoxMode
                      ? 'التقط صورة واضحة لعلبة الدواء أو اخترها من معرض الصور'
                      : 'التقط صورة واضحة للروشتة مع التركيز على خط الطبيب',
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 14,
                    color: isDark ? const Color(0xFF94A3B8) : AppTheme.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    _handleCaptureAction(ImageSource.camera);
                  },
                  icon: const Icon(Icons.camera_alt_outlined, size: 24),
                  label: const Text('التقاط صورة بالكاميرا'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryTeal,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    _handleCaptureAction(ImageSource.gallery);
                  },
                  icon: const Icon(Icons.photo_library_outlined, size: 24),
                  label: const Text('اختيار صورة من المعرض'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.primaryTeal,
                    side: const BorderSide(color: AppTheme.primaryTeal, width: 1.5),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleCaptureAction(ImageSource source) async {
    final sourceName = source == ImageSource.camera ? 'الكاميرا' : 'المعرض';
    final modeName = _currentTabIndex == 0 ? 'علبة الدواء' : 'الروشتة';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Directionality(
          textDirection: TextDirection.rtl,
          child: Text('جاري فتح $sourceName لقراءة $modeName...'),
        ),
        duration: const Duration(seconds: 2),
        backgroundColor: AppTheme.primaryTeal,
      ),
    );

    try {
      final ProcessedImage? image = await _imageService.pickAndProcessImage(source);
      if (image == null) {
        // User cancelled camera/gallery selection or running in test environment
        return;
      }

      if (!mounted) return;

      ScaffoldMessenger.of(context).hideCurrentSnackBar();

      setState(() {
        _screenState = AppScreenState.analyzing;
        _statusMessage = _currentTabIndex == 0
            ? 'جاري قراءة علبة الدواء بالذكاء الاصطناعي...'
            : 'جاري فك خط الطبيب وتحليل الروشتة...';
        _errorMessage = null;
        _retakeMessage = null;
      });

      if (_currentTabIndex == 0) {
        final result = await _apiService.analyzeMedicineBox(image.base64String);
        if (!mounted) return;
        if (!result.isClear) {
          setState(() {
            _screenState = AppScreenState.unclearPhoto;
            _retakeMessage = result.retakeMessage.isNotEmpty
                ? result.retakeMessage
                : 'الصورة غير واضحة تماماً، يرجى إعادة التقاطها في إضاءة أفضل.';
          });
        } else {
          setState(() {
            _screenState = AppScreenState.successBox;
            _boxResult = result;
          });
          _saveBoxResultToHistory(result, image);
        }
      } else {
        final result = await _apiService.analyzePrescription(image.base64String);
        if (!mounted) return;
        if (!result.isClear) {
          setState(() {
            _screenState = AppScreenState.unclearPhoto;
            _retakeMessage = result.retakeMessage.isNotEmpty
                ? result.retakeMessage
                : 'صورة الروشتة غير واضحة، يرجى تصوير الورقة كاملة بشكل مستوٍ.';
          });
        } else {
          setState(() {
            _screenState = AppScreenState.successPrescription;
            _prescriptionResult = result;
          });
          _savePrescriptionResultToHistory(result, image);
        }
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _screenState = AppScreenState.error;
          _errorMessage = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _screenState = AppScreenState.error;
          _errorMessage =
              'حدث خطأ غير متوقع أثناء معالجة الصورة. يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.';
        });
      }
    }
  }

  Future<void> _saveBoxResultToHistory(
    MedicineBoxAnalysis result,
    ProcessedImage image,
  ) async {
    try {
      final thumbnail = await _imageService.createThumbnailBase64(
        image.bytes,
        filePath: image.originalPath,
      );
      final title = result.medicineNameAr.trim().isNotEmpty
          ? result.medicineNameAr.trim()
          : (result.medicineNameEn.trim().isNotEmpty
              ? result.medicineNameEn.trim()
              : 'علبة دواء');
      final subtitle = result.activeIngredient.trim().isNotEmpty
          ? 'المادة الفعالة: ${result.activeIngredient.trim()}'
          : (result.medicineNameEn.trim().isNotEmpty
              ? result.medicineNameEn.trim()
              : '');

      final item = HistoryItem(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        timestamp: DateTime.now(),
        type: 'box',
        title: title,
        subtitle: subtitle,
        confidence: result.confidence,
        thumbnailBase64: thumbnail,
        rawJson: result.toJson(),
      );
      await _historyService.saveItem(item);
    } catch (e) {
      debugPrint('[HomeScreen] History save box error: $e');
    }
  }

  Future<void> _savePrescriptionResultToHistory(
    PrescriptionAnalysis result,
    ProcessedImage image,
  ) async {
    try {
      final thumbnail = await _imageService.createThumbnailBase64(
        image.bytes,
        filePath: image.originalPath,
      );
      String title = 'روشتة طبية';
      if (result.deducedCondition.trim().isNotEmpty) {
        title = result.deducedCondition.trim();
      } else if (result.items.isNotEmpty) {
        final first = result.items.first;
        if (first.medicineNameAr.trim().isNotEmpty) {
          title = first.medicineNameAr.trim();
        } else if (first.medicineNameEn.trim().isNotEmpty) {
          title = first.medicineNameEn.trim();
        }
      }

      final subtitle = '${result.items.length} أدوية مسجلة بالروشتة';

      final item = HistoryItem(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        timestamp: DateTime.now(),
        type: 'prescription',
        title: title,
        subtitle: subtitle,
        confidence: result.confidence,
        thumbnailBase64: thumbnail,
        rawJson: result.toJson(),
      );
      await _historyService.saveItem(item);
    } catch (e) {
      debugPrint('[HomeScreen] History save prescription error: $e');
    }
  }

  Future<void> _openHistory() async {
    final selectedItem = await Navigator.push<HistoryItem>(
      context,
      MaterialPageRoute(
        builder: (_) => HistoryScreen(historyService: _historyService),
      ),
    );
    if (selectedItem != null && mounted) {
      _loadFromHistory(selectedItem);
    }
  }

  void _loadFromHistory(HistoryItem item) {
    setState(() {
      if (item.type == 'box') {
        _currentTabIndex = 0;
        _boxResult = MedicineBoxAnalysis.fromJson(item.rawJson);
        _screenState = AppScreenState.successBox;
        _prescriptionResult = null;
      } else {
        _currentTabIndex = 1;
        _prescriptionResult = PrescriptionAnalysis.fromJson(item.rawJson);
        _screenState = AppScreenState.successPrescription;
        _boxResult = null;
      }
      _retakeMessage = null;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isMaintenanceMode) {
      return _buildMaintenanceScreen();
    }
    if (_isForceUpdateRequired) {
      return _buildForceUpdateScreen();
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.medication_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Flexible(
                child: Text(
                  'دليلي الدوائي',
                  style: TextStyle(
                    fontFamily: AppTheme.fontFamily,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          actions: [
            ValueListenableBuilder<ThemeMode>(
              valueListenable: ThemeService.themeModeNotifier,
              builder: (context, mode, _) {
                final isDark = Theme.of(context).brightness == Brightness.dark;
                return IconButton(
                  tooltip: isDark ? 'الوضع الفاتح' : 'الوضع الداكن',
                  icon: Icon(
                    isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                    color: Colors.white,
                  ),
                  onPressed: () => ThemeService.toggleTheme(context),
                );
              },
            ),
            IconButton(
              tooltip: 'سجل الفحوصات',
              icon: const Icon(Icons.history_rounded, color: Colors.white),
              onPressed: _openHistory,
            ),
          ],
          bottom: const PreferredSize(
            preferredSize: Size.fromHeight(34),
            child: AdvisoryHeaderBanner(),
          ),
        ),
        body: SafeArea(
          child: Column(
            children: [
              if (_isUpdateBannerVisible) _buildUpdateBanner(),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: _buildBody(),
                ),
              ),
            ],
          ),
        ),
        floatingActionButton: ProminentCameraButton(
          onPressed: _openCaptureSheet,
          tooltip: 'التقاط صورة',
        ),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
        bottomNavigationBar: Builder(
          builder: (context) {
            final isDark = Theme.of(context).brightness == Brightness.dark;
            final selectedColor = isDark ? AppTheme.secondaryTeal : AppTheme.primaryTeal;
            final unselectedColor = isDark ? const Color(0xFF94A3B8) : AppTheme.textMuted;

            return BottomAppBar(
              height: 68.0,
              padding: EdgeInsets.zero,
              shape: const CircularNotchedRectangle(),
              notchMargin: 8.0,
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              elevation: 8,
              child: SizedBox(
                height: 68.0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    // Right Tab (RTL Tab 1): علبة دواء
                    Expanded(
                      child: InkWell(
                        onTap: () => _onTabSelected(0),
                        child: Container(
                          height: double.infinity,
                          alignment: Alignment.center,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _currentTabIndex == 0
                                    ? Icons.medication_rounded
                                    : Icons.medication_outlined,
                                color: _currentTabIndex == 0
                                    ? selectedColor
                                    : unselectedColor,
                                size: 24,
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'علبة دواء',
                                style: TextStyle(
                                  fontFamily: AppTheme.fontFamily,
                                  fontSize: 12,
                                  fontWeight: _currentTabIndex == 0
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                                  color: _currentTabIndex == 0
                                      ? selectedColor
                                      : unselectedColor,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    // Center notch spacer for floating camera button
                    const SizedBox(width: 68),
                    // Left Tab (RTL Tab 2): روشتة طبية
                    Expanded(
                      child: InkWell(
                        onTap: () => _onTabSelected(1),
                        child: Container(
                          height: double.infinity,
                          alignment: Alignment.center,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _currentTabIndex == 1
                                    ? Icons.receipt_long_rounded
                                    : Icons.receipt_long_outlined,
                                color: _currentTabIndex == 1
                                    ? selectedColor
                                    : unselectedColor,
                                size: 24,
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'روشتة طبية',
                                style: TextStyle(
                                  fontFamily: AppTheme.fontFamily,
                                  fontSize: 12,
                                  fontWeight: _currentTabIndex == 1
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                                  color: _currentTabIndex == 1
                                      ? selectedColor
                                      : unselectedColor,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_screenState) {
      case AppScreenState.idle:
        return _currentTabIndex == 0
            ? _buildMedicineBoxIdleView()
            : _buildPrescriptionIdleView();

      case AppScreenState.compressing:
      case AppScreenState.analyzing:
        return SingleChildScrollView(
          key: const ValueKey('loading_view'),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
          child: ArabicLoadingIndicator(
            initialMessage: _statusMessage,
            isPrescriptionMode: _currentTabIndex == 1,
          ),
        );

      case AppScreenState.successBox:
        if (_boxResult == null) return const SizedBox.shrink();
        return SingleChildScrollView(
          key: const ValueKey('success_box_view'),
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 88),
          child: MedicineBoxCard(
            analysis: _boxResult!,
            apiService: _apiService,
            onNewScan: _resetToIdle,
          ),
        );

      case AppScreenState.successPrescription:
        if (_prescriptionResult == null) return const SizedBox.shrink();
        return SingleChildScrollView(
          key: const ValueKey('success_prescription_view'),
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 88),
          child: PrescriptionView(
            analysis: _prescriptionResult!,
            apiService: _apiService,
            onNewScan: _resetToIdle,
          ),
        );

      case AppScreenState.unclearPhoto:
        return SingleChildScrollView(
          key: const ValueKey('unclear_photo_view'),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: RetakeGuidanceCard(
            retakeMessage: _retakeMessage,
            onRetake: () => _handleCaptureAction(ImageSource.camera),
            onPickGallery: () => _handleCaptureAction(ImageSource.gallery),
          ),
        );

      case AppScreenState.error:
        return SingleChildScrollView(
          key: const ValueKey('error_view'),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: _buildErrorCard(),
        );
    }
  }

  Widget _buildMedicineBoxIdleView() {
    return SingleChildScrollView(
      key: const ValueKey('medicine_box_view'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: const BoxDecoration(
                      color: AppTheme.primaryContainer,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.medication_rounded,
                      size: 38,
                      color: AppTheme.primaryTeal,
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'قراءة علبة الدواء',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'وجّه الكاميرا نحو علبة الدواء لقراءة الاسم التجاري والعلمي، الجرعات الموصى بها، ودواعي الاستعمال بدقة.',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 14,
                      color: AppTheme.textSecondary,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _handleCaptureAction(ImageSource.camera),
                          icon: const Icon(Icons.photo_camera, size: 20),
                          label: const Text('التقاط بالكاميرا'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _handleCaptureAction(ImageSource.gallery),
                          icon: const Icon(Icons.photo_library, size: 20),
                          label: const Text('من المعرض'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          _buildQuickTipsCard(
            title: 'نصائح لتصوير مثالي للعلبة',
            tips: const [
              'تأكد من وضوح اسم الدواء وتركيزه',
              'ضع العلبة تحت إضاءة جيدة وتجنب الانعكاسات',
              'أمسك الهاتف بثبات لتجنب تشوش الصورة',
            ],
          ),
          const SizedBox(height: 18),
          Center(
            child: Text(
              'الإصدار $_appVersion',
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 12,
                color: AppTheme.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrescriptionIdleView() {
    return SingleChildScrollView(
      key: const ValueKey('prescription_view'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: const BoxDecoration(
                      color: AppTheme.primaryContainer,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.receipt_long_rounded,
                      size: 38,
                      color: AppTheme.primaryTeal,
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'تحليل الروشتة الطبية',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'صوّر الروشتة كاملة لقراءة أسماء الأدوية المكتوبة بخط الطبيب وتوضيح طريقة الاستخدام.',
                    style: TextStyle(
                      fontFamily: AppTheme.fontFamily,
                      fontSize: 14,
                      color: AppTheme.textSecondary,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.warningOrangeBackground,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.warningOrangeBorder),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.warning_amber_rounded,
                          color: AppTheme.warningOrange,
                          size: 24,
                        ),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'الأدوية غير المؤكدة أو المقترحة تظهر ببطاقة برتقالية تحذيرية للتأكد منها مع الصيدلي.',
                            style: TextStyle(
                              fontFamily: AppTheme.fontFamily,
                              fontSize: 12,
                              color: AppTheme.warningOrangeText,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _handleCaptureAction(ImageSource.camera),
                          icon: const Icon(Icons.photo_camera, size: 20),
                          label: const Text('تصوير الروشتة'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _handleCaptureAction(ImageSource.gallery),
                          icon: const Icon(Icons.photo_library, size: 20),
                          label: const Text('من المعرض'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          _buildQuickTipsCard(
            title: 'نصائح لقراءة دقيقة للروشتة',
            tips: const [
              'صوّر الروشتة من الأعلى مباشرة بشكل مستوٍ',
              'تأكد من وضوح جميع الأسطر والأسماء',
              'راجع دائماً أي دواء مقترح مع الصيدلي قبل شرائه',
            ],
          ),
          const SizedBox(height: 18),
          Center(
            child: Text(
              'الإصدار $_appVersion',
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 12,
                color: AppTheme.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard() {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppTheme.dividerColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: Color(0xFFFFEBEE),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.cloud_off_rounded,
                  size: 38,
                  color: Color(0xFFD32F2F),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'تعذر إتمام التحليل',
              style: TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage ??
                  'حدث خطأ في الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.',
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 14,
                color: AppTheme.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _openCaptureSheet,
              icon: const Icon(Icons.refresh_rounded, size: 20),
              label: const Text('إعادة المحاولة'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: AppTheme.primaryTeal,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _resetToIdle,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                foregroundColor: AppTheme.primaryTeal,
                side: const BorderSide(color: AppTheme.primaryTeal, width: 1.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text('العودة للرئيسية'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickTipsCard({
    required String title,
    required List<String> tips,
  }) {
    return Builder(
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? const Color(0xFF334155) : AppTheme.dividerColor,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.lightbulb_outline_rounded,
                    color: isDark ? AppTheme.secondaryTeal : AppTheme.primaryTeal,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontFamily: AppTheme.fontFamily,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : AppTheme.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (final tip in tips)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 6, left: 8),
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: isDark ? AppTheme.secondaryTeal : AppTheme.primaryTeal,
                          shape: BoxShape.circle,
                        ),
                      ),
                      Expanded(
                        child: Text(
                          tip,
                          style: TextStyle(
                            fontFamily: AppTheme.fontFamily,
                            fontSize: 13,
                            color: isDark ? const Color(0xFFCBD5E1) : AppTheme.textSecondary,
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
      },
    );
  }

  Widget _buildMaintenanceScreen() {
    return Builder(
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            backgroundColor: isDark ? const Color(0xFF121212) : Colors.white,
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 88,
                        height: 88,
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF381E08) : AppTheme.warningOrangeBackground,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppTheme.warningOrangeBorder, width: 2),
                        ),
                        child: const Icon(
                          Icons.construction_rounded,
                          size: 44,
                          color: Color(0xFFD97706),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'التطبيق قيد الصيانة',
                        style: TextStyle(
                          fontFamily: AppTheme.fontFamily,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : AppTheme.textPrimary,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _appStatus?.maintenanceMessage.isNotEmpty == true
                            ? _appStatus!.maintenanceMessage
                            : 'نقوم حالياً ببعض أعمال الصيانة والتحسينات لنقدم لكم تجربة أفضل. يرجى المحاولة في وقت لاحق.',
                        style: TextStyle(
                          fontFamily: AppTheme.fontFamily,
                          fontSize: 15,
                          color: isDark ? const Color(0xFFCBD5E1) : AppTheme.textSecondary,
                          height: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 32),
                      ElevatedButton.icon(
                        onPressed: () {
                          setState(() {
                            _isMaintenanceMode = false;
                          });
                          _checkAppStatus();
                        },
                        icon: const Icon(Icons.refresh_rounded, size: 20),
                        label: const Text('إعادة المحاولة'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryTeal,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildForceUpdateScreen() {
    return Builder(
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            backgroundColor: isDark ? const Color(0xFF121212) : Colors.white,
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 88,
                        height: 88,
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF0F3D40) : AppTheme.primaryContainer,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.system_update_rounded,
                          size: 44,
                          color: isDark ? AppTheme.secondaryTeal : AppTheme.primaryTeal,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'تحديث إلزامي مطلوب',
                        style: TextStyle(
                          fontFamily: AppTheme.fontFamily,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : AppTheme.textPrimary,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _appStatus?.updateMessage.isNotEmpty == true
                            ? _appStatus!.updateMessage
                            : 'يتوفر إصدار جديد يحتوي على ميزات وتحديثات ضرورية للمتابعة. يرجى تحديث التطبيق الآن.',
                        style: TextStyle(
                          fontFamily: AppTheme.fontFamily,
                          fontSize: 15,
                          color: isDark ? const Color(0xFFCBD5E1) : AppTheme.textSecondary,
                          height: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'الإصدار الحالي: $_appVersion  |  الإصدار المطلوب: ${_appStatus?.minVersion ?? _appVersion}',
                        style: TextStyle(
                          fontFamily: AppTheme.fontFamily,
                          fontSize: 12,
                          color: isDark ? const Color(0xFF94A3B8) : AppTheme.textMuted,
                        ),
                      ),
                      const SizedBox(height: 32),
                      ElevatedButton.icon(
                        onPressed: () => _launchUpdateUrl(_appStatus?.updateUrl),
                        icon: const Icon(Icons.download_rounded, size: 20),
                        label: const Text('تحديث التطبيق الآن'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryTeal,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildUpdateBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: const BoxDecoration(
        color: Color(0xFFE0F2FE),
        border: Border(
          bottom: BorderSide(color: Color(0xFFBAE6FD), width: 1),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.info_outline_rounded,
            color: Color(0xFF0369A1),
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _appStatus?.updateMessage.isNotEmpty == true
                  ? _appStatus!.updateMessage
                  : 'يتوفر إصدار جديد من تطبيق دليلي الدوائي.',
              style: const TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0369A1),
              ),
            ),
          ),
          const SizedBox(width: 8),
          if (_appStatus?.updateUrl.isNotEmpty == true)
            FilledButton(
              onPressed: () => _launchUpdateUrl(_appStatus!.updateUrl),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              child: const Text(
                'تحديث الآن',
                style: TextStyle(
                  fontFamily: AppTheme.fontFamily,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          const SizedBox(width: 4),
          IconButton(
            onPressed: () {
              setState(() {
                _isUpdateBannerVisible = false;
              });
            },
            icon: const Icon(Icons.close_rounded, size: 18),
            color: const Color(0xFF0369A1),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            splashRadius: 18,
          ),
        ],
      ),
    );
  }
}

/// Slim advisory banner displayed directly beneath the AppBar
class AdvisoryHeaderBanner extends StatelessWidget {
  const AdvisoryHeaderBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFF005860),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.info_outline,
            color: Color(0xFF83C5BE),
            size: 16,
          ),
          SizedBox(width: 8),
          Flexible(
            child: Text(
              'تنبيه: راجع أسماء الأدوية والجرعات دائماً مع الصيدلي',
              style: TextStyle(
                fontFamily: AppTheme.fontFamily,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
