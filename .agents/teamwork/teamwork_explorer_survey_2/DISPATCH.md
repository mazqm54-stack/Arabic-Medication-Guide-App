# Survey Task 2: Client Error Handling, Timeout, Image Compression & Tests (R2)
Target: Investigate client error handling, Arabic messages, 30s timeout, retry button, image compression/validation logic, existing test suite in tests/, and APK build/signing scripts.
Read ORIGINAL_REQUEST.md at c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md.
## 2026-10-29T15:48:15Z
From: 8a80a925-17f2-4fac-a86b-d712a51f21a6

You are Explorer 2 conducting the survey for Requirement R2 (Client Diagnostics, Error Handling, Timeout, Image Compression, and Tests).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_survey_2
Read ORIGINAL_REQUEST.md at: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md before doing anything.

Survey objective:
1. Investigate client error handling and mapping in src/:
   - Check where errors are handled during image analysis.
   - Look for where errors are mapped to "image not clear" or similar messages.
   - Identify how to separate these 4 distinct friendly Arabic messages:
     (a) Network or timeout
     (b) Server error
     (c) The AI said is_clear=false
     (d) Invalid JSON
   - Check how the client reads and handles the Worker debug field `error_code` for failures.
2. Investigate request timeout and retry mechanisms:
   - Check where the client API call is made.
   - Design a 30-second timeout mechanism (e.g. AbortController / AbortSignal.timeout(30000)) with a friendly Arabic message and an interactive retry button.
3. Investigate image compression on Android WebView:
   - Check src/utils/imageProcessor.ts or wherever image compression / resizing is implemented.
   - Check canvas-to-JPEG compression, base64 formatting, and how to verify on Android WebView that the output is a valid JPEG header, non-zero length, valid dimensions, and not blank/black pixels.
4. Investigate the test suite and release build scripts:
   - Check vitest test suite in tests/ and how npm.cmd test runs.
   - Check sign-release.bat and how the APK build and signing instructions are structured.

Write your findings and actionable implementation plan in:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_survey_2\survey_client_diagnostics.md
Write your handoff report in:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_survey_2\handoff.md
Send a completion message back to the orchestrator with a summary of findings and the path to your report.
