# Scope: دليلي الدوائي (Dalili Medication Guide) — Production Upgrade

See root `PROJECT.md` for full global specification.

## Milestones Summary
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Cloudflare Worker Backend Upgrade | Prescription route/mode, `GEMINI_MODEL_PRESCRIPTION`, 25s abort, details mode, Box Rule 6 update | none | DONE |
| M2 | Client Data Layer, Types, Compression & Services | Types update (`usage_source`, prescription schema), 1600px/0.8 JPEG compression, 30s timeout, details cache | M1 | DONE |
| M3 | Native App Shell, RTL Bottom Navigation & Home Screen | Fixed bottom nav bar, 72-80px teal camera button, native mobile styling, uncluttered Home screen | M1, M2 | DONE |
| M4 | Prescription UI Flow, Unclear Guidance & Usage Card | Prescription tab & cards, low-confidence amber cards, details modal, 3 retake tips, Card 3 usage & disclaimer | M2, M3 | DONE |
| M5 | Android Versioning, Release Signing, Tests & Live Deploy | `build.gradle` version bump, `sign-release.bat`, Vitest suite pass 100%, `wrangler deploy`, live test report | M1, M2, M3, M4 | DONE |
| M-Final | Dual Track E2E Test Suite Pass & Adversarial Hardening | Pass 100% of E2E tests (Tiers 1-4) published in `TEST_READY.md`, Tier 5 adversarial coverage hardening | M1–M5, Test Track | DONE |

## Dual Track Strategy
- **Track 1: Implementation Track**: Sequential milestones M1 → M2 → M3 → M4 → M5 → M-Final.
- **Track 2: E2E Testing Track**: Dispatched in parallel to build comprehensive opaque-box test runner and test cases (Tiers 1–4) covering all 28 features, publishing `TEST_READY.md`.
