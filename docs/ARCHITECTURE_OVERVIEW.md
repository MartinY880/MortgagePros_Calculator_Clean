# MortgagePros Calculator – Architecture & Context Summary (v12.6.0)

Date: 2025-10-01

This document summarizes the structure, purpose, runtime wiring, and dependencies of the MortgagePros Calculator project as currently checked into this workspace.

## Purpose
A professional, portable Electron desktop app for mortgage calculations. Computes monthly payments, amortization schedules, and charts; supports Refinance, Purchase, HELOC, Comparison, and Blended Mortgage; exports PDF/CSV.

## High-level layout
- Top-level portable app bundle (Windows executable + Electron runtime files)
- `resources/app/` contains source for development and packaging:
  - `main.js` (Electron main process: BrowserWindow, menu, IPC for saving and dialogs)
  - `preload.js` (minimal)
  - `src/` (renderer UI and logic)
    - `index.html` (tabs UI, loads Bootstrap, Chart.js (CDN), jsPDF, PapaParse, `version.js`, `mortgage-calculator.js`)
    - `styles.css` (theming and components)
    - `mortgage-calculator.js` (primary renderer logic: calculations, charts, exports, history, notifications)
    - `version.js` (single source of truth for version + metadata)
    - `modules/` (optional modular helpers)
      - `calculators/BlendedMortgageCalculator.js`
      - `exports/ReportExporter.js`
      - `formatters/NumberFormatter.js`
      - `ui/UIManager.js`
      - `utils/UtilityHelpers.js`
      - `validators/InputValidator.js`
  - `assets/` (icon/logo)
  - `package.json` (scripts, builder config, deps)
  - `VERSION_MANAGEMENT.md`, `sync-version.js`

## Runtime & wiring
- Electron main creates one BrowserWindow; loads `src/index.html`.
- IPC handlers in main handle save/open dialogs and file writes (`save-file`, `save-pdf`, `save-binary-file`, `open-file`, confirm dialog).
- nodeIntegration=true, contextIsolation=false; renderer can `require("electron")` directly. `preload.js` is minimal (no `contextBridge`).
- Renderer scripts (in `index.html`) load Bootstrap (local), Chart.js (CDN), jsPDF (local UMD), PapaParse (local), then app scripts.
- `mortgage-calculator.js` binds UI events, performs calculations, renders schedules/charts, manages history and theme, and uses IPC to export CSV/PDF.
- Blended calculations prefer `window.calculators.blended` if available; otherwise a built-in fallback function runs.

## Feature areas
- Tabs: Refinance (default), Compare Loans (A/B/C), Blended Mortgage, Purchase, HELOC.
- Results: Payment summary, schedule table, and visualization via Chart.js.
- Exports: CSV (manual CSV string -> `save-file`), PDF (jsPDF -> base64 -> `save-pdf` + `save-binary-file`, then `open-file`).
- History/localStorage for saving/restoring inputs (not auto-restoring previous results on startup, to avoid confusion).
- Theme toggle (light/dark) stored in localStorage.

## Modules (optional helpers)
- `NumberFormatter` – currency/number/percentage formatting utilities; exposed as `window.NumberFormatter` when loaded.
- `InputValidator` – validation for loans/heloc/comparison; exposed as `window.InputValidator`.
- `UtilityHelpers` – `StorageUtils`, `EventUtils`, `FormUtils`; exposed on `window` when loaded.
- `UIManager` – custom notifications/modals/theme; sets `window.uiManager` when loaded.
- `ReportExporter` – jsPDF-based report builder; designed to use `window.api` for saving (not currently wired via `preload`). The live export paths use `ipcRenderer.invoke(...)` inside `mortgage-calculator.js`.

Note: `index.html` doesn’t include the modules by default. The app largely works via inline logic in `mortgage-calculator.js`. Blended uses the module only if available.

## Dependencies
From `resources/app/package.json`:
- Dev/runtime: electron ^38.1.2, electron-builder ^26.0.12, cross-env, icon tooling, typescript
- UI/libs: bootstrap ^5.3.8 (local), chart.js ^4.5.0 (CDN loads 4.4.0 UMD), jspdf ^3.0.2 (local UMD), papaparse ^5.5.3 (local)

Offline note: README claims offline capability; Chart.js is current loaded from CDN, so charts require internet unless switched to local `node_modules`.

## Packaging
- npm scripts: `start`, `dev`, `dist`, `build-installer`, `sync-version`.
- electron-builder configured for Windows NSIS, with file filters to keep bundle lean.
- Version management: `src/version.js` -> `npm run sync-version` updates `package.json.version`.

## Security considerations
- nodeIntegration on and contextIsolation off (simplifies code, reduced isolation). For a hardened build, use contextBridge in `preload` and remove direct `require` from renderer.

## Extension points & next steps (non-functional notes)
- If desired, load `src/modules/*` scripts in `index.html` to rely on helpers consistently.
- Consider switching Chart.js to local file for offline reliability.
- Align ReportExporter save flow with current IPC pattern or expose a small `window.api` via `preload`.
- Consider enabling contextIsolation + contextBridge for a stricter security model.

---
Generated from repository state on 2025-10-01 for quick reference.
