# Gemini API Key Diagnostic Script
# Never prints the key, never writes it to disk

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Gemini API Key & Model Diagnostic Test" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please enter your API key (characters will be hidden):" -ForegroundColor Yellow

$secureKey = Read-Host -Prompt "API Key" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
$key = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Host "[ERROR] No API key entered. Aborting." -ForegroundColor Red
    exit 1
}

$body = '{"contents":[{"parts":[{"text":"Hello"}]}]}'

function Test-Endpoint {
    param(
        [string]$TestName,
        [string]$Url,
        [hashtable]$Headers
    )

    Write-Host ""
    Write-Host "--------------------------------------------------" -ForegroundColor Gray
    Write-Host "Test: $TestName" -ForegroundColor White

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Post -Headers $Headers -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
        Write-Host "HTTP Status Code: $($response.StatusCode) OK" -ForegroundColor Green
        Write-Host "Result: SUCCESS (Model accepted the key and responded)" -ForegroundColor Green
    } catch {
        $ex = $_.Exception
        if ($ex.Response) {
            $statusCode = [int]$ex.Response.StatusCode
            Write-Host "HTTP Status Code: $statusCode" -ForegroundColor Yellow

            $stream = $ex.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()

            try {
                $json = $responseBody | ConvertFrom-Json
                if ($json.error) {
                    Write-Host "error.status:  $($json.error.status)" -ForegroundColor Red
                    Write-Host "error.message: $($json.error.message)" -ForegroundColor Red
                } else {
                    Write-Host "Response body: $responseBody" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "Raw error: $responseBody" -ForegroundColor Yellow
            }
        } else {
            Write-Host "Network or Connection Error: $($ex.Message)" -ForegroundColor Red
        }
    }
}

# 1. gemini-2.5-flash with x-goog-api-key header
Test-Endpoint -TestName "1. gemini-2.5-flash (using x-goog-api-key header)" `
    -Url "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" `
    -Headers @{ "x-goog-api-key" = $key }

# 2. gemini-2.5-flash with ?key= query parameter
Test-Endpoint -TestName "2. gemini-2.5-flash (using ?key= query parameter)" `
    -Url "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$([System.Uri]::EscapeDataString($key))" `
    -Headers @{}

# 3. gemini-3.8-flash with x-goog-api-key header
Test-Endpoint -TestName "3. gemini-3.8-flash (using x-goog-api-key header)" `
    -Url "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent" `
    -Headers @{ "x-goog-api-key" = $key }

# 4. gemini-3.8-flash with ?key= query parameter
Test-Endpoint -TestName "4. gemini-3.8-flash (using ?key= query parameter)" `
    -Url "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=$([System.Uri]::EscapeDataString($key))" `
    -Headers @{}

# Clear the key from memory
$key = $null

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Diagnostic test complete." -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
