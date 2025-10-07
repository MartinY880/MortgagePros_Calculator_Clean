# Blended Tab — To‑Do Breakdown

Updated: 2025-10-06 (P1-6 snapshot assumptions & flags baseline added; all Phase 1 implementation tasks complete pending CHANGELOG)

---

## Core Context

Phase 0 snapshots capture current behavior including known flaws (negative additional HELOC interest, schedule omission). All corrective work must update snapshots intentionally & document in CHANGELOG.

---

## High Priority

- [x] Baseline audit & roadmap established
  - Reviewed formulas, HELOC assumptions (10/20), additional components flaw, weighted rate, schedule omission.
- [x] Phase 0 baseline tests & snapshots
  - Added P0-1..P0-8 (P0-4 skipped). Snapshots stored in `blendedPhase0.test.js.snap`.
- [x] Correct additional HELOC modeling (P1-1) — implemented 2025-10-05
  - Replaced flawed full-term interest-only model with two-phase (draw=120, repay=240 defaults). Ensures positive totalInterest & full principal repayment (±$0.01 tolerance).
  - Added helper: `buildTwoPhaseHeloc(amount, rate, drawMonths=120, repayMonths=240)` (temporary until unified HELOC engine in P2-2).
  - Updated snapshot: prior P0-3 (negative interest flaw) removed; new scenario snapshot under renamed test `P1-1 fixed + HELOC + additional HELOC (two-phase additional HELOC)`.
  - Assertion added: additional HELOC totalInterest > 0 and representative monthly draw-phase interest-only payment surfaced as `additionalHelocMonthlyDrawPhase`.
  - Obsolete snapshot intentionally pruned (Jest: 1 removed) documenting behavior improvement.
- [x] Include all components in combined schedule (P1-2) — implemented 2025-10-05
  - Merged first, second, and all additional components into unified amortization schedule.
  - Added `additionalComponents` array per combined row & per-row component breakdown.
  - Injected `flags.scheduleIncludesAdditional = true` after schedule generation (flag only present post generation call).
  - New test: `P1-2 schedule includes additional components` validates principal reconciliation (±$0.02 aggregate), monotonic balances, and flag presence.
  - Legacy omission test (P0-5) repurposed to historical characterization ensuring reconciliation rather than absence.
- [x] Zero-rate handling (P1-3)
  - Implemented r≈0 branch across fixed/variable/HELOC & additional components (threshold |r| < 1e-12).
  - Monthly payment = principal/termMonths for zero-rate amortizing loans; interest forced to 0.
  - HELOC zero-rate: no draw interest; repayment evenly amortizes principal.
  - Validation now allows 0% (still blocks negative rates).
  - Former P0-4 test unskipped and renamed to P1-3; asserts payment formula & zero totalInterest.
  - No snapshot changes required (baseline snapshots unaffected).
- [x] Final payment rounding normalization (P1-4) — implemented 2025-10-05
  - Added component-level and combined-schedule residual normalization.
  - If residual > $0.01 and < $5, final row principal increased to absorb, balances forced to 0.
  - If residual ≤ $0.01 treated as FP noise and zeroed without payment adjustment.
  - Injected `flags.normalizationApplied = true` when schedule generated.
  - New test `P1-4 rounding normalization eliminates residual balances` asserts zero final balances and principal reconciliation (±$0.05).
- [x] Assumptions & flags in result payload (P1-5) — implemented 2025-10-06
  - Added `assumptions[]` with keys: `helocPhaseDefaults`, `effectiveRateMethod`, `zeroRateHandling`, `roundingNormalization`.
  - Added `flags.zeroRateHandled` at calculation time if any component has near-zero rate.
  - Existing flags extended on schedule generation: `scheduleIncludesAdditional`, `normalizationApplied` preserved/merged.
  - New test `P1-5 assumptions & flags exposed` validates presence and correctness.
- [x] Update/rename snapshots & tests (P1-6) — implemented 2025-10-06
  - Added deterministic snapshot `P1-6 snapshot assumptions & flags baseline` capturing sorted assumption keys & flags object.
  - Confirms positive additional HELOC interest already locked in prior snapshots; no legacy snapshot removals required in this step.
  - Ensures future transparency changes (adding/removing assumption keys or flags) require intentional snapshot update.
