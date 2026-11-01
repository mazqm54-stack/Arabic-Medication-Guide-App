# Task Assignment - Spec Miner 2

You are teamwork_preview_spec_miner_survey_2.
Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_2
Parent: teamwork_preview_orchestrator (conv ID: 2dd88d9c-8321-4770-aaab-eaebaab220df)
Target: Comprehensive Specification & Requirements Mining for "دليلي الدوائي" (My Medication Guide).
Requirements source: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
## 2026-10-27T20:21:45Z
You are teamwork_preview_spec_miner_survey_2.
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_2
Your parent is: teamwork_preview_orchestrator (conv ID: 2dd88d9c-8321-4770-aaab-eaebaab220df)

Read the authoritative user request at:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md

Your mission:
1. Exhaustively extract and categorize all functional, accessibility, UI/UX, AI/prompt, and non-functional requirements from ORIGINAL_REQUEST.md.
2. Specify exact details for:
   - R1: Elderly-Centric Arabic UI, typography (Cairo/Tajawal), palette (#006D77, #F8F9FA, #1D3557, amber), minimum touch targets (64px), minimum font sizes (20px body, 28px+ heading), persistent font size toggle ("خط كبير" 20px vs "خط كبير جداً" 24px+).
   - R2: Primary home action ("📷 صوّر علبة الدواء الآن" with capture="environment") + gallery upload fallback, Arabic reassuring spinner ("جاري قراءة علبة الدواء... يرجى الانتظار قليلاً"), API key management in localStorage, strict Gemini 1.5 Flash Vision Arabic pharmacist system prompt and JSON schema ({is_clear, medicine_name_ar, medicine_name_en, active_ingredient, uses, how_and_when, warnings, audio_summary}), handling is_clear: false with kind Arabic error state.
   - R3: 4 distinct color-coded cards with icons, Web Speech API toolbar ("🔊 استمع للمعلومات") with Play, Pause, Stop in ar-SA/ar-EG voice, sticky reset button ("🔄 تصوير دواء آخر"), persistent disclaimer banner ("تنبيه: هذه المعلومات إرشادية لتسهيل القراءة ولا تغني عن تعليمات طبيبك أو الصيدلي.").
   - R4: PWA manifest, service worker shell caching, local scan history (last 5 items FIFO in localStorage, duplicate prevention, quick re-view).
   - Acceptance criteria: 100% test pass rate with Vitest + React Testing Library, zero build errors with npm run build.
3. Construct a complete Feature Inventory table with feature IDs, descriptions, inputs, outputs, error conditions, and edge cases.
4. Write your comprehensive specification report and handoff to:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_2\handoff.md
Update progress.md as you work.
When finished, send a completion message to the parent (conv ID: 2dd88d9c-8321-4770-aaab-eaebaab220df).
