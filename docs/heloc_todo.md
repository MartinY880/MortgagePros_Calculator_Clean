# HELOC Tab — Prioritized To‑Do Roadmap

Updated: 2025-10-05
Scope: ONLY the HELOC tab. Goal: unify calculation quality with mortgage tabs, improve accuracy, validation, transparency, export consistency, and test coverage while avoiding regressions in Purchase / Refinance / Comparison tabs.

---

## Current Implementation Snapshot

- Function `calculateHELOC()` performs inline parsing, validation, payment computations, amortization generation, UI updates, history persistence.
- Separate schedule generator `generateHelocAmortizationSchedule(amount, rate, interestOnlyYears, totalYears)` builds two-phase schedule.
- UI update handled by `updateHelocResultsUI(...)` (hides unrelated mortgage fields and sets summary zeros for PMI / escrow / HOA).
- Validation is ad‑hoc inside `calculateHELOC` instead of using `InputValidator.validateHELOCInputs` (which exists but is unused here).
- Exporter (`ReportExporter.addHELOCContent` and `generateHELOCCSV`) expects richer data structure than `calculateHELOC` currently assembles (e.g., `results.availableEquity`).
- No unified engine (ScheduleBuilder) path yet for HELOC; interest-only + amortization handled separately.

---

## Key Gaps / Issues Identified

1. Duplication: Inline validation duplicates logic already present in `InputValidator.validateHELOCInputs` but with different field naming (draw vs interest-only period, creditLimit vs helocAmount, etc.).
2. Terminology Drift: Code uses `helocAmount` = loan draw; validator expects `creditLimit`; exporter expects both credit limit & equity metrics (availableEquity) that calculation function doesn’t explicitly output.
3. Equity / LTV Calculation: LTV computed as `(outstandingBalance + helocAmount)/propertyValue`; missing clamp, and no display of max allowable LTV threshold logic (e.g., 80–90% typical). No guard if outstandingBalance is NaN.
4. Interest-Only Payment Formula: Uses monthly simple interest on full `helocAmount` for entire draw period—assumes fully drawn from day 1 (acceptable if assumption is “fully utilized immediately”; should be documented or parameterized for partial draw pattern).
5. Repayment Payment Formula: Standard amortization formula applied over (repaymentPeriod - interestOnlyPeriod)\*12 with original principal `helocAmount` (correct if no principal reduction during draw period). If intent is that balance stays constant (pure interest only) this is fine—needs confirmation & docs.
6. Edge Cases Not Explicitly Handled: zero / near-zero interest, extremely short draw periods, repaymentPeriod == interestOnlyPeriod (treated as error now), rounding of final payment (balance residual under 1 cent truncated silently).
7. Amortization Schedule Date Handling: Sets payment date by adding months to current date; schedule not tied to a user-provided start date (contrast with mortgage engine). Lacks timezone normalization and may shift on month-end boundaries if changed.
8. Missing Aggregates: No cumulative interest per phase, no breakout of total draw period cost vs repayment period cost, no effective APR metrics, no payoff month labeling aside from payoff date derivation.
9. Data Model Inconsistency: `helocData.calculationResults` is a positional array; other tabs are moving toward object/engine outputs for clarity.
10. Test Coverage Gap: No unit tests for HELOC schedule correctness, boundary conditions, or exporter alignment.
11. Export Consistency: PDF/CSV rely on fields like `availableEquity`, `combinedLTV` which must be calculated (some are derived but not stored cohesively in a single result object for reuse).
12. Accessibility / UX: No inline validation styling like purchase tab; failures rely on modal/toast `showErrorMessage` only.
13. Missing Negative / Overshoot Guards: Does not block `outstandingBalance < 0` or `outstandingBalance >= propertyValue` (could yield LTV ≥ 100% silently). Does not clamp interest rate extremes or display warnings (except basic >0 check).
14. No Partial Draw Scenario: Users often model phased utilization; currently impossible (assumes max draw immediately). Could offer optional draw utilization percent or monthly draw ramp later.

---

## Priority 1 – Calibration & Validation (Foundational)