- [ ] CHANGELOG Phase 1 entry (P1-7)
  - Document modeling fix, schedule inclusion, zero-rate support, rounding normalization, transparency fields.

## Medium Priority

- [x] Extract pure fixed amortization util (P2-1) — implemented 2025-10-06
  - Added `modules/calculators/amortization/FixedAmortization.js` exporting `computeFixedAmortization({ principal, annualRate, termMonths, payment? })`.
  - Parity with inlined logic: zero-rate branch, residual normalization (0.01–5 absorption), early stop at ≤0.01.
  - Dedicated tests: standard 30y @6%, zero-rate 24mo, crafted residual normalization case.
  - Blended fixed component schedule generation refactored to delegate to util with defensive fallback; no snapshot drift.
- [ ] Integrate shared HELOC two-phase engine (P2-2)
  - Goals: unify main second HELOC (hard-coded 10/20) & additional component HELOC (parametrized draw/repay) into one engine.
  - Engine inputs: `{ principal, annualRate, drawMonths, repayMonths, zeroRateEpsilon }`.
  - Outputs: `{ schedule, totals{ totalInterest, totalPaid, totalPrincipal, drawInterest, repayInterest }, phaseSplit, flags{ zeroRate }, representativePayments{ drawPhaseInterestOnly, repayPhaseAmortizing } }`.
  - Acceptance Criteria:
    - Parity test: existing secondMortgage HELOC metrics (totalInterest, monthly IO payment) unchanged.
    - Additional HELOC positive totalInterest preserved; snapshot unaffected.
    - Zero-rate path identical (no draw interest, linear repay) and flagged.
    - Removal of duplicate two-phase logic sections in `calculateSecondComponent`, `calculateAdditionalComponent`, and `generateComponentSchedule`.
  - Follow-up: set assumptions key change deferred until after engine stabilization (avoid snapshot churn mid-phase).
- [ ] Component calculator registry (P2-3)
  - Map `{ type: handler }` for extensibility; tests for each registered type.
- [ ] Central validation reuse (P2-4)
  - Refactor to shared validator pattern (align with existing validators); keep messages stable.
- [ ] Assumptions object formalization (P2-5)
  - Each assumption: `{ key, value, rationale, phase }`; snapshot test for stable keys.
- [ ] Basic warning generation (P2-6)
  - Triggers: high combined LTV, high HELOC share, long IO phase.
- [ ] Developer extension guide (P2-7)
  - CONTRIBUTING doc snippet describing adding new loan type.
- [ ] Configurable benchmark rate (P3-1)
  - Inject via param/config instead of static 7.0%.
- [ ] Payment‑weighted effective rate (P3-2)
  - Replace principal-weighted; keep old in assumptions until removal.
- [ ] Optional IRR blended metric (P3-3)
  - Feature flag; convergence tolerance 1e-7 within 200 iterations.
- [ ] Benchmark savings breakdown (P3-4)
  - Add total interest delta & breakeven month vs benchmark.

## Low Priority

- [ ] Metrics methodology documentation (P3-5)
  - Explain weighted rate vs IRR vs benchmark comparison.
- [ ] Variable rate scenarios (P4-1)
  - Rate path array `(startMonth, rate)`; schedule reflects changes.
- [ ] PMI lifecycle integration (P4-2)
  - Add PMI add/remove based on LTV; show `pmiEndsMonth`.
- [ ] Prepayment modeling (P4-3)
  - Extra monthly & lump sums; compute interest & term saved.
- [ ] Rate sensitivity sandbox (P4-4)
  - ±100bp scenario output side-by-side.
- [ ] Extended warning taxonomy (P4-5)
  - Add DTI proxy, volatility concentration, refinance risk.
- [ ] Export enhancements (P4-6)
  - Include assumptions, warnings, full merged schedule in CSV/PDF/JSON.
- [ ] User-facing help page (P4-7)
  - Interpret blended metrics & warnings.

## Backlog / Nice-to-Have

- [ ] Loan Phase DSL abstraction (B-1) — Unified phase spec powering all calculators.
- [ ] Monte Carlo variable rate simulation (B-2).
- [ ] Tax deductibility estimator (B-3).
- [ ] Inflation-adjusted metrics (B-4).
- [ ] Graph rendering module (B-5).
- [ ] Performance micro-bench suite (B-6) — Target IRR + large schedule <50ms.
- [ ] Accessibility review (B-7) — ARIA & keyboard flows.

