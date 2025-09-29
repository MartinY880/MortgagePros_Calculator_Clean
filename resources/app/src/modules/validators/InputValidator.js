/**
 * InputValidator - Handles all form and data validation operations
 */

class InputValidator {
  /**
   * Validate mortgage/loan input parameters
   * @param {Object} params - Parameters to validate
   * @param {number} params.homePrice - Home purchase price
   * @param {number} params.downPayment - Down payment amount
   * @param {number} params.loanAmount - Loan amount
   * @param {number} params.interestRate - Annual interest rate
   * @param {number} params.loanTerm - Loan term in years
   * @param {string} formType - Form type ('purchase', 'refinance', 'heloc', 'comparison')
   * @returns {Object} Validation result with isValid flag and errors array
   */
  static validateLoanInputs(params, formType = "purchase") {
    const errors = [];
    const {
      homePrice = 0,
      downPayment = 0,
      loanAmount = 0,
      interestRate = 0,
      loanTerm = 0,
      propertyTax = 0,
      homeInsurance = 0,
      pmi = 0,
      extraPayment = 0,
      closingCosts = 0,
    } = params;

    // Common validations for all form types
    if (!loanAmount || loanAmount <= 0) {
      errors.push("Loan amount must be greater than 0");
    }

    if (!interestRate || interestRate <= 0) {
      errors.push("Interest rate must be greater than 0");
    }

    if (interestRate > 50) {
      errors.push("Interest rate seems unusually high (over 50%)");
    }

    if (!loanTerm || loanTerm <= 0) {
      errors.push("Loan term must be greater than 0");
    }

    if (loanTerm > 50) {
      errors.push("Loan term seems unusually long (over 50 years)");
    }

    // Purchase-specific validations
    if (formType === "purchase") {
      if (!homePrice || homePrice <= 0) {
        errors.push("Home price must be greater than 0");
      }

      if (downPayment < 0) {
        errors.push("Down payment cannot be negative");
      }

      if (downPayment >= homePrice) {
        errors.push("Down payment must be less than home price");
      }

      if (loanAmount !== homePrice - downPayment) {
        errors.push("Loan amount must equal home price minus down payment");
      }

      // Check for reasonable down payment percentage (warn if less than 3%)
      if (homePrice > 0 && downPayment / homePrice < 0.03) {
        errors.push(
          "Down payment is less than 3% - this may require special loan programs"
        );
      }
    }

    // Refinance-specific validations
    if (formType === "refinance") {
      if (loanAmount > 2000000) {
        errors.push("Loan amount exceeds typical conforming loan limits");
      }
    }

    // Optional field validations
    if (propertyTax < 0) {
      errors.push("Property tax cannot be negative");
    }

    if (homeInsurance < 0) {
      errors.push("Home insurance cannot be negative");
    }

    if (pmi < 0) {
      errors.push("PMI cannot be negative");
    }

    if (extraPayment < 0) {
      errors.push("Extra payment cannot be negative");
    }

    if (closingCosts < 0) {
      errors.push("Closing costs cannot be negative");
    }

    // Reasonableness checks
    if (loanAmount > 0 && extraPayment > loanAmount * 0.1) {
      errors.push(
        "Extra payment seems unusually high (over 10% of loan amount)"
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate HELOC input parameters
   * @param {Object} params - HELOC parameters to validate
   * @returns {Object} Validation result
   */
  static validateHELOCInputs(params) {
    const errors = [];
    const {
      homeValue = 0,
      mortgageBalance = 0,
      creditLimit = 0,
      interestRate = 0,
      drawPeriod = 0,
      repaymentPeriod = 0,
      drawAmount = 0,
    } = params;

    if (!homeValue || homeValue <= 0) {
      errors.push("Home value must be greater than 0");
    }

    if (mortgageBalance < 0) {
      errors.push("Mortgage balance cannot be negative");
    }

    if (mortgageBalance >= homeValue) {
      errors.push("Mortgage balance must be less than home value");
    }

    if (!creditLimit || creditLimit <= 0) {
      errors.push("Credit limit must be greater than 0");
    }

    if (!interestRate || interestRate <= 0) {
      errors.push("Interest rate must be greater than 0");
    }

    if (interestRate > 30) {
      errors.push("Interest rate seems unusually high for HELOC (over 30%)");
    }

    if (!drawPeriod || drawPeriod <= 0) {
      errors.push("Draw period must be greater than 0");
    }

    if (drawPeriod > 30) {
      errors.push("Draw period seems unusually long (over 30 years)");
    }

    if (!repaymentPeriod || repaymentPeriod <= 0) {
      errors.push("Repayment period must be greater than 0");
    }

    if (repaymentPeriod > 30) {
      errors.push("Repayment period seems unusually long (over 30 years)");
    }

    if (drawAmount < 0) {
      errors.push("Draw amount cannot be negative");
    }

    if (drawAmount > creditLimit) {
      errors.push("Draw amount cannot exceed credit limit");
    }

    // Check combined loan-to-value ratio
    const combinedLTV = ((mortgageBalance + creditLimit) / homeValue) * 100;
    if (combinedLTV > 90) {
      errors.push(
        "Combined loan-to-value ratio exceeds 90% - this may not be available"
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      combinedLTV: Math.round(combinedLTV * 100) / 100,
    };
  }

  /**
   * Validate loan comparison inputs
   * @param {Array} loanOptions - Array of loan data objects to validate
   * @returns {Object} Validation result
   */
  static validateComparisonInputs(loanOptions) {
    const errors = [];
    const validLoans = [];

    if (!Array.isArray(loanOptions) || loanOptions.length === 0) {
      errors.push("At least one loan option is required for comparison");
      return { isValid: false, errors, validLoans };
    }

    loanOptions.forEach((loan, index) => {
      const loanErrors = [];
      const {
        name = "",
        amount = 0,
        rate = 0,
        term = 0,
        appraisedValue = 0,
        propertyTax = 0,
        homeInsurance = 0,
        pmi = 0,
        extra = 0,
      } = loan;

      const loanName = name || `Option ${index + 1}`;

      if (!amount || amount <= 0) {
        loanErrors.push(`${loanName}: Loan amount must be greater than 0`);
      }

      if (!rate || rate <= 0) {
        loanErrors.push(`${loanName}: Interest rate must be greater than 0`);
      }

      if (rate > 50) {
        loanErrors.push(
          `${loanName}: Interest rate seems unusually high (over 50%)`
        );
      }

      if (!term || term <= 0) {
        loanErrors.push(`${loanName}: Loan term must be greater than 0`);
      }

      if (term > 50) {
        loanErrors.push(
          `${loanName}: Loan term seems unusually long (over 50 years)`
        );
      }

      if (appraisedValue < 0) {
        loanErrors.push(`${loanName}: Appraised value cannot be negative`);
      }

      if (propertyTax < 0) {
        loanErrors.push(`${loanName}: Property tax cannot be negative`);
      }

      if (propertyTax > 5000) {
        loanErrors.push(
          `${loanName}: Property tax amount seems unusually high (over $5,000/month)`
        );
      }

      if (homeInsurance < 0) {
        loanErrors.push(`${loanName}: Home insurance cannot be negative`);
      }

      if (pmi < 0) {
        loanErrors.push(`${loanName}: PMI cannot be negative`);
      }

      if (extra < 0) {
        loanErrors.push(`${loanName}: Extra payment cannot be negative`);
      }

      if (loanErrors.length === 0) {
        validLoans.push({ ...loan, name: loanName, isValid: true });
      } else {
        errors.push(...loanErrors);
      }
    });

    if (validLoans.length < 2) {
      errors.push("At least 2 valid loan options are required for comparison");
    }

    return {
      isValid: errors.length === 0,
      errors,
      validLoans,
    };
  }

  /**
   * Validate individual form field values
   * @param {string} fieldType - Type of field ('currency', 'percentage', 'number', 'year')
   * @param {string|number} value - Value to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateField(fieldType, value, options = {}) {
    const errors = [];
    const {
      min = null,
      max = null,
      required = false,
      fieldName = "Field",
    } = options;

    // Handle empty values
    if (value === "" || value === null || value === undefined) {
      if (required) {
        errors.push(`${fieldName} is required`);
      }
      return {
        isValid: !required,
        errors,
        cleanValue: required ? null : 0,
      };
    }

    // Convert to number
    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      errors.push(`${fieldName} must be a valid number`);
      return { isValid: false, errors, cleanValue: null };
    }

    // Field-specific validations
    switch (fieldType) {
      case "currency":
        if (numValue < 0) {
          errors.push(`${fieldName} cannot be negative`);
        }
        break;

      case "percentage":
        if (numValue < 0) {
          errors.push(`${fieldName} cannot be negative`);
        }
        if (numValue > 100 && fieldName.toLowerCase().includes("rate")) {
          errors.push(`${fieldName} cannot exceed 100%`);
        }
        break;

      case "number":
        // Generic number validation
        break;

      case "year":
        const currentYear = new Date().getFullYear();
        if (numValue < 1 || numValue > 50) {
          errors.push(`${fieldName} must be between 1 and 50 years`);
        }
        break;
    }

    // Min/max validations
    if (min !== null && numValue < min) {
      errors.push(`${fieldName} must be at least ${min}`);
    }

    if (max !== null && numValue > max) {
      errors.push(`${fieldName} cannot exceed ${max}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      cleanValue: numValue,
    };
  }

  /**
   * Validate email address format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email format
   */
  static validateEmail(email) {
    if (!email || typeof email !== "string") {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number to validate
   * @returns {boolean} True if valid phone format
   */
  static validatePhone(phone) {
    if (!phone || typeof phone !== "string") {
      return false;
    }

    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, "");

    // Check for valid US phone number length (10 or 11 digits)
    return (
      cleaned.length === 10 ||
      (cleaned.length === 11 && cleaned.startsWith("1"))
    );
  }

  /**
   * Sanitize string input (remove potentially harmful characters)
   * @param {string} input - String to sanitize
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized string
   */
  static sanitizeString(input, options = {}) {
    const {
      allowHTML = false,
      maxLength = null,
      allowSpecialChars = true,
    } = options;

    if (!input || typeof input !== "string") {
      return "";
    }

    let cleaned = input;

    // Remove HTML tags if not allowed
    if (!allowHTML) {
      cleaned = cleaned.replace(/<[^>]*>/g, "");
    }

    // Remove special characters if not allowed
    if (!allowSpecialChars) {
      cleaned = cleaned.replace(/[^a-zA-Z0-9\s\-_.]/g, "");
    }

    // Trim and limit length
    cleaned = cleaned.trim();
    if (maxLength && cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
    }

    return cleaned;
  }

  /**
   * Check if loan parameters are reasonable/realistic
   * @param {Object} params - Loan parameters
   * @returns {Array} Array of warning messages
   */
  static getReasonablenessWarnings(params) {
    const warnings = [];
    const {
      homePrice = 0,
      loanAmount = 0,
      interestRate = 0,
      downPayment = 0,
      pmi = 0,
      propertyTax = 0,
      homeInsurance = 0,
    } = params;

    // Down payment warnings
    if (homePrice > 0 && downPayment > 0) {
      const downPaymentPercent = (downPayment / homePrice) * 100;

      if (downPaymentPercent < 5) {
        warnings.push(
          "Down payment is less than 5% - consider the impact on PMI and loan approval"
        );
      } else if (downPaymentPercent > 50) {
        warnings.push(
          "Down payment is over 50% - consider investment alternatives for excess cash"
        );
      }
    }

    // Interest rate warnings
    if (interestRate < 2) {
      warnings.push(
        "Interest rate is unusually low - verify this rate is available"
      );
    } else if (interestRate > 15) {
      warnings.push(
        "Interest rate is quite high - consider improving credit or shopping for better rates"
      );
    }

    // PMI warnings
    if (pmi > 0 && homePrice > 0 && downPayment > 0) {
      const ltvRatio = (loanAmount / homePrice) * 100;
      if (ltvRatio <= 80) {
        warnings.push(
          "PMI may not be required with loan-to-value ratio of 80% or less"
        );
      }
    }

    // Property tax warnings
    if (propertyTax > 2000) {
      warnings.push("Property tax exceeds $2,000/month - this is quite high");
    }

    // Home insurance warnings
    if (homeInsurance > 0 && loanAmount > 0) {
      const insuranceRatio = (homeInsurance * 12) / loanAmount;
      if (insuranceRatio > 0.02) {
        warnings.push(
          "Home insurance seems high relative to loan amount - verify coverage needs"
        );
      }
    }

    return warnings;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = InputValidator;
} else {
  window.InputValidator = InputValidator;
}
