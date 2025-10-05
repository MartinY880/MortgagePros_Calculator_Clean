/**
 * HELOC Warnings Test (Task 11)
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

describe("HELOC Warnings", () => {
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

  function runHeloc({ propertyValue, balance, amount, rate }) {
    document.getElementById("helocPropertyValue").value = String(propertyValue);
    document.getElementById("helocOutstandingBalance").value = String(balance);
    document.getElementById("helocLoanAmount").value = String(amount);
    document.getElementById("helocInterestRate").value = String(rate);
    document.getElementById("helocInterestOnlyPeriod").value = "10";
    document.getElementById("helocRepaymentPeriod").value = "20";
    document.getElementById("calculateHelocBtn").click();
  }

  test("shows high rate warning only", () => {
    runHeloc({
      propertyValue: 500000,
      balance: 100000,
      amount: 50000,
      rate: 16,
    });
    const warnRow = document.getElementById("helocLtvWarningRow");
    expect(warnRow.style.display).toBe("block");
    const warnMsg = document.getElementById("helocLtvWarningMsg").innerHTML;
    expect(warnMsg).toMatch(/High Interest Rate/);
    expect(warnMsg).not.toMatch(/High Combined LTV/);
  });

  test("shows both LTV and rate warnings", () => {
    // Set values so combined LTV >= 90%: (400k + 50k)/500k = 90%
    runHeloc({
      propertyValue: 500000,
      balance: 400000,
      amount: 50000,
      rate: 17,
    });
    const warnRow = document.getElementById("helocLtvWarningRow");
    expect(warnRow.style.display).toBe("block");
    const warnMsg = document.getElementById("helocLtvWarningMsg").innerHTML;
    expect(warnMsg).toMatch(/High Combined LTV/);
    expect(warnMsg).toMatch(/High Interest Rate/);
  });

  test("no warnings for nominal scenario", () => {
    runHeloc({
      propertyValue: 600000,
      balance: 200000,
      amount: 50000,
      rate: 6,
    });
    const warnRow = document.getElementById("helocLtvWarningRow");
    // Should be hidden
    expect(warnRow.style.display).toBe("none");
  });
});
