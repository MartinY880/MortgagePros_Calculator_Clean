/**
 * refinanceFixedPMI.test.js
 * Verifies ScheduleBuilder fixedMonthlyPMI override logic for refinance path.
 */
const {
  buildFixedLoanSchedule,
} = require("../modules/calculators/ScheduleBuilder");

describe("ScheduleBuilder fixedMonthlyPMI override", () => {
  test("uses fixedMonthlyPMI instead of pmi and drops at threshold", () => {
    const result = buildFixedLoanSchedule({
      amount: 300000,
      rate: 6,
      term: 30,
      pmi: 99999, // bogus large value that should be ignored
      fixedMonthlyPMI: 150, // explicit override
      propertyTax: 0,
      homeInsurance: 0,
      hoa: 0,
      extra: 0,
      appraisedValue: 333000, // LTV ~90% -> PMI starts
      pmiEndRule: 80,
    });
    expect(result.monthlyPMIInput).toBe(150);
    // pmiMeta should reflect same monthly input
    expect(result.pmiMeta.pmiMonthlyInput).toBe(150);
    // Should eventually drop (pmiEndsMonth > 1)
    expect(result.pmiMeta.pmiEndsMonth === 1).toBe(false);
    expect(result.pmiMeta.pmiEndsMonth).toBeGreaterThan(1);
  });

  test("PMI never charged when starting LTV below threshold even with fixedMonthlyPMI", () => {
    const result = buildFixedLoanSchedule({
      amount: 200000,
      rate: 5,
      term: 30,
      pmi: 0,
      fixedMonthlyPMI: 120,
      propertyTax: 0,
      homeInsurance: 0,
      hoa: 0,
      extra: 0,
      appraisedValue: 400000, // 50% LTV
      pmiEndRule: 80,
    });
    expect(result.monthlyPMIInput).toBe(120);
    // pmiEndsMonth = 1 indicates never charged under our semantics
    expect(result.pmiMeta.pmiEndsMonth).toBe(1);
    expect(result.pmiMeta.pmiTotalPaid).toBe(0);
  });
});
