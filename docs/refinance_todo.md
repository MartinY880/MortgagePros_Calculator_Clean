# Refinance Tab — To‑Do Breakdown

Updated: 2025-10-01 (validation finalized, PMI var refactor, PMI rule toggle, schedule PMI column)

- [x] Audit refinance calculations

  - Reviewed refinance tab inputs, formulas, PMI handling, amortization generation, exports, and validation across `resources/app/src/mortgage-calculator.js` and `src/index.html` to identify inaccuracies and gaps.

- [x] Fix refinance PMI in schedule

  - In `generateAmortizationSchedule`, stop recalculating PMI using purchase fields (`downPaymentPercent`, `pmiRate`). For refinance, use the user-entered PMI amount (monthly or annual/12) and drop PMI once balance/appraisedValue <= 80% LTV.

- [x] Pass appraised value to schedule

  - Refactor schedule generation to receive `appraisedValue` and refinance PMI mode; compute LTV each month using `balance / appraisedValue` instead of inferring from purchase DOM. Remove DOM reads from schedule logic.

- [x] Align PMI display and drop-off

  - Ensure the monthly PMI shown in Payment Summary/Analysis matches the schedule for refinance and indicate the month PMI ends (if it drops at 80% LTV).

  - Enhancement: Summary now shows “PMI Ends: Month YYYY (Payment #N)”, and if PMI never applies shows “N/A (No PMI)”; if PMI applies but never drops, shows “Never (PMI lasts full term)”.

- [x] Fix PMI in PDF report (refi)

  - In `exportFullReport` Payment Breakdown, treat refinance PMI as an amount (monthly or annual/12), not a percent of appraised value. Removed the `appraisedValue * rate / 100` logic and now use monthly dollars (annual/12 when toggled).

- [x] Use correct fields in exports

  - In `exportToPDF` (schedule export), read interest rate/term from refinance inputs when current tab is refinance; avoid always using purchase `interestRate`/`loanTerm`. Also ensure the correct amortization data is referenced.

- [x] Fix undefined amortizationData exports

  - `exportToCSV` and `exportToPDF` reference an undefined `amortizationData` variable. Update them to use the current tab’s `purchaseData/refinanceData/helocData.amortizationData`.

- [x] Align Monthly Payment with schedule

  - Displayed Monthly Payment now uses the first amortization row’s payment to reflect PMI gating, extra-payment capping, and timing accurately.

- [x] Include extra payment in exports

  - CSV/PDF schedule include an “Extra Payment” column; full report amortization pages also include “Extra”.

- [x] Refi-specific validation messages

  - Added `validateRefinanceInputs(appraisedValue, loanAmount, loanTerm, interestRate, propertyTax, homeInsurance, pmiAmount)` and now use it in the refinance path.
  - Checks enforced:
    - Appraised Value must be > 0
    - Loan Amount must be > 0 and ≤ Appraised Value
    - Loan Term must be > 0
    - Interest Rate must be ≥ 0 (0% allowed)
    - Property Tax, Home Insurance, and PMI (amount) must be ≥ 0 when provided
  - Tailored messages (no purchase/down payment wording).

- [ ] Add closing costs & breakeven

  - Optional but valuable: add refinance closing costs/points input and compute breakeven months vs. current loan (needs current loan payment/term inputs or rely on Compare Loans tab).

- [ ] Clarify PMI variable naming

  - [x] Rename confusing `pmiRate` variable in refinance branch to `pmiAmountRefi` (or similar) to prevent misuse as a percentage later.

- [x] Recompute totals with PMI drop

  - Totals (interest and cost) and payoff date are derived from the amortization schedule, which reflects PMI drop timing; PMI Ends surfaced in UI/report.

- [x] Export report context accuracy

  - In `exportFullReport`, use refinance-specific labels and context:
    - Dynamic summary titles (Purchase/Refinance/HELOC Summary)
    - Appraised Value (refinance) vs Property Value (purchase)
    - Loan Amount line and correct interest rate/term from the active tab
    - LTV (Month 1) displayed in purchase/refinance summaries
    - PMI Ends line based on schedule (date and payment # if applicable)
    - For refinance: PMI mode note (Monthly amount vs Annual ÷ 12) in Payment Breakdown

- [x] PMI termination rule toggle

  - Added toggle in Purchase and Refinance to choose PMI termination at 80% or 78% LTV. Schedule drops at the selected threshold; Summary shows PMI end; Full Report note reflects rule.

- [x] Show PMI in schedule UI

  - Added a PMI column to the amortization table so refinance (amount-based) and purchase (rate-based) PMI values are visible monthly and drop when LTV crosses the rule.

- [x] Show base payment line

  - Add a “Base Monthly Payment (no extra)” line in refinance Payment Summary so users see both base payment and total including extra.

- [x] Validate extra payment ≥ 0

  - Add validation to ensure “Extra Monthly Payment must be a number ≥ 0.” Provide a clear inline error for invalid input.

- [x] Add PMI savings with extra

---

Quality/Robustness

- [x] Prevent NaN totals on blanks

  - Coerce blank optional numeric fields to 0 and add a zero-interest fallback in monthly PI to keep all totals valid even with missing optional inputs.

- [x] Remove auto-recalculate (debounce)

  - Removed debounced auto-recalc and its input listeners so results only update when you press Calculate; prevents unintended UI churn.

---

What’s next (priority order)

1. Closing costs & breakeven

- Add closing costs/points inputs; compute breakeven vs current loan or via comparison module.
