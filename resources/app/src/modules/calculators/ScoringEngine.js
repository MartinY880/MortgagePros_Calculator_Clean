/**
 * ScoringEngine (Task 20)
 * Pure, side‑effect free scoring utilities for loan comparison.
 *
 * INPUT CONTRACT (loan object shape – minimal fields required):
 *  loan = {
 *    letter: 'A' | 'B' | 'C' | string,
 *    name: string,
 *    totals: {
 *      totalOutOfPocket: number,   // principal + interest + pmi + tax + insurance
 *      totalCostPI: number         // principal + interest
 *    },
 *    payoffTime: { years: number, months: number } // months component < 12
 *  }
 *
 * MODES (lower score is better):
 *  - totalOutOfPocket : totals.totalOutOfPocket
 *  - principalInterest : totals.totalCostPI
 *  - payoffSpeed : payoff months (years*12 + months)
 *
 * TIE BREAKERS (applied in order, independent of primary mode for determinism):
 *  1. Lowest totalOutOfPocket
 *  2. Lowest totalCostPI
 *  3. Fastest payoff (months)
 *  4. Stable ordering (retain earlier candidate)
 */

const EvaluationModes = Object.freeze({
  TOTAL_OUT_OF_POCKET: "totalOutOfPocket",
  PRINCIPAL_INTEREST: "principalInterest",
  PAYOFF_SPEED: "payoffSpeed",
});

function payoffMonths(loan) {
  if (!loan || !loan.payoffTime) return Infinity;
  const y = loan.payoffTime.years || 0;
  const m = loan.payoffTime.months || 0;
  return y * 12 + m;
}

function primaryScore(loan, mode) {
  switch (mode) {
    case EvaluationModes.PRINCIPAL_INTEREST:
      return loan?.totals?.totalCostPI ?? Infinity;
    case EvaluationModes.PAYOFF_SPEED:
      return payoffMonths(loan);
    case EvaluationModes.TOTAL_OUT_OF_POCKET:
    default:
      return loan?.totals?.totalOutOfPocket ?? Infinity;
  }
}

function tieBreakCompare(a, b) {
  const aOut = a?.totals?.totalOutOfPocket ?? Infinity;
  const bOut = b?.totals?.totalOutOfPocket ?? Infinity;
  if (aOut !== bOut) return aOut - bOut;
  const aPI = a?.totals?.totalCostPI ?? Infinity;
  const bPI = b?.totals?.totalCostPI ?? Infinity;
  if (aPI !== bPI) return aPI - bPI;
  const aPay = payoffMonths(a);
  const bPay = payoffMonths(b);
  if (aPay !== bPay) return aPay - bPay;
  return 0; // stable
}

/**
 * determineBestLoan(loans, mode)
 * @param {Array} loans - array of loan result objects
 * @param {string} mode - evaluation mode constant (optional)
 * @returns best loan object or null
 */
function determineBestLoan(loans, mode = EvaluationModes.TOTAL_OUT_OF_POCKET) {
  if (!Array.isArray(loans) || loans.length === 0) return null;
  let best = loans[0];
  for (let i = 1; i < loans.length; i++) {
    const candidate = loans[i];
    const cScore = primaryScore(candidate, mode);
    const bScore = primaryScore(best, mode);
    if (cScore < bScore) {
      best = candidate;
    } else if (cScore === bScore) {
      if (tieBreakCompare(candidate, best) < 0) {
        best = candidate;
      }
    }
  }
  // Annotate evaluation basis (non-destructive if already set)
  if (best) {
    best.evaluation = best.evaluation || {};
    best.evaluation.scoreBasis = mode;
  }
  return best;
}

module.exports = {
  EvaluationModes,
  determineBestLoan,
  _internal: { primaryScore, tieBreakCompare, payoffMonths }, // exposed for potential future unit tests
};
