# Dalili Medication Guide - Release Build and Sign Script (PowerShell)
# English text only, ASCII encoding

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Dalili Medication Guide - Android Release Build and Sign" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$keystoreFile = Join-Path $scriptDir "dalili-release-key.jks"
$keyAlias = "dalili"
$outputApk = Join-Path $scriptDir "dalili-app-signed-release.apk"

if (-not (Test-Path $keystoreFile)) {
    Write-Host "[ERROR] Keystore file not found: $keystoreFile" -ForegroundColor Red
    Write-Host "Make sure dalili-release-key.jks is in the project root directory."
    exit 1
}

Write-Host "Keystore found: $keystoreFile"
Write-Host "Key Alias:      $keyAlias"
Write-Host ""

Write-Host "[1/4] Enter your Keystore Password (characters will be hidden):" -ForegroundColor Yellow
$securePass = Read-Host -Prompt "Keystore password" -AsSecureString

$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
$plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($plainPass)) {
    Write-Host "[ERROR] No password was entered. Build canceled." -ForegroundColor Red
    exit 1
}

$env:DALILI_KEYSTORE_PASSWORD = $plainPass
$env:DALILI_KEY_PASSWORD = $plainPass
$env:DALILI_KEY_ALIAS = $keyAlias
$env:DALILI_KEYSTORE_FILE = $keystoreFile

Write-Host ""
Write-Host "[2/4] Building and signing Release APK via Gradle..." -ForegroundColor Green
Push-Location "$scriptDir\android"

cmd.exe /c "gradlew.bat assembleRelease --no-daemon"
$gradleExit = $LASTEXITCODE

Pop-Location

# Clear password from environment variables immediately
$env:DALILI_KEYSTORE_PASSWORD = $null
$env:DALILI_KEY_PASSWORD = $null
$plainPass = $null

if ($gradleExit -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Gradle build failed with exit code $gradleExit." -ForegroundColor Red
    Write-Host "Please verify that the password you entered is correct." -ForegroundColor Red
    exit $gradleExit
}

$gradleReleaseApk = Join-Path $scriptDir "android\app\build\outputs\apk\release\app-release.apk"
$gradleUnsignedApk = Join-Path $scriptDir "android\app\build\outputs\apk\release\app-release-unsigned.apk"

if (Test-Path $gradleReleaseApk) {
    Write-Host ""
    Write-Host "[3/4] Copying signed APK to project root..." -ForegroundColor Green
    Copy-Item -Path $gradleReleaseApk -Destination $outputApk -Force
    Write-Host "Created file: dalili-app-signed-release.apk" -ForegroundColor Green
} elseif (Test-Path $gradleUnsignedApk) {
    Write-Host ""
    Write-Host "[3/4] Release APK was built unsigned. Signing with apksigner..." -ForegroundColor Yellow
    $apksigner = "$env:LOCALAPPDATA\Android\Sdk\build-tools\35.0.0\apksigner.bat"
    if (-not (Test-Path $apksigner)) {
        $apksigner = "C:\Users\PC\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat"
    }
    if (Test-Path $apksigner) {
        cmd.exe /c "`"$apksigner`" sign --ks `"$keystoreFile`" --ks-key-alias `"$keyAlias`" --out `"$outputApk`" `"$gradleUnsignedApk`""
    }
} else {
    Write-Host "[ERROR] Could not find Gradle output APK!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $outputApk)) {
    Write-Host "[ERROR] Final APK does not exist at $outputApk" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/4] Verifying APK signature..." -ForegroundColor Green
$apksigner = "$env:LOCALAPPDATA\Android\Sdk\build-tools\35.0.0\apksigner.bat"
if (-not (Test-Path $apksigner)) {
    $apksigner = "C:\Users\PC\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat"
}

if (Test-Path $apksigner) {
    cmd.exe /c "`"$apksigner`" verify --verbose `"$outputApk`""
} else {
    Write-Host "[WARNING] apksigner tool not found. Signature verification skipped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Build and signing completed successfully!" -ForegroundColor Green
Write-Host "Final APK: $outputApk" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
