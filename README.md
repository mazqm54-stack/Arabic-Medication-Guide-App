# دليلي الدوائي (My Medication Guide)

Rebuilding the Arabic medication guide Android application "دليلي الدوائي" in Flutter, delivering a minimal Phase 1 app featuring camera/gallery capture, medicine box analysis, prescription analysis with smart handwriting reasoning, and debug APK generation.

---

## Prerequisites & Toolchain Setup (Requirement R1)

The project relies on:
- **Flutter SDK**: Version 3.47.9 (channel stable, Dart 3.13.7) located at `C:\flutter` (junction to `C:\flutter_windows_3.47.9-stable\flutter`).
- **Android SDK**: Version 34.0.0 located at `C:\Users\PC\AppData\Local\Android\Sdk`.
- **JDK**: Microsoft OpenJDK 17 (`C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot`).

---

## 1. Quick Session Initialization (`init-env.ps1`)

To instantly configure and standardize all environment variables in your current PowerShell session, source the root helper script:

```powershell
. .\init-env.ps1
```

*(Note: If script execution is restricted in your PowerShell console, run:)*
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
. .\init-env.ps1
```

This script automatically sets:
- `$env:CI = "true"`: Suppresses interactive prompts.
- `$env:FLUTTER_SUPPRESS_ANALYTICS = "true"`: Suppresses analytics telemetry.
- `$env:ANDROID_HOME = "C:\Users\PC\AppData\Local\Android\Sdk"`: Points to the local Android SDK.
- `$env:LOCALAPPDATA = "C:\Users\PC\AppData\Local\Android"`: Provides local app data path for Android tools.
- `$env:PUB_CACHE = "c:\Users\PC\Documents\antigravity\fervent-mendel\.pub-cache"`: Isolates pub dependencies cache within project workspace.
- Prepend to `$env:Path`: `C:\flutter\bin;C:\Users\PC\AppData\Local\Android\Sdk\platform-tools;C:\Users\PC\AppData\Local\Android\Sdk\cmdline-tools\latest\bin;`

---

## 2. Permanent PATH Setup via Windows System Properties (Manual Steps)

To permanently add `C:\flutter\bin` to your Windows Environment Variables so that Flutter is accessible from any terminal, command prompt, or IDE without manual session setup, follow these step-by-step instructions:

1. **Open Windows Run Dialog**:
   - Press <kbd>Win</kbd> + <kbd>R</kbd> on your keyboard.
   - Type `sysdm.cpl` and press <kbd>Enter</kbd> (or click **OK**). This opens the **System Properties** dialog.

2. **Navigate to Advanced Settings**:
   - In the **System Properties** window, click on the **Advanced** tab at the top.
   - Click the **Environment Variables...** button near the bottom right.

3. **Locate User Variables**:
   - In the top section labeled **User variables for [YourUsername]**, scroll down and locate the variable named `Path` (or `PATH`).
   - Select `Path` by clicking on it, then click the **Edit...** button (or double-click `Path`).

4. **Add Flutter Binary Path**:
   - In the **Edit environment variable** window, click the **New** button on the right side.
   - Enter the exact path:
     ```
     C:\flutter\bin
     ```
   - *(Optional but recommended)*: Click **New** again and add the Android platform tools path:
     ```
     C:\Users\PC\AppData\Local\Android\Sdk\platform-tools
     ```

5. **Reorder to Top (Recommended)**:
   - With `C:\flutter\bin` selected, click the **Move Up** button repeatedly until it appears near the top of the list.

6. **Save Changes**:
   - Click **OK** to close the *Edit environment variable* dialog.
   - Click **OK** to close the *Environment Variables* dialog.
   - Click **OK** to close the *System Properties* dialog.

7. **Restart Running Terminals**:
   - Close and restart any open PowerShell windows, Command Prompts, Windows Terminals, or IDEs (e.g. VS Code, Android Studio) to pick up the updated PATH environment variable.

---

### Alternative: Permanent Setup via PowerShell (User Scope)

If you prefer applying the permanent User PATH change via PowerShell:

```powershell
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*C:\flutter\bin*") {
    $newPath = "C:\flutter\bin;C:\Users\PC\AppData\Local\Android\Sdk\platform-tools;" + $currentPath
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "C:\flutter\bin added to User PATH successfully."
} else {
    Write-Host "C:\flutter\bin is already present in User PATH."
}
```

---

## 3. Environment Verification

Once configured, verify your toolchain by opening a new terminal and running:

```powershell
flutter --version
```
**Expected Output**:
```
Flutter 3.47.9 • channel stable • https://github.com/flutter/flutter.git
Framework • revision c197ca5199
Engine • hash 9e025265bef30b838c0c1b68cad19decf97048f2
Tools • Dart 3.13.7 • DevTools 2.60.0
```

Verify doctor diagnostics:
```powershell
flutter doctor -v
```
All Android SDK licenses have been accepted and the toolchain is fully configured for Android APK compilation.

---

## 4. Backend Cloudflare Worker Service (Requirement R2)

The backend Edge Worker is located at `worker/` (`dalili-medication-guide-worker.dalili-medication.workers.dev`):
- **Prescription Analysis (`POST /api/prescription`)**:
  - Employs Google Gemini with two-stage clinical reasoning.
  - Legible medicines are parsed and confirmed first.
  - Unclear handwritten lines extract visible letters and deduce underlying medical conditions (infection, hypertension, diabetes, etc.).
  - Generates up to two suggested matching medicines with confidence levels (`high`, `medium`, `low`).
  - Opligatory safety rules: omits all dosages for suggestions, marks as "possible, not confirmed", instructs pharmacist consultation, and returns "unclear" when no plausible match exists.
- **Medicine Box Analysis (`POST /api/analyze`)**:
  - Extracts Arabic and English trade names, active ingredient, indications, usage directions, and warnings.
  - Enforces `is_clear: false` with friendly Arabic retake messages on blurry or poorly-lit packaging.

---

## 5. Flutter Phase 1 Architecture (Requirement R3)

Located in `flutter_app/`:
- **Material 3 RTL Arabic UI**: Teal primary color (`#006D77`), Arabic Directionality (`TextDirection.rtl`), clean cards.
- **Offline Font Bundling**: Bundled local TrueType Cairo fonts (`assets/fonts/Cairo-Regular.ttf`, `assets/fonts/Cairo-Bold.ttf`) with zero runtime network font requests.
- **Central Camera Action**: Bottom navigation bar featuring a prominent circular camera button for instant photo capture.
- **Client-Side Compression**: Automatically compresses captured photos (<1 MB JPEG) prior to edge API transmission.
- **Prescription Display**: Clear distinction between confirmed medicines (teal cards) and suggested/unclear handwriting (orange warning cards with pharmacist disclaimer).
- **Quality Guidance**: Warm Arabic loading states and 3-point retake guidance cards on inadequate captures.
- **Strict Scope**: Zero non-Phase-1 features (voice/TTS, history, saved lists, settings, font size toggles).

