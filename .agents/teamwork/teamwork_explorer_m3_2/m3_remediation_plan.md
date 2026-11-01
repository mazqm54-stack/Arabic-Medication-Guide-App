# Remediation Plan: Milestone 3 (Requirement R2) Build Integrity Restoration

**Plan Target**: Worker M3 (`teamwork_worker_m3_1` / remediation worker)  
**Author**: Explorer M3-2 (`teamwork_explorer_m3_2`)  
**Audit Reference**: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_auditor_m3_1\m3_audit_report.md`  
**Date**: 2026-10-29  
**Status**: Ready for Implementation  

---

## 1. Executive Summary

During the Milestone 3 forensic audit, the Forensic Auditor issued an **INTEGRITY VIOLATION** verdict because `npm.cmd run build` exited with code 1. Under project audit rules, any build failure is an unconditional binary veto.

The build script in `package.json` executes:
```bash
"build": "tsc --noEmit && vite build"
```
While Vite production bundling (`vite build`) succeeds completely (1598 modules transformed, `dist/` bundle created in ~7.9s), `tsc --noEmit` fails due to strict compiler options in `tsconfig.json`:
- `"noUnusedLocals": true`
- `"noUnusedParameters": true`

Deep investigation revealed that of the 5 `TS6133` errors originally cited in the audit report, **4 errors have already been resolved** in `tests/imageProcessor.challenge.test.ts` by recent updates. **Exactly 1 active compiler error remains** in `tests/errorStates.challenge.test.tsx` (unused `React` import).

This plan provides the exact, non-destructive remediation steps to eliminate the compiler error, restore build integrity with exit code 0, and maintain 100% test suite pass rate (398/398 tests passing across 18 test files).

---

## 2. Forensic Analysis of the 5 TS6133 Compiler Errors

### Error 1 (ACTIVE BLOCKER): `tests/errorStates.challenge.test.tsx:3:1`
- **Diagnostic**: `error TS6133: 'React' is declared but its value is never read.`
- **Current State**: Line 3 contains:
  ```typescript
  import React from 'react';
  ```
- **Root Cause**: `tsconfig.json` specifies `"jsx": "react-jsx"`, which uses the modern automatic JSX transform (React 17/18/19). In this mode, JSX expressions do not compile to `React.createElement(...)`, and `React` is never referenced anywhere in `tests/errorStates.challenge.test.tsx`.
- **Status**: **ACTIVE**. This is the sole remaining blocker preventing `tsc --noEmit` from exiting with code 0.
- **Remediation**: Delete line 3 (`import React from 'react';`) from `tests/errorStates.challenge.test.tsx`.

---

### Error 2 (ALREADY RESOLVED): `tests/imageProcessor.challenge.test.ts:9:3`
- **Diagnostic**: `error TS6133: 'MIN_VALID_BASE64_LENGTH' is declared but its value is never read.`
- **Current State**: Line 9 imports `MIN_VALID_BASE64_LENGTH` from `../src/utils/imageProcessor`. Line 636 contains:
  ```typescript
  expect(MIN_VALID_BASE64_LENGTH).toBe(500);
  ```
- **Root Cause & History**: During initial audit run at 21:59:44, `MIN_VALID_BASE64_LENGTH` was imported on line 9 without being referenced. In subsequent test refinement at 22:11:36 (Challenge 7), line 636 was added to verify the minimum valid base64 payload length constant from `src/utils/imageProcessor.ts`.
- **Status**: **RESOLVED**. Because `MIN_VALID_BASE64_LENGTH` is read at line 636, TypeScript no longer flags it.
- **Worker Action**: Retain line 9 and line 636. Do NOT remove line 636 as it actively tests Requirement R2.

---

### Error 3 (ALREADY RESOLVED): `tests/imageProcessor.challenge.test.ts:301:26`
- **Diagnostic**: `error TS6133: 'x' is declared but its value is never read.`
- **Current State**: Line 301 contains:
  ```typescript
  fillRect: vi.fn((_x, _y, w, h) => {
    callOrder.push(`fillRect:${w}x${h}`);
  }),
  ```
- **Root Cause & History**: The mock implementation originally accepted `(x, y, w, h)` but only used `w` and `h`. Parameter `x` was prefixed with `_x`.
- **Status**: **RESOLVED**. TypeScript's `"noUnusedParameters": true` ignores parameters with a leading underscore `_`.
- **Worker Action**: Retain `_x`. No change needed.

---

### Error 4 (ALREADY RESOLVED): `tests/imageProcessor.challenge.test.ts:301:29`
- **Diagnostic**: `error TS6133: 'y' is declared but its value is never read.`
- **Current State**: Line 301 contains:
  ```typescript
  fillRect: vi.fn((_x, _y, w, h) => {
    callOrder.push(`fillRect:${w}x${h}`);
  }),
  ```
- **Root Cause & History**: Parameter `y` was prefixed with `_y`.
- **Status**: **RESOLVED**. Leading underscore satisfies compiler check.
- **Worker Action**: Retain `_y`. No change needed.

---

### Error 5 (ALREADY RESOLVED): `tests/imageProcessor.challenge.test.ts:573:60`
- **Diagnostic**: `error TS6133: 'blob' is declared but its value is never read.`
- **Current State**: Line 573 contains:
  ```typescript
  vi.spyOn(URL, 'createObjectURL').mockImplementation((_blob: any) => {
    const url = `blob:test-concurrent-${Math.random()}`;
    createdUrls.push(url);
    return url;
  });
  ```
- **Root Cause & History**: The mock originally accepted `(blob: any)`. Parameter `blob` was prefixed with `_blob`.
- **Status**: **RESOLVED**. Leading underscore satisfies compiler check.
- **Worker Action**: Retain `_blob`. No change needed.

---

## 3. Worker M3 Step-by-Step Execution Plan

### Step 1: Remove Unused React Import in `tests/errorStates.challenge.test.tsx`
- **Target File**: `c:\Users\PC\Documents\antigravity\fervent-mendel\tests\errorStates.challenge.test.tsx`
- **Lines to Edit**: Lines 1-5
- **Before**:
  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import React from 'react';
  import App from '../src/App';
  import { UnclearPhotoCard } from '../src/components/UnclearPhotoCard';
  ```
