/**
 * ScheduleBuilder.js
 * Abstraction for fixed-rate mortgage style amortization with:
 *  - PMI termination based on LTV & selectable threshold (80% / 78%)
 *  - Extra monthly principal payments (acceleration)
 *  - Baseline (no-extra) counterfactual for interestSaved / monthsSaved
 *  - Consistent rounding (bank-style to 2 decimals) per Task 15
 *  - Escrow accumulation (tax + insurance) for totalOutOfPocket metric
 *
 * Input Shape (loanData):
 *  {
 *    amount,           // principal
 *    rate,             // annual interest % (number)
 *    term,             // years (integer)
 *    pmi,              // monthly PMI charge already adjusted by toggle
 *    propertyTax,      // monthly property tax
 *    homeInsurance,    // monthly insurance
 *    extra,            // monthly extra principal
 *    appraisedValue,   // property value for LTV
 *    pmiEndRule        // 80 or 78 (percentage) optional (defaults 80 if falsy)
 *  }
 *
 * Return object mirrors the legacy calculateSingleLoan output to avoid UI refactor.
 */

function buildFixedLoanSchedule(loanData) {
  const {
    amount,
    rate,
    term,
    pmi,
    propertyTax,
    homeInsurance,
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
    monthlyPI + (pmiApplies ? pmi : 0) + monthlyPropertyTax + homeInsurance;
  const baseMonthlyPaymentNoPMI =
    monthlyPI + monthlyPropertyTax + homeInsurance;
  const totalCostPI = amount + totalInterest;
  const totalOutOfPocket =
    amount + totalInterest + pmiTotalPaid + taxTotalPaid + insuranceTotalPaid;

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
