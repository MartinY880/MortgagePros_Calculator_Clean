const { classifyPmiState } = require("../modules/purchase/PMIClassification");

function scenario(pv, dp, rate, threshold = 80) {
  return classifyPmiState({
    propertyValue: pv,
    downPaymentAmount: dp,
    pmiRate: rate,
    threshold,
  });
}

describe("17b LTV / PMI Visibility & 17c Safeguards (pure classification)", () => {
  test("LTV4: Reduce pmiRate to 0 while > threshold -> possible", () => {
    let s1 = scenario(500000, 95000, 0.5); // active
    expect(s1.state).toBe("active");
    let s2 = scenario(500000, 95000, 0); // possible
    expect(s2.state).toBe("possible");
  });
  test("LTV5: Cross threshold with pmiRate >0 -> ignored then clearing rate -> no PMI required", () => {
    const pre = scenario(500000, 95000, 0.5); // active
    expect(pre.state).toBe("active");
    const post = scenario(500000, 100000, 0.5); // LTV 80 -> ignored
    expect(post.state).toBe("ignored");
    const cleared = scenario(500000, 100000, 0); // no PMI required
    expect(cleared.statusText).toMatch(/No PMI Required/);
  });
  test("LTV6: Cash purchase", () => {
    const s = scenario(500000, 500000, 0.6);
    expect(s.statusText).toMatch(/No Loan/);
  });
  test("LTV7: Zero property value pending", () => {
    const s = scenario(0, 0, 0.6);
    expect(s.state).toBe("pending");
  });
  test("LTV8: Threshold 78% vs 80% classification difference", () => {
    const t80 = scenario(500000, 110000, 0.6, 80); // LTV 78% exactly? loan=390k LTV=78 -> ignored or none
    expect(t80.meetsThreshold).toBe(true);
    const t78Active = scenario(500000, 100000, 0.6, 78); // LTV 80% > 78 -> active
    expect(t78Active.state).toBe("active");
  });
  test("PMI2: Cap duplicate prevention scenario conceptual (ignored second classify keeps ignored state)", () => {
    const a = scenario(500000, 100000, 0.6); // ignored
    const b = scenario(500000, 100000, 0.6); // ignored again
    expect(a.state).toBe("ignored");
    expect(b.state).toBe("ignored");
  });
  test("PMI3: Active state baseline", () => {
    const s = scenario(500000, 50000, 0.6); // LTV 90%
    expect(s.state).toBe("active");
  });
  test("PMI5: Active -> ignored -> active cycle", () => {
    const active1 = scenario(500000, 50000, 0.6);
    const ignored = scenario(500000, 100000, 0.6);
    const active2 = scenario(500000, 60000, 0.6);
    expect(active1.state).toBe("active");
    expect(ignored.state).toBe("ignored");
    expect(active2.state).toBe("active");
  });
  test("PMI6: Cash purchase with PMI rate", () => {
    const s = scenario(500000, 500000, 0.6);
    expect(s.statusText).toMatch(/No Loan/);
  });
  test("PMI7: Remove rate while > threshold -> possible", () => {
    const active = scenario(500000, 50000, 0.6);
    expect(active.state).toBe("active");
    const possible = scenario(500000, 50000, 0);
    expect(possible.state).toBe("possible");
  });
});
