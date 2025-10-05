# Purchase Tab — Prioritized To‑Do Roadmap

Updated: 2025-10-05
Scope: ONLY the Purchase tab (form `#mortgageForm`). Goal: strengthen correctness, transparency, and maintainability while avoiding scope bleed into other tabs.

---

## Priority 1 – Core Accuracy & Integrity (Do These First)

1. Validation: Structural Inputs
   - [x] Block if `propertyValue <= 0`.
   - [x] Block if `downPaymentAmount > propertyValue` (prevents negative loan amount).
   - [x] Block if `loanTerm <= 0` or unreasonably high (warn if > 50 yrs, block if 0).
   - [x] Block if `interestRate < 0` (allow 0%).
   - [x] Ensure 0 ≤ `downPaymentPercent` < 100.
2. Down Payment Sync (Amount ↔ Percent)
   - [x] Debounced bidirectional sync (200ms implemented).
   - [x] Round amount to nearest dollar; percent to two decimals.
   - [x] Prevent oscillation: ignore updates causing < $1 or <0.01% delta.
   - [x] Reconcile mismatch: last edited source determines recalculation direction.
   - [x] Clamp percent <0 → 0, ≥100 → 99.99 (validation still flags invalid ≥100 on calculate).
   - [x] Blur forces immediate sync (flush debounce).
   - [x] Add dedicated sync test scenarios (see Priority 4 test expansion) (Sync1–Sync10 complete in logic tests).
3. Origination LTV + PMI Eligibility Visibility
   - [x] Compute & display origination LTV (badge with dynamic classes).
   - [x] Show status: “PMI Active” / “PMI Entered (Not Charged)” / “PMI Possible (Rate Blank)” / “No Loan (Cash Purchase)” / “No PMI”.
   - [x] Dynamic recolor bands (good/borderline/high, cash, pending).
   - [x] Auto-update on relevant field edits (property value, down payment, percent, PMI rate, rule).
   - [x] Transition notification when PMI state changes (info toast).
4. PMI Input Safeguards
   - [x] Cap `pmiRate` at 5% (hard clamp + one-time info notification).
   - [x] Warning if `pmiRate > 0` but LTV ≤ threshold (ignored) with one-time state entry notification.
   - [x] Helper text clarifying formula (added under input).
   - [x] Realtime alignment with validation warnings (PMI_HIGH, PMI_IGNORED).
5. Unified Schedule Source
   - [x] Replace legacy `generateAmortizationSchedule` usage for purchase tab with snapshot derived from `builderResult` (avoid drift & duplicate logic).
   - [x] Ensure displayed first payment equals snapshot row 1 (includes PI + PMI (if active) + escrow + HOA + extra).
   - [x] Charts consume `purchaseData.amortizationData` (no regeneration required).
   - [x] Remove dead legacy purchase schedule path (refinance still uses legacy function until migrated).
6. Extra Payment Metrics Exposure
   - [x] Add “Interest Saved (Extra)” + “Payoff Accelerated” rows (use `builderResult.extraDeltas`).
   - [x] Hide rows (or show em dash) when `extraPayment == 0` (implemented via conditional display: rows hidden when no extra or no baseline deltas).
7. Rounding & Consistency Check
   - [x] Assert |(computed monthly payment) – (displayed)| < $0.01. (console warning logs if exceeded)
   - [x] Base monthly (no extra) row appears only when extra > 0 (hidden dynamically when extra = 0).

---

## Priority 2 – Validation UX & Clarity

8. Inline Error Presentation
   - [x] Add `.is-invalid` + `.invalid-feedback` per required field (helpers added).
   - [x] Clear errors on valid edit (input listeners strip invalid state + feedback).
   - [x] Aggregate summary (optional) if >2 errors (concise joined message).
   - [ ] Live single-field validation (non-blocking preview) before calculate (optional enhancement).
9. Dynamic PMI Messaging
   - [x] Live badge when down payment ≥ 20% (or LTV ≤ selected rule) → shows “No PMI Required” when no rate entered.
   - [x] Non-blocking inline warning when PMI Rate entered but ignored (LTV below threshold) — auto-clears on state change.
