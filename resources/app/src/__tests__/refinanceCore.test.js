/**
 * refinanceCore.test.js
 * Core refinance scenarios for unified engine (Task 22 - part of Todo 6)
 */
const {
  buildFixedLoanSchedule,
} = require("../modules/calculators/ScheduleBuilder");

describe("Refinance Core Scenarios (Task 22)", () => {
  test("PMI active then drops (fixedMonthlyPMI override)", () => {
    const result = buildFixedLoanSchedule({
      amount: 300000,
      rate: 5.75,
      term: 30,
      pmi: 0,
      fixedMonthlyPMI: 140, // override
      propertyTax: 0,
      homeInsurance: 0,
      hoa: 0,
      extra: 0,
      appraisedValue: 330000, // LTV ~90.9% > 80%
      pmiEndRule: 80,
    });
    expect(result.pmiMeta.pmiMonthlyInput).toBe(140);
    expect(result.pmiMeta.pmiEndsMonth).toBeGreaterThan(1);
    expect(result.pmiMeta.pmiTotalPaid).toBeGreaterThan(0);
  });

  test("PMI never charged when starting LTV already below threshold", () => {
    const result = buildFixedLoanSchedule({
      amount: 200000,
      rate: 6,
      term: 30,
      pmi: 0,
      fixedMonthlyPMI: 200,
      propertyTax: 0,
      homeInsurance: 0,
      hoa: 0,
      extra: 0,
      appraisedValue: 300000, // LTV 66.7% < 80%
      pmiEndRule: 80,
    });
    expect(result.pmiMeta.pmiEndsMonth).toBe(1);
    expect(result.pmiMeta.pmiTotalPaid).toBe(0);
  });

  test("Extra payment accelerates payoff", () => {
    const base = buildFixedLoanSchedule({
      amount: 250000,
      rate: 6,
      term: 30,
      pmi: 0,
      fixedMonthlyPMI: 0,
      propertyTax: 0,
      homeInsurance: 0,
      hoa: 0,
      extra: 0,
      appraisedValue: 400000,
      pmiEndRule: 80,
    });
    const accel = buildFixedLoanSchedule({
      amount: 250000,
      rate: 6,
      term: 30,
      pmi: 0,
      fixedMonthlyPMI: 0,
      propertyTax: 0,
      homeInsurance: 0,
      hoa: 0,
      extra: 500, // monthly extra
      appraisedValue: 400000,
      pmiEndRule: 80,
    });
    expect(accel.payoffTime.totalMonths).toBeLessThan(
      base.payoffTime.totalMonths
    );
    expect(accel.extraDeltas).not.toBeNull();
    expect(accel.extraDeltas.monthsSaved).toBeGreaterThan(0);
    expect(accel.extraDeltas.interestSaved).toBeGreaterThan(0);
  });

  test("Financed closing costs increase total interest", () => {
    const base = buildFixedLoanSchedule({
      amount: 300000,
      rate: 5.5,
      term: 30,
      pmi: 0,
      fixedMonthlyPMI: 0,
      propertyTax: 0,
      homeInsurance: 0,
      hoa: 0,
      extra: 0,
      appraisedValue: 450000,
      pmiEndRule: 80,
    });
    const financed = buildFixedLoanSchedule({
      amount: 305000, // base + 5k financed costs
      rate: 5.5,
      term: 30,
      pmi: 0,
      fixedMonthlyPMI: 0,
      propertyTax: 0,
      homeInsurance: 0,
      hoa: 0,
      extra: 0,
      appraisedValue: 450000,
      pmiEndRule: 80,
    });
    expect(financed.totalInterest).toBeGreaterThan(base.totalInterest);
    // Added interest should be sensible (>0 and < principal added * term) — loose sanity check
    const addedInterest = financed.totalInterest - base.totalInterest;
    expect(addedInterest).toBeGreaterThan(1000); // certainly > 1k over 30 yrs
  });
});