---

## Phase 0 Snapshot Notes

File: `src/__tests__/__snapshots__/blendedPhase0.test.js.snap`

- P0-1: Weighted rate 6.38% (first=60% LTV, second=20%).
- P0-2: HELOC total interest uses fixed 10/20 assumption (not user-configurable).
- P0-3: Negative additional HELOC interest baseline captured (to be corrected in P1-1).

## Baseline Assumptions (Locked)

| Area              | Current Simplification                 | Impact / Rationale                       |
| ----------------- | -------------------------------------- | ---------------------------------------- |
| HELOC (second)    | Hard-coded 10y draw + 20y repay        | Stable known baseline for refactor       |
| Additional HELOC  | Interest-only flaw (negative interest) | Provides demonstrable improvement target |
| Effective rate    | Principal-weighted average             | Simplicity; will change in P3-2          |
| Schedule coverage | Excludes additional components         | Will be included in P1-2                 |
| Zero-rate         | Not handled (test skipped)             | Added in P1-3                            |
| Rounding          | Residual up to <$5                     | Normalize in P1-4                        |
| Benchmark         | Static 7.0%                            | Configurable in P3-1                     |
| Warnings          | None                                   | Introduce P2-6                           |

## Risk & Mitigation Quick Table

| Change                 | Risk                     | Mitigation                                               |
| ---------------------- | ------------------------ | -------------------------------------------------------- |
| Two-phase HELOC fix    | Over/under interest calc | Cross-check manual amortization & positive interest test |
| Schedule merge         | Performance / memory     | Limit component count in tests; optimize later if needed |
| Zero-rate path         | Division by zero         | Tolerance guard + unit test                              |
| Rounding normalization | Payment distortion       | Assert totalPaid delta < $1 vs pre-fix                   |
| Effective rate change  | User confusion           | Phase assumption entry + CHANGELOG guidance              |

## Implementation Order (Recommended)

1. Zero-rate handling (small surface, enables un-skip test).
2. Additional HELOC two-phase modeling.
3. Schedule inclusion of additional components.
4. Rounding normalization.
5. Assumptions & flags injection.
6. Snapshot/test updates & CHANGELOG entry.
7. Begin architectural extraction (fixed amortization util & registry).

---

## Done (Historical Reference)

- [x] Audit & roadmap
- [x] Baseline test harness (Phase 0)
- [x] Assumptions documentation

---

## Next Action

Start High Priority list at the first incomplete item (P1-1) unless zero-rate (P1-3) is preferred as a low-risk entry point—choose ordering above.

## Phase 0 — Baseline Safety (No Functional Change)

- [x] P0-1 Add fixed+fixed scenario test
  - AC: Snapshot stores monthly payment & total interest for canonical inputs. (Snapshot: effective blended rate 6.38; combined payment 2725.66)
- [x] P0-2 Add fixed+HELOC scenario test
  - AC: Captures current 10-year draw + 20-year amortization assumption totals. (Snapshot: blended rate 6.59; HELOC monthly interest-only 1200.00)
- [x] P0-3 Add fixed+HELOC+additional HELOC component test
  - AC: Locks current (flawed) additional HELOC interest-only behavior before fix. (Snapshot shows negative additional HELOC interest = -5000 highlighting flaw.)
- [ ] P0-4 Zero-rate fixed loan edge test (SKIPPED pending implementation)
  - AC: (Temp skipped) r=0 path expectation = principal/term payment, no NaN. Will un-skip in Phase 1 when zero-rate branch added.
- [x] P0-5 Historical schedule omission characterization (repurposed post P1-2)
  - AC (original, pre-P1-2): Asserted absence of additional components in combined schedule (baseline flaw documentation).
  - AC (current): Ensures historical context retained while verifying post-merge reconciliation (sum of additional principals now present and included in total principal reconciliation). Serves as audit trail of intentional behavior change in P1-2.
- [x] P0-6 Validation boundary tests
  - AC: Combined LTV 95.00% passes; 95.01% fails with clear message (error thrown contains "Combined loan-to-value ratio exceeds 95%").
- [x] P0-7 Rounding residue check
  - AC: Last balance < $5 (tolerance) confirming minor residue only.
