# Test Infrastructure Specification — دليلي الدوائي (Dalili Medication Guide)
## Phase 1 Flutter Rebuild & Cloudflare Worker Rebuild

---

## 1. Test Philosophy

The "دليلي الدوائي" (Dalili Medication Guide) Test Suite enforces a clinical-grade, senior-centric quality gate designed specifically for elderly Arabic-speaking patients navigating critical medication packaging and handwritten doctor prescriptions.

The test philosophy rests on five foundational pillars:

1. **Opaque-Box Architectural Independence**:
   Tests treat the edge computing backend (Cloudflare Worker) and mobile client (Flutter Android) as opaque boxes. Verification relies exclusively on observable behaviors: HTTP status codes, structured JSON schemas, Arabic text fidelity, patient safety constraints, and touch target ergonomics. Tests never depend on private variables or internal implementation trivia.

2. **Progressive Testability & Contract Verifiability**:
   Tests validate behavior against the authoritative specifications defined in `ORIGINAL_REQUEST.md` and the 30 features in `PROJECT.md § Feature Inventory` across Milestones M1 through M5. Features spanning multiple milestones are verified via runtime contract schemas, validator algorithms, and state machines to ensure progressive testability without premature failures on unbuilt UI fragments.

3. **Strict Pharmaceutical Safety & Dosage Omission**:
   For handwritten prescriptions, AI suggestions must NEVER present guesses as confirmed medicines. The test harness strictly validates:
   - Clear medicines are read and confirmed first with full doctor instructions (`status: 'confirmed'`, `is_confirmed: true`).
   - Confirmed medicines provide clinical context to deduce underlying medical conditions (`deduced_condition`).
   - Unclear lines produce up to 2 suggestions (`suggested_medicines[]`, `status: 'suggested'`).
   - **MANDATORY SAFETY CONSTRAINT**: All dosage, duration, and frequency instructions are strictly omitted (`written_instructions: ""`, `short_explanation: ""`) for suggestions, accompanied by a prominent warning instructing the user to consult a pharmacist.
   - Illegible scribbles with no plausible match return `status: 'unclear'` with zero trade name guessing.

4. **Zero-Leak Security Assurance**:
   The test suite systematically scans all client source code, build output, android assets, and configuration files to guarantee that zero Google Gemini API keys (`AIza...`), bearer tokens, or sensitive headers exist outside the secure edge worker. Error messages and logs are verified to redact sensitive tokens and raw base64 payloads.

5. **Deterministic, Hermetic Execution**:
   All external network interactions with Google Gemini and Cloudflare Worker endpoints are modeled through deterministic mock contracts and authentic visual/text fixtures. This guarantees 100% reproducible test execution in under 60 seconds without consuming live API quotas or relying on flaky internet connections.

---

## 2. Feature Inventory Mapping (F01 – F30)

