/**
 * FixedAmortization Utility (Phase 2 - P2-1)
 * Extracted from inline logic in BlendedMortgageCalculator to provide
 * a pure, reusable fixed-rate amortization schedule generator.
 *
 * Behavior parity goals:
 *  - Zero-rate handling (linear principal amortization) using epsilon 1e-12
 *  - Residual normalization: if 0.01 < residual < 5 add to last principalPayment; if 0 < residual <= 0.01 zero it
 *  - Stop early when remainingBalance <= 0.01 before normalization pass
 */

/**
 * @typedef {Object} FixedAmortizationRow
 * @property {number} paymentNumber
 * @property {number} principalPayment
 * @property {number} interestPayment
 * @property {number} remainingBalance
 */

/**
 * @typedef {Object} FixedAmortizationResult
 * @property {FixedAmortizationRow[]} schedule
 * @property {{ totalInterest:number, totalPaid:number, totalPrincipal:number }} totals
 * @property {number} monthlyPayment
 * @property {{ zeroRate:boolean, normalizationApplied:boolean }} flags
 */

/**
 * Compute a fixed-rate amortization schedule.
 * @param {Object} opts
 * @param {number} opts.principal - Starting principal
 * @param {number} opts.annualRate - Nominal annual interest rate (percent, e.g. 6 for 6%)
 * @param {number} opts.termMonths - Total number of monthly payments
 * @param {number} [opts.payment] - Optional externally supplied monthly payment (for parity / refactors)
 * @param {number} [opts.zeroRateEpsilon=1e-12] - Epsilon to treat rate as zero
 * @returns {FixedAmortizationResult}
 */
function computeFixedAmortization({
  principal,
  annualRate,
  termMonths,
  payment,
  zeroRateEpsilon = 1e-12,
}) {
  if (!principal || principal <= 0 || !termMonths || termMonths <= 0) {
    return {
      schedule: [],
      totals: { totalInterest: 0, totalPaid: 0, totalPrincipal: 0 },
      monthlyPayment: 0,
      flags: { zeroRate: false, normalizationApplied: false },
    };
  }

  const monthlyRate = (annualRate || 0) / 100 / 12;
  const zeroRate = Math.abs(monthlyRate) < zeroRateEpsilon;

  let monthlyPayment;
  if (typeof payment === "number" && payment > 0) {
    monthlyPayment = payment;
  } else if (zeroRate) {
    monthlyPayment = principal / termMonths;
  } else {
    const r = monthlyRate;
    monthlyPayment =
      (principal * r * Math.pow(1 + r, termMonths)) /
      (Math.pow(1 + r, termMonths) - 1);
  }

  const schedule = [];
  let remainingBalance = principal;
  let totalInterest = 0;
  let totalPrincipal = 0;

  if (zeroRate) {
    // Linear amortization (interest all zero)
    const basePrincipal = principal / termMonths;
    for (let i = 1; i <= termMonths && remainingBalance > 0.01; i++) {
      let principalPayment = basePrincipal;
      if (principalPayment > remainingBalance)
        principalPayment = remainingBalance;
      remainingBalance -= principalPayment;
      totalPrincipal += principalPayment;
      schedule.push({
        paymentNumber: i,
        principalPayment,
        interestPayment: 0,
        remainingBalance: Math.max(0, remainingBalance),
      });
    }
  } else {
    for (let i = 1; i <= termMonths && remainingBalance > 0.01; i++) {
      const interestPayment = remainingBalance * monthlyRate;
      let principalPayment = monthlyPayment - interestPayment;
      if (principalPayment > remainingBalance)
        principalPayment = remainingBalance;
      remainingBalance -= principalPayment;
      totalPrincipal += principalPayment;
      totalInterest += interestPayment;
      schedule.push({
        paymentNumber: i,
        principalPayment,
        interestPayment,
        remainingBalance: Math.max(0, remainingBalance),
      });
    }
  }

  // Residual normalization (parity with existing logic)
  let normalizationApplied = false;
  if (remainingBalance > 0.01 && remainingBalance < 5 && schedule.length) {
    const last = schedule[schedule.length - 1];
    last.principalPayment += remainingBalance;
    totalPrincipal += remainingBalance;
    remainingBalance = 0;
    last.remainingBalance = 0;
    normalizationApplied = true;
  } else if (
    remainingBalance > 0 &&
    remainingBalance <= 0.01 &&
    schedule.length
  ) {
    const last = schedule[schedule.length - 1];
    last.remainingBalance = 0;
    remainingBalance = 0;
    normalizationApplied = true;
  }

  const totalPaid = zeroRate ? totalPrincipal : totalPrincipal + totalInterest;

  return {
    schedule,
    totals: {
      totalInterest: zeroRate ? 0 : totalInterest,
      totalPaid,
      totalPrincipal,
    },
    monthlyPayment,
    flags: { zeroRate, normalizationApplied },
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeFixedAmortization };
} else {
  window.computeFixedAmortization = computeFixedAmortization;
}
