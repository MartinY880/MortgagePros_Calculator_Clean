# MortgagePros Calculator<div align="center">

A professional mortgage calculator application built with Electron. Calculate monthly payments, view amortization schedules, and visualize payment breakdowns with interactive charts.# 🏠💰 **MortgagePros Calculator** `v16.3.0` 🏆

## 🚀 Features[![� Ready-to-Run](https://img.shields.io/badge/🚀_Ready--to--Run-brightgreen?style=for-the-badge)](.)

[![📊 No Install](https://img.shields.io/badge/📊_No_Install-blue?style=for-the-badge)](.)

- **Loan Calculation**: Calculate monthly mortgage payments based on loan amount, interest rate, and term[![💻 Portable](https://img.shields.io/badge/💻_Portable-orange?style=for-the-badge)](.)

- **Amortization Schedule**: View detailed payment breakdown over the life of the loan [![🏢 Enterprise](https://img.shields.io/badge/🏢_Enterprise-purple?style=for-the-badge)](.)

- **Interactive Charts**: Visualize principal vs interest payments and loan balance over time

- **Export Options**: Generate PDF reports and CSV exports**� Download** → **� Extract** → **▶️ Run** | �️ _Unblock if Windows Defender prompts_

- **Professional UI**: Clean, responsive interface with auto-hiding notifications

- **Quick Down Payment Presets (New)**: One-click 5%, 10%, 15%, 20% buttons instantly update both % and $ fields with robust bidirectional sync (deterministic in tests)

</div>

## 💻 System Requirements

---

- Windows 10 or later

- No additional software installation required (portable application)<table width="100%">

<tr>

## 🎯 Quick Start<td width="25%" align="center"><strong>🏠 Purchase</strong><br/>New home mortgages</td>

<td width="25%" align="center"><strong>🔄 Refinance</strong><br/>Rate optimization</td>

1. **Run the Application**: Double-click `MortgagePros Calculator.exe`<td width="25%" align="center"><strong>💳 HELOC</strong><br/>Equity calculations</td>

2. **Enter Loan Details**: Fill in loan amount, interest rate, and loan term<td width="25%" align="center"><strong>📊 Analytics</strong><br/>Charts & reports</td>

3. **Calculate**: Click "Calculate Payment" to see results</tr>

4. **View Charts**: Interactive charts display automatically</table>

5. **Export**: Generate PDF reports or CSV files as needed

## ✨ Key Features

## 📊 Calculation Features

<table>

### Loan Details<tr>

- **Loan Amount**: Principal amount to be borrowed<td width="50%">

- **Annual Interest Rate**: Interest rate as percentage

- **Loan Term**: Duration in years### 🏠 **Calculator Types**

- **Start Date**: Beginning date of the loan

• **Purchase Mortgage** - New home buying

### Results Display• **Refinance** - Existing mortgage refinancing

- Monthly payment amount• **HELOC** - Home equity line of credit

- Total interest paid over loan term

- Total amount paid (principal + interest)### 📊 **Analysis Tools**

- Monthly breakdown of principal vs interest

• Complete amortization schedules

### Charts & Visualization• Interactive payment charts

- **Principal vs Interest Chart**: Shows how payment composition changes over time• Extra payment modeling

- **Loan Balance Chart**: Displays remaining balance throughout loan term• Total cost breakdowns

- Interactive tooltips with detailed information

</td>

## 🔧 Technical Details<td width="50%">

**Built with:**### 📄 **Professional Reports**

- Electron Framework

- Chart.js for visualizations• **PDF Export** - Branded mortgage reports

- Bootstrap for responsive UI• **CSV Export** - Excel-ready data

- HTML5/CSS3/JavaScript• **Full Reports** - Multi-page summaries

• **History** - Save/reload calculations

**Key Features:**

- Zero default values on startup### ⚡ **Smart Features**

- 3-second auto-hide notifications

- 1200x900 default window size• Real-time calculations • Auto PMI • Bootstrap UI

- CDN-based Chart.js integration

- Local data persistence</td>

</tr>

## 📝 Version Information</table>

**Version**: 16.3.0 (Unified Engine Edition) ---

**Last Updated**: October 2025

**Status**: Production Ready ✅## 🎯 **System Requirements** | 🛠️ **Tech Stack** | 📋 **IT Notes**

## 🆘 Support<div align="center">

For questions or support, please refer to the application documentation or contact support.| 💻 **Windows 10/11** | ⚡ **Electron 38.1.0** | 📦 **~200MB Complete** |

| :------------------: | :--------------------: | :--------------------: |

---| ❌ No Installation | 🎨 Bootstrap 5.3.8 | ✅ All Dependencies |

| ❌ No Admin Rights | 📊 Chart.js 4.5.0 | 🔒 Runs Offline |

_Professional mortgage calculation tool for accurate loan analysis and planning._| 📁 Any Folder | 📄 jsPDF 3.0.2 | 🚀 Ready-to-Deploy |

</div>

## 🏢 Enterprise Deployment

<details>
<summary><strong>📋 IT Deployment Options (Click to expand)</strong></summary>

**Deployment Methods:** Group Policy • SCCM/ConfigMgr • Microsoft Intune • Network Share • Code Signing

**Quick Deploy Script:**

```powershell
xcopy "\\server\share\MortgagePros-Calculator-Portable-v11" "C:\Apps\MortgagePros" /E /I /Y
powershell -Command "New-Object -ComObject WScript.Shell | ForEach-Object { $_.CreateShortcut('C:\Users\Public\Desktop\MortgagePros Calculator.lnk').TargetPath = 'C:\Apps\MortgagePros\MortgagePros Calculator.exe' }"
```

</details>

## � Quick Troubleshooting

| 🔍 **Issue**               | ⚡ **Solution**                              |
| :------------------------- | :------------------------------------------- |
| 🛡️ Windows Defender blocks | Right-click .exe → Properties → ✅ "Unblock" |
| ❌ Won't start             | Try as Administrator or different folder     |
| 📄 PDF export fails        | ✅ Fixed in v11.0.0 - jsPDF included         |
| 🏢 Corporate firewall      | App runs fully offline                       |
| 🐌 Slow first launch       | Normal - Electron takes 10-15s initially     |

## 🏆 Version 12.6.0 - Updated Edition

<div align="center">

**🎯 Enhanced Input System with Improved Calculation Accuracy**

✅ Property Tax as Monthly $ • ✅ Home Insurance Fixed • ✅ Consistent Inputs • ✅ Better UX

</div>

## 📜 License

This software is provided as-is for professional use. See LICENSE file for details.

## 🏗️ For Developers

### Building from Source

This is a pre-built portable application. To modify or rebuild:

1. **Extract source code** from `resources/app/` directory
2. **Install Node.js** and npm dependencies
3. **Use Electron Builder** to create new executable
4. **Test thoroughly** - Especially PDF generation and cross-platform compatibility

### Key Dependencies

- Ensure jsPDF dist files are included in final package
- Bootstrap files must be properly referenced for styling
- Chart.js required for visualization features
- All dependencies are bundled in node_modules for portability

### Internal Architecture (v16.3.0 Unified)

- Core amortization, PMI gating, extra payment acceleration, baseline counterfactual interest savings, and PMI lifecycle tracking run through a single engine: `ScheduleBuilder` (`modules/calculators/ScheduleBuilder.js`).
- Purchase & Refinance tabs both invoke this engine; refinance no longer maintains a divergent amortization path.
- Each tab stores the latest engine output in `tabData.builderResult` (source of truth for UI, exports, and future analytics tooling).
- Legacy `generateAmortizationSchedule` retained only for backward compatibility and explicitly marked DEPRECATED—new features and fixes land exclusively in `ScheduleBuilder`.

### Unified Engine & PMI Semantics

`ScheduleBuilder` produces a canonical object containing payment, payoff, escrow, PMI, and acceleration deltas. Key PMI rules:

| pmiMeta.pmiEndsMonth | Meaning                                                   |
| -------------------- | --------------------------------------------------------- |
| 1                    | PMI never charged (not applicable at origination or cash) |
| >1                   | First PMI-FREE month (month after last charged PMI)       |
| null                 | (Edge) PMI would never terminate within modeled span      |

The PMI monthly input is pre-computed outside the builder so alternative PMI rate sourcing can be plugged in without touching amortization code.

### Down Payment Sync Logic

Two-way sync between dollar amount and percent fields uses drift thresholds:

- < $1 change in amount => percent not recomputed
- < 0.01% change in percent => amount not recomputed
- Percent clamped softly to 99.99 to avoid pathological 100% divisions
- Last edited side wins when property value changes

Pure module: `purchase/DownPaymentSync.js` exposes `processEdit(state, edit)` for deterministic testing.

### Headless Purchase Scenario Logic & Refinance Parity

`purchase/PurchaseLogic.js` and corresponding refinance orchestration both normalize inputs before calling `ScheduleBuilder`, guaranteeing identical interpretations of LTV, PMI termination, and extra payment acceleration. Refinance introduces an optional `fixedMonthlyPMI` override (see below).

`purchase/PurchaseLogic.js` wraps ScheduleBuilder providing loanAmount, initial LTV, and normalized PMI metadata (forcing `pmiEndsMonth=1` when PMI is not applicable). This enables logic tests without DOM side-effects.

### PMI Classification

`purchase/PMIClassification.js` returns a semantic state machine with states: pending | none | active | ignored | possible plus badge classes (ltv-pending, ltv-cash, ltv-good, ltv-borderline, ltv-high). This isolates UI messaging from calculation concerns.

### Regression Testing Strategy (Dual Snapshots)

Two canonical snapshot baselines now protect metric invariants:

| Snapshot  | File                      | Core Assertions                                                             |
| --------- | ------------------------- | --------------------------------------------------------------------------- |
| Purchase  | `purchase.snapshot.json`  | monthlyPI, pmiEndsMonth, pmiTotalPaid (often 0), monthsSaved, interestSaved |
| Refinance | `refinance.snapshot.json` | Same metric set plus validation of refinance PMI drop & savings integrity   |

Update workflow:

1. Delete the snapshot you intend to recalibrate.
2. Run tests once to regenerate.
3. Inspect diff & rationale (e.g., algorithmic improvement vs bug fix).
4. Commit with a concise explanation (future: ENV flag gate planned).

Pure logic suites cover PMI state machine, down payment sync drift rules, amortization acceleration, and fixed PMI override semantics. DOM tests intentionally remain minimal (smoke validation + key interaction sync) to avoid brittleness.

### Refinance `fixedMonthlyPMI` Override

Refinance scenarios can model a contractual fixed PMI payment using `fixedMonthlyPMI`. The engine will:

- Apply the fixed amount until LTV crosses the termination threshold.
- Record `pmiMeta.pmiEndsMonth` using the same canonical semantics as percentage-based PMI.
- Omit percentage-derived PMI calculations to prevent double counting.

Result metrics (`pmiTotalPaid`, `interestSaved`, `monthsSaved`) remain consistent with purchase output fields, enabling unified exports and comparisons.

### Exporter Enhancements (Unified Metrics)

The PDF and CSV exporters aggregate:

- PMI lifecycle (start vs `pmiEndsMonth`)
- Total PMI paid (`pmiTotalPaid`)
- Acceleration benefits (`interestSaved`, `monthsSaved`) from extra payments
- Core payment decomposition (principal, interest, escrow) and payoff horizon

All metrics sourced from `builderResult` to ensure a single authoritative computation path.

Logic test suites (Jest) cover:

- Core amortization & PMI scenarios (threshold edges, zero interest, acceleration)
- Down payment sync drift & precedence rules (10 scenarios)
- PMI classification / visibility states
- Snapshot regression: `purchaseSnapshot.test.js` writes `purchase.snapshot.json` on first run then enforces stable canonical metrics (amount, monthlyPI, pmiEndsMonth, monthsSaved, etc.).

To intentionally update snapshot: delete file (or future ENV flag), run tests twice, commit with rationale.

### Guardrails & Validation

Run-time safeguards:

- Property value extremely low vs previous -> confirm
- Term > 40 years -> warning banner
- Extra payment > monthly P&I multiple thresholds -> advisory

These are implemented at the UI layer but calculation outcomes are validated by headless tests to remain invariant. Structural DOM tests were intentionally softened (smoke focus) to eliminate false negatives while preserving confidence in core math via pure suites.

---

### Deprecation Notice

`generateAmortizationSchedule` is deprecated and will be removed in a future major iteration. All feature work, bug fixes, and metric evolution take place exclusively in `ScheduleBuilder`. Migration guidance:

1. Replace legacy generator calls with normalized input → `ScheduleBuilder.build()`.
2. Use returned `pmiMeta`, `interestSaved`, and `monthsSaved` instead of ad hoc calculations.
3. Leverage snapshot baselines to validate behavior parity during transition.

---

---

<div align="center">

## 💫 **Ready for Immediate Use**

**Extract → Run → Calculate**
_No installation, no complications, just professional mortgage calculations_

**🎯 Gold Standard • 🛡️ Enterprise Ready • 📊 Professional Grade**

</div>
