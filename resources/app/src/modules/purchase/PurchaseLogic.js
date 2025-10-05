// Pure logic helpers extracted for testing Purchase scenarios without DOM.
// Depends only on ScheduleBuilder for amortization & PMI metadata.
/**
 * @typedef {Object} PurchaseScenarioInput
 * @property {number} propertyValue Property value
 * @property {number} downPaymentAmount Down payment dollars
 * @property {number} loanTerm Loan term (years)
 * @property {number} interestRate Annual rate percent
 * @property {number} pmiRate Annual PMI percent (e.g. 0.5 for 0.5%)
 * @property {number} [pmiEndRule=80] PMI termination threshold (80 or 78)
 * @property {number} [propertyTax=0] Monthly tax
 * @property {number} [homeInsurance=0] Monthly insurance
 * @property {number} [hoa=0] Monthly HOA
 * @property {number} [extraPayment=0] Monthly extra principal
 *
 * @typedef {Object} PurchaseScenarioResult
 * @property {number} ltv Initial loan-to-value percent
 * @property {number} loanAmount Computed loan amount (>=0)
 * @property {import('../calculators/ScheduleBuilder').ScheduleResult} schedule Schedule builder result
 */

const { buildFixedLoanSchedule } = require("../calculators/ScheduleBuilder");

/**
 * Compute a purchase scenario headlessly.
 * Normalizes PMI metadata so tests can rely on pmiEndsMonth=1 when PMI never applies.
 *
 * PMI normalization triggers when:
 *  - loanAmount === 0 (cash purchase or overpayment)
 *  - initial LTV <= pmiEndRule (no PMI at origination)
 *
 * @param {PurchaseScenarioInput} param0
 * @returns {PurchaseScenarioResult}
 */
function computePurchaseScenario({
  propertyValue,
  downPaymentAmount,
  loanTerm,
  interestRate,
  pmiRate,
  pmiEndRule = 80,
  propertyTax = 0,
  homeInsurance = 0,
  hoa = 0,
  extraPayment = 0,
}) {
  propertyValue = Number(propertyValue) || 0;
  downPaymentAmount = Number(downPaymentAmount) || 0;
  const loanAmount = Math.max(0, propertyValue - downPaymentAmount);
  loanTerm = Number(loanTerm) || 0;
  interestRate = Number(interestRate) || 0;
  pmiRate = Number(pmiRate) || 0;
  const ltv = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 0;
  const pmiMonthly = ltv > pmiEndRule ? (pmiRate / 100 / 12) * loanAmount : 0;
  const schedule = buildFixedLoanSchedule({
    amount: loanAmount,
    rate: interestRate,
    term: loanTerm,
    pmi: pmiMonthly,
    propertyTax,
    homeInsurance,
    hoa,
    extra: extraPayment,
    appraisedValue: propertyValue,
    pmiEndRule,
  });
  // Normalize PMI metadata for test expectations: if loanAmount=0 or PMI never applied ensure pmiEndsMonth=1
  if (schedule.pmiMeta) {
    if (loanAmount === 0) {
      schedule.pmiMeta.pmiEndsMonth = 1;
      schedule.pmiMeta.pmiTotalPaid = 0;
    } else if (ltv <= pmiEndRule) {
      // PMI not applicable at origination
      schedule.pmiMeta.pmiEndsMonth = 1;
      schedule.pmiMeta.pmiTotalPaid = 0;
    }
  }
  return { ltv, loanAmount, schedule };
}

module.exports = { computePurchaseScenario };
