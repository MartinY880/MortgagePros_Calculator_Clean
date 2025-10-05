/**
 * HELOC Edge Case Tests
 * - Zero interest rate linear amortization
 * - Balance clamp residual
 */

const { JSDOM } = require("jsdom");
const path = require("path");
const fs = require("fs");

// Helper to load the app's HTML & script similar to purchase preset test approach
function loadDom() {
  const htmlPath = path.join(__dirname, "..", "src", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "http://localhost/",
  });
  return dom;
}

describe("HELOC Edge Cases", () => {
  let dom;
  let window;
  beforeAll(async () => {
    dom = loadDom();
    window = dom.window;
    // Wait a tick for scripts (mortgage-calculator.js) to attach if loaded via HTML script tags
    await new Promise((r) => setTimeout(r, 50));
    // In case module exports not automatically attached, require the script directly
    try {
      require("../src/mortgage-calculator.js");
    } catch (_) {}
  });

  test("Zero interest rate produces linear principal amortization and zero interest-only payment", () => {
    const doc = window.document;
    // Populate HELOC inputs
    doc.getElementById("helocPropertyValue").value = "300000";
    doc.getElementById("helocOutstandingBalance").value = "200000";
    doc.getElementById("helocLoanAmount").value = "30000";
    doc.getElementById("helocInterestRate").value = "0";
    doc.getElementById("helocInterestOnlyPeriod").value = "1"; // 1 year draw
    doc.getElementById("helocRepaymentPeriod").value = "6"; // total 6 years => 5 years repay

    // Trigger calculation
    window.calculateHELOC();

    // Access helocData via global
    const helocData = window.helocData || global.helocData;
    expect(helocData).toBeDefined();
    expect(helocData.result).toBeDefined();
    const {
      interestOnlyPayment,
      principalInterestPayment,
      edgeFlags,
      schedule,
    } = helocData.result;

    expect(interestOnlyPayment).toBe(0);
    expect(edgeFlags.zeroInterest).toBe(true);

    // Repayment months should be (6-1)*12 = 60; linear principalPayment approx principal/60
    const repaymentRows = schedule.filter(
      (r) => r.phase === "Principal & Interest"
    );
    const firstRepay = repaymentRows[0];
    const lastRepay = repaymentRows[repaymentRows.length - 1];
    const expectedLinearPayment = 30000 / 60;
    // Payment and principal should match (no interest)
    expect(Math.abs(firstRepay.payment - expectedLinearPayment)).toBeLessThan(
      0.01
    );
    expect(firstRepay.interestPayment || firstRepay.interest || 0).toBeCloseTo(
      0,
      5
    );
    expect(lastRepay.balance).toBe(0); // clamped
  });
});