| Feature ID | Feature Description | Milestone | Primary Test Suite | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Verification Criteria |
|---|---|---|---|---|---|---|---|---|
| **F01** | Flutter Directory Junction | M1 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | `C:\flutter` junction pointing to Flutter SDK |
| **F02** | System PATH Configuration | M1 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | `flutter/bin`, `platform-tools`, `cmdline-tools` in PATH |
| **F03** | Android Environment Configuration | M1 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | `ANDROID_HOME`, `flutter config --android-sdk/studio-dir` |
| **F04** | Android License Acceptance | M1 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | Automated license acceptance |
| **F05** | Flutter Doctor Clean Run | M1 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | `flutter doctor -v` clean exit code 0 |
| **F06** | Legible First Reading Rule | M2 | `tier1_features/worker_prescription_phase1.test.ts` | 5 | 5 | Yes | Yes | Legible medicines read first with `is_confirmed=true`, `status='confirmed'` |
| **F07** | Clinical Condition Deduction | M2 | `tier1_features/worker_prescription_phase1.test.ts` | 5 | 5 | Yes | Yes | Condition deduced from confirmed lines (infection, diabetes, hypertension) |
| **F08** | Smart Handwriting Suggestions | M2 | `tier1_features/worker_prescription_phase1.test.ts` | 5 | 5 | Yes | Yes | Extract visible letters, match condition, suggest up to 2 medicines |
| **F09** | Strict Suggestion Dosage Omission | M2 | `tier1_features/worker_prescription_phase1.test.ts` | 5 | 5 | Yes | Yes | `written_instructions=""`, warning note to consult pharmacist |
| **F10** | Unclear Handwriting Fallback | M2 | `tier1_features/worker_prescription_phase1.test.ts` | 5 | 5 | Yes | Yes | Return `status='unclear'`, `is_confirmed=false`, never guess |
| **F11** | Prescription Schema Extension | M2 | `tier1_features/worker_prescription_phase1.test.ts` | 5 | 5 | Yes | Yes | `deduced_condition`, `is_confirmed`, `status`, `visible_letters`, `suggested_medicines`, `warning_note` |
| **F12** | Worker Unit & Contract Tests | M2 | `tests/worker.prescription_enhancement.test.ts` | 5 | 5 | Yes | Yes | 100% Vitest pass across prompt rules, schema, and normalization |
| **F13** | Worker Deploy & Endpoint Verification | M2 | `tier1_features/worker_prescription_phase1.test.ts` | 5 | 5 | Yes | Yes | `/health`, `/api/analyze`, `/api/prescription`, `test-prescription.ps1` |
| **F14** | Flutter Project Creation | M3 | `tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | Flutter project layout in `flutter_app/` |
| **F15** | Android Permissions Configuration | M3 | `tier1_features/camera_security.test.ts` | 5 | 5 | Yes | Yes | `CAMERA`, `READ_MEDIA_IMAGES`, `INTERNET` in `AndroidManifest.xml` |
| **F16** | App Identity & Asset Reuse | M3 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | Launcher icons (`mipmap-*`) and splash drawables (`drawable-*`) |
| **F17** | Offline Arabic Font Bundling | M3 | `tests/typography.m1.test.ts` | 5 | 5 | Yes | Yes | Cairo/ReadexPro TTF bundled offline in `assets/fonts/` |
| **F18** | Material 3 RTL Theming | M3 | `tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | RTL directionality, primary teal `#006D77`, Material 3 design |
| **F19** | Bottom Nav with Center Camera | M3 | `tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | Bottom navigation bar with prominent central circular camera button |
| **F20** | Camera & Gallery Image Picker | M4 | `tier1_features/prescription_pipeline.test.ts` | 5 | 5 | Yes | Yes | Native camera capture and gallery photo selection |
| **F21** | Client Image Compression | M4 | `tests/imageProcessor.test.ts` | 5 | 5 | Yes | Yes | Client JPEG compression (<1MB, high quality) |
| **F22** | Medicine Box Analysis Client | M4 | `tier1_features/worker_prescription_phase1.test.ts` | 5 | 5 | Yes | Yes | Submit box image to `/api/analyze` and parse structured cards |
| **F23** | Medicine Box Card Presentation | M4 | `tier1_features/medication_usage.test.ts` | 5 | 5 | Yes | Yes | Render structured pharmaceutical cards (uses, warnings, common usage) |
| **F24** | Prescription Analysis Client | M4 | `tier1_features/worker_prescription_phase1.test.ts` | 5 | 5 | Yes | Yes | Submit image to `/api/prescription` with mode 'prescription' |
| **F25** | Prescription Card Presentation | M4 | `tier1_features/prescription_presentation.test.ts` | 5 | 5 | Yes | Yes | Teal cards for confirmed; orange warning cards for suggestions |
| **F26** | Loading & Error Guidance States | M4 | `tests/errorStates.challenge.test.tsx` | 5 | 5 | Yes | Yes | Warm Arabic loading indicators and 3-point retake cards |
| **F27** | Scope Exclusion Enforcement | M4 | `tests/e2e/tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | Strictly omit voice, history, saved lists, settings, font size toggles |
| **F28** | Debug APK Compilation | M5 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | `flutter build apk --debug` produces valid APK |
| **F29** | APK Verification & Validation | M5 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | Verification of package name, permissions, and launcher icons |
| **F30** | Installation & Delivery Docs | M5 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | Step-by-step installation and testing instructions |

---

## 3. Test Architecture & Directory Structure

