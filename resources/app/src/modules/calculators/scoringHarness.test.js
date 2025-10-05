/**
 * Scoring harness (Task 21 partial) to validate determineBestLoan logic outside DOM.
 * Run: node resources/app/src/modules/calculators/scoringHarness.test.js
 */
const { buildFixedLoanSchedule } = require("./ScheduleBuilder");
const { determineBestLoan, EvaluationModes } = require("./ScoringEngine");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Adapter to call ScoringEngine (expects array)
function pickBest(calcs, mode) {
  return determineBestLoan(calcs, mode);
}

const tests = [
  {
    name: "Mode totalOutOfPocket chooses lower lifetime cash (A)",
    run: () => {
      // Construct explicit scenario: A lower tax big difference, B slightly lower rate but very high tax so A still wins
      const A = buildFixedLoanSchedule({
        amount: 300000,
        rate: 6.0,
        term: 30,
        pmi: 0,
        propertyTax: 250,
        homeInsurance: 100,
        extra: 0,
        appraisedValue: 360000,
        pmiEndRule: 80,
      });
      const B = buildFixedLoanSchedule({
        amount: 300000,
        rate: 5.875,
        term: 30,
        pmi: 0,
        propertyTax: 450,
        homeInsurance: 100,
        extra: 0,
        appraisedValue: 360000,
        pmiEndRule: 80,
      });
      const C = buildFixedLoanSchedule({
        amount: 300000,
        rate: 6.05,
        term: 30,
        pmi: 0,
        propertyTax: 300,
        homeInsurance: 100,
        extra: 0,
        appraisedValue: 360000,
        pmiEndRule: 80,
      });
      const best = pickBest([A, B, C], EvaluationModes.TOTAL_OUT_OF_POCKET);
      // Diagnostic (optional): uncomment to view totals
      // console.log('OOP', A.totals.totalOutOfPocket, B.totals.totalOutOfPocket, C.totals.totalOutOfPocket);
      assert(best === A, "Expected A as best for totalOutOfPocket");
    },
  },
  {
    name: "Mode principalInterest chooses loan with lowest PI cost (B)",
    run: () => {
      const A = buildFixedLoanSchedule({
        amount: 300000,
        rate: 6.0,
        term: 30,
        pmi: 0,
        propertyTax: 300,
        homeInsurance: 100,
        extra: 0,
        appraisedValue: 360000,
        pmiEndRule: 80,
      });
      const B = buildFixedLoanSchedule({
        amount: 300000,
        rate: 5.8,
        term: 30,
        pmi: 0,
        propertyTax: 380,
        homeInsurance: 100,
        extra: 0,
        appraisedValue: 360000,
        pmiEndRule: 80,
      });
      const C = buildFixedLoanSchedule({
        amount: 300000,
        rate: 6.05,
        term: 30,
        pmi: 0,
        propertyTax: 250,
        homeInsurance: 100,
        extra: 0,
        appraisedValue: 360000,
        pmiEndRule: 80,
      });
      const best = pickBest([A, B, C], EvaluationModes.PRINCIPAL_INTEREST);
      assert(best === B, "Expected B for principalInterest");
    },
  },
  {
    name: "Mode payoffSpeed chooses fastest payoff (C with extra)",
    run: () => {
      const A = buildFixedLoanSchedule({
        amount: 300000,
        rate: 6.0,
        term: 30,
        pmi: 0,
        propertyTax: 300,
        homeInsurance: 100,
        extra: 0,
        appraisedValue: 360000,
        pmiEndRule: 80,
      });
      const B = buildFixedLoanSchedule({
        amount: 300000,
        rate: 5.9,
        term: 30,
        pmi: 0,
        propertyTax: 320,
        homeInsurance: 100,
        extra: 0,
        appraisedValue: 360000,
        pmiEndRule: 80,
      });
      const C = buildFixedLoanSchedule({
        amount: 300000,
        rate: 6.1,
        term: 30,
        pmi: 0,
        propertyTax: 300,
        homeInsurance: 100,
        extra: 200,
        appraisedValue: 360000,
        pmiEndRule: 80,
      });
      const best = pickBest([A, B, C], EvaluationModes.PAYOFF_SPEED);
      assert(best === C, "Expected C for payoffSpeed");
    },
  },
  {
    name: "Tie-breaker stability when equal metrics defaults to first",
    run: () => {
      // Make identical clones except ordering
      const base = buildFixedLoanSchedule({
        amount: 100000,
        rate: 5,
        term: 30,
        pmi: 0,
        propertyTax: 200,
        homeInsurance: 80,
        extra: 0,
        appraisedValue: 150000,
        pmiEndRule: 80,
      });
      const clone = JSON.parse(JSON.stringify(base));
      const best = pickBest([base, clone], EvaluationModes.TOTAL_OUT_OF_POCKET);
      assert(best === base, "Expected first loan retained on complete tie");
    },
  },
  {
    name: "Tie-break chain: same primary (PI mode) but lower totalOutOfPocket wins",
    run: () => {
      // Construct two loans with identical totalCostPI but different escrow causing totalOutOfPocket difference
      const L1 = buildFixedLoanSchedule({
        amount: 200000,
        rate: 5.5,
        term: 30,
        pmi: 0,
        propertyTax: 300,
        homeInsurance: 100,
        extra: 0,
        appraisedValue: 250000,
        pmiEndRule: 80,
      });
      const L2 = buildFixedLoanSchedule({
        amount: 200000,
        rate: 5.5,
        term: 30,
        pmi: 0,
        propertyTax: 400, // higher tax makes higher out-of-pocket
        homeInsurance: 0, // reduce insurance so PI same but total OO different
        extra: 0,
        appraisedValue: 250000,
        pmiEndRule: 80,
      });
      // Force same PI numbers by keeping principal/rate/term same.
      // Under principalInterest mode, primary scores equal; tie-break #1 should choose lower totalOutOfPocket => L1.
      const best = pickBest([L1, L2], EvaluationModes.PRINCIPAL_INTEREST);
      assert(best === L1, "Expected L1 via tie-break on totalOutOfPocket");
    },
  },
];

(function run() {
  console.log("Running scoring harness tests...");
  let pass = 0;
  tests.forEach((t) => {
    t.run();
    console.log("✔", t.name);
    pass++;
  });
  console.log(`All ${pass}/${tests.length} scoring tests passed.`);
})();
