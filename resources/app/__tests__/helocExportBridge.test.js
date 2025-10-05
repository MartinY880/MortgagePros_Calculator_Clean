/**
 * Tests for the HELOC Export Data Bridge (Task 13)
 * Ensures a normalized helocResult object exists and ReportExporter.addHELOCContent
 * prefers it while remaining backward compatible with legacy shapes.
 */

const fs = require("fs");
const path = require("path");

// Lightweight stubs for jsPDF & NumberFormatter used by exporter
class JsPDFMock {
  constructor() {
    this.calls = [];
  }
  setFontSize(size) {
    this.calls.push(["setFontSize", size]);
  }
  setFont(font, style) {
    this.calls.push(["setFont", font, style]);
  }
  text(txt, x, y) {
    this.calls.push(["text", txt, x, y]);
  }
}

global.window = global.window || {};
window.NumberFormatter = {
  formatCurrency: (v) => `$${Number(v).toFixed(2)}`,
  formatPercentage: (v) => `${(Number(v) * 100).toFixed(2)}%`,
};

describe("HELOC Export Bridge", () => {
  let ReportExporter;
  beforeAll(() => {
    const exporterPath = path.resolve(
      __dirname,
      "../src/modules/exports/ReportExporter.js"
    );
    ReportExporter = require(exporterPath);
  });

  test("uses normalized helocResult when present", () => {
    const doc = new JsPDFMock();
    const exporter = new ReportExporter();

    const helocResult = {
      inputs: {
        homeValue: 500000,
        mortgageBalance: 250000,
        creditLimit: 100000,
        interestRate: 0.075,
        drawPeriod: 10,
        repaymentPeriod: 20,
      },
      payments: { interestOnly: 625, repayment: 850 },
      totals: { totalInterest: 90000 },
      ltv: { combined: 0.65 },
      equity: { available: 150000 },
    };

    const data = { helocResult }; // minimal wrapper

    exporter.addHELOCContent(doc, data);

    // Collect text calls to verify mapping
    const textCalls = doc.calls.filter((c) => c[0] === "text").map((c) => c[1]);

    expect(textCalls).toContain("HELOC Details");
    expect(textCalls).toContain("Payment Information");

    // Verify some formatted values came from normalized structure
    expect(textCalls).toContain("$500000.00"); // home value
    expect(textCalls).toContain("$150000.00"); // available equity
    expect(textCalls).toContain("$625.00"); // interest-only payment
    expect(textCalls).toContain("$850.00"); // principal & interest payment
  });

  test("falls back to legacy data shape when helocResult missing", () => {
    const doc = new JsPDFMock();
    const exporter = new ReportExporter();

    const legacyData = {
      homeValue: 400000,
      mortgageBalance: 200000,
      creditLimit: 80000,
      interestRate: 0.065,
      drawPeriod: 5,
      repaymentPeriod: 15,
      results: {
        interestOnlyPayment: 400,
        principalInterestPayment: 650,
        totalInterest: 50000,
        combinedLTV: 0.7,
        availableEquity: 120000,
      },
    };

    exporter.addHELOCContent(doc, legacyData);
    const textCalls = doc.calls.filter((c) => c[0] === "text").map((c) => c[1]);

    expect(textCalls).toContain("$400000.00");
    expect(textCalls).toContain("$120000.00");
    expect(textCalls).toContain("$400.00");
    expect(textCalls).toContain("$650.00");
  });
});
