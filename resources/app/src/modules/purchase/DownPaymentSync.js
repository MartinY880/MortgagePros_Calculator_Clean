// Pure down payment sync state machine for testing (Task 17a extraction)
// Mirrors logic from attachDownPaymentSyncListeners related helpers.
/**
 * Drift thresholds:
 *  - Amount changes < $1 ignored for counterpart updates
 *  - Percent changes < 0.01% ignored for counterpart updates
 * Percent is soft-clamped to <100 (99.99) to avoid division artifacts.
 *
 * @typedef {Object} DownPaymentSyncState
 * @property {number} propertyValue
 * @property {number} amount Down payment dollars
 * @property {number} percent Down payment percent
 * @property {('amount'|'percent'|'property'|null)} lastSource Last edited field
 *
 * @typedef {Object} DownPaymentEdit
 * @property {'amount'|'percent'|'property'} field Field edited
 * @property {number} value New value
 */

function roundAmount(v) {
  return Math.round(v);
}
function roundPercent(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

const DRIFT_AMOUNT = 1; // <$1 ignore
const DRIFT_PERCENT = 0.01; // <0.01% ignore

function clampPercent(p) {
  if (p < 0) return 0;
  if (p >= 100) return 99.99; // soft clamp
  return p;
}

// state: { propertyValue, amount, percent, lastSource }
// edit: { field: 'amount'|'percent'|'property', value }
// options: { debounceFlush?: boolean }
/**
 * Process a single edit event and produce next sync state.
 * @param {DownPaymentSyncState} state
 * @param {DownPaymentEdit} edit
 * @returns {DownPaymentSyncState}
 */
function processEdit(state, edit) {
  let { propertyValue, amount, percent, lastSource } = state;
  const { field, value } = edit;
  if (field === "property") {
    propertyValue = value;
    // Recompute dependent side based on last source rule
    if (lastSource === "amount") {
      // recompute percent from amount
      if (propertyValue <= 0) {
        percent = 0;
      } else {
        let pct = clampPercent((amount / propertyValue) * 100);
        const pctRounded = roundPercent(pct);
        // Apply if drift >= threshold
        if (Math.abs(pctRounded - percent) >= DRIFT_PERCENT)
          percent = pctRounded;
        lastSource = "amount";
      }
    } else {
      // recompute amount from percent
      if (propertyValue <= 0) {
        amount = 0;
      } else {
        let pctClamped = clampPercent(percent);
        const amt = roundAmount((propertyValue * pctClamped) / 100);
        if (Math.abs(amt - amount) >= DRIFT_AMOUNT) amount = amt;
        lastSource = "percent";
      }
    }
  } else if (field === "amount") {
    amount = value;
    lastSource = "amount";
    if (propertyValue <= 0) {
      percent = 0;
    } else {
      let pct = clampPercent((amount / propertyValue) * 100);
      const pctRounded = roundPercent(pct);
      if (Math.abs(pctRounded - percent) >= DRIFT_PERCENT) percent = pctRounded;
    }
  } else if (field === "percent") {
    const prevPercent = percent;
    percent = clampPercent(value);
    lastSource = "percent";
    if (propertyValue <= 0) {
      amount = 0;
      percent = 0;
    } else {
      // Ignore if delta < 0.01% (no counterpart update)
      if (Math.abs(percent - prevPercent) < DRIFT_PERCENT) {
        // keep amount unchanged
      } else {
        const amt = roundAmount((propertyValue * percent) / 100);
        if (Math.abs(amt - amount) >= DRIFT_AMOUNT) amount = amt;
      }
    }
  }
  return { propertyValue, amount, percent: roundPercent(percent), lastSource };
}

module.exports = { processEdit, clampPercent, roundPercent, roundAmount };