10. HOA Transparency

- [x] Tooltip: “HOA not included in total cost metrics (decision pending).”
- [x] Style differentiation if excluded.

11. Persist PMI Rule Selection

- [x] Save `pmiEndRule` (80/78) to localStorage; restore on load.

12. Accessibility & Semantics

- [x] Ensure all labels have `for` mapping; add aria descriptions for PMI & extra sections.
- [x] Confirm numeric fields use `inputmode` and proper type fallback.

---

## Priority 3 – Cost & Transparency Enhancements

13. PMI Termination Display

- [x] Add “PMI Ends” line: Month N | “N/A (No PMI)” | “Never”. (Rules: `pmiEndsMonth=1` => N/A, null => Never.)

14. HOA Cost Treatment Decision

- [x] Option A: Integrate HOA into totals (added to builder totals: hoaPaid, included in totalOutOfPocket & monthly payments).
- [ ] Option B: Keep excluded; rename row “Total Out-of-Pocket (Excl. HOA)” (DEFERRED – superseded by Option A decision).
- [x] Implement chosen path consistently (UI wording & scoring now include HOA; exclusion tooltip removed).

15. PMI Timeline Tooltip

- [x] Tooltip shows: Starting LTV, Threshold (80/78), Drop Month, Total PMI Paid, Status (Not Charged / Drops / Active – Never Drops).

16. Edge Input Guardrails

- [x] Soft confirm if `propertyValue < 10000`.
- [x] Warn if `loanTerm > 50` (still allow unless unrealistic policy adopted).
- [x] Warn if `extraPayment > monthly PI * 5` (sanity check).

---

## Priority 4 – Testing & Regression Safety

17. Edge Harness (purchaseHarness.test.js)

- [x] Case A: 20% down → no PMI (pmiEndsMonth=1; pmiTotalPaid=0).
- [x] Case B: 19.9% down → PMI active then drops (pmiEndsMonth > 1).
- [x] Case C: Zero interest + extra → linear payoff & valid monthsSaved.
- [x] Case D: Large extra accelerates payoff; monthsSaved > 0 & no negative rounding issues.
- [x] Case E: propertyValue=0 blocked (loanAmount=0 path normalized to pmiEndsMonth=1).
- [x] Case F: downPaymentAmount > propertyValue blocked (normalized to loanAmount=0, pmiEndsMonth=1).
- [x] Case G: PMI Rate entered but LTV ≤ threshold → PMI ignored (pmiEndsMonth=1; pmiTotalPaid=0).
- [ ] Remaining: integrate DOM-level validation assertions & warning notification triggers (future enhancement) (DEFERRED).

17a. Down Payment Sync Scenarios (to incorporate or keep separate):

- [x] Sync1: Edit amount only → percent updates after threshold (logic sim of debounce).
- [x] Sync2: Edit percent only → amount updates (whole dollars) after threshold.
- [x] Sync3: Rapid alternating edits (amount then percent) → last edit direction wins (no oscillation).
- [x] Sync4: Tiny amount delta (< $1) does not update percent field.
- [x] Sync5: Tiny percent delta (< 0.01%) does not update amount field.
- [x] Sync6: Set percent to 100 → clamps to 99.99 then validation would flag on calculate if exceeded.
- [x] Sync7: Set negative percent (e.g., -5) → coerced to 0 and recomputed amount = 0.
- [x] Sync8: propertyValue changed after amount set → percent recalculates correctly preserving amount (last source = amount).
- [x] Sync9: propertyValue changed after percent set → amount recalculates (last source = percent).
- [x] Sync10: propertyValue = 0 while editing percent → amount forced to 0; percent resets to 0 on next amount edit.

17b. LTV / PMI Visibility Scenarios:

- [x] LTV1: propertyValue=500000, dp=100000 (20%) → pmiEndsMonth=1 path (logic test).
- [x] LTV2: propertyValue=500000, dp=95000 (19%) → PMI active path (logic test).
- [x] LTV3: Same as LTV2 with pmiRate=0.5 → PMI active (logic test combined with LTV2).
- [x] LTV4: Reduce pmiRate to 0 while still > threshold → possible (pure logic test).
- [x] LTV5: Cross threshold with pmiRate > 0 → ignored then clearing rate → No PMI Required (pure logic test).
- [x] LTV6: Cash purchase (dp = propertyValue) classification (pure logic test).
- [x] LTV7: propertyValue=0 → pending state (pure logic test).
- [x] LTV8: Threshold 78% vs 80% classification difference (pure logic test).

17c. PMI Safeguards Scenarios:

- [x] PMI1: High PMI rate path at/near cap indirectly validated (logic)—UI notification still pending.
- [x] PMI2: Repeated ignored classification (duplicate state stability) (pure logic test).
- [x] PMI3: Active state baseline (pure logic test).
- [x] PMI4: LTV crosses below threshold -> no PMI charged (logic).
- [x] PMI5: Active → ignored → active cycle (pure logic test).
- [x] PMI6: Cash purchase with PMI rate (pure logic test).
- [x] PMI7: Remove rate while > threshold → possible (pure logic test).

18. Snapshot Regression (purchase.snapshot.json)

- [x] Assert canonical scenario metrics: pmiEndsMonth, payoff total months, interestSaved, monthsSaved stable (locked baseline).
- [x] Exclude volatile totals (snapshot omits full volatile cost categories).

---

## Priority 5 – Documentation & Maintainability

19. README Update (Purchase Section)

- [x] Document purchase-specific flow: down payment sync, PMI gating, extra acceleration, HOA treatment.

20. Inline Code Docs

- [x] Add JSDoc for purchase calculation block (builderInput contract + PMI gating logic).

21. Changelog Prep (Next Version)

- [x] Enumerate new validation, PMI visibility, and metrics improvements for release notes (CHANGELOG.md created).

22. Refinance Unification (Completed in v16.3.0)

- [x] Migrate refinance path to unified `ScheduleBuilder` (legacy `generateAmortizationSchedule` now deprecated; retained only for backward compatibility bannered in code).
- [x] Normalize PMI calculation for refinance using canonical `pmiMeta` semantics (shared logic with purchase; identical `pmiEndsMonth` interpretation).
- [x] Closing costs & cash‑out adjustments routed through pre-builder normalization; final principal fed into builder consistently.
- [x] Reconcile refinance-specific outputs (financed costs, savings) and surfaced via exporter (PDF + CSV) using `builderResult` metrics.
- [x] Regression tests: core refinance scenarios (PMI lifecycle, extra payment acceleration, financed costs) plus snapshot (`refinanceSnapshot.test.js`) established.
- [x] Added `fixedMonthlyPMI` override path (drops at threshold; still yields unified PMI lifecycle metrics).

Remaining (Deferred / Optional):

- [x] Additional refinance DOM smoke coverage (minimal smoke tests added; relaxed assertions to avoid brittleness; future tightening optional).
- [ ] Extended exporter formatting tests (logic verified indirectly by snapshot + core tests).

---

## Optional / Future Backlog

- Payoff Goal Solver (compute extra needed for target payoff date).
- Cumulative cost chart (stacked PI / PMI / escrow / HOA).
- Real-time “What-if” slider (adjust extra; update payoff & savings live pre-calc commit).
- Down payment preset buttons (5%, 10%, 15%, 20%). (Implemented)
- PMI sensitivity: show savings crossing 78% vs 80% rule choice.
- Locale / currency toggle.
- Export enhancement: PMI timeline & acceleration summary page.

---

## Acceptance Criteria (Phase 1 = Priority 1 + 2)

- Invalid structural inputs blocked with clear inline feedback.
- Monthly payment display matches computed schedule snapshot (≤ $0.01 variance).
- PMI never charged when origination LTV ≤ threshold; correct drop month when charged.
- Interest Saved & Months Saved visible when extra > 0 and accurate.
- Down payment fields remain synchronized (drift tolerances: < $1 / <0.02%).
- User understands whether HOA is included (tooltip present) and PMI status at a glance.

---

## Notes

Tackle tasks strictly in numerical order unless a dependency (e.g., Task 5 relies on builder snapshot utility) requires a minor reorder.