- [x] P0-8 Document Phase 0 assumptions
  - AC: Assumptions subsection below added capturing current simplifications & flaws retained for baseline.

### Phase 0 Snapshot Notes

File: `src/__tests__/__snapshots__/blendedPhase0.test.js.snap`

- P0-1: Weighted rate 6.38% with first=60% LTV, second=20% LTV.
- P0-2: HELOC total interest (325,342.11) reflects 10y IO + 20y amortization assumption; not parameterized.
- P0-3: Additional HELOC negative interest (-5000) evidences modeling bug; intentionally preserved for baseline.

### Phase 0 Assumptions (Baseline Locked)

| Area                        | Current Simplification                                                                        | Impact / Rationale                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| HELOC (second)              | Hard-coded 10-year interest-only draw + 20-year amortization                                  | Provides deterministic baseline for future parameterization (Phase 2). |
| Additional HELOC components | Treated as pure interest-only for full term; totalInterest can go negative in snapshot (P0-3) | Captured intentionally to prove refactor improves correctness (P1-1).  |
| Effective blended rate      | Principal-weighted arithmetic average of nominal rates                                        | Simplicity; slated for payment-weighted/APR style in Phase 3 (P3-2).   |
| Schedule coverage           | Only first + second mortgages included; additional components omitted                         | Baseline doc for schedule expansion (P1-2).                            |
| Zero-rate handling          | No explicit branch; test skipped (P0-4)                                                       | Will implement safe division path in P1-3.                             |
| Rounding                    | Final balances allowed small residual (<$5)                                                   | Acceptable for baseline; P1-4 will normalize to ±$0.01.                |
| Benchmark comparison        | Static 7.0% 30-year reference                                                                 | Will become configurable (P3-1).                                       |
| Warnings/assumptions output | Not emitted in result payload                                                                 | To be introduced in Phases 1–2 (P1-5, P2-6).                           |

These assumptions are now frozen; any deviation requires updating snapshots and CHANGELOG notes in corresponding Phase tasks.

## Phase 1 — Critical Correctness

- [x] P1-1 Correct additional HELOC component modeling
  - Implemented: two-phase draw (IO) + repay amortization for additional HELOCs (120/240 defaults). Helper `buildTwoPhaseHeloc` introduced; snapshot with negative interest discarded; tests now assert positive interest & repayment completeness.
- [x] P1-2 Include all components in combined schedule
  - Implemented: Unified schedule with additional components; reconciliation test (±$0.02) & flag `scheduleIncludesAdditional`.
- [x] P1-3 Zero-rate safe payment formula
  - Implemented: r≈0 branch across all loan types; unskipped zero-rate test validates linear amortization & zero interest.
- [x] P1-4 Final payment rounding normalization
  - Implemented: residual absorption logic (component + combined) with tolerance strategy and flag.
- [x] P1-5 Add assumptions & flags to result payload
  - Implemented: assumptions array + initial flag population (zeroRateHandled) and schedule flags (scheduleIncludesAdditional, normalizationApplied).
- [x] P1-6 Update baseline tests for intentional changes
  - Implemented: Added new snapshot test focusing solely on assumptions & flags (sorted, rationale omitted) to minimize churn.
  - AC satisfied: Diff limited to new snapshot (1 written) with no unintended metric drift.
- [ ] P1-7 CHANGELOG entry (Phase 1)
  - AC: Notes user-visible behavior changes (schedule completeness, additional HELOC cost shift).

### Phase 1 Implementation Plan (Detailed)

#### P1-1 Additional HELOC Modeling Fix

Current Flaw: Additional HELOC components accrue interest-only for full term producing negative totalInterest when subtracting principal.
Approach:

- Introduce optional `drawMonths` (default 120) and `repayMonths` (default 240) for additional HELOCs.
- Compute: drawInterest = principal _ monthlyRate _ drawMonths; then amortize remaining principal over repayMonths at same nominal rate.
- totalInterest = drawInterest + (repayTotalPaid - principal); totalPaid = principal + totalInterest.
- Provide temporary helper: `buildTwoPhaseHeloc(amount, annualRate, drawMonths, repayMonths)` until Phase 2 engine reuse.
  Tests:
- Replace snapshot for P0-3 with new scenario name `P1-1 corrected additional HELOC modeling` (expected positive interest).
- Assert totalInterest > 0 & final amortization balance <= 0.01.

