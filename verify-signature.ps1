param(
    [string]$ApkPath = "flutter_app\build\app\outputs\flutter-apk\app-debug.apk",
    [string]$BuildTools = "C:\Users\PC\AppData\Local\Android\Sdk\build-tools\35.0.0"
)

$zipalign = Join-Path $BuildTools "zipalign.exe"
$apksigner = Join-Path $BuildTools "apksigner.bat"

Write-Host "=== ZIPALIGN VERIFICATION ==="
if (Test-Path $zipalign) {
    & $zipalign -c 4 $ApkPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "ZIPALIGN PASS: APK is 4-byte aligned."
    } else {
        Write-Host "ZIPALIGN FAIL: Exit code $LASTEXITCODE"
    }
} else {
    Write-Warning "zipalign not found at $zipalign"
}

Write-Host "`n=== APKSIGNER VERIFICATION ==="
if (Test-Path $apksigner) {
    & $apksigner verify --verbose $ApkPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "APKSIGNER PASS: APK signature is valid."
    } else {
        Write-Host "APKSIGNER FAIL: Exit code $LASTEXITCODE"
    }
} else {
    Write-Warning "apksigner not found at $apksigner"
}
