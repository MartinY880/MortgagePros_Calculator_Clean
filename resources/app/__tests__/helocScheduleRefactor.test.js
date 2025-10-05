/**
 * HELOC Schedule Refactor Tests (Task 6)
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

describe("HELOC Schedule Refactor", () => {
  let window, document;
  beforeAll(async () => {
    const dom = loadDom();
    window = dom.window;
    document = window.document;
    // Allow scripts to load
    await new Promise((r) => setTimeout(r, 50));
    try {
      require("../src/mortgage-calculator.js");
    } catch (_) {}
  });

  test("Phase totals and cumulative fields exist and sum correctly", () => {
    document.getElementById("helocPropertyValue").value = "400000";
    document.getElementById("helocOutstandingBalance").value = "250000";
    document.getElementById("helocLoanAmount").value = "50000";
    document.getElementById("helocInterestRate").value = "7";
    document.getElementById("helocInterestOnlyPeriod").value = "2"; // 2 yrs draw
    document.getElementById("helocRepaymentPeriod").value = "12"; // total 12 yrs (10 yrs repay typical)

    window.calculateHELOC();

    const data = window.helocData;
    expect(data.result.phaseTotals).toBeDefined();
    const schedule = data.result.schedule;
    const { phaseTotals } = data.result;

    const drawRows = schedule.filter((r) => r.phase === "Interest-Only");
    const repayRows = schedule.filter(
      (r) => r.phase === "Principal & Interest"
    );

    const calcDrawInterest = drawRows.reduce(
      (s, r) => s + r.interestPayment,
      0
    );
    const calcRepayInterest = repayRows.reduce(
      (s, r) => s + r.interestPayment,
      0
    );

    expect(
      Math.abs(calcDrawInterest - phaseTotals.interestOnly.interest)
    ).toBeLessThan(0.01);
    expect(
      Math.abs(calcRepayInterest - phaseTotals.repayment.interest)
    ).toBeLessThan(0.01);

    // Final cumulativePrincipal should equal original principal (within penny)
    const last = schedule[schedule.length - 1];
    expect(Math.abs(last.cumulativePrincipal - 50000)).toBeLessThan(0.05);
    // Final balance zero
    expect(last.balance).toBe(0);
  });
});