#### P1-2 Include All Components in Combined Schedule

Goal: Merge first, second, and each additional component monthly rows.
Design:

- Generate per-component schedule array using existing logic (plus new additional HELOC schedule from P1-1).
- Determine `maxPayments` across all components.
- For each payment index: sum principal, interest, payment, remaining balances. Maintain backward compatibility fields (`firstMortgage`, `secondMortgage`) AND add `additionalComponents: [{id?, principal, interest, balance}]`.
- Add `flags.scheduleIncludesAdditional = true`.
  Validation Tests:
- Sum of all principal payments across combined schedule ≈ total principal (±$0.01).
- Longer-horizon scenario (e.g., short second + longer first) still yields expected length.

#### P1-3 Zero-Rate Handling

Logic:

- When monthlyRate ~ 0 (abs < 1e-10): monthlyPayment = principal / termMonths; interestPayment = 0 each row; adjust last payment for rounding remainder.
  Tests:
- Un-skip zero-rate test; add schedule test verifying all interestPayment = 0 and last balance 0 ±0.01.

#### P1-4 Rounding Normalization

Logic:

- After building each schedule: if final remainingBalance between 0.01 and 0.50, add residue to last principalPayment and set remainingBalance = 0.
- Apply also after merging to ensure `totalRemainingBalance` 0 ±0.01.
  Tests:
- Scenario with deliberate fractional cents (e.g., rate 6.1%, unusual term) ensures final residue eliminated.

#### P1-5 Assumptions & Flags

Add to result object:

```
assumptions: [
  { key: 'helocDefaultPhases', value: 'draw=120,repay=240', phase: 'P1' },
  { key: 'effectiveRateMethod', value: 'principalWeighted', phase: 'pre-P3' }
],
flags: {
  scheduleIncludesAdditional: true|false,
  zeroRateHandled: boolean,
  normalizationApplied: boolean
}
```

Tests:

- Assert presence & logical truthiness when triggered (e.g., zeroRateHandled true when any component rate 0).

#### P1-6 Test & Snapshot Strategy

Steps:

1. Duplicate existing snapshot file before modifications (optional archival commit).
2. Implement logic; run tests -> snapshot updates flagged.
3. Manually inspect diffs ensuring only intended sections changed (P0-3 replacement and combined schedule expansions if snapshotting schedule later).
4. Commit with message referencing P1-1..P1-4.

#### P1-7 CHANGELOG Template (Draft)

```
### Blended Tab – Phase 1
Fixed: Additional HELOC components now modeled with two-phase draw+repay (no negative interest).
Added: Combined amortization schedule now includes all additional components.
Added: Zero-rate loan handling (graceful linear amortization path).
Improved: Final payment rounding normalization ensures $0.00 ending balances.
Added: Assumptions & flags arrays in blended result payload (transparency).
Snapshots: Updated blended baseline; expect higher total interest for corrected HELOC components.
```

#### P1 Execution Order (Proposed)

1. Implement P1-3 zero-rate helper (small, isolated risk) & tests.
2. Implement P1-1 two-phase additional HELOC modeling & tests (snapshot update).
3. Implement P1-2 schedule merge for additional components & tests.
4. Implement P1-4 rounding normalization (component then combined layers) & tests.
5. Implement P1-5 assumptions/flags injection & tests.
6. Update snapshots / adjust failing assertions (P1-6).
7. Add CHANGELOG entry (P1-7).

Rollback Points:

- After each numbered step commit; revert if subsequent breakage.

Risk Matrix:
| Change | Risk | Mitigation |
|--------|------|------------|
| Two-phase modeling | Over/under interest | Compare with manual amortization sample & test positive interest > 0 |
| Schedule merge | Performance with many components | Limit test components (3–4) & add perf note to backlog |
| Rounding normalization | Off-by-one payment increase | Assert totalPaid delta < $1 vs non-normalized baseline |
| Zero-rate path | Division by zero regression | Guard with tolerance check & unit test |

Metrics to Watch Post-P1:

- Coverage (should not fall below current ~78% for Blended file after splitting logic).
- Snapshot churn limited to intentional scenarios.

## Phase 2 — Architecture & Reuse

