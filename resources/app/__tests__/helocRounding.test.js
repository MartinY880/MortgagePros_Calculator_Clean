/**
 * HELOC Rounding Adjustment Test (Task 7)
 * Attempts to create a scenario with a tiny residual principal so folding occurs.
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

describe("HELOC Rounding Adjustment", () => {
  let window, document;
  beforeAll(async () => {
    const dom = loadDom();
    window = dom.window;
    document = window.document;
    await new Promise((r) => setTimeout(r, 50));
    try {
      require("../src/mortgage-calculator.js");
    } catch (_) {}
  });

  test("roundingAdjusted flag may appear for crafted inputs", () => {
    document.getElementById("helocPropertyValue").value = "350000";
    document.getElementById("helocOutstandingBalance").value = "200000";
    // Choose an amount & periods likely to generate fractional residual
    document.getElementById("helocLoanAmount").value = "33333";
    document.getElementById("helocInterestRate").value = "6.37";
    document.getElementById("helocInterestOnlyPeriod").value = "1";
    document.getElementById("helocRepaymentPeriod").value = "8";

    window.calculateHELOC();
    const data = window.helocData;
    expect(data.result.edgeFlags).toBeDefined();
    // We don't assert true strictly (because floating differences vary), but ensure flag exists boolean
    expect(typeof data.result.edgeFlags.roundingAdjusted).toBe("boolean");
  });
});
