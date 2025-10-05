/**
 * HelocCalculator - Pure logic utilities for HELOC analysis.
 * No DOM access; returns structured data for UI integration.
 *
 * Design goals:
 * - Deterministic, testable numeric routines decoupled from UI / formatting
 * - Two-phase HELOC model (Interest-Only -> Principal & Interest)
 * - Explicit edge flags + warnings for transparency in UI & exports
 */

/**
 * @typedef {Object} HelocInput
 * @property {number} propertyValue Market value of the property.
 * @property {number} outstandingBalance Existing first-lien mortgage balance (0 if none).
 * @property {number} helocAmount Credit line amount assumed fully drawn at start.
 * @property {number} interestRate Nominal annual percentage rate (APR %) (e.g. 7.5 for 7.5%).
 * @property {number} drawPeriodYears Interest-only period length in years.
 * @property {number} totalTermYears Total HELOC term in years (draw + repayment). If equal to drawPeriodYears we auto-extend repayment by 1 year.
 * @property {Date}  [startDate] Optional anchor date for first payment; if omitted schedule builder supplies default.
 */

/**
 * @typedef {Object} HelocScheduleRow
 * @property {number} monthIndex 0-based month index into schedule
 * @property {string} phase 'Interest-Only' | 'Principal & Interest'
 * @property {number} payment Total payment this month (interest + principal)
 * @property {number} interestPayment Portion of payment that is interest
 * @property {number} principalPayment Portion applied to principal (0 during interest-only phase)
 * @property {number} balance Remaining principal balance after payment
 * @property {number} cumulativeInterest Running sum of interest paid through this row
 * @property {number} cumulativePrincipal Running sum of principal repaid through this row
 * @property {Date|null} paymentDate Calendar date of payment (if startDate provided)
 */

/**
 * @typedef {Object} HelocEdgeFlags
 * @property {boolean} zeroInterest True when interestRate == 0 resulting in linear amortization
 * @property {boolean} repaymentMonthsAdjusted True when repayment period auto-extended (draw == total term)
 * @property {boolean} balanceClamped True when a residual <0.005 balance was clamped to 0
 * @property {boolean} roundingAdjusted True when sub-cent final principal row merged into prior row
 */

/**
 * @typedef {Object} HelocTotals
 * @property {number} totalInterest Total interest across all phases
 * @property {number} totalInterestDrawPhase Interest paid during interest-only phase
 * @property {number} totalInterestRepayPhase Interest paid during amortizing phase
 */

/**
 * @typedef {Object} HelocLTV
 * @property {number} availableEquity propertyValue - outstandingBalance
 * @property {number} combinedLTV Percentage ((outstandingBalance + helocAmount)/propertyValue * 100)
 */

/**
 * @typedef {Object} HelocAnalysis
 * @property {{propertyValue:number,outstandingBalance:number,helocAmount:number,interestRate:number,drawPeriodYears:number,totalTermYears:number}} inputs Copied sanitized inputs
 * @property {{interestOnlyPayment:number,principalInterestPayment:number}} payments Phase representative payments
 * @property {HelocScheduleRow[]} schedule Full two-phase schedule
 * @property {HelocTotals} totals Aggregate interest splits
 * @property {HelocLTV} ltv Equity & combined LTV metrics
 * @property {HelocEdgeFlags} edgeFlags Edge condition flags
 * @property {string[]} warnings Human-readable warning strings (ordered)
 * @property {Date|null} payoffDate Date of final payment (if schedule has dates)
 * @property {number} repaymentMonths Number of months in amortizing (repayment) phase
 */

const { buildHelocTwoPhaseSchedule } = require("./ScheduleBuilder");

/**
 * Compute repayment months and adjustment flag.
 * Ensures there is at least one year of repayment when draw == total.
 * @param {number} totalYears Total loan term years.
 * @param {number} drawYears Interest-only period years.
 * @returns {{repaymentMonths:number, adjusted:boolean, message?:string}} repaymentMonths (>=12), adjusted flag & optional explanatory message.
 * @throws {Error} When repayment period would be <= 0 (except equal case handled via auto-extension).
 */
function computeRepaymentMonths(totalYears, drawYears) {
  let repaymentMonths = (totalYears - drawYears) * 12;
  if (repaymentMonths <= 0) {
    if (totalYears === drawYears) {
      repaymentMonths = 12; // minimal one year
      return {
        repaymentMonths,
        adjusted: true,
        message:
          "Repayment period equaled draw period; auto-extended by 1 year (12 months).",
      };
    }
    throw new Error(
      "Repayment period must be greater than interest-only period."
    );
  }
  return { repaymentMonths, adjusted: false };
}

/**
 * Derive warnings based on flags & thresholds.
 * Ordering: structural adjustments/zero-interest are appended after LTV critical messages unless an auto-adjust message is pre-pended externally.
 * @param {Object} ctx Internal context object.
 * @param {HelocEdgeFlags} ctx.edgeFlags
 * @param {number} ctx.combinedLTV
 * @param {number} ctx.HIGH_LTV_THRESHOLD
 * @param {number} ctx.MAX_LTV_THRESHOLD
 * @returns {string[]} Ordered warning messages.
 */
