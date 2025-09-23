/**
 * BlendedMortgageCalculator - Handles calculations for blended mortgage products
 * Supports combinations like first mortgage + HELOC, fixed + variable rates, etc.
 */

class BlendedMortgageCalculator {
  constructor() {
    this.calculationResults = null;
  }

  /**
   * Calculate blended mortgage payments and totals
   * @param {Object} params - Blended mortgage parameters
   * @returns {Object} Calculation results
   */
  calculateBlendedMortgage(params) {
    try {
      const {
        homeValue = 0,
        downPayment = 0,
        firstMortgage = {},
        secondMortgage = {},
        additionalComponents = [],
        additionalCosts = {},
      } = params;

      // Validate inputs
      const validation = this.validateInputs(params);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(", "));
      }

      // Calculate first mortgage component
      const firstMortgageResult =
        this.calculateMortgageComponent(firstMortgage);

      // Calculate second mortgage component
      const secondMortgageResult =
        this.calculateSecondComponent(secondMortgage);

      // Calculate additional components
      const additionalComponentResults = additionalComponents.map((component) =>
        this.calculateAdditionalComponent(component)
      );

      // Calculate total monthly costs
      const totalAdditionalCosts =
        this.calculateAdditionalCosts(additionalCosts);

      // Calculate combined metrics
      const combinedResults = this.calculateCombinedMetrics(
        homeValue,
        downPayment,
        firstMortgageResult,
        secondMortgageResult,
        additionalComponentResults,
        totalAdditionalCosts
      );

      // Calculate loan-to-value ratios
      const additionalLoanAmounts = additionalComponents.map(
        (c) => c.amount || 0
      );
      const ltvMetrics = this.calculateLTVMetrics(
        homeValue,
        firstMortgage.amount,
        secondMortgage.amount,
        additionalLoanAmounts
      );

      this.calculationResults = {
        homeValue,
        downPayment,
        firstMortgage: firstMortgageResult,
        secondMortgage: secondMortgageResult,
        additionalComponents: additionalComponentResults,
        additionalCosts: totalAdditionalCosts,
        combined: combinedResults,
        ltv: ltvMetrics,
        calculatedAt: new Date().toISOString(),
      };