1. Unify Validation Path (**Completed 2025-10-05**)
   - [x] Replace inline checks with call to `InputValidator.validateHELOCInputs(...)` after mapping field names (propertyValue→homeValue, helocOutstandingBalance→mortgageBalance, helocLoanAmount→creditLimit or drawAmount decision).
   - [x] Decide semantic difference: creditLimit vs initialDraw (current assumption: fully drawn; helocAmount mapped to both creditLimit & drawAmount).
2. Field Mapping + Data Object (**Completed 2025-10-05**)
   - [x] Introduce `helocInput` shape: `{ homeValue, mortgageBalance, creditLimit, drawAmount, interestRate, drawPeriod, repaymentPeriod }` (initialDraw == full creditLimit assumption).
   - [x] Persist structured object into `helocData.inputs` within `calculateHELOC`.
3. Consistent Result Object (**Completed 2025-10-05**)
   - [x] Added `helocData.result` with `{ interestOnlyPayment, principalInterestPayment, principal, totalInterest, totalInterestDrawPhase, totalInterestRepayPhase, combinedLTV, availableEquity, ltvOrigin, payoffDate, schedule, inputs }` while retaining legacy positional array for backward compatibility.
4. LTV / Equity Calculations (**Completed 2025-10-05**)
   - [x] Available equity computed: `homeValue - mortgageBalance`.
   - [x] Combined LTV `(mortgageBalance + creditLimit)/homeValue * 100` stored as `combinedLTV`.
   - [x] Threshold logic added: warning at ≥90% (`ltvWarning`), blocking error if >100% (calculation aborted).
5. Edge Case Handling
   **Completed 2025-10-05**
   - [x] Zero interest: interest-only payment forced to 0; repayment payment uses linear principal amortization (`principal / repaymentMonths`).
   - [x] Auto-adjust: if repaymentPeriod == interestOnlyPeriod, auto-extend repayment by 12 months (flag `edgeFlags.repaymentMonthsAdjusted`) with user message; other invalid combos still blocked.
   - [x] Balance clamp: residual balance |balance| < $0.005 clamped to 0; sets `edgeFlags.balanceClamped` via callback.
   - [x] Added `edgeFlags` (zeroInterest, repaymentMonthsAdjusted, balanceClamped) and `messages` array to `helocData.result`.
   - [x] Schedule generator now accepts options: `{ zeroInterest, repaymentMonthsOverride, onBalanceClamp }`.
   - [x] Added linear amortization branch & safe override injection without breaking legacy positional array consumers.

---

## Priority 2 – Schedule & Accuracy Enhancements

6. Schedule Generation Refactor
   - [x] Parameterize start date (optional `helocStartDate` input) falling back to first of next month.
   - [x] Include phase totals: `phaseTotals.interestOnly` & `phaseTotals.repayment` (principal, interest, payments).
   - [x] Per-row cumulative fields: `cumulativePrincipal`, `cumulativeInterest`.
   - [x] Metadata attached non-enumerably at `schedule._meta.phaseTotals`.
   - [ ] Add UI surfacing / exporter consumption (deferred to later export tasks).
7. Rounding Strategy
   **Completed 2025-10-05**
   - [x] Raw numeric values retained; formatting deferred to UI/export layers.
   - [x] Implemented folding of sub-cent / < $0.01 final principal into penultimate payment; sets `edgeFlags.roundingAdjusted`.
   - [x] Messages array records action: "Final fractional cent principal folded into prior payment.".
   - [x] Balance now guaranteed zero on adjusted penultimate row when folding occurs.
8. Support Partial Draw (Future Flag)
   - Optional: initialDrawPercent field; if present compute interest-only on drawn portion; allow additional draws not yet modeled (defer unless prioritized later).

---

## Priority 3 – UI / UX Improvements

