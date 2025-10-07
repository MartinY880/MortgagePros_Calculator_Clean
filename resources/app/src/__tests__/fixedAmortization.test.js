const {
  computeFixedAmortization,
} = require("../modules/calculators/amortization/FixedAmortization");

describe("computeFixedAmortization (P2-1)", () => {
  test("standard 30y fixed 6% produces positive interest and full payoff", () => {
    const res = computeFixedAmortization({
      principal: 300000,
      annualRate: 6,
      termMonths: 360,
    });
    expect(res.schedule.length).toBeGreaterThan(300); // 30y schedule length
    const last = res.schedule[res.schedule.length - 1];
    expect(last.remainingBalance).toBeCloseTo(0, 2);
    expect(res.totals.totalPrincipal).toBeCloseTo(300000, 2);
    expect(res.totals.totalInterest).toBeGreaterThan(0);
  });

  test("zero rate amortizes linearly with zero interest", () => {
    const res = computeFixedAmortization({
      principal: 12000,
      annualRate: 0,
      termMonths: 24,
    });
    expect(res.flags.zeroRate).toBe(true);
    expect(res.totals.totalInterest).toBe(0);
    const avgPrincipal = res.totals.totalPrincipal / res.schedule.length;
    // All principal payments either base amount or final adjusted
    const distinct = Array.from(
      new Set(res.schedule.map((r) => r.principalPayment.toFixed(2)))
    );
    expect(distinct.length).toBeLessThanOrEqual(2);
    const last = res.schedule[res.schedule.length - 1];
    expect(last.remainingBalance).toBe(0);
  });

  test("residual normalization absorbs small remainder", () => {
    // Force a crafted scenario by using custom payment slightly low so a residual remains then normalized
    const base = computeFixedAmortization({
      principal: 10000,
      annualRate: 5,
      termMonths: 24,
    });
    // Use a custom payment trimmed by 0.02 to leave a small residual <5
    const adjustedPayment = base.monthlyPayment - 0.02;
    const res = computeFixedAmortization({
      principal: 10000,
      annualRate: 5,
      termMonths: 24,
      payment: adjustedPayment,
    });
    const last = res.schedule[res.schedule.length - 1];
    expect(last.remainingBalance).toBe(0);
    expect(res.flags.normalizationApplied).toBe(true);
    expect(res.totals.totalPrincipal).toBeCloseTo(10000, 1); // small tolerance because of manipulation
  });
});