---

## 6. APK Build Artifacts (Requirement R4)

### 🚀 حزم الإنتاج المحسّنة (Release APKs - موصى بها للتثبيت المباشر)

تم بناء حزم release مقسمة بحسب معمارية المعالج (`--split-per-abi`) مع تجريد كامل لبيانات الـ Debug الأصلية:

| المعمارية / نوع الجهاز | مسار الملف | الحجم الفعلي |
|---|---|---|
| **Modern Phones (arm64-v8a)** *(الموصى به)* | `flutter_app/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk` | **16.94 MB** |
| **Legacy Phones (armeabi-v7a)** | `flutter_app/build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk` | **14.4 MB** |
| **PC Emulators (x86_64)** | `flutter_app/build/app/outputs/flutter-apk/app-x86_64-release.apk` | **18.3 MB** |

للتثبيت المباشر عبر ADB لأجهزة arm64:
```powershell
. .\init-env.ps1
adb install -r flutter_app\build\app\outputs\flutter-apk\app-arm64-v8a-release.apk
```

---

### 🛠️ النسخة التجريبية للمطورين (Debug Fat APK)

The Android debug APK has been compiled and verified:

```powershell
. .\init-env.ps1
cd flutter_app
flutter build apk --debug
```

### Artifact Inspection & Validation

| Property | Value |
|---|---|
| **Artifact Path** | `flutter_app/build/app/outputs/flutter-apk/app-debug.apk` |
| **Package ID** | `com.dalili.medicationguide` |
| **Application Label** | `دليلي الدوائي` |
| **Version** | `1.0.0` (versionCode `1`) |
| **Target SDK** | Android API Level 36 (minSdkVersion: 24) |
| **Permissions** | `INTERNET`, `CAMERA`, `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` (maxSdkVersion 32) |
| **Bundled Fonts** | `Cairo-Regular.ttf` (919 KB), `Cairo-Bold.ttf` (849 KB), `MaterialIcons-Regular.otf` |
| **Launcher Icons** | Adaptive mipmap icons (`mipmap-anydpi-v26/ic_launcher.xml`, hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi) |
| **Splash Screens** | Light & Dark splash drawables (`splash.png`, `splash_dark.png` across all densities) |
| **Architectures** | Multi-ABI debug binary (`arm64-v8a`, `armeabi-v7a`, `x86_64`) |
| **File Size** | 1,411,633,107 bytes (~1.31 GB unstripped debug build) |

---

## 7. دليل التثبيت والتشغيل خطوة بخطوة (Step-by-Step Installation Guide)

### الطريقة الأولى: التثبيت للمطورين عبر أداة ADB (Method 1: Developer ADB Install)

