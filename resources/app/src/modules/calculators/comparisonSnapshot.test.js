/**
 * comparisonSnapshot.test.js (Task 21)
 * Validates stable structural outputs (PMI termination month & scoring winners) against snapshot JSON.
 * Run: node resources/app/src/modules/calculators/comparisonSnapshot.test.js
 */
const fs = require("fs");
const path = require("path");
const { buildFixedLoanSchedule } = require("./ScheduleBuilder");
const { determineBestLoan, EvaluationModes } = require("./ScoringEngine");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const snapshotPath = path.join(
  __dirname,
  "__snapshots__",
  "comparison.snapshot.json"
);
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

function runPmiScenario() {
  const spec = snapshot.scenarios.pmiDropExample;
  const loan = buildFixedLoanSchedule(spec.input);
  const actual = loan.pmiMeta?.pmiEndsMonth;
  assert(
    actual === spec.expected.pmiEndsMonth,
    `PMI termination month mismatch: expected ${spec.expected.pmiEndsMonth} got ${actual}`
  );
}

function runWinnerDeterminism() {
  // Fabricate three deterministic loans for each mode
  const baseInputs = {
    amount: 250000,
    term: 30,
    appraisedValue: 300000,
    pmiEndRule: 80,
  };
  // L1: lowest combined escrow + moderate rate => target winner OOP
  const L1 = buildFixedLoanSchedule({
    ...baseInputs,
    rate: 6.0,
    pmi: 0,
    propertyTax: 180,
    homeInsurance: 50,
    extra: 0,
  });
  // L2: clearly lower rate => winner for PI, but high escrow to lose OOP
  const L2 = buildFixedLoanSchedule({
    ...baseInputs,
    rate: 5.5,
    pmi: 0,
    propertyTax: 500,
    homeInsurance: 210,
    extra: 0,
  });
  // L3: fastest payoff via extra, worse rate & higher escrow so not OOP or PI winner
  const L3 = buildFixedLoanSchedule({
    ...baseInputs,
    rate: 6.8,
    pmi: 0,
    propertyTax: 420,
    homeInsurance: 190,
    extra: 120,
  });
  const loans = [L1, L2, L3];

  const bestOOP = determineBestLoan(loans, EvaluationModes.TOTAL_OUT_OF_POCKET);
  const bestPI = determineBestLoan(loans, EvaluationModes.PRINCIPAL_INTEREST);
  const bestSpeed = determineBestLoan(loans, EvaluationModes.PAYOFF_SPEED);

  // Debug (can be commented out later)
  // console.log('Debug OOP', L1.totals.totalOutOfPocket, L2.totals.totalOutOfPocket, L3.totals.totalOutOfPocket);
  // console.log('Debug PI', L1.totals.totalCostPI, L2.totals.totalCostPI, L3.totals.totalCostPI);
  assert(bestOOP === L1, "Expected L1 best for totalOutOfPocket");
  // Expect L2 wins PI due to lower rate 5.85
  assert(bestPI === L2, "Expected L2 best for principalInterest");
  // Expect L3 fastest payoff due to extra
  assert(bestSpeed === L3, "Expected L3 best for payoffSpeed");
}

function run() {
  console.log("Running comparison snapshot tests...");
  runPmiScenario();
  console.log("✔ PMI termination snapshot");
  runWinnerDeterminism();
  console.log("✔ Winner determinism scenarios");
  console.log("All snapshot tests passed.");
}

if (require.main === module) run();

module.exports = { run };
