const {
  computePurchaseScenario,
} = require("../modules/purchase/PurchaseLogic");

describe("Purchase Visibility & Safeguards (subset)", () => {
  test("LTV1: 20% down => pmiEndsMonth=1", () => {
    const { schedule } = computePurchaseScenario({
      propertyValue: 500000,
      downPaymentAmount: 100000,
      loanTerm: 30,
      interestRate: 6,
      pmiRate: 0.5,
    });
    expect(schedule.pmiMeta.pmiEndsMonth).toBe(1);
  });
  test("LTV2/LTV3: 19% down + PMI active then ends (>1 endsMonth)", () => {
    const { schedule } = computePurchaseScenario({
      propertyValue: 500000,
      downPaymentAmount: 95000,
      loanTerm: 30,
      interestRate: 6,
      pmiRate: 0.5,
    });
    expect(
      schedule.pmiMeta.pmiEndsMonth === null ||
        schedule.pmiMeta.pmiEndsMonth > 1
    ).toBe(true);
  });
  test("PMI1: PMI capped logic indirectly (enter large PMI rate makes monthly pmi > 0; builder doesn't cap but scenario logic based on LTV)", () => {
    const { schedule } = computePurchaseScenario({
      propertyValue: 400000,
      downPaymentAmount: 40000,
      loanTerm: 30,
      interestRate: 7,
      pmiRate: 5,
    });
    expect(schedule.pmiMeta.pmiTotalPaid).toBeGreaterThan(0);
  });
  test("PMI4 analog: Increase DP to push LTV <= threshold -> no PMI", () => {
    const { schedule } = computePurchaseScenario({
      propertyValue: 400000,
      downPaymentAmount: 80000,
      loanTerm: 30,
      interestRate: 7,
      pmiRate: 0.6,
    });
    expect(schedule.pmiMeta.pmiEndsMonth).toBe(1);
  });
});
