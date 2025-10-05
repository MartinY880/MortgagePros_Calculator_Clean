# Compare Loans Tab – Remediation & Enhancement Plan

Status: Completed – Priority 1 (Tasks 1–5); Priority 2 (Tasks 6–9); Priority 3 (Tasks 10–14); Priority 4 (Tasks 15–18 UX & clarity); Priority 5 (Tasks 19–21). Optional Enhancements backlog remains open. Deferred (by scope): refinance-specific validation tasks. Post‑Task 19 extension: purchase & refinance tabs now also delegate to the shared ScheduleBuilder (not originally in comparison scope, noted for architecture).
Scope: Only affects Compare Loans tab logic (loanA / loanB / optional loanC) and its reporting UI.

---

## Priority 1 – Core Accuracy (Must Fix First)

1. Add PMI termination logic ✅
   - [x] Implement LTV tracking using `appraisedValue` + starting balance.
   - [x] Support 80% / 78% termination rule (per-loan selector added; default 80% retained).
   - [x] Recalculate payment stream month-by-month removing PMI after threshold.
2. Introduce zero‑interest safeguard ✅
   - [x] Use linear payoff formula when rate = 0 to avoid NaN and allow promo / special loans.
3. Align evaluation metric with real cost ✅
   - [x] Define `totalOutOfPocket = principal + interest + totalPMI + totalTax + totalInsurance`.
   - [x] Use this for best loan determination (configurable fallback toggle deferred).
4. Correct PMI toggle semantics ✅
   - [x] Added Bootstrap switch labeled “Annual Amount” with helper text (default input treated as monthly; switch divides by 12).
5. Normalize input validation ✅
   - [x] Reject negative or non-numeric values; show field-level invalid styling (is-invalid) and inline feedback; block comparison until corrected.

## Priority 2 – Cost & Payment Integrity

6. Compute and expose escrow component totals ✅
   - [x] Track cumulative: PMI, Property Tax, Insurance separately (already accumulated in calculation loop).
   - [x] Added totals object per loan (interestPaid, pmiPaid, taxPaid, insurancePaid, totalOutOfPocket).
   - [x] Replaced Closing Costs row with PMI Paid, Property Tax Paid, Insurance Paid, and Total Out-of-Pocket rows in comparison table.
7. Rework `totalCost` to reflect selected evaluation mode ✅
   - [x] Stored legacy `totalCostPI` (exposed as Total Cost (PI) row).
   - [x] Full cost represented via existing Total Out-of-Pocket row (`totalCostFull = totalOutOfPocket`).
8. Update savings calculation to use consistent basis ✅
   - [x] Implement blended average monthly out-of-pocket: (initialWithPMI _ monthsWithPMI + baseNoPMI _ (payoffMonths - monthsWithPMI)) / payoffMonths.
   - [x] Infer monthsWithPMI = round(totalPmiPaid / monthlyPMICharge) capped at payoffMonths.
   - [x] Replaced legacy initial-payment delta with blended difference (exposed internally via savings.blendedMonthlyBest/Second for future UI/tooltips).
   - [x] MonthlyPaymentSavings now reflects realistic lifetime average payment difference aligned with totalOutOfPocket evaluation metric.
9. Adjust winner banner reason string ✅
   - [x] Dynamic label based on `evaluation.scoreBasis`: totalOutOfPocket | principalInterest | payoffSpeed.
   - [x] Displays corresponding value (currency for cost modes, payoff duration for speed).
   - [x] Always appends initial monthly payment for context.
   - [x] Future-proof: defaults to totalOutOfPocket if selector not yet exposed.

## Priority 3 – Feature Consistency & Transparency

10. Add PMI Ends metric per loan ✅ (COMPLETED)

