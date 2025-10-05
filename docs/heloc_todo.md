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

13. Export Data Bridge

- Build a normalized `helocResult` object consumed by `ReportExporter.addHELOCContent` instead of ad-hoc references.

14. CSV Columns

- Add columns: Phase, Cumulative Interest, Cumulative Principal.

15. PDF Improvements

- Section for Phase Breakdown (Draw vs Repay) with interest totals and percentage of total cost.

---

## Priority 5 – Testing & Regression Safety

16. Unit Tests (Core Logic)

- Zero interest scenario (interest-only payments = 0; repayment linear).
- Short draw (1 year) + repayment (4 years) interest math vs manual calculation.
- High rate stability (no NaN, payment formula correctness).
- Boundary: combined LTV just under 90%, at 90%, above 100% (validation behavior).

17. Schedule Integrity Tests

- Final balance exactly 0.
- Sum(principal payments) == creditLimit (within 1 cent).
- Interest-only phase principal = 0.

18. Export Tests

- Snapshot JSON of normalized `helocResult` minus volatile dates.
- CSV header + line count matches expected months (drawMonths + repayMonths).

19. UI DOM Smoke Tests

- Validation triggers error class on invalid input.
- Results panel shows expected formatted values.

---

## Priority 6 – Refactor & Integration

20. Optional Unified Engine Hook

- Evaluate integrating HELOC into `ScheduleBuilder` as a two-phase loan type (flag driven) for consistency.

21. Isolation of Business Logic

- Move calculation & schedule code into `modules/calculators/HelocCalculator.js`.

22. Telemetry Hooks (Future)

- Capture anonymized metrics (phase distribution) – optional.

---

## Priority 7 – Documentation

23. README Section Update

- Add HELOC modeling assumptions (fully drawn vs partial draw, interest-only behavior).

24. In-Code JSDoc

- Document new HelocCalculator public API contract.

25. Changelog

- Enumerate new HELOC validation and reporting enhancements when shipped.

---

## Deferred / Future Backlog

- Partial progressive draw modeling (monthly draw schedule input table).
- Variable rate simulation (index + margin, rate caps).
- Interest capitalization scenarios (negative amortization guardrails).
- Comparative HELOC vs Cash-Out Refi blended analysis.

---

## Acceptance Criteria (Phase 1: Priorities 1–3 + Core Tests)

- Validation centralization via InputValidator mapping (no duplicate inline logic).
- Combined LTV and available equity always computed & displayed.
- Accurate two-phase schedule: interest-only rows show zero principal; repayment rows amortize to zero balance.
- Final balance ≤ $0.01 then forced to 0; principal sum matches creditLimit.
- Test suite covers zero-interest, high-rate, boundary LTV, schedule integrity.

---

## Migration Plan Outline

1. Create HelocCalculator module (pure functions + schedule builder).
2. Replace body of `calculateHELOC()` with: gather inputs → map → validate → call calculator → update UI.
3. Update exporter to consume normalized result object.
4. Add tests, then remove legacy positional array.
5. Add README + JSDoc docs.

---

## Open Questions (Flag Before Implementation)

- Should HELOC assume fully drawn at start or support initialDraw separate from credit limit? (Default: fully drawn for now.)
- Do we surface effective blended APR or cost-of-funds style metric? (Future.)
- Align LTV warning thresholds with purchase tab color scheme? (Proposed yes.)

---

End of document.
