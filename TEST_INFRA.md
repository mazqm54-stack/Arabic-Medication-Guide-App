# Test Infrastructure Specification — دليلي الدوائي (Dalili Medication Guide)

## 1. Test Philosophy

The "دليلي الدوائي" (Dalili Medication Guide) E2E Test Suite enforces an uncompromising, production-grade quality gate designed specifically for elderly Arabic-speaking patients navigating critical medication decisions on mobile Android devices.

The test philosophy rests on five foundational pillars:

1. **Opaque-Box Architectural Independence**:
   Tests treat application components and the edge computing backend as opaque boxes. Verification relies exclusively on observable behaviors: DOM hierarchies, ARIA accessibility attributes, touch target dimensions, HTTP network payloads, storage states, and user-visible Arabic strings. Tests never depend on private variables or internal implementation trivia.

2. **Progressive Testability & Contract Verifiability**:
   Tests validate behavior against the authoritative specifications defined in `ORIGINAL_REQUEST.md` and the 28 features in `PROJECT.md § Feature Inventory`. Features spanning multiple milestones are verified via contract schemas, validator algorithms, and state machines to ensure progressive testability without premature failures on unbuilt UI fragments.

3. **Senior-Centric Accessibility & Native Ergonomics**:
   Every visual and interactive test asserts strict compliance with elderly accessibility standards:
   - Minimum interactive touch target height $\ge 64\text{px}$ (and $72\text{--}80\text{px}$ for the central camera trigger).
   - Minimum icon size $\ge 28\text{px}$ and bold label font $\ge 16\text{px}$.
   - Base typography $\ge 20\text{px}$ in regular mode, scaling to $\ge 24\text{px}$ in extra-large mode.
   - Native mobile shell constraints: `user-select: none`, `-webkit-tap-highlight-color: transparent`, and `overscroll-behavior: none`.
   - Strict Right-to-Left (RTL) Arabic layout (`dir="rtl"`).

4. **Zero-Leak Security Assurance**:
   The test suite systematically scans all client source code, build output, android assets, and configuration files to guarantee that zero Google Gemini API keys (`AIza...`), bearer tokens, or raw client-side storage keys exist outside the secure edge worker.

5. **Deterministic, Hermetic Execution**:
   All external network interactions with Google Gemini and Cloudflare Worker endpoints are modeled through deterministic mock contracts and authentic visual/text fixtures. This guarantees 100% reproducible test execution in under 30 seconds without consuming live API quotas or relying on flaky internet connections.

---

## 2. Feature Inventory Mapping (F01 – F28)

The test suite systematically validates every feature from `PROJECT.md § Feature Inventory` across four rigorous testing tiers:

| Feature ID | Feature Description | Milestone | Primary Test Suite | Tier 1 (Min 5) | Tier 2 (Min 5) | Tier 3 (Cross) | Tier 4 (Scenario) | Primary Verification Criteria |
|---|---|---|---|---|---|---|---|---|
| **F01** | Camera Crash Fix Preservation | M1/M3 | `tier1_features/camera_security.test.ts` | 5 | 5 | Yes | Yes | `@capacitor/camera@6.1.2`, AndroidManifest `<queries>`, `CameraSource.Camera` |
| **F02** | Secret Zero-Leak Guarantee | M1/M5 | `tier1_features/camera_security.test.ts` | 5 | 5 | Yes | Yes | Zero `AIza...` keys in `src/`, `dist/`, or `android/`, sanitized logs |
| **F03** | Fixed Bottom Navigation Bar | M3 | `tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | 5 tabs in RTL order: الرئيسية, أدويتي, Camera, الروشتة, السجل |
| **F04** | Center Raised Camera Button | M3 | `tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | 72–80px circular button, teal `#006D77`, white camera icon, label "صوّر" |
| **F05** | Native Tab Ergonomics | M3 | `tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | Touch targets $\ge 64\text{px}$, icons $\ge 28\text{px}$, labels $\ge 16\text{px}$, active pill |
| **F06** | Native Mobile Feel Styling | M3 | `tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | `user-select: none`, `-webkit-tap-highlight-color: transparent`, `overscroll: none` |
| **F07** | Home Screen Redesign | M3 | `tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | Greeting banner, 2 prominent cards ("صوّر علبة دواء", "صوّر روشتة"), scan list |
| **F08** | Medical Disclaimer Persistence | M3/M4 | `tier1_features/navigation_shell.test.ts` | 5 | 5 | Yes | Yes | Disclaimer banner visible across scan results, prescription cards, details |
| **F09** | Prescription Camera & Gallery Flow | M4 | `tier1_features/prescription_pipeline.test.ts` | 5 | 5 | Yes | Yes | Tab "الروشتة" triggers camera capture ("صوّر الروشتة") and gallery picker |
| **F10** | Prescription High-Res Compression | M2 | `tier1_features/prescription_pipeline.test.ts` | 5 | 5 | Yes | Yes | Longest side $\le 1600\text{px}$, quality 0.8 for prescription (vs 1024px/0.7 for box) |
| **F11** | Cloudflare Worker Prescription Route | M1 | `tier1_features/prescription_pipeline.test.ts` | 5 | 5 | Yes | Yes | Mode `"prescription"`, 5 strict rules, JSON schema, verbatim doctor instructions |
| **F12** | Model Configuration Env Vars | M1 | `tier1_features/prescription_pipeline.test.ts` | 5 | 5 | Yes | Yes | `GEMINI_MODEL_PRESCRIPTION` (`gemini-3.8-flash`, LOW thinking), `GEMINI_MODEL` |
| **F13** | Worker 25s Abort & Client 30s Timeout | M1/M2 | `tier1_features/prescription_pipeline.test.ts` | 5 | 5 | Yes | Yes | Worker abort at 25s (`UPSTREAM_TIMEOUT`), client abort at 30s (`CLIENT_TIMEOUT`) |
| **F14** | Prescription Schema & Empty Items | M2/M4 | `tier1_features/prescription_pipeline.test.ts` | 5 | 5 | Yes | Yes | Schema validator: empty items array routes immediately to retake screen |
| **F15** | Prescription Card Layout | M4 | `tier1_features/prescription_presentation.test.ts` | 5 | 5 | Yes | Yes | One big card per readable medicine: large name, purpose, "ما كتبه الطبيب" |
| **F16** | Low-Confidence Amber Card | M4 | `tier1_features/prescription_presentation.test.ts` | 5 | 5 | Yes | Yes | Soft amber card: "غير واضح، اسأل الصيدلي", zero AI hallucination/explanation |
| **F17** | Advisory Banner & Read-Aloud | M4 | `tier1_features/prescription_presentation.test.ts` | 5 | 5 | Yes | Yes | Header "راجع أسماء الأدوية قبل الاعتماد", read-aloud button for whole sheet |
| **F18** | Medicine Details Mode & Client Cache | M1/M2/M4 | `tier1_features/prescription_presentation.test.ts` | 5 | 5 | Yes | Yes | Mode `"details"` (text name $\to$ 4-card box schema), cache in localStorage |
| **F19** | Unclear Photo Guidance | M4 | `tier1_features/prescription_presentation.test.ts` | 5 | 5 | Yes | Yes | Friendly Arabic message with 3 retake tips (lighting, framing, steadiness) |
| **F20** | Partial Prescription Clarity | M4 | `tier1_features/prescription_presentation.test.ts` | 5 | 5 | Yes | Yes | Legible lines rendered normally, illegible lines rendered as amber cards |
| **F21** | Medication Usage Non-Empty Guarantee | M1/M2/M4 | `tier1_features/medication_usage.test.ts` | 5 | 5 | Yes | Yes | `how_and_when` never empty and never "follow doctor", gives 2–3 common usages |
| **F22** | Usage Source Badging | M1/M2/M4 | `tier1_features/medication_usage.test.ts` | 5 | 5 | Yes | Yes | Badges "مكتوب على العلبة" / "مكتوب في الروشتة" / "الاستخدام الشائع" |
| **F23** | Hardcoded Arabic Disclaimer Line | M4 | `tier1_features/medication_usage.test.ts` | 5 | 5 | Yes | Yes | Fixed Arabic disclaimer under usage card: "هذا الاستخدام الشائع، ويختلف..." |
| **F24** | Worker Box Prompt Rule 6 Update | M1 | `tier1_features/medication_usage.test.ts` | 5 | 5 | Yes | Yes | Box Rule 6 allows general common usage while forbidding exact doses/advice |
| **F25** | Android Versioning Increment | M5 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | `versionCode 2` and `versionName "1.1"` in `android/app/build.gradle` |
| **F26** | Release Signing & Version Reminder | M5 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | `sign-release.bat` checks and warns/automates clean APK upgrade versioning |
| **F27** | Vitest Test Suite Expansion | M5 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | 100% test pass rate across all unit, integration, and E2E suites |
| **F28** | Live Worker Deploy Verification | M5 | `tier1_features/platform_release.test.ts` | 5 | 5 | Yes | Yes | `wrangler.toml` env vars, `/health` contract, and deployment readiness |

---

## 3. Test Architecture & Directory Structure

```
tests/e2e/
├── fixtures/
│   ├── samplePrescriptions.ts    # Authentic mock prescription responses & payloads
│   ├── sampleBoxes.ts            # Authentic medicine box analysis responses
│   └── testContracts.ts          # Request/response TypeScript schemas & validators
├── helpers/
│   ├── mockWorker.ts             # In-memory edge worker simulator adhering to worker/src/index.ts
│   └── testHelpers.ts            # Senior touch-target & RTL DOM assertion helpers
├── tier1_features/
│   ├── camera_security.test.ts   # F01, F02 (10 tests)
│   ├── navigation_shell.test.ts  # F03, F04, F05, F06, F07, F08 (30 tests)
│   ├── prescription_pipeline.test.ts # F09, F10, F11, F12, F13, F14 (30 tests)
│   ├── prescription_presentation.test.ts # F15, F16, F17, F18, F19, F20 (30 tests)
│   ├── medication_usage.test.ts  # F21, F22, F23, F24 (20 tests)
│   └── platform_release.test.ts  # F25, F26, F27, F28 (20 tests)
├── tier2_boundaries/
│   ├── camera_security_boundary.test.ts     # Boundary cases for F01–F02 (10 tests)
│   ├── navigation_shell_boundary.test.ts    # Boundary cases for F03–F08 (30 tests)
│   ├── prescription_pipeline_boundary.test.ts # Boundary cases for F09–F14 (30 tests)
│   ├── prescription_presentation_boundary.test.ts # Boundary cases for F15–F20 (30 tests)
│   ├── medication_usage_boundary.test.ts    # Boundary cases for F21–F24 (20 tests)
│   └── platform_release_boundary.test.ts    # Boundary cases for F25–F28 (20 tests)
├── tier3_combinations/
│   └── cross_feature_combinations.test.ts   # 7 pairwise cross-feature interaction flows
└── tier4_scenarios/
    └── real_world_scenarios.test.ts         # 5 comprehensive senior patient user journeys