- [x] Added dedicated "PMI Ends" row in comparison table.
- [x] Tooltip with semantics: 'No PMI' (started below threshold), 'Never' (persisted full term), 'Drops after: Yy Mm (Month X)'.
- [x] Duration-first display: `Drops after: 2y 4m (Month 29)`.
- [x] Included in PDF export with defensive fallback.
- [x] Logic: `pmiEndsMonth = first month WITHOUT PMI (1-based)`; 1 => No PMI; null/undefined => Never.

11. Show Interest Saved from Extra Payment ✅ (COMPLETED)

- [x] Compute counterfactual schedule for each loan with extraMonthly = 0 (keeping all else constant).
- [x] Derive deltas:
  - interestSaved = interestBase - interestWithExtra
  - monthsSaved = payoffBaseMonths - payoffWithExtraMonths
- [x] Attach `baseline` and `extraDeltas` objects to loan result structure.
- [x] Expose per-loan results in new rows: "Interest Saved (Extra Payment)" and "Payoff Accelerated" (duration format `Yy Mm`).
- [x] Tooltips added clarifying applicability only when extra > 0; otherwise shows em dash.
- [x] Include in PDF export (conditional rows only if any loan has extra > 0).
- [x] Documentation: Add formulas & edge case notes (zero-interest handling, monthsSaved = 0 display, em dash semantics).
- Edge Cases Considered: zero-interest linear payoff; loans with no extra -> metrics suppressed (em dash); whole-month granularity (acceptable per spec).

12. Optional metric selection UI ✅ (COMPLETED)

- [x] Added radio group (evaluation mode) with three options: Total Out-of-Pocket (default), Principal + Interest, Payoff Speed.
- [x] Integrated with scoring function (`determineBestLoan`) using mode-specific primary metric & documented tie-breakers.
- [x] Winner banner & PDF export now mode-aware (renders metric label/value + context line).
- [x] Tooltips added explaining trade-offs per mode.
- [x] Persisted selection via `localStorage` key `mp_eval_mode` (fallback to default if missing/invalid).
- [x] Documentation section "Evaluation Modes (Task 12)" added (definitions, tie-breakers, mapping, persistence, scenario table).
      (Smoke tests executed – see Smoke Test Results section.)

13. Repurpose Fees column ✅ (COMPLETED)

- [x] Prior "Fees" / "Closing Costs" column not present in current comparison table markup; confirmed no active Fees row in Compare Loans UI.
- [x] PMI Ends implemented as its own dedicated row (Task 10) eliminating need for replacement column.
- [x] Code references to `fees` remain internal defaults (set to 0) with no UI dependency; safe to leave for future fee feature without user-facing clutter.
- [x] Decision: Defer adding per-loan fee inputs until a future enhancement (see Optional Enhancements A). Documentation updated to reflect completion.

14. Add amortization schedule generation (simplified) ✅ (COMPLETED)

- [x] Implemented `buildLightweightSchedule(calc)` producing: first 12 months, annual snapshots (24,36, ...) and final payoff month.
- [x] Columns exported (comparison PDF per loan): Mo, Payment (PI+Extra), Interest, Principal (incl. extra), PMI, Balance, Cum Int.
- [x] PMI termination annotated with asterisk on first PMI-free month after PMI was active; footnote added if applicable.
- [x] Excludes escrow (tax, insurance) intentionally to keep width concise; extra payment already reflected in principal column.
- [x] Guarded spacing & page breaks; adds new pages when nearing bottom.
- [x] Fallback ensures payoff row included even if balance rounds below 0.01 earlier.
- [x] No changes to core calculation; snapshot re-simulates using stored inputs to avoid bloating main calc object.
- [x] Documentation updated with scope & constraints.

## Priority 4 – UX & Clarity Improvements

15. Harmonize formatting & rounding ✅ (COMPLETED)

Implementation Notes

