/**
 * purchaseSchedule.unified.test.js
 * Tests for unified purchase schedule snapshot derived from buildFixedLoanSchedule (Task 5)
 * Run with: node resources/app/src/modules/calculators/purchaseSchedule.unified.test.js
 */
const { buildFixedLoanSchedule } = require("./ScheduleBuilder");

function assert(cond, msg) {
  if (!cond) throw new Error("Assertion failed: " + msg);
}

function buildDisplayScheduleFromBuilder(builderResult, loanData) {
  const { amount, rate, term, extra, propertyTax, homeInsurance } = loanData;
  const schedule = [];
  const monthlyRate = rate / 100 / 12;
  const monthlyPI = builderResult.monthlyPI;
  let balance = amount;
  const totalPayments = term * 12;
  let month = 0;
  const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
  while (balance > 0.01 && month < totalPayments) {
    month++;
    let interest = monthlyRate === 0 ? 0 : balance * monthlyRate;
    let principal = monthlyRate === 0 ? monthlyPI : monthlyPI - interest;
    interest = round2(interest);
    principal = round2(principal);
    if (monthlyRate !== 0) {
      const roundedPI = round2(interest + principal);
      const scheduledPI = round2(monthlyPI);
      const delta = scheduledPI - roundedPI;
      if (Math.abs(delta) >= 0.01) principal = round2(principal + delta);
    }
    // PMI uses pmiMeta: pmiEndsMonth is first PMI-FREE month (or 1 if never applied)
    let pmiCharge = 0;
    if (
      builderResult.monthlyPMIInput > 0 &&
      builderResult.pmiMeta.pmiEndsMonth !== 1
    ) {
      if (
        builderResult.pmiMeta.pmiEndsMonth === null ||
        month < builderResult.pmiMeta.pmiEndsMonth
      ) {
        pmiCharge = builderResult.monthlyPMIInput;
      }
    }
    let extraPay = extra || 0;
    if (principal + extraPay > balance) {
      extraPay = Math.max(0, balance - principal);
    }
    balance = round2(balance - (principal + extraPay));
    schedule.push({
      paymentNumber: month,
      payment: round2(
        principal +
          extraPay +
          interest +
          pmiCharge +
          propertyTax +
          homeInsurance
      ),
      principal: round2(principal + extraPay),
      interest: interest,
      pmi: pmiCharge,
      balance: balance,
      extraPayment: round2(extraPay),
      propertyTax,
      insurance: homeInsurance,
    });
  }
  return schedule;
}

const scenarios = [
  {
    name: "No PMI scenario (>=20% down) row1 PMI zero",
    input: {
      amount: 400000 * 0.8, // 20% down on 400k property => loan 320k
      rate: 6.25,
      term: 30,
      pmi: 0, // builder pmi monthly (should be zero due to LTV)
      propertyTax: 350,
      homeInsurance: 120,
      extra: 0,
      appraisedValue: 400000,
      pmiEndRule: 80,
    },
    validate: (builder, schedule) => {
      assert(
        builder.pmiMeta.pmiEndsMonth === 1,
        "pmiEndsMonth should be 1 (no PMI charged)"
      );
      assert(schedule[0].pmi === 0, "Row1 PMI must be 0");
    },
  },
  {
    name: "PMI active then drops (captures non-zero PMI early, zero later)",
    input: {
      amount: 300000,
      rate: 6.5,
      term: 30,
      pmi: 140, // monthly PMI (active initially)
      propertyTax: 300,
      homeInsurance: 100,
      extra: 0,
      appraisedValue: 330000, // LTV ~0.909 > 0.8
      pmiEndRule: 80,
    },
    validate: (builder, schedule) => {
      const firstWithPMI = schedule.find((r) => r.pmi > 0);
      assert(firstWithPMI, "Should find at least one PMI-charged row");
      if (builder.pmiMeta.pmiEndsMonth) {
        const firstFree = schedule.find(
          (r) => r.paymentNumber === builder.pmiMeta.pmiEndsMonth
        );
        if (firstFree) {
          assert(firstFree.pmi === 0, "PMI must be zero at pmiEndsMonth");
        }
      }
    },
  },
  {
    name: "Extra payment accelerates payoff monthsSaved > 0",
    input: {
      amount: 250000,
      rate: 5.25,
      term: 30,
      pmi: 0,
      propertyTax: 250,
      homeInsurance: 90,
      extra: 300,
      appraisedValue: 320000,
      pmiEndRule: 80,
    },
    validate: (builder, schedule) => {
      assert(
        builder.extraDeltas && builder.extraDeltas.monthsSaved > 0,
        "monthsSaved should be > 0"
      );
      assert(
        schedule.length < 360,
        "Schedule length should be < original term months due to acceleration"
      );
    },
  },
  {
    name: "Zero interest linear principal & payment stable",
    input: {
      amount: 120000,
      rate: 0,
      term: 15,
      pmi: 0,
      propertyTax: 200,
      homeInsurance: 80,
      extra: 0,
      appraisedValue: 140000,
      pmiEndRule: 80,
    },
    validate: (builder, schedule) => {
      const monthlyPI = builder.monthlyPI;
      // Row1 principal should equal monthlyPI (no interest) and payment = PI + escrow
      assert(
        Math.abs(schedule[0].principal - monthlyPI) < 0.01,
        "Principal row1 mismatch zero-rate"
      );
      assert(
        Math.abs(schedule[0].interest) < 0.001,
        "Interest should be ~0 in zero-rate month1"
      );
    },
  },
];

function run() {
  console.log("Running unified purchase schedule tests...");
  let passed = 0;
  for (const s of scenarios) {
    const builder = buildFixedLoanSchedule(s.input);
    const schedule = buildDisplayScheduleFromBuilder(builder, s.input);
    try {
      s.validate(builder, schedule);
      console.log("✔", s.name);
      passed++;
    } catch (e) {
      console.error("✖", s.name, e.message);
      throw e;
    }
  }
  console.log(
    `All ${passed}/${scenarios.length} unified schedule scenarios passed.`
  );
}

if (require.main === module) {
  run();
}

module.exports = { run };
