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
    pmi,
    propertyTax,
    homeInsurance,
    hoa = 0, // NEW: monthly HOA dues
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
  let pmiApplies =
    pmi > 0 &&
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
        monthlyPMICharge = pmi;
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
    pmi > 0 &&
    (!hasAppraised || startingLTV === null || startingLTV <= pmiThresholdLTV)
  ) {
    pmiEndsMonth = 1; // signify not charged
    pmiTotalPaid = 0;
  }

  const initialMonthlyPayment =
    monthlyPI +
    (pmiApplies ? pmi : 0) +
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
      pmi > 0 &&
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
    monthlyPMIInput: pmi,
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
      pmiMonthlyInput: pmi,
      pmiEndsMonth,
      pmiTotalPaid,
      thresholdLTV: pmiThresholdLTV,
    },
  };
}

module.exports = { buildFixedLoanSchedule };