- [ ] P2-1 Extract pure fixed amortization util
  - AC: `computeFixedAmortization` exported; 100% line & branch covered.
- [ ] P2-2 Integrate shared HELOC two-phase engine
  - AC: HELOC path delegates to unified builder; legacy code removed.
- [ ] P2-3 Component calculator registry
  - AC: Adding new type requires registry entry + isolated tests only.
- [ ] P2-4 Central validation adapter reuse
  - AC: Validation logic moved to shared pattern; previous tests still green.
- [ ] P2-5 Assumptions object formalization
  - AC: Each assumption has key, value, rationale; tested snapshot.
- [ ] P2-6 Basic warning generation
  - AC: Warnings array returns deterministic triggers (high LTV, large HELOC share, long IO phase).
- [ ] P2-7 Developer extension guide
  - AC: CONTRIBUTING section updated with component type onboarding steps.

## Phase 3 — Metrics Upgrade

- [ ] P3-1 Configurable benchmark rate
  - AC: Benchmark rate injectable (UI or config); default preserved if absent.
- [ ] P3-2 Payment-weighted effective rate
  - AC: New metric computed; test compares vs old principal-weighted in differing term scenario.
- [ ] P3-3 Optional IRR blended metric
  - AC: Feature-flag controlled; converges within 200 iterations tolerance 1e-7.
- [ ] P3-4 Benchmark savings breakdown
  - AC: Adds cumulative interest delta & breakeven month fields.
- [ ] P3-5 Metrics methodology documentation
  - AC: Documentation explains formulas, assumptions, limitations.

## Phase 4 — Advanced Modeling

- [ ] P4-1 Variable rate scenarios (paths)
  - AC: Accepts array of (startMonth, rate); schedule reflects changes.
- [ ] P4-2 PMI lifecycle integration
  - AC: PMI added/removed based on LTV threshold; end month surfaced.
- [ ] P4-3 Prepayment modeling
  - AC: Extra monthly + lump sum reduce term/interest; tests verify deltas.
- [ ] P4-4 Rate sensitivity sandbox
  - AC: ±100bp scenario outputs side-by-side; numeric stability test passes.
- [ ] P4-5 Extended warning taxonomy
  - AC: Adds DTI proxy, volatility concentration, refinance risk warnings.
- [ ] P4-6 Export enhancements
  - AC: CSV/JSON include assumptions, warnings, full merged schedule.
- [ ] P4-7 User-facing help page
  - AC: Help doc explaining advanced blended metrics & warnings.

## Backlog (Unscheduled / Nice-to-Have)

- [ ] B-1 Loan Phase DSL abstraction — Unified phases (InterestOnly, Amortizing, Balloon) powering all calculators.
- [ ] B-2 Monte Carlo variable rate simulation — Random walk / cap-floor stress output.
- [ ] B-3 Tax deductibility estimator — Flag interest potentially deductible (jurisdiction disclaimers).
- [ ] B-4 Inflation-adjusted metrics — Real vs nominal cost outputs.
- [ ] B-5 Graph rendering module — Multi-component stacked payment & balance charts.
- [ ] B-6 Performance micro-bench suite — Guard IRR + large schedules <50ms target.
- [ ] B-7 Accessibility review — ARIA & keyboard flows for blended UI.

## Cross-Cutting Acceptance Definitions

- Schedule completeness: Sum of principal across schedule rows == total principal (±$0.01).
- IRR metric: Monthly cashflows (initial negative principal outflow vs payments) converge tolerance 1e-7 <200 iterations.
- Warning determinism: Each warning has a pure trigger function with unit tests.

## Risk Mitigation

- Commit strategy: Phase boundary commits; all commits keep tests green.
- Transitional flags: Maintain old fields until UI/export updated & documented.
- Export migration: Provide backward mapping for at least one minor release post-change.

## External / Upstream Dependencies

- HELOC engine completion (edge-case tests) prerequisite for P2-2.
- IRR implementation requires stable numeric root-finder (bisect or Newton fallback).

## Immediate Next Pick (Recommendation)

1. Finish P0-8 (assumptions documentation).
2. Begin Phase 1 with P1-1 (additional HELOC modeling) + introduce zero-rate safe branch (un-skip P0-4) in same sequence or immediately after.

---

(Restructured to mirror refinance to‑do style while preserving roadmap content.)
