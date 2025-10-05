const {
  buildFixedLoanSchedule,
} = require("../modules/calculators/ScheduleBuilder");
const fs = require("fs");
const path = require("path");

// Canonical refinance scenario:
// Refinance $310k (original property value 400k) at 5.85%, 30 yrs, fixedMonthlyPMI 130 (drops), tax 400, insurance 95, extra 150.
// We simulate financed costs by simply using the higher amount; PMI should drop before full term.
function canonicalRefiInput() {
  return {
    amount: 310000,
    rate: 5.85,
    term: 30,
    pmi: 0, // use fixed override instead
    fixedMonthlyPMI: 130,
    propertyTax: 400,
    homeInsurance: 95,
    hoa: 0,
    extra: 150,
    appraisedValue: 400000, // LTV 77.5% -> actually below 80 so PMI should NOT charge; adjust to trigger PMI
    pmiEndRule: 80,
  };
}

// Adjust so PMI actually applies: we lower appraised value to push LTV above 80%
function canonicalRefiInputWithPMI() {
  const base = canonicalRefiInput();
  base.appraisedValue = 360000; // LTV ~86.1% so PMI starts
  return base;
}

function collectRefiMetrics(result) {
  return {
    amount: result.amount,
    rate: result.rate,
    term: result.term,
    monthlyPI: +result.monthlyPI.toFixed(2),
    monthlyPMIInput: +result.monthlyPMIInput.toFixed(2),
    totalInterest: +result.totalInterest.toFixed(2),
    payoffMonths: result.payoffTime.totalMonths,
    pmiEndsMonth: result.pmiMeta.pmiEndsMonth,
    pmiTotalPaid: +result.pmiMeta.pmiTotalPaid.toFixed(2),
    interestSavedWithExtra: result.extraDeltas
      ? +result.extraDeltas.interestSaved.toFixed(2)
      : null,
    monthsSaved: result.extraDeltas ? result.extraDeltas.monthsSaved : null,
  };
}

const SNAPSHOT_PATH = path.join(__dirname, "refinance.snapshot.json");

describe("Task 22 Refinance Snapshot Regression", () => {
  test("matches canonical refinance metrics snapshot", () => {
    const input = canonicalRefiInputWithPMI();
    const result = buildFixedLoanSchedule(input);
    const metrics = collectRefiMetrics(result);
    if (!fs.existsSync(SNAPSHOT_PATH)) {
      fs.writeFileSync(
        SNAPSHOT_PATH,
        JSON.stringify({ v: 1, metrics }, null, 2)
      );
      console.warn("Refinance snapshot file created. Re-run tests to enforce.");
      return; // first run creates snapshot
    }
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
    const snap = snapshot.metrics;
    const tolerance = 0.01;
    const floatFields = [
      "monthlyPI",
      "monthlyPMIInput",
      "totalInterest",
      "pmiTotalPaid",
      "interestSavedWithExtra",
    ];
    Object.keys(metrics).forEach((key) => {
      if (
        floatFields.includes(key) &&
        metrics[key] !== null &&
        snap[key] !== null
      ) {
        expect(Math.abs(metrics[key] - snap[key])).toBeLessThanOrEqual(
          tolerance
        );
      } else {
        expect(metrics[key]).toBe(snap[key]);
      }
    });
  });
});
