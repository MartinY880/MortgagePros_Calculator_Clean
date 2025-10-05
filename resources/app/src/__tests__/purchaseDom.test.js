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

  test("Structural validation: negative down payment triggers error notification", () => {
    if (typeof window.switchTab === "function") window.switchTab("purchase");
    const dpAmt = document.getElementById("downPaymentAmount");
    const property = document.getElementById("propertyValue");
    const rate = document.getElementById("interestRate");
    const term = document.getElementById("loanTerm");
    property.value = "300000";
    if (term) term.value = "30";
    if (rate) rate.value = "6";
    dpAmt.value = "-5000";
    // Remove any prior invalid class to verify it re-applies
    dpAmt.classList.remove("is-invalid");
    // If helper exposed, clear prior errors
    if (typeof window.clearPurchaseFieldErrors === "function")
      window.clearPurchaseFieldErrors();
    const mc = require("../mortgage-calculator.js");
    if (typeof mc.calculateMortgage === "function")
      mc.calculateMortgage("purchase");
    // Expect notification area to show error referencing Down Payment
    const area = document.getElementById("notificationArea");
    expect(area.style.display).toBe("block");
    const text = document.getElementById("notificationText").textContent;
    expect(text).toMatch(/Down Payment/i);
  });

  test("Down payment sync: editing amount updates percent beyond drift", () => {
    const property = document.getElementById("propertyValue");
    const dpAmt = document.getElementById("downPaymentAmount");
    const dpPct = document.getElementById("downPaymentPercent");
    property.value = "500000";
    dpAmt.value = "75000"; // 15%
    dpAmt.dispatchEvent(new Event("input"));
    // Advance debounce (default 200ms) + small buffer
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
