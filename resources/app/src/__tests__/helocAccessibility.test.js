/** @jest-environment jsdom */
/**
 * HELOC Accessibility Validation Summary Test (Task 12)
 * Ensures aria-live region reflects validation errors then clears on success.
 */
const path = require("path");
const { loadPurchaseDom } = require("./domTestUtils");

function loadScript() {
  // Use require so mortgage-calculator.js attaches its functions to window / exports
  return require(path.join("..", "mortgage-calculator.js"));
}

describe("HELOC Accessibility Validation Summary", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    // Reuse full index load via existing helper (loads entire HTML including HELOC tab)
    loadPurchaseDom();
    // Stub notifications to minimize noise
    global.showErrorMessage = jest.fn();
    global.showNotification = jest.fn();
    loadScript();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("aria-live region populates on invalid then hides after valid", () => {
    if (typeof window.switchTab === "function") window.switchTab("heloc");
    const summary = document.getElementById("helocValidationSummary");
    expect(summary).toBeTruthy();

    const pv = document.getElementById("helocPropertyValue");
    const bal = document.getElementById("helocOutstandingBalance");
    const amt = document.getElementById("helocLoanAmount");
    const rate = document.getElementById("helocInterestRate");
    const draw = document.getElementById("helocInterestOnlyPeriod");
    const repay = document.getElementById("helocRepaymentPeriod");
    const calcBtn = document.getElementById("calculateHelocBtn");
    expect(calcBtn).toBeTruthy();

    // Invalid scenario to trigger multiple messages
    pv.value = "0"; // invalid home value
    bal.value = "-5"; // invalid mortgage balance
    amt.value = "100000"; // large limit
    rate.value = "0"; // zero rate (allowed but will produce zero-interest flags; still okay)
    draw.value = "10";
    repay.value = "5"; // invalid: repayment shorter than draw

    calcBtn.click();

    expect(summary.classList.contains("visually-hidden")).toBe(false);
    expect(summary.textContent).toMatch(/validation issue/i);
    expect(summary.textContent.length).toBeGreaterThan(10);

    // Now supply valid inputs
    pv.value = "500000";
    bal.value = "200000";
    amt.value = "50000";
    rate.value = "6.5";
    draw.value = "10";
    repay.value = "20";
    calcBtn.click();

    // Summary cleared
    expect(summary.textContent.trim()).toBe("");
    expect(summary.classList.contains("visually-hidden")).toBe(true);
  });
});
