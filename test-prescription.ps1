# Prescription Accuracy & Speed Benchmark
# Never prints the key, never writes it to disk

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Dalili - Prescription Model Accuracy & Latency Benchmark" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please enter your Gemini API key (characters will be hidden):" -ForegroundColor Yellow

$secureKey = Read-Host -Prompt "API Key" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
$apiKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "[ERROR] No API key entered. Aborting." -ForegroundColor Red
    exit 1
}

$scratchDir = "C:\Users\PC\.gemini\antigravity\brain\170d80c1-6e0b-4aad-8d18-f78210a4ad23\scratch"
$stdPath = Join-Path $scratchDir "rx_prescription.jpg"
$hardPath = Join-Path $scratchDir "rx_prescription_hard.jpg"

if (!(Test-Path $stdPath) -or !(Test-Path $hardPath)) {
    Write-Host "[ERROR] Sample prescription images not found in $scratchDir" -ForegroundColor Red
    exit 1
}

$stdBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($stdPath))
$hardBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($hardPath))

$systemPrompt = @"
You are an expert medical pharmacist assistant for elderly Arabic-speaking users. You will receive a photo of a doctor's medical prescription (روشتة طبية). Your job is to READ what the doctor wrote with extreme accuracy, care, and safety.

STRICT RULES:
1. Read ONLY what is actually written on the prescription. NEVER guess or invent a medicine name from partial or unclear letters. If a line or medicine name is unclear or illegible, set confidence to 'low' and leave medicine_name_ar / medicine_name_en empty or write only the exact letters you can distinctly see.
2. If the entire image is blurry, too dark, cropped, unreadable, or is NOT a medical prescription, set is_clear=false, set confidence='low', leave items as an empty array [], and write a warm, friendly Arabic retake_message guiding the user on how to retake the photo.
3. Copy what the doctor wrote regarding dosage, frequency, or duration EXACTLY into written_instructions. NEVER invent, assume, or complete instructions. If the doctor wrote no instructions for that item, leave written_instructions as an empty string "".
4. For each readable medicine (confidence 'high' or 'medium'), provide a one-sentence, very simple Arabic explanation of what this medicine is generally used for in short_explanation. For low-confidence items, you MUST leave short_explanation as an empty string "".
5. Extract a maximum of 10 items.
6. Copy the exact text of each line as written into line_text_as_written.
7. Set item confidence: 'high' | 'medium' | 'low'.
8. audio_summary must provide a warm, respectful Arabic read-aloud summary for elderly users.
9. Always write in simple, warm, clear Modern Standard Arabic.
10. Return JSON only, strictly matching the schema. No markdown, no extra commentary.
"@

$schemaJson = @'
{
  "type": "OBJECT",
  "properties": {
    "is_clear": { "type": "BOOLEAN" },
    "retake_message": { "type": "STRING" },
    "confidence": { "type": "STRING", "enum": ["high", "medium", "low"] },
    "evidence_text": { "type": "STRING" },
    "items": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "line_text_as_written": { "type": "STRING" },
          "medicine_name_ar": { "type": "STRING" },
          "medicine_name_en": { "type": "STRING" },
          "active_ingredient": { "type": "STRING" },
          "confidence": { "type": "STRING", "enum": ["high", "medium", "low"] },
          "written_instructions": { "type": "STRING" },
          "short_explanation": { "type": "STRING" }
        },
        "required": [
          "line_text_as_written",
          "medicine_name_ar",
          "medicine_name_en",
          "active_ingredient",
          "confidence",
          "written_instructions",
          "short_explanation"
        ]
      }
    },
    "audio_summary": { "type": "STRING" }
  },
  "required": [
    "is_clear",
    "retake_message",
    "confidence",
    "evidence_text",
    "items",
    "audio_summary"
  ]
}
'@

