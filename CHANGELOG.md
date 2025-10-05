# Changelog

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
