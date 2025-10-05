/**
 * warningsHarness.test.js (Task 21)
 * Exercises inline warning generation rules indirectly by reproducing the logic in isolation.
 * We copy the minimal portion of buildComparisonWarnings to avoid DOM dependency.
 * Run: node resources/app/src/modules/calculators/warningsHarness.test.js
 */
function assert(c, m) {
  if (!c) throw new Error(m);
}

// Simplified warning generator mirroring mortgage-calculator.js buildComparisonWarnings behavior
function buildWarnings(calculations) {
  const warnings = [];
  ["A", "B", "C"].forEach((letter) => {
    const calc = calculations[letter];
    if (!calc) return;
    const name = calc.name || `Option ${letter}`;
    const pmiEnds = calc.pmiMeta?.pmiEndsMonth; // null => Never, 1 => No PMI
    const startingLTV = calc.calculations?.startingLTV;
    const hasAppraised = typeof startingLTV === "number" && startingLTV > 0;
    const monthlyPMIInput = calc.pmiMeta?.pmiMonthlyInput || 0;
    if (monthlyPMIInput > 0 && pmiEnds == null) {
      warnings.push(
        `${name}: PMI never drops (consider larger down payment or new appraisal).`
      );
    }
    if (monthlyPMIInput > 0 && !hasAppraised) {
      warnings.push(
        `${name}: Appraised value missing — cannot evaluate PMI termination; treated as persistent.`
      );
    }
    if (monthlyPMIInput > 0 && pmiEnds === 1) {
      warnings.push(
        `${name}: PMI provided but starting LTV below threshold; charge ignored.`
      );
    }
    if (
      calc.extraPayment > 0 &&
      calc.extraDeltas &&
      calc.extraDeltas.interestSaved <= 0
    ) {
      warnings.push(
        `${name}: Extra payment yields no measurable interest savings (likely too small or loan nearly paid off).`
      );
    }
  });
  return warnings;
}

function fabricateCalcs() {
  return {
    // A: PMI persists full term (Rule 1)
    A: {
      name: "Loan A",
      pmiMeta: { pmiMonthlyInput: 150, pmiEndsMonth: null },
      calculations: { startingLTV: 0.95 },
      extraPayment: 0,
    },
    // B: Missing appraisal while PMI provided (Rule 2)
    B: {
      name: "Loan B",
      pmiMeta: { pmiMonthlyInput: 120, pmiEndsMonth: null },
      calculations: {},
      extraPayment: 0,
    },
    // C: PMI provided but LTV below threshold so ignored (Rule 3) + extra payment no savings (Rule 4)
    C: {
      name: "Loan C",
      pmiMeta: { pmiMonthlyInput: 100, pmiEndsMonth: 1 },
      calculations: { startingLTV: 0.78 },
      extraPayment: 50,
      extraDeltas: { interestSaved: 0 },
    },
  };
}

function run() {
  console.log("Running warnings harness test...");
  const calcs = fabricateCalcs();
  calcs.A.pmiMeta.pmiEndsMonth = null; // persists full term
  calcs.B.pmiMeta.pmiEndsMonth = null; // persists & missing appraisal
  calcs.C.pmiMeta.pmiEndsMonth = 1; // no PMI due to low LTV
  const warnings = buildWarnings(calcs);
  console.log("Warnings produced:", warnings.length);
  warnings.forEach((w) => console.log(" -", w));
  // Validate each rule fired at least once
  const contains = (substr) => warnings.some((w) => w.includes(substr));
  assert(contains("PMI never drops"), "Missing rule: PMI never drops");
  assert(
    contains("Appraised value missing"),
    "Missing rule: Appraised value missing"
  );
  assert(
    contains("PMI provided but starting LTV below threshold"),
    "Missing rule: PMI provided but starting LTV below threshold"
  );
  assert(
    contains("Extra payment yields no measurable interest savings"),
    "Missing rule: extra payment no savings"
  );
  console.log("All warning rule presence tests passed.");
}

if (require.main === module) run();

module.exports = { run };