- [x] Introduced `roundCurrency(v)` helper (bank-style: half-up to 2 decimals).
- [x] Rounded monthly interest & principal each iteration; adjusted principal to preserve scheduled PI when rate > 0.
- [x] Final payoff month: recompute rounded interest, truncate principal to remaining balance.
- [x] Baseline (no-extra) simulation mirrors rounding for accurate deltas.
- [x] Summed rounded components to avoid fractional cent drift.
- [x] Edge cases: zero-rate path skips delta correction; still handles final partial payment.

16. Display breakdown on hover / tooltip ✅ (COMPLETED)

Implementation Notes (Breakdown Tooltip)

- [x] Monthly payment cell renders a <span> with Bootstrap tooltip attributes.
- [x] Composition (initial month): Principal & Interest | PMI (if charged month 1) | Property Tax (if > 0) | Insurance (if > 0) | Extra Principal (if provided).
- [x] Segments joined with `|`; safe HTML escaping for attribute values.
- [x] PMI suppressed if `pmiEndsMonth === 1` (never charged).
- [x] Tooltips re-initialized after each update (disposing prior instances).
- [x] Graceful degradation on failure; future option: show post-PMI-drop base payment in parentheses.

17. Clarify PMI toggle label and helper text ✅ (COMPLETED)

Implementation Notes (PMI Toggle Clarification)

- [x] Labels changed from "PMI (Monthly $)" to "PMI Amount ($)".
- [x] Toggle label: "Annual Mode" (state-focused wording).
- [x] Title: "Input Mode: OFF = Monthly figure entered below. ON = Annual figure (we'll divide by 12)."
- [x] Helper text clarifies conversion direction and when to enable.
- [x] JS ids unchanged; refinance tab unaffected.
- [x] Rationale: reduce mis-entry of annual vs monthly values.
- [ ] Future: heuristic prompt if value unusually high for monthly (e.g., > 1500).

18. Inline warnings (PMI / appraisal context) ✅ (COMPLETED)

Implementation Notes (Inline Warnings)

- [x] Container `#comparisonWarnings` below winner banner; hidden when empty.
- [x] Rule set (in `buildComparisonWarnings()`):
  1.  PMI never drops → "PMI never drops (consider larger down payment or new appraisal)."
  2.  PMI provided but missing appraised value → "Appraised value missing — cannot evaluate PMI termination; treated as persistent."
  3.  PMI provided though starting LTV below threshold (`pmiEndsMonth === 1`) → "PMI provided but starting LTV below threshold; charge ignored. Consider removing the PMI entry or adjusting the appraised value if unintended."
  4.  Extra payment given but zero/negative interestSaved → "Extra payment yields no measurable interest savings (increase amount or verify balance/rate)."
- [x] Messages prefixed with loan name (e.g., Option A: ...).
- [x] Rendered as `<ul>` inside Bootstrap alert (`role="alert"`); escapes `<`.
- [ ] Future Considerations: dismiss persistence; Annual vs Monthly heuristic; unify with error pipeline (Priority 5).

## Current Overall Status (Snapshot)

- Tasks 1–21 complete: accuracy, cost integrity, transparency, evaluation modes, snapshot export, rounding, tooltips, PMI toggle clarity, warnings, shared schedule builder abstraction, scoring engine, and comprehensive harness suite (smoke + snapshot + warnings).
- No known defects in Compare Loans features; deterministic harnesses pass.
- Cross-tab unification: ScheduleBuilder adopted by purchase & refinance flows (outside original comparison scope) increasing consistency.
- Next candidate refactors (not started): unify warnings/error pipeline across tabs; performance profiling for triple-loan scenarios; consolidate amortization table rendering to reuse builder output; add npm script alias for harnesses.
- Optional backlog unchanged (see Optional / Future Enhancements).

## Priority 5 – Performance & Maintainability

19. Abstract shared calculation logic ✅ (COMPLETED)
    Implementation Notes (Task 19)

