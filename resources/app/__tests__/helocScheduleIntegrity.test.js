/**
 * HELOC Schedule Integrity Tests (Task 17)
 * Verifies:
 *  - Final balance reaches exactly 0 (after clamp / rounding logic)
 *  - Sum of principal payments in repayment phase ~= original principal (within penny)
 *  - Interest-only phase has zero principalPayment and cumulativePrincipal stays 0 until repayment phase starts
 */
const { JSDOM } = require("jsdom");
const path = require("path");
const fs = require("fs");

function loadDom() {
  const htmlPath = path.join(__dirname, "..", "src", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "http://localhost/",
  });
}

async function setupWindow() {
  const dom = loadDom();
  const win = dom.window;
  await new Promise((r) => setTimeout(r, 40));
  try {
    require("../src/mortgage-calculator.js");
  } catch (_) {}
  return win;
}

describe("HELOC Schedule Integrity (Task 17)", () => {
  test("Final balance zero; principal sum matches credit limit; interest-only rows principal=0", async () => {
    const window = await setupWindow();
    const doc = window.document;
    // Use representative inputs (2 year draw, 10 year total => 8 year repay)
    doc.getElementById("helocPropertyValue").value = "425000";
    doc.getElementById("helocOutstandingBalance").value = "200000";
    doc.getElementById("helocLoanAmount").value = "60000"; // principal
    doc.getElementById("helocInterestRate").value = "7.25";
    doc.getElementById("helocInterestOnlyPeriod").value = "2";
    doc.getElementById("helocRepaymentPeriod").value = "10";

    window.calculateHELOC();
    const r = window.helocData.result;
    expect(r).toBeDefined();
    const schedule = r.schedule;
    const principal = r.principal;

    // 1. Final balance zero
    const last = schedule[schedule.length - 1];
    expect(last.balance).toBe(0);

    // 2. Sum principal in repayment phase ~= principal
    const repayPrincipalSum = schedule
      .filter((p) => p.phase === "Principal & Interest")
      .reduce((s, row) => s + (row.principalPayment || 0), 0);
    expect(Math.abs(repayPrincipalSum - principal)).toBeLessThan(0.05);

    // 3. Interest-only rows principalPayment == 0 and cumulativePrincipal stays 0 there
    const interestOnlyRows = schedule.filter(
      (p) => p.phase === "Interest-Only"
    );
    for (const row of interestOnlyRows) {
      expect(row.principalPayment).toBe(0);
      expect(row.cumulativePrincipal).toBe(0);
    }
    // Sanity: first repayment row cumulativePrincipal > 0
    const firstRepay = schedule.find((p) => p.phase === "Principal & Interest");
    expect(firstRepay.cumulativePrincipal).toBeGreaterThan(0);
  });
});