      return this.calculationResults;
    } catch (error) {
      console.error("Blended mortgage calculation error:", error);
      throw error;
    }
  }

  /**
   * Calculate standard mortgage component (fixed rate, fixed term)
   * @param {Object} mortgageData - Mortgage component data
   * @returns {Object} Mortgage component results
   */
  calculateMortgageComponent(mortgageData) {
    const { amount, rate, term } = mortgageData;

    if (!amount || amount <= 0) {
      return {
        amount: 0,
        monthlyPayment: 0,
        totalInterest: 0,
        totalPaid: 0,
        payoffTime: { years: 0, months: 0 },
      };
    }

    const monthlyRate = rate / 100 / 12;
    const numPayments = term * 12;

    // Calculate monthly payment using standard mortgage formula
    const monthlyPayment =
      (amount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    const totalPaid = monthlyPayment * numPayments;
    const totalInterest = totalPaid - amount;

    return {
      amount,
      rate,
      term,
      monthlyPayment,
      totalInterest,
      totalPaid,
      payoffTime: { years: term, months: 0 },
    };
  }

  /**
   * Calculate second mortgage component (HELOC, variable rate, etc.)
   * @param {Object} secondData - Second mortgage component data
   * @returns {Object} Second component results
   */
  calculateSecondComponent(secondData) {
    const { amount, rate, type, term = 15 } = secondData;

    if (!amount || amount <= 0) {
      return {
        amount: 0,
        monthlyPayment: 0,
        totalInterest: 0,
        totalPaid: 0,
        type: type || "heloc",
      };
    }

    let monthlyPayment = 0;
    let totalInterest = 0;
    let totalPaid = 0;
    let payoffTime = { years: 0, months: 0 };

    switch (type) {
      case "heloc":
        // Interest-only payment for HELOC
        monthlyPayment = (amount * rate) / 100 / 12;
        // For display purposes, assume 10-year draw period + 20-year repayment
        const drawPeriodInterest = monthlyPayment * 10 * 12;
        const repaymentMonthlyRate = rate / 100 / 12;
        const repaymentPayments = 20 * 12;
        const repaymentMonthlyPayment =
          (amount *
            repaymentMonthlyRate *
            Math.pow(1 + repaymentMonthlyRate, repaymentPayments)) /
          (Math.pow(1 + repaymentMonthlyRate, repaymentPayments) - 1);
        const repaymentTotalPaid = repaymentMonthlyPayment * repaymentPayments;
        totalInterest = drawPeriodInterest + (repaymentTotalPaid - amount);
        totalPaid = amount + totalInterest;
        payoffTime = { years: 30, months: 0 };
        break;

      case "fixed":
        // Fixed term loan
        const monthlyRate = rate / 100 / 12;
        const numPayments = term * 12;
        monthlyPayment =
          (amount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1);
        totalPaid = monthlyPayment * numPayments;
        totalInterest = totalPaid - amount;
        payoffTime = { years: term, months: 0 };
        break;

      case "variable":
        // Variable rate - use current rate for estimation
        const varMonthlyRate = rate / 100 / 12;
        const varNumPayments = term * 12;
        monthlyPayment =
          (amount *
            varMonthlyRate *
            Math.pow(1 + varMonthlyRate, varNumPayments)) /
          (Math.pow(1 + varMonthlyRate, varNumPayments) - 1);
        totalPaid = monthlyPayment * varNumPayments;
        totalInterest = totalPaid - amount;
        payoffTime = { years: term, months: 0 };
        break;

      default:
        monthlyPayment = 0;
    }

    return {
      amount,
      rate,
      type,
      term,
      monthlyPayment,
      totalInterest,
      totalPaid,
      payoffTime,
    };
  }

  /**
   * Calculate additional component (third, fourth, etc. mortgages/loans)
   * @param {Object} componentData - Component data
   * @returns {Object} Component calculation results
   */
  calculateAdditionalComponent(componentData) {
    const { amount, rate, type, term = 15 } = componentData;

    if (!amount || amount <= 0) {
      return {
        amount: 0,
        monthlyPayment: 0,
        totalInterest: 0,
        totalPaid: 0,
        type: type || "fixed",
        term: term,
      };
    }

    let monthlyPayment = 0;
    let totalInterest = 0;
    let totalPaid = 0;
    let payoffTime = { years: 0, months: 0 };

    switch (type) {
      case "heloc":
        // HELOC - interest only payments for draw period, then amortization
        monthlyPayment = (amount * rate) / 100 / 12;
        // Note: This is simplified - real HELOCs have draw and repayment periods
        totalPaid = monthlyPayment * term * 12; // Interest only estimate
        totalInterest = totalPaid - amount;
        payoffTime = { years: term, months: 0 };
        break;

      case "fixed":
      default:
        // Fixed term loan (same calculation as regular mortgage)
        const monthlyRate = rate / 100 / 12;
        const numPayments = term * 12;
        monthlyPayment =
          (amount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1);
        totalPaid = monthlyPayment * numPayments;
        totalInterest = totalPaid - amount;
        payoffTime = { years: term, months: 0 };
        break;
    }

    return {
      amount,
      rate,
      type,
      term,
      monthlyPayment,
      totalInterest,
      totalPaid,
      payoffTime,
    };
  }

  /**
   * Calculate total additional monthly costs
   * @param {Object} costs - Additional costs object
   * @returns {Object} Total additional costs
   */
  calculateAdditionalCosts(costs) {
    const { propertyTax = 0, insurance = 0, pmi = 0, other = 0 } = costs;

    const total = propertyTax + insurance + pmi + other;

    return {
      propertyTax,
      insurance,
      pmi,
      other,
      total,
    };
  }

  /**
   * Calculate combined metrics for the blended mortgage
   * @param {number} homeValue - Home value
   * @param {number} downPayment - Down payment
   * @param {Object} firstResult - First mortgage results
   * @param {Object} secondResult - Second mortgage results
   * @param {Object} additionalCosts - Additional costs
   * @returns {Object} Combined metrics
   */
  calculateCombinedMetrics(
    homeValue,
    downPayment,
    firstResult,
    secondResult,
    additionalComponentResults,
    additionalCosts
  ) {
    // Calculate totals from additional components
    const additionalMonthlyPayment = additionalComponentResults.reduce(
      (sum, component) => sum + component.monthlyPayment,
      0
    );
    const additionalInterest = additionalComponentResults.reduce(
      (sum, component) => sum + component.totalInterest,
      0
    );
    const additionalPrincipal = additionalComponentResults.reduce(
      (sum, component) => sum + component.amount,
      0
    );
    const additionalPaid = additionalComponentResults.reduce(
      (sum, component) => sum + component.totalPaid,
      0
    );

    // Monthly payments
    const totalMonthlyPayment =
      firstResult.monthlyPayment +
      secondResult.monthlyPayment +
      additionalMonthlyPayment +
      additionalCosts.total;

    const totalPrincipalInterest =
      firstResult.monthlyPayment +
      secondResult.monthlyPayment +
      additionalMonthlyPayment;

    // Total costs over life of loans
    const totalInterest =
      firstResult.totalInterest +
      secondResult.totalInterest +
      additionalInterest;
    const totalPrincipal =
      firstResult.amount + secondResult.amount + additionalPrincipal;
    const totalAmountFinanced = totalPrincipal;
    const totalPaid =
      firstResult.totalPaid + secondResult.totalPaid + additionalPaid;

    // Effective blended rate calculation
    const additionalWeightedRate = additionalComponentResults.reduce(
      (sum, component) => sum + component.amount * component.rate,
      0
    );
    const weightedRate =
      totalPrincipal > 0
        ? (firstResult.amount * firstResult.rate +
            secondResult.amount * secondResult.rate +
            additionalWeightedRate) /
          totalPrincipal
        : 0;

    // Calculate debt service ratios (assuming monthly income)
    const estimatedMonthlyIncome = totalMonthlyPayment / 0.28; // Assume 28% DTI for estimation
    const debtToIncomeRatio =
      (totalMonthlyPayment / estimatedMonthlyIncome) * 100;

    // Calculate break-even vs traditional mortgage
    const traditionalLoanAmount = totalPrincipal;
    const traditionalRate = 7.0; // Assume current market rate for comparison
    const traditionalMonthlyRate = traditionalRate / 100 / 12;
    const traditionalPayments = 30 * 12;
    const traditionalMonthlyPayment =
      (traditionalLoanAmount *
        traditionalMonthlyRate *
        Math.pow(1 + traditionalMonthlyRate, traditionalPayments)) /
      (Math.pow(1 + traditionalMonthlyRate, traditionalPayments) - 1);

    const monthlySavings = traditionalMonthlyPayment - totalPrincipalInterest;
    const annualSavings = monthlySavings * 12;

    return {
      totalMonthlyPayment,
      totalPrincipalInterest,
      totalInterest,
      totalPrincipal,
      totalAmountFinanced,
      totalPaid,
      effectiveBlendedRate: weightedRate,
      debtToIncomeRatio,
      comparison: {
        traditionalMonthlyPayment,
        monthlySavings,
        annualSavings,
      },
    };
  }

  /**
   * Calculate loan-to-value metrics
   * @param {number} homeValue - Home value
   * @param {number} firstAmount - First mortgage amount
   * @param {number} secondAmount - Second mortgage amount
   * @returns {Object} LTV metrics
   */
  calculateLTVMetrics(
    homeValue,
    firstAmount,
    secondAmount,
    additionalLoanAmounts = []
  ) {
    if (homeValue <= 0) {
      return {
        firstMortgageLTV: 0,
        combinedLTV: 0,
        availableEquity: 0,
      };
    }

    const totalAdditionalAmount = additionalLoanAmounts.reduce(
      (sum, amount) => sum + amount,
      0
    );
    const totalLoanAmount = firstAmount + secondAmount + totalAdditionalAmount;

    const firstMortgageLTV = (firstAmount / homeValue) * 100;
    const combinedLTV = (totalLoanAmount / homeValue) * 100;
    const availableEquity = homeValue - totalLoanAmount;

    return {
      firstMortgageLTV,
      combinedLTV,
      availableEquity,
      homeValue,
      totalLoanAmount,
    };
  }

  /**
   * Validate blended mortgage inputs
   * @param {Object} params - Input parameters
   * @returns {Object} Validation result
   */
  validateInputs(params) {
    const errors = [];
    const {
      homeValue = 0,
      downPayment = 0,
      firstMortgage = {},
      secondMortgage = {},
    } = params;

    // Home value validation
    if (!homeValue || homeValue <= 0) {
      errors.push("Home value must be greater than 0");
    }

    // Down payment validation
    if (downPayment < 0) {
      errors.push("Down payment cannot be negative");
    }

    if (downPayment >= homeValue) {
      errors.push("Down payment must be less than home value");
    }

    // First mortgage validation
    if (!firstMortgage.amount || firstMortgage.amount <= 0) {
      errors.push("First mortgage amount must be greater than 0");
    }

    if (!firstMortgage.rate || firstMortgage.rate <= 0) {
      errors.push("First mortgage interest rate must be greater than 0");
    }

    if (firstMortgage.rate > 50) {
      errors.push("First mortgage interest rate seems unusually high");
    }

    if (!firstMortgage.term || firstMortgage.term <= 0) {
      errors.push("First mortgage term must be greater than 0");
    }

    // Second mortgage validation (optional)
    if (secondMortgage.amount && secondMortgage.amount > 0) {
      if (!secondMortgage.rate || secondMortgage.rate <= 0) {
        errors.push("Second mortgage interest rate must be greater than 0");
      }

      if (secondMortgage.rate > 50) {
        errors.push("Second mortgage interest rate seems unusually high");
      }

      // Combined LTV check
      const totalLoanAmount = firstMortgage.amount + secondMortgage.amount;
      const totalFinanced = totalLoanAmount + downPayment;

      if (totalFinanced > homeValue * 1.05) {
        // Allow 5% tolerance for closing costs
        errors.push("Total financing exceeds home value");
      }

      const combinedLTV = (totalLoanAmount / homeValue) * 100;
      if (combinedLTV > 95) {
        errors.push("Combined loan-to-value ratio exceeds 95%");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate amortization schedule for blended mortgage
   * @param {Object} params - Mortgage parameters
   * @returns {Array} Combined amortization schedule
   */
  generateBlendedAmortizationSchedule(params) {
    if (!this.calculationResults) {
      this.calculateBlendedMortgage(params);
    }

    const { firstMortgage, secondMortgage } = this.calculationResults;

    // Generate schedules for each component
    const firstSchedule = this.generateComponentSchedule(firstMortgage);
    const secondSchedule = this.generateComponentSchedule(secondMortgage);

    // Combine schedules
    const maxPayments = Math.max(firstSchedule.length, secondSchedule.length);
    const combinedSchedule = [];

    for (let i = 0; i < maxPayments; i++) {
      const firstPayment = firstSchedule[i] || {
        principalPayment: 0,
        interestPayment: 0,
        remainingBalance: 0,
      };
      const secondPayment = secondSchedule[i] || {
        principalPayment: 0,
        interestPayment: 0,
        remainingBalance: 0,
      };

      combinedSchedule.push({
        paymentNumber: i + 1,
        firstMortgage: {
          principal: firstPayment.principalPayment,
          interest: firstPayment.interestPayment,
          balance: firstPayment.remainingBalance,
        },
        secondMortgage: {
          principal: secondPayment.principalPayment,
          interest: secondPayment.interestPayment,
          balance: secondPayment.remainingBalance,
        },
        totalPrincipal:
          firstPayment.principalPayment + secondPayment.principalPayment,
        totalInterest:
          firstPayment.interestPayment + secondPayment.interestPayment,
        totalPayment:
          firstPayment.principalPayment +
          firstPayment.interestPayment +
          secondPayment.principalPayment +
          secondPayment.interestPayment,
        totalRemainingBalance:
          firstPayment.remainingBalance + secondPayment.remainingBalance,
      });
    }

    return combinedSchedule;
  }

  /**
   * Generate amortization schedule for individual component
   * @param {Object} component - Mortgage component
   * @returns {Array} Amortization schedule
   */
  generateComponentSchedule(component) {
    if (!component.amount || component.amount <= 0) {
      return [];
    }

    const { amount, rate, term, type } = component;

    if (type === "heloc") {
      // HELOC typically has interest-only payments during draw period
      const schedule = [];
      const monthlyInterest = (amount * rate) / 100 / 12;

      // 10-year draw period (interest only)
      for (let i = 1; i <= 120; i++) {
        schedule.push({
          paymentNumber: i,
          principalPayment: 0,
          interestPayment: monthlyInterest,
          remainingBalance: amount,
        });
      }

      // 20-year repayment period
      const repaymentRate = rate / 100 / 12;
      const repaymentPayments = 240;
      let remainingBalance = amount;

      const monthlyPayment =
        (amount *
          repaymentRate *
          Math.pow(1 + repaymentRate, repaymentPayments)) /
        (Math.pow(1 + repaymentRate, repaymentPayments) - 1);

      for (let i = 121; i <= 360; i++) {
        const interestPayment = remainingBalance * repaymentRate;
        const principalPayment = monthlyPayment - interestPayment;
        remainingBalance -= principalPayment;

        schedule.push({
          paymentNumber: i,
          principalPayment,
          interestPayment,
          remainingBalance: Math.max(0, remainingBalance),
        });

        if (remainingBalance <= 0.01) break;
      }

      return schedule;
    } else {
      // Standard fixed-rate amortization
      const monthlyRate = rate / 100 / 12;
      const numPayments = term * 12;
      const monthlyPayment = component.monthlyPayment;

      const schedule = [];
      let remainingBalance = amount;

      for (let i = 1; i <= numPayments && remainingBalance > 0.01; i++) {
        const interestPayment = remainingBalance * monthlyRate;
        let principalPayment = monthlyPayment - interestPayment;

        if (principalPayment > remainingBalance) {
          principalPayment = remainingBalance;
        }

        remainingBalance -= principalPayment;

        schedule.push({
          paymentNumber: i,
          principalPayment,
          interestPayment,
          remainingBalance: Math.max(0, remainingBalance),
        });
      }

      return schedule;
    }
  }

  /**
   * Get calculation results
   * @returns {Object|null} Last calculation results
   */
  getResults() {
    return this.calculationResults;
  }

  /**
   * Clear calculation results
   */
  clearResults() {
    this.calculationResults = null;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = BlendedMortgageCalculator;
} else {
  window.BlendedMortgageCalculator = BlendedMortgageCalculator;
}