9. Inline Validation Feedback (**Completed 2025-10-05**)
   - [x] Mirror purchase tab `.is-invalid` + `.invalid-feedback` pattern for HELOC inputs.
   - Status (2025-10-05): IMPLEMENTED initial inline validation.
   - [x] Added helpers: `clearHelocFieldErrors`, `applyHelocValidationErrors`, `attachHelocValidationListenersOnce`.
   - [x] Implemented substring mapping (validator currently emits plain text messages):
         | Message Substring | Field |
         | Home value | helocPropertyValue |
         | Mortgage balance | helocOutstandingBalance |
         | Credit limit / Draw amount / Combined loan-to-value | helocLoanAmount |
         | Interest rate | helocInterestRate |
         | Draw period | helocInterestOnlyPeriod |
         | Repayment period | helocRepaymentPeriod |
   - [x] Inline error rendering: clears previous errors then injects one feedback div per field; global first error still shown via `showErrorMessage`.
   - [x] Input listener removes field error & feedback on user edit (defers full re-validation until next calculate).
   - [x] Jest test `helocInlineValidation.test.js` validating appearance and clearing behavior.
   - [ ] Future enhancement: aggregate summary region & aria-live announcement (and move from substring to code-based mapping if validator evolves).
10. Dynamic Metrics Panel (**Completed 2025-10-05**)

- Show: Combined LTV, Available Equity (post-draw), Interest-Only Payment, Repayment Payment, Total Interest (split draw vs repay), Payoff Date.
- Subtasks (Task 10 Progress):
  - [x] Add `postDrawEquity` (remaining equity) to structured result.
  - [x] Insert HELOC metrics panel markup with placeholders.
  - [x] Populate panel in `updateHelocResultsUI` (currency formatting & LTV%).
  - [x] Show/highlight LTV warning message row when applicable.
  - [x] Include phase interest splits (draw vs repay) when available.
  - [x] Add Jest DOM test `helocMetricsPanel.test.js` validating population.
  - [ ] Consider accessibility enhancements (aria-live region, semantic list) (deferred).
  - [x] Styling refinement & responsive stacking review (Completed 2025-10-05)
  - [x] Auto-expand Loan Analysis & Schedule after HELOC calculate (ensure summary tab active & scrolled) (Completed 2025-10-05)

11. Warnings / Notices (**Completed 2025-10-05**)

- [x] High Rate (> 15%): soft warning surfaced in metrics panel warning row.
- [x] High Combined LTV (>= 90%): warning surfaced (existing logic) with color state + message.
- [x] Over 100% LTV: still blocks calculation (unchanged) with error notification.
- [x] Multi-warning support: single row now aggregates multiple warnings (each on its own line) using `r.warnings` array (`ltvWarning`, `rateWarning`).
- [x] Styling: added minimal spacing between stacked warning lines.
- [x] Tests: `helocWarnings.test.js` validates high-rate only, combined LTV + rate together, and nominal scenario (no warnings).
- [ ] Future: replace row with dismissible alert list and add aria-live region for screen readers.

12. Accessibility (**Completed 2025-10-05**)

- [x] Added aria-live polite validation summary region `#helocValidationSummary` (visually hidden until errors) under HELOC form.
- [x] Implemented population and clearing inside `applyHelocValidationErrors` / `clearHelocFieldErrors`.
- [x] Aggregates all mapped field errors into single list with count for screen readers.
- [x] Added `.visually-hidden` utility class.
- [x] Jest test `helocAccessibility.test.js` validating show/hide lifecycle on invalid -> valid correction.
- [ ] Future: move focus to first invalid field and provide skip link to summary (deferred).

---

## Priority 4 – Export & Reporting Alignment

13. Export Data Bridge (**Completed 2025-10-05**)

- [x] Built normalized `helocResult` object (versioned, grouped payments/equity/ltv/totals) created alongside legacy `helocData.result`.
- [x] Exposed globally via `window.helocResult` for non-module consumers.
- [x] Updated `ReportExporter.addHELOCContent` to prefer `helocResult` with graceful fallback to legacy `data` / `data.results` fields (backward compatible).
- [x] Added Jest test `helocExportBridge.test.js` verifying normalized-first & legacy fallback behavior.
- [x] Full suite (48 tests) passing post-change (no regressions).

14. CSV Columns (**Completed 2025-10-05**)

- [x] Extended `generateHELOCCSV` to output detailed schedule when `helocResult.schedule` present.
- [x] Added new columns: Phase, Cumulative Principal, Cumulative Interest.
- [x] Fallback to legacy summary rows preserved when schedule absent.
- [x] New Jest test `helocCsvColumns.test.js` validates header & sample cumulative values.
- [x] Schedule already contained cumulative principal/interest fields; no generator change required.

