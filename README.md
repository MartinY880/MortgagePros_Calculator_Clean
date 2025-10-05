# MortgagePros Calculator<div align="center">

A professional mortgage calculator application built with Electron. Calculate monthly payments, view amortization schedules, and visualize payment breakdowns with interactive charts.# 🏠💰 **MortgagePros Calculator** `v12.6.0` 🏆

## 🚀 Features[![� Ready-to-Run](https://img.shields.io/badge/🚀_Ready--to--Run-brightgreen?style=for-the-badge)](.)

[![📊 No Install](https://img.shields.io/badge/📊_No_Install-blue?style=for-the-badge)](.)

- **Loan Calculation**: Calculate monthly mortgage payments based on loan amount, interest rate, and term[![💻 Portable](https://img.shields.io/badge/💻_Portable-orange?style=for-the-badge)](.)

- **Amortization Schedule**: View detailed payment breakdown over the life of the loan [![🏢 Enterprise](https://img.shields.io/badge/🏢_Enterprise-purple?style=for-the-badge)](.)

- **Interactive Charts**: Visualize principal vs interest payments and loan balance over time

- **Export Options**: Generate PDF reports and CSV exports**� Download** → **� Extract** → **▶️ Run** | �️ _Unblock if Windows Defender prompts_

- **Professional UI**: Clean, responsive interface with auto-hiding notifications

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

**Version**: 12.6.0 (Updated Edition) ---

**Last Updated**: September 2025

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

### Internal Architecture (v16.2.1 Enhancement)

- Core amortization, PMI gating, extra payment acceleration, and baseline interest savings logic are unified in `ScheduleBuilder` (modules/calculators/ScheduleBuilder.js).
- Purchase & Refinance tabs now delegate to this shared engine (see `calculateMortgage`), ensuring consistency with comparison scoring logic.
- Engine output is persisted on each tab as `tabData.builderResult` for future export/report extensions.

---

<div align="center">

## 💫 **Ready for Immediate Use**

**Extract → Run → Calculate**
_No installation, no complications, just professional mortgage calculations_

**🎯 Gold Standard • 🛡️ Enterprise Ready • 📊 Professional Grade**

</div>
