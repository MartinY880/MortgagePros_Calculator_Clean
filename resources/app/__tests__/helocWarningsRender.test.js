/**
 * HELOC Warnings Render Guard
 * Ensures multi-line warning HTML structure (one span per warning) remains stable.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const htmlPath = path.join(__dirname, "../src/index.html");
const html = fs.readFileSync(htmlPath, "utf8");

function loadScript(document, relPath) {
  const abs = path.join(__dirname, "../src", relPath);
  const code = fs.readFileSync(abs, "utf8");
  const script = document.createElement("script");
  script.textContent = code;
  document.body.appendChild(script);
}

describe("HELOC Warnings Render (multi-line)", () => {
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
    global.bootstrap = { Alert: function () {} };
    // Minimal stub to avoid scroll errors
    window.scrollTo = () => {};
    loadScript(document, "mortgage-calculator.js");
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.localStorage;
    jest.resetModules();
  });

  function runHeloc({ propertyValue, balance, amount, rate }) {
    document.getElementById("helocPropertyValue").value = String(propertyValue);
    document.getElementById("helocOutstandingBalance").value = String(balance);
    document.getElementById("helocLoanAmount").value = String(amount);
    document.getElementById("helocInterestRate").value = String(rate);
    document.getElementById("helocInterestOnlyPeriod").value = "10";
    document.getElementById("helocRepaymentPeriod").value = "20";
    document.getElementById("calculateHelocBtn").click();
  }

  test("renders one span per warning and preserves block display", () => {
    // Force both warnings: combined LTV >= 90% and high rate
    runHeloc({
      propertyValue: 500000,
      balance: 400000,
      amount: 50000,
      rate: 17,
    });

    const warnRow = document.getElementById("helocLtvWarningRow");
    expect(warnRow.style.display).toBe("block");
    const container = document.getElementById("helocLtvWarningMsg");
    const spans = Array.from(
      container.querySelectorAll("span.heloc-warning-item")
    );
    expect(spans.length).toBeGreaterThanOrEqual(2); // at least two warnings
    // Validate each span is block-level per inline style
    spans.forEach((s) => {
      expect(s.getAttribute("style")).toMatch(/display:block/);
      expect(s.textContent.trim().length).toBeGreaterThan(0);
    });

    // Lightweight HTML structure assertion (guard against collapsing to single line)
    const inner = container.innerHTML;
    expect(inner.split("<span").length - 1).toBe(spans.length);
  });
});