15. PDF Improvements (**Completed 2025-10-05**)

- [x] Added Phase Breakdown section to HELOC PDF (`addHELOCContent`).
- [x] Displays Draw Phase Interest, Repay Phase Interest, Total Interest (100%), and Principal Repaid.
- [x] Percentage of total interest computed with 1 decimal precision; fallback derivation from schedule if `phaseTotals` absent.
- [x] Added Jest test `helocPdfPhaseBreakdown.test.js` validating presence of section header, labels, amounts, and percent tokens.
- [x] Backward compatibility: if no schedule or totals available, section omitted gracefully.

---

## Priority 5 – Testing & Regression Safety

16. Unit Tests (Core Logic)

    **Completed 2025-10-05**

- [x] Zero interest scenario: validated interest-only payment = 0, linear principal, constant principalPayment, final balance 0.
- [x] Short draw + repay: 1yr draw / 4yr repay; draw interest ~= principal \* annualRate; repayment phase interest within $1 of amortization formula; payoff balance 0.
- [x] High rate stability: 18% scenario produces finite positive payments; rateWarning asserted; schedule length verified (months = totalYears\*12).
- [x] LTV boundaries: <90% no warning; exactly 90% triggers High Combined LTV warning; >100% blocks calculation (no new result object written).
- [x] Added unified test file `helocCoreLogic.test.js` for consolidated core logic assertions (non-duplicative with existing edge & rounding tests).
- [x] All tests passing (suite size now 48) after additions; coverage improved for HELOC validation & numerical correctness.

17. Schedule Integrity Tests

    **Completed 2025-10-05**

- [x] Added `helocScheduleIntegrity.test.js`.
- [x] Verifies final balance strictly 0 (after folding & clamp logic).
- [x] Verifies sum of repayment phase principalPayment within $0.05 of original principal.
- [x] Asserts all Interest-Only rows have principalPayment = 0 and cumulativePrincipal = 0.
- [x] Sanity check: first repayment row cumulativePrincipal > 0.
- [x] Full suite remains green (48 tests) post-addition.

18. Export Tests

    **Completed 2025-10-05**

- [x] Added `helocExportSnapshot.test.js`.
- [x] Normalizes and snapshots stable subset of `helocResult` (principal, payments, interest splits, LTV metrics, payoffDate YYYY-MM, schedule length & endpoints, edge flags).
- [x] CSV generation test asserts header columns and line count = schedule length + 1 (header row).
- [x] Uses `ReportExporter.generateHELOCCSV` with normalized result to ensure export path alignment.
- [x] Suite still green (48 tests) post additions (no snapshot volatility introduced).

19. UI DOM Smoke Tests
    **Completed 2025-10-05**

- [x] Added `helocUiSmoke.test.js` covering end-to-end invalid → valid lifecycle.
- [x] Verifies multiple invalid fields receive `.is-invalid` plus accessibility summary becomes visible.
- [x] Confirms input event listeners clear field error classes upon user edits prior to re-calculation.
- [x] Executes successful calculation after corrections and asserts HELOC metrics panel visible (`display: block`).
- [x] Asserts key metrics (Interest-Only Payment, Repayment Payment, Total Interest) match currency format `$#,###.##` and Combined LTV ends with `%`.
- [x] Maintains non-intrusive approach (smoke scope only; deep numeric assertions deferred to existing logic tests).
- [x] Full suite remains green (48 tests) post-addition.
  - [x] Added follow-up guard test `helocWarningsRender.test.js` ensuring multi-line warning spans remain one-per-warning (structure stable for future UI refactor).

---

## Priority 6 – Refactor & Integration

20. Optional Unified Engine Hook (**Completed 2025-10-05**)

- [x] Integrated HELOC into unified engine via `buildHelocTwoPhaseSchedule` (two-phase schedule builder) while retaining legacy generator as fallback for parity validation.
- [x] Added parity test `helocEngineHook.test.js` (now part of 54 passing tests) comparing legacy vs engine schedule within tolerance.
- [x] Established guarded try/catch in `calculateHELOC()` to revert to legacy on unexpected engine errors (none encountered in current suite).

