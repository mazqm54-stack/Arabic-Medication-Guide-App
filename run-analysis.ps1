. .\init-env.ps1
$env:LOCALAPPDATA = "C:\Users\PC\AppData\Local\Temp"
Set-Location flutter_app
flutter analyze --no-pub
