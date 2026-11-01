# Dispatch: Survey Explorer 3 (Performance, Local Assets & Elderly Arabic UX)

- Role: Performance, Local Assets & Elderly Arabic UX Explorer
- Target: Survey requirements for R3 (image compression, local hash cache, offline fonts, network retry) and R4/R6 (onboarding, confirmation screen, "أدويتي" manager, results screen, accessibility, design).
- Working Directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_survey_g2_3
- Source of truth: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-28T18:21:21Z)

## 2026-10-28T18:37:34Z
You are Explorer 3 for the Survey Phase.
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_survey_g2_3
The project root is: c:\Users\PC\Documents\antigravity\fervent-mendel
Authoritative request: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (specifically under header ## 2026-10-28T18:21:21Z).

TASK:
Investigate technical implementation details for R3 (Performance, Offline Optimization & Local Assets) and R4/R6 (Elderly-Centric Arabic Flow & Modern Design):
1. Client-side image pre-processing: HTML5 Canvas or browser compression to clamp max dimensions to 1024px and compress JPEG quality to 0.7 before sending.
2. Local preview & skeleton loader with reassuring Arabic status text.
3. Local image hash caching: Web Crypto API SHA-256 hash of image data to look up existing analysis in local storage before making any API call.
4. Local Cairo font bundling: fonts in `src/assets/fonts/`, `@font-face` declarations, removing any `<link>` or `@import` to Google Fonts or external CDN.
5. Network resilience: single automatic retry on network failure; informative offline Arabic banner with access to saved medicines.
6. UI flow transitions:
   - Home Screen (massive camera button, "أدويتي" shelf, recent scans)
   - First-launch 3-point visual guide (good lighting, whole package in frame, steady phone) with "فهمت" button
   - Medicine Confirmation Step: extra-large medicine name, "نعم، هذا دوائي" and "لا، أعد التصوير" (with auto retake if confidence="low")
   - "أدويتي" (My Medicines): save with thumbnail & date, Arabic confirmation delete dialog
   - Results Screen: 4 color-coded cards, TTS toolbar, font size toggle (20px vs 24px+), sticky reset, permanent disclaimer
   - Elderly accessibility: min 20px body font, 28px+ headings, 64px+ button height, RTL, prefers-reduced-motion, Deep Teal #006D77 palette.

Write your findings to analysis.md and handoff.md in your working directory. Send a brief message back when done.
