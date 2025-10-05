/**
 * HELOC Auto Expand Test
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

describe("HELOC Auto Expand Tabs Section", () => {
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

  test("after calculation tabsSection is visible and summary tab active", () => {
    document.getElementById("helocPropertyValue").value = "500000";
    document.getElementById("helocOutstandingBalance").value = "200000";
    document.getElementById("helocLoanAmount").value = "50000";
    document.getElementById("helocInterestRate").value = "6";
    document.getElementById("helocInterestOnlyPeriod").value = "10";
    document.getElementById("helocRepaymentPeriod").value = "20";
    document.getElementById("calculateHelocBtn").click();

    const tabsSection = document.getElementById("tabsSection");
    expect(tabsSection.style.display).toBe("block");
    const summaryTabBtn = document.getElementById("summary-tab");
    const summaryPane = document.getElementById("summary");
    expect(summaryTabBtn.classList.contains("active")).toBe(true);
    expect(summaryPane.classList.contains("show")).toBe(true);
    expect(summaryPane.classList.contains("active")).toBe(true);
  });
});