- [x] Added new module `resources/app/src/modules/calculators/ScheduleBuilder.js` with `buildFixedLoanSchedule(loanData)`.
- [x] Migrated amortization, PMI termination, rounding (Task 15), escrow accumulation, and baseline no-extra simulation logic from `calculateSingleLoan`.
- [x] Refactored `calculateSingleLoan` to delegate to builder (import at top-level) preserving original return structure.
- [x] Maintains fields: `monthlyPI`, `totals`, `payoffTime`, `baseline`, `extraDeltas`, `pmiMeta` for backward compatibility.
- [x] Centralizes rounding/principal adjustment logic; future reuse planned for refinance & purchase tabs to eliminate divergence.
- [x] Input contract documented in module header (amount, rate, term, pmi, propertyTax, homeInsurance, extra, appraisedValue, pmiEndRule).
- [x] Manual spot-check: pmiEndsMonth, interestSaved, monthsSaved unchanged relative to pre-refactor output (logic parity maintained).
- [x] (Follow-up) Builder integrated into purchase & refinance tabs (engine reuse achieved; tracked outside comparison scope).

20. Encapsulate comparison scoring ✅ (COMPLETED)

Implementation Notes (Task 20)

- [x] Added `ScoringEngine.js` exporting `determineBestLoan(loans, mode)` and `EvaluationModes` constants.
- [x] Removed inline scoring logic from `mortgage-calculator.js`; now delegates to scoring engine.
- [x] Pure, side-effect free implementation: consumes array of loan objects with minimal fields (totals + payoffTime).
- [x] Primary modes supported: `totalOutOfPocket`, `principalInterest`, `payoffSpeed` (lower score better).
- [x] Deterministic tie-break chain applied regardless of primary mode: (1) totalOutOfPocket, (2) totalCostPI, (3) payoff months, (4) stable order.
- [x] Winner annotation preserved (`evaluation.scoreBasis`) for banner/export logic.
- [x] Updated scoring harness to import engine; removed duplicated replica logic.
- [x] Added new harness test verifying tie-break chain where primary scores equal under `principalInterest`.
- [x] All 5/5 scoring tests and 4/4 schedule smoke tests pass post-refactor.
- [x] Engine reused by purchase & refinance (post-migration). Future: retire legacy schedule generator after UI table refactor.

21. Add lightweight unit test harness (COMPLETED)
    Updated Implementation Notes (Task 21)

- [x] Smoke tests: `scheduleBuilder.smoke.test.js` (PMI edge/no-charge, active drop, extra payment acceleration, zero-rate linear payoff).
- [x] Scoring harness: `scoringHarness.test.js` (three modes + tie-break stability + added explicit tie-break chain case).
- [x] Snapshot regression: `comparisonSnapshot.test.js` + `__snapshots__/comparison.snapshot.json` asserting stable PMI termination month (38) and deterministic winners (OOP=L1, PI=L2, Speed=L3).
- [x] PMI termination explicit month assertion (pmiEndsMonth extracted from `pmiMeta`).
- [x] Warnings harness: `warningsHarness.test.js` validates presence of all four warning rule patterns (allows multiple warnings per loan; asserts each rule at least once instead of fixed count).
- [x] Adjusted snapshot scenario inputs until deterministic without relying on fragile cost deltas; escrow differentials dominate OOP while rate differential drives PI mode.
- [x] Harnesses are standalone Node scripts (no test framework dependency) for low-overhead execution.
- [ ] Future: Add npm script alias (e.g., `npm run calc-tests`) if package manifest governance permits.
- [ ] Future: Expand snapshot to include selected aggregate metrics (e.g., totalOutOfPocket delta bounds) once cost normalization across tabs is complete.
- [ ] Future: Migrate to formal framework (Vitest/Jest) if dependency footprint becomes acceptable.

---

## Optional / Future Enhancements

