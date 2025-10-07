/**
 * Phase 0 baseline tests for BlendedMortgageCalculator
 * These tests intentionally capture CURRENT behavior (including known flaws)
 * to create a safety net before corrective refactors (Phase 1+).
 */

const BlendedMortgageCalculator = require("../modules/calculators/BlendedMortgageCalculator");

describe("BlendedMortgageCalculator Phase 0 Baseline", () => {
  let calc;
  beforeEach(() => {
    calc = new BlendedMortgageCalculator();
  });

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  test("P0-1 fixed + fixed scenario snapshot", () => {
    const result = calc.calculateBlendedMortgage({
      homeValue: 500000,
      downPayment: 100000,
      firstMortgage: { amount: 300000, rate: 6.0, term: 30 },
      secondMortgage: { amount: 100000, rate: 7.5, type: "fixed", term: 15 },
      additionalComponents: [],
      additionalCosts: { propertyTax: 0, insurance: 0, pmi: 0, other: 0 },
    });

    // Snapshot of key aggregates (round to cents to avoid tiny FP noise)
    const snapshot = {
      first: {
        monthly: round(result.firstMortgage.monthlyPayment),
        totalInterest: round(result.firstMortgage.totalInterest),
        totalPaid: round(result.firstMortgage.totalPaid),
      },
      second: {
        monthly: round(result.secondMortgage.monthlyPayment),
        totalInterest: round(result.secondMortgage.totalInterest),
        totalPaid: round(result.secondMortgage.totalPaid),
      },
      combined: {
        totalMonthlyPayment: round(result.combined.totalMonthlyPayment),
        effectiveBlendedRate: round(result.combined.effectiveBlendedRate),
        totalInterest: round(result.combined.totalInterest),
        totalPaid: round(result.combined.totalPaid),
      },
      ltv: {
        first: round(result.ltv.firstMortgageLTV),
        combined: round(result.ltv.combinedLTV),
      },
    };

    expect(snapshot).toMatchSnapshot();
  });

  test("P0-2 fixed + HELOC scenario snapshot (10/20 assumed)", () => {
    const result = calc.calculateBlendedMortgage({
      homeValue: 600000,
      downPayment: 120000,
      firstMortgage: { amount: 300000, rate: 5.75, term: 30 },
      secondMortgage: { amount: 180000, rate: 8.0, type: "heloc" },
      additionalComponents: [],
      additionalCosts: { propertyTax: 0, insurance: 0, pmi: 0, other: 0 },
    });

    const snapshot = {
      firstMonthly: round(result.firstMortgage.monthlyPayment),
      helocMonthlyInterestOnly: round(result.secondMortgage.monthlyPayment),
      combinedMonthly: round(result.combined.totalMonthlyPayment),
      helocTotalInterest: round(result.secondMortgage.totalInterest),
      helocTotalPaid: round(result.secondMortgage.totalPaid),
      effectiveBlendedRate: round(result.combined.effectiveBlendedRate),
    };

    expect(snapshot).toMatchSnapshot();
  });

  test("P1-1 fixed + HELOC + additional HELOC (two-phase additional HELOC)", () => {
    const result = calc.calculateBlendedMortgage({
      homeValue: 650000,
      downPayment: 150000,
      firstMortgage: { amount: 300000, rate: 6.25, term: 30 },
      secondMortgage: { amount: 100000, rate: 7.25, type: "heloc" },
      additionalComponents: [
        { amount: 50000, rate: 9.0, type: "heloc", term: 10 },
      ],
      additionalCosts: { propertyTax: 0, insurance: 0, pmi: 0, other: 0 },
    });

    const snapshot = {
      baseMonthly: round(result.firstMortgage.monthlyPayment),
      helocMonthly: round(result.secondMortgage.monthlyPayment),
      additionalHelocMonthlyDrawPhase: round(
        result.additionalComponents[0].monthlyPayment
      ),
      combinedMonthly: round(result.combined.totalMonthlyPayment),
      additionalHelocTotalPaid: round(result.additionalComponents[0].totalPaid),
      additionalHelocTotalInterest: round(
        result.additionalComponents[0].totalInterest
      ),
    };

    expect(snapshot).toMatchSnapshot();
  });

  test("P1-3 zero rate edge (was P0-4 pending implementation)", () => {
    const result = calc.calculateBlendedMortgage({
      homeValue: 400000,
      downPayment: 50000,
      firstMortgage: { amount: 200000, rate: 0, term: 20 },
      secondMortgage: { amount: 100000, rate: 6, type: "fixed", term: 15 },
      additionalComponents: [],
      additionalCosts: {},
    });
    // Expected: first mortgage monthly = principal / (term*12)
    const expectedFirstMonthly = round(200000 / (20 * 12));
    expect(round(result.firstMortgage.monthlyPayment)).toBe(
      expectedFirstMonthly
    );
    expect(result.firstMortgage.totalInterest).toBe(0);
  });

  test("P0-5 historical schedule omission characterization (updated post P1-2)", () => {
    // Originally (Phase 0) additional components were omitted from schedule; now included after P1-2.
    calc.calculateBlendedMortgage({
      homeValue: 500000,
      downPayment: 100000,
      firstMortgage: { amount: 250000, rate: 6, term: 30 },
      secondMortgage: { amount: 50000, rate: 7, type: "fixed", term: 15 },
      additionalComponents: [
        { amount: 25000, rate: 8, type: "fixed", term: 10 },
      ],
      additionalCosts: {},
    });
    const schedule = calc.generateBlendedAmortizationSchedule({});
    expect(schedule.length).toBeGreaterThan(0);
    // Invariant now: totalPrincipal row value equals sum of per-component principals (including additional).
    const mismatch = schedule.some((r) => {
      const addSum = (r.additionalComponents || []).reduce(
        (s, c) => s + c.principal,
        0
      );
      return (
        Math.abs(
          r.totalPrincipal -
            (r.firstMortgage.principal + r.secondMortgage.principal + addSum)
        ) > 1e-8
      );
    });
    expect(mismatch).toBe(false);
  });

  test("P0-6 validation boundary LTV", () => {
    // 95% combined LTV should pass
    const ok = calc.calculateBlendedMortgage({
      homeValue: 500000,
      downPayment: 0,
      firstMortgage: { amount: 250000, rate: 5.5, term: 30 },
      secondMortgage: { amount: 225000, rate: 7, type: "fixed", term: 30 },
    });
    expect(ok.combined.totalPrincipal).toBe(475000);

    // 95.01% -> fail (expect error)
    expect(() =>
      calc.calculateBlendedMortgage({
        homeValue: 500000,
        downPayment: 0,
        firstMortgage: { amount: 250000, rate: 5.5, term: 30 },
        secondMortgage: { amount: 225100, rate: 7, type: "fixed", term: 30 },
      })
    ).toThrow(/Combined loan-to-value ratio exceeds 95%/);
  });

  test("P0-7 rounding residue balance tolerance", () => {
    calc.calculateBlendedMortgage({
      homeValue: 550000,
      downPayment: 50000,
      firstMortgage: { amount: 300000, rate: 6.1, term: 30 },
      secondMortgage: { amount: 100000, rate: 7.2, type: "fixed", term: 15 },
      additionalComponents: [],
      additionalCosts: {},
    });
    const schedule = calc.generateBlendedAmortizationSchedule({});
    const last = schedule[schedule.length - 1];
    expect(last.totalRemainingBalance).toBeGreaterThanOrEqual(0);
    // Current engine may leave small residue; ensure not huge
    expect(last.totalRemainingBalance).toBeLessThan(5);
  });

  /**
   * P1-2 (skipped) — schedule should include additional components once implemented.
   * Expectations when unskipped & logic added:
   *  - Combined schedule rows expose `additionalComponents` array (length matches active additional components with balances >0 for that month).
   *  - Each row's `totalPrincipal` == sum(principal of first + second + sum(additionalComponents[i].principal)).
   *  - Final aggregated principal across schedule ≈ total principal (first + second + sum(additional amounts)) within $0.01.
   *  - Result payload gains flag: result.flags.scheduleIncludesAdditional === true.
   *  - No negative interest or principal values; balances monotonically non-increasing per component after its amortization starts.
   */
  test("P1-2 schedule includes additional components", () => {
    const params = {
      homeValue: 600000,
      downPayment: 100000,
      firstMortgage: { amount: 300000, rate: 6.0, term: 30 },
      secondMortgage: { amount: 50000, rate: 7.0, type: "fixed", term: 15 },
      additionalComponents: [
        { amount: 40000, rate: 8.5, type: "fixed", term: 10 },
        {
          amount: 30000,
          rate: 9.0,
          type: "heloc",
          drawMonths: 60,
          repayMonths: 180,
        },
      ],
      additionalCosts: {},
    };
    calc.calculateBlendedMortgage(params);
    const schedule = calc.generateBlendedAmortizationSchedule(params);
    const result = calc.getResults();

    expect(result.flags && result.flags.scheduleIncludesAdditional).toBe(true);
    expect(schedule.length).toBeGreaterThan(0);
    const firstRow = schedule[0];
    expect(firstRow).toHaveProperty("additionalComponents");
    expect(Array.isArray(firstRow.additionalComponents)).toBe(true);
    // Reconciliation: sum of principal across schedule ~= total principal
    const summedPrincipal = schedule.reduce(
      (acc, row) =>
        acc +
        row.firstMortgage.principal +
        row.secondMortgage.principal +
        row.additionalComponents.reduce((s, c) => s + c.principal, 0),
      0
    );
    const expectedPrincipal =
      result.firstMortgage.amount +
      result.secondMortgage.amount +
      result.additionalComponents.reduce((s, c) => s + c.amount, 0);
    expect(Math.abs(summedPrincipal - expectedPrincipal)).toBeLessThan(0.02);

    // Monotonic balance check for each additional component
    const additionalCount = result.additionalComponents.length;
    for (let idx = 0; idx < additionalCount; idx++) {
      let lastBalance = Infinity;
      for (const row of schedule) {
        const comp = row.additionalComponents[idx];
        if (!comp) continue;
        // Allow plateau during draw for HELOC (no principal reduction)
        expect(comp.balance).toBeLessThanOrEqual(lastBalance + 1e-8);
        lastBalance = comp.balance;
      }
      // Final balance ~0
      expect(lastBalance).toBeLessThan(0.02);
    }
  });

  test("P1-4 rounding normalization eliminates residual balances", () => {
    // Choose parameters likely to create fractional cents over long amortization
    calc.calculateBlendedMortgage({
      homeValue: 575000,
      downPayment: 75000,
      firstMortgage: { amount: 310000, rate: 6.13, term: 30 },
      secondMortgage: { amount: 95000, rate: 7.37, type: "fixed", term: 15 },
      additionalComponents: [
        { amount: 42000, rate: 8.11, type: "fixed", term: 12 },
        {
          amount: 18000,
          rate: 9.25,
          type: "heloc",
          drawMonths: 36,
          repayMonths: 144,
        },
      ],
      additionalCosts: {},
    });
    const schedule = calc.generateBlendedAmortizationSchedule({});
    const result = calc.getResults();
    const last = schedule[schedule.length - 1];
    expect(last.totalRemainingBalance).toBe(0);
    // Component-level checks: no component should have residual > 0.01
    const anyComponentResidual = [
      last.firstMortgage.balance,
      last.secondMortgage.balance,
      ...last.additionalComponents.map((c) => c.balance),
    ].some((b) => b > 0.01);
    expect(anyComponentResidual).toBe(false);
    // Flag for normalization should be present
    expect(result.flags && result.flags.normalizationApplied).toBe(true);
    // Sanity: combined principal still reconciles to original amounts
    const summedPrincipal = schedule.reduce(
      (acc, row) => acc + row.totalPrincipal,
      0
    );
    const expectedPrincipal =
      result.firstMortgage.amount +
      result.secondMortgage.amount +
      result.additionalComponents.reduce((s, c) => s + c.amount, 0);
    expect(Math.abs(summedPrincipal - expectedPrincipal)).toBeLessThan(0.05);
  });

  test("P1-5 assumptions & flags exposed", () => {
    const params = {
      homeValue: 480000,
      downPayment: 80000,
      firstMortgage: { amount: 200000, rate: 0, term: 20 }, // zero-rate triggers zeroRateHandled
      secondMortgage: { amount: 120000, rate: 6.5, type: "heloc" },
      additionalComponents: [
        { amount: 30000, rate: 8.25, type: "fixed", term: 10 },
        {
          amount: 20000,
          rate: 9.5,
          type: "heloc",
          drawMonths: 48,
          repayMonths: 180,
        },
      ],
      additionalCosts: {},
    };
    calc.calculateBlendedMortgage(params);
    // Generate schedule to ensure schedule-related flags get added
    calc.generateBlendedAmortizationSchedule(params);
    const results = calc.getResults();
    expect(Array.isArray(results.assumptions)).toBe(true);
    const keys = results.assumptions.map((a) => a.key);
    // Required assumption keys
    [
      "helocPhaseDefaults",
      "effectiveRateMethod",
      "zeroRateHandling",
      "roundingNormalization",
    ].forEach((k) => expect(keys).toContain(k));
    // Flags
    expect(results.flags.zeroRateHandled).toBe(true);
    expect(results.flags.scheduleIncludesAdditional).toBe(true);
    expect(results.flags.normalizationApplied).toBe(true);
  });

  test("P1-6 snapshot assumptions & flags baseline", () => {
    const params = {
      homeValue: 700000,
      downPayment: 140000,
      firstMortgage: { amount: 300000, rate: 6.4, term: 30 },
      secondMortgage: { amount: 120000, rate: 7.1, type: "heloc" }, // default 120/240
      additionalComponents: [
        {
          amount: 60000,
          rate: 8.2,
          type: "heloc",
          drawMonths: 60,
          repayMonths: 180,
        }, // custom phases 60/180
        { amount: 40000, rate: 7.9, type: "fixed", term: 12 },
      ],
      additionalCosts: {},
    };
    calc.calculateBlendedMortgage(params);
    // Ensure schedule flags also present
    calc.generateBlendedAmortizationSchedule(params);
    const results = calc.getResults();
    // Deterministic ordering of assumptions by key
    const assumptions = [...results.assumptions]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ key, value, phase }) => ({ key, value, phase })); // omit rationale from snapshot to avoid verbose churn
    const snapshot = {
      assumptionKeys: assumptions.map((a) => a.key),
      assumptions,
      flags: Object.keys(results.flags)
        .sort()
        .reduce((acc, k) => {
          acc[k] = results.flags[k];
          return acc;
        }, {}),
    };
    expect(snapshot).toMatchSnapshot();
  });
});
