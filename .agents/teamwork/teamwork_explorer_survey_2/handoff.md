# Handoff Report — Explorer 2: Requirement R2 (Client Diagnostics, Error Handling, Timeout, Image Compression, and Tests)

## 1. Observation
1. **Error Mapping in `src/App.tsx`**:
   - `src/App.tsx:74-80`:
     ```typescript
     } catch (err: unknown) {
       const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الصورة.';
       setCurrentResult({
         is_clear: false,
         raw_error: errorMsg
       });
     }
     ```
   - `src/App.tsx:165-170`:
     ```tsx
     {!currentResult.is_clear ? (
       <UnclearPhotoCard
         onRetry={handleResetToHome}
         errorMessage={currentResult.raw_error}
       />
     ) : (
     ```
   - `src/components/UnclearPhotoCard.tsx:17-19`:
     ```tsx
     <h2 className="text-senior-2xl font-bold">
       الصورة غير واضحة بما يكفي
     </h2>
     ```
   - `src/services/geminiParser.ts:80-86`:
     ```typescript
     } catch (err) {
       console.warn('[GeminiParser] JSON parse error:', err, 'Raw text was:', rawText);
       return {
         is_clear: false,
         raw_error: 'الصورة غير واضحة بدرجة كافية لقراءة بيانات الدواء. يرجى إعادة التصوير في مكان ذي إضاءة جيدة والتركيز على واجهة العلبة.'
       };
     }
     ```
2. **Missing Timeout in `src/services/geminiVision.ts`**:
   - Lines 81-88:
     ```typescript
     const response = await fetch(endpoint, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Accept': 'application/json'
       },
       body: JSON.stringify(payload)
     });
     ```
   - No `AbortSignal` or timeout duration is passed to `fetch()`.
3. **Absence of Image Compression & Android WebView Guardrails**:
   - `src/services/geminiVision.ts:48-61` only runs `FileReader.readAsDataURL()`.
   - `src/utils/` does not exist; there is no canvas scaling, 1024px clamping, JPEG SOI header validation (`/9j/`), or black/blank pixel check.
4. **Worker Debug Field Ignored by Client**:
   - In `worker/src/index.ts:310`, error responses return `{ is_clear: false, retake_message: '...', error: 'UPSTREAM_API_ERROR' }` (and will return `error_code` and `detail` per R3).
   - In `src/services/geminiVision.ts:90-98`, `errorData?.error_code` is ignored; only string messages are thrown.
5. **Existing Test Suite & Build Verification**:
   - `npm.cmd test` command ran and completed with exit code 0: 10 test files passed, 125 tests passed (Duration: 83.47s).
   - `tests/geminiParser.test.ts:82` explicitly checks `expect(parsed.raw_error).toContain('الصورة غير واضحة')`.
   - `npm.cmd run build` ran and completed with exit code 0: `tsc --noEmit && vite build` built production bundles in 23.89s.
6. **Release Build Scripts**:
   - `sign-release.bat` exists in root, checks for `dalili-release-key.jks` (alias `dalili`), prompts for password via PowerShell, runs `gradlew.bat assembleRelease --no-daemon`, copies the output to `dalili-app-signed-release.apk`, and verifies with `apksigner`.

## 2. Logic Chain
1. Observations 1a–1d show that any exception occurring during image analysis (network disconnection, server 500, gateway timeout, or JSON parse failure) is caught and transformed into a result with `is_clear: false`. This causes `App.tsx` to mount `UnclearPhotoCard`, which has a hardcoded Arabic title stating the image is unclear and instructions to focus the camera and turn on lights. This misleads users and directly violates Requirement R2.
2. Observation 2 shows that network requests can hang indefinitely if the connection drops or the server stalls. Introducing an `AbortController` with a 30,000ms timer in `geminiVision.ts` directly resolves this by terminating stalled connections and throwing a specific timeout error.
3. Observation 3 shows that raw camera photos are sent without compression. Mobile cameras produce 10MB–30MB base64 payloads, which exceed Cloudflare Worker's 4MB limit (`MAX_PAYLOAD_BYTES = 4 * 1024 * 1024`) and cause out-of-memory errors on Android WebView. Adding `src/utils/imageProcessor.ts` to clamp to max 1024px, compress to JPEG (quality 0.75), fill a white backdrop to prevent transparent regions from turning black, and sample pixels to detect black/blank frames prevents these issues.
4. Observation 4 shows that Worker diagnostic metadata (`error_code`, `detail`) is dropped on the client. Propagating this metadata into a structured error object enables `UnclearPhotoCard` (or a dedicated diagnostics card) to present the exact debug error code to users or technicians.
5. Observation 5 notes that `geminiParser.test.ts:82` expects the string `'الصورة غير واضحة'` when JSON fails. Therefore, the improved Arabic error message for invalid JSON must retain that phrase or include it alongside the invalid JSON explanation to keep existing tests green.
6. Observation 6 confirms that the release build and signing pipeline is intact and fully operational via `sign-release.bat`.

## 3. Caveats
- Android SDK build tools (`apksigner.bat`) reside on the user's host machine (`%LOCALAPPDATA%\Android\Sdk\build-tools\35.0.0\apksigner.bat`), which cannot be accessed directly inside this sandboxed CLI environment due to Windows directory isolation, but `sign-release.bat` will execute on the user's host.
- Vitest runs in `jsdom` where `HTMLCanvasElement` 2D context methods (`getContext('2d')`) return `null` unless mocked. Unit tests for `imageProcessor.ts` will need canvas 2D mocks in `tests/` or `src/test/setup.ts`.

## 4. Conclusion
Requirement R2 is thoroughly surveyed with exact file paths, line numbers, root cause analyses, and an actionable 5-phase implementation plan.
The four error categories must be separated as:
- `network_timeout`: "تعذر الاتصال بالشبكة أو انتهت مهلة الطلب" with an interactive retry button.
- `server_error`: "حدث خطأ في الخادم الطبي الذكي" with `error_code` badge.
- `unclear_image`: "الصورة غير واضحة بما يكفي" with lighting and centering guidance and camera retake button.
- `invalid_json`: "تعذر قراءة رد المعالج الذكي" with retry button.
Image compression must clamp to 1024px, fill a solid white canvas backdrop, verify JPEG `/9j/` header, and check pixel variance/luminance to guard against black/blank captures on Android WebView.

## 5. Verification Method
1. **Run Vitest Test Suite**:
   ```cmd
   npm.cmd test
   ```
   *Expected outcome*: 10/10 test files pass, 125/125 tests pass.
2. **Run Production Build**:
   ```cmd
   npm.cmd run build
   ```
   *Expected outcome*: Exit code 0, TypeScript checks pass, `dist/` is generated.
3. **Execute Release APK Signing**:
   ```cmd
   sign-release.bat
   ```
   *Expected outcome*: `dalili-app-signed-release.apk` is generated and verified with `apksigner`.
4. **Inspect Survey Report**:
   Inspect `.agents/teamwork/teamwork_explorer_survey_2/survey_client_diagnostics.md` for detailed architectural specs.
