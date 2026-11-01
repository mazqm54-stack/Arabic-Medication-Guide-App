## 2026-10-31T16:12:46Z
You are Worker M2 (Client Data Layer, Types, Image Compression & Services Foundation).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_g2_1\
Your parent is: be14d828-8b13-435b-929b-e3dd3fbf5ac6

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read the authoritative files before starting:
1. c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
3. c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_upgrade_survey_2\survey_prescription_worker.md
4. c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_upgrade_survey_3\survey_usage_build_tests.md

Exclusive Write Ownership:
You own ONLY:
- src/types/index.ts
- src/utils/imageProcessor.ts
- src/services/geminiVision.ts
- src/services/geminiParser.ts
- src/services/detailsCache.ts
- tests/detailsCache.test.ts
- tests/geminiParser.test.ts
- tests/imageProcessor.test.ts
Do NOT modify any UI component files in `src/components/` or Worker backend files in `worker/`.

Task Specifications:
1. `src/types/index.ts`:
   - Add `usage_source?: 'printed' | 'common'` to `MedicineAnalysisResult`.
   - Add `ItemConfidence = 'high' | 'medium' | 'low'`.
   - Add `PrescriptionItem`:
     ```typescript
     export interface PrescriptionItem {
       line_text_as_written: string;
       medicine_name_ar: string;
       medicine_name_en: string;
       active_ingredient: string;
       confidence: ItemConfidence;
       written_instructions: string;
       short_explanation: string;
     }
     ```
   - Add `PrescriptionAnalysisResult`:
     ```typescript
     export interface PrescriptionAnalysisResult {
       is_clear: boolean;
       retake_message?: string;
       confidence: 'high' | 'medium' | 'low';
       evidence_text?: string;
       items: PrescriptionItem[];
       audio_summary?: string;
       raw_error?: string;
       error_category?: ErrorCategory;
       error_code?: string;
       error_detail?: string;
     }
     ```
   - Add `ActiveTab = 'home' | 'medicines' | 'prescription' | 'history'`.
2. `src/utils/imageProcessor.ts`:
   - Dual-mode image compression:
     - For medicine boxes: `compressImage(file, maxDimension = 1024, quality = 0.7)` (preserve existing signature & default, maintain `#FFFFFF` canvas prefill to avoid Android WebView black background bug).
     - For prescriptions: export `compressPrescriptionImage(file: File | Blob): Promise<CompressedImage>` with `maxDimension = 1600` and `quality = 0.8`.
3. `src/services/geminiVision.ts`:
   - Add `analyzePrescriptionImage(base64Image: string, signal?: AbortSignal): Promise<PrescriptionAnalysisResult>`:
     - Calls backend with `{ image: base64Image, mode: 'prescription' }` (or `/api/prescription`).
     - Uses 30-second client timeout AbortController.
     - On HTTP 504 or `UPSTREAM_TIMEOUT`: returns/throws network_timeout error category with distinct Arabic message: "استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى."
     - Strictly separates timeouts/server errors from unclear photos.
   - Add `fetchMedicineDetails(medicineName: string, signal?: AbortSignal): Promise<MedicineAnalysisResult>`:
     - Calls backend with `{ medicine_name: medicineName, mode: 'details' }` (or `/api/details`).
     - Returns parsed `MedicineAnalysisResult`.
4. `src/services/geminiParser.ts`:
   - Export `validatePrescriptionJson(data: any): PrescriptionAnalysisResult`:
     - Validates and normalizes `PrescriptionAnalysisResult`.
     - If `items` is empty or absent, set `is_clear: false` with friendly Arabic `retake_message`.
     - Normalizes items array (max 10 items, default values, confidence mapping).
   - In `parseMedicineAnalysisResult`:
     - Extract and pass through `usage_source: 'printed' | 'common'`.
     - Multi-tier defense for `how_and_when`: guarantee it is NEVER empty and NEVER single generic "follow doctor". If empty, inject 2–3 standard safe educational common usage items (`'يؤخذ القرص عبر الفم مع كوب ماء كامل'`, `'يُفضل تناوله في نفس الموعد يومياً للحفاظ على فاعليته'`, `'استشر الصيدلي أو الطبيب لتحديد المواعيد الأنسب لحالتك الصحية'`) and set `usage_source: 'common'`.
5. `src/services/detailsCache.ts`:
   - Create `localStorage` client-side cache for medicine details:
     - Key format: `dalili_details_${normalizedName}`.
     - Normalization helper: trim, lowercase, strip Arabic diacritics/tashkeel.
     - `getCachedDetails(name: string): MedicineAnalysisResult | null`
     - `setCachedDetails(name: string, data: MedicineAnalysisResult): void`
     - `clearDetailsCache(): void`
     - Wrap localStorage operations in try/catch to gracefully handle `QuotaExceededError` or private browsing restrictions.
6. Verification:
   - Create `tests/detailsCache.test.ts`.
   - Update `tests/geminiParser.test.ts` and `tests/imageProcessor.test.ts`.
   - Run `npx.cmd vitest run tests/detailsCache.test.ts tests/geminiParser.test.ts tests/imageProcessor.test.ts`.
   - Run `npx.cmd tsc --noEmit` and ensure 0 type errors.
   - Run full test suite: `npx.cmd vitest run`.


## 2026-10-31T16:33:55Z
**Context**: Milestone M2 (Client Data Layer, Types, Image Compression & Services Foundation).
**Content**: We observed that `src/types/index.ts`, `src/utils/imageProcessor.ts`, `src/services/detailsCache.ts`, `src/services/geminiVision.ts`, and `tests/detailsCache.test.ts` have all been written and updated.
**Action**: Please report your verification status (`npx.cmd vitest run`, `npx.cmd tsc --noEmit`) and deliver your `handoff.md`.
