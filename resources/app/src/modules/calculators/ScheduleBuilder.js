/**
 * ScheduleBuilder.js
 * Abstraction for fixed-rate mortgage style amortization with:
 *  - PMI termination based on LTV & selectable threshold (80% / 78%)
 *  - Extra monthly principal payments (acceleration)
 *  - Baseline (no-extra) counterfactual for interestSaved / monthsSaved
 *  - Consistent rounding (bank-style to 2 decimals) per Task 15
 *  - Escrow accumulation (tax + insurance + HOA) for totalOutOfPocket metric
 *
 * PMI Semantics (pmiMeta.pmiEndsMonth):
 *  - 1 => PMI never charged (not applicable at origination or zero loan)
 *  - null => PMI would never end during modeled term (edge; not typical here)
 *  - >1 => First PMI-FREE month (i.e. the month AFTER last PMI charge)
 *
 * Rounding: Each month interest & principal are rounded, then adjusted so roundedInterest + roundedPrincipal == roundedMonthlyPI (within 0.01) to avoid balance drift.
 *
 * @typedef {Object} LoanInput
 * @property {number} amount Principal loan amount (>=0)
 * @property {number} rate Annual interest rate percent (e.g. 6 for 6%)
 * @property {number} term Loan term in years (integer)
 * @property {number} pmi Monthly PMI charge (already computed externally)
 * @property {number} propertyTax Monthly property tax
 * @property {number} homeInsurance Monthly insurance
 * @property {number} [hoa=0] Monthly HOA dues
 * @property {number} extra Extra principal payment applied every month
 * @property {number} appraisedValue Property value for LTV calculations
 * @property {number} [pmiEndRule=80] LTV threshold percentage (80 or 78)
 * @property {number} [fixedMonthlyPMI] Optional explicit monthly PMI dollar amount override (used for refinance path). If provided >0 it takes precedence over rate-derived or externally computed values.
 *
 * @typedef {Object} PmiMeta
 * @property {number} pmiMonthlyInput Original monthly PMI input value
 * @property {number|null} pmiEndsMonth First PMI-free month (1-based) or null if never ends
 * @property {number} pmiTotalPaid Total PMI dollars paid
 * @property {number} thresholdLTV Decimal LTV threshold (0.8 or 0.78)
 *
 * @typedef {Object} ExtraDeltas
 * @property {number} interestSaved Interest saved vs baseline (no extra)
 * @property {number} monthsSaved Months saved vs baseline (positive means faster payoff)
 *
 * @typedef {Object} PayoffTime
 * @property {number} years Whole years part of payoff time
 * @property {number} months Remaining months after years
 * @property {number} totalMonths Total payoff months including acceleration
 *
 * @typedef {Object} ScheduleResult
 * @property {number} monthlyPI Scheduled principal+interest payment (no escrow/PMI)
 * @property {number} monthlyPropertyTax Monthly property tax
 * @property {number} monthlyInsurance Monthly insurance
 * @property {number} monthlyHOA Monthly HOA
 * @property {number} monthlyPMIInput Raw PMI monthly input
 * @property {number} totalMonthlyPayment First month total payment including PMI & escrow
 * @property {number} baseMonthlyPaymentNoPMI Monthly payment minus PMI (escrow + P&I)
 * @property {number} totalInterest Total interest paid (with extra payments)
 * @property {number} totalCost Total principal + interest
 * @property {Object} totals Aggregated cost categories (principal, interestPaid, pmiPaid, taxPaid, insurancePaid, hoaPaid, totalOutOfPocket, totalCostPI, totalCostFull)
 * @property {PayoffTime} payoffTime Structured payoff timing
 * @property {{interestPaid:number,payoffMonths:number}|null} baseline Baseline (no extra) results or null if no extra
 * @property {ExtraDeltas|null} extraDeltas Savings deltas vs baseline or null
 * @property {Object} calculations Internal calculation metadata
 * @property {PmiMeta} pmiMeta PMI metadata block
 * @property {LoanInput} amount Included original input echo for convenience
 *
 * @param {LoanInput} loanData
 * @returns {ScheduleResult}
 */

