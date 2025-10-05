/**
 * Smoke tests for buildFixedLoanSchedule abstraction (Task 19)
 * Run with: node resources/app/src/modules/calculators/scheduleBuilder.smoke.test.js
 */
const { buildFixedLoanSchedule } = require("./ScheduleBuilder");

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function fmt(v) {
  return Number(v.toFixed(2));
}

const scenarios = [
  {
    name: "PMI drops at expected month (80% threshold)",
    input: {
      amount: 300000,
      rate: 6.0,
      term: 30,
      pmi: 150, // monthly PMI
      propertyTax: 300,
      homeInsurance: 100,
      extra: 0,
      appraisedValue: 375000, // LTV start = 0.8 exactly -> PMI should NOT apply (edge) so pmiEndsMonth => 1
      pmiEndRule: 80,
    },
    validate: (res) => {
      assert(
        res.pmiMeta.pmiEndsMonth === 1,
        "Expected pmiEndsMonth = 1 (no PMI charged)"
      );
      assert(res.totals.pmiPaid === 0, "PMI paid should be 0");
    },
  },
  {
    name: "PMI active then terminates (80% threshold)",
    input: {
      amount: 300000,
      rate: 6.0,
      term: 30,
      pmi: 150,
      propertyTax: 300,
      homeInsurance: 100,
      extra: 0,
      appraisedValue: 330000, // starting LTV ~0.909 -> PMI active then should drop later
      pmiEndRule: 80,
    },
    validate: (res) => {
      assert(
        res.pmiMeta.pmiEndsMonth === null || res.pmiMeta.pmiEndsMonth > 1,
        "PMI should either persist or end after month 1"
      );
      assert(res.totals.pmiPaid > 0, "PMI should accumulate before drop");
    },
  },
  {
    name: "Extra payment accelerates payoff",
    input: {
      amount: 250000,
      rate: 5.0,
      term: 30,
      pmi: 0,
      propertyTax: 250,
      homeInsurance: 90,
      extra: 200,
      appraisedValue: 300000,
      pmiEndRule: 80,
    },
    validate: (res) => {
      if (res.baseline) {
        assert(
          res.extraDeltas.interestSaved >= 0,
          "Interest saved should be non-negative"
        );
        assert(
          res.extraDeltas.monthsSaved >= 1,
          "Months saved should be at least 1 with extra payment"
        );
      } else {
        assert(false, "Baseline object missing for extra payment scenario");
      }
    },
  },
  {
    name: "Zero-rate loan linear payoff",
    input: {
      amount: 120000,
      rate: 0,
      term: 15,
      pmi: 0,
      propertyTax: 200,
      homeInsurance: 80,
      extra: 0,
      appraisedValue: 150000,
      pmiEndRule: 80,
    },
    validate: (res) => {
      const monthlyPI = res.monthlyPI;
      const expected = 120000 / (15 * 12);
      assert(
        Math.abs(monthlyPI - expected) < 0.01,
        "Zero-rate monthlyPI mismatch"
      );
      assert(res.totalInterest === 0, "Zero-rate totalInterest should be 0");
    },
  },
];

function run() {
  console.log("Running ScheduleBuilder smoke tests...");
  let passed = 0;
  scenarios.forEach((s) => {
    const result = buildFixedLoanSchedule(s.input);
    try {
      s.validate(result);
      console.log("✔", s.name);
      passed++;
    } catch (e) {
      console.error("✖", s.name, "-", e.message);
      throw e; // stop on first failure
    }
  });
  console.log(`All ${passed}/${scenarios.length} smoke scenarios passed.`);
}

if (require.main === module) {
  run();
}

module.exports = { run };
