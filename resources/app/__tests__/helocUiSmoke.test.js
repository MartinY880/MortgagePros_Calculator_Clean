/**
 * HELOC UI Smoke Tests (Task 19)
 * Ensures core DOM interactions work end-to-end without deep numeric assertions.
 */

const fs = require("fs");
const path = require("path");

// Load index.html into JSDOM for each test fresh
function loadDom() {
  const html = fs.readFileSync(
    path.join(__dirname, "../src/index.html"),
    "utf8"
  );
  document.documentElement.innerHTML = html;
  // Provide required globals & stubs used by mortgage-calculator.js
  global.window.currentTab = "heloc";
  global.window.uiManager = {
    showNotification: () => {},
    dismissNotification: () => {},
  };
  global.showErrorMessage = (msg) => {
    /* swallow for tests */
  };
}

// Utility to dispatch click events
function click(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  el.dispatchEvent(new window.Event("click", { bubbles: true }));
}

// Basic currency matcher (e.g., $1,234.56 or $0.00)
const currencyRegex = /^\$\d{1,3}(,\d{3})*(\.\d{2})$/;

describe("HELOC UI Smoke", () => {
  beforeEach(() => {
    loadDom();
    // Load script after DOM so it can hook elements
    const scriptPath = path.join(__dirname, "../src/mortgage-calculator.js");
    const scriptContent = fs.readFileSync(scriptPath, "utf8");
    // Execute script in JSDOM context
    eval(scriptContent); // eslint-disable-line no-eval
  });

  test("Invalid input adds error class and summary, then clears after correction & calculates", () => {
    // Provide clearly invalid values first
    document.getElementById("helocPropertyValue").value = "0"; // invalid
    document.getElementById("helocOutstandingBalance").value = "-5"; // invalid negative
    document.getElementById("helocLoanAmount").value = "0"; // invalid
    document.getElementById("helocInterestRate").value = "0"; // invalid
    document.getElementById("helocInterestOnlyPeriod").value = "0"; // invalid
    document.getElementById("helocRepaymentPeriod").value = "0"; // invalid

    click("calculateHelocBtn");

    // Expect error classes applied
    const invalidFields = [
      "helocPropertyValue",
      "helocOutstandingBalance",
      "helocLoanAmount",
      "helocInterestRate",
      "helocInterestOnlyPeriod",
      "helocRepaymentPeriod",
    ];
    let errorCount = 0;
    invalidFields.forEach((id) => {
      const el = document.getElementById(id);
      if (el.classList.contains("is-invalid")) errorCount++;
    });
    expect(errorCount).toBeGreaterThan(0);

    // Accessibility summary should appear (lose visually-hidden)
    const summary = document.getElementById("helocValidationSummary");
    expect(summary).toBeTruthy();
    expect(summary.classList.contains("visually-hidden")).toBe(false);

    // Correct values to a valid scenario
    document.getElementById("helocPropertyValue").value = "500000";
    document.getElementById("helocOutstandingBalance").value = "200000";
    document.getElementById("helocLoanAmount").value = "60000";
    document.getElementById("helocInterestRate").value = "7.25";
    document.getElementById("helocInterestOnlyPeriod").value = "10";
    document.getElementById("helocRepaymentPeriod").value = "20";

    // Simulate user editing triggers removal of individual field error classes if listeners exist
    invalidFields.forEach((id) => {
      const el = document.getElementById(id);
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
    });

    // Now calculate again
    click("calculateHelocBtn");

    // After successful calculation invalid classes should be cleared
    invalidFields.forEach((id) => {
      const el = document.getElementById(id);
      expect(el.classList.contains("is-invalid")).toBe(false);
    });

    // Metrics panel should be visible & populated with formatted currency & percent
    const panel = document.getElementById("helocMetricsPanel");
    expect(panel.style.display).toBe("block");

    const interestOnly = document
      .getElementById("helocMetricInterestOnlyPayment")
      .textContent.trim();
    const repaymentPay = document
      .getElementById("helocMetricRepaymentPayment")
      .textContent.trim();
    const totalInterest = document
      .getElementById("helocMetricTotalInterest")
      .textContent.trim();
    const combinedLtv = document
      .getElementById("helocMetricCombinedLtv")
      .textContent.trim();

    expect(currencyRegex.test(interestOnly)).toBe(true);
    expect(currencyRegex.test(repaymentPay)).toBe(true);
    expect(currencyRegex.test(totalInterest)).toBe(true);
    expect(/%$/.test(combinedLtv)).toBe(true);
  });
});
