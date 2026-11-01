# Milestone 1 Exploration & Specification Report: Project Foundation, Tooling, Vite + React + TypeScript Configuration

**Author**: `teamwork_preview_explorer_m1_1`  
**Date**: 2026-10-27T21:12:00Z  
**Target Milestone**: Milestone 1 (M1) — Project Foundation, Tooling, Vite + React + TypeScript Configuration  
**Target Audience**: Implementer Worker (`teamwork_preview_worker`) & Orchestrator (`teamwork_preview_orchestrator`)  
**Authoritative References**:
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md`
- Direct dispatch from Orchestrator (`2dd88d9c-8321-4770-aaab-eaebaab220df`) on pinned dependencies
- Coordinated with peer explorers: `teamwork_preview_explorer_m1_2` (PWA shell) and `teamwork_preview_explorer_m1_3` (Design tokens & test harness)

---

## 1. Observation

Direct, verifiable observations of the project codebase, execution environment, and authoritative requirements:

### 1.1 Project Environment & Toolchain State
1. **Workspace Directory**:
   - Location: `c:\Users\PC\Documents\antigravity\fervent-mendel`
   - Files present: `.git/`, `.agents/teamwork/`, `ORIGINAL_REQUEST.md`, `PROJECT.md`.
   - Workspace is in a greenfield state. No `package.json`, `vite.config.ts`, `tsconfig.json`, or `node_modules` exist yet.
2. **Node.js & npm Runtimes**:
   - `node -v` outputs: `v24.21.0` (Node.js 24 LTS series available).
   - `npm.cmd -v` outputs: `11.19.0`.
   - Direct execution of bare `npm` or `npx` in Windows PowerShell results in a script execution error:
     ```text
     npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
     + CategoryInfo : SecurityError: (:) [], PSSecurityException
     + FullyQualifiedErrorId : UnauthorizedAccess
     ```
   - Running `npm.cmd` and `npx.cmd` executes cleanly with exit code 0.
3. **Parent Orchestrator Specification**:
   - Direct dispatch received from Orchestrator (`2dd88d9c-8321-4770-aaab-eaebaab220df`) mandates the exact standard pinned versions:
     - React 18.3.1 (`"react": "^18.3.1"`, `"react-dom": "^18.3.1"`)
     - Lucide React (`"lucide-react": "^1.16.0"` or `"^0.468.0"`)
     - Vite 6.1.0 (`"vite": "^6.1.0"`)
     - Vitest 3.0.5 (`"vitest": "^3.0.5"`)
     - TypeScript 5.7.3 (`"typescript": "^5.7.3"`)
     - Tailwind CSS 3.4.17 (`"tailwindcss": "^3.4.17"`)
     - PostCSS 8.5.2 (`"postcss": "^8.5.2"`)
     - Autoprefixer 10.4.20 (`"autoprefixer": "^10.4.20"`)

### 1.2 Verbatim Requirements Observed
1. **From `ORIGINAL_REQUEST.md` (lines 51-60)**:
   - "Programmatic unit and integration test suite (Vitest + React Testing Library) runs and passes 100% of tests."
   - "Production build succeeds with `npm run build` with zero TypeScript, syntax, or bundling errors."
2. **From `PROJECT.md` (lines 6-16, 72-74, 202-206)**:
   - **Framework & Language**: React 18 / TypeScript 5.7+
   - **Build Tool & Bundler**: Vite 6+
   - **Styling**: Tailwind CSS with RTL plugin / standard RTL layout
   - **Icons**: Lucide React (Camera, Upload, Volume2, Play, Pause, Square, RotateCcw, AlertTriangle, Pill, Clock, FileText, CheckCircle2)
   - **Testing**: Vitest + React Testing Library + JSDOM
   - **Path Aliases**: `@ -> ./src` for clean, modular imports across components, services, and tests.
   - **Windows PowerShell Execution**: All commands executed via `npm.cmd` and `npx.cmd`.

### 1.3 Milestone Scope Division Across Explorers
- **Explorer 1 (This Agent)**: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, alias resolution (`@` -> `./src`), and zero-error Windows PowerShell build verification.
- **Explorer 2 (`m1_2`)**: `public/manifest.webmanifest`, `public/sw.js`, and `src/main.tsx` service worker registration.
- **Explorer 3 (`m1_3`)**: `index.html`, `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `vitest.config.ts`, `src/test/setup.ts`.

