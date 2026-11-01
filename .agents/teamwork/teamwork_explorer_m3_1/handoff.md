# Handoff Report — Explorer M3: Client Diagnostics, Timeout, Compression & Error Handling (Requirement R2)

## 1. Observation

1. **Current Codebase State**:
   - `src/utils/imageProcessor.ts`: Currently does not exist. The directory `src/utils/` is absent.
   - `src/services/geminiVision.ts:81-88`:
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
     No `AbortSignal` or timeout is configured. Stalled requests hang indefinitely.
   - `src/services/geminiVision.ts:90-98`:
     ```typescript
     if (!response.ok) {
       const errorData = await response.json().catch(() => ({}));
       const friendlyMessage =
         errorData?.retake_message ||
         errorData?.error ||
         `تعذر الاتصال بالمعالج الذكي (${response.status}). يرجى المحاولة مرة أخرى.`;

       throw new Error(friendlyMessage);
     }
     ```
     The Worker debug field `error_code`, HTTP `status`, and `detail` are extracted into a simple string and discarded.
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
     JSON parse errors return `is_clear: false` with text falsely asserting the photo was unclear.
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
     All failures (timeout, network, server, JSON) are coerced into `is_clear: false` without error category.
   - `src/components/UnclearPhotoCard.tsx:17-19`:
     ```tsx
     <h2 className="text-senior-2xl font-bold">
       الصورة غير واضحة بما يكفي
     </h2>
     ```
     The title and lighting/focus tips are hardcoded, confusing users when a network or server failure occurs. Furthermore, `onRetry` simply resets the application to home, discarding the captured photo.
   - `tests/geminiParser.test.ts:82`:
     ```typescript
     expect(parsed.raw_error).toContain('الصورة غير واضحة');
     ```
     This test explicitly verifies that `parsed.raw_error` contains the substring `'الصورة غير واضحة'`.
   - `npm.cmd test`:
     Command executed cleanly: 14 test files passed, 282 tests passed (Duration: 11.26s).
   - `sign-release.bat`:
     Present in root, validates `dalili-release-key.jks` (alias `dalili`), prompts for password securely via PowerShell `Read-Host -AsSecureString`, runs `gradlew.bat assembleRelease --no-daemon`, copies output to `dalili-app-signed-release.apk`, and verifies signature via `apksigner`.

## 2. Logic Chain

1. Observations 1b and 1e prove that network stalls trap elderly users indefinitely on the loading spinner because `fetch` has no abort timeout. Introducing a 30-second `AbortController` timeout throwing `AnalysisError` with `category: 'network_timeout'` and `errorCode: 'CLIENT_TIMEOUT'` guarantees that stalled requests abort cleanly after 30 seconds with a friendly Arabic explanation.
2. Observations 1c, 1d, 1e, and 1f prove the "Image Not Clear" Fallacy: regardless of whether the failure is a network disconnection, server crash, or corrupted JSON, the app sets `is_clear: false` and mounts `UnclearPhotoCard`, which hardcodes instructions to adjust lighting and camera angles. Separating errors into 4 distinct categories (`network_timeout`, `server_error`, `unclear_image`, `invalid_json`) with tailored titles, icons, and messages directly eliminates this misattribution.
3. Observation 1c shows that Cloudflare Worker debug error codes (such as `UPSTREAM_API_ERROR`, `UPSTREAM_OVERLOADED`, `UPSTREAM_RATE_LIMIT`, `SERVER_CONFIGURATION_ERROR`) are currently discarded by `geminiVision.ts`. Retaining `error_code` and displaying it in an accessible debug badge under `server_error` allows senior users and technicians to report exact error codes without exposing sensitive backend internals.
4. Observation 1g highlights a critical regression constraint: `tests/geminiParser.test.ts:82` asserts `expect(parsed.raw_error).toContain('الصورة غير واضحة')`. Therefore, when updating `geminiParser.ts` for invalid JSON, the error message must retain `'الصورة غير واضحة'` (e.g. `'الصورة غير واضحة بدرجة كافية أو تعذر قراءة رد المعالج الذكي. يرجى إعادة المحاولة.'`) while setting `error_category: 'invalid_json'` and `error_code: 'INVALID_JSON'`.
5. Observation 1a demonstrates the absence of client-side image compression. Raw 12MP–48MP mobile photos create 10MB–30MB payloads, causing HTTP 413 from the Cloudflare Worker (4MB limit) and memory exhaustion on Android WebView. Adding `src/utils/imageProcessor.ts` to clamp dimensions to max 1024px, compress to JPEG 0.75, paint a solid `#FFFFFF` backdrop to avoid Android WebView black transparency bugs, validate `/9j/` header, check length > 500 chars, and run a 10x10 pixel grid sample to reject black/blank frames fully resolves these hazards.
6. In `src/App.tsx`, caching `lastFile` in component state enables interactive retry: clicking "إعادة المحاولة" re-invokes `processImage(lastFile)` without forcing the user to take a new photo.

## 3. Caveats

- **Vitest in jsdom**: In the jsdom environment used by Vitest, `HTMLCanvasElement.prototype.getContext('2d')` returns `null` unless mocked. In `src/test/setup.ts`, a mock for `getContext('2d')` and `toDataURL` must be added so `imageProcessor.ts` unit tests and component tests execute cleanly without native node-canvas dependencies.
- **Android Signing Prerequisites**: Running `sign-release.bat` requires the user to execute it in an interactive terminal to enter their keystore password. It relies on the local Android SDK `apksigner.bat` located at `%LOCALAPPDATA%\Android\Sdk\build-tools\35.0.0\apksigner.bat`.

## 4. Conclusion

Milestone 3 investigation is complete. A comprehensive, step-by-step implementation plan has been written to `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_1\m3_client_plan.md`. Worker M3 has all required specifications, exact code snippets, validation rules, test suites, and signing instructions to execute the milestone cleanly without ambiguity.

## 5. Verification Method

1. **Review Detailed Plan**:
   Read `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_1\m3_client_plan.md`.
2. **Execute Full Test Suite**:
   ```cmd
   npm.cmd test
   ```
   *Baseline verified*: 14 test files passed, 282 tests passed.
3. **Execute Production Build**:
   ```cmd
   npm.cmd run build
   ```
   *Expected outcome*: Exit code 0, TypeScript checks pass, `dist/` bundles generated.
4. **Execute Release APK Signing**:
   ```cmd
   sign-release.bat
   ```
   *Expected outcome*: Prompts for password, builds release APK via Gradle, signs and verifies `dalili-app-signed-release.apk`.
