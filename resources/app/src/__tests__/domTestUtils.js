const fs = require("fs");
const path = require("path");

// Provide minimal ipcRenderer stub so mortgage-calculator.js can require("electron") safely.
jest.mock("electron", () => ({
  ipcRenderer: {
    on: () => {},
    invoke: () => Promise.resolve({ response: 0 }),
    send: () => {},
  },
}));

function loadPurchaseDom() {
  // index.html resides one level up from __tests__ (../index.html)
  const htmlPath = path.join(__dirname, "..", "index.html");
  const raw = fs.readFileSync(htmlPath, "utf8");
  // Extract only the purchase form region to reduce parse cost (optional). For now load full.
  document.documentElement.innerHTML = raw;
  // Manually dispatch DOMContentLoaded to trigger initialization in mortgage-calculator.js
  const evt = new window.Event("DOMContentLoaded", {
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(evt);
}

module.exports = { loadPurchaseDom };
