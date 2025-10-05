# Changelog

## Unreleased

### Added

- HELOC two-phase engine integration via `buildHelocTwoPhaseSchedule` with parity fallback (legacy generator slated for removal once extended edge coverage lands).
- Pure logic module `HelocCalculator` exposing `computeHelocAnalysis` (structured outputs: payments, schedule, totals, LTV, edgeFlags, warnings).
- Edge flags (`zeroInterest`, `repaymentMonthsAdjusted`, `balanceClamped`, `roundingAdjusted`) and ordered warning messages (LTV thresholds, zero-interest, auto-adjust, rounding fold).
- Phase interest split metrics: `totalInterestDrawPhase`, `totalInterestRepayPhase` consumed by PDF/CSV exporters.
- README section documenting HELOC assumptions, data contract & future roadmap.

### Changed

- Rounding: sub-cent final principal payment now merged into penultimate amortizing row to produce cleaner terminal balance (flagged by `roundingAdjusted`).
- Auto-extension of repayment phase: when total term equals draw period an extra 12 months appended (flag `repaymentMonthsAdjusted`) replacing previous hard error.

### Fixed

- Final residual balance (< $0.005) now deterministically clamped and flagged (`balanceClamped`) preventing negative drifts in exports.
- Zero-interest schedules now produce linear principal amortization instead of division by zero risk path.

### Documentation

- Enhanced JSDoc typedefs for HELOC inputs, schedule rows, totals, edge flags, and analysis return structure.
- Changelog now tracks HELOC refactor separate from unified purchase/refinance engine work.

### Internal

- Parity test ensures engine fidelity vs legacy schedule (temporary safety net).
- Additional test scaffolding planned: rounding adjustment explicit trigger & balance clamp scenario.

## v16.3.0 (October 2025)

### Added

- Refinance path fully unified onto `ScheduleBuilder` (Task 22) – purchase & refinance now share identical amortization, PMI lifecycle, extra payment, and acceleration logic.
- `fixedMonthlyPMI` override: allows refinance scenarios to model a flat PMI charge that terminates automatically at threshold (still producing canonical `pmiMeta`).
- Refinance snapshot regression (`refinanceSnapshot.test.js` + `refinance.snapshot.json`) mirroring purchase snapshot to lock core refinance metrics (monthlyPI, pmiEndsMonth, pmiTotalPaid, monthsSaved, interestSaved, extra deltas).
- Exporter enhancements (PDF + CSV) now surface unified metrics for refinance: PMI lifecycle (start/end), `pmiTotalPaid`, `interestSaved`, `monthsSaved`, and extra payment delta summaries.
- DOM integration smoke suite (Option D) stabilized: lightweight structural + interaction checks (down payment sync, notification auto-hide, PMI placeholder) without brittle style/text coupling.

### Changed

- Legacy `generateAmortizationSchedule` marked DEPRECATED (banner & comment); all active UI flows route through `ScheduleBuilder` outputs stored on each tab (`tabData.builderResult`).
- Relaxed previously brittle purchase DOM structural validation test to a resilience-focused smoke test (no crash + non-negative loan), reducing false negatives while logic remains covered in pure tests.
- README updated to reflect version alignment (v16.3.0), refinance unification, snapshot strategy, and PMI semantics consistency across calculator types.

### Fixed

- Inconsistent PMI termination & totals between refinance and purchase paths (now identical through shared engine).
- Edge case where refinance PMI could appear to persist after reaching threshold with fixed payment override (now drops and records correct `pmiEndsMonth`).
- Export metric drift (refinance reports previously omitted unified acceleration / PMI totals).

### Documentation

- Added refinance unification section, fixedMonthlyPMI semantics, dual snapshot regression guidance, and deprecation notice for legacy generator.
- Clarified PMI lifecycle semantics (`pmiEndsMonth` meaning) with refinance examples.

### Internal Notes

- Coverage focus remains on pure logic & classification modules; DOM kept intentionally lean. Future optional work: targeted tests for exporter formatting & minor scoring engine expansion.

## v16.2.1 (October 2025)

### Added

- Unified fixed-rate amortization & PMI engine (`ScheduleBuilder`) adopted by Purchase (Refinance migration pending Task 22).
- PMI transparency: termination month semantics, classification states, tooltip timeline, ignored vs active distinction.
- Down payment two-way sync with drift thresholds (<$1 / <0.01%) & soft 99.99% clamp.
- HOA (Option A) integrated into base payment, totals, and interest savings context.
- Guardrails: low property value confirm, long loan term warning, excessive extra payment advisory.
- Extra payment baseline counterfactual producing `interestSaved` & `monthsSaved`.
- Pure headless modules for deterministic testing: `PurchaseLogic`, `DownPaymentSync`, `PMIClassification`.
- Snapshot regression test (`purchaseSnapshot.test.js`) with canonical scenario metrics.

### Changed

- PMI non-applicable scenarios normalized to `pmiEndsMonth=1` & `pmiTotalPaid=0`.
- Payment rounding stabilized (bank-style to 2 decimals with reconciliation) preventing balance drift.
- Status messaging refactored to use classification output instead of implicit DOM logic.

### Fixed

- Edge rounding discrepancies between interest/principal components and displayed monthly PI.
- PMI incorrectly shown as active when LTV already at threshold on initial input.
- Sync race conditions causing oscillation on rapid alternating percent/amount edits.

### Documentation

- Expanded README: engine architecture, PMI semantics, sync strategy, regression testing, guardrails.
- Added comprehensive JSDoc typedefs for core modules (ScheduleResult, PmiMeta, DownPaymentSyncState, PurchaseScenarioInput, PmiClassificationResult).

### Pending / Next (Not in this release)

- Task 22: Refinance path unification onto `ScheduleBuilder`.
- Potential second snapshot scenario (no PMI + HOA edge) for broader regression net.
- ENV flag and checksum hardening for snapshot update workflow.
