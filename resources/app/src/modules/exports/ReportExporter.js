/**
 * ReportExporter - Handles PDF generation, CSV exports, and report creation
 */

class ReportExporter {
  constructor() {
    this.jsPDF = window.jsPDF;
    this.logoPath = "assets/logo.png";
    this.logoWidth = 40;
    this.logoHeight = 15;
  }

  /**
   * Export mortgage calculation results to PDF
   * @param {Object} data - Calculation data and results
   * @param {string} reportType - Type of report ('purchase', 'refinance', 'heloc', 'comparison')
   * @param {string} fileName - Optional filename
   * @returns {Promise<boolean>} Success status
   */
  async exportToPDF(data, reportType, fileName = null) {
    try {
      const doc = new this.jsPDF();
      const defaultFileName =
        fileName ||
        `${reportType}-report-${new Date().toISOString().split("T")[0]}.pdf`;

      // Add logo and header
      await this.addHeader(doc, reportType);

      // Add content based on report type
      switch (reportType) {
        case "purchase":
          this.addPurchaseContent(doc, data);
          break;
        case "refinance":
          this.addRefinanceContent(doc, data);
          break;
        case "heloc":
          this.addHELOCContent(doc, data);
          break;
        case "comparison":
          this.addComparisonContent(doc, data);
          break;
        case "blended":
          this.addBlendedContent(doc, data);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      // Add footer
      this.addFooter(doc);

      // Convert to blob for saving
      const pdfBlob = doc.output("blob");
      const reader = new FileReader();

      return new Promise((resolve) => {
        reader.onloadend = () => {
          const base64data = reader.result;

          // Send to main process for saving
          window.api.send("save-pdf", {
            data: base64data,
            fileName: defaultFileName,
          });

          resolve(true);
        };
        reader.readAsDataURL(pdfBlob);
      });
    } catch (error) {
      console.error("PDF export error:", error);
      if (window.uiManager) {
        window.uiManager.showNotification(
          "Failed to generate PDF report",
          "error"
        );
      }
      return false;
    }
  }

  /**
   * Add header with logo and title to PDF
   * @param {jsPDF} doc - PDF document
   * @param {string} reportType - Report type for title
   */
  async addHeader(doc, reportType) {
    try {
      // Add logo
      const logoImg = await this.loadImage(this.logoPath);
      doc.addImage(logoImg, "PNG", 15, 15, this.logoWidth, this.logoHeight);
    } catch (error) {
      console.warn("Could not load logo for PDF:", error);
    }

    // Add company info
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("MortgagePros", 60, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Professional Mortgage Calculations", 60, 26);

    // Add title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    const title = this.getReportTitle(reportType);
    doc.text(title, 105, 45, { align: "center" });

    // Add date
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const currentDate = new Date().toLocaleDateString();
    doc.text(`Generated: ${currentDate}`, 15, 55);
  }

  /**
   * Get report title based on type
   * @param {string} reportType - Report type
   * @returns {string} Report title
   */
  getReportTitle(reportType) {
    const titles = {
      purchase: "Home Purchase Analysis",
      refinance: "Refinance Analysis Report",
      heloc: "HELOC Analysis Report",
      comparison: "Loan Comparison Report",
      blended: "Blended Mortgage Analysis",
    };
    return titles[reportType] || "Mortgage Analysis Report";
  }

  /**
   * Add purchase mortgage content to PDF
   * @param {jsPDF} doc - PDF document
   * @param {Object} data - Purchase calculation data
   */
  addPurchaseContent(doc, data) {
    let yPos = 70;

    // Loan Details Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Loan Details", 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const loanDetails = [
      ["Home Price:", window.NumberFormatter.formatCurrency(data.homePrice)],
      [
        "Down Payment:",
        window.NumberFormatter.formatCurrency(data.downPayment),
      ],
      ["Loan Amount:", window.NumberFormatter.formatCurrency(data.loanAmount)],
      [
        "Interest Rate:",
        window.NumberFormatter.formatPercentage(data.interestRate),
      ],
      ["Loan Term:", `${data.loanTerm} years`],
    ];

    loanDetails.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 120, yPos);
      yPos += 8;
    });

    yPos += 5;

    // Monthly Payment Breakdown
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Monthly Payment Breakdown", 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const paymentBreakdown = [
      [
        "Principal & Interest:",
        window.NumberFormatter.formatCurrency(
          data.results.principalAndInterest
        ),
      ],
      [
        "Property Tax:",
        window.NumberFormatter.formatCurrency(data.propertyTax || 0),
      ],
      [
        "Home Insurance:",
        window.NumberFormatter.formatCurrency(data.homeInsurance || 0),
      ],
      ["PMI:", window.NumberFormatter.formatCurrency(data.pmi || 0)],
      [
        "Total Monthly Payment:",
        window.NumberFormatter.formatCurrency(data.results.totalMonthlyPayment),
      ],
    ];

    paymentBreakdown.forEach(([label, value], index) => {
      if (index === paymentBreakdown.length - 1) {
        doc.setFont("helvetica", "bold");
        doc.line(20, yPos - 2, 180, yPos - 2);
        yPos += 3;
      }
      doc.text(label, 20, yPos);
      doc.text(value, 120, yPos);
      yPos += 8;
    });

    yPos += 5;

    // Summary Information
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Loan Summary", 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const summary = [
      [
        "Total Interest Paid:",
        window.NumberFormatter.formatCurrency(data.results.totalInterest),
      ],
      [
        "Total Amount Paid:",
        window.NumberFormatter.formatCurrency(data.results.totalPaid),
      ],
      [
        "Loan-to-Value Ratio:",
        window.NumberFormatter.formatPercentage(data.results.loanToValue),
      ],
      ["Payoff Date:", data.results.payoffDate],
    ];

    summary.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 120, yPos);
      yPos += 8;
    });
  }

  /**
   * Add refinance content to PDF
   * @param {jsPDF} doc - PDF document
   * @param {Object} data - Refinance calculation data
   */
  addRefinanceContent(doc, data) {
    let yPos = 70;

    // Current vs New Loan Comparison
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Current vs New Loan Comparison", 15, yPos);
    yPos += 15;

    // Table headers
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("", 20, yPos);
    doc.text("Current Loan", 80, yPos);
    doc.text("New Loan", 140, yPos);
    yPos += 8;

    doc.line(20, yPos - 2, 180, yPos - 2);
    doc.setFont("helvetica", "normal");

    const comparisonData = [
      [
        "Loan Amount:",
        window.NumberFormatter.formatCurrency(data.currentLoanAmount),
        window.NumberFormatter.formatCurrency(data.newLoanAmount),
      ],
      [
        "Interest Rate:",
        window.NumberFormatter.formatPercentage(data.currentRate),
        window.NumberFormatter.formatPercentage(data.newRate),
      ],
      [
        "Monthly Payment:",
        window.NumberFormatter.formatCurrency(data.currentPayment),
        window.NumberFormatter.formatCurrency(data.results.newPayment),
      ],
      ["Remaining Term:", data.currentRemainingTerm, `${data.newTerm} years`],
    ];

    comparisonData.forEach(([label, current, newValue]) => {
      doc.text(label, 20, yPos);
      doc.text(current, 80, yPos);
      doc.text(newValue, 140, yPos);
      yPos += 8;
    });

    yPos += 10;

    // Savings Analysis
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Savings Analysis", 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const savings = [
      [
        "Monthly Payment Savings:",
        window.NumberFormatter.formatCurrency(data.results.monthlySavings),
      ],
      [
        "Total Interest Savings:",
        window.NumberFormatter.formatCurrency(
          data.results.totalInterestSavings
        ),
      ],
      ["Break-Even Point:", `${data.results.breakEvenMonths} months`],
      [
        "Closing Costs:",
        window.NumberFormatter.formatCurrency(data.closingCosts || 0),
      ],
    ];

    savings.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 120, yPos);
      yPos += 8;
    });

    // Add Closing Costs & Points details for Refinance (if provided)
    if (data.refinanceCosts) {
      const rc = data.refinanceCosts;
      const currency = (v) => window.NumberFormatter.formatCurrency(v || 0);
      const pointsPct = (rc.pointsPercent || 0).toFixed(2) + "%";
      const pointsAmt = currency(rc.pointsAmount || 0);
      const closingAmt = currency(rc.closingCosts || 0);
      const modeText = rc.financeCosts ? "Included in Loan" : "Due at Closing";
      const modeAmount = rc.financeCosts
        ? rc.financedCosts || 0
        : rc.dueAtClosing || 0;

      yPos += 10;
      doc.setFont("helvetica", "bold");
      doc.text("Closing Costs, Points & Cash-Out", 15, yPos);
      yPos += 10;
      doc.setFont("helvetica", "normal");

      const lines = [
        ["Handling:", modeText],
        ["Closing Costs:", closingAmt],
        ["Points:", `${pointsPct} = ${pointsAmt}`],
        ["Cash-Out Amount:", currency(rc.cashOutAmount || 0)],
        [
          rc.financeCosts ? "Amount Added to Loan:" : "Amount Due at Closing:",
          currency(modeAmount),
        ],
      ];

      lines.forEach(([label, value]) => {
        doc.text(label, 20, yPos);
        doc.text(value, 120, yPos);
        yPos += 8;
      });

      if (
        typeof rc.baseLoanAmount !== "undefined" &&
        typeof rc.adjustedLoanAmount !== "undefined"
      ) {
        doc.text("Base Loan Amount:", 20, yPos);
        doc.text(currency(rc.baseLoanAmount), 120, yPos);
        yPos += 8;
        doc.text("Adjusted Loan Amount:", 20, yPos);
        doc.text(currency(rc.adjustedLoanAmount), 120, yPos);
        yPos += 8;
      }
    }
  }

  /**
   * Add HELOC content to PDF
   * @param {jsPDF} doc - PDF document
   * @param {Object} data - HELOC calculation data
   */
  addHELOCContent(doc, data) {
    let yPos = 70;

    // HELOC Details
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("HELOC Details", 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const helocDetails = [
      ["Home Value:", window.NumberFormatter.formatCurrency(data.homeValue)],
      [
        "Current Mortgage Balance:",
        window.NumberFormatter.formatCurrency(data.mortgageBalance),
      ],
      [
        "Available Equity:",
        window.NumberFormatter.formatCurrency(data.results.availableEquity),
      ],
      [
        "Credit Limit:",
        window.NumberFormatter.formatCurrency(data.creditLimit),
      ],
      [
        "Interest Rate:",
        window.NumberFormatter.formatPercentage(data.interestRate),
      ],
      ["Draw Period:", `${data.drawPeriod} years`],
      ["Repayment Period:", `${data.repaymentPeriod} years`],
    ];

    helocDetails.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 120, yPos);
      yPos += 8;
    });

    yPos += 10;

    // Payment Information
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Information", 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const paymentInfo = [
      [
        "Interest-Only Payment (Draw Period):",
        window.NumberFormatter.formatCurrency(data.results.interestOnlyPayment),
      ],
      [
        "Principal & Interest Payment (Repayment):",
        window.NumberFormatter.formatCurrency(
          data.results.principalInterestPayment
        ),
      ],
      [
        "Total Interest (If Fully Drawn):",
        window.NumberFormatter.formatCurrency(data.results.totalInterest),
      ],
      [
        "Combined LTV Ratio:",
        window.NumberFormatter.formatPercentage(data.results.combinedLTV),
      ],
    ];

    paymentInfo.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 120, yPos);
      yPos += 8;
    });
  }

  /**
   * Add blended mortgage content to PDF
   * @param {jsPDF} doc - PDF document
   * @param {Object} data - Blended mortgage calculation data
   */
  addBlendedContent(doc, data) {
    let yPos = 70;

    // Property Information
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Property Information", 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const propertyDetails = [
      ["Home Value:", window.NumberFormatter.formatCurrency(data.homeValue)],
      [
        "Down Payment:",
        window.NumberFormatter.formatCurrency(data.downPayment || 0),
      ],
      [
        "Total Amount Financed:",
        window.NumberFormatter.formatCurrency(
          (data.firstMortgage?.amount || 0) + (data.secondMortgage?.amount || 0)
        ),
      ],
    ];

    propertyDetails.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 120, yPos);
      yPos += 8;
    });

    yPos += 10;

    // First Mortgage Component
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("First Mortgage Component", 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const firstMortgageDetails = [
      [
        "Loan Amount:",
        window.NumberFormatter.formatCurrency(data.firstMortgage?.amount || 0),
      ],
      [
        "Interest Rate:",
        window.NumberFormatter.formatPercentage(data.firstMortgage?.rate || 0),
      ],
      ["Term:", `${data.firstMortgage?.term || 0} years`],
      [
        "Monthly Payment:",
        window.NumberFormatter.formatCurrency(
          data.firstMortgage?.monthlyPayment || 0
        ),
      ],
    ];

    firstMortgageDetails.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 120, yPos);
      yPos += 8;
    });

    yPos += 10;

    // Second Mortgage Component
    if (data.secondMortgage && data.secondMortgage.amount > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const secondTitle =
        data.secondMortgage.type === "heloc"
          ? "HELOC Component"
          : "Second Mortgage Component";
      doc.text(secondTitle, 15, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");

      const secondMortgageDetails = [
        [
          "Amount/Credit Limit:",
          window.NumberFormatter.formatCurrency(data.secondMortgage.amount),
        ],
        [
          "Interest Rate:",
          window.NumberFormatter.formatPercentage(
            data.secondMortgage.rate || 0
          ),
        ],
        ["Type:", data.secondMortgage.type?.toUpperCase() || "HELOC"],
        [
          "Monthly Payment:",
          window.NumberFormatter.formatCurrency(
            data.secondMortgage.monthlyPayment || 0
          ),
        ],
      ];

      if (data.secondMortgage.type !== "heloc") {
        secondMortgageDetails.splice(2, 0, [
          "Term:",
          `${data.secondMortgage.term || 15} years`,
        ]);
      }

      secondMortgageDetails.forEach(([label, value]) => {
        doc.text(label, 20, yPos);
        doc.text(value, 120, yPos);
        yPos += 8;
      });

      yPos += 10;
    }

    // Combined Monthly Payment Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Monthly Payment Summary", 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const paymentSummary = [
      [
        "Principal & Interest (Combined):",
        window.NumberFormatter.formatCurrency(
          data.combined?.totalPrincipalInterest || 0
        ),
      ],
      [
        "Property Tax:",
        window.NumberFormatter.formatCurrency(
          data.additionalCosts?.propertyTax || 0
        ),
      ],
      [
        "Home Insurance:",
        window.NumberFormatter.formatCurrency(
          data.additionalCosts?.insurance || 0
        ),
      ],
      [
        "PMI:",
        window.NumberFormatter.formatCurrency(data.additionalCosts?.pmi || 0),
      ],
      [
        "Other Costs:",
        window.NumberFormatter.formatCurrency(data.additionalCosts?.other || 0),
      ],
    ];

    paymentSummary.forEach(([label, value], index) => {
      if (index === paymentSummary.length - 1) {
        doc.line(20, yPos - 2, 180, yPos - 2);
        yPos += 3;
      }
      doc.text(label, 20, yPos);
      doc.text(value, 120, yPos);
      yPos += 8;
    });

    // Total monthly payment with emphasis
    doc.setFont("helvetica", "bold");
    doc.text("Total Monthly Payment:", 20, yPos);
    doc.text(
      window.NumberFormatter.formatCurrency(
        data.combined?.totalMonthlyPayment || 0
      ),
      120,
      yPos
    );
    yPos += 15;

    // Loan-to-Value Information
    if (data.ltv) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Loan-to-Value Analysis", 15, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");

      const ltvInfo = [
        [
          "First Mortgage LTV:",
          window.NumberFormatter.formatPercentage(data.ltv.firstMortgageLTV),
        ],
        [
          "Combined LTV:",
          window.NumberFormatter.formatPercentage(data.ltv.combinedLTV),
        ],
        [
          "Available Equity:",
          window.NumberFormatter.formatCurrency(data.ltv.availableEquity),
        ],
      ];

      ltvInfo.forEach(([label, value]) => {
        doc.text(label, 20, yPos);
        doc.text(value, 120, yPos);
        yPos += 8;
      });
    }

    // Comparison with Traditional Mortgage (if available)
    if (data.combined?.comparison) {
      yPos += 10;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Comparison with Traditional Mortgage", 15, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");

      const comparisonInfo = [
        [
          "Traditional 30-Year Payment:",
          window.NumberFormatter.formatCurrency(
            data.combined.comparison.traditionalMonthlyPayment
          ),
        ],
        [
          "Blended Structure P&I:",
          window.NumberFormatter.formatCurrency(
            data.combined.totalPrincipalInterest
          ),
        ],
        [
          "Monthly Difference:",
          window.NumberFormatter.formatCurrency(
            Math.abs(data.combined.comparison.monthlySavings)
          ),
        ],
        [
          "Annual Difference:",
          window.NumberFormatter.formatCurrency(
            Math.abs(data.combined.comparison.annualSavings)
          ),
        ],
      ];

      comparisonInfo.forEach(([label, value]) => {
        doc.text(label, 20, yPos);
        doc.text(value, 120, yPos);
        yPos += 8;
      });

      if (data.combined.comparison.monthlySavings > 0) {
        yPos += 5;
        doc.setFont("helvetica", "bold");
        doc.text(
          "✓ Blended structure saves money compared to traditional mortgage",
          20,
          yPos
        );
      } else if (data.combined.comparison.monthlySavings < 0) {
        yPos += 5;
        doc.setFont("helvetica", "bold");
        doc.text(
          "⚠ Blended structure costs more than traditional mortgage",
          20,
          yPos
        );
      }
    }
  }

  /**
   * Add comparison content to PDF
   * @param {jsPDF} doc - PDF document
   * @param {Object} data - Comparison calculation data
   */
  addComparisonContent(doc, data) {
    let yPos = 70;

    // Comparison Overview
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Loan Options Comparison", 15, yPos);
    yPos += 15;

    // Process loan data
    const loans = [data.loanA, data.loanB];
    if (data.loanC && data.loanC.amount > 0) {
      loans.push(data.loanC);
    }

    // Table headers
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("", 15, yPos);
    loans.forEach((loan, index) => {
      doc.text(loan.name || `Option ${index + 1}`, 70 + index * 40, yPos);
    });
    yPos += 8;

    doc.line(15, yPos - 2, 195, yPos - 2);
    doc.setFont("helvetica", "normal");

    // Comparison data rows
    const comparisonRows = [
      [
        "Loan Amount",
        loans.map((loan) => window.NumberFormatter.formatCurrency(loan.amount)),
      ],
      [
        "Interest Rate",
        loans.map((loan) => window.NumberFormatter.formatPercentage(loan.rate)),
      ],
      ["Loan Term", loans.map((loan) => `${loan.term} years`)],
      [
        "Monthly P&I",
        loans.map((loan) =>
          window.NumberFormatter.formatCurrency(
            loan.results?.monthlyPayment || 0
          )
        ),
      ],
      [
        "Total Interest",
        loans.map((loan) =>
          window.NumberFormatter.formatCurrency(
            loan.results?.totalInterest || 0
          )
        ),
      ],
      [
        "Total Paid",
        loans.map((loan) =>
          window.NumberFormatter.formatCurrency(loan.results?.totalPaid || 0)
        ),
      ],
      [
        "PMI Ends",
        loans.map((loan) => {
          const endMonth =
            loan.results?.pmiEndsMonth ?? loan.pmiEndsMonth ?? null; // 1-based first month WITHOUT PMI
          if (endMonth === 1) return "No PMI";
          if (endMonth == null) return "Never"; // unknown or persisted full term
          if (typeof endMonth === "number" && endMonth > 1) {
            const lastWithPMIMonth = endMonth - 1; // last PMI month index (1-based)
            const y = Math.floor(lastWithPMIMonth / 12);
            const m = lastWithPMIMonth % 12;
            const duration = `${y > 0 ? y + "y " : ""}${m}m`;
            return `Drops after: ${duration} (Month ${endMonth})`;
          }
          return "-";
        }),
      ],
    ];

    // Detect if any loan has extra payment benefit metrics
    const anyExtra = loans.some(
      (loan) =>
        loan.results?.extraDeltas &&
        typeof loan.results.extraDeltas.interestSaved === "number"
    );
    if (anyExtra) {
      comparisonRows.push([
        "Interest Saved (Extra Payment)",
        loans.map((loan) => {
          const val = loan.results?.extraDeltas?.interestSaved;
          return typeof val === "number"
            ? window.NumberFormatter.formatCurrency(val)
            : "—";
        }),
      ]);
      comparisonRows.push([
        "Payoff Accelerated",
        loans.map((loan) => {
          const months = loan.results?.extraDeltas?.monthsSaved;
          if (!months || months <= 0)
            return typeof months === "number" ? "0m" : "—";
          const y = Math.floor(months / 12);
          const m = months % 12;
          return `${y > 0 ? y + "y " : ""}${m}m`;
        }),
      ]);
    }

    comparisonRows.forEach(([label, values]) => {
      doc.text(label, 15, yPos);
      values.forEach((value, index) => {
        doc.text(value, 70 + index * 40, yPos);
      });
      yPos += 8;
    });

    yPos += 10;

    // Recommendation section
    if (data.recommendation) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("💰 RECOMMENDED OPTION", 15, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${data.recommendation.name} offers the best value`, 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.text(`Reason: ${data.recommendation.reason}`, 15, yPos);
      yPos += 6;
      doc.text(`Savings: ${data.recommendation.savings}`, 15, yPos);
    }
  }

  /**
   * Add footer to PDF
   * @param {jsPDF} doc - PDF document
   */
  addFooter(doc) {
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      "This report is for informational purposes only and does not constitute a loan offer.",
      105,
      pageHeight - 20,
      { align: "center" }
    );
    doc.text(
      "Consult with a mortgage professional for personalized advice.",
      105,
      pageHeight - 15,
      { align: "center" }
    );
    doc.text("Generated by MortgagePros Calculator", 105, pageHeight - 10, {
      align: "center",
    });
  }

  /**
   * Load image for PDF
   * @param {string} src - Image source path
   * @returns {Promise<string>} Base64 image data
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Export calculation data to CSV format
   * @param {Object} data - Calculation data
   * @param {string} reportType - Type of report
   * @param {string} fileName - Optional filename
   * @returns {Promise<boolean>} Success status
   */
  async exportToCSV(data, reportType, fileName = null) {
    try {
      const defaultFileName =
        fileName ||
        `${reportType}-data-${new Date().toISOString().split("T")[0]}.csv`;
      let csvContent = "";

      switch (reportType) {
        case "purchase":
          csvContent = this.generatePurchaseCSV(data);
          break;
        case "refinance":
          csvContent = this.generateRefinanceCSV(data);
          break;
        case "heloc":
          csvContent = this.generateHELOCCSV(data);
          break;
        case "comparison":
          csvContent = this.generateComparisonCSV(data);
          break;
        case "blended":
          csvContent = this.generateBlendedCSV(data);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      // Send to main process for saving
      window.api.send("save-csv", {
        data: csvContent,
        fileName: defaultFileName,
      });

      if (window.uiManager) {
        window.uiManager.showNotification(
          "CSV exported successfully",
          "success"
        );
      }

      return true;
    } catch (error) {
      console.error("CSV export error:", error);
      if (window.uiManager) {
        window.uiManager.showNotification("Failed to export CSV", "error");
      }
      return false;
    }
  }

  /**
   * Generate CSV content for purchase data
   * @param {Object} data - Purchase data
   * @returns {string} CSV content
   */
  generatePurchaseCSV(data) {
    const rows = [
      ["Field", "Value"],
      ["Home Price", data.homePrice],
      ["Down Payment", data.downPayment],
      ["Loan Amount", data.loanAmount],
      ["Interest Rate (%)", data.interestRate],
      ["Loan Term (years)", data.loanTerm],
      ["Property Tax (monthly)", data.propertyTax || 0],
      ["Home Insurance (monthly)", data.homeInsurance || 0],
      ["PMI (monthly)", data.pmi || 0],
      ["Monthly P&I Payment", data.results.principalAndInterest],
      ["Total Monthly Payment", data.results.totalMonthlyPayment],
      ["Total Interest", data.results.totalInterest],
      ["Total Amount Paid", data.results.totalPaid],
      ["Loan-to-Value Ratio (%)", data.results.loanToValue],
      ["Payoff Date", data.results.payoffDate],
    ];

    return rows.map((row) => row.join(",")).join("\n");
  }

  /**
   * Generate CSV content for refinance data
   * @param {Object} data - Refinance data
   * @returns {string} CSV content
   */
  generateRefinanceCSV(data) {
    const rows = [
      ["Field", "Current Loan", "New Loan"],
      ["Loan Amount", data.currentLoanAmount, data.newLoanAmount],
      ["Interest Rate (%)", data.currentRate, data.newRate],
      ["Loan Term (years)", data.currentRemainingTerm, data.newTerm],
      ["Monthly Payment", data.currentPayment, data.results.newPayment],
      ["", "", ""],
      ["Savings Analysis", "", ""],
      ["Monthly Savings", "", data.results.monthlySavings],
      ["Total Interest Savings", "", data.results.totalInterestSavings],
      ["Break-Even (months)", "", data.results.breakEvenMonths],
      ["Closing Costs", "", data.closingCosts || 0],
    ];

    return rows.map((row) => row.join(",")).join("\n");
  }

  /**
   * Generate CSV content for HELOC data
   * @param {Object} data - HELOC data
   * @returns {string} CSV content
   */
  generateHELOCCSV(data) {
    const rows = [
      ["Field", "Value"],
      ["Home Value", data.homeValue],
      ["Current Mortgage Balance", data.mortgageBalance],
      ["Available Equity", data.results.availableEquity],
      ["Credit Limit", data.creditLimit],
      ["Interest Rate (%)", data.interestRate],
      ["Draw Period (years)", data.drawPeriod],
      ["Repayment Period (years)", data.repaymentPeriod],
      ["Interest-Only Payment", data.results.interestOnlyPayment],
      ["P&I Payment (Repayment)", data.results.principalInterestPayment],
      ["Total Interest (If Fully Drawn)", data.results.totalInterest],
      ["Combined LTV Ratio (%)", data.results.combinedLTV],
    ];

    return rows.map((row) => row.join(",")).join("\n");
  }

  /**
   * Generate CSV content for blended mortgage data
   * @param {Object} data - Blended mortgage data
   * @returns {string} CSV content
   */
  generateBlendedCSV(data) {
    const rows = [
      ["Field", "Value"],
      ["", ""],
      ["PROPERTY INFORMATION", ""],
      ["Home Value", data.homeValue],
      ["Down Payment", data.downPayment || 0],
      [
        "Total Financed",
        (data.firstMortgage?.amount || 0) + (data.secondMortgage?.amount || 0),
      ],
      ["", ""],
      ["FIRST MORTGAGE", ""],
      ["Loan Amount", data.firstMortgage?.amount || 0],
      ["Interest Rate (%)", data.firstMortgage?.rate || 0],
      ["Term (years)", data.firstMortgage?.term || 0],
      ["Monthly Payment", data.firstMortgage?.monthlyPayment || 0],
      ["", ""],
      ["SECOND COMPONENT", ""],
      ["Amount/Credit Limit", data.secondMortgage?.amount || 0],
      ["Interest Rate (%)", data.secondMortgage?.rate || 0],
      ["Type", data.secondMortgage?.type?.toUpperCase() || "N/A"],
      ["Monthly Payment", data.secondMortgage?.monthlyPayment || 0],
    ];

    if (data.secondMortgage?.type !== "heloc" && data.secondMortgage?.term) {
      rows.splice(-1, 0, ["Term (years)", data.secondMortgage.term]);
    }

    rows.push(
      ["", ""],
      ["MONTHLY PAYMENT SUMMARY", ""],
      ["Combined P&I Payment", data.combined?.totalPrincipalInterest || 0],
      ["Property Tax", data.additionalCosts?.propertyTax || 0],
      ["Home Insurance", data.additionalCosts?.insurance || 0],
      ["PMI", data.additionalCosts?.pmi || 0],
      ["Other Costs", data.additionalCosts?.other || 0],
      ["Total Monthly Payment", data.combined?.totalMonthlyPayment || 0]
    );

    if (data.ltv) {
      rows.push(
        ["", ""],
        ["LOAN-TO-VALUE ANALYSIS", ""],
        ["First Mortgage LTV (%)", data.ltv.firstMortgageLTV],
        ["Combined LTV (%)", data.ltv.combinedLTV],
        ["Available Equity", data.ltv.availableEquity]
      );
    }

    if (data.combined?.comparison) {
      rows.push(
        ["", ""],
        ["COMPARISON WITH TRADITIONAL", ""],
        [
          "Traditional 30-Year Payment",
          data.combined.comparison.traditionalMonthlyPayment,
        ],
        ["Blended Structure P&I", data.combined.totalPrincipalInterest],
        ["Monthly Difference", data.combined.comparison.monthlySavings],
        ["Annual Difference", data.combined.comparison.annualSavings]
      );
    }

    return rows.map((row) => row.join(",")).join("\n");
  }

  /**
   * Generate CSV content for comparison data
   * @param {Object} data - Comparison data
   * @returns {string} CSV content
   */
  generateComparisonCSV(data) {
    const loans = [data.loanA, data.loanB];
    if (data.loanC && data.loanC.amount > 0) {
      loans.push(data.loanC);
    }

    const headers = ["Field", ...loans.map((loan) => loan.name || "Option")];
    const rows = [
      headers,
      ["Loan Amount", ...loans.map((loan) => loan.amount)],
      ["Interest Rate (%)", ...loans.map((loan) => loan.rate)],
      ["Loan Term (years)", ...loans.map((loan) => loan.term)],
      [
        "Monthly P&I Payment",
        ...loans.map((loan) => loan.results?.monthlyPayment || 0),
      ],
      [
        "Total Interest",
        ...loans.map((loan) => loan.results?.totalInterest || 0),
      ],
      [
        "Total Amount Paid",
        ...loans.map((loan) => loan.results?.totalPaid || 0),
      ],
    ];

    if (data.recommendation) {
      rows.push(["", "", "", ""]);
      rows.push(["Recommended Option", data.recommendation.name, "", ""]);
      rows.push(["Reason", data.recommendation.reason, "", ""]);
      rows.push(["Savings", data.recommendation.savings, "", ""]);
    }

    return rows.map((row) => row.join(",")).join("\n");
  }

  /**
   * Generate amortization schedule
   * @param {Object} loanData - Loan parameters
   * @returns {Array} Amortization schedule array
   */
  generateAmortizationSchedule(loanData) {
    const { loanAmount, interestRate, loanTerm, extraPayment = 0 } = loanData;

    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTerm * 12;
    const monthlyPayment =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    const schedule = [];
    let remainingBalance = loanAmount;
    let totalInterest = 0;

    for (
      let month = 1;
      month <= numPayments && remainingBalance > 0.01;
      month++
    ) {
      const interestPayment = remainingBalance * monthlyRate;
      let principalPayment = monthlyPayment - interestPayment + extraPayment;

      if (principalPayment > remainingBalance) {
        principalPayment = remainingBalance;
      }

      remainingBalance -= principalPayment;
      totalInterest += interestPayment;

      schedule.push({
        paymentNumber: month,
        paymentAmount: monthlyPayment + extraPayment,
        principalPayment: principalPayment,
        interestPayment: interestPayment,
        remainingBalance: remainingBalance,
        cumulativeInterest: totalInterest,
      });

      if (remainingBalance <= 0.01) break;
    }

    return schedule;
  }

  /**
   * Export amortization schedule to CSV
   * @param {Object} loanData - Loan parameters
   * @param {string} fileName - Optional filename
   * @returns {Promise<boolean>} Success status
   */
  async exportAmortizationSchedule(loanData, fileName = null) {
    try {
      const schedule = this.generateAmortizationSchedule(loanData);
      const defaultFileName =
        fileName ||
        `amortization-schedule-${new Date().toISOString().split("T")[0]}.csv`;

      const headers = [
        "Payment #",
        "Payment Amount",
        "Principal",
        "Interest",
        "Remaining Balance",
        "Cumulative Interest",
      ];
      const rows = [headers];

      schedule.forEach((payment) => {
        rows.push([
          payment.paymentNumber,
          payment.paymentAmount.toFixed(2),
          payment.principalPayment.toFixed(2),
          payment.interestPayment.toFixed(2),
          payment.remainingBalance.toFixed(2),
          payment.cumulativeInterest.toFixed(2),
        ]);
      });

      const csvContent = rows.map((row) => row.join(",")).join("\n");

      window.api.send("save-csv", {
        data: csvContent,
        fileName: defaultFileName,
      });

      if (window.uiManager) {
        window.uiManager.showNotification(
          "Amortization schedule exported successfully",
          "success"
        );
      }

      return true;
    } catch (error) {
      console.error("Amortization export error:", error);
      if (window.uiManager) {
        window.uiManager.showNotification(
          "Failed to export amortization schedule",
          "error"
        );
      }
      return false;
    }
  }
}

// Initialize global report exporter
if (typeof window !== "undefined") {
  window.reportExporter = new ReportExporter();
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ReportExporter;
} else {
  window.ReportExporter = ReportExporter;
}
