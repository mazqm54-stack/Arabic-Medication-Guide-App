# init-env.ps1
# Standardize process-level environment variables for Flutter & Android toolchain

$env:PSExecutionPolicyPreference = "Bypass"
$env:CI = "true"
$env:FLUTTER_SUPPRESS_ANALYTICS = "true"
$env:ANDROID_HOME = "C:\Users\PC\AppData\Local\Android\Sdk"
$env:LOCALAPPDATA = "c:\Users\PC\Documents\antigravity\fervent-mendel\.localappdata"
$env:PUB_CACHE = "c:\Users\PC\Documents\antigravity\fervent-mendel\.pub-cache"

if (-not (Test-Path $env:PUB_CACHE)) {
    New-Item -ItemType Directory -Path $env:PUB_CACHE -Force | Out-Null
}

$flutterBin = "C:\flutter\bin"
$platformTools = "C:\Users\PC\AppData\Local\Android\Sdk\platform-tools"
$cmdlineTools = "C:\Users\PC\AppData\Local\Android\Sdk\cmdline-tools\latest\bin"

# Filter out deprecated flutter paths and avoid duplicate prepends if sourced multiple times
$existingPaths = $env:Path -split ';' | Where-Object {
    $_ -and
    $_ -notlike '*flutter_windows_3.47.9-stable*' -and
    $_ -ne $flutterBin -and
    $_ -ne $platformTools -and
    $_ -ne $cmdlineTools
}

$env:Path = "$flutterBin;$platformTools;$cmdlineTools;" + ($existingPaths -join ';')

Write-Host "Flutter 3.47.9 & Android SDK environment loaded."