```
tests/
├── analyze.test.ts                      # Box analysis endpoint contract tests
├── analyze.adversarial.test.ts          # Adversarial box analysis tests
├── geminiParser.test.ts                 # JSON extraction & markdown fence handling
├── worker.test.ts                       # Cloudflare Worker core tests
├── worker.prescription_enhancement.test.ts # Worker M2 prescription prompt & schema tests
├── e2e/
│   ├── fixtures/
│   │   ├── sampleBoxes.ts               # Authentic medicine box analysis fixtures
│   │   ├── samplePrescriptions.ts       # Authentic prescription fixtures (confirmed, suggestions, unclear)
│   │   └── testContracts.ts             # TypeScript schemas & runtime validators (validatePhase1PrescriptionSchema)
│   ├── helpers/
│   │   ├── mockWorker.ts                # In-memory edge worker simulator adhering to worker/src/index.ts
│   │   └── testHelpers.ts               # Senior touch-target & RTL assertion helpers
│   ├── tier1_features/
│   │   ├── worker_prescription_phase1.test.ts # F06–F13: Worker endpoints, prompts, condition deduction, schema (45 tests)
│   │   ├── camera_security.test.ts      # F15: Camera permissions and zero-leak guarantees
│   │   ├── navigation_shell.test.ts     # F14, F18, F19, F27: M3 shell, theme, RTL, bottom nav
│   │   ├── prescription_pipeline.test.ts # F20, F21, F24: Image capture, compression, client requests
│   │   ├── prescription_presentation.test.ts # F25, F26: Card layout, orange warning banners, retake tips
│   │   ├── medication_usage.test.ts     # F22, F23: Box usage badges and disclaimers
│   │   └── platform_release.test.ts     # F01–F05, F28–F30: Toolchain, APK validation, and release docs
│   ├── tier2_boundaries/
│   │   ├── worker_prescription_phase1_boundary.test.ts # Edge cases: 10 items, suggestion counts, dosage omission, 4MB, 429, 504 (26 tests)
│   │   ├── camera_security_boundary.test.ts
│   │   ├── navigation_shell_boundary.test.ts
│   │   ├── prescription_pipeline_boundary.test.ts
│   │   ├── prescription_presentation_boundary.test.ts
│   │   ├── medication_usage_boundary.test.ts
│   │   └── platform_release_boundary.test.ts
│   ├── tier3_combinations/
│   │   ├── worker_prescription_phase1_combinations.test.ts # Pairwise & multi-endpoint integration flows (7 tests)
│   │   └── cross_feature_combinations.test.ts
│   └── tier4_scenarios/
│       ├── worker_prescription_phase1_scenarios.test.ts # 5 Real-world senior patient journeys (5 tests)
│       └── real_world_scenarios.test.ts
```

---

## 4. Test Harness & Authentic Prescription Fixtures

### A. TypeScript Contracts (`testContracts.ts`)
- `validatePhase1PrescriptionSchema(data: any)`: Strict schema validator enforcing:
  - Presence of `deduced_condition` when items are present.
  - Max 10 items ceiling.
  - Each item status in `['confirmed', 'suggested', 'unclear']`.
  - For `status: 'confirmed'`: `is_confirmed === true`, full name and instructions.
  - For `status: 'suggested'`: `is_confirmed === false`, `written_instructions === ""`, `suggested_medicines` length 1–2, and mandatory pharmacist warning.
  - For `status: 'unclear'`: `is_confirmed === false`, `written_instructions === ""`, zero guesses presented as confirmed.

### B. Authentic Test Fixtures (`samplePrescriptions.ts`)
1. `samplePhase1ConfirmedPrescription`: Clear Augmentin 1g + Panadol Extra -> condition: acute respiratory infection. Both confirmed.
2. `samplePhase1MixedWithSuggestions`: Clear Augmentin 1g + unclear handwritten `C...fl... 500` -> suggests Ciprofloxacin 500mg, Cephalexin 500mg with ZERO dosage and pharmacist consult warning.
3. `samplePhase1ChronicPrescription`: Clear Metformin 500mg -> condition: diabetes mellitus -> unclear `G...cl... 80mg` -> suggests Gliclazide 80mg, Glimepiride 2mg with ZERO dosage.
4. `samplePhase1CardiovascularPrescription`: Clear Concor 5mg -> condition: hypertension -> unclear `A...lo... 5mg` -> suggests Amlodipine 5mg, Atenolol 50mg with ZERO dosage.
5. `samplePhase1UnclearFallback`: Clear Augmentin 1g + unreadable scribble `~~~~~~` -> `status: 'unclear'`, no guesses.
6. `samplePhase1ViolatingDosageSuggestion`: Adversarial test case with illegal dosage on suggestion -> verified to fail validation.

### C. In-Memory Worker Simulator (`mockWorker.ts`)
- Implements `handleRequest(url, init)` reproducing exact Cloudflare Worker routing, CORS preflights, rate limiting (10 req/min), 4MB payload rejection, 25s timeouts, and Phase 1 prescription responses.

---

## 5. Verification Commands

### Execute All Test Suites
```powershell
cmd /c npm test
```

### Execute Phase 1 Worker & Prescription Reasoning Suites Only
```powershell
cmd /c npx vitest run tests/e2e/tier1_features/worker_prescription_phase1.test.ts `
                     tests/e2e/tier2_boundaries/worker_prescription_phase1_boundary.test.ts `
                     tests/e2e/tier3_combinations/worker_prescription_phase1_combinations.test.ts `
                     tests/e2e/tier4_scenarios/worker_prescription_phase1_scenarios.test.ts
```

### Benchmark Live Worker Prescription Accuracy & Latency
```powershell
powershell -ExecutionPolicy Bypass -File .\test-prescription.ps1
```
