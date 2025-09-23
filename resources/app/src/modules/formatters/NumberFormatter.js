/**
 * NumberFormatter - Handles all number and currency formatting operations
 */

class NumberFormatter {
  /**
   * Format a number as currency (USD)
   * @param {number|string} value - The value to format
   * @param {Object} options - Formatting options
   * @param {boolean} options.includeCents - Whether to include cents (default: false)
   * @param {string} options.locale - Locale for formatting (default: 'en-US')
   * @param {string} options.currency - Currency code (default: 'USD')
   * @returns {string} Formatted currency string
   */
  static formatCurrency(value, options = {}) {
    const {
      includeCents = false,
      locale = "en-US",
      currency = "USD",
    } = options;

    // Handle invalid values
    if (value === undefined || value === null || isNaN(value)) {
      return "$0";
    }

    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return "$0";
    }

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: includeCents ? 2 : 0,
      maximumFractionDigits: includeCents ? 2 : 0,
    }).format(numValue);
  }

  /**
   * Format a number for display (with commas, no currency symbol)
   * @param {number|string} value - The value to format
   * @param {Object} options - Formatting options
   * @param {number} options.decimals - Number of decimal places (default: 2)
   * @param {string} options.locale - Locale for formatting (default: 'en-US')
   * @returns {string} Formatted number string
   */
  static formatNumber(value, options = {}) {
    const { decimals = 2, locale = "en-US" } = options;

    // Handle invalid values
    if (value === undefined || value === null || isNaN(value)) {
      return "0";
    }

    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return "0";
    }

    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numValue);
  }

  /**
   * Format a percentage value
   * @param {number|string} value - The percentage value (as decimal or percentage)
   * @param {Object} options - Formatting options
   * @param {number} options.decimals - Number of decimal places (default: 2)
   * @param {boolean} options.isDecimal - Whether input is decimal (0.05) or percentage (5) (default: false)
   * @returns {string} Formatted percentage string
   */
  static formatPercentage(value, options = {}) {
    const { decimals = 2, isDecimal = false } = options;

    // Handle invalid values
    if (value === undefined || value === null || isNaN(value)) {
      return "0%";
    }

    let numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return "0%";
    }

    // Convert decimal to percentage if needed
    if (isDecimal) {
      numValue = numValue * 100;
    }

    return `${numValue.toFixed(decimals)}%`;
  }

  /**
   * Format a number for input fields (removes formatting, returns clean number)
   * @param {string} formattedValue - The formatted string value
   * @returns {string} Clean number string suitable for input fields
   */
  static unformatNumber(formattedValue) {
    if (!formattedValue || typeof formattedValue !== "string") {
      return "";
    }

    // Remove currency symbols, commas, spaces, and other non-numeric characters except decimal point
    const cleaned = formattedValue.replace(/[^0-9.-]/g, "");

    // Handle multiple decimal points by keeping only the first one
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }

    return cleaned;
  }

  /**
   * Format time duration (months to years and months)
   * @param {number} totalMonths - Total number of months
   * @param {Object} options - Formatting options
   * @param {boolean} options.short - Use short format (5y 3m vs 5 years 3 months)
   * @returns {string} Formatted duration string
   */
  static formatDuration(totalMonths, options = {}) {
    const { short = false } = options;

    if (!totalMonths || totalMonths <= 0) {
      return short ? "0m" : "0 months";
    }

    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    if (short) {
      if (years > 0 && months > 0) {
        return `${years}y ${months}m`;
      } else if (years > 0) {
        return `${years}y`;
      } else {
        return `${months}m`;
      }
    } else {
      const yearText = years === 1 ? "year" : "years";
      const monthText = months === 1 ? "month" : "months";

      if (years > 0 && months > 0) {
        return `${years} ${yearText} ${months} ${monthText}`;
      } else if (years > 0) {
        return `${years} ${yearText}`;
      } else {
        return `${months} ${monthText}`;
      }
    }
  }

  /**
   * Format loan term for display
   * @param {number} termInYears - Loan term in years
   * @returns {string} Formatted term string
   */
  static formatLoanTerm(termInYears) {
    if (!termInYears || termInYears <= 0) {
      return "0 years";
    }

    const years = Math.floor(termInYears);
    const months = Math.round((termInYears - years) * 12);

    if (years > 0 && months > 0) {
      return `${years} years ${months} months`;
    } else if (years > 0) {
      const yearText = years === 1 ? "year" : "years";
      return `${years} ${yearText}`;
    } else {
      const monthText = months === 1 ? "month" : "months";
      return `${months} ${monthText}`;
    }
  }

  /**
   * Format interest rate for display
   * @param {number|string} rate - Interest rate (as percentage)
   * @param {Object} options - Formatting options
   * @param {number} options.decimals - Number of decimal places (default: 3)
   * @returns {string} Formatted rate string
   */
  static formatInterestRate(rate, options = {}) {
    const { decimals = 3 } = options;

    // Handle invalid values
    if (rate === undefined || rate === null || isNaN(rate)) {
      return "0.000%";
    }

    const numValue = typeof rate === "string" ? parseFloat(rate) : rate;

    if (isNaN(numValue)) {
      return "0.000%";
    }

    return `${numValue.toFixed(decimals)}%`;
  }

  /**
   * Format a large number with appropriate units (K, M, B)
   * @param {number} value - The value to format
   * @param {Object} options - Formatting options
   * @param {number} options.decimals - Number of decimal places (default: 1)
   * @param {boolean} options.currency - Whether to format as currency (default: false)
   * @returns {string} Formatted string with units
   */
  static formatLargeNumber(value, options = {}) {
    const { decimals = 1, currency = false } = options;

    // Handle invalid values
    if (value === undefined || value === null || isNaN(value)) {
      return currency ? "$0" : "0";
    }

    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return currency ? "$0" : "0";
    }

    const abs = Math.abs(numValue);
    const sign = numValue < 0 ? "-" : "";
    const prefix = currency ? "$" : "";

    if (abs >= 1e9) {
      return `${sign}${prefix}${(abs / 1e9).toFixed(decimals)}B`;
    } else if (abs >= 1e6) {
      return `${sign}${prefix}${(abs / 1e6).toFixed(decimals)}M`;
    } else if (abs >= 1e3) {
      return `${sign}${prefix}${(abs / 1e3).toFixed(decimals)}K`;
    } else {
      return currency
        ? this.formatCurrency(numValue)
        : this.formatNumber(numValue, { decimals });
    }
  }

  /**
   * Validate and clean numeric input
   * @param {string} input - The input string
   * @param {Object} options - Validation options
   * @param {boolean} options.allowNegative - Allow negative values (default: false)
   * @param {boolean} options.allowDecimals - Allow decimal values (default: true)
   * @param {number} options.maxDecimals - Maximum decimal places (default: 2)
   * @returns {string} Cleaned input string
   */
  static cleanNumericInput(input, options = {}) {
    const {
      allowNegative = false,
      allowDecimals = true,
      maxDecimals = 2,
    } = options;

    if (!input || typeof input !== "string") {
      return "";
    }

    let cleaned = input;

    // Remove all non-numeric characters except decimal point and minus sign
    const allowedChars = allowDecimals ? "0-9." : "0-9";
    const pattern = allowNegative
      ? `[^${allowedChars}-]`
      : `[^${allowedChars}]`;
    cleaned = cleaned.replace(new RegExp(pattern, "g"), "");

    // Handle negative sign (only at the beginning)
    if (allowNegative) {
      const minusMatches = cleaned.match(/-/g);
      if (minusMatches && minusMatches.length > 0) {
        cleaned =
          (cleaned.charAt(0) === "-" ? "-" : "") + cleaned.replace(/-/g, "");
      }
    }

    // Handle decimal points (only one allowed)
    if (allowDecimals) {
      const parts = cleaned.split(".");
      if (parts.length > 2) {
        cleaned = parts[0] + "." + parts.slice(1).join("");
      }

      // Limit decimal places
      if (parts.length === 2 && parts[1].length > maxDecimals) {
        cleaned = parts[0] + "." + parts[1].substring(0, maxDecimals);
      }
    }

    return cleaned;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = NumberFormatter;
} else {
  window.NumberFormatter = NumberFormatter;
}
