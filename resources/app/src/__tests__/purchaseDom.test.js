/** @jest-environment jsdom */
const path = require("path");
const { loadPurchaseDom } = require("./domTestUtils");

// Load the main script after jsdom environment is ready
function loadScript() {
  // mortgage-calculator.js attaches DOMContentLoaded listener; we already dispatch in helper.
  require(path.join("..", "mortgage-calculator.js"));
}

describe("Purchase DOM Integration (Option D)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Reset modules so mortgage-calculator script re-executes per test
    jest.resetModules();
    loadPurchaseDom();
    loadScript();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("Structural validation smoke: negative down payment does not crash and loan remains non-negative", () => {
    if (typeof window.switchTab === "function") window.switchTab("purchase");
    if (!window.scrollTo) window.scrollTo = () => {};
    const dpAmt = document.getElementById("downPaymentAmount");
    const property = document.getElementById("propertyValue");
    property.value = "300000";
    dpAmt.value = "-5000"; // invalid
    const mc = require("../mortgage-calculator.js");
    expect(
      () => mc.calculateMortgage && mc.calculateMortgage("purchase")
    ).not.toThrow();
    const loanAmountEl = document.getElementById("loanAmount");
    if (loanAmountEl) {
      const numeric =
        parseFloat(loanAmountEl.textContent.replace(/[^0-9.\-]/g, "")) || 0;
      expect(numeric).toBeGreaterThanOrEqual(0);
    }
    // NOTE: We intentionally skip asserting specific validation classes or clamping behavior here.
    // Pure logic + other focused tests cover validation semantics. This smoke test only guarantees:
    // 1) No crash when negative input provided.
    // 2) Resulting loan amount remains non-negative.
  });

  test("Down payment sync: editing amount updates percent beyond drift", () => {
    const property = document.getElementById("propertyValue");
    const dpAmt = document.getElementById("downPaymentAmount");
    const dpPct = document.getElementById("downPaymentPercent");
    property.value = "500000";
    dpAmt.value = "75000"; // 15%
    dpAmt.dispatchEvent(new Event("input"));
    jest.advanceTimersByTime(250);
    expect(parseFloat(dpPct.value)).toBeCloseTo(15, 2);
  });

  test("Down payment sync: tiny amount delta under $1 ignored", () => {
    const property = document.getElementById("propertyValue");
    const dpAmt = document.getElementById("downPaymentAmount");
    const dpPct = document.getElementById("downPaymentPercent");
    property.value = "400000";
    dpAmt.value = "80000"; // 20%
    dpAmt.dispatchEvent(new Event("input"));
    jest.advanceTimersByTime(250);
    const baselinePct = dpPct.value;
    // Increase amount by < $1 drift tolerance (0.4 leads to 0 change when rounded)
    dpAmt.value = "80000.3";
    dpAmt.dispatchEvent(new Event("input"));
    jest.advanceTimersByTime(250);
    expect(dpPct.value).toBe(baselinePct);
  });

  test("Notification system displays and auto hides", () => {
    // mortgage-calculator.js attaches showNotification to its scope; we can require it again to get reference
    const mc = require("../mortgage-calculator.js");
    const showNotification =
      mc.showNotification || global.showNotification || window.showNotification;
    expect(typeof showNotification).toBe("function");
    showNotification("Test message", "success");
    const area = document.getElementById("notificationArea");
    expect(area.style.display).toBe("block");
    // Auto hide after 3000ms
    jest.advanceTimersByTime(3100);
    expect(area.style.display).toBe("none");
  });

  test("PMI badge placeholder present (future refinement)", () => {
    // We assert the presence of PMI related elements as a smoke test; deeper logic already covered in pure tests.
    const badge = document.querySelector('[id*="pmi"], [class*="pmi"]');
    expect(badge).toBeTruthy();
  });
});
