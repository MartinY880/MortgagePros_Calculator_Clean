// Pure PMI / LTV classification extracted from updatePurchaseLtvPmiStatus (without DOM)
/**
 * Classification States:
 *  - pending: property value not yet entered (>0 required)
 *  - none: No PMI charged / required
 *  - active: PMI will be charged (rate entered & LTV above threshold)
 *  - ignored: PMI rate entered but LTV already at/below threshold (not charged)
 *  - possible: LTV above threshold but no PMI rate provided
 *
 * Badge Classes (UI semantic): ltv-pending | ltv-cash | ltv-good | ltv-borderline | ltv-high
 *
 * @typedef {Object} PmiClassificationResult
 * @property {string} state One of pending|none|active|ignored|possible
 * @property {string} statusText Human readable status
 * @property {string} badgeClass UI badge class
 * @property {number} ltv Loan-to-value percent (4dp precision)
 * @property {boolean} meetsThreshold True if LTV <= threshold (and loan > 0)
 */

/**
 * Classify PMI state from raw numeric inputs.
 * @param {{propertyValue:number,downPaymentAmount:number,pmiRate:number,threshold:number}} param0
 * @returns {PmiClassificationResult}
 */
function classifyPmiState({
  propertyValue,
  downPaymentAmount,
  pmiRate,
  threshold,
}) {
  propertyValue = Number(propertyValue) || 0;
  downPaymentAmount = Number(downPaymentAmount) || 0;
  pmiRate = Number(pmiRate) || 0;
  threshold = Number(threshold) || 80;
  let loanAmount = Math.max(0, propertyValue - downPaymentAmount);
  let ltv = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 0;
  const meetsThreshold =
    propertyValue > 0 && loanAmount > 0 && ltv <= threshold;
  let badgeClass = "ltv-pending";
  if (propertyValue <= 0) badgeClass = "ltv-pending";
  else if (loanAmount === 0) badgeClass = "ltv-cash";
  else if (ltv <= threshold) badgeClass = "ltv-good";
  else if (ltv <= threshold + 5) badgeClass = "ltv-borderline";
  else badgeClass = "ltv-high";

  let state = "none";
  let statusText = "No PMI";
  // Spec wants propertyValue=0 -> pending even if loanAmount also 0 (editing state)
  if (propertyValue <= 0) {
    state = "pending";
    statusText = "Awaiting Value";
  } else if (loanAmount === 0) {
    state = "none";
    statusText = "No Loan (Cash Purchase)";
  } else if (pmiRate > 0 && ltv > threshold) {
    state = "active";
    statusText = "PMI Active";
  } else if (pmiRate > 0 && ltv <= threshold) {
    state = "ignored";
    statusText = "PMI Entered (Not Charged)";
  } else if (pmiRate === 0 && ltv > threshold) {
    state = "possible";
    statusText = "PMI Possible (Rate Blank)";
  }
  // override for meetsThreshold & no rate
  if (meetsThreshold && pmiRate === 0 && loanAmount > 0) {
    statusText = "No PMI Required";
    state = "none";
  }
  return {
    state,
    statusText,
    badgeClass,
    ltv: Number(ltv.toFixed(4)),
    meetsThreshold,
  };
}

module.exports = { classifyPmiState };
