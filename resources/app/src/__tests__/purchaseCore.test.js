const {
  computePurchaseScenario,
} = require("../modules/purchase/PurchaseLogic");

function near(a, b, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

describe("Purchase Core Scenarios (Task 17 A–G)", () => {
  test("Case A: 20% down → no PMI (pmiEndsMonth=1; pmiTotalPaid=0)", () => {
    const pv = 500000,
      dp = 100000; // 20%
    const { schedule } = computePurchaseScenario({
      propertyValue: pv,
      downPaymentAmount: dp,
      loanTerm: 30,
      interestRate: 6,
      pmiRate: 0.5,
    });
    expect(schedule.pmiMeta.pmiEndsMonth).toBe(1);
    expect(schedule.pmiMeta.pmiTotalPaid).toBe(0);
  });

  test("Case B: 19.9% down → PMI active then drops (pmiEndsMonth > 1)", () => {
    const pv = 500000,
      dp = 99500; // 19.9%
    const { schedule } = computePurchaseScenario({
      propertyValue: pv,
      downPaymentAmount: dp,
      loanTerm: 30,
      interestRate: 6,
      pmiRate: 0.5,
    });
    expect(
      schedule.pmiMeta.pmiEndsMonth === null ||
        schedule.pmiMeta.pmiEndsMonth > 1
    ).toBe(true);
    expect(schedule.pmiMeta.pmiTotalPaid).toBeGreaterThan(0);
  });

  test("Case C: Zero interest + extra → linear payoff & monthsSaved > 0", () => {
    const pv = 240000,
      dp = 0;
    const { schedule } = computePurchaseScenario({
      propertyValue: pv,
      downPaymentAmount: dp,
      loanTerm: 30,
      interestRate: 0,
      pmiRate: 0.6,
      extraPayment: 200,
    });
    // With extra, monthsSaved should exist (extraDeltas.monthsSaved > 0)
    expect(schedule.extraDeltas.monthsSaved).toBeGreaterThan(0);
    // Interest should be 0 in zero-rate baseline and run
    expect(near(schedule.totalInterest, 0)).toBe(true);
  });

  test("Case D: Large extra accelerates payoff; monthsSaved > 0", () => {
    const { schedule } = computePurchaseScenario({
      propertyValue: 300000,
      downPaymentAmount: 60000,
      loanTerm: 30,
      interestRate: 5,
      pmiRate: 0.6,
      extraPayment: 500,
    });
    expect(schedule.extraDeltas.monthsSaved).toBeGreaterThan(0);
    expect(schedule.extraDeltas.interestSaved).toBeGreaterThan(0);
  });

  test("Case E: propertyValue=0 blocked -> loanAmount 0 and pmiEndsMonth=1", () => {
    const { schedule } = computePurchaseScenario({
      propertyValue: 0,
      downPaymentAmount: 0,
      loanTerm: 30,
      interestRate: 5,
      pmiRate: 0.6,
    });
    expect(schedule.amount).toBe(0);
    expect(schedule.pmiMeta.pmiEndsMonth).toBe(1);
  });

  test("Case F: downPayment > propertyValue (overpayment clamps to 0 loan)", () => {
    const { schedule } = computePurchaseScenario({
      propertyValue: 200000,
      downPaymentAmount: 250000,
      loanTerm: 30,
      interestRate: 5,
      pmiRate: 0.6,
    });
    expect(schedule.amount).toBe(0);
    expect(schedule.pmiMeta.pmiEndsMonth).toBe(1);
  });

  test("Case G: PMI Rate entered but LTV <= threshold (PMI ignored)", () => {
    const pv = 500000,
      dp = 100000; // LTV 80% exactly
    const { schedule } = computePurchaseScenario({
      propertyValue: pv,
      downPaymentAmount: dp,
      loanTerm: 30,
      interestRate: 6,
      pmiRate: 0.6,
      pmiEndRule: 80,
    });
    expect(schedule.pmiMeta.pmiEndsMonth).toBe(1);
    expect(schedule.pmiMeta.pmiTotalPaid).toBe(0);
  });
});