---

## 2. Logic Chain

1. **Windows PowerShell Command Invocation**:
   - *Observation*: Windows execution policy blocks `.ps1` wrapper scripts for `npm` and `npx`, triggering `PSSecurityException`.
   - *Deduction*: All CLI commands executed by the Worker or in scripts must invoke `npm.cmd` and `npx.cmd`. Within `package.json` scripts (`"build": "tsc --noEmit && vite build"`), the command is processed by Node's default command processor (`cmd.exe` on Windows), which resolves `tsc.cmd` and `vite.cmd` from `node_modules/.bin` automatically.
2. **Dependency Harmonization for React 18 & Vite 6**:
   - *Observation*: React 18.3.1 is mandated. Testing Library and Vitest must have matching peer dependencies.
   - *Deduction*:
     - `@vitejs/plugin-react` `^4.3.4` provides official Fast Refresh and JSX transform for React 18.
     - `@types/react` `^18.3.18` and `@types/react-dom` `^18.3.5` provide strict React 18 typings without React 19 typing breaking changes.
     - `@types/node` `^22.10.2` ensures `node:url` and Node standard library types are recognized.
     - `@testing-library/react` `^16.1.0` (or `^14.3.1`) and `@testing-library/jest-dom` `^6.6.3` with `jsdom` `^26.0.0` provide a full testing harness matching Explorer 3's custom matchers (`toHaveMinTouchTarget`, `toHaveRtlDirection`).
     - `lucide-react` `^1.16.0` (or `^0.468.0`) provides all required icons with full tree-shaking support.
3. **Alias Resolution Architecture (`@` -> `./src`)**:
   - *Observation*: Source files, components, services, and tests use path aliases like `@/components/ResultCards` and `@/services/historyStorage`.
   - *Deduction*: Alias resolution must be dual-configured:
     1. **Bundler Runtime Resolution (`vite.config.ts`)**: Configured via `resolve.alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }`. Using `fileURLToPath` from `'node:url'` guarantees correct resolution across Windows backslashes (`\`) and POSIX paths (`/`), while avoiding `__dirname` reference errors in native ESM.
     2. **TypeScript Compiler Resolution (`tsconfig.json`)**: Configured via `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }`. This guarantees that `tsc` validates types across alias imports without `Cannot find module '@/...'` errors.
4. **TypeScript Configuration Strategy for Zero-Error Builds**:
   - *Observation*: `npm.cmd run build` must succeed with zero TypeScript or bundling errors.
   - *Deduction*:
     - In Vite's standard setup, Vite delegates typechecking to `tsc`.
     - Using `"build": "tsc --noEmit && vite build"` in `package.json` guarantees that `tsc` verifies 100% of types across `src/`, `tests/`, and configuration files before `vite build` bundles the production output.
     - If `tsc -b` (build mode) is used with fragmented project references, `tests/` files placed outside `src/` can trigger `File is not listed within the file list of project... tsconfig.app.json`.
     - Therefore, a clean, unified `tsconfig.json` that includes `src`, `tests`, `vite.config.ts`, and `vitest.config.ts` with `"noEmit": true` and `"moduleResolution": "bundler"` provides the most robust, error-free build execution on Windows.
     - In addition, providing `tsconfig.node.json` satisfies editors and IDE tooling that inspect Node-specific configurations (`vite.config.ts`, `tailwind.config.js`, `postcss.config.js`).
5. **Starter Stubs Requirement for M1 Build Success**:
   - *Observation*: `vite build` requires an HTML entry point (`index.html`) with `<script type="module" src="/src/main.tsx"></script>`. If `src/main.tsx` or `src/App.tsx` does not exist, `vite build` will fail immediately with `Could not resolve entry module /src/main.tsx`.
   - *Deduction*: The Worker must create minimal starter stubs for `src/main.tsx`, `src/App.tsx`, and `src/vite-env.d.ts` during M1 so that the initial `npm.cmd run build` command passes with 0 errors immediately.

---

## 3. Caveats & Assumptions

1. **PowerShell Script Execution Policy**:
   - *Assumption*: The user's system has PowerShell execution policy set to `Restricted` or `RemoteSigned` for `.ps1` scripts.
   - *Mitigation*: The Worker must exclusively use `npm.cmd` and `npx.cmd`. Under no circumstances should bare `npm` or `npx` be called directly in PowerShell.
2. **Windows Backslash Path Separators**:
   - *Assumption*: Hardcoding string paths like `path.resolve(__dirname, 'src')` in `vite.config.ts` can occasionally produce mixed slashes on Windows if not normalized.
   - *Mitigation*: Using `fileURLToPath(new URL('./src', import.meta.url))` from `'node:url'` produces a native, canonical Windows path string (`C:\Users\PC\...`) that Vite handles flawlessly.
3. **Sandbox Network Restrictions**:
   - *Assumption*: Network requests to external package registries may be blocked or restricted within the sandboxed environment.
   - *Mitigation*: Pinned versions match packages already populated or available in the local environment and cache.

---

## 4. Conclusion & Concrete File Specifications for the Worker

The implementer Worker (`teamwork_preview_worker`) must create and configure the following concrete files:

### 4.1 `package.json`
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\package.json`