function buildFixedLoanSchedule(loanData) {
  const {
    amount,
    rate,
    term,
    pmi, // legacy/monthly PMI input (purchase path passes computed monthly PMI from rate)
    fixedMonthlyPMI, // NEW override for refinance path (explicit monthly dollars)
    propertyTax,
    homeInsurance,
    hoa = 0, // monthly HOA dues
    extra,
    appraisedValue,
  } = loanData;

  const monthlyRate = rate / 100 / 12;
  const numberOfPayments = term * 12;

  // Zero-rate branch
  let monthlyPI;
  if (monthlyRate === 0) {
    monthlyPI = amount / numberOfPayments;
  } else {
    monthlyPI =
      (amount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments))) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  }

  const monthlyPropertyTax = propertyTax; // already monthly
  const selectedRule = loanData.pmiEndRule || 80;
  const pmiThresholdLTV = selectedRule / 100;
  const hasAppraised = appraisedValue && appraisedValue > 0;
  const startingLTV = hasAppraised ? amount / appraisedValue : null;
  // Determine which PMI input to use (override precedence)
  const effectivePMI =
    typeof fixedMonthlyPMI === "number" && fixedMonthlyPMI > 0
      ? fixedMonthlyPMI
      : pmi || 0;

  let pmiApplies =
    effectivePMI > 0 &&
    hasAppraised &&
    startingLTV !== null &&
    startingLTV > pmiThresholdLTV;

  let balance = amount;
  let month = 0;
  let totalInterest = 0;
  let pmiTotalPaid = 0;
  let pmiEndsMonth = null; // first month WITHOUT PMI (1-based)
  let taxTotalPaid = 0;
  let insuranceTotalPaid = 0;
  let hoaTotalPaid = 0;

  const roundCurrency = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

  while (balance > 0.01 && month < numberOfPayments) {
    month++;
    let interestPayment = balance * monthlyRate;
    let principalPayment =
      monthlyRate === 0 ? monthlyPI : monthlyPI - interestPayment;

    interestPayment = roundCurrency(interestPayment);
    principalPayment = roundCurrency(principalPayment);
    if (monthlyRate !== 0) {
      const roundedPI = roundCurrency(interestPayment + principalPayment);
      const scheduledPI = roundCurrency(monthlyPI);
      const delta = scheduledPI - roundedPI;
      if (Math.abs(delta) >= 0.01) {
        principalPayment = roundCurrency(principalPayment + delta);
      }
    }

    let monthlyPMICharge = 0;
    if (pmiApplies) {
      const currentLTV = balance / appraisedValue;
      if (currentLTV > pmiThresholdLTV) {
        monthlyPMICharge = effectivePMI;
      } else {
        pmiApplies = false;
        pmiEndsMonth = month; // first PMI-free month
      }
    }

    pmiTotalPaid += monthlyPMICharge;
    taxTotalPaid += monthlyPropertyTax;
    insuranceTotalPaid += homeInsurance;
    hoaTotalPaid += hoa;

    let principalReduction = principalPayment + extra;
    if (principalReduction > balance) {
      const adjustedInterest =
        monthlyRate === 0 ? 0 : roundCurrency(balance * monthlyRate);
      totalInterest += adjustedInterest;
      principalReduction = balance;
      balance = 0;
      break;
    } else {
      totalInterest += interestPayment;
      balance -= principalReduction;
    }
  }

  const payoffMonthsTotal = month;
  const payoffYears = Math.floor(payoffMonthsTotal / 12);
  const payoffMonthsRemainder = payoffMonthsTotal % 12;

  // Handle case where PMI never applied
  if (
    effectivePMI > 0 &&
    (!hasAppraised || startingLTV === null || startingLTV <= pmiThresholdLTV)
  ) {
    pmiEndsMonth = 1; // signify not charged
    pmiTotalPaid = 0;
  }

  const initialMonthlyPayment =
    monthlyPI +
    (pmiApplies ? effectivePMI : 0) +
    monthlyPropertyTax +
    homeInsurance +
    hoa;
  const baseMonthlyPaymentNoPMI =
    monthlyPI + monthlyPropertyTax + homeInsurance + hoa;
  const totalCostPI = amount + totalInterest;
  const totalOutOfPocket =
    amount +
    totalInterest +
    pmiTotalPaid +
    taxTotalPaid +
    insuranceTotalPaid +
    hoaTotalPaid;

  // Baseline (no extra) simulation
  let baselineInterestPaid = null;
  let baselinePayoffMonths = null;
  if (extra > 0) {
    let bBalance = amount;
    let bMonth = 0;
    let bTotalInterest = 0;
    let bPmiApplies =
      effectivePMI > 0 &&
      hasAppraised &&
      startingLTV !== null &&
      startingLTV > pmiThresholdLTV;
    const bNumberOfPayments = numberOfPayments; // alias
    while (bBalance > 0.01 && bMonth < bNumberOfPayments) {
      bMonth++;
      let bInterest = bBalance * monthlyRate;
      let bPrincipal =
        monthlyRate === 0 ? amount / bNumberOfPayments : monthlyPI - bInterest;
      bInterest = roundCurrency(bInterest);
      bPrincipal = roundCurrency(bPrincipal);
      if (monthlyRate !== 0) {
        const roundedPI = roundCurrency(bInterest + bPrincipal);
        const scheduledPI = roundCurrency(monthlyPI);
        const delta = scheduledPI - roundedPI;
        if (Math.abs(delta) >= 0.01) {
          bPrincipal = roundCurrency(bPrincipal + delta);
        }
      }
      if (bPmiApplies) {
        const currentLTV = bBalance / appraisedValue;
        if (currentLTV <= pmiThresholdLTV) {
          bPmiApplies = false;
        }
      }
      let principalReduction = bPrincipal;
      if (principalReduction > bBalance) {
        const adjInterest =
          monthlyRate === 0 ? 0 : roundCurrency(bBalance * monthlyRate);
        bTotalInterest += adjInterest;
        principalReduction = bBalance;
        bBalance = 0;
        break;
      } else {
        bTotalInterest += bInterest;
        bBalance -= principalReduction;
      }
    }
    baselineInterestPaid = bTotalInterest;
    baselinePayoffMonths = bMonth;
  }

  return {
    ...loanData,
    monthlyPI,
    monthlyPropertyTax,
    monthlyInsurance: homeInsurance,
    monthlyHOA: hoa,
    monthlyPMIInput: effectivePMI,
    totalMonthlyPayment: initialMonthlyPayment,
    baseMonthlyPaymentNoPMI,
    totalInterest,
    totalCost: totalCostPI,
    totals: {
      principal: amount,
      interestPaid: totalInterest,
      pmiPaid: pmiTotalPaid,
      taxPaid: taxTotalPaid,
      insurancePaid: insuranceTotalPaid,
      totalOutOfPocket,
      totalCostPI,
      totalCostFull: totalOutOfPocket,
      hoaPaid: hoaTotalPaid,
    },
    payoffTime: {
      years: payoffYears,
      months: payoffMonthsRemainder,
      totalMonths: payoffMonthsTotal,
    },
    baseline:
      baselineInterestPaid !== null
        ? {
            interestPaid: baselineInterestPaid,
            payoffMonths: baselinePayoffMonths,
          }
        : null,
    extraDeltas:
      baselineInterestPaid !== null
        ? {
            interestSaved: baselineInterestPaid - totalInterest,
            monthsSaved:
              (baselinePayoffMonths || payoffMonthsTotal) - payoffMonthsTotal,
          }
        : null,
    calculations: {
      monthlyRate,
      numberOfPayments,
      originalTerm: numberOfPayments,
      pmiThresholdLTV,
      startingLTV,
    },
    pmiMeta: {
      pmiMonthlyInput: effectivePMI,
      pmiEndsMonth,
      pmiTotalPaid,
      thresholdLTV: pmiThresholdLTV,
    },
  };
}