```

---

## 4. Real-World Application Scenarios (Tier 4)

The Tier 4 suite exercises comprehensive end-to-end user journeys based on authentic senior patient personas:

### Scenario 1: Elderly Diabetic Patient (Hajj Ahmed, 72)
- **Persona & Context**: Hajj Ahmed visits an outpatient diabetes clinic and receives a multi-medication handwritten prescription with mixed legibility.
- **Journey**:
  1. Opens the app on Android in RTL mode.
  2. Taps the "الروشتة" tab in the bottom navigation.
  3. Captures the handwritten prescription with the native camera (`CameraSource.Camera`).
  4. The 1600px/0.8 compression pipeline submits the payload to the Worker prescription mode.
  5. The UI renders 3 items: Metformin (legible, high confidence), Gliclazide (legible, medium confidence), and a third scribbled item (illegible, low confidence).
  6. The low-confidence item renders in a soft amber card with "غير واضح، اسأل الصيدلي" and zero hallucinations.
  7. Hajj Ahmed activates the read-aloud button to listen to the whole prescription in Arabic.
  8. Taps Metformin to open the "تفاصيل الدواء" modal, verified through the cached details mode.

### Scenario 2: Grandparent Checking Expired Heart Medication (Hajja Fatima, 68)
- **Persona & Context**: Hajja Fatima in a dimly lit living room attempts to scan an old cardboard box of heart medication (Bisoprolol).
- **Journey**:
  1. Taps the center raised teal camera button (76px) from the home screen.
  2. The initial photo is too dark and blurry ($L < 5$).
  3. Client-side validation and Worker return `is_clear: false` with friendly Arabic tips:
     - إضاءة كافية (adequate lighting)
     - ظهور العلبة كاملة (whole box visible)
     - تثبيت الهاتف (holding steady)
  4. Taps the large "إعادة المحاولة" touch button ($\ge 64\text{px}$).
  5. Retakes the photo with clear lighting.
  6. Box analysis succeeds: renders 4 cards including "كيف ومتى", displaying "الاستخدام الشائع" and the hardcoded Arabic disclaimer line.

### Scenario 3: Senior Reviewing Medication List with Extra-Large Font & High Contrast
- **Persona & Context**: A visually impaired senior patient prefers maximum font sizes and high contrast.
- **Journey**:
  1. Sets font size preference to 'extra-large' ($24\text{px}+$ body text).
  2. Navigates between "أدويتي", "الروشتة", and "الرئيسية".
  3. Verifies that all touch targets maintain $\ge 64\text{px}$ height without text clipping or vertical overflow.
  4. Verifies that active tab indicators maintain rounded pill contrast.
  5. Reviews the medical disclaimer banner which remains persistently visible without obstructing navigation.

### Scenario 4: Poor Cellular Connectivity (Slow 3G Network Timeout)
- **Persona & Context**: A rural patient at a village dispensary captures a prescription over an unstable 3G cellular network.
- **Journey**:
  1. Sends a 1600px prescription image.
  2. Cloudflare Worker enforces its 25-second abort limit and aborts upstream Gemini hanging requests with HTTP 504 `UPSTREAM_TIMEOUT`.
  3. The client 30-second `AbortController` handles edge delays and maps the event to `network_timeout`.
  4. The UI displays the friendly Arabic network timeout card with "انتهت مهلة الاتصال" rather than falsely blaming the photo clarity.
  5. The interactive retry button allows immediate re-attempting without re-taking the photo.

### Scenario 5: Emergency Room Multi-Medication Handwritten Triage Sheet
- **Persona & Context**: An urgent care situation involving a handwritten emergency prescription with 10 medications.
- **Journey**:
  1. Submits an intensive 10-item handwritten doctor sheet.
  2. Validates that the schema strictly clamps to the 10-item maximum limit.
  3. Renders the advisory banner "راجع أسماء الأدوية قبل الاعتماد" above the list.
  4. Confirms that each readable item displays "ما كتبه الطبيب" with verbatim instructions.
  5. Exercises "أضف لأدويتي" to add safe items to the local medication storage.

---

## 5. Coverage Thresholds and Execution Commands

### Execution Commands
- **Run Full E2E Test Suite**:
  ```powershell
  npx.cmd vitest run tests/e2e/
  ```
- **Run Tier 1 Only**:
  ```powershell
  npx.cmd vitest run tests/e2e/tier1_features/
  ```
- **Run Tier 2 Only**:
  ```powershell
  npx.cmd vitest run tests/e2e/tier2_boundaries/
  ```
- **Run Tier 3 & Tier 4 Only**:
  ```powershell
  npx.cmd vitest run tests/e2e/tier3_combinations/ tests/e2e/tier4_scenarios/
  ```

### Coverage Thresholds
- **Tier 1 Feature Coverage**: 28 features $\times$ 5 tests minimum $= 140$ tests.
- **Tier 2 Boundary & Corner Cases**: 28 features $\times$ 5 tests minimum $= 140$ tests.
- **Tier 3 Cross-Feature Combinations**: 7 pairwise interaction tests.
- **Tier 4 Real-World Senior Scenarios**: 5 end-to-end patient journey tests.
- **Total E2E Test Count**: $\ge 292$ tests.
- **Required Pass Rate**: **100%** (zero failures, zero flaky skips).
- **Execution Speed**: $\le 25\text{s}$ total runtime on local workstation.
