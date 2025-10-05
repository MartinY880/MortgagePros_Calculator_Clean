/**
 * HELOC CSV Columns Test (Task 14)
 * Verifies that the HELOC CSV export includes Phase, Cumulative Principal, Cumulative Interest columns
 * when a schedule is present, and that at least the first data row reflects cumulative progression.
 */

const path = require("path");

// Minimal fake window.api for tests if exporter tries to call it (we only use generate function directly here)
global.window = global.window || {};
window.api = { send: () => {} };

const ReportExporter = require(path.resolve(
  __dirname,
  "../src/modules/exports/ReportExporter.js"
));

describe("HELOC CSV Export Columns", () => {
  test("includes new Phase and cumulative columns with schedule", () => {
    const exporter = new ReportExporter();

    // Build a tiny synthetic helocResult schedule resembling draw + repay
    const schedule = [
      {
        paymentNumber: 1,
        paymentDate: new Date(2030, 0, 1),
        phase: "Draw",
        payment: 500,
        principalPayment: 0,
        interestPayment: 500,
        balance: 100000,
        cumulativePrincipal: 0,
        cumulativeInterest: 500,
      },
      {
        paymentNumber: 2,
        paymentDate: new Date(2030, 1, 1),
        phase: "Repay",
        payment: 800,
        principalPayment: 300,
        interestPayment: 500,
        balance: 99700,
        cumulativePrincipal: 300,
        cumulativeInterest: 1000,
      },
    ];

    const helocResult = {
      schedule,
      payments: { interestOnly: 500, repayment: 800 },
      equity: { available: 150000 },
      ltv: { combined: 0.65 },
      totals: { totalInterest: 90000 },
      inputs: {
        homeValue: 500000,
        mortgageBalance: 250000,
        creditLimit: 100000,
        interestRate: 0.075,
        drawPeriod: 10,
        repaymentPeriod: 20,
      },
    };

    const csv = exporter.generateHELOCCSV({ helocResult });
    const lines = csv.split(/\n/);
    const header = lines[0].split(",");

    expect(header).toEqual([
      "Payment #",
      "Payment Date",
      "Phase",
      "Payment Amount",
      "Principal",
      "Interest",
      "Balance",
      "Cumulative Principal",
      "Cumulative Interest",
    ]);

    // Validate first data row basics
    const row1 = lines[1].split(",");
    expect(row1[0]).toBe("1");
    expect(row1[2]).toBe("Draw");
    expect(row1[7]).toBe("0.00");
    expect(row1[8]).toBe("500.00");

    // Second row cumulative advancement
    const row2 = lines[2].split(",");
    expect(row2[2]).toBe("Repay");
    expect(row2[7]).toBe("300.00");
    expect(row2[8]).toBe("1000.00");
  });
});
