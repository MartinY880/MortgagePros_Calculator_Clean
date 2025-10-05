/**
 * Unit tests for HelocCalculator pure functions.
 */

const {
  computeRepaymentMonths,
  computeHelocAnalysis,
} = require("../modules/calculators/HelocCalculator");

describe("computeRepaymentMonths", () => {
  it("returns repayment months without adjustment", () => {
    const r = computeRepaymentMonths(20, 5); // 15 years repayment
    expect(r.repaymentMonths).toBe(15 * 12);
    expect(r.adjusted).toBe(false);
  });
  it("auto-adjusts when total equals draw period", () => {
    const r = computeRepaymentMonths(10, 10);
    expect(r.repaymentMonths).toBe(12);
    expect(r.adjusted).toBe(true);
    expect(r.message).toMatch(/auto-extended/);
  });
  it("throws for invalid (total < draw)", () => {
    expect(() => computeRepaymentMonths(5, 6)).toThrow();
  });
});

describe("computeHelocAnalysis", () => {
  it("produces schedule and totals for standard case", () => {
    const result = computeHelocAnalysis({
      propertyValue: 400000,
      outstandingBalance: 200000,
      helocAmount: 50000,
      interestRate: 7.5,
      drawPeriodYears: 5,
      totalTermYears: 20,
    });
    expect(Array.isArray(result.schedule)).toBe(true);
    expect(result.schedule.length).toBeGreaterThan(0);
    expect(result.payments.interestOnlyPayment).toBeGreaterThan(0);
    expect(result.totals.totalInterest).toBeGreaterThan(0);
  });
  it("handles zero-interest linear amortization with flag", () => {
    const result = computeHelocAnalysis({
      propertyValue: 300000,
      outstandingBalance: 100000,
      helocAmount: 60000,
      interestRate: 0,
      drawPeriodYears: 2,
      totalTermYears: 10,
    });
    expect(result.edgeFlags.zeroInterest).toBe(true);
    // Interest-only payment should be 0 at zero rate
    expect(result.payments.interestOnlyPayment).toBe(0);
  });
});