function Invoke-GeminiDirect {
    param(
        [string]$Model,
        [string]$ImageBase64,
        [string]$ThinkingSetting
    )

    $url = "https://generativelanguage.googleapis.com/v1beta/models/$($Model):generateContent?key=$apiKey"
    
    $genConfig = @{
        responseMimeType = "application/json"
        responseSchema   = ($schemaJson | ConvertFrom-Json)
    }

    if ($ThinkingSetting -eq "minimal") {
        $genConfig["thinkingConfig"] = @{
            thinkingBudget = 0
        }
    }

    $payload = @{
        systemInstruction = @{
            parts = @(
                @{ text = $systemPrompt }
            )
        }
        contents = @(
            @{
                role  = "user"
                parts = @(
                    @{ text = "Analyze this doctor prescription photo and extract all details according to the instructions." },
                    @{ inlineData = @{ mimeType = "image/jpeg"; data = $ImageBase64 } }
                )
            }
        )
        generationConfig  = $genConfig
    }

    $jsonBody = $payload | ConvertTo-Json -Depth 15

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Body $jsonBody -ContentType "application/json" -TimeoutSec 60
        $sw.Stop()
        $durationSec = [math]::Round($sw.Elapsed.TotalSeconds, 2)
        
        $textOut = $response.candidates[0].content.parts[0].text
        $parsed = $textOut | ConvertFrom-Json
        return @{
            Success     = $true
            StatusCode  = 200
            DurationSec = $durationSec
            Data        = $parsed
            RawError    = $null
        }
    } catch {
        $sw.Stop()
        $durationSec = [math]::Round($sw.Elapsed.TotalSeconds, 2)
        $statusCode = 0
        $errMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        return @{
            Success     = $false
            StatusCode  = $statusCode
            DurationSec = $durationSec
            Data        = $null
            RawError    = $errMsg
        }
    }
}

$allBenchmarkResults = @{}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  BENCHMARK EXECUTION STARTING (3 RUNS PER TEST)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# ----------------------------------------------------------------------
# 1. gemini-3.5-flash-lite on Standard Sample (3 runs)
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "[1/3] gemini-3.5-flash-lite on STANDARD Prescription (rx_prescription.jpg)..." -ForegroundColor Green
$test1Runs = @()
for ($i = 1; $i -le 3; $i++) {
    Write-Host "  -> Run $i/3: " -NoNewline
    $res = Invoke-GeminiDirect -Model "gemini-3.5-flash-lite" -ImageBase64 $stdBase64 -ThinkingSetting "none"
    if ($res.Success) {
        Write-Host "HTTP $($res.StatusCode) in $($res.DurationSec)s (Items extracted: $($res.Data.items.Count))" -ForegroundColor Green
    } else {
        Write-Host "HTTP $($res.StatusCode) in $($res.DurationSec)s ($($res.RawError))" -ForegroundColor Red
    }
    $test1Runs += $res
    Start-Sleep -Milliseconds 300
}
$allBenchmarkResults["flash_lite_standard"] = $test1Runs

# ----------------------------------------------------------------------
# 2. gemini-3.5-flash-lite on Hard Sample (3 runs)
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "[2/3] gemini-3.5-flash-lite on HARD Prescription (rx_prescription_hard.jpg)..." -ForegroundColor Yellow
$test2Runs = @()
for ($i = 1; $i -le 3; $i++) {
    Write-Host "  -> Run $i/3: " -NoNewline
    $res = Invoke-GeminiDirect -Model "gemini-3.5-flash-lite" -ImageBase64 $hardBase64 -ThinkingSetting "none"
    if ($res.Success) {
        Write-Host "HTTP $($res.StatusCode) in $($res.DurationSec)s (Items extracted: $($res.Data.items.Count))" -ForegroundColor Green
    } else {
        Write-Host "HTTP $($res.StatusCode) in $($res.DurationSec)s ($($res.RawError))" -ForegroundColor Red
    }
    $test2Runs += $res
    Start-Sleep -Milliseconds 300
}
$allBenchmarkResults["flash_lite_hard"] = $test2Runs

# ----------------------------------------------------------------------
# 3. gemini-3.8-flash on Standard Sample with thinking disabled (3 runs)
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "[3/3] gemini-3.8-flash (thinking disabled) on STANDARD Prescription..." -ForegroundColor Magenta
$test3Runs = @()
for ($i = 1; $i -le 3; $i++) {
    Write-Host "  -> Run $i/3: " -NoNewline
    $res = Invoke-GeminiDirect -Model "gemini-3.8-flash" -ImageBase64 $stdBase64 -ThinkingSetting "none"
    if ($res.Success) {
        Write-Host "HTTP $($res.StatusCode) in $($res.DurationSec)s (Items extracted: $($res.Data.items.Count))" -ForegroundColor Green
    } else {
        Write-Host "HTTP $($res.StatusCode) in $($res.DurationSec)s ($($res.RawError))" -ForegroundColor Red
    }
    $test3Runs += $res
    Start-Sleep -Milliseconds 300
}
$allBenchmarkResults["flash_38_standard"] = $test3Runs

