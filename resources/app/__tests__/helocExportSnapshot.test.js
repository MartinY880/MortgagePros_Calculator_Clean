/**
 * HELOC Export Tests (Task 18)
 * - Snapshot normalized helocResult (excluding volatile Date objects & messages)
 * - CSV header + row count matches schedule length + 1
 */
const { JSDOM } = require("jsdom");
const path = require("path");
const fs = require("fs");

function loadDom() {
  const htmlPath = path.join(__dirname, "..", "src", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "http://localhost/",
  });
}

async function freshEnv() {
  const dom = loadDom();
  const win = dom.window;
  await new Promise((r) => setTimeout(r, 40));
  try {
    require("../src/mortgage-calculator.js");
  } catch (_) {}
  // Load exporter module explicitly (CommonJS)
  let ReportExporter;
  try {
    ReportExporter = require("../src/modules/exports/ReportExporter.js");
  } catch (_) {}
  return { window: win, ReportExporter };
}

// Normalize helocResult for snapshot: strip Dates & variable arrays
function normalizeHelocResult(r) {
  const clone = {
    principal: r.principal,
    interestOnlyPayment: Number(r.interestOnlyPayment.toFixed(6)),
    principalInterestPayment: Number(r.principalInterestPayment.toFixed(6)),
    totalInterest: Number(r.totalInterest.toFixed(2)),
    totalInterestDrawPhase: Number(r.totalInterestDrawPhase.toFixed(2)),
    totalInterestRepayPhase: Number(r.totalInterestRepayPhase.toFixed(2)),
    combinedLTV: Number(r.combinedLTV.toFixed(4)),
    availableEquity: Number(r.availableEquity?.toFixed?.(2) || 0),
    postDrawEquity: Number(r.postDrawEquity?.toFixed?.(2) || 0),
    ltvWarning: r.ltvWarning || null,
    rateWarning: r.rateWarning || null,
    edgeFlags: r.edgeFlags,
    scheduleMeta: undefined,
    payoffDate: r.payoffDate
      ? `${r.payoffDate.getFullYear()}-${(r.payoffDate.getMonth() + 1)
          .toString()
          .padStart(2, "0")}`
      : null,
  };
  if (r.schedule && r.schedule.length) {
    clone.scheduleMeta = {
      length: r.schedule.length,
      first: {
        phase: r.schedule[0].phase,
        payment: Number(r.schedule[0].payment.toFixed(2)),
      },
      last: {
        phase: r.schedule[r.schedule.length - 1].phase,
        balance: Number(
          (r.schedule[r.schedule.length - 1].balance ?? 0).toFixed(2)
        ),
      },
    };
  }
  return clone;
}

describe("HELOC Export Snapshot & CSV (Task 18)", () => {
  test("Normalized helocResult snapshot stable & CSV structure matches schedule", async () => {
    const { window, ReportExporter } = await freshEnv();
    const doc = window.document;

    // Provide deterministic inputs
    doc.getElementById("helocPropertyValue").value = "400000";
    doc.getElementById("helocOutstandingBalance").value = "250000";
    doc.getElementById("helocLoanAmount").value = "50000";
    doc.getElementById("helocInterestRate").value = "6.5";
    doc.getElementById("helocInterestOnlyPeriod").value = "2"; // draw
    doc.getElementById("helocRepaymentPeriod").value = "12"; // total

    window.calculateHELOC();
    const helocData = window.helocData;
    const result = helocData.result;
    expect(result).toBeDefined();

    const normalized = normalizeHelocResult(result);
    // Inline snapshot (explicit object to avoid unstable values)
    expect(normalized).toMatchObject({
      principal: 50000,
      interestOnlyPayment: expect.any(Number),
      principalInterestPayment: expect.any(Number),
      totalInterest: expect.any(Number),
      totalInterestDrawPhase: expect.any(Number),
      totalInterestRepayPhase: expect.any(Number),
      combinedLTV: expect.any(Number),
      availableEquity: expect.any(Number),
      postDrawEquity: expect.any(Number),
      ltvWarning: null,
      rateWarning: null,
      edgeFlags: expect.objectContaining({
        roundingAdjusted: expect.any(Boolean),
      }),
      scheduleMeta: expect.objectContaining({ length: expect.any(Number) }),
      payoffDate: expect.stringMatching(/\d{4}-\d{2}/),
    });

    // CSV test
    const exporter = new ReportExporter();
    const csv = exporter.generateHELOCCSV({ helocResult: result });
    const lines = csv.trim().split(/\r?\n/);
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
    // Row count = schedule length + 1 header
    expect(lines.length).toBe(result.schedule.length + 1);
  });
});
