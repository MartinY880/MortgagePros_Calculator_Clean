const {
  buildFixedLoanSchedule,
} = require("../modules/calculators/ScheduleBuilder");
const fs = require("fs");
const path = require("path");

// Canonical scenario: 30yr, 6%, 500k property, 15% down, PMI 0.5%, taxes 500/mo, insurance 120/mo, HOA 0, extra 200.
function canonicalInput() {
  const propertyValue = 500000;
  const downPayment = propertyValue * 0.15; // 75,000
  const loanAmount = propertyValue - downPayment; // 425,000
  const pmiRate = 0.5; // annual percent
  const monthlyPMI = (pmiRate / 100 / 12) * loanAmount; // only charged while LTV > threshold
  return {
    amount: loanAmount,
    rate: 6,
    term: 30,
    pmi: monthlyPMI,
    propertyTax: 500,
    homeInsurance: 120,
    hoa: 0,
    extra: 200,
    appraisedValue: propertyValue,
    pmiEndRule: 80,
  };
}

function collectMetrics(result) {
  return {
    amount: result.amount,
    rate: result.rate,
    term: result.term,
    monthlyPI: +result.monthlyPI.toFixed(2),
    monthlyPMIInput: +result.monthlyPMIInput.toFixed(2),
    baseMonthlyPaymentNoPMI: +result.baseMonthlyPaymentNoPMI.toFixed(2),
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

const SNAPSHOT_PATH = path.join(__dirname, "purchase.snapshot.json");

describe("Task 18 Snapshot Regression", () => {
  test("matches canonical metrics snapshot", () => {
    const input = canonicalInput();
    const result = buildFixedLoanSchedule(input);
    const metrics = collectMetrics(result);
    if (!fs.existsSync(SNAPSHOT_PATH)) {
      fs.writeFileSync(
        SNAPSHOT_PATH,
        JSON.stringify({ v: 1, metrics }, null, 2)
      );
      console.warn("Snapshot file created. Re-run tests to enforce.");
      return; // first run just writes
    }
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
    const snap = snapshot.metrics;
    // Compare exact for integer / structural, and small tolerance for monetary rounding if needed
    const tolerance = 0.01;
    const floatFields = [
      "monthlyPI",
      "monthlyPMIInput",
      "baseMonthlyPaymentNoPMI",
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