/**
 * buildHelocTwoPhaseSchedule
 * Creates a two‑phase (interest‑only then principal & interest) HELOC style schedule.
 * Mirrors existing legacy generateHelocAmortizationSchedule output shape to allow
 * incremental migration. Adds non‑enumerable _meta.phaseTotals like fixed schedule uses.
 *
 * @param {Object} params
 * @param {number} params.principal Total drawn amount (assumes fully drawn at start)
 * @param {number} params.annualRate Nominal annual percentage rate (e.g. 7.25)
 * @param {number} params.drawYears Interest‑only years
 * @param {number} params.totalYears Total loan years including draw period
 * @param {Object} [options]
 * @param {Date}   [options.startDate] Optional start date (defaults: first of next month)
 * @param {function} [options.onBalanceClamp] Callback when residual balance clamped to zero
 * @param {boolean} [options.accumulate=true] Attach _meta.phaseTotals if true
 * @param {number}  [options.repaymentMonthsOverride] Explicit repayment months (post draw)
 * @returns {Array<Object>} schedule rows
 */
function buildHelocTwoPhaseSchedule(params, options = {}) {
  const { principal, annualRate, drawYears, totalYears } = params;
  const {
    startDate = null,
    onBalanceClamp = () => {},
    accumulate = true,
    repaymentMonthsOverride,
  } = options;

  const schedule = [];
  if (!principal || principal <= 0 || !drawYears || !totalYears)
    return schedule;
  const interestOnlyMonths = drawYears * 12;
  const rawRepayMonths = (totalYears - drawYears) * 12;
  const repaymentMonths =
    typeof repaymentMonthsOverride === "number" && repaymentMonthsOverride > 0
      ? repaymentMonthsOverride
      : rawRepayMonths;

  const monthlyRate = annualRate / 100 / 12;
  let balance = principal;
  let cumulativePrincipal = 0;
  let cumulativeInterest = 0;
  const phaseTotals = {
    interestOnly: { principal: 0, interest: 0, payments: 0 },
    repayment: { principal: 0, interest: 0, payments: 0 },
  };

  // Establish base date (first of next month if no explicit)
  let baseDate;
  if (startDate instanceof Date && !isNaN(startDate)) {
    baseDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  } else {
    const now = new Date();
    baseDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const interestOnlyPayment = monthlyRate === 0 ? 0 : principal * monthlyRate;
  for (let i = 1; i <= interestOnlyMonths; i++) {
    const paymentDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + (i - 1),
      1
    );
    const interestPayment = interestOnlyPayment;
    cumulativeInterest += interestPayment;
    phaseTotals.interestOnly.interest += interestPayment;
    phaseTotals.interestOnly.payments += interestPayment;
    schedule.push({
      paymentNumber: i,
      paymentDate,
      payment: interestOnlyPayment,
      principalPayment: 0,
      interestPayment,
      balance: balance,
      phase: "Interest-Only",
      cumulativePrincipal,
      cumulativeInterest,
    });
  }

  if (repaymentMonths > 0) {
    let repaymentPI;
    if (monthlyRate === 0) {
      repaymentPI = principal / repaymentMonths; // linear principal only
    } else {
      repaymentPI =
        (balance * (monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths))) /
        (Math.pow(1 + monthlyRate, repaymentMonths) - 1);
    }
    for (let m = 1; m <= repaymentMonths && balance > 0.0001; m++) {
      const paymentNumber = interestOnlyMonths + m;
      const paymentDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth() + (paymentNumber - 1),
        1
      );
      const interestPayment = monthlyRate === 0 ? 0 : balance * monthlyRate;
      let principalPayment =
        monthlyRate === 0
          ? Math.min(repaymentPI, balance)
          : Math.min(repaymentPI - interestPayment, balance);
      balance -= principalPayment;
      if (balance !== 0 && Math.abs(balance) < 0.005) {
        balance = 0;
        onBalanceClamp();
      }
      cumulativePrincipal += principalPayment;
      cumulativeInterest += interestPayment;
      phaseTotals.repayment.principal += principalPayment;
      phaseTotals.repayment.interest += interestPayment;
      phaseTotals.repayment.payments += repaymentPI;
      schedule.push({
        paymentNumber,
        paymentDate,
        payment: repaymentPI,
        principalPayment,
        interestPayment,
        balance,
        phase: "Principal & Interest",
        cumulativePrincipal,
        cumulativeInterest,
      });
    }
  }

  if (accumulate) {
    Object.defineProperty(schedule, "_meta", {
      value: { phaseTotals },
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return schedule;
}

module.exports = { buildFixedLoanSchedule, buildHelocTwoPhaseSchedule };
