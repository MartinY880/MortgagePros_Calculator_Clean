/**
 * Simplified static smoke test: verify integration signatures in source without executing full DOM.
 */
const fs = require("fs");
const path = require("path");
function assert(c, m) {
  if (!c) throw new Error("Assertion failed: " + m);
}
const file = path.join(__dirname, "..", "..", "mortgage-calculator.js");
const src = fs.readFileSync(file, "utf8");
let start = src.indexOf("function calculateMortgage");
if (start === -1) start = 0;
let endMarkerIndex = src.indexOf("saveCalculationToHistory");
if (endMarkerIndex === -1) endMarkerIndex = start + 6000; // broader window
const calcSection = src.slice(start, endMarkerIndex);
// Debug output (trimmed)
console.log("--- calcSection snippet start ---");
console.log(calcSection.split("\n").slice(0, 120).join("\n"));
console.log("--- calcSection snippet end ---");
const hasBuilderCall = /buildFixedLoanSchedule\(\s*builderInput\s*\)/.test(src);
assert(hasBuilderCall, "Global search: builder schedule build call missing");
assert(
  /tabData\.builderResult\s*=\s*builderResult/.test(src),
  "Global search: tabData.builderResult assignment missing"
);
assert(
  !/Calculate monthly principal and interest payment/.test(src),
  "Legacy monthly PI block still present (comment)"
);
console.log("[mortgageTabs.builder.smoke.test] PASS (static)");