A. Add fee / closing cost inputs per loan (points, origination) and integrate into cost metrics.
B. Allow variable rate scenarios (ARM simulation stub) with future sections grayed out.
C. Export detailed comparison PDF including per-loan PMI timeline & cumulative cost curve.
D. Sensitivity slider: Adjust rate +/- (e.g., 0.25%) to see impact in-place.
E. Allow manual PMI end override (user can specify custom drop month).
F. Add chart comparing cumulative out-of-pocket across loans over time.
G. Support property tax & insurance annual inputs with auto monthly conversion toggle.
H. Provide “Equalize Extra Payment” scenario – apply largest extra across all for apples-to-apples.
I. Add risk notes (e.g., if one loan has much longer payoff but slightly lower monthly, highlight total interest delta).
J. Multi-currency or locale formatting toggle.

---

## Data Model (Proposed Per Loan)

```
loan = {
  name, letter,
  inputs: { amount, rate, termMonths, appraisedValue, pmiInput, pmiMode, taxesMonthly, insuranceMonthly, extraMonthly },
  scheduleMeta: { pmiEndsMonth, payoffMonth, basePayoffMonth },
  totals: {
    principal: amount,
    interestPaid,
    pmiPaid,
    taxPaid,
    insurancePaid,
    totalOutOfPocket,
    totalCostPI,      // principal + interest
    totalCostFull     // principal + interest + escrow components
  },
  payoff: { years, months, totalMonths },
  savings: { interestSaved, monthsSaved },
  evaluation: { scoreBasis: 'totalOutOfPocket' | 'principalInterest' | 'payoffSpeed' }
}
```

---

## Implementation Sequence (Suggested)

1. Refactor engine: create shared schedule builder + zero-rate handling.
2. Add LTV & PMI termination; compute pmiPaid & pmiEndsMonth.
3. Add totals (interestPaid, pmiPaid, taxPaid, insurancePaid, totalOutOfPocket).
4. Switch best loan selection to new evaluation metric (configurable future toggle).
5. Update UI (winner reason, optional replace Fees column with PMI Ends).
6. Add savings recalculation using unified cost basis.
7. Add tooltips / formatting normalization.
8. Add optional strategy selector & expose interest saved / payoff acceleration.
9. (Optional) Introduce fee inputs & extended export.

---

## Acceptance Criteria (Phase 1)

- PMI ends correctly at threshold month for all provided scenarios; set to null if never applied.
- Best loan chosen by totalOutOfPocket (unless user toggle added and set differently).
- Savings numbers reconcile: (secondBest.totalOutOfPocket - best.totalOutOfPocket) > 0.
- Zero-interest loan produces finite monthlyPI and payoff metrics.
- No uncaught NaNs when inputs are empty / badly formatted; user receives clear error messages.
- UI no longer displays misleading $0 fees column (replaced or hidden).

---

## Risks & Mitigations

- Risk: Increased compute time generating schedules for three loans.
  - Mitigation: Cap to term or early exit once balance <= 0; schedule arrays modest (< 360 entries typical).
- Risk: User confusion switching basis.
  - Mitigation: Provide inline helper text plus a small info icon describing evaluation mode.
- Risk: Divergence with refinance logic again.
  - Mitigation: Central shared schedule function used by all tabs.

---

## Open Decisions (Need Direction Before Coding)

---

## Formulas & Metric Definitions

### Core Monthly Payment (Principal & Interest)

For rate > 0:
\[ PI = P _ r _ (1+r)^{n} / ((1+r)^{n} - 1) \]
Where:

- P = starting principal (loan amount)
- r = monthly interest rate (annualRate / 12)
- n = total term months

For rate = 0: \( PI = P / n \) (linear principal reduction).

### Amortization Loop Mechanics

Each month (pre-payoff):

1. interestPortion = remainingBalance \* r (or 0 if zero-rate)
2. principalPortion = scheduledPayment - interestPortion (clamped so balance never negative)
3. extraPrincipalApplied = extraMonthly (if provided and balance remains)
4. balance -= principalPortion + extraPrincipalApplied
5. PMI applied if (LTV > threshold AND PMI not already terminated)

### Loan-To-Value (LTV)