إذا كان هاتفك متصلاً بالكمبيوتر وتم تفعيل **خيارات المطور (Developer Options)** و **تصحيح أخطاء USB (USB Debugging)**:

1. **التحقق من اتصال الهاتف**:
   ```powershell
   . .\init-env.ps1
   adb devices
   ```
   *تأكد من ظهور معرف هاتفك في القائمة.*

2. **تثبيت حزمة APK مباشرة**:
   ```powershell
   adb install -r flutter_app\build\app\outputs\flutter-apk\app-debug.apk
   ```

3. **تشغيل التطبيق مباشرة**:
   ```powershell
   adb shell am start -n com.dalili.medicationguide/.MainActivity
   ```

---

### الطريقة الثانية: التثبيت اليدوي على الهاتف (Method 2: Sideloading via USB / Cloud / File Manager)

لتثبيت التطبيق مباشرة على أي هاتف أندرويد بدون أوامر سطرية:

1. **نقل ملف APK إلى هاتفك**:
   - انسخ ملف `flutter_app\build\app\outputs\flutter-apk\app-debug.apk` إلى مجلد **التنزيلات (Downloads)** على هاتفك عبر كابل USB.
   - *أو* أرسل الملف إلى هاتفك عبر خدمة تخزين سحابي (Google Drive أو OneDrive) أو تطبيق مراسلة.

2. **تفعيل صلاحية "تثبيت التطبيقات غير المعروفة" (Allow Unknown Apps)**:
   - افتح تطبيق **مدير الملفات (File Manager / Files)** على هاتفك.
   - اضغط على ملف `app-debug.apk`.
   - عند ظهور رسالة الأمان: *"لأسباب أمنية، لا يُسمح لهاتفك بتثبيت تطبيقات غير معروفة من هذا المصدر"* (*For your security, your phone is not allowed to install unknown apps from this source*):
     1. اضغط على **الإعدادات (Settings)**.
     2. فعّل خيار **السماح من هذا المصدر (Allow from this source)**.
     3. ارجع خطوة واضغط على **تثبيت (Install)**.

3. **تجاوز فحص Play Protect**:
   - نظراً لأن حزمة التطوير (Debug APK) موقعة بمفتاح تصحيح أخطاء محلي، قد يعرض متجر Google Play تحذيراً: *"تم حظر التطبيق بواسطة Play Protect"*.
   - اضغط على **مزيد من التفاصيل (More details)** ثم اختر **التثبيت على أي حال (Install anyway)**.

---

## 8. الأذونات وتجربة الاستخدام الأولى (Permissions & Testing Scenarios)

### أذونات التطبيق المطلوبة (Required Permissions)
- **الكاميرا (`android.permission.CAMERA`)**: للتصوير المباشر لعلب الأدوية والروشتات عبر الزر الدائري البارز.
- **الصور والوسائط (`READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE`)**: لاختيار صور الأدوية المخزنة على الهاتف.
- **الإنترنت (`android.permission.INTERNET`)**: للتواصل مع الخادم السحابي وتحليل الصور بالذكاء الاصطناعي.

### سيناريوهات التجربة والفحص (Testing Scenarios)
1. **فحص علبة دواء (Medicine Box Analysis)**:
   - اضغط على تبويب "علبة دواء" والتقط صورة لعلبة دواء واضحة.
   - يعرض التطبيق شاشة تحميل دافئة، تليها بطاقات منظمة للاسم التجاري، المادة الفعالة، دواعي الاستعمال، وطريقة الاستخدام.
2. **فحص روشتة طبية (Prescription Analysis)**:
   - اضغط على تبويب "روشتة طبية" والتقط صورة لروشتة طبية.
   - يعرض التطبيق الحالة السريرية المستنتجة، والأدوية المؤكدة في بطاقات فيروزية، والأدوية غير الواضحة في **بطاقات برتقالية تحذيرية** مع اقتراح دوائين كحد أقصى وحجب الجرعات وتوجيه المريض لاستشارة الصيدلي.
3. **فحص الصورة غير الواضحة (Retake Guidance)**:
   - التقط صورة غير واضحة أو مظلمة، سيعرض التطبيق بطاقة إرشادية عربية دافئة تقدم 3 نصائح عملية مع زر مخصص لإعادة التصوير.

---

## 9. التحقق من الاختبارات وخلو الشفرة من الأخطاء (Test Suite Verification)

```powershell
. .\init-env.ps1
cd flutter_app

# 1. التحليل الساكن للشفرة (Static Analysis)
flutter analyze --no-pub

# 2. تشغيل حزمة الاختبارات الشاملة (Unit & Widget Tests)
flutter test
```

- **Static Analysis Result**: `No issues found!` (0 errors, 0 warnings).
- **Test Suite Result**: `106/106 tests passed!` (100% pass rate, 0 regressions).
