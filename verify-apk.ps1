# Adversarial APK Verification Script for Milestone 5
param(
    [string]$ApkPath = "flutter_app\build\app\outputs\flutter-apk\app-debug.apk",
    [string]$AaptPath = "C:\Users\PC\AppData\Local\Android\Sdk\build-tools\35.0.0\aapt.exe"
)

Write-Host "==========================================================="
Write-Host "   EMPIRICAL ADVERSARIAL PROBE: APK INTEGRITY CHECK"
Write-Host "==========================================================="

if (-not (Test-Path $ApkPath)) {
    Write-Error "CRITICAL: APK file does not exist at $ApkPath"
    exit 1
}

$apk = Get-Item $ApkPath
Write-Host "APK Location: $($apk.FullName)"
Write-Host "File Size: $($apk.Length) bytes ($([math]::Round($apk.Length / 1MB, 2)) MB)"
Write-Host "Last Modified: $($apk.LastWriteTimeUtc) UTC"

$hash = Get-FileHash -Path $ApkPath -Algorithm SHA256
Write-Host "SHA256: $($hash.Hash)"

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($apk.FullName)
Write-Host "Total ZIP Entries: $($zip.Entries.Count)"

Write-Host "`n--- 1. DEX Bytecode Entries ---"
$dexEntries = $zip.Entries | Where-Object { $_.FullName -like "*.dex" }
if ($dexEntries.Count -eq 0) {
    Write-Error "CRITICAL: No classes.dex found in APK!"
}
foreach ($d in $dexEntries) {
    $s = $d.Open()
    $buf = New-Object byte[] 8
    $read = $s.Read($buf, 0, 8)
    $s.Close()
    $hex = ($buf | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
    $isDex = ($buf[0] -eq 0x64 -and $buf[1] -eq 0x65 -and $buf[2] -eq 0x78 -and $buf[3] -eq 0x0A)
    Write-Host "Entry: $($d.FullName) | Size: $($d.Length) bytes | Magic: $hex | Valid DEX: $isDex"
}

Write-Host "`n--- 2. Native Engine Libraries (lib/**) ---"
$libEntries = $zip.Entries | Where-Object { $_.FullName -like "lib/*" }
$requiredABIs = @("arm64-v8a", "armeabi-v7a", "x86_64")
$foundABIs = @{}

foreach ($l in $libEntries) {
    $s = $l.Open()
    $buf = New-Object byte[] 5
    $read = $s.Read($buf, 0, 5)
    $s.Close()
    $hex = ($buf | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
    $isElf = ($buf[0] -eq 0x7F -and $buf[1] -eq 0x45 -and $buf[2] -eq 0x4C -and $buf[3] -eq 0x46)
    $elfClass = switch ($buf[4]) {
        1 { "32-bit" }
        2 { "64-bit" }
        default { "unknown" }
    }
    Write-Host "LIB: $($l.FullName) | Size: $($l.Length) bytes | Magic: $hex ($elfClass) | Valid ELF: $isElf"
    foreach ($abi in $requiredABIs) {
        if ($l.FullName -match "lib/$abi/libflutter\.so") {
            $foundABIs[$abi] = $l.Length
        }
    }
}

foreach ($abi in $requiredABIs) {
    if ($foundABIs.ContainsKey($abi)) {
        Write-Host "ABI PASS: $abi libflutter.so present ($($foundABIs[$abi]) bytes)"
    } else {
        Write-Error "CRITICAL: Missing libflutter.so for ABI $abi"
    }
}

Write-Host "`n--- 3. Typography & Cairo Arabic Fonts ---"
$fontEntries = $zip.Entries | Where-Object { $_.FullName -like "*assets/fonts/*" -or $_.FullName -like "*MaterialIcons*" }
$cairoRegularFound = $false
$cairoBoldFound = $false
$materialIconsFound = $false

foreach ($f in $fontEntries) {
    $s = $f.Open()
    $buf = New-Object byte[] 4
    $read = $s.Read($buf, 0, 4)
    $s.Close()
    $hex = ($buf | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
    Write-Host "FONT: $($f.FullName) | Size: $($f.Length) bytes | Magic: $hex"
    if ($f.FullName -like "*Cairo-Regular.ttf") { $cairoRegularFound = ($f.Length -gt 100000) }
    if ($f.FullName -like "*Cairo-Bold.ttf") { $cairoBoldFound = ($f.Length -gt 100000) }
    if ($f.FullName -like "*MaterialIcons-Regular.otf") { $materialIconsFound = ($f.Length -gt 100000) }
}
Write-Host "Cairo-Regular.ttf present & valid: $cairoRegularFound"
Write-Host "Cairo-Bold.ttf present & valid: $cairoBoldFound"
Write-Host "MaterialIcons-Regular.otf present & valid: $materialIconsFound"

Write-Host "`n--- 4. Drawables & Splash Screens ---"
$splashEntries = $zip.Entries | Where-Object { $_.FullName -like "*splash*" -or $_.FullName -like "*launch_background*" }
foreach ($sp in $splashEntries) {
    Write-Host "SPLASH: $($sp.FullName) | Size: $($sp.Length) bytes"
}

Write-Host "`n--- 5. Launcher Icons ---"
$iconEntries = $zip.Entries | Where-Object { $_.FullName -like "*mipmap*/*ic_launcher*" }
foreach ($ic in $iconEntries) {
    Write-Host "ICON: $($ic.FullName) | Size: $($ic.Length) bytes"
}

$zip.Dispose()

Write-Host "`n--- 6. AAPT Badging & Manifest Analysis ---"
if (Test-Path $AaptPath) {
    & $AaptPath dump badging $apk.FullName
} else {
    Write-Warning "AAPT not found at $AaptPath"
}

Write-Host "`nAPK ADVERSARIAL INSPECTION COMPLETED SUCCESSFULLY."