LTV = currentBalance / appraisedValue.
PMI termination month = first month where LTV <= threshold (80% or 78% depending on rule) after applying that month’s principal reduction.
Recorded as pmiEndsMonth = (monthIndex + 1 of first non-PMI month). If PMI never charged: pmiEndsMonth = 1 (display ‘No PMI’). If charged full term: pmiEndsMonth = null (‘Never’).

### Total Cost Components

- interestPaid = Σ monthly interestPortion
- pmiPaid = Σ monthly PMI charge (only while active)
- taxPaid = taxesMonthly \* payoffMonths
- insurancePaid = insuranceMonthly \* payoffMonths
- totalOutOfPocket = principal + interestPaid + pmiPaid + taxPaid + insurancePaid
- totalCostPI = principal + interestPaid

### Blended Monthly Payment (Used for Monthly Savings)

Let:

- M_with_PMI = initial monthly payment including PMI (if any)
- M_without_PMI = base PI + escrow (tax + insurance) after PMI drops
- m_pmi = number of months PMI actually billed (derived via pmiPaid / monthlyPMI, capped)
- N = payoffMonths (actual months until balance <= 0)

BlendedAvg = (M*with_PMI * m*pmi + M_without_PMI * (N - m_pmi)) / N

MonthlyPaymentSavings = BlendedAvg(secondBest) - BlendedAvg(best)

### Extra Payment Metrics (Task 11)

Baseline (no-extra) simulation replicates inputs but sets extraMonthly = 0.

- interestBase = interest paid in baseline
- interestWithExtra = actual interest paid with extra
- interestSaved = interestBase - interestWithExtra (never negative; clamp to 0 if rounding produces < 0)
- payoffBaseMonths = baseline payoff months
- payoffWithExtraMonths = actual payoff months
- monthsSaved = payoffBaseMonths - payoffWithExtraMonths (>= 0)

Display Rules:

- Interest Saved: currency (0 => $0 shown if extra > 0; em dash if no extra)
- Payoff Accelerated: format monthsSaved as `Yy Mm` (omit years if 0). If monthsSaved = 0 and extra > 0 show `0m`; if no extra show em dash.

### PMI Ends Display Logic

Case table:

- pmiEndsMonth === 1 → ‘No PMI’
- pmiEndsMonth === null/undefined → ‘Never’
- else → ‘Drops after: {duration} (Month {pmiEndsMonth})’ where duration = (pmiEndsMonth - 1) expressed as Yy Mm (last month with PMI).

---

## Edge Case Handling

1. Zero Interest Rate

- Uses linear principal reduction. interestPaid remains 0. PMI logic still applies on balance decline.

2. Early Payoff Mid-Month

- Not modeled; schedule granularity is monthly. Final month payment may be smaller (implicit via clamp) but still counted as one month.

3. Extra Payment Exceeds Remaining Balance

- Extra truncated so balance never dips below zero.

4. No Extra Payment Provided

- Baseline not simulated (or simulated but yields identical results); interestSaved & monthsSaved omitted (rendered as em dash in UI/export).

5. Rounding Drift

- Currency formatted with 0 decimals for totals; internal arithmetic retains precision to avoid cumulative rounding error. Negative deltas due to floating error clamped to 0.

6. PMI Never Drops Due to High LTV

- pmiEndsMonth = null → ‘Never’. Savings calculations still incorporate full-term PMI cost.

7. Appraised Value Missing or Zero

- Treat as disabling PMI termination (acts as if PMI persists; may revisit with validation later).

---

## Evaluation Modes (Task 12)

### Overview

Users can select an optimization basis that changes how the “Best Option” is chosen and how the PDF / banner label is rendered.

### Mode Definitions

1. totalOutOfPocket (default)

- Score = totalOutOfPocket = principal + interest + PMI + taxes + insurance.
- Rationale: holistic lifetime cash requirement.

2. principalInterest