function deriveWarnings(ctx) {
  const warnings = [];
  const { edgeFlags, combinedLTV, HIGH_LTV_THRESHOLD, MAX_LTV_THRESHOLD } = ctx;
  if (combinedLTV > HIGH_LTV_THRESHOLD && combinedLTV < MAX_LTV_THRESHOLD) {
    warnings.push("High combined loan-to-value ratio may affect approval.");
  }
  if (combinedLTV >= MAX_LTV_THRESHOLD) {
    warnings.push("Combined loan-to-value ratio exceeds permissible limit.");
  }
  if (edgeFlags.zeroInterest) {
    warnings.push(
      "Zero interest rate: repayment will be linear principal amortization."
    );
  }
  if (edgeFlags.repaymentMonthsAdjusted) {
    warnings.push(
      "Repayment period auto-adjusted to ensure amortization occurs."
    );
  }
  if (edgeFlags.roundingAdjusted) {
    warnings.push("Final fractional cent principal folded into prior payment.");
  }
  return warnings;
}

/**
 * Build full HELOC analysis result.
 * Orchestrates: repayment months determination, phase payment calculations, schedule build, sub-cent folding, aggregation & warnings.
 * @param {HelocInput} input Raw HELOC inputs (validated upstream).
 * @returns {HelocAnalysis} Structured analysis object suitable for UI & export consumption.
 */
function computeHelocAnalysis(input) {
  const {
    propertyValue,
    outstandingBalance = 0,
    helocAmount,
    interestRate,
    drawPeriodYears,
    totalTermYears,
    startDate = null,
  } = input;

  // Edge flags
  const edgeFlags = {
    zeroInterest: false,
    repaymentMonthsAdjusted: false,
    balanceClamped: false,
    roundingAdjusted: false,
  };

  const { repaymentMonths, adjusted, message } = computeRepaymentMonths(
    totalTermYears,
    drawPeriodYears
  );
  if (adjusted) edgeFlags.repaymentMonthsAdjusted = true;

  const monthlyRate = interestRate / 100 / 12;
  if (monthlyRate === 0) edgeFlags.zeroInterest = true;

  // Phase payments
  let interestOnlyPayment = helocAmount * monthlyRate;
  if (monthlyRate === 0) interestOnlyPayment = 0;

  let principalInterestPayment = 0;
  if (monthlyRate === 0) {
    principalInterestPayment = helocAmount / repaymentMonths;
  } else if (repaymentMonths > 0) {
    principalInterestPayment =
      (helocAmount *
        (monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths))) /
      (Math.pow(1 + monthlyRate, repaymentMonths) - 1);
  }

  // Build schedule via unified engine
  let schedule = buildHelocTwoPhaseSchedule(
    {
      principal: helocAmount,
      annualRate: interestRate,
      drawYears: drawPeriodYears,
      totalYears: totalTermYears,
    },
    {
      repaymentMonthsOverride: repaymentMonths,
      startDate,
      onBalanceClamp: () => {
        edgeFlags.balanceClamped = true;
      },
      accumulate: true,
    }
  );

  // Rounding adjustment (replicate legacy tiny final row fold)
  if (schedule.length > 2) {
    const last = schedule[schedule.length - 1];
    const penultimate = schedule[schedule.length - 2];
    if (
      last.phase === "Principal & Interest" &&
      penultimate.phase === "Principal & Interest" &&
      last.principalPayment > 0 &&
      last.principalPayment < 0.01
    ) {
      penultimate.principalPayment += last.principalPayment;
      penultimate.payment += last.principalPayment;
      penultimate.cumulativePrincipal += last.principalPayment;
      penultimate.balance = 0;
      schedule.pop();
      edgeFlags.roundingAdjusted = true;
    }
  }

  const totalInterest = schedule.reduce(
    (s, r) => s + (r.interestPayment || 0),
    0
  );
  let totalInterestDrawPhase = 0;
  let totalInterestRepayPhase = 0;
  for (const row of schedule) {
    if (row.phase === "Interest-Only")
      totalInterestDrawPhase += row.interestPayment || 0;
    else if (row.phase === "Principal & Interest")
      totalInterestRepayPhase += row.interestPayment || 0;
  }

  const availableEquity = propertyValue - outstandingBalance;
  const combinedLTV =
    propertyValue > 0
      ? ((outstandingBalance + helocAmount) / propertyValue) * 100
      : 0;

  const HIGH_LTV_THRESHOLD = 90;
  const MAX_LTV_THRESHOLD = 100;

  const warnings = deriveWarnings({
    edgeFlags,
    combinedLTV,
    HIGH_LTV_THRESHOLD,
    MAX_LTV_THRESHOLD,
  });
  if (message) warnings.unshift(message); // ensure adjustment message first if present

  const payoffDate = schedule.length
    ? schedule[schedule.length - 1].paymentDate
    : null;

  return {
    inputs: {
      propertyValue,
      outstandingBalance,
      helocAmount,
      interestRate,
      drawPeriodYears,
      totalTermYears,
    },
    payments: {
      interestOnlyPayment,
      principalInterestPayment,
    },
    schedule,
    totals: {
      totalInterest,
      totalInterestDrawPhase,
      totalInterestRepayPhase,
    },
    ltv: { availableEquity, combinedLTV },
    edgeFlags,
    warnings,
    payoffDate,
    repaymentMonths,
  };
}

module.exports = {
  computeRepaymentMonths,
  deriveWarnings,
  computeHelocAnalysis,
};
