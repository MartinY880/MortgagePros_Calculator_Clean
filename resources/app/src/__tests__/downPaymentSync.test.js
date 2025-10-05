const { processEdit } = require("../modules/purchase/DownPaymentSync");

function init(pv = 500000, amt = 100000) {
  return {
    propertyValue: pv,
    amount: amt,
    percent: +((amt / pv) * 100).toFixed(2),
    lastSource: "amount",
  };
}

describe("17a Down Payment Sync Scenarios", () => {
  test("Sync1: Edit amount only updates percent after threshold", () => {
    let s = init();
    s = processEdit(s, { field: "amount", value: 110000 });
    expect(s.percent).toBeCloseTo((110000 / 500000) * 100, 2);
    expect(s.lastSource).toBe("amount");
  });
  test("Sync2: Edit percent only updates amount rounding", () => {
    let s = init();
    s = processEdit(s, { field: "percent", value: 25 });
    expect(s.amount).toBe(125000); // 25% of 500k
    expect(s.lastSource).toBe("percent");
  });
  test("Sync3: Rapid alternating edits last direction wins", () => {
    let s = init();
    s = processEdit(s, { field: "amount", value: 120000 });
    s = processEdit(s, { field: "percent", value: 15 });
    expect(s.amount).toBe(75000);
    expect(s.percent).toBe(15);
    expect(s.lastSource).toBe("percent");
  });
  test("Sync4: Tiny amount delta (< $1) ignored", () => {
    let s = init();
    s = processEdit(s, { field: "amount", value: 100000.4 });
    // Round unaffected because delta <1 triggers ignore
    expect(s.percent).toBeCloseTo(20, 2);
  });
  test("Sync5: Tiny percent delta (<0.01%) ignored", () => {
    let s = init();
    s = processEdit(s, { field: "percent", value: 20.003 });
    expect(s.amount).toBe(100000); // unchanged
  });
  test("Sync6: Set percent to 100 clamps to 99.99", () => {
    let s = init();
    s = processEdit(s, { field: "percent", value: 100 });
    expect(s.percent).toBe(99.99);
  });
  test("Sync7: Negative percent clamps to 0 and amount recalcs", () => {
    let s = init();
    s = processEdit(s, { field: "percent", value: -5 });
    expect(s.percent).toBe(0);
    expect(s.amount).toBe(0);
  });
  test("Sync8: Property value change after amount source preserves amount", () => {
    let s = init();
    s.lastSource = "amount";
    s = processEdit(s, { field: "property", value: 600000 });
    expect(s.amount).toBe(100000); // unchanged
    expect(s.percent).toBeCloseTo((100000 / 600000) * 100, 2);
  });
  test("Sync9: Property value change after percent source recalcs amount", () => {
    let s = init();
    s.lastSource = "percent";
    s = processEdit(s, { field: "property", value: 600000 });
    // amount adjusts from percent 20%
    expect(s.amount).toBe(120000);
  });
  test("Sync10: Property value = 0 forces amount & percent to 0 on percent edit", () => {
    let s = init();
    s = processEdit(s, { field: "property", value: 0 });
    s = processEdit(s, { field: "percent", value: 15 });
    expect(s.amount).toBe(0);
    expect(s.percent).toBe(0);
  });
});