```json
{
  "name": "dalili-medication-guide",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^1.16.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "jsdom": "^26.0.0",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

### 4.2 `vite.config.ts`
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
});
```

### 4.3 `tsconfig.json`
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Strictness & Code Quality */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path Alias Resolution */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },

    /* Types */
    "types": ["vitest/globals", "@testing-library/jest-dom", "node"]
  },
  "include": [
    "src",
    "tests",
    "vite.config.ts",
    "vitest.config.ts"
  ]
}
```

### 4.4 `tsconfig.node.json`
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\tsconfig.node.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": [
    "vite.config.ts",
    "vitest.config.ts",
    "tailwind.config.js",
    "postcss.config.js"
  ]
}
```

### 4.5 `postcss.config.js`
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 4.6 `src/vite-env.d.ts`
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\src\vite-env.d.ts`

```typescript
/// <reference types="vite/client" />
```

### 4.7 `.gitignore`
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\.gitignore`

```gitignore
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

### 4.8 Starter Stub: `src/main.tsx`
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\src\main.tsx`
*(Ensures `vite build` has a valid entry point and coordinates with Explorer 2's service worker registration)*

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for offline shell caching (Explorer 2 scope)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
```

### 4.9 Starter Stub: `src/App.tsx`
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\src\App.tsx`
*(Ensures build passes and validates `@` alias resolution and Tailwind styling)*

```tsx
import React from 'react';
import { Pill } from 'lucide-react';

export default function App() {
  return (
    <main className="min-h-screen bg-warm text-slate flex flex-col items-center justify-center p-6 text-center">
      <header className="mb-6">
        <div className="w-20 h-20 mx-auto bg-teal/10 rounded-full flex items-center justify-center mb-4">
          <Pill className="w-10 h-10 text-teal" />
        </div>
        <h1 className="text-senior-3xl font-bold text-teal mb-2">دليلي الدوائي</h1>
        <p className="text-senior-base text-slate">مساعدك الطبي الذكي لقراءة وشرح علب الأدوية</p>
      </header>
    </main>
  );
}
```

---

## 5. Verification Method

To independently verify the implementation, the Worker and Reviewers must run the following sequence of commands in Windows PowerShell:

### Step 1: Install Dependencies
```powershell
npm.cmd install
```
*Expected*: Exit code 0, all dependencies installed into `node_modules`.

### Step 2: Validate TypeScript Compilation
```powershell
npm.cmd run build
```
*Expected*:
1. `tsc --noEmit` validates all types across `src/`, `tests/`, and config files with zero errors.
2. `vite build` compiles client bundle to `dist/`.
3. Exit code 0.

### Step 3: Verify Output Artifacts
Inspect the generated build directory:
```powershell
Get-ChildItem -Path dist
```
*Expected*: `dist/index.html` exists and `dist/assets/` contains compiled `.js` and `.css` files.

### Step 4: Verify Vitest Test Runner Execution
```powershell
npm.cmd run test
```
*Expected*: Vitest boots, runs tests, and exits with code 0 (or passes with no tests if test files are still in authoring).

### Invalidation Conditions
- Any occurrence of `PSSecurityException` (indicates bare `npm` was run instead of `npm.cmd`).
- `Cannot find module '@/...'` error in `tsc` or `vite build` (indicates alias mismatch).
- Build failure code != 0.
