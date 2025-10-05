/**
 * HELOC Inline Validation UI tests
 * Verifies that validation errors are mapped to fields with .is-invalid & feedback divs
 * and that typing clears them (lightweight clear behavior).
 */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

// Load index.html similar to other DOM tests (purchaseDom.test etc.)
const htmlPath = path.join(__dirname, "../src/index.html");
const html = fs.readFileSync(htmlPath, "utf-8");

let window, document, exported;

function loadScriptIntoDom(scriptPath) {
  const code = fs.readFileSync(scriptPath, "utf-8");
  const scriptEl = document.createElement("script");
  scriptEl.textContent = code;
  document.body.appendChild(scriptEl);
}

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
  // Provide minimal stubs used by calculator
  global.localStorage = window.localStorage;
  // Notification area required
  const notificationArea = document.createElement("div");
  notificationArea.id = "notificationArea";
  notificationArea.style.display = "none";
  notificationArea.innerHTML = '<div id="notificationMessage"></div>';
  document.body.appendChild(notificationArea);

  // Provide showNotification dependencies (Bootstrap replacement minimal)
  global.bootstrap = { Alert: function () {} };

  // Load calculator script after DOM is ready
  const scriptPath = path.join(__dirname, "../src/mortgage-calculator.js");
  loadScriptIntoDom(scriptPath);
  exported = require("../src/mortgage-calculator.js");
});

afterEach(() => {
  delete global.window;
  delete global.document;
  delete global.navigator;
  delete global.localStorage;
  jest.resetModules();
});

function triggerCalculateHeloc() {
  const btn = document.getElementById("calculateHelocBtn");
  // Fallback: directly call global calculateHELOC if not wired
  if (btn) {
    // Try dispatching click (event listener set in main script)
    btn.click();
  } else if (typeof window.calculateHELOC === "function") {
    window.calculateHELOC();
  }
}

// Many validation messages use natural language; set values to trigger multiple failures.
// We assert mapping for a subset of known messages.

describe("HELOC Inline Validation", () => {
  test("displays inline errors and clears on input", () => {
    // Intentionally invalid baseline values already present (propertyValue=0 etc.)
    // Trigger calculation
    triggerCalculateHeloc();

    // Expect at least property value and loan amount errors
    const pvInput = document.getElementById("helocPropertyValue");
    const loanInput = document.getElementById("helocLoanAmount");
    expect(pvInput.classList.contains("is-invalid")).toBe(true);
    expect(
      pvInput.parentElement.querySelector(
        ".invalid-feedback[data-heloc-inline]"
      )
    ).not.toBeNull();

    expect(loanInput.classList.contains("is-invalid")).toBe(true);

    // Simulate user correcting property value
    pvInput.value = "500000";
    pvInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(pvInput.classList.contains("is-invalid")).toBe(false);
    expect(
      pvInput.parentElement.querySelector(
        ".invalid-feedback[data-heloc-inline]"
      )
    ).toBeNull();
  });
});
