# HELOC Refactor & Engine Integration Roadmap

## Completed Tasks

1. Export bridge for schedules
2. CSV column parity improvements
3. PDF phase breakdown export
4. Core logic invariant tests
5. Schedule integrity tests
6. Export snapshot tests
7. UI smoke tests (fixed mortgage)
8. UI smoke tests (HELOC basic)
9. Warning rendering improvements
10. Accessibility summary region
11. Edge flags & messages metadata
12. Report exporter integration
13. HELOC UI smoke tests (extended)
14. Multi-line warnings render guard
15. Unified engine hook (Task 20): Added `buildHelocTwoPhaseSchedule` in `ScheduleBuilder.js`, integrated guarded adoption inside `calculateHELOC`, created parity test (`helocEngineHook.test.js`) validating aggregate interest, principal totals, phase counts, and final balance within tolerances.

## Pending / Next

16. Task 21: Extract dedicated `HelocCalculator.js` leveraging engine builder; migrate validation orchestration & schedule assembly; introduce pure functions for:
    - computeRepaymentMonths (with adjustment + flag)
    - buildHelocResult (wraps builder + phase/interest totals + edge flags)
    - deriveWarnings (LTV, zero-interest, rounding, repayment adjust)
      Preserve current UI contract (`helocData` structure) while isolating DOM side-effects. Maintain temporary fallback to legacy `generateHelocAmortizationSchedule` until post-migration parity tests pass, then remove legacy generator.