# Save results JSON
$outputJsonPath = Join-Path $scratchDir "benchmark_prescription_results.json"
$allBenchmarkResults | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputJsonPath -Encoding utf8

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  ACCURACY VERIFICATION AGAINST GROUND TRUTH (Run 1 Examples)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Show Standard Results
Write-Host ""
Write-Host "--- Standard Prescription Ground Truth vs gemini-3.5-flash-lite ---" -ForegroundColor White
Write-Host ("{0,-35} | {1,-35} | {2,-7}" -f "Written Ground Truth", "Model Reading", "Correct")
Write-Host ("-" * 82)
$stdGT = @(
    @{ Name = "Augmentin 1g Tablets"; Sig = "1 tab every 12h after meals" },
    @{ Name = "Panadol Extra 500mg"; Sig = "1 tab PRN every 6-8h for pain" },
    @{ Name = "Omeprazole 20mg"; Sig = "1 cap daily before breakfast" }
)
$items1 = $test1Runs[0].Data.items
for ($j = 0; $j -lt 3; $j++) {
    $gt = $stdGT[$j]
    $mItem = if ($j -lt $items1.Count) { $items1[$j] } else { $null }
    $readText = if ($mItem) { "$($mItem.medicine_name_en) ($($mItem.medicine_name_ar))" } else { "[Not extracted]" }
    $correct = if ($mItem -and ($readText -match ($gt.Name.Split(' ')[0]))) { "YES" } else { "NO" }
    Write-Host ("{0,-35} | {1,-35} | {2,-7}" -f $gt.Name, $readText, $correct) -ForegroundColor (if ($correct -eq "YES") { "Green" } else { "Red" })
    if ($mItem) {
        Write-Host ("  Sig GT:   {0}" -f $gt.Sig) -ForegroundColor Gray
        Write-Host ("  Sig Read: {0}" -f $mItem.written_instructions) -ForegroundColor Cyan
    }
}

# Show Hard Results
Write-Host ""
Write-Host "--- Hard Prescription (Handwriting) Ground Truth vs gemini-3.5-flash-lite ---" -ForegroundColor White
Write-Host ("{0,-35} | {1,-35} | {2,-7}" -f "Written Ground Truth", "Model Reading", "Correct")
Write-Host ("-" * 82)
$hardGT = @(
    @{ Name = "Cravit 500mg tab"; Sig = "1 tab daily with water for 5 days" },
    @{ Name = "Cataflam 50mg tab"; Sig = "1 tab after meals twice daily PRN" },
    @{ Name = "Pantozol 40mg tab"; Sig = "1 tab morning before breakfast" }
)
$items2 = $test2Runs[0].Data.items
for ($j = 0; $j -lt 3; $j++) {
    $gt = $hardGT[$j]
    $mItem = if ($j -lt $items2.Count) { $items2[$j] } else { $null }
    $readText = if ($mItem) { "$($mItem.medicine_name_en) ($($mItem.medicine_name_ar))" } else { "[Not extracted]" }
    $correct = if ($mItem -and ($readText -match ($gt.Name.Split(' ')[0]))) { "YES" } else { "NO" }
    Write-Host ("{0,-35} | {1,-35} | {2,-7}" -f $gt.Name, $readText, $correct) -ForegroundColor (if ($correct -eq "YES") { "Green" } else { "Red" })
    if ($mItem) {
        Write-Host ("  Sig GT:   {0}" -f $gt.Sig) -ForegroundColor Gray
        Write-Host ("  Sig Read: {0}" -f $mItem.written_instructions) -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  LATENCY COMPARISON SUMMARY (3 RUNS EACH)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

function Format-Summary {
    param($Title, $Runs)
    $d1 = $Runs[0].DurationSec
    $d2 = $Runs[1].DurationSec
    $d3 = $Runs[2].DurationSec
    $avg = [math]::Round(($d1 + $d2 + $d3) / 3, 2)
    Write-Host ("{0,-48} : Run1: {1,5}s | Run2: {2,5}s | Run3: {3,5}s | Avg: {4,5}s" -f $Title, $d1, $d2, $d3, $avg)
}

Format-Summary "gemini-3.5-flash-lite on Standard Sample" $test1Runs
Format-Summary "gemini-3.5-flash-lite on Hard Sample" $test2Runs
Format-Summary "gemini-3.8-flash (thinking off) on Standard" $test3Runs

Write-Host ""
Write-Host "Benchmark complete! Data saved to: $outputJsonPath" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