- **After**:
  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import App from '../src/App';
  import { UnclearPhotoCard } from '../src/components/UnclearPhotoCard';
  ```

### Step 2: Verification of `tests/imageProcessor.challenge.test.ts`
- Confirm lines 9, 301, 573, and 636 remain unmodified:
  - Line 9: `MIN_VALID_BASE64_LENGTH`
  - Line 301: `fillRect: vi.fn((_x, _y, w, h) => {`
  - Line 573: `vi.spyOn(URL, 'createObjectURL').mockImplementation((_blob: any) => {`
  - Line 636: `expect(MIN_VALID_BASE64_LENGTH).toBe(500);`

### Step 3: Run TypeScript Type Check
Execute:
```powershell
npx.cmd tsc --noEmit
```
**Expected Outcome**: Exits with code 0. Zero errors printed.

### Step 4: Run Full Build
Execute:
```powershell
npm.cmd run build
```
**Expected Outcome**: Exits with code 0. Both `tsc --noEmit` and `vite build` complete successfully, generating artifacts in `dist/`.

### Step 5: Run Full Test Suite
Execute:
```powershell
npm.cmd test
```
**Expected Outcome**: Exits with code 0. All 18 test files pass (398 tests passed, 0 failed).

### Step 6: Notify Auditor for Re-Audit
Once Steps 1-5 succeed, submit handoff and request re-audit from `teamwork_auditor_m3_1`.

---

## 4. Integrity and Compliance Constraints
- **Zero Configuration Weakening**: Do NOT modify `tsconfig.json` (do NOT disable `noUnusedLocals` or `noUnusedParameters`, and do NOT remove `"tests"` from `"include"`).
- **Zero Test Circumvention**: Do NOT remove or weaken any test assertions or test cases.
- **Zero Production Risk**: No changes are required in `src/`. All production code remains genuine, fully functional, and verified.
