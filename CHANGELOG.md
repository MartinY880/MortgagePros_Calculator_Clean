# Changelog

## Unreleased

### Added

- HELOC two-phase engine integration via `buildHelocTwoPhaseSchedule` with parity fallback (legacy generator slated for removal once extended edge coverage lands).
- Pure logic module `HelocCalculator` exposing `computeHelocAnalysis` (structured outputs: payments, schedule, totals, LTV, edgeFlags, warnings).
- Edge flags (`zeroInterest`, `repaymentMonthsAdjusted`, `balanceClamped`, `roundingAdjusted`) and ordered warning messages (LTV thresholds, zero-interest, auto-adjust, rounding fold).
- Phase interest split metrics: `totalInterestDrawPhase`, `totalInterestRepayPhase` consumed by PDF/CSV exporters.
- README section documenting HELOC assumptions, data contract & future roadmap.

### Blended Tab Phase 1 (P1-1 .. P1-6)

#### Added

- (P1-5) Transparency layer: `assumptions[]` (helocPhaseDefaults, effectiveRateMethod, zeroRateHandling, roundingNormalization) and `flags` (`zeroRateHandled`, later merged with schedule flags) included in blended result payload.
- (P1-2) Unified blended amortization schedule now includes all additional components via per-row `additionalComponents` array and aggregated principal/interest totals.
- (P1-4) Rounding normalization logic ensuring final component and combined balances terminate at exact $0.00 with tolerance absorption (<$5 residual) and minimal distortion (<$1 total payment delta aim).
- (P1-6) New deterministic snapshot `P1-6 snapshot assumptions & flags baseline` locking transparency surface (sorted keys, rationale intentionally omitted for stability).

#### Changed

- (P1-1) Additional HELOC components re-modeled from flawed full-term interest-only (could yield negative totalInterest) to two-phase draw (interest-only) + repay (amortizing) approach (defaults draw=120 months, repay=240 months) producing positive totalInterest and full principal retirement.
- (P1-2) Combined schedule semantics expanded: legacy omission of additional components replaced by full reconciliation of principal across all blended components.
- (P1-4) Final payment principal allocation can be adjusted slightly to absorb rounding residue, eliminating historical small trailing balances.

#### Fixed

- (P1-1) Negative total interest artifact for additional HELOC components removed (now strictly > 0 when rate > 0).
- (P1-3) Zero-rate (r≈0) scenarios no longer risk divide-by-zero; linear amortization path yields payment = principal/term and zero totalInterest.
- (P1-4) Residual tiny balances (<$5) after amortization eliminated; balances now consistently 0.00 at schedule end.

#### Transparency & Flags

- Flags introduced / merged over Phase 1: `scheduleIncludesAdditional` (P1-2), `normalizationApplied` (P1-4), `zeroRateHandled` (P1-5). P1-6 snapshot guards against accidental addition/removal without intentional review.
- Assumption keys captured with phase provenance for future comparative audits (effective rate methodology slated for revision Phase 3).

#### Testing & Snapshots

- Baseline Phase 0 snapshots preserved; new snapshot for P1-6 adds assumptions & flags baseline without mutating earlier metric snapshots.
- Added tests validating: positive additional HELOC interest (P1-1), schedule reconciliation & inclusion (P1-2), zero-rate linear amortization (P1-3), residual normalization (P1-4), presence & correctness of assumptions/flags (P1-5), and transparency snapshot stability (P1-6).

#### Migration / Consumer Impact

- API Surface: Blended calculation results now include `assumptions` array and `flags` object — downstream consumers should ignore unknown assumption keys / flags (forward compatible) and may safely feature-detect.
- Metrics: Additional HELOC `totalInterest` increases vs Phase 0 baseline (previously negative) reflecting corrected cost modeling; combined schedule totals now include additional components (historical partial totals deprecated).
- Final Payment: Slight last-payment principal adjustment possible; consumers relying on prior small residual balances should update logic to treat ending balance = 0 authoritative.

#### Notes

- Effective blended rate remains principal-weighted pending Phase 3 (P3-2) payment-weighted method; assumption entry added to snapshot to document planned change.
- Two-phase HELOC helper is temporary; unification into shared engine targeted for Phase 2 (P2-2).

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