- Score = totalCostPI = principal + interest only.
- Rationale: isolates financing efficiency, ignoring escrow items that may be externally determined.

3. payoffSpeed

- Score = payoffMonths = years \* 12 + months (time until balance <= 0 considering any extra payments).
- Rationale: fastest debt-free timeline emphasis.

### Tie-Breakers (Applied in Order)

1. Lowest totalOutOfPocket
2. Lowest totalCostPI
3. Shortest payoffMonths
4. (Implicit) First encountered (stable selection) — unlikely after prior tiers.

### Winner Banner / PDF Mapping

Mode → Display Metric:

- totalOutOfPocket → “Total Out-of-Pocket: $X”
- principalInterest → “Principal + Interest: $X”
- payoffSpeed → “Payoff Time: Yy Mm”

Context line appended in PDF: describes mode semantics & tie-breaker rule.

### Persistence

Selection saved under localStorage key `mp_eval_mode`; restored on load. Fallback = totalOutOfPocket.

### Example Scenario Justification

| Scenario             | A (Cost)                                                                      | B (Faster)           | C (Lower P+I)         | Mode Outcome    |
| -------------------- | ----------------------------------------------------------------------------- | -------------------- | --------------------- | --------------- |
| High escrow variance | A has lower escrow so lower totalOutOfPocket; B faster by 6m; C lower PI only | totalOutOfPocket → A | principalInterest → C | payoffSpeed → B |

---

## Smoke Test Results (Task 12)

Four targeted scenarios validate each evaluation mode and tie-break stability. All PASS.

Scenario 1 – Mode: totalOutOfPocket
Setup: Loan A slightly higher PI but lower escrow; Loan B lower PI higher escrow; Loan C neutral.
Expected Winner: A (lowest lifetime all-in cost).
Observed: A selected; banner shows "Total Out-of-Pocket" metric. No tie-break invoked.

Scenario 2 – Mode: principalInterest
Setup: Same base values; B engineered to have lowest principal+interest sum; escrow differences ignored under this mode.
Expected Winner: B.
Observed: B selected; banner shows "Principal + Interest"; OOP differences ignored as designed.

Scenario 3 – Mode: payoffSpeed
Setup: Loan C given extra payment producing 14-month earlier payoff; its OOP slightly higher than A.
Expected Winner: C (shortest payoff time).
Observed: C selected; banner shows "Payoff Time"; tie-breakers not needed.

Scenario 4 – Tie Case
Setup: Loans A & B manually set identical OOP, PI, payoffMonths; Loan C higher OOP.
Expected Winner: Deterministic stable pick (A) after exhausting tie-break tiers.
Observed: A selected consistently across recalculations; evaluation metadata stable.

Additional Verifications

- Persistence: Reload restored last chosen mode via localStorage key `mp_eval_mode`.
- PMI Ends row unaffected by mode switching.
- Extra payment metrics (interestSaved / monthsSaved) unchanged by mode toggles.
- PDF export correctly reflected each mode's label & context line.
- No console errors; all formatted values non-NaN.

Result: Task 12 smoke tests COMPLETE – no remediation required.

---

1. Evaluation default: Use totalOutOfPocket? → DECIDED & IMPLEMENTED (default mode)
2. Replace Fees column with PMI Ends or hide? → PARTIALLY ADDRESSED (Added "PMI Ends" as a row; column repurpose decision deferred until a fees column exists or is removed entirely.)
3. Provide a mode selector now or defer? → DECIDED & IMPLEMENTED (selector live with persistence)

---

## Remaining Focus

- Implement Task 14 (lightweight amortization schedule generation/export support) if prioritized.
- Evaluate Priority 4+ enhancements (formatting normalization, tooltips expansion) for upcoming release.
- Plan Optional Enhancements backlog sequencing (fees inputs, cumulative cost chart) post-core stability.

Historical note: Earlier "Ready for Approval" step superseded by completed implementation & validation.
