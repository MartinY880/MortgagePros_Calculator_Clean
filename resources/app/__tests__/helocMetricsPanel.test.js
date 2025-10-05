/**
 * HELOC Metrics Panel Test (Task 10)
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const htmlPath = path.join(__dirname, "../src/index.html");
const html = fs.readFileSync(htmlPath, "utf-8");

function loadScript(document, relPath) {
  const abs = path.join(__dirname, "../src", relPath);
  const code = fs.readFileSync(abs, "utf-8");
  const script = document.createElement("script");
  script.textContent = code;
  document.body.appendChild(script);
}

describe("HELOC Metrics Panel", () => {
  let window, document;
  beforeEach(() => {
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      resources: "usable",
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;
    global.localStorage = window.localStorage;
    // Notification area stub
    const notificationArea = document.createElement("div");
    notificationArea.id = "notificationArea";
    notificationArea.style.display = "none";
    notificationArea.innerHTML = '<div id="notificationMessage"></div>';
    document.body.appendChild(notificationArea);
    global.bootstrap = { Alert: function () {} };
    loadScript(document, "mortgage-calculator.js");
  });
  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.localStorage;
    jest.resetModules();
  });

  test("populates metrics after valid HELOC calculation", () => {
    // Provide valid inputs
    document.getElementById("helocPropertyValue").value = "500000";
    document.getElementById("helocOutstandingBalance").value = "200000";
    document.getElementById("helocLoanAmount").value = "50000";
    document.getElementById("helocInterestRate").value = "6";
    document.getElementById("helocInterestOnlyPeriod").value = "10";
    document.getElementById("helocRepaymentPeriod").value = "20";

    // Trigger calculation
    const btn = document.getElementById("calculateHelocBtn");
    btn.click();

    const panel = document.getElementById("helocMetricsPanel");
    expect(panel.style.display).toBe("block");

    const combined = document.getElementById(
      "helocMetricCombinedLtv"
    ).textContent;
    expect(combined).toMatch(/%$/);

    const intOnly = document.getElementById(
      "helocMetricInterestOnlyPayment"
    ).textContent;
    expect(intOnly).toMatch(/\$/);

    const remainingEquity = document.getElementById(
      "helocMetricPostDrawEquity"
    ).textContent;
    expect(remainingEquity).toMatch(/\$/);
  });

  test("applies LTV state class thresholds", () => {
    const runScenario = (loanAmount, expectedClass) => {
      document.getElementById("helocPropertyValue").value = "500000";
      document.getElementById("helocOutstandingBalance").value = "200000";
      document.getElementById("helocLoanAmount").value = String(loanAmount);
      document.getElementById("helocInterestRate").value = "6";
      document.getElementById("helocInterestOnlyPeriod").value = "10";
      document.getElementById("helocRepaymentPeriod").value = "20";
      document.getElementById("calculateHelocBtn").click();
      const ltvEl = document.getElementById("helocMetricCombinedLtv");
      expect(ltvEl.classList.contains(expectedClass)).toBe(true);
    };
    // Combined LTV formula: (outstanding + loanAmount)/property *100
    // With property=500k, outstanding=200k
    // loanAmount 100k => (200+100)/500 = 60% => low
    runScenario(100000, "ltv-state-low");
    // loanAmount 150k => (200+150)/500 = 70% => medium boundary
    runScenario(150000, "ltv-state-medium");
    // loanAmount 260k => (200+260)/500 = 92% => high
    runScenario(260000, "ltv-state-high");
  });
});
