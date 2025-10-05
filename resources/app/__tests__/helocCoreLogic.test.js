/**
 * HELOC Core Logic Unit Tests (Task 16)
 * Covers:
 *  - Short draw + repayment interest math (1 yr draw, 4 yr repay)
 *  - High rate stability & warning (18%)
 *  - Combined LTV boundary cases (<90 no warning, =90 warning, >100 blocked)
 *  - Zero interest (additional assertions beyond edge case file)
 */
const { JSDOM } = require("jsdom");
const path = require("path");
const fs = require("fs");

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

// Utility to spin up a fresh window + calculator script
async function freshWindow() {
  const dom = loadDom();
  const win = dom.window;
  await new Promise((r) => setTimeout(r, 40));
  try {
    require("../src/mortgage-calculator.js");
  } catch (_) {}
  return win;
}

describe("HELOC Core Logic (Task 16)", () => {
  test("Short draw (1y) + 4y repay interest math within tolerance", async () => {
    const window = await freshWindow();
    const doc = window.document;
    // Inputs
    // Principal (credit limit / draw) 20000, rate 8%, draw 1 year, total 5 years => 4 years repay
    doc.getElementById("helocPropertyValue").value = "350000";
    doc.getElementById("helocOutstandingBalance").value = "100000";
    doc.getElementById("helocLoanAmount").value = "20000";
    doc.getElementById("helocInterestRate").value = "8";
    doc.getElementById("helocInterestOnlyPeriod").value = "1";
    doc.getElementById("helocRepaymentPeriod").value = "5"; // total years

    window.calculateHELOC();
    const helocData = window.helocData;
    expect(helocData.result).toBeDefined();
    const {
      totalInterestDrawPhase,
      totalInterestRepayPhase,
      principal,
      schedule,
    } = helocData.result;

    // Expected draw phase interest: principal * annualRate for 1 year (fully drawn assumption)
    const annualRate = 0.08;
    const expectedDrawInterest = principal * annualRate; // 20000 * 0.08 = 1600
    expect(
      Math.abs(totalInterestDrawPhase - expectedDrawInterest)
    ).toBeLessThan(0.25); // allow modest rounding

    // Repayment phase expected interest approximated from amortization formula
    const monthlyRate = annualRate / 12;
    const repayMonths = 4 * 12;
    const payment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, repayMonths)) /
      (Math.pow(1 + monthlyRate, repayMonths) - 1);
    const expectedRepayInterest = payment * repayMonths - principal;
    expect(
      Math.abs(totalInterestRepayPhase - expectedRepayInterest)
    ).toBeLessThan(1.0); // within $1

    // Final schedule row integrity
    const last = schedule[schedule.length - 1];
    expect(last.balance).toBe(0);
  });

  test("High rate (18%) stability & warning", async () => {
    const window = await freshWindow();
    const doc = window.document;
    doc.getElementById("helocPropertyValue").value = "500000";
    doc.getElementById("helocOutstandingBalance").value = "200000";
    doc.getElementById("helocLoanAmount").value = "50000";
    doc.getElementById("helocInterestRate").value = "18"; // triggers rateWarning
    doc.getElementById("helocInterestOnlyPeriod").value = "2";
    doc.getElementById("helocRepaymentPeriod").value = "12"; // 10 years repay

    window.calculateHELOC();
    const r = window.helocData.result;
    expect(r).toBeDefined();
    expect(r.rateWarning).toMatch(/High Interest Rate/);
    expect(r.interestOnlyPayment).toBeGreaterThan(0);
    expect(r.principalInterestPayment).toBeGreaterThan(0);
    expect(Number.isFinite(r.interestOnlyPayment)).toBe(true);
    expect(Number.isFinite(r.principalInterestPayment)).toBe(true);
    // Schedule length check: 2 years draw + 10 repay = 12 * 12 = 144 months
    expect(r.schedule.length).toBe(12 * 12);
  });

  test("Combined LTV boundary: just under 90% => no LTV warning", async () => {
    const window = await freshWindow();
    const doc = window.document;
    doc.getElementById("helocPropertyValue").value = "500000";
    doc.getElementById("helocOutstandingBalance").value = "300000";
    doc.getElementById("helocLoanAmount").value = "149000"; // (300000+149000)/500000=89.8%
    doc.getElementById("helocInterestRate").value = "7";
    doc.getElementById("helocInterestOnlyPeriod").value = "1";
    doc.getElementById("helocRepaymentPeriod").value = "6";

    window.calculateHELOC();
    const r = window.helocData.result;
    expect(r.ltvWarning).toBeFalsy();
    expect(r.warnings.find((w) => w.includes("LTV"))).toBeUndefined();
  });

  test("Combined LTV boundary: exactly 90% => high LTV warning present", async () => {
    const window = await freshWindow();
    const doc = window.document;
    doc.getElementById("helocPropertyValue").value = "500000";
    doc.getElementById("helocOutstandingBalance").value = "300000";
    doc.getElementById("helocLoanAmount").value = "150000"; // 90%
    doc.getElementById("helocInterestRate").value = "7";
    doc.getElementById("helocInterestOnlyPeriod").value = "1";
    doc.getElementById("helocRepaymentPeriod").value = "6";

    window.calculateHELOC();
    const r = window.helocData.result;
    expect(r.ltvWarning).toMatch(/High Combined LTV/);
  });

  test("Combined LTV boundary: over 100% blocks calculation", async () => {
    const window = await freshWindow();
    const doc = window.document;
    doc.getElementById("helocPropertyValue").value = "500000";
    doc.getElementById("helocOutstandingBalance").value = "450000";
    doc.getElementById("helocLoanAmount").value = "80000"; // 106% > 100% => block
    doc.getElementById("helocInterestRate").value = "7";
    doc.getElementById("helocInterestOnlyPeriod").value = "1";
    doc.getElementById("helocRepaymentPeriod").value = "6";

    // Capture previous result reference (should be undefined initially)
    const before = window.helocData.result;
    window.calculateHELOC();
    const after = window.helocData.result;
    // Expect no new structured result created (function returned early)
    // If a prior result existed, it should remain unchanged (=== before)
    expect(after).toBe(before);
  });

  test("Zero interest additional assertions (interestOnlyPayment=0, repayment linear)", async () => {
    const window = await freshWindow();
    const doc = window.document;
    doc.getElementById("helocPropertyValue").value = "300000";
    doc.getElementById("helocOutstandingBalance").value = "150000";
    doc.getElementById("helocLoanAmount").value = "24000";
    doc.getElementById("helocInterestRate").value = "0";
    doc.getElementById("helocInterestOnlyPeriod").value = "1";
    doc.getElementById("helocRepaymentPeriod").value = "5"; // 4 years repay

    window.calculateHELOC();
    const r = window.helocData.result;
    expect(r.interestOnlyPayment).toBe(0);
    expect(r.edgeFlags.zeroInterest).toBe(true);
    const repayRows = r.schedule.filter(
      (p) => p.phase === "Principal & Interest"
    );
    const first = repayRows[0];
    const last = repayRows[repayRows.length - 1];
    // Principal payment should remain constant in zero-interest linear amortization
    expect(
      Math.abs(first.principalPayment - last.principalPayment)
    ).toBeLessThan(0.01);
    expect(last.balance).toBe(0);
  });
});