21. Isolation of Business Logic (**Completed 2025-10-05**)

- [x] Extracted computation into `modules/calculators/HelocCalculator.js` with pure functions: `computeRepaymentMonths`, `computeHelocAnalysis`, `deriveWarnings`.
- [x] Refactored `calculateHELOC()` to delegate to `computeHelocAnalysis`, reducing monolith complexity and centralizing numeric logic.
- [x] Added unit tests `helocCalculator.unit.test.js` covering repayment month adjustment and zero-interest path.
- [x] Introduced structured `helocAnalysis` object (payments, schedule, totals, ltv, edgeFlags, warnings) consumed by UI & exporter.
- [x] Added rounding & balance clamp flags surfaced through `edgeFlags`.
- [ ] Follow-up: remove legacy `generateHelocAmortizationSchedule` after expanded edge coverage (see open tasks below).

22. Telemetry Hooks (Future)

- Capture anonymized metrics (phase distribution) – optional.

---

## Priority 7 – Documentation

23. README Section Update (**Completed 2025-10-05**)

- [x] Added HELOC modeling assumptions (fully drawn credit line, interest-only then amortizing), edge flags, warning taxonomy, schedule schema, roadmap.

24. In-Code JSDoc (**Completed 2025-10-05**)

- [x] Added typedefs: `HelocInput`, `HelocScheduleRow`, `HelocEdgeFlags`, `HelocTotals`, `HelocLTV`, `HelocAnalysis` plus detailed function docs.

25. Changelog (**Completed 2025-10-05**)

- [x] Unreleased section now enumerates HELOC engine integration, rounding & repayment auto-extension changes, edge flags, and documentation updates.

---

## Deferred / Future Backlog

- Partial progressive draw modeling (monthly draw schedule input table).
- Variable rate simulation (index + margin, rate caps).
- Interest capitalization scenarios (negative amortization guardrails).
- Comparative HELOC vs Cash-Out Refi blended analysis.

---

## Acceptance Criteria (Phase 1: Priorities 1–3 + Core Tests) (**Met 2025-10-05**)

- Validation centralization via InputValidator mapping (no duplicate inline logic).
- Combined LTV and available equity always computed & displayed.
- Accurate two-phase schedule: interest-only rows show zero principal; repayment rows amortize to zero balance.
- Final balance ≤ $0.01 then forced to 0; principal sum matches creditLimit.
- Test suite covers zero-interest, high-rate, boundary LTV, schedule integrity.

---

## Migration Plan Outline (Progress Status)

1. Create HelocCalculator module (pure functions + schedule builder). ✅ Completed
2. Replace body of `calculateHELOC()` with: gather inputs → map → validate → call calculator → update UI. ✅ Completed
3. Update exporter to consume normalized result object. ✅ Completed
4. Add tests (parity + unit + schedule integrity) then remove legacy positional array. ✅ Completed (legacy generator deprecation path still tracked until explicit removal).
5. Add README + JSDoc docs. ✅ Completed.

---

## Open Questions (Flag Before Implementation)

- Should HELOC assume fully drawn at start or support initialDraw separate from credit limit? (Default: fully drawn for now.)
- Do we surface effective blended APR or cost-of-funds style metric? (Future.)
- Align LTV warning thresholds with purchase tab color scheme? (Proposed yes.)

---

---

### Open Follow-Up Tasks (Post Task 21)

- Add rounding adjustment specific test to assert `edgeFlags.roundingAdjusted` (trigger case where final principal < $0.01).
- Add explicit balance clamp test to assert `edgeFlags.balanceClamped` (residual < $0.005 scenario).
- Expand warnings composition tests combining high-rate (>=15%), high-LTV (>=90%), zero-interest, and repayment auto-adjust.
- Finalize removal of legacy `generateHelocAmortizationSchedule` (implementation still present; parity safety net retained until new tests above land) then retire parity extraction test.

All previously defined Phase 1–3 acceptance criteria satisfied; current focus: targeted edge-case test expansion and safe legacy code retirement.

End of document.
