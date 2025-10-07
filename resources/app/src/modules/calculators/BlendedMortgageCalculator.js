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
        assumptions: this.buildAssumptions({
          firstMortgage: firstMortgageResult,
          secondMortgage: secondMortgageResult,
          additionalComponents: additionalComponentResults,
        }),
        flags: this.buildInitialFlags({
          firstMortgage: firstMortgageResult,
          secondMortgage: secondMortgageResult,
          additionalComponents: additionalComponentResults,
        }),
        calculatedAt: new Date().toISOString(),
      };

      return this.calculationResults;
    } catch (error) {
      console.error("Blended mortgage calculation error:", error);
      throw error;
    }
  }

  /**
   * Build assumptions array (Phase 1 transparency)
   * Each assumption: { key, value, phase, rationale }
   */
  buildAssumptions(context) {
    const assumptions = [];
    // HELOC phase defaults
    const anyHeloc = [
      context.secondMortgage,
      ...(context.additionalComponents || []),
    ].filter((c) => c && c.type === "heloc");
    if (anyHeloc.length) {
      // Capture unique phase structures
      const phaseSignatures = new Set();
      anyHeloc.forEach((c) => {
        const draw = c.drawMonths || 120;
        const repay = c.repayMonths || 240;
        phaseSignatures.add(`${draw}/${repay}`);
      });
      assumptions.push({
        key: "helocPhaseDefaults",
        value: Array.from(phaseSignatures).join(","),
        phase: "P1",
        rationale:
          "HELOC modeled as draw + amortizing repay (defaults 120/240 when unspecified).",
      });
    }
    // Effective blended rate method
    assumptions.push({
      key: "effectiveRateMethod",
      value: "principalWeightedAverageNominal",
      phase: "pre-P3",
      rationale:
        "Simple principal-weighted average before payment-weighted upgrade (P3-2).",
    });
    // Zero-rate handling presence
    assumptions.push({
      key: "zeroRateHandling",
      value: "linearAmortizationWhenRate≈0",
      phase: "P1-3",
      rationale: "Avoid division by zero; pay principal evenly over term.",
    });
    // Rounding normalization
    assumptions.push({
      key: "roundingNormalization",
      value: "absorbResidual<5ToFinalPayment",
      phase: "P1-4",
      rationale:
        "Guarantee terminal balance ~0 without material payment distortion.",
    });
    return assumptions;
  }

  /**
   * Build initial flags object before schedule generation mutates/extends
   */
  buildInitialFlags(context) {
    const flags = {};
    const zeroRatePresent = [
      context.firstMortgage,
      context.secondMortgage,
      ...(context.additionalComponents || []),
    ].some(
      (c) => c && Math.abs((c.rate || 0) / 100 / 12) < 1e-12 && c.amount > 0
    );
    if (zeroRatePresent) flags.zeroRateHandled = true;
    return flags;
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
    let monthlyPayment;
    if (Math.abs(monthlyRate) < 1e-12) {
      monthlyPayment = amount / numPayments; // Zero-rate: straight-line principal repayment
    } else {
      monthlyPayment =
        (amount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1);
    }
    const totalPaid = monthlyPayment * numPayments;
    const totalInterest =
      Math.abs(monthlyRate) < 1e-12 ? 0 : totalPaid - amount;

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
        {
          const drawMonths = 10 * 12;
          const repaymentPayments = 20 * 12;
          const repaymentMonthlyRate = rate / 100 / 12;
          if (Math.abs(repaymentMonthlyRate) < 1e-12) {
            // Zero-rate HELOC: no interest; principal repaid evenly after draw
            monthlyPayment = 0; // during draw
            totalInterest = 0;
            totalPaid = amount; // only principal
            payoffTime = { years: 30, months: 0 };
          } else {
            monthlyPayment = (amount * rate) / 100 / 12; // interest-only draw payment
            const drawPeriodInterest = monthlyPayment * drawMonths;
            const repaymentMonthlyPayment =
              (amount *
                repaymentMonthlyRate *
                Math.pow(1 + repaymentMonthlyRate, repaymentPayments)) /
              (Math.pow(1 + repaymentMonthlyRate, repaymentPayments) - 1);
            const repaymentTotalPaid =
              repaymentMonthlyPayment * repaymentPayments;
            totalInterest = drawPeriodInterest + (repaymentTotalPaid - amount);
            totalPaid = amount + totalInterest;
            payoffTime = { years: 30, months: 0 };
          }
        }
        break;

      case "fixed":
        // Fixed term loan
        {
          const monthlyRate = rate / 100 / 12;
          const numPayments = term * 12;
          if (Math.abs(monthlyRate) < 1e-12) {
            monthlyPayment = amount / numPayments;
            totalPaid = amount;
            totalInterest = 0;
          } else {
            monthlyPayment =
              (amount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
              (Math.pow(1 + monthlyRate, numPayments) - 1);
            totalPaid = monthlyPayment * numPayments;
            totalInterest = totalPaid - amount;
          }
        }
        payoffTime = { years: term, months: 0 };
        break;

      case "variable":
        // Variable rate - use current rate for estimation
        {
          const varMonthlyRate = rate / 100 / 12;
          const varNumPayments = term * 12;
          if (Math.abs(varMonthlyRate) < 1e-12) {
            monthlyPayment = amount / varNumPayments;
            totalPaid = amount;
            totalInterest = 0;
          } else {
            monthlyPayment =
              (amount *
                varMonthlyRate *
                Math.pow(1 + varMonthlyRate, varNumPayments)) /
              (Math.pow(1 + varMonthlyRate, varNumPayments) - 1);
            totalPaid = monthlyPayment * varNumPayments;
            totalInterest = totalPaid - amount;
          }
        }
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
      case "heloc": {
        // Two-phase (draw + repayment) model for additional HELOC components
        const drawMonths = componentData.drawMonths || 120; // default 10 years
        const repayMonths = componentData.repayMonths || 240; // default 20 years
        const monthlyRate = rate / 100 / 12;
        if (Math.abs(monthlyRate) < 1e-12) {
          // Zero-rate: no interest during draw, straight-line principal repayment during repay phase
          const amortPayment = amount / repayMonths;
          totalInterest = 0;
          totalPaid = amount;
          monthlyPayment = amortPayment; // representative repayment phase payment
        } else {
          const ioPayment = amount * monthlyRate; // draw phase interest-only payment
          const drawInterest = ioPayment * drawMonths;
          const amortPayment =
            (amount * monthlyRate * Math.pow(1 + monthlyRate, repayMonths)) /
            (Math.pow(1 + monthlyRate, repayMonths) - 1);
          const repayTotalPaid = amortPayment * repayMonths;
          const repayInterest = repayTotalPaid - amount;
          totalInterest = drawInterest + repayInterest;
          totalPaid = amount + totalInterest;
          // Expose draw phase payment to mirror main HELOC display semantics
          monthlyPayment = ioPayment;
        }
        payoffTime = { years: (drawMonths + repayMonths) / 12, months: 0 };
        return {
          amount,
          rate,
          type,
          term,
          monthlyPayment,
          totalInterest,
          totalPaid,
          payoffTime,
          drawMonths,
          repayMonths,
        };
      }

      case "fixed":
      default:
        // Fixed term loan (same calculation as regular mortgage)
        {
          const monthlyRate = rate / 100 / 12;
          const numPayments = term * 12;
          if (Math.abs(monthlyRate) < 1e-12) {
            monthlyPayment = amount / numPayments;
            totalPaid = amount;
            totalInterest = 0;
          } else {
            monthlyPayment =
              (amount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
              (Math.pow(1 + monthlyRate, numPayments) - 1);
            totalPaid = monthlyPayment * numPayments;
            totalInterest = totalPaid - amount;
          }
        }
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
   * Helper producing two-phase HELOC interest/payment characteristics (not yet wiring schedules here).
   * @param {number} amount
   * @param {number} annualRatePercent
   * @param {number} drawMonths
   * @param {number} repayMonths
   * @returns {{drawInterest:number, repayInterest:number, totalInterest:number, amortPayment:number, interestOnlyPayment:number}}
   */
  buildTwoPhaseHeloc(
    amount,
    annualRatePercent,
    drawMonths = 120,
    repayMonths = 240
  ) {
    const r = annualRatePercent / 100 / 12;
    if (Math.abs(r) < 1e-12) {
      return {
        drawInterest: 0,
        repayInterest: 0,
        totalInterest: 0,
        amortPayment: amount / repayMonths,
        interestOnlyPayment: 0,
      };
    }
    const interestOnlyPayment = amount * r;
    const drawInterest = interestOnlyPayment * drawMonths;
    const amortPayment =
      (amount * r * Math.pow(1 + r, repayMonths)) /
      (Math.pow(1 + r, repayMonths) - 1);
    const repayTotalPaid = amortPayment * repayMonths;
    const repayInterest = repayTotalPaid - amount;
    return {
      drawInterest,
      repayInterest,
      totalInterest: drawInterest + repayInterest,
      amortPayment,
      interestOnlyPayment,
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

    if (firstMortgage.rate == null || firstMortgage.rate < 0) {
      errors.push("First mortgage interest rate must be >= 0");
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
        if (secondMortgage.rate == null || secondMortgage.rate < 0) {
          errors.push("Second mortgage interest rate must be >= 0");
        }
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

    const {
      firstMortgage,
      secondMortgage,
      additionalComponents = [],
    } = this.calculationResults;

    // Generate schedules for each component
    const firstSchedule = this.generateComponentSchedule(firstMortgage);
    const secondSchedule = this.generateComponentSchedule(secondMortgage);
    const additionalSchedules = additionalComponents.map((c) =>
      this.generateComponentSchedule(c)
    );

    // Combine schedules
    const maxPayments = Math.max(
      firstSchedule.length,
      secondSchedule.length,
      ...additionalSchedules.map((s) => s.length)
    );
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

      const additionalRows = additionalSchedules.map(
        (sched) =>
          sched[i] || {
            principalPayment: 0,
            interestPayment: 0,
            remainingBalance: 0,
          }
      );

      const additionalPrincipalSum = additionalRows.reduce(
        (s, r) => s + r.principalPayment,
        0
      );
      const additionalInterestSum = additionalRows.reduce(
        (s, r) => s + r.interestPayment,
        0
      );
      const additionalBalanceSum = additionalRows.reduce(
        (s, r) => s + r.remainingBalance,
        0
      );

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
        additionalComponents: additionalRows.map((r, idx) => ({
          principal: r.principalPayment,
          interest: r.interestPayment,
          balance: r.remainingBalance,
          index: idx,
        })),
        totalPrincipal:
          firstPayment.principalPayment +
          secondPayment.principalPayment +
          additionalPrincipalSum,
        totalInterest:
          firstPayment.interestPayment +
          secondPayment.interestPayment +
          additionalInterestSum,
        totalPayment:
          firstPayment.principalPayment +
          firstPayment.interestPayment +
          secondPayment.principalPayment +
          secondPayment.interestPayment +
          additionalPrincipalSum +
          additionalInterestSum,
        totalRemainingBalance:
          firstPayment.remainingBalance +
          secondPayment.remainingBalance +
          additionalBalanceSum,
      });
    }
    // Rounding normalization (P1-4): Adjust tiny residual combined balance by modifying final principal components.
    if (combinedSchedule.length > 0) {
      const lastRow = combinedSchedule[combinedSchedule.length - 1];
      const residual = lastRow.totalRemainingBalance;
      if (residual > 0.01 && residual < 5) {
        // Distribute residual across components prioritizing largest remaining balance contributor
        // (Should usually only happen on one component due to amort logic.)
        let remainingToAllocate = residual;
        // Helper to adjust a component and update aggregates
        const applyAdjustment = (principalFieldPath) => {
          if (remainingToAllocate <= 0) return;
          const segments = principalFieldPath.split(".");
          let ctx = lastRow;
          for (let i = 0; i < segments.length - 1; i++) ctx = ctx[segments[i]];
          const leafKey = segments[segments.length - 1];
          const currentPrincipal = ctx[leafKey];
          // Increase principal payment to absorb residual
          ctx[leafKey] = currentPrincipal + remainingToAllocate;
          remainingToAllocate = 0;
        };
        // Try first, then second, then additional components
        if (remainingToAllocate > 0 && lastRow.firstMortgage.balance > 0) {
          applyAdjustment("firstMortgage.principal");
        } else if (
          remainingToAllocate > 0 &&
          lastRow.secondMortgage.balance > 0
        ) {
          applyAdjustment("secondMortgage.principal");
        } else if (remainingToAllocate > 0) {
          // Find first additional component with balance >0
          const target = lastRow.additionalComponents.find(
            (c) => c.balance > 0
          );
          if (target) {
            const idx = target.index;
            applyAdjustment(`additionalComponents.${idx}.principal`);
          }
        }
        // Set balances to zero post adjustment
        lastRow.firstMortgage.balance = 0;
        lastRow.secondMortgage.balance = 0;
        lastRow.additionalComponents.forEach((c) => (c.balance = 0));
        lastRow.totalRemainingBalance = 0;
        // Recompute aggregate principal / payment on last row
        const addPrin = lastRow.additionalComponents.reduce(
          (s, c) => s + c.principal,
          0
        );
        const addInt = lastRow.additionalComponents.reduce(
          (s, c) => s + c.interest,
          0
        );
        lastRow.totalPrincipal =
          lastRow.firstMortgage.principal +
          lastRow.secondMortgage.principal +
          addPrin;
        lastRow.totalPayment = lastRow.totalPrincipal + lastRow.totalInterest; // interest unchanged by normalization
      } else if (residual > 0 && residual <= 0.01) {
        // Clean trivial residual without adjusting payment amounts (treat as floating-point noise)
        lastRow.firstMortgage.balance = 0;
        lastRow.secondMortgage.balance = 0;
        lastRow.additionalComponents.forEach((c) => (c.balance = 0));
        lastRow.totalRemainingBalance = 0;
      }
    }
    // Attach flag to results
    this.calculationResults = {
      ...this.calculationResults,
      flags: {
        ...(this.calculationResults.flags || {}),
        scheduleIncludesAdditional: true,
        normalizationApplied: true,
      },
    };
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
      // Support both main second-mortgage HELOC (fixed 10/20) and additional HELOCs (with drawMonths/repayMonths metadata)
      const drawMonths = component.drawMonths || 120; // default 10 years
      const repayMonths = component.repayMonths || 240; // default 20 years
      const r = rate / 100 / 12;
      const schedule = [];

      if (Math.abs(r) < 1e-12) {
        // Zero-rate: draw phase has no payments (interest = 0), repayment straight-line
        for (let i = 1; i <= drawMonths; i++) {
          schedule.push({
            paymentNumber: i,
            principalPayment: 0,
            interestPayment: 0,
            remainingBalance: amount,
          });
        }
        const amortPrincipalPayment = amount / repayMonths;
        let remainingBalance = amount;
        for (let j = 1; j <= repayMonths; j++) {
          const paymentNumber = drawMonths + j;
          let principalPayment = amortPrincipalPayment;
          if (principalPayment > remainingBalance)
            principalPayment = remainingBalance;
          remainingBalance -= principalPayment;
          schedule.push({
            paymentNumber,
            principalPayment,
            interestPayment: 0,
            remainingBalance: Math.max(0, remainingBalance),
          });
          if (remainingBalance <= 0.01) break;
        }
        return schedule;
      }

      // Draw phase: interest-only
      const ioInterestPayment = amount * r;
      for (let i = 1; i <= drawMonths; i++) {
        schedule.push({
          paymentNumber: i,
          principalPayment: 0,
          interestPayment: ioInterestPayment,
          remainingBalance: amount,
        });
      }
      // Repay phase: amortization
      const amortPayment =
        (amount * r * Math.pow(1 + r, repayMonths)) /
        (Math.pow(1 + r, repayMonths) - 1);
      let remainingBalance = amount;
      for (let j = 1; j <= repayMonths; j++) {
        const paymentNumber = drawMonths + j;
        const interestPayment = remainingBalance * r;
        let principalPayment = amortPayment - interestPayment;
        if (principalPayment > remainingBalance)
          principalPayment = remainingBalance;
        remainingBalance -= principalPayment;
        schedule.push({
          paymentNumber,
          principalPayment,
          interestPayment,
          remainingBalance: Math.max(0, remainingBalance),
        });
        if (remainingBalance <= 0.01) break;
      }
      // Component-level normalization (if tiny balance remains)
      if (remainingBalance > 0.01 && remainingBalance < 5) {
        const last = schedule[schedule.length - 1];
        last.principalPayment += remainingBalance;
        last.remainingBalance = 0;
      } else if (remainingBalance > 0 && remainingBalance <= 0.01) {
        const last = schedule[schedule.length - 1];
        last.remainingBalance = 0;
      }
      return schedule;
    } else {
      // Standard fixed-rate amortization (delegated to FixedAmortization util)
      try {
        // Lazy import to avoid circular refs in some bundlers
        const {
          computeFixedAmortization,
        } = require("./amortization/FixedAmortization");
        const termMonths = term * 12;
        const result = computeFixedAmortization({
          principal: amount,
          annualRate: rate,
          termMonths,
          payment: component.monthlyPayment, // maintain existing pre-computed payment parity
        });
        return result.schedule;
      } catch (e) {
        // Fallback to previous inline logic if import fails (defensive)
        const monthlyRate = rate / 100 / 12;
        const numPayments = term * 12;
        const monthlyPayment = component.monthlyPayment;
        const schedule = [];
        let remainingBalance = amount;
        for (let i = 1; i <= numPayments && remainingBalance > 0.01; i++) {
          const interestPayment = remainingBalance * monthlyRate;
          let principalPayment = monthlyPayment - interestPayment;
          if (principalPayment > remainingBalance)
            principalPayment = remainingBalance;
          remainingBalance -= principalPayment;
          schedule.push({
            paymentNumber: i,
            principalPayment,
            interestPayment,
            remainingBalance: Math.max(0, remainingBalance),
          });
        }
        if (remainingBalance > 0.01 && remainingBalance < 5) {
          const last = schedule[schedule.length - 1];
          last.principalPayment += remainingBalance;
          last.remainingBalance = 0;
        } else if (remainingBalance > 0 && remainingBalance <= 0.01) {
          const last = schedule[schedule.length - 1];
          last.remainingBalance = 0;
        }
        return schedule;
      }
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
