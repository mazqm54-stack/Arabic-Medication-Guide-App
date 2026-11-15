@echo off
setlocal EnableDelayedExpansion

title Dalili Medication Guide - Release Build and Sign

echo ======================================================================
echo    Dalili Medication Guide - Android Release Build and Sign
echo ======================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "KEYSTORE_FILE=%SCRIPT_DIR%dalili-release-key.jks"
set "KEY_ALIAS=dalili"
set "OUTPUT_APK=%SCRIPT_DIR%dalili-app-signed-release.apk"

if not exist "%KEYSTORE_FILE%" (
    echo [ERROR] Keystore file not found: %KEYSTORE_FILE%
    echo Make sure dalili-release-key.jks is in the project root directory.
    echo.
    pause
    exit /b 1
)

echo Keystore found: %KEYSTORE_FILE%
echo Key Alias:      %KEY_ALIAS%
echo.
echo ======================================================================
echo [REMINDER] Before proceeding, verify that versionCode and versionName
echo            in android/app/build.gradle are incremented for clean APK
echo            upgrades on target Android devices.
echo            Current release: versionCode 3, versionName "1.2"
echo ======================================================================
echo.

echo [1/4] Enter your Keystore Password (characters will be hidden):
for /f "delims=" %%p in ('powershell.exe -NoProfile -Command "$p = Read-Host -Prompt 'Keystore password' -AsSecureString; if ($p) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)) }"') do set "DALILI_KEYSTORE_PASSWORD=%%p"

if "%DALILI_KEYSTORE_PASSWORD%"=="" (
    echo.
    echo [ERROR] No password was entered. Build canceled.
    echo.
    pause
    exit /b 1
)

set "DALILI_KEY_PASSWORD=%DALILI_KEYSTORE_PASSWORD%"
set "DALILI_KEY_ALIAS=%KEY_ALIAS%"
set "DALILI_KEYSTORE_FILE=%KEYSTORE_FILE%"

echo.
echo [2/4] Building and signing Release APK via Gradle...
cd /d "%SCRIPT_DIR%android"
call gradlew.bat assembleRelease --no-daemon
set "BUILD_STATUS=%ERRORLEVEL%"
cd /d "%SCRIPT_DIR%"

:: Clear password from environment variables immediately
set "DALILI_KEYSTORE_PASSWORD="
set "DALILI_KEY_PASSWORD="

if not "%BUILD_STATUS%"=="0" (
    echo.
    echo [ERROR] Gradle build failed with exit code %BUILD_STATUS%.
    echo Please verify that the password you entered is correct.
    echo.
    pause
    exit /b %BUILD_STATUS%
)

set "GRADLE_RELEASE_APK=%SCRIPT_DIR%android\app\build\outputs\apk\release\app-release.apk"
set "GRADLE_UNSIGNED_APK=%SCRIPT_DIR%android\app\build\outputs\apk\release\app-release-unsigned.apk"

if exist "%GRADLE_RELEASE_APK%" (
    echo.
    echo [3/4] Copying signed APK to project root...
    copy /y "%GRADLE_RELEASE_APK%" "%OUTPUT_APK%" >nul
) else if exist "%GRADLE_UNSIGNED_APK%" (
    echo.
    echo [3/4] Release APK was built but not signed by Gradle.
    echo Attempting to sign with apksigner...
    set "APKSIGNER=%LOCALAPPDATA%\Android\Sdk\build-tools\35.0.0\apksigner.bat"
    if not exist "!APKSIGNER!" set "APKSIGNER=C:\Users\PC\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat"
    if exist "!APKSIGNER!" (
        call "!APKSIGNER!" sign --ks "%KEYSTORE_FILE%" --ks-key-alias "%KEY_ALIAS%" --out "%OUTPUT_APK%" "%GRADLE_UNSIGNED_APK%"
    )
) else (
    echo.
    echo [ERROR] Could not find Gradle output APK!
    echo Expected: %GRADLE_RELEASE_APK%
    echo.
    pause
    exit /b 1
)

if not exist "%OUTPUT_APK%" (
    echo.
    echo [ERROR] Final APK does not exist at %OUTPUT_APK%
    echo.
    pause
    exit /b 1
)

echo.
echo [4/4] Verifying APK signature...
set "APKSIGNER=%LOCALAPPDATA%\Android\Sdk\build-tools\35.0.0\apksigner.bat"
if not exist "%APKSIGNER%" set "APKSIGNER=C:\Users\PC\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat"
if exist "%APKSIGNER%" (
    call "%APKSIGNER%" verify --verbose "%OUTPUT_APK%"
) else (
    echo [WARNING] apksigner tool not found. Signature verification skipped.
)

echo.
echo ======================================================================
echo Build and signing completed successfully!
echo Final APK: %OUTPUT_APK%
echo ======================================================================
echo.
pause
