// Import required modules for Electron environment
const { ipcRenderer } = require("electron");

// Global variables to store calculation results for all tabs
let purchaseData = {
  amortizationData: [],
  calculationResults: null,
  isCalculated: false,
};

let refinanceData = {
  amortizationData: [],
  calculationResults: null,
  isCalculated: false,
};

let helocData = {
  amortizationData: [],
  calculationResults: null,
  isCalculated: false,
};

let comparisonData = {
  loanA: null,
  loanB: null,
  loanC: null,
  isCalculated: false,
  bestOption: null,
  savings: null,
};

let charts = {};
let currentTab = "refinance"; // Track current active tab (matches HTML default)

// Theme Management
const THEME_KEY = "mortgageCalculatorTheme";
let currentTheme = "light";

// History Management
const HISTORY_KEY = "mortgageCalculatorHistory";
const MAX_HISTORY_ITEMS = 5;

// Custom Notification System
function showNotification(message, type = "danger") {
  const notificationArea = document.getElementById("notificationArea");
  const notificationMessage = document.getElementById("notificationMessage");
  const notificationText = document.getElementById("notificationText");

  // Set message and type
  notificationText.textContent = message;
  notificationMessage.className = `alert alert-${type} alert-dismissible fade show`;

  // Show notification
  notificationArea.style.display = "block";

  // Auto-hide after 3 seconds for all notification types
  setTimeout(() => {
    hideNotification();
  }, 3000);

  // Scroll to top to ensure visibility (guard for test environments like jsdom)
  try {
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } catch (_) {
    /* ignore */
  }
}

// Expose selected utilities for test harness when running under Jest (CommonJS environment)
try {
  if (typeof module !== "undefined" && module.exports) {
    module.exports.showNotification = showNotification;
  }
} catch (_) {}

// Defer exporting calculation & validation helpers until after their declarations
// A lightweight polling to append once definitions exist (for test environment only)
try {
  if (typeof module !== "undefined" && module.exports) {
    // Use a microtask to ensure later function declarations are hoisted (they are function declarations, so this is mostly defensive)
    queueMicrotask(() => {
      try {
        if (typeof calculateMortgage === "function")
          module.exports.calculateMortgage = calculateMortgage;
        if (typeof clearPurchaseFieldErrors === "function")
          module.exports.clearPurchaseFieldErrors = clearPurchaseFieldErrors;
        if (typeof applyPurchaseValidationErrors === "function")
          module.exports.applyPurchaseValidationErrors =
            applyPurchaseValidationErrors;
        // Expose lightweight getters for tab data so DOM integration tests can
        // inspect builderResult without relying on window-scoped globals
        module.exports.getPurchaseData = () => purchaseData;
        module.exports.getRefinanceData = () => refinanceData;
      } catch {
        /* ignore */
      }
    });
  }
} catch (_) {}

function hideNotification() {
  const notificationArea = document.getElementById("notificationArea");
  notificationArea.style.display = "none";
}

function showErrorMessage(message) {
  showNotification(message, "danger");
}

function showSuccessMessage(message) {
  showNotification(message, "success");
}

function showConfirmDialog(message, onConfirm, onCancel = null) {
  // Use Electron's dialog API for confirmation dialogs
  const { ipcRenderer } = require("electron");

  // Send request to main process for native dialog
  ipcRenderer
    .invoke("show-confirm-dialog", {
      type: "question",
      buttons: ["Yes", "No"],
      defaultId: 0,
      title: "Confirm Action",
      message: message,
    })
    .then((result) => {
      if (result.response === 0) {
        // Yes clicked
        onConfirm();
      } else if (onCancel) {
        // No clicked
        onCancel();
      }
    })
    .catch((error) => {
      console.error("Dialog error:", error);
      // Fallback to success if dialog fails
      onConfirm();
    });
}

// Theme Management Functions
function initializeTheme() {
  // Load saved theme or default to light
  const savedTheme = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);

  // Update theme toggle button
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = themeToggle?.querySelector(".icon");
  const themeText = themeToggle?.querySelector(".theme-text");

  if (themeToggle && themeIcon && themeText) {
    if (theme === "dark") {
      themeIcon.textContent = "☀️";
      themeText.textContent = "Light";
      themeToggle.setAttribute("title", "Switch to Light Mode");
    } else {
      themeIcon.textContent = "🌙";
      themeText.textContent = "Dark";
      themeToggle.setAttribute("title", "Switch to Dark Mode");
    }
  }

  // Save theme preference
  localStorage.setItem(THEME_KEY, theme);

  // Add smooth transition class
  document.body.style.transition = "all 0.3s ease";
  setTimeout(() => {
    document.body.style.transition = "";
  }, 300);
}

function toggleTheme() {
  const newTheme = currentTheme === "light" ? "dark" : "light";
  applyTheme(newTheme);

  // Show theme change notification
  showNotification(
    `Switched to ${newTheme === "dark" ? "Dark" : "Light"} Mode`,
    "success"
  );
}

// Enhanced Animation Functions
function addFadeInAnimation(element, delay = 0) {
  if (element) {
    element.style.animationDelay = `${delay}ms`;
    element.classList.add("fade-in-up");
  }
}

function addSlideInAnimation(element, delay = 0) {
  if (element) {
    element.style.animationDelay = `${delay}ms`;
    element.classList.add("slide-in");
  }
}

function showResultsWithAnimation() {
  const resultsSection = document.getElementById("resultsSummary");
  const tabsSection = document.getElementById("tabsSection");

  if (resultsSection) {
    resultsSection.style.display = "block";
    addFadeInAnimation(resultsSection, 100);
  }

  if (tabsSection) {
    tabsSection.style.display = "block";
    addFadeInAnimation(tabsSection, 200);

    // Ensure Payment Summary & Analysis tab is active by default
    setTimeout(() => {
      // Remove active from all tabs in the mortgage tabs section
      document.querySelectorAll("#mortgageTabs .nav-link").forEach((tab) => {
        tab.classList.remove("active");
        tab.setAttribute("aria-selected", "false");
      });

      // Remove active from all tab content panes
      document
        .querySelectorAll("#mortgageTabsContent .tab-pane")
        .forEach((pane) => {
          pane.classList.remove("active", "show");
        });

      // Activate the Payment Summary & Analysis tab
      const summaryTab = document.getElementById("summary-tab");
      const summaryContent = document.getElementById("summary");

      if (summaryTab && summaryContent) {
        summaryTab.classList.add("active");
        summaryTab.setAttribute("aria-selected", "true");
        summaryContent.classList.add("active", "show");
      }
    }, 300); // Small delay to ensure DOM is ready
  }
}

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
  // Test jsPDF availability immediately
  console.log("Testing jsPDF availability...");
  console.log("window.jspdf:", window.jspdf);
  console.log("typeof window.jspdf:", typeof window.jspdf);
  if (window.jspdf) {
    console.log("jsPDF constructor:", window.jspdf.jsPDF);
    console.log("typeof jsPDF constructor:", typeof window.jspdf.jsPDF);
  }

  // Initialize theme first
  initializeTheme();

  // Initialize event listeners once DOM is fully loaded
  initializeEventListeners();

  // Load logo with proper path handling
  loadLogo();

  // Load cached data from localStorage
  loadCachedData();

  // Provide default non-zero refinance demo values in test/jsdom environments
  try {
    const isTest =
      typeof process !== "undefined" &&
      process.env.JEST_WORKER_ID !== undefined;
    if (isTest) {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && (!el.value || el.value === "0")) el.value = String(val);
      };
      setVal("appraisedValue", 300000);
      setVal("refinanceLoanAmount", 240000);
      setVal("refinanceInterestRate", 5.5);
      setVal("refinanceLoanTerm", 30);
      setVal("refinancePmiAmount", 120);
      // Do not auto-run calculation; tests control invocation
    }
  } catch (_) {}

  // Listen for menu commands from the main process
  ipcRenderer.on("menu-export-schedule", () => {
    exportToCSV();
  });
});

function initializeEventListeners() {
  // Theme toggle event listener
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  // Calculate button event listeners
  const calculateBtn = document.getElementById("calculateBtn");
  if (calculateBtn) {
    calculateBtn.addEventListener("click", () => calculateMortgage("purchase"));
  }

  const calculateRefinanceBtn = document.getElementById(
    "calculateRefinanceBtn"
  );
  if (calculateRefinanceBtn) {
    calculateRefinanceBtn.addEventListener("click", () =>
      calculateMortgage("refinance")
    );
  }

  const calculateHelocBtn = document.getElementById("calculateHelocBtn");
  if (calculateHelocBtn) {
    calculateHelocBtn.addEventListener("click", () => calculateHELOC());
  }

  // Export buttons
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", exportToCSV);
  }

  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", exportToPDF);
  }

  const exportReportBtn = document.getElementById("exportReportBtn");
  if (exportReportBtn) {
    exportReportBtn.addEventListener("click", exportFullReport);
  }

  // Down payment preset buttons (Purchase tab)
  const presetContainer = document.getElementById("downPaymentPresetGroup");
  /**
   * Apply a quick down payment preset percentage (e.g. 5,10,15,20).
   * Normal runtime: delegates to bidirectional sync helper for consistency.
   * Test runtime (Jest): bypasses debounce for deterministic direct assignment.
   * @param {number} pct Whole-number percentage to apply.
   */
  function applyDownPaymentPreset(pct) {
    const propertyEl = document.getElementById("propertyValue");
    const percentEl = document.getElementById("downPaymentPercent");
    const amountEl = document.getElementById("downPaymentAmount");
    const pv = parseFloat(propertyEl?.value.replace(/,/g, "")) || 0;
    const computedAmount = pv > 0 ? Math.round((pv * pct) / 100) : 0;
    const isTestEnv =
      typeof process !== "undefined" && process.env.JEST_WORKER_ID;
    if (!isTestEnv) {
      try {
        applyDownPaymentValues(
          { amount: computedAmount, percent: pct },
          { source: "percent" }
        );
      } catch (_) {
        if (percentEl) percentEl.value = pct.toFixed(2);
        if (amountEl) amountEl.value = computedAmount.toString();
      }
      if (typeof DOWN_PAYMENT_SYNC !== "undefined")
        DOWN_PAYMENT_SYNC.lastSource = "percent";
    } else {
      if (percentEl) percentEl.value = pct.toFixed(2);
      if (amountEl) amountEl.value = computedAmount.toString();
      if (typeof DOWN_PAYMENT_SYNC !== "undefined")
        DOWN_PAYMENT_SYNC.lastSource = "percent";
    }
    try {
      updatePurchaseLtvPmiStatus({ notify: true });
    } catch (_) {}
  }
  if (presetContainer) {
    const buttons = presetContainer.querySelectorAll(".dp-preset");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const pct = parseFloat(btn.getAttribute("data-preset"));
        if (!isNaN(pct)) applyDownPaymentPreset(pct);
      });
    });
  }
  try {
    if (typeof module !== "undefined" && module.exports) {
      module.exports.applyDownPaymentPreset = applyDownPaymentPreset;
    }
  } catch (_) {}

  const exportRefinanceReportBtn = document.getElementById(
    "exportRefinanceReportBtn"
  );
  if (exportRefinanceReportBtn) {
    exportRefinanceReportBtn.addEventListener("click", exportFullReport);
  }

  const exportHelocReportBtn = document.getElementById("exportHelocReportBtn");
  if (exportHelocReportBtn) {
    exportHelocReportBtn.addEventListener("click", exportFullReport);
  }

  // Comparison buttons
  const compareLoansBtn = document.getElementById("compareLoansBtn");
  if (compareLoansBtn) {
    compareLoansBtn.addEventListener("click", calculateLoanComparison);
  }

  const exportComparisonBtn = document.getElementById(
    "exportComparisonReportBtn"
  );
  if (exportComparisonBtn) {
    exportComparisonBtn.addEventListener("click", exportComparisonReport);
  }

  const clearComparisonBtn = document.getElementById("clearComparisonBtn");
  if (clearComparisonBtn) {
    clearComparisonBtn.addEventListener("click", clearComparisonForm);
  }

  // Blended Mortgage buttons
  const calculateBlendedBtn = document.getElementById("calculateBlendedBtn");
  if (calculateBlendedBtn) {
    calculateBlendedBtn.addEventListener("click", calculateBlendedMortgage);
  }

  const exportBlendedReportBtn = document.getElementById(
    "exportBlendedReportBtn"
  );
  if (exportBlendedReportBtn) {
    exportBlendedReportBtn.addEventListener("click", exportBlendedReport);
  }

  const clearBlendedBtn = document.getElementById("clearBlendedBtn");
  if (clearBlendedBtn) {
    clearBlendedBtn.addEventListener("click", clearBlendedForm);
  }

  const addComponentBtn = document.getElementById("addComponentBtn");
  if (addComponentBtn) {
    addComponentBtn.addEventListener("click", addBlendedComponent);
  }

  // Second mortgage type change listener
  const secondMortgageType = document.getElementById("secondMortgageType");
  if (secondMortgageType) {
    secondMortgageType.addEventListener(
      "change",
      handleSecondMortgageTypeChange
    );
  }

  // No auto-recalculation: users trigger calculations via Calculate buttons only

  // Add/Remove Option B buttons
  const addOption2Btn = document.getElementById("addOption2Btn");
  if (addOption2Btn) {
    addOption2Btn.addEventListener("click", addOption2);
  }

  const removeOption2Btn = document.getElementById("removeOption2Btn");
  if (removeOption2Btn) {
    removeOption2Btn.addEventListener("click", removeOption2);
  }

  // Tab event listeners for chart rendering
  const chartTab = document.getElementById("chart-tab");
  if (chartTab) {
    chartTab.addEventListener("click", () => {
      setTimeout(renderCharts, 50); // Small delay to ensure tab is visible
    });
  }

  // Input field event listeners for down payment calculations
  // Down Payment Sync listeners (enhanced logic replaces legacy simple handlers)
  attachDownPaymentSyncListeners();

  // Tab switching event listeners
  const refinanceTab = document.getElementById("refinance-tab");
  if (refinanceTab) {
    refinanceTab.addEventListener("click", () => switchTab("refinance"));
  }
  const comparisonTab = document.getElementById("comparison-tab");
  if (comparisonTab) {
    comparisonTab.addEventListener("click", () => switchTab("comparison"));
  }
  const purchaseTab = document.getElementById("purchase-tab");
  if (purchaseTab) {
    purchaseTab.addEventListener("click", () => {
      console.log("Purchase tab clicked");
      switchTab("purchase");
    });
  } else {
    console.error("Purchase tab element not found");
  }

  const helocTab = document.getElementById("heloc-tab");
  if (helocTab) {
    helocTab.addEventListener("click", () => {
      console.log("HELOC tab clicked");
      switchTab("heloc");
    });
  } else {
    console.error("HELOC tab element not found");
  }

  const blendedTab = document.getElementById("blended-tab");
  if (blendedTab) {
    blendedTab.addEventListener("click", () => {
      console.log("Blended tab clicked");
      switchTab("blended");
    });
  } else {
    console.error("Blended tab element not found");
  }

  // PMI toggle event listener
  const refinancePmiToggle = document.getElementById("refinancePmiToggle");
  if (refinancePmiToggle) {
    refinancePmiToggle.addEventListener("change", togglePmiMode);
  }

  // Comparison PMI toggle event listeners
  const loanA_pmiToggle = document.getElementById("loanA_pmiToggle");
  if (loanA_pmiToggle) {
    loanA_pmiToggle.addEventListener("change", () =>
      toggleComparisonPmiMode("A")
    );
  }

  const loanB_pmiToggle = document.getElementById("loanB_pmiToggle");
  if (loanB_pmiToggle) {
    loanB_pmiToggle.addEventListener("change", () =>
      toggleComparisonPmiMode("B")
    );
  }

  const loanC_pmiToggle = document.getElementById("loanC_pmiToggle");
  if (loanC_pmiToggle) {
    loanC_pmiToggle.addEventListener("change", () =>
      toggleComparisonPmiMode("C")
    );
  }

  // Auto-save form data on input changes
  const formInputs = document.querySelectorAll("input, select");
  formInputs.forEach((input) => {
    input.addEventListener("change", saveDataToCache);
  });

  // History management event listeners
  const historySelect = document.getElementById("historySelect");
  if (historySelect) {
    historySelect.addEventListener("change", (e) => {
      if (e.target.value) {
        loadCalculationFromHistory(e.target.value);
        // Reset the dropdown to default
        e.target.value = "";
      }
    });
  }

  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      showConfirmDialog(
        "Are you sure you want to clear all calculation history? This cannot be undone.",
        () => {
          clearCalculationHistory();
          showSuccessMessage("Calculation history cleared successfully");
        }
      );
    });
  }

  // Initialize history dropdown
  updateHistoryDropdown();
}

// Ensure event listeners initialize even if DOMContentLoaded already fired (e.g., test harness loads HTML then script)
try {
  if (typeof document !== "undefined") {
    if (
      document.readyState === "interactive" ||
      document.readyState === "complete"
    ) {
      // DOM already parsed
      try {
        initializeEventListeners();
      } catch (_) {}
    } else {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          try {
            initializeEventListeners();
          } catch (_) {}
        },
        { once: true }
      );
    }
  }
} catch (_) {}

// Save data to localStorage
function saveDataToCache() {
  try {
    localStorage.setItem(
      "mortgageCalculator_purchaseData",
      JSON.stringify(purchaseData)
    );
    localStorage.setItem(
      "mortgageCalculator_refinanceData",
      JSON.stringify(refinanceData)
    );
    localStorage.setItem(
      "mortgageCalculator_helocData",
      JSON.stringify(helocData)
    );

    // Save form values for both tabs
    const purchaseFormData = {
      propertyValue: document.getElementById("propertyValue").value,
      downPaymentAmount: document.getElementById("downPaymentAmount").value,
      downPaymentPercent: document.getElementById("downPaymentPercent").value,
      loanTerm: document.getElementById("loanTerm").value,
      interestRate: document.getElementById("interestRate").value,
      propertyTax: document.getElementById("propertyTax").value,
      homeInsurance: document.getElementById("homeInsurance").value,
      hoa: document.getElementById("hoa").value,
      pmiRate: document.getElementById("pmiRate").value,
      extraPayment: document.getElementById("extraPayment").value,
    };

    const refinanceFormData = {
      appraisedValue: document.getElementById("appraisedValue").value,
      refinanceLoanAmount: document.getElementById("refinanceLoanAmount").value,
      refinanceLoanTerm: document.getElementById("refinanceLoanTerm").value,
      refinanceInterestRate: document.getElementById("refinanceInterestRate")
        .value,
      refinancePropertyTax: document.getElementById("refinancePropertyTax")
        .value,
      refinanceHomeInsurance: document.getElementById("refinanceHomeInsurance")
        .value,
      refinancePmiAmount: document.getElementById("refinancePmiAmount").value,
      refinancePmiToggle: document.getElementById("refinancePmiToggle").checked,
      refinanceExtraPayment: document.getElementById("refinanceExtraPayment")
        .value,
    };

    const helocFormData = {
      helocPropertyValue: document.getElementById("helocPropertyValue").value,
      helocOutstandingBalance: document.getElementById(
        "helocOutstandingBalance"
      ).value,
      helocLoanAmount: document.getElementById("helocLoanAmount").value,
      helocInterestRate: document.getElementById("helocInterestRate").value,
      helocInterestOnlyPeriod: document.getElementById(
        "helocInterestOnlyPeriod"
      ).value,
      helocRepaymentPeriod: document.getElementById("helocRepaymentPeriod")
        .value,
    };

    localStorage.setItem(
      "mortgageCalculator_purchaseForm",
      JSON.stringify(purchaseFormData)
    );
    localStorage.setItem(
      "mortgageCalculator_refinanceForm",
      JSON.stringify(refinanceFormData)
    );
    localStorage.setItem(
      "mortgageCalculator_helocForm",
      JSON.stringify(helocFormData)
    );
    // Don't save comparison tab as current tab to prevent startup confusion
    if (currentTab !== "comparison") {
      localStorage.setItem("mortgageCalculator_currentTab", currentTab);
    }
  } catch (error) {
    console.warn("Failed to save data to cache:", error);
  }
}

// Load data from localStorage
// Initialize the UI with zero values in payment summary
function initializePaymentSummaryWithZeros() {
  // Initialize main payment summary with zeros
  const paymentSummaryElements = {
    monthlyPayment: "$0.00",
    baseMonthlyPayment: "$0.00",
    loanAmount: "$0.00",
    totalInterest: "$0.00",
    principalInterest: "$0.00",
    propertyTaxAmount: "$0.00",
    insuranceAmount: "$0.00",
    pmiAmount: "$0.00",
    hoaAmount: "$0.00",
    extraAmount: "$0.00",
    totalCost: "$0.00",
  };

  Object.keys(paymentSummaryElements).forEach((elementId) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = paymentSummaryElements[elementId];
    }
  });

  // Hide Base Monthly Payment row by default until extra payment is entered
  const baseMonthlyPaymentContainer = document
    .getElementById("baseMonthlyPayment")
    ?.closest(".result-item");
  if (baseMonthlyPaymentContainer) {
    baseMonthlyPaymentContainer.style.display = "none";
  }

  // Initialize summary tab with zeros
  const summaryElements = {
    summaryPI: "$0.00",
    summaryTI: "$0.00",
    summaryPMI: "$0.00",
    summaryHOA: "$0.00",
    summaryLTV: "0%",
    summaryTotalInterest: "$0.00",
    summaryPayoffDate: "--",
  };

  Object.keys(summaryElements).forEach((elementId) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = summaryElements[elementId];
    }
  });

  // Show payment summary section with zero values, but hide detailed tabs until calculation
  document.getElementById("resultsSummary").style.display = "block";
  document.getElementById("tabsSection").style.display = "none";
}

function initializeBlendedSummaryWithZeros() {
  // Initialize blended mortgage summary with zeros
  const summaryData = document.getElementById("summaryData");
  if (summaryData) {
    summaryData.innerHTML = `
      <div class="row g-2">
        <div class="col-6">
          <div class="result-item">
            <h6>First Mortgage</h6>
            <p class="result-value">$0</p>
            <small class="text-muted">Monthly P&I</small>
          </div>
        </div>
        <div class="col-6">
          <div class="result-item">
            <h6>Second Component</h6>
            <p class="result-value">$0</p>
            <small class="text-muted">Interest-Only</small>
          </div>
        </div>
        <div class="col-12">
          <hr class="my-2">
          <div class="result-item">
            <h6>Total P&I Payment</h6>
            <p class="result-value">$0</p>
            <small class="text-muted">Combined Principal & Interest</small>
          </div>
        </div>
        <div class="col-12">
          <div class="result-item highlight-result">
            <h6>Total Monthly Payment</h6>
            <p class="result-value highlight">$0</p>
            <small class="text-muted">Including All Costs</small>
          </div>
        </div>
        <div class="col-12">
          <div class="result-item">
            <h6>Blended Rate</h6>
            <p class="result-value">0.000%</p>
            <small class="text-muted">Weighted Average Rate</small>
          </div>
        </div>
      </div>
    `;
  }
}

function loadCachedData() {
  try {
    // Initialize payment summary with zeros first
    initializePaymentSummaryWithZeros();

    // Load form data only (no calculation results)
    const savedPurchaseForm = localStorage.getItem(
      "mortgageCalculator_purchaseForm"
    );
    const savedRefinanceForm = localStorage.getItem(
      "mortgageCalculator_refinanceForm"
    );
    const savedHelocForm = localStorage.getItem("mortgageCalculator_helocForm");
    const savedTab = localStorage.getItem("mortgageCalculator_currentTab");

    if (savedTab && savedTab !== "comparison") {
      // Only restore non-comparison tabs to prevent results confusion
      currentTab = savedTab;
    }
    // If saved tab was comparison or no saved tab, keep default (refinance)

    if (savedPurchaseForm) {
      const formData = JSON.parse(savedPurchaseForm);
      Object.keys(formData).forEach((key) => {
        const element = document.getElementById(key);
        if (element && formData[key]) {
          element.value = formData[key];
        }
      });
    }

    if (savedRefinanceForm) {
      const formData = JSON.parse(savedRefinanceForm);
      Object.keys(formData).forEach((key) => {
        const element = document.getElementById(key);
        if (element) {
          if (key === "refinancePmiToggle") {
            // Handle checkbox toggle specially
            element.checked = formData[key];
            // Update the UI to match the toggle state
            togglePmiMode();
          } else if (formData[key]) {
            element.value = formData[key];
          }
        }
      });
    }

    if (savedHelocForm) {
      const formData = JSON.parse(savedHelocForm);
      Object.keys(formData).forEach((key) => {
        const element = document.getElementById(key);
        if (element && formData[key]) {
          element.value = formData[key];
        }
      });
    }

    // Only clear the isCalculated flag to prevent showing old results on startup
    // but preserve data structure for proper chart functionality
    purchaseData.isCalculated = false;
    refinanceData.isCalculated = false;
    helocData.isCalculated = false;

    // Also clear comparison data to prevent cross-tab contamination
    comparisonData.isCalculated = false;
    comparisonData.loanA = null;
    comparisonData.loanB = null;
    comparisonData.loanC = null;
    comparisonData.bestOption = null;
    comparisonData.savings = null;

    // Remove any existing cached calculation data from localStorage
    localStorage.removeItem("mortgageCalculator_purchaseData");
    localStorage.removeItem("mortgageCalculator_refinanceData");
    localStorage.removeItem("mortgageCalculator_helocData");

    // Clear comparison tab from currentTab if it was saved previously
    if (currentTab === "comparison") {
      localStorage.removeItem("mortgageCalculator_currentTab");
      currentTab = "refinance"; // Reset to default
    }

    // Switch to the saved tab but don't restore calculation results
    switchTab(currentTab, false);

    // Extra safeguard: ensure comparison results are hidden on startup
    const comparisonResults = document.getElementById("comparisonResults");
    if (comparisonResults && currentTab !== "comparison") {
      comparisonResults.style.display = "none";
    }
  } catch (error) {
    console.warn("Failed to load cached data:", error);
    // Ensure zeros are shown even if loading fails
    initializePaymentSummaryWithZeros();
  }
}

// History Management Functions
function saveCalculationToHistory(tabType, formData, calculationResults) {
  try {
    const history = getCalculationHistory();
    const timestamp = new Date().toISOString();

    // Create a descriptive label for the calculation
    let label = "";
    if (tabType === "purchase") {
      label = `Purchase - $${formatNumberForDisplay(formData.propertyValue)} (${
        formData.interestRate
      }% ${formData.loanTerm}yr)`;
    } else if (tabType === "refinance") {
      label = `Refinance - $${formatNumberForDisplay(
        formData.refinanceLoanAmount
      )} (${formData.refinanceInterestRate}% ${formData.refinanceLoanTerm}yr)`;
    } else if (tabType === "heloc") {
      label = `HELOC - $${formatNumberForDisplay(formData.helocAmount)} (${
        formData.helocInterestRate
      }% ${formData.helocInterestOnlyPeriod}+${
        formData.helocRepaymentPeriod
      }yr)`;
    }

    const historyItem = {
      id: timestamp,
      label: label,
      tabType: tabType,
      formData: formData,
      calculationResults: calculationResults,
      timestamp: timestamp,
      date: new Date(timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    // Add to beginning of array (most recent first)
    history.unshift(historyItem);

    // Keep only the most recent items
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS);
    }

    // Save to localStorage
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    // Update the history dropdown
    updateHistoryDropdown();
  } catch (error) {
    console.warn("Failed to save calculation to history:", error);
  }
}

function getCalculationHistory() {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.warn("Failed to load calculation history:", error);
    return [];
  }
}

function updateHistoryDropdown() {
  const historySelect = document.getElementById("historySelect");
  if (!historySelect) return;

  const history = getCalculationHistory();

  // Clear existing options except the first one
  historySelect.innerHTML =
    '<option value="">Load Previous Calculation</option>';

  // Add history items
  history.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.date} - ${item.label}`;
    historySelect.appendChild(option);
  });
}

function loadCalculationFromHistory(historyId) {
  try {
    const history = getCalculationHistory();
    const item = history.find((h) => h.id === historyId);

    if (!item) {
      console.warn("History item not found:", historyId);
      return;
    }

    // Switch to the appropriate tab
    const tabButton = document.getElementById(`${item.tabType}-tab`);
    if (tabButton) {
      tabButton.click();
    }

    // Load form data
    Object.keys(item.formData).forEach((key) => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === "checkbox") {
          element.checked = item.formData[key];
        } else {
          element.value = item.formData[key];
        }
      }
    });

    // Restore calculation results
    if (item.tabType === "purchase") {
      purchaseData.calculationResults = item.calculationResults;
      purchaseData.isCalculated = true;
      updateResultsUI(...item.calculationResults, "purchase");
    } else if (item.tabType === "refinance") {
      refinanceData.calculationResults = item.calculationResults;
      refinanceData.isCalculated = true;
      updateResultsUI(...item.calculationResults, "refinance");
    } else if (item.tabType === "heloc") {
      helocData.calculationResults = item.calculationResults;
      helocData.isCalculated = true;
      updateHelocResultsUI(...item.calculationResults);
    }

    // Show results sections
    document.getElementById("resultsSummary").style.display = "block";
    document.getElementById("tabsSection").style.display = "block";

    // Recalculate and update amortization
    if (item.tabType === "heloc") {
      calculateHELOC();
    } else {
      calculateMortgage(item.tabType);
    }
  } catch (error) {
    console.warn("Failed to load calculation from history:", error);
  }
}

function clearCalculationHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
    updateHistoryDropdown();

    // Show confirmation
    alert("Calculation history has been cleared.");
  } catch (error) {
    console.warn("Failed to clear calculation history:", error);
  }
}

function formatNumberForDisplay(value) {
  const num = parseFloat(value.toString().replace(/,/g, ""));
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

// Switch between tabs and maintain separate state
function switchTab(tabType, saveCurrentState = true) {
  console.log("switchTab called with:", tabType);

  if (saveCurrentState) {
    saveDataToCache();
  }

  currentTab = tabType;

  // Activate Bootstrap tab
  const tabButton = document.getElementById(`${tabType}-tab`);
  const tabContent = document.getElementById(tabType);

  console.log("Tab elements found:", {
    tabType,
    tabButton: !!tabButton,
    tabContent: !!tabContent,
    tabButtonId: tabButton?.id,
    tabContentId: tabContent?.id,
  });

  if (tabButton && tabContent) {
    // Completely manual tab activation - no Bootstrap dependency
    console.log("Activating tab manually:", tabType);

    // Remove active class from all tabs
    document.querySelectorAll(".nav-tabs .nav-link").forEach((tab) => {
      tab.classList.remove("active");
      tab.setAttribute("aria-selected", "false");
    });

    // Remove active class from all tab content panes
    document.querySelectorAll(".tab-content .tab-pane").forEach((pane) => {
      pane.classList.remove("active", "show");
    });

    // Add active class to current tab and content
    tabButton.classList.add("active");
    tabButton.setAttribute("aria-selected", "true");
    tabContent.classList.add("active", "show");

    console.log("Tab activated successfully:", {
      tabButton: tabButton.classList.contains("active"),
      tabContent: tabContent.classList.contains("active"),
    });
  } else {
    console.error("Tab elements not found:", {
      tabType,
      tabButton: !!tabButton,
      tabContent: !!tabContent,
    });
  }

  // Handle comparison tab separately
  if (tabType === "comparison") {
    // Hide regular results and show comparison results
    document.getElementById("resultsSummary").style.display = "none";
    document.getElementById("tabsSection").style.display = "none";
    // Hide blended results
    document.getElementById("blendedResultsSummary").style.display = "none";

    // Always show comparison results section (like other tabs)
    document.getElementById("comparisonResults").style.display = "block";

    // Don't save comparison tab to localStorage to prevent startup confusion
    // Comparison tab should always be entered fresh
    return;
  }

  // Handle blended tab separately
  if (tabType === "blended") {
    // Hide regular results and comparison results
    document.getElementById("resultsSummary").style.display = "none";
    document.getElementById("comparisonResults").style.display = "none";
    document.getElementById("tabsSection").style.display = "none";

    // Always show blended results section (like comparison tab)
    const blendedResultsSummary = document.getElementById(
      "blendedResultsSummary"
    );
    blendedResultsSummary.style.display = "block";

    // Initialize with zeros if no calculation exists yet
    if (!window.blendedMortgageData) {
      initializeBlendedSummaryWithZeros();
    }

    return;
  }

  // Get the current tab's data
  let tabData;
  if (tabType === "purchase") {
    tabData = purchaseData;
  } else if (tabType === "refinance") {
    tabData = refinanceData;
  } else if (tabType === "heloc") {
    tabData = helocData;
  }

  // Hide comparison results and blended results for regular tabs
  const comparisonResults = document.getElementById("comparisonResults");
  if (comparisonResults) {
    comparisonResults.style.display = "none";
  }

  const blendedResults = document.getElementById("blendedResultsSummary");
  if (blendedResults) {
    blendedResults.style.display = "none";
  }

  // Always ensure regular results sections are visible when switching to regular tabs
  document.getElementById("resultsSummary").style.display = "block";

  // Update the UI to show the correct tab's results
  if (tabData && tabData.isCalculated && tabData.calculationResults) {
    // Restore the calculation results for this tab
    if (tabType === "heloc") {
      // For HELOC, use the specialized HELOC UI function
      const [
        interestOnlyPayment,
        principalInterestPayment,
        helocAmount,
        totalInterest,
        propertyValue,
        outstandingBalance,
        ltv,
      ] = tabData.calculationResults;
      updateHelocResultsUI(
        interestOnlyPayment,
        principalInterestPayment,
        helocAmount,
        totalInterest,
        propertyValue,
        outstandingBalance,
        ltv
      );
    } else {
      // For mortgage tabs, use the regular UI function
      updateResultsUI(...tabData.calculationResults, tabType);
    }
    updateAmortizationTable(tabType);
    document.getElementById("resultsSummary").style.display = "block";
    document.getElementById("tabsSection").style.display = "block";
  } else {
    // Show payment summary with zeros if no calculation has been performed, but hide detailed tabs
    document.getElementById("resultsSummary").style.display = "block";
    document.getElementById("tabsSection").style.display = "none";

    // Only initialize zeros if we don't already have data showing
    const monthlyPaymentElement = document.getElementById("monthlyPayment");
    if (
      !monthlyPaymentElement ||
      monthlyPaymentElement.textContent === "$0.00" ||
      monthlyPaymentElement.textContent === "$0"
    ) {
      initializePaymentSummaryWithZeros();
    }
  }

  // Show/hide sections based on tab type
  const hoaSummarySection = document.getElementById("hoaSummarySection");
  const summaryHOASection = document.getElementById("summaryHOASection");

  // Fields to show/hide for HELOC vs mortgage tabs
  const fieldsToToggle = [
    document.getElementById("propertyTaxAmount")?.closest(".result-item"),
    document.getElementById("insuranceAmount")?.closest(".result-item"),
    document.getElementById("pmiAmount")?.closest(".result-item"),
    document.getElementById("extraAmount")?.closest(".result-item"),
  ];

  if (tabType === "heloc") {
    // Hide mortgage-specific fields for HELOC
    fieldsToToggle.forEach((field) => {
      if (field) field.style.display = "none";
    });
    if (hoaSummarySection) hoaSummarySection.style.display = "none";
    if (summaryHOASection) summaryHOASection.style.display = "none";
  } else {
    // Show fields for mortgage tabs
    fieldsToToggle.forEach((field) => {
      if (field) field.style.display = "block";
    });
    // HOA only for purchase tab
    if (hoaSummarySection) {
      hoaSummarySection.style.display =
        tabType === "purchase" ? "block" : "none";
    }
    if (summaryHOASection) {
      summaryHOASection.style.display =
        tabType === "purchase" ? "block" : "none";
    }
  }

  // Save the current tab preference (except comparison tab)
  if (saveCurrentState && currentTab !== "comparison") {
    localStorage.setItem("mortgageCalculator_currentTab", currentTab);
  }
}

// Load logo with proper path handling for packaged app
function loadLogo() {
  const logoElement = document.getElementById("logo");

  // Set the logo source to the correct path in assets folder
  logoElement.src = "../assets/logo.png";

  // Fallback: if logo fails to load, try alternative paths
  logoElement.onerror = function () {
    console.log(
      "Logo failed to load from ../assets/logo.png, trying alternatives..."
    );
    const fallbacks = ["./assets/logo.png", "./logo.png"];
    let currentFallback = 0;

    const tryNextFallback = () => {
      if (currentFallback < fallbacks.length) {
        logoElement.src = fallbacks[currentFallback];
        currentFallback++;
        logoElement.onerror =
          currentFallback < fallbacks.length
            ? tryNextFallback
            : () => {
                console.warn("All logo paths failed to load");
                logoElement.style.display = "none"; // Hide broken image
              };
      }
    };

    tryNextFallback();
  };
}

// Calculate mortgage based on input values
function calculateMortgage(formType = "purchase", options = {}) {
  try {
    if (
      typeof process !== "undefined" &&
      process.env.JEST_WORKER_ID !== undefined
    ) {
      console.log(
        `[RefiDOMTest] calculateMortgage invoked formType=${formType}`
      );
    }
  } catch (_) {}
  let propertyValue,
    loanAmount,
    loanTerm,
    interestRate,
    propertyTax,
    homeInsurance,
    hoa,
    pmiRate;
  // Added: capture downPaymentPercent separately for purchase validation
  let downPaymentPercentRaw = 0;

  // Refinance uses a dollar-based PMI amount; keep separate from purchase percent-based pmiRate
  let pmiAmountRefi = 0;

  // Refinance-only: closing costs & points
  let closingCosts = 0;
  let pointsPercent = 0;
  let financeCosts = false;
  let pointsAmount = 0;
  let financedCosts = 0;
  let adjustedLoanAmount = 0;
  let dueAtClosing = 0;
  // Refinance-only: optional cash-out
  let cashOutAmount = 0;

  let extraPayment = 0;

  if (formType === "refinance") {
    // Get values from refinance form
    propertyValue =
      parseFloat(document.getElementById("appraisedValue").value) || 0;
    loanAmount =
      parseFloat(document.getElementById("refinanceLoanAmount").value) || 0;
    loanTerm =
      parseInt(document.getElementById("refinanceLoanTerm").value, 10) || 0;
    interestRate =
      parseFloat(document.getElementById("refinanceInterestRate").value) || 0;
    propertyTax =
      parseFloat(document.getElementById("refinancePropertyTax").value) || 0;
    homeInsurance =
      parseFloat(document.getElementById("refinanceHomeInsurance").value) || 0;
    hoa = 0; // Not included in refinance form
    pmiAmountRefi =
      parseFloat(document.getElementById("refinancePmiAmount").value) || 0;
    extraPayment =
      parseFloat(document.getElementById("refinanceExtraPayment").value) || 0;
    if (extraPayment < 0) {
      showErrorMessage("Extra Monthly Payment must be a number ≥ 0.");
      return;
    }

    // Closing costs & points
    closingCosts =
      parseFloat(document.getElementById("refinanceClosingCosts")?.value) || 0;
    pointsPercent =
      parseFloat(document.getElementById("refinancePoints")?.value) || 0;
    // Cash-out amount (added to principal; not a cost)
    cashOutAmount =
      parseFloat(document.getElementById("refinanceCashOut")?.value) || 0;
    // Read radio selection: 'due' (default) or 'finance'
    const costHandlingDue = document.getElementById("refiCosts_due");
    const costHandlingFinance = document.getElementById("refiCosts_finance");
    financeCosts = costHandlingFinance && costHandlingFinance.checked;
    if (closingCosts < 0 || pointsPercent < 0 || cashOutAmount < 0) {
      showErrorMessage(
        "Closing Costs, Points, and Cash-Out must be numbers ≥ 0."
      );
      return;
    }
    // Soft cap points at 5% with a warning behavior (clip)
    if (pointsPercent > 5) {
      pointsPercent = 5;
    }
    pointsAmount = (pointsPercent / 100) * loanAmount;
    financedCosts = closingCosts + pointsAmount; // cash-out is not a cost
    // Cash-out is always added to the loan principal; costs optionally financed
    adjustedLoanAmount =
      loanAmount + cashOutAmount + (financeCosts ? financedCosts : 0);
    dueAtClosing = financeCosts ? 0 : financedCosts;

    // For refinance, there's no down payment - loan amount is specified directly
    var downPaymentAmount = 0;
  } else {
    // Get values from purchase form
    propertyValue =
      parseFloat(document.getElementById("propertyValue").value) || 0;
    var downPaymentAmount =
      parseFloat(document.getElementById("downPaymentAmount").value) || 0;
    downPaymentPercentRaw = parseFloat(
      document.getElementById("downPaymentPercent")?.value
    );
    loanAmount = propertyValue - downPaymentAmount;
    loanTerm = parseInt(document.getElementById("loanTerm").value, 10) || 0;
    interestRate =
      parseFloat(document.getElementById("interestRate").value) || 0;
    propertyTax = parseFloat(document.getElementById("propertyTax").value) || 0;
    homeInsurance =
      parseFloat(document.getElementById("homeInsurance").value) || 0;
    hoa = parseFloat(document.getElementById("hoa").value) || 0;
    pmiRate = parseFloat(document.getElementById("pmiRate").value) || 0;
    extraPayment =
      parseFloat(document.getElementById("extraPayment").value) || 0;
    if (extraPayment < 0) {
      showErrorMessage("Extra Monthly Payment must be a number ≥ 0.");
      return;
    }
  }

  // Validate inputs
  if (formType === "purchase") {
    // New purchase-specific validation (Priority 1 Task 1)
    const validation = validatePurchaseInputs({
      propertyValue,
      downPaymentAmount,
      downPaymentPercent: downPaymentPercentRaw,
      loanTerm,
      interestRate,
      pmiRate,
    });
    if (!validation.valid) {
      clearPurchaseFieldErrors();
      applyPurchaseValidationErrors(validation.errors);
      if (validation.errors.length) {
        // If multiple errors, optionally present a concise summary
        if (validation.errors.length > 2) {
          const summary = validation.errors.map((e) => e.message).join(" | ");
          showErrorMessage(summary);
        } else {
          showErrorMessage(validation.errors[0].message);
        }
      }
      return;
    }
    // Normalize possibly adjusted values (percent clamped / recalculated)
    propertyValue = validation.normalized.propertyValue;
    downPaymentAmount = validation.normalized.downPaymentAmount;
    loanAmount = validation.normalized.loanAmount;
    // Optionally surface warnings (non-blocking) — filter one-time TERM_LONG if already shown
    if (validation.warnings && validation.warnings.length) {
      const termLongIndex = validation.warnings.findIndex(
        (w) => w.code === "TERM_LONG"
      );
      const filteredWarnings = validation.warnings.filter(
        (w) => !(w.code === "TERM_LONG" && _longLoanTermWarned)
      );
      if (filteredWarnings.length) {
        showNotification(
          filteredWarnings.map((w) => w.message).join(" | "),
          "warning"
        );
      }
      if (termLongIndex !== -1 && !_longLoanTermWarned) {
        _longLoanTermWarned = true; // mark one-time delivery
      }
    }
    // Refresh LTV/PMI status using normalized values
    updatePurchaseLtvPmiStatus({ notify: true });

    // --- Task 16 Guardrails ---
    // 1. Soft confirm for very low property value (< $10,000) (one-time per distinct value)
    if (
      propertyValue > 0 &&
      propertyValue < 10000 &&
      !options.bypassLowPV &&
      propertyValue !== _lowPVLastConfirmedValue
    ) {
      showConfirmDialog(
        `Property Value is only $${propertyValue.toLocaleString()} — proceed?`,
        () => {
          _lowPVLastConfirmedValue = propertyValue; // remember to avoid re-prompt
          calculateMortgage(formType, { ...options, bypassLowPV: true });
        },
        () => {
          // User canceled; abort calculation
        }
      );
      return; // halt current execution path until user responds
    }

    // Pre-compute base monthly P&I (excluding PMI, escrow, HOA, extra)
    let baseMonthlyPIApprox = 0;
    if (loanAmount > 0 && loanTerm > 0) {
      const n = loanTerm * 12;
      const r = interestRate / 100 / 12;
      if (r === 0) {
        baseMonthlyPIApprox = loanAmount / n;
      } else {
        const pow = Math.pow(1 + r, n);
        baseMonthlyPIApprox = (loanAmount * r * pow) / (pow - 1);
      }
    }

    // 2. One-time long loan term warning (already surfaced via warnings if first time; ensure still one-time if validation skipped it somehow)
    if (loanTerm > 50 && !_longLoanTermWarned) {
      showNotification(
        "Loan Term is unusually long (>50 years); verify.",
        "warning"
      );
      _longLoanTermWarned = true;
    }

    // 3. Excess extra payment warning (extra > 5x base PI) — one-time per session
    if (
      baseMonthlyPIApprox > 0 &&
      extraPayment > baseMonthlyPIApprox * 5 &&
      !_excessExtraWarned
    ) {
      showNotification(
        `Extra payment ($${extraPayment.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}) exceeds 5× base P&I ($${baseMonthlyPIApprox.toFixed(
          2
        )}); verify intent.`,
        "warning"
      );
      _excessExtraWarned = true;
    }
  } else {
    if (
      !validateRefinanceInputs(
        propertyValue, // appraised value
        loanAmount,
        loanTerm,
        interestRate,
        propertyTax,
        homeInsurance,
        pmiAmountRefi
      )
    ) {
      return;
    }
  }

  // Calculate monthly interest rate
  // Determine PMI termination rule (LTV threshold) for builder (80/78)
  let pmiEndThresholdLtv = 80; // default selector value
  try {
    const selectorId =
      formType === "refinance" ? "refinancePmiEndRule" : "pmiEndRule";
    const sel = document.getElementById(selectorId);
    if (sel) pmiEndThresholdLtv = parseFloat(sel.value) || 80;
  } catch (_e) {
    pmiEndThresholdLtv = 80;
  }

  // Compute LTV base BEFORE building (refi may include financed costs)
  const ltvBase = formType === "refinance" ? adjustedLoanAmount : loanAmount;
  const loanToValueRatio =
    propertyValue > 0 ? (ltvBase / propertyValue) * 100 : 0;

  // Derive PMI inputs for unified builder
  let monthlyPMI; // purchase path computed rate-based PMI (legacy field for builder compatibility)
  let fixedMonthlyPMI; // refinance explicit monthly override (preferred for refi)
  if (formType === "refinance") {
    const pmiToggle = document.getElementById("refinancePmiToggle");
    const rawPmiAmount = pmiAmountRefi || 0; // user-entered monthly or annual
    const normalizedMonthly =
      pmiToggle && pmiToggle.checked ? rawPmiAmount / 12 : rawPmiAmount;
    fixedMonthlyPMI = normalizedMonthly; // feed as fixed override
    monthlyPMI = 0; // keep legacy field zero so effectivePMI derives from fixedMonthlyPMI
  } else {
    monthlyPMI =
      loanToValueRatio > pmiEndThresholdLtv
        ? (pmiRate / 100 / 12) * loanAmount
        : 0;
  }

  // Build unified schedule & totals via ScheduleBuilder (Task 19 integration)
  const builderInput = {
    amount: formType === "refinance" ? adjustedLoanAmount : loanAmount,
    rate: interestRate,
    term: loanTerm,
    pmi: monthlyPMI,
    fixedMonthlyPMI: fixedMonthlyPMI, // only meaningful for refinance
    propertyTax: propertyTax,
    homeInsurance: homeInsurance,
    hoa: hoa,
    extra: extraPayment,
    appraisedValue: propertyValue,
    pmiEndRule: pmiEndThresholdLtv,
  };
  let builderResult;
  try {
    if (
      typeof process !== "undefined" &&
      process.env.JEST_WORKER_ID !== undefined
    ) {
      console.log(
        "[RefiDOMTest] Invoking buildFixedLoanSchedule with",
        JSON.stringify(builderInput)
      );
    }
    builderResult = buildFixedLoanSchedule(builderInput);
    if (
      typeof process !== "undefined" &&
      process.env.JEST_WORKER_ID !== undefined
    ) {
      console.log(
        "[RefiDOMTest] buildFixedLoanSchedule returned keys:",
        Object.keys(builderResult || {})
      );
    }
  } catch (e) {
    if (
      typeof process !== "undefined" &&
      process.env.JEST_WORKER_ID !== undefined
    ) {
      console.log("[RefiDOMTest] buildFixedLoanSchedule threw", e);
    }
    throw e;
  }
  // Expose for test diagnostics (non-production usage). This allows DOM tests to
  // verify the engine executed even if tabData assignment is somehow skipped.
  try {
    window.__lastBuilderResult = builderResult;
  } catch (_) {}

  // Map builder results to legacy variables expected by UI
  const monthlyPI = builderResult.monthlyPI;
  const monthlyPropertyTax = builderResult.monthlyPropertyTax;
  const monthlyHomeInsurance = builderResult.monthlyInsurance;
  const totalInterest = builderResult.totalInterest;
  const totalCost = builderResult.totalCost;
  // builderResult.totalMonthlyPayment omits HOA & extra (HOA not part of builder abstraction). Add them for displayed total.
  let totalMonthlyPayment = builderResult.totalMonthlyPayment + extraPayment; // HOA already included by builder
  // For consistency with legacy path, include PMI in first payment only if it actually applies month 1 (ScheduleBuilder sets pmiMeta.pmiEndsMonth accordingly).
  // baseMonthlyPayment (without extra) analogous to prior calculation
  const baseMonthlyPayment =
    builderResult.baseMonthlyPaymentNoPMI +
    (builderResult.pmiMeta.pmiEndsMonth === 1
      ? 0
      : builderResult.monthlyPMIInput); // builder base already has HOA

  // --- Unified Display Schedule (Task 5 Purchase Path) ---
  // For purchase & refinance now derive the display amortization schedule directly from builderInput / builderResult
  // eliminating divergence with legacy generateAmortizationSchedule.
  let currentAmortizationData;
  if (formType === "purchase" || formType === "refinance") {
    const numberOfPayments = loanTerm * 12;
    const monthlyRate = interestRate / 100 / 12;
    const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
    let balance = builderInput.amount;
    let monthIdx = 0;
    const schedule = [];
    // Pre-calc static monthly PI (already computed as builderResult.monthlyPI but we keep a local for precision adjustments)
    const monthlyPIInternal = builderResult.monthlyPI;
    while (balance > 0.01 && monthIdx < numberOfPayments) {
      monthIdx++;
      // Date: mimic legacy by offsetting from today (first payment next month)
      const today = new Date();
      const paymentDate = new Date(
        today.getFullYear(),
        today.getMonth() + monthIdx,
        1
      );
      // Interest & principal (align rounding logic with ScheduleBuilder)
      let interestPortion = monthlyRate === 0 ? 0 : balance * monthlyRate;
      let principalPortion =
        monthlyRate === 0
          ? monthlyPIInternal
          : monthlyPIInternal - interestPortion;
      interestPortion = round2(interestPortion);
      principalPortion = round2(principalPortion);
      if (monthlyRate !== 0) {
        const roundedPI = round2(interestPortion + principalPortion);
        const scheduledPI = round2(monthlyPIInternal);
        const delta = scheduledPI - roundedPI;
        if (Math.abs(delta) >= 0.01) {
          principalPortion = round2(principalPortion + delta);
        }
      }
      // PMI: replicate builder rule using pmiMeta threshold data and original property value
      let pmiCharge = 0;
      if (
        builderResult.monthlyPMIInput > 0 &&
        builderResult.pmiMeta.pmiEndsMonth !== 1
      ) {
        // Determine if PMI applies this month: builderResult.pmiMeta.pmiEndsMonth is first PMI-FREE month (1-based) or 1 if never applied
        if (
          builderResult.pmiMeta.pmiEndsMonth === null ||
          monthIdx < builderResult.pmiMeta.pmiEndsMonth
        ) {
          pmiCharge = builderResult.monthlyPMIInput;
        }
      }
      // Extra principal
      let actualExtra = extraPayment || 0;
      // Cap principal+extra at remaining balance
      let principalReduction = principalPortion + actualExtra;
      if (principalReduction > balance) {
        // Adjust extra if overshoot
        actualExtra = Math.max(0, balance - principalPortion);
        principalReduction = principalPortion + actualExtra;
      }
      balance = round2(balance - principalReduction);
      if (balance < 0) balance = 0;
      const escrow = monthlyPropertyTax + monthlyHomeInsurance; // used only for total out-of-pocket; explicit columns keep tax/insurance separate historically
      const totalPayment = round2(
        principalPortion +
          interestPortion +
          pmiCharge +
          monthlyPropertyTax +
          monthlyHomeInsurance +
          hoa +
          actualExtra
      );
      schedule.push({
        paymentNumber: monthIdx,
        paymentDate,
        payment: totalPayment,
        principal: round2(principalPortion + actualExtra), // keep legacy meaning: principal includes extra (table splits it visually)
        interest: interestPortion,
        balance,
        propertyTax: monthlyPropertyTax,
        insurance: monthlyHomeInsurance,
        pmi: pmiCharge,
        hoa: hoa,
        extraPayment: round2(actualExtra),
      });
      if (balance <= 0) break;
    }
    currentAmortizationData = schedule;
    if (schedule.length > 0) {
      totalMonthlyPayment = schedule[0].payment; // align displayed figure with first row
    }
    if (currentAmortizationData && currentAmortizationData.length > 0) {
      totalMonthlyPayment = currentAmortizationData[0].payment;
    }
  }

  // Store data in the appropriate tab structure
  const tabData = formType === "purchase" ? purchaseData : refinanceData;
  tabData.amortizationData = currentAmortizationData;
  tabData.builderResult = builderResult; // persist unified engine output for exports / future UI
  tabData.calculationResults = [
    formType === "refinance" ? adjustedLoanAmount || loanAmount : loanAmount,
    monthlyPI,
    monthlyPropertyTax,
    monthlyHomeInsurance,
    monthlyPMI,
    hoa,
    totalMonthlyPayment,
    totalInterest,
    totalCost,
    loanToValueRatio,
    loanTerm,
    extraPayment,
    currentAmortizationData,
  ];
  // Store refi costs metadata for UI/exports
  if (formType === "refinance") {
    tabData.refinanceCosts = {
      closingCosts,
      pointsPercent,
      pointsAmount,
      financedCosts,
      financeCosts,
      dueAtClosing,
      baseLoanAmount: loanAmount,
      adjustedLoanAmount,
      cashOutAmount,
    };
  }
  tabData.isCalculated = true;

  // Set current tab
  currentTab = formType;

  // Update UI with results
  updateResultsUI(
    loanAmount,
    monthlyPI,
    monthlyPropertyTax,
    monthlyHomeInsurance,
    monthlyPMI,
    hoa,
    totalMonthlyPayment,
    totalInterest,
    totalCost,
    loanToValueRatio,
    loanTerm,
    extraPayment,
    currentAmortizationData,
    formType
  );

  // Show results sections with animation
  showResultsWithAnimation();

  // Update table
  updateAmortizationTable(formType);

  // Render charts
  renderCharts();

  // Save data to cache
  saveDataToCache();

  // Save calculation to history
  const formData = {};
  if (formType === "purchase") {
    formData.propertyValue = propertyValue;
    formData.downPaymentAmount = downPaymentAmount;
    formData.loanTerm = loanTerm;
    formData.interestRate = interestRate;
    formData.extraPayment = extraPayment;
  } else if (formType === "refinance") {
    formData.appraisedValue = propertyValue;
    formData.refinanceLoanAmount = loanAmount;
    formData.refinanceLoanTerm = loanTerm;
    formData.refinanceInterestRate = interestRate;
    formData.refinanceExtraPayment = extraPayment;
  }

  saveCalculationToHistory(formType, formData, tabData.calculationResults);
}

// ---------------------------------------------
// Purchase-Specific Structural Validation Helper
// (Priority 1 Task 1 implementation)
// ---------------------------------------------
// Allows 100% cash purchase (loanAmount = 0) without error.
// Provides blocking errors and non-blocking warnings in a single pass.
function validatePurchaseInputs(raw) {
  const errors = [];
  const warnings = [];
  let {
    propertyValue,
    downPaymentAmount,
    downPaymentPercent,
    loanTerm,
    interestRate,
    pmiRate,
  } = raw;

  // Normalize NaN to 0
  const nz = (v) => (isNaN(v) ? 0 : v);
  propertyValue = nz(propertyValue);
  downPaymentAmount = nz(downPaymentAmount);
  downPaymentPercent = nz(downPaymentPercent);
  loanTerm = nz(loanTerm);
  interestRate = nz(interestRate);
  pmiRate = nz(pmiRate);

  // Blocking validations
  if (propertyValue <= 0) {
    errors.push({
      code: "PV_ZERO",
      message: "Property Value must be greater than 0.",
    });
  }
  if (downPaymentAmount < 0) {
    errors.push({ code: "DP_NEG", message: "Down Payment must be ≥ 0." });
  }
  if (downPaymentAmount > propertyValue) {
    errors.push({
      code: "DP_EXCEEDS",
      message: "Down Payment cannot exceed Property Value.",
    });
  }
  if (loanTerm <= 0) {
    errors.push({
      code: "TERM_INVALID",
      message: "Loan Term (years) must be greater than 0.",
    });
  }
  if (interestRate < 0) {
    errors.push({
      code: "RATE_NEG",
      message: "Interest Rate cannot be negative.",
    });
  }

  // Percent bounds (only if propertyValue > 0 to avoid divide-by-zero recalcs)
  if (downPaymentPercent < 0 || downPaymentPercent >= 100) {
    errors.push({
      code: "DP_PERCENT_RANGE",
      message: "Down Payment % must be between 0 and 100.",
    });
  }

  // Derive loan amount & handle 100% cash purchase allowance
  let loanAmount = propertyValue - downPaymentAmount;
  if (loanAmount < 0) {
    // Already covered by DP_EXCEEDS but ensure non-negative for downstream
    loanAmount = 0;
  }

  const cashPurchase = loanAmount === 0 && errors.length === 0;

  // Normalize percent from amount if propertyValue > 0
  if (propertyValue > 0 && downPaymentAmount >= 0) {
    const computedPercent = (downPaymentAmount / propertyValue) * 100;
    // Always adopt computed percent (user’s amount takes precedence)
    downPaymentPercent =
      Math.round((computedPercent + Number.EPSILON) * 100) / 100; // 2 decimals
  }

  // Warnings (only when no blocking errors so they don't distract)
  if (!errors.length) {
    // Loan term unusually long
    if (loanTerm > 50) {
      warnings.push({
        code: "TERM_LONG",
        message: "Loan Term is unusually long (>50 years); verify.",
      });
    }
    // PMI capping & ignored logic
    if (pmiRate > 5) {
      warnings.push({
        code: "PMI_HIGH",
        message: "PMI Rate unusually high; capped at 5%.",
      });
      pmiRate = 5; // cap
    }
    if (propertyValue > 0) {
      const pmiRuleSel = document.getElementById("pmiEndRule");
      let threshold = 80;
      if (pmiRuleSel) {
        const v = parseFloat(pmiRuleSel.value);
        threshold = isNaN(v) ? 80 : v;
      }
      const origLtv =
        propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 0;
      if (pmiRate > 0 && (loanAmount === 0 || origLtv <= threshold)) {
        warnings.push({
          code: "PMI_IGNORED",
          message:
            "PMI Rate entered but no PMI will be charged (LTV at or below threshold).",
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    cashPurchase,
    errors,
    warnings,
    normalized: {
      propertyValue,
      downPaymentAmount,
      downPaymentPercent,
      loanAmount,
    },
  };
}

// ---------------------------------------------
// Purchase Inline Error UI Helpers (Priority 1 Task 2)
// ---------------------------------------------
const PURCHASE_FIELD_ID_MAP = {
  PV_ZERO: "propertyValue",
  DP_NEG: "downPaymentAmount",
  DP_EXCEEDS: "downPaymentAmount",
  DP_PERCENT_RANGE: "downPaymentPercent",
  TERM_INVALID: "loanTerm",
  RATE_NEG: "interestRate",
};

function mapPurchaseErrorToField(code) {
  return PURCHASE_FIELD_ID_MAP[code] || null;
}

function clearPurchaseFieldErrors() {
  const purchaseForm = document.getElementById("mortgageForm");
  if (!purchaseForm) return;
  const invalids = purchaseForm.querySelectorAll(".is-invalid");
  invalids.forEach((el) => el.classList.remove("is-invalid"));
  const feedbacks = purchaseForm.querySelectorAll(
    ".invalid-feedback[data-purchase-inline]"
  );
  feedbacks.forEach((fb) => fb.remove());
}

function applyPurchaseValidationErrors(errors) {
  errors.forEach((err) => {
    const fieldId = mapPurchaseErrorToField(err.code);
    if (!fieldId) return;
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.classList.add("is-invalid");
    // Avoid duplicating feedback if already present
    const existing = input.parentElement.querySelector(
      `.invalid-feedback[data-purchase-inline][data-for="${fieldId}"]`
    );
    if (existing) {
      existing.textContent = err.message;
      return;
    }
    const div = document.createElement("div");
    div.className = "invalid-feedback";
    div.dataset.purchaseInline = "true";
    div.dataset.for = fieldId;
    div.textContent = err.message;
    input.parentElement.appendChild(div);
  });
}

// One-time attachment of blur/input listeners to clear invalid state once corrected
function attachPurchaseValidationListenersOnce() {
  if (attachPurchaseValidationListenersOnce._attached) return;
  const ids = [
    "propertyValue",
    "downPaymentAmount",
    "downPaymentPercent",
    "loanTerm",
    "interestRate",
    "pmiRate",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      if (!el.classList.contains("is-invalid")) return;
      // Lightweight re-validation of just this field contextually:
      // For now, remove error styling; full validation runs on calculate.
      el.classList.remove("is-invalid");
      const fb = el.parentElement.querySelector(
        `.invalid-feedback[data-purchase-inline][data-for="${id}"]`
      );
      if (fb) fb.remove();
    });
  });
  attachPurchaseValidationListenersOnce._attached = true;
}

// Ensure listeners are attached after DOM ready (calculator might be invoked early)
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  attachPurchaseValidationListenersOnce();
} else {
  document.addEventListener("DOMContentLoaded", () => {
    attachPurchaseValidationListenersOnce();
  });
}

// ---------------------------------------------
// Origination LTV & PMI Status (Priority 1 Task 3)
// ---------------------------------------------
let _lastPmiState = null; // track transitions for optional notice
let _pmiCapNotified = false;
let _pmiIgnoredNotified = false;
// Task 16 session-scoped guardrail flags
let _lowPVLastConfirmedValue = null; // remembers last confirmed low property value
let _longLoanTermWarned = false; // one-time long term warning
let _excessExtraWarned = false; // one-time excess extra payment warning
function handleRealtimePmiAdvisories(state, context) {
  // state corresponds to pmi-* classification set in updatePurchaseLtvPmiStatus
  const pmiRateEl = document.getElementById("pmiRate");
  if (!pmiRateEl) return;
  let rate = parseFloat(pmiRateEl.value) || 0;
  if (rate > 5) {
    // Hard clamp & notify once per session
    pmiRateEl.value = "5";
    rate = 5;
    if (!_pmiCapNotified) {
      showNotification("PMI rate capped at 5%.", "info");
      _pmiCapNotified = true;
    }
  }
  // Ignored PMI (entered but not charged) state transitions
  if (state === "ignored" && rate > 0) {
    if (!_pmiIgnoredNotified) {
      showNotification(
        "PMI entered but not charged at current LTV (below threshold).",
        "info"
      );
      _pmiIgnoredNotified = true;
    }
  } else if (state === "active") {
    // Leaving ignored to active resets ability to notify again later
    _pmiIgnoredNotified = false;
  } else if (state === "none" || state === "possible" || state === "pending") {
    // Reset when not in ignored/active chain
    _pmiIgnoredNotified = false;
  }
}
function updatePurchaseLtvPmiStatus(options = {}) {
  const pvEl = document.getElementById("propertyValue");
  const dpAmtEl = document.getElementById("downPaymentAmount");
  const dpPctEl = document.getElementById("downPaymentPercent");
  const pmiRateEl = document.getElementById("pmiRate");
  const pmiRuleEl = document.getElementById("pmiEndRule");
  const badge = document.getElementById("purchaseLtvBadge");
  const status = document.getElementById("purchasePmiStatus");
  if (!pvEl || !dpAmtEl || !dpPctEl || !badge || !status) return;

  const propertyValue = parseFloat(pvEl.value) || 0;
  let downPaymentAmount = parseFloat(dpAmtEl.value) || 0;
  if (downPaymentAmount < 0) downPaymentAmount = 0;
  if (downPaymentAmount > propertyValue && propertyValue > 0) {
    downPaymentAmount = propertyValue; // clamp for display only
  }
  let loanAmount = propertyValue - downPaymentAmount;
  if (loanAmount < 0) loanAmount = 0;
  const pmiRate = parseFloat(pmiRateEl?.value) || 0;
  let threshold = 80;
  if (pmiRuleEl) {
    const v = parseFloat(pmiRuleEl.value);
    if (!isNaN(v)) threshold = v;
  }

  let ltv = 0;
  if (propertyValue > 0) {
    ltv = (loanAmount / propertyValue) * 100;
  }
  const ltvDisplay = propertyValue > 0 ? `LTV ${ltv.toFixed(2)}%` : "LTV --%";

  badge.classList.remove(
    "ltv-pending",
    "ltv-good",
    "ltv-borderline",
    "ltv-high",
    "ltv-cash",
    "bg-secondary",
    "bg-success",
    "bg-warning",
    "bg-danger",
    "bg-info"
  );
  if (propertyValue <= 0) {
    badge.textContent = ltvDisplay;
    badge.classList.add("ltv-pending", "bg-secondary");
  } else if (loanAmount === 0) {
    badge.textContent = "Cash Purchase";
    badge.classList.add("ltv-cash", "bg-info");
  } else if (ltv <= threshold) {
    badge.textContent = ltvDisplay;
    badge.classList.add("ltv-good", "bg-success");
  } else if (ltv <= threshold + 5) {
    badge.textContent = ltvDisplay;
    badge.classList.add("ltv-borderline", "bg-warning");
  } else {
    badge.textContent = ltvDisplay;
    badge.classList.add("ltv-high", "bg-danger");
  }

  status.className = status.className.replace(/\bpmi-[^\s]+/g, "").trim();
  let state = "none";
  let statusText = "No PMI";
  const meetsThreshold =
    propertyValue > 0 && loanAmount > 0 && ltv <= threshold;
  if (loanAmount === 0) {
    state = "none";
    statusText = "No Loan (Cash Purchase)";
  } else if (propertyValue <= 0) {
    state = "pending";
    statusText = "Awaiting Value";
  } else if (pmiRate > 0 && ltv > threshold) {
    state = "active";
    statusText = "PMI Active";
  } else if (pmiRate > 0 && ltv <= threshold) {
    state = "ignored";
    statusText = "PMI Entered (Not Charged)";
  } else if (pmiRate === 0 && ltv > threshold) {
    state = "possible";
    statusText = "PMI Possible (Rate Blank)";
  }
  status.classList.add(`pmi-${state}`);
  // Dynamic PMI messaging override when threshold satisfied with any down payment >= required
  if (meetsThreshold && pmiRate === 0) {
    // Purely qualifies without PMI rate entered
    statusText = "No PMI Required";
  }
  status.textContent = statusText;

  // Inline non-blocking warning (single instance) for ignored PMI (rate entered but not charged)
  if (state === "ignored" && pmiRate > 0) {
    let inline = document.getElementById("purchasePmiInlineWarning");
    if (!inline) {
      inline = document.createElement("div");
      inline.id = "purchasePmiInlineWarning";
      inline.className = "small text-warning mt-1";
      inline.style.fontSize = "0.7rem";
      status.parentElement?.appendChild(inline);
    }
    inline.textContent =
      "PMI rate entered but not charged (LTV below threshold).";
  } else {
    const inline = document.getElementById("purchasePmiInlineWarning");
    if (inline) inline.remove();
  }

  if (options.notify && _lastPmiState && _lastPmiState !== state) {
    if (
      (state === "active" && _lastPmiState !== "active") ||
      (state !== "active" && _lastPmiState === "active")
    ) {
      showNotification(`PMI status changed: ${statusText}`, "info");
    }
  }
  // Always run realtime advisory after status classification
  handleRealtimePmiAdvisories(state);
  _lastPmiState = state;
}

function attachPurchaseLtvPmiListeners() {
  if (attachPurchaseLtvPmiListeners._attached) return;
  [
    "propertyValue",
    "downPaymentAmount",
    "downPaymentPercent",
    "pmiRate",
    "pmiEndRule",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => updatePurchaseLtvPmiStatus());
    el.addEventListener("blur", () => updatePurchaseLtvPmiStatus());
  });
  attachPurchaseLtvPmiListeners._attached = true;
  updatePurchaseLtvPmiStatus();
}

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  attachPurchaseLtvPmiListeners();
} else {
  document.addEventListener("DOMContentLoaded", () =>
    attachPurchaseLtvPmiListeners()
  );
}

// Calculate HELOC based on input values
function calculateHELOC() {
  // Get values from HELOC form
  const propertyValue = parseFloat(
    document.getElementById("helocPropertyValue").value
  );
  const outstandingBalance = parseFloat(
    document.getElementById("helocOutstandingBalance").value
  );
  const helocAmount = parseFloat(
    document.getElementById("helocLoanAmount").value
  );
  const interestRate = parseFloat(
    document.getElementById("helocInterestRate").value
  );
  const interestOnlyPeriod = parseInt(
    document.getElementById("helocInterestOnlyPeriod").value
  );
  const repaymentPeriod = parseInt(
    document.getElementById("helocRepaymentPeriod").value
  );

  // Validate HELOC inputs
  if (isNaN(propertyValue) || propertyValue <= 0) {
    showErrorMessage("Please enter a valid property value");
    return;
  }

  if (isNaN(helocAmount) || helocAmount <= 0) {
    showErrorMessage("Please enter a valid HELOC loan amount");
    return;
  }

  if (isNaN(interestRate) || interestRate <= 0) {
    showErrorMessage("Please enter a valid interest rate");
    return;
  }

  if (isNaN(interestOnlyPeriod) || interestOnlyPeriod <= 0) {
    showErrorMessage("Please enter a valid interest-only period");
    return;
  }

  if (isNaN(repaymentPeriod) || repaymentPeriod <= interestOnlyPeriod) {
    showErrorMessage(
      "Repayment period must be greater than interest-only period"
    );
    return;
  }

  // Calculate available equity and LTV
  const totalDebt = outstandingBalance + helocAmount;
  const ltv = (totalDebt / propertyValue) * 100;

  // Calculate monthly interest rate
  const monthlyRate = interestRate / 100 / 12;

  // Calculate interest-only payment
  const interestOnlyPayment = helocAmount * monthlyRate;

  // Calculate principal and interest payment for repayment period
  const repaymentMonths = (repaymentPeriod - interestOnlyPeriod) * 12;
  let principalInterestPayment = 0;

  if (repaymentMonths > 0 && monthlyRate > 0) {
    principalInterestPayment =
      (helocAmount *
        (monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths))) /
      (Math.pow(1 + monthlyRate, repaymentMonths) - 1);
  }

  // Generate HELOC amortization schedule
  const helocAmortization = generateHelocAmortizationSchedule(
    helocAmount,
    interestRate,
    interestOnlyPeriod,
    repaymentPeriod
  );

  // Calculate total interest paid
  const totalInterest = helocAmortization.reduce(
    (sum, payment) => sum + payment.interestPayment,
    0
  );

  // Store results
  helocData.amortizationData = helocAmortization;
  helocData.calculationResults = [
    interestOnlyPayment,
    principalInterestPayment,
    helocAmount,
    totalInterest,
    propertyValue,
    outstandingBalance,
    ltv,
    "heloc",
  ];
  helocData.isCalculated = true;

  // Update UI with HELOC results
  updateHelocResultsUI(
    interestOnlyPayment,
    principalInterestPayment,
    helocAmount,
    totalInterest,
    propertyValue,
    outstandingBalance,
    ltv
  );

  // Show results section
  document.getElementById("resultsSummary").style.display = "block";
  document.getElementById("tabsSection").style.display = "block";

  // Update amortization table
  updateAmortizationTable("heloc");

  // Render charts
  renderCharts();

  // Save data to cache
  saveDataToCache();

  // Save calculation to history
  const formData = {
    helocPropertyValue: propertyValue,
    helocOutstandingBalance: outstandingBalance,
    helocAmount: helocAmount,
    helocInterestRate: interestRate,
    helocInterestOnlyPeriod: interestOnlyPeriod,
    helocRepaymentPeriod: repaymentPeriod,
  };

  saveCalculationToHistory("heloc", formData, helocData.calculationResults);
}

// Loan Comparison Functions
function calculateLoanComparison() {
  // Normalize & validate inputs before pulling numeric values
  const invalidFields = validateComparisonInputs();
  if (invalidFields.length > 0) {
    showErrorMessage(
      `Please correct highlighted field${
        invalidFields.length > 1 ? "s" : ""
      } before comparing.`
    );
    return;
  }
  // Get loan data for visible options only
  const loanA = getLoanData("A");
  const loanB = getLoanData("B");

  // Check if Option B (Loan C) is visible
  const loanCColumn = document.getElementById("loanC_column");
  const isLoanCVisible =
    loanCColumn && !loanCColumn.classList.contains("d-none");
  const loanC = isLoanCVisible ? getLoanData("C") : { isValid: false };

  // Validate that at least two loans have data
  const validLoans = [loanA, loanB, loanC].filter((loan) => loan.isValid);

  if (validLoans.length < 2) {
    const minRequired = isLoanCVisible ? "at least 2" : "both visible";
    showErrorMessage(
      `Please enter valid data for ${minRequired} loan options to compare.`
    );
    return;
  }

  // Calculate mortgage details for each loan
  const calculations = {
    A: loanA.isValid ? calculateSingleLoan(loanA) : null,
    B: loanB.isValid ? calculateSingleLoan(loanB) : null,
    C: loanC.isValid ? calculateSingleLoan(loanC) : null,
  };

  // Store results
  comparisonData.loanA = calculations.A;
  comparisonData.loanB = calculations.B;
  comparisonData.loanC = calculations.C;
  comparisonData.isCalculated = true;

  // Determine best option
  const bestOption = determineBestLoan(calculations, validLoans);
  comparisonData.bestOption = bestOption;

  // Calculate savings
  const savings = calculateSavings(calculations, bestOption);
  comparisonData.savings = savings;

  // Update UI
  updateComparisonResults(calculations, bestOption, savings);

  // Show results with animation
  showComparisonResultsWithAnimation();

  // Save to cache
  saveDataToCache();

  showSuccessMessage("Loan comparison completed successfully!");
}

function getLoanData(loanLetter) {
  const prefix = `loan${loanLetter}_`;
  const name =
    document.getElementById(prefix + "name").value || `Option ${loanLetter}`;
  const appraisedValue =
    parseFloat(document.getElementById(prefix + "appraisedValue").value) || 0;
  const amount =
    parseFloat(document.getElementById(prefix + "amount").value) || 0;
  const rate = parseFloat(document.getElementById(prefix + "rate").value) || 0;
  const term = parseInt(document.getElementById(prefix + "term").value) || 30;

  // Handle PMI with toggle
  const pmiToggle = document.getElementById(prefix + "pmiToggle");
  const pmiValue =
    parseFloat(document.getElementById(prefix + "pmi").value) || 0;
  const pmi = pmiToggle && pmiToggle.checked ? pmiValue / 12 : pmiValue; // Convert annual to monthly if toggled

  const propertyTax =
    parseFloat(document.getElementById(prefix + "propertyTax").value) || 0;
  const homeInsurance =
    parseFloat(document.getElementById(prefix + "homeInsurance").value) || 0;
  const extra =
    parseFloat(document.getElementById(prefix + "extra").value) || 0;
  // PMI termination rule (80 or 78) default 80
  let pmiEndRule = 80;
  const pmiRuleEl = document.getElementById(prefix + "pmiEndRule");
  if (pmiRuleEl && pmiRuleEl.value && !isNaN(parseFloat(pmiRuleEl.value))) {
    pmiEndRule = parseFloat(pmiRuleEl.value);
  }

  // Allow 0% interest loans (Task: zero‑interest safeguard). Previously required rate > 0 which rejected valid promo / special loans.
  // Blank / non-numeric inputs already coerce to 0 above; if we ever need to distinguish intentional 0 vs empty, we can inspect the raw input value.
  const isValid = amount > 0 && rate >= 0 && term > 0;

  return {
    name,
    appraisedValue,
    amount,
    rate,
    term,
    pmi,
    propertyTax,
    homeInsurance,
    extra,
    fees: 0, // Default to 0 since comparison form doesn't have fees input
    isValid,
    letter: loanLetter,
    pmiEndRule,
  };
}

// Comparison Input Validation (Priority 1 Task 5)
// Ensures numeric, non-negative; highlights invalid fields; returns array of invalid element IDs
function validateComparisonInputs() {
  const loanLetters = ["A", "B", "C"]; // C may be hidden; we'll skip hidden container
  const numericFields = [
    "appraisedValue",
    "amount",
    "rate",
    "term",
    "pmi",
    "propertyTax",
    "homeInsurance",
    "extra",
  ];
  const invalid = [];

  loanLetters.forEach((letter) => {
    const column = document.getElementById(`loan${letter}_column`);
    if (!column || column.classList.contains("d-none")) return; // skip hidden loan C
    numericFields.forEach((field) => {
      const el = document.getElementById(`loan${letter}_${field}`);
      if (!el) return;
      // Remove previous state
      el.classList.remove("is-invalid");
      let raw = el.value.trim();
      if (raw === "") {
        // Empty required for core fields amount/rate/term should mark invalid
        if (["amount", "rate", "term"].includes(field)) {
          invalid.push(el.id);
          el.classList.add("is-invalid");
        }
        return;
      }
      // Normalize commas
      raw = raw.replace(/,/g, "");
      const val = parseFloat(raw);
      const isNaNVal = isNaN(val);
      const negative = val < 0;
      // Basic domain checks
      let outOfRange = false;
      if (field === "rate" && val > 40) outOfRange = true; // unrealistic rate safeguard
      if (field === "term" && (val <= 0 || val > 50)) outOfRange = true; // term bounds

      if (isNaNVal || negative || outOfRange) {
        invalid.push(el.id);
        el.classList.add("is-invalid");
      } else {
        // Optionally format back for core numeric integer fields (term)
        if (field === "term") {
          el.value = parseInt(val, 10);
        }
      }
    });
  });

  // Provide inline feedback elements if not present
  invalid.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      let feedback = el.parentElement.querySelector(
        ".invalid-feedback.validation-inline"
      );
      if (!feedback) {
        feedback = document.createElement("div");
        feedback.className = "invalid-feedback validation-inline";
        feedback.textContent = "Enter a valid non-negative value.";
        el.parentElement.appendChild(feedback);
      }
    }
  });

  return invalid;
}

const {
  buildFixedLoanSchedule,
} = require("./modules/calculators/ScheduleBuilder");
// Scoring abstraction (Task 20)
const {
  determineBestLoan: scoreBestLoan,
  EvaluationModes,
} = require("./modules/calculators/ScoringEngine");

function calculateSingleLoan(loanData) {
  // Delegate to shared schedule builder abstraction (Task 19)
  return buildFixedLoanSchedule(loanData);
}

// Lightweight amortization schedule builder (Task 14)
// Returns a condensed schedule: first 12 months, then annual snapshots (24,36,...) and final payoff month if not already included.
// Columns: month, paymentPIExtra, interest, principal, pmi, balance, cumInterest. Extra payment included in principal column.
function buildLightweightSchedule(calc) {
  if (!calc) return [];
  const amount = calc.amount;
  const termMonths = calc.term * 12;
  const rate = calc.rate / 100 / 12;
  const extra = calc.extra || 0;
  const pmiMonthly = calc.monthlyPMIInput || 0; // raw input
  const thresholdLTV = calc.calculations?.pmiThresholdLTV;
  const appraisedValue = calc.appraisedValue || 0;
  let balance = amount;
  const monthlyPI = calc.monthlyPI;
  const rows = [];
  let cumInterest = 0;
  let pmiActive =
    pmiMonthly > 0 &&
    appraisedValue > 0 &&
    amount / appraisedValue > thresholdLTV;
  let pmiEndedAlready = false;
  for (let m = 1; m <= termMonths && balance > 0.01; m++) {
    const interest = rate === 0 ? 0 : balance * rate;
    let principal = rate === 0 ? monthlyPI : monthlyPI - interest;
    let pmiCharge = 0;
    if (pmiActive) {
      const currentLTV = balance / appraisedValue;
      if (currentLTV > thresholdLTV) {
        pmiCharge = pmiMonthly;
      } else {
        pmiActive = false;
        pmiEndedAlready = true; // PMI ceases starting this month
      }
    }
    let principalReduction = principal + extra;
    if (principalReduction > balance) {
      principalReduction = balance;
    }
    cumInterest += interest;
    balance -= principalReduction;
    const paymentPIExtra = principal + interest + extra; // exclude PMI for clarity; PMI shown separately
    const include = m <= 12 || m % 12 === 0 || balance <= 0.01; // first year monthly + annual snapshots + final
    if (include) {
      rows.push({
        month: m,
        payment: paymentPIExtra,
        interest: interest,
        principal: principalReduction,
        pmi: pmiCharge,
        balance: Math.max(0, balance),
        cumInterest: cumInterest,
        pmiEnds: pmiEndedAlready && pmiCharge === 0 && !pmiActive, // marker when first month without PMI after being active
      });
    }
    if (balance <= 0.01) break;
  }
  // Ensure last row (payoff) included even if not captured by condition
  const last = rows[rows.length - 1];
  if (!last || last.balance > 0.01) {
    rows.push({
      month: calc.payoffTime?.totalMonths || rows.length,
      payment: 0,
      interest: 0,
      principal: 0,
      pmi: 0,
      balance: 0,
      cumInterest: cumInterest,
      pmiEnds: false,
    });
  }
  return rows;
}

function determineBestLoan(calculations) {
  const validCalculations = Object.values(calculations).filter(Boolean);
  if (!validCalculations.length) return null;
  // Evaluation mode selection (persisted in localStorage by existing listener)
  let mode = EvaluationModes.TOTAL_OUT_OF_POCKET;
  const selected = document.querySelector(
    'input[name="evaluationMode"]:checked'
  );
  if (
    selected &&
    selected.value &&
    Object.values(EvaluationModes).includes(selected.value)
  ) {
    mode = selected.value;
  }
  const best = scoreBestLoan(validCalculations, mode);
  return best;
}

// Event listener to re-evaluate best loan when evaluation mode changes (without forcing user to re-enter inputs)
document.addEventListener("DOMContentLoaded", () => {
  const modeInputs = document.querySelectorAll('input[name="evaluationMode"]');
  // Restore persisted selection
  try {
    const storedMode = localStorage.getItem("mp_eval_mode");
    if (storedMode) {
      const toCheck = document.querySelector(
        `input[name="evaluationMode"][value="${storedMode}"]`
      );
      if (toCheck) toCheck.checked = true;
    }
  } catch (e) {
    console.warn("Eval mode restore failed", e);
  }
  modeInputs.forEach((inp) => {
    inp.addEventListener("change", () => {
      // Persist selection
      try {
        localStorage.setItem("mp_eval_mode", inp.value);
      } catch (_) {}
      if (comparisonData && comparisonData.calculations) {
        const bestOption = determineBestLoan(comparisonData.calculations);
        comparisonData.bestOption = bestOption;
        const savings = calculateSavings(
          comparisonData.calculations,
          bestOption
        );
        updateComparisonResults(
          comparisonData.calculations,
          bestOption,
          savings
        );
      }
    });
  });
});

function calculateSavings(calculations, bestOption) {
  if (!bestOption) return null;

  const validCalculations = Object.values(calculations).filter(
    (calc) => calc !== null
  );

  // Find second best option for comparison
  let secondBest = null;
  for (const loan of validCalculations) {
    if (loan.letter !== bestOption.letter) {
      if (!secondBest || loan.totalCost < secondBest.totalCost) {
        secondBest = loan;
      }
    }
  }

  if (!secondBest) return null;

  const bestOut = bestOption.totals?.totalOutOfPocket ?? Infinity;
  const secondOut = secondBest.totals?.totalOutOfPocket ?? Infinity;

  // --- Blended monthly payment savings (Priority 2 Task 8) ---
  // Rationale:
  // The previous implementation compared only the initial monthly payment (which could include PMI)
  // leading to distorted "monthly savings" when one loan's PMI drops earlier. We now compute an
  // average monthly out-of-pocket (principal+interest+escrows incl. PMI while it applies) over the
  // life of each loan's payoff horizon (shorter horizon if earlier payoff). For a loan object we have:
  //   totalOutOfPocket = principal + interest + totalPMI + tax + insurance
  //   pmiPaid          = totals.pmiPaid (sum of PMI actually charged)
  //   We also have initial payment (may include PMI) and baseMonthlyPaymentNoPMI.
  // We approximate a blended average instead of recreating the full schedule here by weighting:
  //   blended = ( (initialMonthlyPayment * monthsWithPMI) + (baseMonthlyPaymentNoPMI * (payoffMonths - monthsWithPMI)) ) / payoffMonths
  // To retrieve monthsWithPMI we infer it from pmiPaid / monthlyPMI (if monthlyPMI>0). monthlyPMI is derived
  // from the first-month delta between totalMonthlyPayment and baseMonthlyPaymentNoPMI (less taxes/insurance already included).
  function computeBlendedAverage(loan) {
    const payoffMonths =
      loan.payoff?.totalMonths || loan.scheduleMeta?.payoffMonth || 0;
    if (!payoffMonths) return loan.totalMonthlyPayment || 0; // fallback
    const monthlyPMI = (() => {
      const delta =
        (loan.totalMonthlyPayment || 0) - (loan.baseMonthlyPaymentNoPMI || 0);
      return delta > 0 ? delta : 0;
    })();
    const totalPmiPaid = loan.totals?.pmiPaid || 0;
    let monthsWithPMI = 0;
    if (monthlyPMI > 0) {
      monthsWithPMI = Math.round(totalPmiPaid / monthlyPMI);
      // Guard: don't exceed payoff horizon
      monthsWithPMI = Math.min(monthsWithPMI, payoffMonths);
    }
    const baseNoPMI =
      loan.baseMonthlyPaymentNoPMI || loan.totalMonthlyPayment || 0;
    const initialWithPMI = loan.totalMonthlyPayment || baseNoPMI;
    const monthsWithout = Math.max(0, payoffMonths - monthsWithPMI);
    const blended =
      (initialWithPMI * monthsWithPMI + baseNoPMI * monthsWithout) /
      (payoffMonths || 1);
    return blended;
  }

  const bestBlended = computeBlendedAverage(bestOption);
  const secondBlended = computeBlendedAverage(secondBest);

  return {
    // Positive value means second best costs more per month on a blended basis
    monthlyPaymentSavings: secondBlended - bestBlended,
    totalInterestSavings: secondBest.totalInterest - bestOption.totalInterest,
    totalCostSavings: secondBest.totalCost - bestOption.totalCost, // legacy PI delta
    totalOutOfPocketSavings: secondOut - bestOut,
    comparedTo: secondBest.name,
    blendedMonthlyBest: bestBlended,
    blendedMonthlySecond: secondBlended,
  };
}

function updateComparisonResults(calculations, bestOption, savings) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // --- Task 18: Build contextual warnings (PMI persistence, missing appraisal, ambiguous PMI) ---
  const buildComparisonWarnings = () => {
    const warnings = [];
    ["A", "B", "C"].forEach((letter) => {
      const calc = calculations[letter];
      if (!calc) return;
      const name = calc.name || `Option ${letter}`;
      const pmiEnds = calc.pmiMeta?.pmiEndsMonth; // null => Never, 1 => No PMI, >1 => drops after
      const startingLTV = calc.calculations?.startingLTV;
      const hasAppraised = typeof startingLTV === "number" && startingLTV > 0;
      const monthlyPMIInput = calc.pmiMeta?.pmiMonthlyInput || 0;
      // 1. PMI persists full term
      if (monthlyPMIInput > 0 && pmiEnds == null) {
        warnings.push(
          `${name}: PMI never drops (consider larger down payment or new appraisal).`
        );
      }
      // 2. Appraised value missing while PMI provided
      if (monthlyPMIInput > 0 && !hasAppraised) {
        warnings.push(
          `${name}: Appraised value missing — cannot evaluate PMI termination; treated as persistent.`
        );
      }
      // 3. PMI entered but starting LTV already below threshold (pmiEndsMonth === 1)
      if (monthlyPMIInput > 0 && pmiEnds === 1) {
        warnings.push(
          `${name}: PMI provided but starting LTV below threshold; charge ignored.`
        );
      }
      // 4. Extra payment present but zero interest saved (could be due to rounding or payoff already minimal)
      if (
        calc.extraPayment > 0 &&
        calc.extraDeltas &&
        calc.extraDeltas.interestSaved <= 0
      ) {
        warnings.push(
          `${name}: Extra payment yields no measurable interest savings (likely too small or loan nearly paid off).`
        );
      }
    });
    return warnings;
  };

  // Update headers
  ["A", "B", "C"].forEach((letter) => {
    const calc = calculations[letter];
    const header = document.getElementById(`loan${letter}_header`);
    if (header) {
      if (calc) {
        header.textContent = calc.name;
        header.className = "text-center";
        if (bestOption && calc.letter === bestOption.letter) {
          const reason = "Lowest total out-of-pocket";
          header.innerHTML = `${calc.name} <span class="badge bg-success ms-1" title="${reason}">🏆 Best</span>`;
        }
      } else {
        header.textContent = `Option ${letter}`;
        header.className = "text-center text-muted";
      }
    }
  });

  // Update comparison table
  ["A", "B", "C"].forEach((letter) => {
    const calc = calculations[letter];
    const monthly = document.getElementById(`comp${letter}_monthly`);
    const interest = document.getElementById(`comp${letter}_interest`);
    const totalPI = document.getElementById(`comp${letter}_totalPI`);
    const payoff = document.getElementById(`comp${letter}_payoff`);
    // New escrow/out-of-pocket fields
    const pmiCell = document.getElementById(`comp${letter}_pmi`);
    const taxCell = document.getElementById(`comp${letter}_tax`);
    const insCell = document.getElementById(`comp${letter}_insurance`);
    const outCell = document.getElementById(`comp${letter}_out`);
    const pmiEndsCell = document.getElementById(`comp${letter}_pmiEnds`);
    const extraInterestCell = document.getElementById(
      `comp${letter}_extraInterestSaved`
    );
    const extraMonthsCell = document.getElementById(
      `comp${letter}_extraMonthsSaved`
    );

    if (calc) {
      const isBest = bestOption && calc.letter === bestOption.letter;
      const cellClass = isBest
        ? "text-center fw-bold text-success"
        : "text-center";
      // Build breakdown tooltip for initial month (includes PMI only if charged initially)
      const breakdownParts = [];
      // Principal + Interest
      if (typeof calc.monthlyPI === "number") {
        breakdownParts.push(
          `Principal & Interest: ${formatCurrency(calc.monthlyPI)}`
        );
      }
      // PMI if initial month charged (pmiEndsMonth !== 1 and pmiMonthlyInput > 0 and starting LTV above threshold)
      const initialPMIActive =
        calc.pmiMeta &&
        calc.pmiMeta.pmiEndsMonth !== 1 &&
        typeof calc.pmiMeta.pmiMonthlyInput === "number" &&
        calc.pmiMeta.pmiMonthlyInput > 0 &&
        (calc.pmiMeta.pmiEndsMonth === null || calc.pmiMeta.pmiEndsMonth > 1);
      if (initialPMIActive) {
        breakdownParts.push(
          `PMI (initial): ${formatCurrency(calc.pmiMeta.pmiMonthlyInput)}`
        );
      }
      if (
        typeof calc.monthlyPropertyTax === "number" &&
        calc.monthlyPropertyTax > 0
      ) {
        breakdownParts.push(
          `Property Tax: ${formatCurrency(calc.monthlyPropertyTax)}`
        );
      }
      if (
        typeof calc.monthlyInsurance === "number" &&
        calc.monthlyInsurance > 0
      ) {
        breakdownParts.push(
          `Insurance: ${formatCurrency(calc.monthlyInsurance)}`
        );
      }
      if (typeof calc.extraPayment === "number" && calc.extraPayment > 0) {
        breakdownParts.push(
          `Extra Principal: ${formatCurrency(calc.extraPayment)}`
        );
      }
      const breakdownTooltip =
        breakdownParts.join(" | ") || "Monthly payment components unavailable";
      monthly.innerHTML = `<span class="${cellClass}" data-bs-toggle="tooltip" data-bs-placement="top" title="${breakdownTooltip.replace(
        /"/g,
        "&quot;"
      )}">${formatCurrency(calc.totalMonthlyPayment)}</span>`;
      interest.innerHTML = `<span class="${cellClass}">${formatCurrency(
        calc.totalInterest
      )}</span>`;
      if (totalPI) {
        totalPI.innerHTML = `<span class="${cellClass}">${formatCurrency(
          calc.totals?.totalCostPI || calc.totalCost
        )}</span>`;
      }
      payoff.innerHTML = `<span class="${cellClass}">${calc.payoffTime.years}y ${calc.payoffTime.months}m</span>`;
      if (pmiCell && taxCell && insCell && outCell) {
        pmiCell.innerHTML = `<span class="${cellClass}">${formatCurrency(
          calc.totals?.pmiPaid || 0
        )}</span>`;
        taxCell.innerHTML = `<span class="${cellClass}">${formatCurrency(
          calc.totals?.taxPaid || 0
        )}</span>`;
        insCell.innerHTML = `<span class="${cellClass}">${formatCurrency(
          calc.totals?.insurancePaid || 0
        )}</span>`;
        outCell.innerHTML = `<span class="${cellClass}">${formatCurrency(
          calc.totals?.totalOutOfPocket || 0
        )}</span>`;
      }
      // PMI Ends formatting: null => Never (ran full term), 1 => No PMI, else show Month X plus (Yy Mm)
      if (pmiEndsCell) {
        let display = "-";
        const endMonth = calc.pmiEndsMonth; // 1-based first month WITHOUT PMI
        if (endMonth === 1) {
          display = "No PMI"; // Started below threshold
        } else if (endMonth == null) {
          display = "Never"; // Paid entire term
        } else if (typeof endMonth === "number" && endMonth > 1) {
          const lastWithPMIMonth = endMonth - 1; // inclusive month index PMI last applied
          const y = Math.floor(lastWithPMIMonth / 12);
          const m = lastWithPMIMonth % 12;
          const duration = `${y > 0 ? y + "y " : ""}${m}m`;
          display = `Drops after: ${duration} (Month ${endMonth})`;
        }
        pmiEndsCell.innerHTML = `<span class=\"${cellClass}\">${display}</span>`;
      }

      // Extra payment metrics
      if (extraInterestCell && extraMonthsCell) {
        if (
          calc.extraDeltas &&
          typeof calc.extraDeltas.interestSaved === "number"
        ) {
          const interestSaved = calc.extraDeltas.interestSaved;
          extraInterestCell.innerHTML = `<span class=\"${cellClass}\">${formatCurrency(
            interestSaved
          )}</span>`;
          const monthsSaved = calc.extraDeltas.monthsSaved;
          if (monthsSaved && monthsSaved > 0) {
            const y = Math.floor(monthsSaved / 12);
            const m = monthsSaved % 12;
            const duration = `${y > 0 ? y + "y " : ""}${m}m`;
            extraMonthsCell.innerHTML = `<span class=\"${cellClass}\">${duration}</span>`;
          } else {
            extraMonthsCell.innerHTML = `<span class=\"${cellClass}\">0m</span>`;
          }
        } else {
          extraInterestCell.innerHTML = '<span class="text-muted">—</span>';
          extraMonthsCell.innerHTML = '<span class="text-muted">—</span>';
        }
      }
    } else {
      monthly.innerHTML = '<span class="text-muted">-</span>';
      interest.innerHTML = '<span class="text-muted">-</span>';
      if (totalPI) totalPI.innerHTML = '<span class="text-muted">-</span>';
      payoff.innerHTML = '<span class="text-muted">-</span>';
      if (pmiCell) pmiCell.innerHTML = '<span class="text-muted">-</span>';
      if (taxCell) taxCell.innerHTML = '<span class="text-muted">-</span>';
      if (insCell) insCell.innerHTML = '<span class="text-muted">-</span>';
      if (outCell) outCell.innerHTML = '<span class="text-muted">-</span>';
      const pmiEndsCell = document.getElementById(`comp${letter}_pmiEnds`);
      if (pmiEndsCell)
        pmiEndsCell.innerHTML = '<span class="text-muted">-</span>';
      const extraInterestCell = document.getElementById(
        `comp${letter}_extraInterestSaved`
      );
      const extraMonthsCell = document.getElementById(
        `comp${letter}_extraMonthsSaved`
      );
      if (extraInterestCell)
        extraInterestCell.innerHTML = '<span class="text-muted">-</span>';
      if (extraMonthsCell)
        extraMonthsCell.innerHTML = '<span class="text-muted">-</span>';
    }
  });

  // Re-initialize tooltips within comparison results (Task 16)
  try {
    if (window.bootstrap && typeof window.bootstrap.Tooltip === "function") {
      const comparisonScope = document.getElementById("comparisonResults");
      if (comparisonScope) {
        const tooltipTriggerList = [].slice.call(
          comparisonScope.querySelectorAll('[data-bs-toggle="tooltip"]')
        );
        tooltipTriggerList.forEach((el) => {
          // Dispose existing instance if any to avoid duplicates
          if (el._tooltipInstance) {
            try {
              el._tooltipInstance.dispose();
            } catch (e) {}
          }
          try {
            const instance = new window.bootstrap.Tooltip(el);
            el._tooltipInstance = instance;
          } catch (e) {
            // silent
          }
        });
      }
    }
  } catch (e) {
    // fail silently; tooltip enhancement is non-critical
  }

  // Update winner banner
  const winnerBanner = document.getElementById("comparisonWinner");
  const winnerName = document.getElementById("winnerName");
  const winnerReason = document.getElementById("winnerReason");

  if (bestOption && winnerBanner && winnerName && winnerReason) {
    winnerName.textContent = bestOption.name;

    // Determine evaluation basis (future-proof for mode selector)
    const scoreBasis = bestOption.evaluation?.scoreBasis || "totalOutOfPocket";
    const totalOut = bestOption.totals?.totalOutOfPocket;
    const totalPI = bestOption.totals?.totalCostPI || bestOption.totalCost;
    const payoffMonths =
      bestOption.payoffTime?.years !== undefined
        ? `${bestOption.payoffTime.years}y ${bestOption.payoffTime.months}m`
        : "";

    let reasonLabel = "";
    let valuePart = "";
    switch (scoreBasis) {
      case "principalInterest":
        reasonLabel = "Lowest principal + interest";
        valuePart = formatCurrency(totalPI);
        break;
      case "payoffSpeed":
        reasonLabel = "Fastest payoff";
        valuePart = payoffMonths;
        break;
      case "totalOutOfPocket":
      default:
        reasonLabel = "Lowest total out-of-pocket";
        valuePart = formatCurrency(totalOut ?? totalPI);
        break;
    }

    // Always append monthly payment info (uses initial monthly including any PMI)
    const monthlyPart = `Monthly payment: ${formatCurrency(
      bestOption.totalMonthlyPayment
    )}`;
    winnerReason.textContent = `${reasonLabel}: ${valuePart} | ${monthlyPart}`;
    winnerBanner.style.display = "block";
  }

  // Update savings analysis
  const monthlySavings = document.getElementById("monthlySavings");
  const lifetimeSavings = document.getElementById("lifetimeSavings");

  if (savings && monthlySavings && lifetimeSavings) {
    monthlySavings.textContent = formatCurrency(
      Math.abs(savings.monthlyPaymentSavings)
    );
    lifetimeSavings.textContent = formatCurrency(
      Math.abs(savings.totalInterestSavings)
    );
  } else {
    if (monthlySavings) monthlySavings.textContent = "$0";
    if (lifetimeSavings) lifetimeSavings.textContent = "$0";
  }

  // Inject warnings UI
  const warningsContainer = document.getElementById("comparisonWarnings");
  const warningsList = document.getElementById("comparisonWarningsList");
  if (warningsContainer && warningsList) {
    const warnings = buildComparisonWarnings();
    if (warnings.length > 0) {
      warningsList.innerHTML = warnings
        .map((w) => `<li>${w.replace(/</g, "&lt;")}</li>`) // escape < minimal
        .join("");
      warningsContainer.style.display = "block";
    } else {
      warningsContainer.style.display = "none";
      warningsList.innerHTML = "";
    }
  }
}

function showComparisonResultsWithAnimation() {
  const comparisonResults = document.getElementById("comparisonResults");
  if (comparisonResults) {
    comparisonResults.style.display = "block";
    addFadeInAnimation(comparisonResults, 200);
  }
}

function clearComparisonForm() {
  // Clear all form fields with new field structure
  clearLoanData("A");
  clearLoanData("B");
  clearLoanData("C");

  // Reset to 2-column layout by hiding Option B
  removeOption2();

  // Keep results section visible (like other tabs) - just clear the content
  const comparisonResults = document.getElementById("comparisonResults");
  // Results section stays visible, content will be updated on next calculation

  // Clear data
  comparisonData.loanA = null;
  comparisonData.loanB = null;
  comparisonData.loanC = null;
  comparisonData.isCalculated = false;
  comparisonData.bestOption = null;
  comparisonData.savings = null;

  showSuccessMessage("Comparison form cleared!");
}

// Validate user inputs
function validateInputs(
  propertyValue,
  downPaymentAmount,
  loanTerm,
  interestRate
) {
  if (isNaN(propertyValue) || propertyValue <= 0) {
    showErrorMessage("Please enter a valid property value");
    return false;
  }

  if (isNaN(downPaymentAmount) || downPaymentAmount < 0) {
    showErrorMessage("Please enter a valid down payment amount");
    return false;
  }

  if (downPaymentAmount >= propertyValue) {
    showErrorMessage(
      "Down payment cannot be greater than or equal to property value"
    );
    return false;
  }

  if (isNaN(loanTerm) || loanTerm <= 0) {
    showErrorMessage("Please enter a valid loan term");
    return false;
  }

  if (isNaN(interestRate) || interestRate <= 0) {
    showErrorMessage("Please enter a valid interest rate");
    return false;
  }

  return true;
}

// Refinance-specific validation (appraised value based)
function validateRefinanceInputs(
  appraisedValue,
  loanAmount,
  loanTerm,
  interestRate,
  propertyTax,
  homeInsurance,
  pmiAmount
) {
  if (isNaN(appraisedValue) || appraisedValue <= 0) {
    showErrorMessage("Please enter a valid appraised value");
    return false;
  }

  if (isNaN(loanAmount) || loanAmount <= 0) {
    showErrorMessage("Please enter a valid refinance loan amount");
    return false;
  }

  if (loanAmount > appraisedValue) {
    showErrorMessage("Loan amount cannot exceed appraised value");
    return false;
  }

  if (isNaN(loanTerm) || loanTerm <= 0) {
    showErrorMessage("Please enter a valid loan term");
    return false;
  }

  // Allow zero-interest refinance (handled by zero-interest PI fallback)
  if (isNaN(interestRate) || interestRate < 0) {
    showErrorMessage("Please enter a valid interest rate (cannot be negative)");
    return false;
  }

  if (!isNaN(propertyTax) && propertyTax < 0) {
    showErrorMessage("Property tax must be a number ≥ 0");
    return false;
  }

  if (!isNaN(homeInsurance) && homeInsurance < 0) {
    showErrorMessage("Home insurance must be a number ≥ 0");
    return false;
  }

  if (!isNaN(pmiAmount) && pmiAmount < 0) {
    showErrorMessage("PMI amount must be a number ≥ 0");
    return false;
  }

  return true;
}

// Update UI with calculation results
function updateResultsUI(
  loanAmount,
  monthlyPI,
  monthlyPropertyTax,
  monthlyHomeInsurance,
  monthlyPMI,
  hoa,
  totalMonthlyPayment,
  totalInterest,
  totalCost,
  loanToValueRatio,
  loanTerm,
  extraPayment = 0,
  amortizationData = [],
  formType = "purchase"
) {
  // Format currency function
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Prefer schedule PMI (month 1) for display if available to align with LTV gating
  const pmiForDisplay =
    amortizationData && amortizationData.length > 0
      ? amortizationData[0].pmi || 0
      : monthlyPMI;

  // Update main results section
  document.getElementById("monthlyPayment").textContent =
    formatCurrency(totalMonthlyPayment);
  // Base payment = total without extra
  const baseMonthlyPayment =
    monthlyPI + pmiForDisplay + monthlyPropertyTax + monthlyHomeInsurance + hoa;
  const baseEl = document.getElementById("baseMonthlyPayment");
  if (baseEl) baseEl.textContent = formatCurrency(baseMonthlyPayment);
  document.getElementById("loanAmount").textContent =
    formatCurrency(loanAmount);
  document.getElementById("totalInterest").textContent =
    formatCurrency(totalInterest);
  document.getElementById("principalInterest").textContent =
    formatCurrency(monthlyPI);
  document.getElementById("propertyTaxAmount").textContent =
    formatCurrency(monthlyPropertyTax);
  document.getElementById("insuranceAmount").textContent =
    formatCurrency(monthlyHomeInsurance);
  document.getElementById("pmiAmount").textContent =
    formatCurrency(pmiForDisplay);
  document.getElementById("hoaAmount").textContent = formatCurrency(hoa);
  document.getElementById("extraAmount").textContent =
    formatCurrency(extraPayment);
  document.getElementById("totalCost").textContent = formatCurrency(totalCost);

  // Purchase-specific: expose extra payment metrics (Task 6)
  if (formType === "purchase") {
    const extraRow = document.getElementById("extraMetricsRow");
    const monthsRow = document.getElementById("monthsSavedRow");
    const interestSavedEl = document.getElementById("interestSavedExtra");
    const monthsSavedEl = document.getElementById("monthsSavedExtra");
    if (extraRow && monthsRow && interestSavedEl && monthsSavedEl) {
      // builderResult stored on purchaseData.tabData.builderResult
      const br = purchaseData && purchaseData.builderResult;
      if (
        br &&
        typeof extraPayment === "number" &&
        extraPayment > 0 &&
        br.extraDeltas
      ) {
        const interestSaved = br.extraDeltas.interestSaved || 0;
        const monthsSaved = br.extraDeltas.monthsSaved || 0;
        extraRow.style.display = "block";
        monthsRow.style.display = "block";
        interestSavedEl.textContent = formatCurrency(interestSaved);
        if (monthsSaved > 0) {
          const y = Math.floor(monthsSaved / 12);
          const m = monthsSaved % 12;
          monthsSavedEl.textContent = `${y > 0 ? y + "y " : ""}${m}m`;
        } else {
          monthsSavedEl.textContent = "0m";
        }
      } else {
        // Hide when no extra or no baseline delta
        extraRow.style.display = "none";
        monthsRow.style.display = "none";
        interestSavedEl.textContent = "—";
        monthsSavedEl.textContent = "—";
      }
    }
  }

  // Refi: Show closing costs & points handling if available
  try {
    const infoRow = document.getElementById("refiCostsInfoRow");
    const infoEl = document.getElementById("refiCostsInfo");
    if (
      formType === "refinance" &&
      refinanceData &&
      refinanceData.refinanceCosts &&
      infoRow &&
      infoEl
    ) {
      const rc = refinanceData.refinanceCosts;
      const totalCosts = rc.financedCosts || 0;
      if (totalCosts > 0) {
        const pointsPctText = (rc.pointsPercent || 0).toFixed(2) + "%";
        const pointsAmtText = formatCurrency(rc.pointsAmount || 0);
        const closingText = formatCurrency(rc.closingCosts || 0);
        const modeText = rc.financeCosts
          ? "Included in Loan"
          : "Due at Closing";
        const modeAmount = rc.financeCosts ? totalCosts : rc.dueAtClosing || 0;
        const cashOutText =
          rc.cashOutAmount && rc.cashOutAmount > 0
            ? `, Cash-Out: ${formatCurrency(rc.cashOutAmount)}`
            : "";
        infoEl.textContent = `${modeText}: ${formatCurrency(
          modeAmount
        )} (Closing: ${closingText}, Points: ${pointsPctText} = ${pointsAmtText}${cashOutText})`;
        infoRow.style.display = "block";
      } else {
        infoRow.style.display = "none";
      }
    } else if (infoRow) {
      infoRow.style.display = "none";
    }
  } catch (e) {
    // ignore UI adornment errors
  }

  // Update summary tab content
  document.getElementById("summaryPI").textContent = formatCurrency(monthlyPI);
  document.getElementById("summaryTI").textContent = formatCurrency(
    monthlyPropertyTax + monthlyHomeInsurance
  );
  document.getElementById("summaryPMI").textContent =
    formatCurrency(pmiForDisplay);
  document.getElementById("summaryHOA").textContent = formatCurrency(hoa);
  document.getElementById("summaryLTV").textContent =
    loanToValueRatio.toFixed(2) + "%";

  // Calculate and display total interest paid over life of loan
  document.getElementById("summaryTotalInterest").textContent =
    formatCurrency(totalInterest);

  // Build PMI tooltip details (Task 15)
  try {
    const tooltipEl = document.getElementById("summaryPMITooltip");
    if (tooltipEl) {
      let pmiMeta = null;
      try {
        const tabData = formType === "purchase" ? purchaseData : refinanceData;
        pmiMeta = tabData?.builderResult?.pmiMeta || null;
      } catch (_e) {}
      const startingLTV = pmiMeta?.startingLTV || null; // not currently exposed; fallback compute
      let computedStartLTV = null;
      if (propertyValue > 0) {
        const principalBase =
          formType === "refinance" ? adjustedLoanAmount : loanAmount;
        computedStartLTV = principalBase / propertyValue;
      }
      const rule = pmiMeta
        ? pmiMeta.thresholdLTV
        : (pmiEndThresholdLtv || 80) / 100;
      const hasSchedule =
        Array.isArray(amortizationData) && amortizationData.length > 0;
      const pmiPaidTotal = pmiMeta?.pmiTotalPaid ?? 0;
      const endsMonth = pmiMeta?.pmiEndsMonth;
      const anyPmiCharged =
        hasSchedule && amortizationData.some((r) => r.pmi && r.pmi > 0);
      let dropText;
      if (!anyPmiCharged) {
        dropText = "N/A (No PMI)";
      } else if (anyPmiCharged && endsMonth === null) {
        dropText = "Never (Full Term)";
      } else if (
        anyPmiCharged &&
        typeof endsMonth === "number" &&
        endsMonth > 1
      ) {
        dropText = `Month ${endsMonth}`;
      } else if (endsMonth === 1) {
        dropText = "N/A (No PMI)";
      } else {
        dropText = "Unknown";
      }
      const ltvDisplay =
        ((computedStartLTV || startingLTV || 0) * 100).toFixed(2) + "%";
      const thresholdDisplay = (rule * 100).toFixed(0) + "%";
      const totalPaidDisplay = formatCurrency(pmiPaidTotal || 0);
      const status = !anyPmiCharged
        ? "Not Charged"
        : endsMonth === null
        ? "Active (Never Drops)"
        : endsMonth > 1
        ? "Drops"
        : "Not Charged";
      const tooltipLines = [
        `Starting LTV: ${ltvDisplay}`,
        `Threshold: ${thresholdDisplay}`,
        `Drop: ${dropText}`,
        `Total PMI Paid: ${totalPaidDisplay}`,
        `Status: ${status}`,
      ];
      tooltipEl.setAttribute("data-bs-original-title", tooltipLines.join("\n"));
      tooltipEl.setAttribute("title", tooltipLines.join("\n"));
      // (Re)initialize Bootstrap tooltip if available
      if (window.bootstrap && window.bootstrap.Tooltip) {
        try {
          const existing = bootstrap.Tooltip.getInstance(tooltipEl);
          if (existing) existing.dispose();
          new bootstrap.Tooltip(tooltipEl);
        } catch (_tt) {}
      }
    }
  } catch (e) {
    console.warn("PMI tooltip build failed", e);
  }

  // Calculate and display loan payoff date (use actual payoff from schedule if available)
  let payoffDate;
  if (amortizationData && amortizationData.length > 0) {
    // Use the actual payoff date from the last payment in the schedule
    payoffDate = amortizationData[amortizationData.length - 1].paymentDate;
    // Determine PMI drop-off using builderResult.pmiMeta when available (more authoritative)
    const dropRow = document.getElementById("summaryPMIDropRow");
    const dropSpan = document.getElementById("summaryPMIDrop");
    if (dropRow && dropSpan) {
      dropRow.style.display = "block";
      let pmiMeta = null;
      try {
        const tabData = formType === "purchase" ? purchaseData : refinanceData;
        pmiMeta = tabData?.builderResult?.pmiMeta || null;
      } catch (e) {}
      if (pmiMeta) {
        const { pmiEndsMonth } = pmiMeta; // 1 => never charged; null => never ends; >1 => first month without PMI
        // Detect if PMI ever charged using schedule rows
        const hasPmi = amortizationData.some((r) => r.pmi && r.pmi > 0);
        if (!hasPmi) {
          dropSpan.textContent = "N/A (No PMI)";
        } else if (hasPmi && pmiEndsMonth === null) {
          dropSpan.textContent = "Never (PMI lasts full term)";
        } else if (
          hasPmi &&
          typeof pmiEndsMonth === "number" &&
          pmiEndsMonth > 1
        ) {
          // pmiEndsMonth is 1-based index of first PMI-FREE month, so last charged month = pmiEndsMonth - 1
          const chargedIndex = pmiEndsMonth - 2; // zero-based index for last charged month
          const targetIndex = Math.max(0, pmiEndsMonth - 1); // first free month index zero-based
          const dateSource =
            amortizationData[targetIndex] ||
            amortizationData[amortizationData.length - 1];
          const dateText = dateSource.paymentDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          });
          dropSpan.textContent = `${dateText} (Payment #${targetIndex + 1})`;
        } else if (pmiEndsMonth === 1) {
          dropSpan.textContent = "N/A (No PMI)";
        } else {
          // Fallback to schedule scan if meta ambiguous
          const hasPmi2 = amortizationData.some((r) => r.pmi && r.pmi > 0);
          if (!hasPmi2) {
            dropSpan.textContent = "N/A (No PMI)";
          } else {
            dropSpan.textContent = "Never (PMI lasts full term)";
          }
        }
      } else {
        // Legacy fallback schedule scan
        const hasPmi = amortizationData.some((r) => r.pmi && r.pmi > 0);
        let sawPmi = false;
        let dropIndex = -1;
        if (hasPmi) {
          for (let i = 0; i < amortizationData.length; i++) {
            const row = amortizationData[i];
            if (row.pmi && row.pmi > 0) sawPmi = true;
            if (sawPmi && (!row.pmi || row.pmi === 0)) {
              dropIndex = i;
              break;
            }
          }
        }
        if (!hasPmi) {
          dropSpan.textContent = "N/A (No PMI)";
        } else if (dropIndex >= 0) {
          const dropDate = amortizationData[dropIndex].paymentDate;
          const dateText = dropDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
          });
          dropSpan.textContent = `${dateText} (Payment #${dropIndex + 1})`;
        } else {
          dropSpan.textContent = "Never (PMI lasts full term)";
        }
      }
    }
  } else {
    // Fallback to original calculation
    const currentDate = new Date();
    payoffDate = new Date(currentDate);
    payoffDate.setFullYear(currentDate.getFullYear() + loanTerm);
    const dropRow = document.getElementById("summaryPMIDropRow");
    const dropSpan = document.getElementById("summaryPMIDrop");
    if (dropRow && dropSpan) {
      dropRow.style.display = "none";
      dropSpan.textContent = "—";
    }
  }

  const payoffDateFormatted = payoffDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  document.getElementById("summaryPayoffDate").textContent =
    payoffDateFormatted;

  // Show extra payment savings if applicable
  if (extraPayment > 0 && amortizationData.length > 0) {
    const actualPayments = amortizationData.length;
    const originalPayments = loanTerm * 12;
    const monthsSaved = originalPayments - actualPayments;
    const yearsSaved = Math.floor(monthsSaved / 12);
    const remainingMonths = monthsSaved % 12;

    // Calculate interest saved (compare to original schedule without extra payments)
    const originalTotalInterest = monthlyPI * originalPayments - loanAmount;
    const interestSaved = originalTotalInterest - totalInterest;

    const extraPaymentSavingsEl = document.getElementById(
      "extraPaymentSavings"
    );
    if (extraPaymentSavingsEl) {
      let savingsText = `Extra Payment Savings: `;
      if (yearsSaved > 0) {
        savingsText += `${yearsSaved} year${yearsSaved > 1 ? "s" : ""} `;
        if (remainingMonths > 0) {
          savingsText += `${remainingMonths} month${
            remainingMonths > 1 ? "s" : ""
          } `;
        }
      }
      savingsText += `earlier payoff, ${formatCurrency(
        interestSaved
      )} interest saved`;
      extraPaymentSavingsEl.textContent = savingsText;
      extraPaymentSavingsEl.style.display = "block";
    }
  } else {
    const extraPaymentSavingsEl = document.getElementById(
      "extraPaymentSavings"
    );
    if (extraPaymentSavingsEl) {
      extraPaymentSavingsEl.style.display = "none";
    }
  }

  // Show/hide HOA sections based on form type
  const hoaSummarySection = document.getElementById("hoaSummarySection");
  const summaryHOASection = document.getElementById("summaryHOASection");
  const baseMonthlyPaymentContainer = document
    .getElementById("baseMonthlyPayment")
    ?.closest(".result-item");
  if (hoaSummarySection) {
    hoaSummarySection.style.display =
      formType === "purchase" ? "block" : "none";
  }
  if (summaryHOASection) {
    summaryHOASection.style.display =
      formType === "purchase" ? "block" : "none";
  }
  // Show Base Monthly Payment only if extraPayment > 0 and not for HELOC
  if (baseMonthlyPaymentContainer) {
    const shouldShowBase = formType !== "heloc" && Number(extraPayment) > 0;
    baseMonthlyPaymentContainer.style.display = shouldShowBase
      ? "block"
      : "none";
  }
}

// Generate amortization schedule data
// LEGACY IMPLEMENTATION (DEPRECATED - Task 22):
// This imperative amortization loop has been superseded by the unified ScheduleBuilder engine
// used for Purchase + Refinance paths (which yields richer outputs: pmiMeta, extraDeltas, etc.).
// Remaining usage: (a) legacy comparative displays that still expect this shape, (b) simple
// amortization CSV export invoked directly, and (c) non-unified paths (e.g., HELoc helper logic).
// DO NOT extend or add refinance-specific logic here; instead integrate with ScheduleBuilder.
// Future removal plan: Once all exports & UI bindings consume builderResult, delete this function.
function generateAmortizationSchedule(
  loanAmount,
  monthlyInterestRate,
  numberOfPayments,
  monthlyPropertyTax,
  monthlyHomeInsurance,
  monthlyPMI,
  hoa,
  extraPayment = 0,
  appraisedValue = 0,
  isRefinance = false,
  pmiEndThresholdLtv = 80
) {
  const schedule = []; // NOTE: Deprecated schedule shape; prefer builderResult.schedule
  let balance = loanAmount;
  // Handle zero-interest schedules gracefully (align with calculateMortgage)
  const monthlyPI =
    monthlyInterestRate === 0
      ? numberOfPayments > 0
        ? loanAmount / numberOfPayments
        : 0
      : (loanAmount *
          (monthlyInterestRate *
            Math.pow(1 + monthlyInterestRate, numberOfPayments))) /
        (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);

  // Get current date for payment schedule
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  for (
    let paymentNumber = 1;
    paymentNumber <= numberOfPayments && balance > 0.01;
    paymentNumber++
  ) {
    // Calculate payment date
    const paymentDate = new Date(currentYear, currentMonth + paymentNumber, 1);

    // Calculate interest for this period
    const interestPayment = balance * monthlyInterestRate;

    // Calculate principal for this period (regular + extra payment)
    let principalPayment = monthlyPI - interestPayment;

    // Add extra payment to principal (but don't exceed remaining balance)
    const totalPrincipalPayment = Math.min(
      principalPayment + extraPayment,
      balance
    );
    const actualExtraPayment = totalPrincipalPayment - principalPayment;
    principalPayment = totalPrincipalPayment;

    // Calculate PMI
    let pmi = 0;
    if (isRefinance && appraisedValue > 0) {
      // Refinance: Use user-entered monthly PMI amount, drop when LTV <= threshold
      const ltv = (balance / appraisedValue) * 100;
      pmi = ltv > pmiEndThresholdLtv ? monthlyPMI : 0;
    } else {
      // Purchase: derive from purchase fields and drop at threshold LTV
      const downPctEl = document.getElementById("downPaymentPercent");
      const pmiRateEl = document.getElementById("pmiRate");
      if (downPctEl && pmiRateEl) {
        const originalPropertyValue =
          loanAmount / (1 - parseFloat(downPctEl.value || 0) / 100);
        const loanToValueRatio = (balance / originalPropertyValue) * 100;
        const pmiRate = parseFloat(pmiRateEl.value || 0);
        pmi =
          loanToValueRatio > pmiEndThresholdLtv
            ? (pmiRate / 100 / 12) * balance
            : 0;
      } else {
        // Fallback: use provided monthlyPMI as-is
        pmi = monthlyPMI;
      }
    }

    // Update remaining balance
    balance -= principalPayment;

    // Ensure balance doesn't go below zero due to rounding errors
    if (balance < 0) balance = 0;

    // Total payment including taxes, insurance, PMI, HOA, and extra payment
    const totalPayment =
      monthlyPI +
      monthlyPropertyTax +
      monthlyHomeInsurance +
      pmi +
      hoa +
      actualExtraPayment;

    // Add to schedule
    schedule.push({
      paymentNumber: paymentNumber,
      paymentDate: paymentDate,
      payment: totalPayment,
      principal: principalPayment,
      interest: interestPayment,
      balance: balance,
      propertyTax: monthlyPropertyTax,
      insurance: monthlyHomeInsurance,
      pmi: pmi,
      hoa: hoa,
      extraPayment: actualExtraPayment,
    });
  }

  return schedule;
}

// --- Test Harness Export Consolidation (ensures latest symbols) ---
try {
  if (typeof module !== "undefined" && module.exports) {
    module.exports.applyDownPaymentPreset =
      module.exports.applyDownPaymentPreset ||
      (typeof applyDownPaymentPreset === "function"
        ? applyDownPaymentPreset
        : undefined);
  }
} catch (_) {}

// Generate HELOC amortization schedule
function generateHelocAmortizationSchedule(
  helocAmount,
  interestRate,
  interestOnlyPeriod,
  repaymentPeriod
) {
  const schedule = [];
  let balance = helocAmount;
  const monthlyInterestRate = interestRate / 100 / 12;

  // Get current date for payment schedule
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Interest-only period
  const interestOnlyMonths = interestOnlyPeriod * 12;
  const interestOnlyPayment = helocAmount * monthlyInterestRate;

  for (
    let paymentNumber = 1;
    paymentNumber <= interestOnlyMonths;
    paymentNumber++
  ) {
    const paymentDate = new Date(currentYear, currentMonth + paymentNumber, 1);

    schedule.push({
      paymentNumber: paymentNumber,
      paymentDate: paymentDate,
      payment: interestOnlyPayment,
      principalPayment: 0,
      interestPayment: interestOnlyPayment,
      balance: balance,
      phase: "Interest-Only",
    });
  }

  // Principal and interest period
  const repaymentMonths = (repaymentPeriod - interestOnlyPeriod) * 12;
  let principalInterestPayment = 0;

  if (repaymentMonths > 0) {
    principalInterestPayment =
      (balance *
        (monthlyInterestRate *
          Math.pow(1 + monthlyInterestRate, repaymentMonths))) /
      (Math.pow(1 + monthlyInterestRate, repaymentMonths) - 1);

    for (let month = 1; month <= repaymentMonths && balance > 0.01; month++) {
      const paymentNumber = interestOnlyMonths + month;
      const paymentDate = new Date(
        currentYear,
        currentMonth + paymentNumber,
        1
      );

      const interestPayment = balance * monthlyInterestRate;
      const principalPayment = Math.min(
        principalInterestPayment - interestPayment,
        balance
      );

      balance -= principalPayment;

      if (balance < 0) balance = 0;

      schedule.push({
        paymentNumber: paymentNumber,
        paymentDate: paymentDate,
        payment: principalInterestPayment,
        principalPayment: principalPayment,
        interestPayment: interestPayment,
        balance: balance,
        phase: "Principal & Interest",
      });
    }
  }

  return schedule;
}

// Update HELOC results UI
function updateHelocResultsUI(
  interestOnlyPayment,
  principalInterestPayment,
  helocAmount,
  totalInterest,
  propertyValue,
  outstandingBalance,
  ltv
) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Update main results section for HELOC
  document.getElementById("monthlyPayment").textContent =
    formatCurrency(interestOnlyPayment);
  document.getElementById("loanAmount").textContent =
    formatCurrency(helocAmount);
  document.getElementById("totalInterest").textContent =
    formatCurrency(totalInterest);
  document.getElementById("principalInterest").textContent = formatCurrency(
    principalInterestPayment
  );
  document.getElementById("totalCost").textContent = formatCurrency(
    helocAmount + totalInterest
  );

  // Clear fields that don't apply to HELOC
  document.getElementById("propertyTaxAmount").textContent = "$0.00";
  document.getElementById("insuranceAmount").textContent = "$0.00";
  document.getElementById("pmiAmount").textContent = "$0.00";
  document.getElementById("hoaAmount").textContent = "$0.00";
  document.getElementById("extraAmount").textContent = "$0.00";

  // Hide irrelevant fields for HELOC by hiding their parent containers
  const fieldsToHide = [
    document.getElementById("propertyTaxAmount").closest(".result-item"),
    document.getElementById("insuranceAmount").closest(".result-item"),
    document.getElementById("pmiAmount").closest(".result-item"),
    document.getElementById("extraAmount").closest(".result-item"),
  ];

  fieldsToHide.forEach((field) => {
    if (field) {
      field.style.display = "none";
    }
  });

  // Hide HOA section specifically for HELOC
  const hoaSection = document.getElementById("hoaSummarySection");
  if (hoaSection) {
    hoaSection.style.display = "none";
  }

  // Hide extra payment savings section for HELOC
  const extraPaymentSavings = document.getElementById("extraPaymentSavings");
  if (extraPaymentSavings) {
    extraPaymentSavings.style.display = "none";
  }

  // Update summary tab content for HELOC
  document.getElementById("summaryPI").textContent = formatCurrency(
    principalInterestPayment
  );
  document.getElementById("summaryTI").textContent = "$0.00"; // Not applicable for HELOC
  document.getElementById("summaryPMI").textContent = "$0.00"; // Not applicable for HELOC
  document.getElementById("summaryHOA").textContent = "$0.00"; // Not applicable for HELOC
  document.getElementById("summaryLTV").textContent = ltv.toFixed(2) + "%";
  document.getElementById("summaryTotalInterest").textContent =
    formatCurrency(totalInterest);

  // Calculate and set HELOC payoff date
  const helocAmortizationData = helocData.amortizationData || [];
  let payoffDate;

  if (helocAmortizationData.length > 0) {
    // Use the actual payoff date from the last payment in the HELOC schedule
    payoffDate =
      helocAmortizationData[helocAmortizationData.length - 1].paymentDate;
  } else {
    // Fallback calculation
    const currentDate = new Date();
    const repaymentPeriod =
      parseInt(document.getElementById("helocRepaymentPeriod").value) || 20;
    payoffDate = new Date(currentDate);
    payoffDate.setFullYear(currentDate.getFullYear() + repaymentPeriod);
  }

  const payoffDateFormatted = payoffDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  document.getElementById("summaryPayoffDate").textContent =
    payoffDateFormatted;

  // Update labels for HELOC context
  const monthlyPaymentLabel = document.querySelector(
    "h6:has(+ #monthlyPayment)"
  );
  if (monthlyPaymentLabel) {
    monthlyPaymentLabel.textContent = "Interest-Only Payment";
  }
}

// Update amortization table with calculated data
function updateAmortizationTable(formType = "purchase") {
  const tableBody = document.getElementById("scheduleTableBody");
  tableBody.innerHTML = "";

  // Get the appropriate tab's data
  let tabData;
  if (formType === "purchase") {
    tabData = purchaseData;
  } else if (formType === "refinance") {
    tabData = refinanceData;
  } else if (formType === "heloc") {
    tabData = helocData;
  }
  const currentAmortizationData = tabData.amortizationData || [];

  // Format options
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
  });

  // Add rows to table (limit to first 60 rows for performance)
  const displayCount = Math.min(60, currentAmortizationData.length);

  for (let i = 0; i < displayCount; i++) {
    const row = currentAmortizationData[i];
    const tr = document.createElement("tr");

    if (formType === "heloc") {
      // HELOC has different data structure
      tr.innerHTML = `
        <td>${row.paymentNumber}</td>
        <td>${dateFormatter.format(row.paymentDate)}</td>
        <td>${currencyFormatter.format(row.payment)}</td>
        <td>${currencyFormatter.format(row.principalPayment || 0)}</td>
        <td>$0.00</td>
        <td>${currencyFormatter.format(row.interestPayment)}</td>
        <td>${currencyFormatter.format(row.balance)}</td>
      `;

      // Add visual indicator for interest-only vs principal+interest phases
      if (row.phase === "Interest-Only") {
        tr.style.backgroundColor = "#fff3cd"; // Light yellow for interest-only
      }
    } else {
      // Regular mortgage structure
      tr.innerHTML = `
        <td>${row.paymentNumber}</td>
        <td>${dateFormatter.format(row.paymentDate)}</td>
        <td>${currencyFormatter.format(row.payment)}</td>
        <td>${currencyFormatter.format(
          row.principal - (row.extraPayment || 0)
        )}</td>
        <td>${currencyFormatter.format(row.extraPayment || 0)}</td>
        <td>${currencyFormatter.format(row.interest)}</td>
        <td>${currencyFormatter.format(row.pmi || 0)}</td>
        <td>${currencyFormatter.format(row.balance)}</td>
      `;
    }

    tableBody.appendChild(tr);
  }

  // Add message if table was truncated
  if (currentAmortizationData.length > displayCount) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="8" class="text-center">
        <em>Showing ${displayCount} of ${currentAmortizationData.length} payments. Export to CSV for full schedule.</em>
      </td>
    `;
    tableBody.appendChild(tr);
  }
}

// Test function to create a simple chart for debugging
function createTestChart() {
  console.log("Creating test chart...");
  const testCanvas = document.getElementById("amortizationChart");
  if (!testCanvas) {
    console.error("Test canvas not found");
    return;
  }

  try {
    const testChart = new Chart(testCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Test 1", "Test 2", "Test 3"],
        datasets: [
          {
            label: "Test Data",
            data: [10, 20, 30],
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
    console.log("Test chart created successfully:", testChart);
  } catch (error) {
    console.error("Error creating test chart:", error);
  }
}

// Render charts based on amortization data
function renderCharts() {
  console.log("renderCharts() called");
  renderAmortizationCharts();
}

// Render amortization and balance charts for visualization tab
function renderAmortizationCharts() {
  console.log("renderAmortizationCharts() called, currentTab:", currentTab);
  let data;
  if (currentTab === "purchase") {
    data = purchaseData;
  } else if (currentTab === "refinance") {
    data = refinanceData;
  } else if (currentTab === "heloc") {
    data = helocData;
  }
  const currentAmortizationData = data.amortizationData || [];
  console.log("Amortization data length:", currentAmortizationData.length);

  if (!currentAmortizationData.length) {
    console.log("No amortization data available for charts");
    return;
  }

  // Prepare data for charts
  const years = [];
  const principalData = [];
  const interestData = [];
  const balanceData = [];

  // Sample data every 12 months (1 year) for better performance
  for (let i = 0; i < currentAmortizationData.length; i += 12) {
    const payment = currentAmortizationData[i];
    const yearNumber = Math.floor(i / 12) + 1;

    years.push(`Year ${yearNumber}`);

    // Calculate annual totals
    let annualPrincipal = 0;
    let annualInterest = 0;

    // Sum up 12 months data or remaining months if less than 12
    for (let j = 0; j < 12 && i + j < currentAmortizationData.length; j++) {
      const monthPayment = currentAmortizationData[i + j];
      if (currentTab === "heloc") {
        annualPrincipal += monthPayment.principalPayment || 0;
        annualInterest += monthPayment.interestPayment;
      } else {
        annualPrincipal += monthPayment.principal;
        annualInterest += monthPayment.interest;
      }
    }

    principalData.push(annualPrincipal);
    interestData.push(annualInterest);
    balanceData.push(payment.balance);
  }

  // Render principal vs interest chart
  const amortizationCanvas = document.getElementById("amortizationChart");
  console.log("amortizationChart canvas element:", amortizationCanvas);
  if (!amortizationCanvas) {
    console.error("amortizationChart canvas element not found!");
    return;
  }
  const amortizationCtx = amortizationCanvas.getContext("2d");
  if (charts.amortization) {
    charts.amortization.destroy();
  }

  console.log("Creating amortization chart with data:", {
    years: years.length,
    principal: principalData.length,
    interest: interestData.length,
  });

  charts.amortization = new Chart(amortizationCtx, {
    type: "bar",
    data: {
      labels: years,
      datasets: [
        {
          label: "Principal",
          data: principalData,
          backgroundColor: "rgba(52, 152, 219, 0.7)",
          borderColor: "rgba(52, 152, 219, 1)",
          borderWidth: 1,
        },
        {
          label: "Interest",
          data: interestData,
          backgroundColor: "rgba(231, 76, 60, 0.7)",
          borderColor: "rgba(231, 76, 60, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          stacked: false,
          title: {
            display: true,
            text: "Year",
          },
        },
        y: {
          stacked: false,
          title: {
            display: true,
            text: "Amount ($)",
          },
          ticks: {
            callback: function (value) {
              return "$" + value.toLocaleString();
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || "";
              const value = context.raw;
              return (
                label +
                ": " +
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(value)
              );
            },
          },
        },
      },
    },
  });

  // Render loan balance chart
  const balanceCanvas = document.getElementById("balanceChart");
  console.log("balanceChart canvas element:", balanceCanvas);
  if (!balanceCanvas) {
    console.error("balanceChart canvas element not found!");
    return;
  }
  const balanceCtx = balanceCanvas.getContext("2d");
  if (charts.balance) {
    charts.balance.destroy();
  }

  charts.balance = new Chart(balanceCtx, {
    type: "line",
    data: {
      labels: years,
      datasets: [
        {
          label: "Loan Balance",
          data: balanceData,
          backgroundColor: "rgba(46, 204, 113, 0.2)",
          borderColor: "rgba(46, 204, 113, 1)",
          borderWidth: 2,
          fill: true,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          title: {
            display: true,
            text: "Year",
          },
        },
        y: {
          title: {
            display: true,
            text: "Balance ($)",
          },
          ticks: {
            callback: function (value) {
              return "$" + value.toLocaleString();
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || "";
              const value = context.raw;
              return (
                label +
                ": " +
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(value)
              );
            },
          },
        },
      },
    },
  });

  console.log("Amortization chart created successfully");

  console.log("Creating balance chart with data:", {
    years: years.length,
    balance: balanceData.length,
  });

  charts.balance = new Chart(balanceCtx, {
    type: "line",
    data: {
      labels: years,
      datasets: [
        {
          label: "Loan Balance",
          data: balanceData,
          backgroundColor: "rgba(46, 204, 113, 0.2)",
          borderColor: "rgba(46, 204, 113, 1)",
          borderWidth: 2,
          fill: true,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          title: {
            display: true,
            text: "Year",
          },
        },
        y: {
          title: {
            display: true,
            text: "Balance ($)",
          },
          ticks: {
            callback: function (value) {
              return "$" + value.toLocaleString();
            },
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || "";
              const value = context.raw;
              return (
                label +
                ": " +
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(value)
              );
            },
          },
        },
      },
    },
  });

  console.log("Balance chart created successfully");
}

// ---------------------------------------------
// Down Payment Bidirectional Sync (Priority 1 Task 2)
// ---------------------------------------------
// Design:
// - Debounce: 200ms per field input stream.
// - Last-edit wins using source tracking.
// - Drift tolerance: amount < $1 or percent < 0.01% => skip update.
// - Rounding: amount -> nearest dollar; percent -> 2 decimals.
// - Loop prevention via syncInProgress flag and source check.
// - Clamp: percent < 0 => 0; percent >= 100 => 99.99 (warning left to validation layer).
// - Property value 0 => zero out derived field silently.

const DOWN_PAYMENT_SYNC = {
  debounceMs: 200,
  lastSource: null, // 'amount' | 'percent' | 'property' | null
  timers: {},
  syncInProgress: false,
};

function getDPInputs() {
  return {
    property: document.getElementById("propertyValue"),
    amount: document.getElementById("downPaymentAmount"),
    percent: document.getElementById("downPaymentPercent"),
  };
}

function parseNum(el) {
  if (!el) return 0;
  const v = parseFloat(el.value);
  return isNaN(v) ? 0 : v;
}

function roundAmount(v) {
  return Math.round(v);
}
function roundPercent(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100; // 2 decimals
}

function scheduleDP(fn, key) {
  const ms = DOWN_PAYMENT_SYNC.debounceMs;
  if (DOWN_PAYMENT_SYNC.timers[key]) {
    clearTimeout(DOWN_PAYMENT_SYNC.timers[key]);
  }
  DOWN_PAYMENT_SYNC.timers[key] = setTimeout(fn, ms);
}

function applyDownPaymentValues({ amount, percent }, { source }) {
  const { amount: amountEl, percent: percentEl } = getDPInputs();
  if (!amountEl || !percentEl) return;
  DOWN_PAYMENT_SYNC.syncInProgress = true;
  try {
    if (typeof amount === "number" && !isNaN(amount)) {
      amountEl.value = amount.toString();
    }
    if (typeof percent === "number" && !isNaN(percent)) {
      percentEl.value = percent.toFixed(2);
    }
  } finally {
    DOWN_PAYMENT_SYNC.syncInProgress = false;
  }
  DOWN_PAYMENT_SYNC.lastSource = source;
}

function recalcPercentFromAmount() {
  const { property, amount } = getDPInputs();
  const pv = parseNum(property);
  const amt = parseNum(amount);
  if (pv <= 0) {
    applyDownPaymentValues({ percent: 0 }, { source: "amount" });
    return;
  }
  const pctRaw = (amt / pv) * 100;
  let pct = pctRaw;
  if (pct < 0) pct = 0;
  if (pct >= 100) pct = 99.99; // soft clamp prior to validation error
  const pctRounded = roundPercent(pct);
  const currentPct = parseNum(getDPInputs().percent);
  if (Math.abs(pctRounded - currentPct) < 0.01) return; // drift tolerance
  applyDownPaymentValues({ percent: pctRounded }, { source: "amount" });
}

function recalcAmountFromPercent() {
  const { property, percent } = getDPInputs();
  const pv = parseNum(property);
  const pct = parseNum(percent);
  if (pv <= 0) {
    applyDownPaymentValues({ amount: 0 }, { source: "percent" });
    return;
  }
  let pctClamped = pct;
  if (pctClamped < 0) pctClamped = 0;
  if (pctClamped >= 100) pctClamped = 99.99;
  const amountRaw = (pv * pctClamped) / 100;
  const amtRounded = roundAmount(amountRaw);
  const currentAmt = parseNum(getDPInputs().amount);
  if (Math.abs(amtRounded - currentAmt) < 1) return; // drift tolerance
  applyDownPaymentValues({ amount: amtRounded }, { source: "percent" });
}

function propertyValueChangedForDP() {
  // When property value changes, prefer recomputing amount from percent
  // unless last source was amount (then recompute percent from amount)
  const last = DOWN_PAYMENT_SYNC.lastSource;
  if (last === "amount") {
    recalcPercentFromAmount();
  } else {
    recalcAmountFromPercent();
  }
}

function attachDownPaymentSyncListeners() {
  if (attachDownPaymentSyncListeners._attached) return;
  const { property, amount, percent } = getDPInputs();
  if (property) {
    property.addEventListener("input", () => {
      if (DOWN_PAYMENT_SYNC.syncInProgress) return;
      DOWN_PAYMENT_SYNC.lastSource = "property";
      scheduleDP(propertyValueChangedForDP, "property");
    });
    property.addEventListener("blur", propertyValueChangedForDP);
  }
  if (amount) {
    amount.addEventListener("input", () => {
      if (DOWN_PAYMENT_SYNC.syncInProgress) return;
      DOWN_PAYMENT_SYNC.lastSource = "amount";
      scheduleDP(recalcPercentFromAmount, "amount");
    });
    amount.addEventListener("blur", recalcPercentFromAmount);
  }
  if (percent) {
    percent.addEventListener("input", () => {
      if (DOWN_PAYMENT_SYNC.syncInProgress) return;
      DOWN_PAYMENT_SYNC.lastSource = "percent";
      scheduleDP(recalcAmountFromPercent, "percent");
    });
    percent.addEventListener("blur", recalcAmountFromPercent);
  }
  attachDownPaymentSyncListeners._attached = true;
}

// Toggle PMI mode between monthly and annual
function togglePmiMode() {
  const toggle = document.getElementById("refinancePmiToggle");
  const label = document.getElementById("refinancePmiLabel");
  const toggleLabel = document.getElementById("refinancePmiToggleLabel");
  const input = document.getElementById("refinancePmiAmount");

  // Safety check - if elements don't exist, return early
  if (!toggle || !label || !toggleLabel || !input) {
    return;
  }

  if (toggle.checked) {
    // Switch to Annual mode
    label.textContent = "PMI Annual Amount ($):";
    toggleLabel.textContent = "Annual";
    input.placeholder = "e.g., 1500";

    // Convert current monthly value to annual (if there's a value)
    const currentValue = parseFloat(input.value) || 0;
    if (currentValue > 0) {
      input.value = (currentValue * 12).toFixed(2);
    }
  } else {
    // Switch to Monthly mode
    label.textContent = "PMI Monthly Amount ($):";
    toggleLabel.textContent = "Monthly";
    input.placeholder = "e.g., 125";

    // Convert current annual value to monthly (if there's a value)
    const currentValue = parseFloat(input.value) || 0;
    if (currentValue > 0) {
      input.value = (currentValue / 12).toFixed(2);
    }
  }

  // Save the new state
  saveDataToCache();
}

// Add/Remove Option B column functionality
function addOption2() {
  const loanCColumn = document.getElementById("loanC_column");
  const addBtn = document.getElementById("addOption2Btn");
  const removeBtn = document.getElementById("removeOption2Btn");
  const columns = document.querySelectorAll(".comparison-column:not(.d-none)");

  if (loanCColumn && addBtn && removeBtn) {
    // Show Option B column
    loanCColumn.classList.remove("d-none");

    // Update column classes for 3-column layout
    document.querySelectorAll(".comparison-column").forEach((col) => {
      col.classList.remove("col-lg-6");
      col.classList.add("col-lg-4");
    });

    // Toggle button visibility
    addBtn.classList.add("d-none");
    removeBtn.classList.remove("d-none");
  }
}

function removeOption2() {
  const loanCColumn = document.getElementById("loanC_column");
  const addBtn = document.getElementById("addOption2Btn");
  const removeBtn = document.getElementById("removeOption2Btn");

  if (loanCColumn && addBtn && removeBtn) {
    // Hide Option B column
    loanCColumn.classList.add("d-none");

    // Clear Option B form data
    clearLoanData("C");

    // Update column classes for 2-column layout
    const visibleColumns = document.querySelectorAll(
      ".comparison-column:not(.d-none)"
    );
    visibleColumns.forEach((col) => {
      col.classList.remove("col-lg-4");
      col.classList.add("col-lg-6");
    });

    // Toggle button visibility
    removeBtn.classList.add("d-none");
    addBtn.classList.remove("d-none");
  }
}

function clearLoanData(loanLetter) {
  const prefix = `loan${loanLetter}_`;
  const defaultName =
    loanLetter === "A"
      ? "Current Loan"
      : loanLetter === "B"
      ? "Option A"
      : "Option B";

  // Reset all form fields for this loan
  document.getElementById(prefix + "name").value = defaultName;
  document.getElementById(prefix + "appraisedValue").value = "0";
  document.getElementById(prefix + "amount").value = "0";
  document.getElementById(prefix + "rate").value = "0";
  document.getElementById(prefix + "term").value = "0";
  document.getElementById(prefix + "pmi").value = "0";
  document.getElementById(prefix + "propertyTax").value = "0";
  document.getElementById(prefix + "homeInsurance").value = "0";
  document.getElementById(prefix + "extra").value = "0";

  // Reset PMI toggle
  const pmiToggle = document.getElementById(prefix + "pmiToggle");
  if (pmiToggle) {
    pmiToggle.checked = false;
    toggleComparisonPmiMode(loanLetter);
  }
}

// Toggle PMI mode for comparison loans
function toggleComparisonPmiMode(loanLetter) {
  const prefix = `loan${loanLetter}_`;
  const toggle = document.getElementById(prefix + "pmiToggle");
  const label = document.getElementById(prefix + "pmiLabel");
  const toggleLabel = document.getElementById(prefix + "pmiToggleLabel");
  const input = document.getElementById(prefix + "pmi");

  // Safety check - if elements don't exist, return early
  if (!toggle || !label || !toggleLabel || !input) {
    return;
  }

  if (toggle.checked) {
    // Switch to Annual mode
    label.textContent = "PMI Annual Amount ($):";
    toggleLabel.textContent = "Annual";
    input.placeholder = "e.g., 1500";

    // Convert current monthly value to annual (if there's a value)
    const currentValue = parseFloat(input.value) || 0;
    if (currentValue > 0) {
      input.value = (currentValue * 12).toFixed(2);
    }
  } else {
    // Switch to Monthly mode
    label.textContent = "PMI Monthly Amount ($):";
    toggleLabel.textContent = "Monthly";
    input.placeholder = "e.g., 125";

    // Convert current annual value to monthly (if there's a value)
    const currentValue = parseFloat(input.value) || 0;
    if (currentValue > 0) {
      input.value = (currentValue / 12).toFixed(2);
    }
  }

  // --- Task 7: Rounding & Consistency Check (purchase only) ---
  if (formType === "purchase") {
    try {
      const sched = amortizationData || [];
      if (sched.length > 0) {
        const row1 = sched[0];
        const displayed = parseFloat(
          document
            .getElementById("monthlyPayment")
            .textContent.replace(/[^0-9.\-]/g, "") || "0"
        );
        const diff = Math.abs(row1.payment - displayed);
        if (diff >= 0.01) {
          console.warn(
            `[PurchaseConsistency] Monthly payment mismatch >$0.01: row1=${row1.payment.toFixed(
              2
            )} displayed=${displayed.toFixed(2)} diff=${diff.toFixed(2)}`
          );
        }
      }
      // Base monthly payment row visibility (only when extra>0)
      const baseRowContainer = document
        .getElementById("baseMonthlyPayment")
        ?.closest(".result-item");
      if (baseRowContainer) {
        if (typeof extraPayment === "number" && extraPayment > 0) {
          baseRowContainer.style.display = "block";
        } else {
          baseRowContainer.style.display = "none";
        }
      }
    } catch (e) {
      console.warn("[PurchaseConsistency] Check failed:", e);
    }
  }
}

// Export amortization schedule to CSV
function exportToCSV() {
  // Use current tab's amortization data
  let tabData;
  if (currentTab === "purchase") {
    tabData = purchaseData;
  } else if (currentTab === "refinance") {
    tabData = refinanceData;
  } else if (currentTab === "heloc") {
    tabData = helocData;
  }

  const data = tabData?.amortizationData || [];
  if (!data.length) {
    alert(`Please calculate ${currentTab.toUpperCase()} first.`);
    return;
  }

  const rows = [];

  if (currentTab === "heloc") {
    // HELOC-specific CSV structure
    rows.push([
      "Payment #",
      "Payment Date",
      "Payment Amount",
      "Principal",
      "Interest",
      "Balance",
      "Phase",
      "Extra Payment",
    ]);

    data.forEach((row) => {
      const date = `${(row.paymentDate.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${row.paymentDate.getFullYear()}`;
      rows.push([
        row.paymentNumber,
        date,
        (row.payment || 0).toFixed(2),
        (row.principalPayment || 0).toFixed(2),
        (row.interestPayment || 0).toFixed(2),
        (row.balance || 0).toFixed(2),
        row.phase || "",
        (row.extraPayment || 0).toFixed(2),
      ]);
    });
  } else {
    // Purchase/Refinance CSV structure
    rows.push([
      "Payment #",
      "Payment Date",
      "Payment Amount",
      "Principal",
      "Interest",
      "Balance",
      "Property Tax",
      "Insurance",
      "PMI",
      "HOA",
      "Extra Payment",
    ]);

    data.forEach((row) => {
      const date = `${(row.paymentDate.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${row.paymentDate.getFullYear()}`;
      rows.push([
        row.paymentNumber,
        date,
        row.payment.toFixed(2),
        row.principal.toFixed(2),
        row.interest.toFixed(2),
        row.balance.toFixed(2),
        (row.propertyTax || 0).toFixed(2),
        (row.insurance || 0).toFixed(2),
        (row.pmi || 0).toFixed(2),
        (row.hoa || 0).toFixed(2),
        (row.extraPayment || 0).toFixed(2),
      ]);
    });
  }

  // Generate CSV content
  let csvContent = "";
  rows.forEach((rowArray) => {
    const row = rowArray.join(",");
    csvContent += row + "\r\n";
  });

  // Generate default filename with date
  const now = new Date();
  const defaultFileName = `amortization_schedule_${now.getFullYear()}${(
    now.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}_${now
    .getHours()
    .toString()
    .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}.csv`;

  // Save file using Electron's dialog
  ipcRenderer
    .invoke("save-file", csvContent, defaultFileName)
    .then((savedFilePath) => {
      if (savedFilePath) {
        alert(`File saved as: ${savedFilePath}`);
      }
    })
    .catch((err) => {
      console.error("Error saving file:", err);
      alert("Error saving file. Please try again.");
    });
}

// Helper function to add letterhead logo to PDF pages (synchronous version)
function addLogoHeaderSync(doc, logoData, includeTitle = false) {
  let contentStartY = 15; // Default content start position

  if (logoData) {
    // Calculate proper aspect ratio for letterhead - max height 20, maintain aspect ratio
    const maxHeight = 20;
    const aspectRatio = logoData.width / logoData.height;
    const logoWidth = maxHeight * aspectRatio;

    // Center the logo horizontally
    const pageWidth = doc.internal.pageSize.width;
    const logoX = (pageWidth - logoWidth) / 2;

    doc.addImage(logoData.dataURL, "PNG", logoX, 8, logoWidth, maxHeight);
    contentStartY = 35; // Move content down to accommodate logo

    if (includeTitle) {
      // Add title centered below logo
      doc.setFontSize(22);
      doc.setTextColor(44, 62, 80); // #2c3e50
      doc.text("MortgagePros™ Report", pageWidth / 2, contentStartY, {
        align: "center",
      });
      contentStartY += 10;
    }
  }

  return contentStartY;
}

// Helper function to get logo as base64 data URL for PDF with dimensions
function getLogoDataURL() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = this.width;
      canvas.height = this.height;
      ctx.drawImage(this, 0, 0);
      resolve({
        dataURL: canvas.toDataURL("image/png"),
        width: this.width,
        height: this.height,
      });
    };
    img.onerror = function () {
      resolve(null); // Return null if logo can't be loaded
    };
    img.src = "../assets/logo.png";
  });
}

// Export amortization schedule to PDF
function exportToPDF() {
  // Resolve amortization data from current tab
  let tabData;
  if (currentTab === "purchase") {
    tabData = purchaseData;
  } else if (currentTab === "refinance") {
    tabData = refinanceData;
  } else if (currentTab === "heloc") {
    tabData = helocData;
  }

  const amortizationData = tabData?.amortizationData || [];
  if (!amortizationData.length) {
    showErrorMessage(`Please calculate ${currentTab.toUpperCase()} first.`);
    return;
  }

  // Generate default filename with date
  const now = new Date();
  const defaultFileName = `amortization_schedule_${now.getFullYear()}${(
    now.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}_${now
    .getHours()
    .toString()
    .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}.pdf`;

  // Ask user where to save the file
  ipcRenderer
    .invoke("save-pdf", defaultFileName)
    .then(async (savedFilePath) => {
      if (!savedFilePath) return; // User cancelled

      // Create PDF document
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Add logo if available
      const logoData = await getLogoDataURL();
      let titleX = 14;
      if (logoData) {
        // Calculate proper aspect ratio - max height 20, maintain aspect ratio
        const maxHeight = 20;
        const aspectRatio = logoData.width / logoData.height;
        const logoWidth = maxHeight * aspectRatio;
        doc.addImage(logoData.dataURL, "PNG", 14, 10, logoWidth, maxHeight);
        titleX = 14 + logoWidth + 5; // Position title after logo with some spacing
      }

      // Add title
      doc.setFontSize(18);
      doc.setTextColor(44, 62, 80); // #2c3e50
      doc.text("Mortgage Amortization Schedule", titleX, 20);

      // Add loan details
      doc.setFontSize(12);
      doc.text(
        `Loan Amount: $${document
          .getElementById("loanAmount")
          .textContent.replace(/[^0-9.]/g, "")}`,
        14,
        30
      );
      doc.text(
        `Monthly Payment: $${document
          .getElementById("monthlyPayment")
          .textContent.replace(/[^0-9.]/g, "")}`,
        14,
        38
      );
      // Pull tab-specific rate/term for header labels
      let headerRateElId = "interestRate";
      let headerTermElId = "loanTerm";
      if (currentTab === "refinance") {
        headerRateElId = "refinanceInterestRate";
        headerTermElId = "refinanceLoanTerm";
      } else if (currentTab === "heloc") {
        headerRateElId = "helocInterestRate";
        headerTermElId = "helocRepaymentPeriod";
      }
      doc.text(
        `Interest Rate: ${document.getElementById(headerRateElId).value}%`,
        14,
        46
      );
      doc.text(
        `Loan Term: ${document.getElementById(headerTermElId).value} years`,
        14,
        54
      );

      // Add table header
      doc.setFontSize(10);
      let y = 70;
      doc.text("Payment #", 14, y);
      doc.text("Date", 45, y);
      doc.text("Payment", 65, y);
      doc.text("Principal", 90, y);
      doc.text("Interest", 115, y);
      doc.text("Balance", 140, y);

      doc.line(14, y + 2, 180, y + 2);
      y += 10;

      // Add data rows (limit to 100 records per page)
      const recordsPerPage = 30;
      let pageCount = 1;

      for (let i = 0; i < amortizationData.length; i++) {
        const row = amortizationData[i];

        // Format data
        const date = `${
          row.paymentDate.getMonth() + 1
        }/${row.paymentDate.getFullYear()}`;
        const payment = row.payment.toFixed(2);
        const principal = row.principal.toFixed(2);
        const interest = row.interest.toFixed(2);
        const balance = row.balance.toFixed(2);

        // Check if we need a new page
        if (i > 0 && i % recordsPerPage === 0) {
          doc.addPage();
          pageCount++;
          y = 20;

          // Add header on new page
          doc.text("Payment #", 14, y);
          doc.text("Date", 45, y);
          doc.text("Payment", 65, y);
          doc.text("Principal", 90, y);
          doc.text("Interest", 115, y);
          doc.text("Balance", 140, y);

          doc.line(14, y + 2, 180, y + 2);
          y += 10;
        }

        // Add row data
        doc.text(row.paymentNumber.toString(), 14, y);
        doc.text(date, 45, y);
        doc.text("$" + payment, 65, y);
        doc.text("$" + principal, 90, y);
        doc.text("$" + interest, 115, y);
        doc.text("$" + balance, 140, y);

        y += 7;
      }

      // Add page numbers
      const totalPages = Math.ceil(amortizationData.length / recordsPerPage);
      for (let i = 0; i < totalPages; i++) {
        doc.setPage(i + 1);
        doc.setFontSize(8);
        doc.text(`Page ${i + 1} of ${totalPages}`, 170, 290);
      }

      // Use the binary file saving method instead of doc.save to avoid duplicate dialogs
      try {
        const blob = doc.output("blob");
        const reader = new FileReader();
        reader.onload = function () {
          // Extract the base64 data
          const base64data = reader.result.split(",")[1];

          // Send the base64 data to the main process to save
          ipcRenderer
            .invoke("save-binary-file", savedFilePath, base64data)
            .then(() => {
              // Show success message and ask to open file
              showConfirmDialog(
                `PDF exported successfully to: ${savedFilePath}\n\nWould you like to open the file now?`,
                () => {
                  // Open the file
                  ipcRenderer
                    .invoke("open-file", savedFilePath)
                    .catch((err) => {
                      console.error("Error opening file:", err);
                      showErrorMessage(
                        "File saved successfully, but could not open it automatically."
                      );
                    });
                },
                () => {
                  // Just show success message
                  showSuccessMessage(
                    `PDF exported successfully to: ${savedFilePath}`
                  );
                }
              );
            })
            .catch((err) => {
              console.error("Error saving file:", err);
              showErrorMessage("Error saving PDF. Please try again.");
            });
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error("Error saving PDF:", err);
        showErrorMessage("Error saving PDF. Please try again.");
      }
    })
    .catch((err) => {
      console.error("Error saving PDF:", err);
      showErrorMessage("Error saving PDF. Please try again.");
    });
}

// Export full mortgage report with summary and charts
async function exportFullReport() {
  // Get the current tab's data
  let tabData;
  if (currentTab === "purchase") {
    tabData = purchaseData;
  } else if (currentTab === "refinance") {
    tabData = refinanceData;
  } else if (currentTab === "heloc") {
    tabData = helocData;
  }

  if (!tabData.amortizationData || !tabData.amortizationData.length) {
    showErrorMessage(`Please calculate ${currentTab.toUpperCase()} first.`);
    return;
  }

  // Generate default filename with date and tab type
  const now = new Date();
  const defaultFileName = `${currentTab}_report_${now.getFullYear()}${(
    now.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}_${now
    .getHours()
    .toString()
    .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}.pdf`;

  try {
    // Create PDF document
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Use the current tab's amortization data
    const amortizationData = tabData.amortizationData;

    // Pre-load logo data for use throughout the PDF
    const logoData = await getLogoDataURL();

    // Add logo header with title
    let contentStartY = addLogoHeaderSync(doc, logoData, true);

    // Add current date centered below title
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const pageWidth = doc.internal.pageSize.width;
    doc.text(
      `Generated on: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      pageWidth / 2,
      contentStartY + 8,
      { align: "center" }
    );
    contentStartY += 18; // Account for date

    // Add summary section with appropriate title
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    const summaryTitle =
      currentTab === "heloc"
        ? "HELOC Summary"
        : currentTab === "refinance"
        ? "Refinance Summary"
        : "Purchase Summary";
    doc.text(summaryTitle, 14, contentStartY);

    // Add divider line
    doc.setDrawColor(52, 152, 219); // #3498db
    doc.setLineWidth(0.5);
    doc.line(14, contentStartY + 3, 196, contentStartY + 3);

    // Get values from the stored calculation results for the current tab
    const results = tabData.calculationResults;
    if (!results) {
      showErrorMessage("No calculation results found for current tab.");
      return;
    }

    let loanAmount,
      monthlyPI,
      monthlyPropertyTax,
      monthlyHomeInsurance,
      monthlyPMI,
      hoa,
      totalMonthlyPayment,
      totalInterest,
      totalCost,
      loanToValueRatio,
      loanTerm,
      extraPayment,
      currentAmortizationData;

    if (currentTab === "heloc") {
      // HELOC data structure: [interestOnlyPayment, principalInterestPayment, helocAmount, totalInterest, propertyValue, outstandingBalance, ltv, 'heloc']
      const [
        interestOnlyPayment,
        principalInterestPayment,
        helocAmount,
        helocTotalInterest,
        propertyValue,
        outstandingBalance,
        ltv,
      ] = results;
      loanAmount = helocAmount;
      monthlyPI = principalInterestPayment;
      totalInterest = helocTotalInterest;
      totalMonthlyPayment = interestOnlyPayment; // During interest-only period
      totalCost = helocAmount + helocTotalInterest;
      loanToValueRatio = ltv;
      // Set unused values to 0 for HELOC
      monthlyPropertyTax = 0;
      monthlyHomeInsurance = 0;
      monthlyPMI = 0;
      hoa = 0;
      extraPayment = 0;
    } else {
      // Regular mortgage data structure
      [
        loanAmount,
        monthlyPI,
        monthlyPropertyTax,
        monthlyHomeInsurance,
        monthlyPMI,
        hoa,
        totalMonthlyPayment,
        totalInterest,
        totalCost,
        loanToValueRatio,
        loanTerm,
        extraPayment,
        currentAmortizationData,
      ] = results;
    }

    // Get the correct form values for this tab
    let interestRateValue, loanTermValue;
    if (currentTab === "heloc") {
      interestRateValue = document.getElementById("helocInterestRate").value;
      loanTermValue = document.getElementById("helocRepaymentPeriod").value;
    } else if (currentTab === "refinance") {
      interestRateValue = document.getElementById(
        "refinanceInterestRate"
      ).value;
      loanTermValue = document.getElementById("refinanceLoanTerm").value;
    } else {
      interestRateValue = document.getElementById("interestRate").value;
      loanTermValue = document.getElementById("loanTerm").value;
    }

    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);
    let y = contentStartY + 13;

    // Add property/appraised value based on tab type
    if (currentTab === "heloc") {
      const propertyValue = document.getElementById("helocPropertyValue").value;
      const outstandingBalance = document.getElementById(
        "helocOutstandingBalance"
      ).value;
      doc.text(
        `Property Value: $${parseFloat(propertyValue || 0).toLocaleString()}`,
        14,
        y
      );
      y += 8;
      doc.text(
        `Outstanding Balance: $${parseFloat(
          outstandingBalance || 0
        ).toLocaleString()}`,
        14,
        y
      );
    } else if (currentTab === "refinance") {
      const appraisedValue = document.getElementById("appraisedValue").value;
      doc.text(
        `Appraised Value: $${parseFloat(appraisedValue || 0).toLocaleString()}`,
        14,
        y
      );
    } else {
      const propertyValue = document.getElementById("propertyValue").value;
      doc.text(
        `Property Value: $${parseFloat(propertyValue || 0).toLocaleString()}`,
        14,
        y
      );
    }
    y += 8;

    if (currentTab === "heloc") {
      doc.text(`HELOC Amount: $${loanAmount.toLocaleString()}`, 14, y);
      y += 8;
      doc.text(
        `Interest-Only Payment: $${totalMonthlyPayment.toLocaleString()}`,
        14,
        y
      );
      y += 8;
      doc.text(`Interest Rate: ${interestRateValue}%`, 14, y);
      y += 8;
      const interestOnlyPeriod = document.getElementById(
        "helocInterestOnlyPeriod"
      ).value;
      doc.text(`Interest-Only Period: ${interestOnlyPeriod} years`, 14, y);
      y += 8;
      doc.text(`Total Loan Term: ${loanTermValue} years`, 14, y);
      y += 8;
      doc.text(
        `Principal & Interest Payment: $${monthlyPI.toLocaleString()}`,
        14,
        y
      );
      y += 8;
      doc.text(`Total Interest: $${totalInterest.toLocaleString()}`, 14, y);
      y += 8;
      doc.text(`Total of Payments: $${totalCost.toLocaleString()}`, 14, y);
      y += 8;
      doc.text(`Combined LTV: ${loanToValueRatio.toFixed(2)}%`, 14, y);
    } else {
      doc.text(`Loan Amount: $${loanAmount.toLocaleString()}`, 14, y);
      y += 8;
      doc.text(
        `Monthly Payment: $${totalMonthlyPayment.toLocaleString()}`,
        14,
        y
      );
      y += 8;
      doc.text(`Interest Rate: ${interestRateValue}%`, 14, y);
      y += 8;
      doc.text(`Loan Term: ${loanTermValue} years`, 14, y);
      y += 8;
      doc.text(`Total Interest: $${totalInterest.toLocaleString()}`, 14, y);
      y += 8;
      doc.text(`Total of Payments: $${totalCost.toLocaleString()}`, 14, y);
      y += 8;
      // Add LTV (Month 1) line for purchase/refinance
      doc.text(`LTV (Month 1): ${loanToValueRatio.toFixed(2)}%`, 14, y);
      y += 8;
      // Short PMI termination note (reflect selected rule)
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      let pmiRuleText = "80%";
      try {
        if (currentTab === "refinance") {
          const sel = document.getElementById("refinancePmiEndRule");
          if (sel) pmiRuleText = `${parseFloat(sel.value) || 80}%`;
        } else {
          const sel = document.getElementById("pmiEndRule");
          if (sel) pmiRuleText = `${parseFloat(sel.value) || 80}%`;
        }
      } catch (e) {
        pmiRuleText = "80%";
      }
      doc.text(`PMI drops at ${pmiRuleText} LTV`, 14, y);
      y += 8;
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      // Add PMI drop information if available
      try {
        if (Array.isArray(amortizationData) && amortizationData.length > 0) {
          let sawPmi = false;
          let dropIndex = -1;
          for (let i = 0; i < amortizationData.length; i++) {
            const r = amortizationData[i];
            if ((r.pmi || 0) > 0) sawPmi = true;
            if (sawPmi && (!r.pmi || r.pmi === 0)) {
              dropIndex = i;
              break;
            }
          }
          if (sawPmi) {
            if (dropIndex >= 0) {
              const dropDate = amortizationData[dropIndex].paymentDate;
              const dateText = dropDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
              });
              doc.text(
                `PMI Ends: ${dateText} (Payment #${dropIndex + 1})`,
                14,
                y
              );
            } else {
              doc.text("PMI Ends: Never (PMI lasts full term)", 14, y);
            }
          }
        }
      } catch (e) {
        // noop if schedule not available
      }

      // For refinance, add Closing Costs & Points details
      if (currentTab === "refinance" && tabData && tabData.refinanceCosts) {
        // Ensure there's room; otherwise, add a new page
        if (y + 36 > 280) {
          doc.addPage();
          y = 20;
        } else {
          y += 8;
        }
        const rc = tabData.refinanceCosts;
        const modeText = rc.financeCosts
          ? "Included in Loan"
          : "Due at Closing";
        const modeAmount = rc.financeCosts
          ? rc.financedCosts || 0
          : rc.dueAtClosing || 0;

        doc.setFontSize(14);
        doc.text("Closing Costs, Points & Cash-Out", 14, y);
        y += 8;
        doc.setFontSize(12);
        doc.text(`Handling: ${modeText}`, 14, y);
        y += 8;
        doc.text(
          `Closing Costs: $${(rc.closingCosts || 0).toLocaleString()}`,
          14,
          y
        );
        y += 8;
        doc.text(
          `Points: ${(rc.pointsPercent || 0).toFixed(2)}% = $${(
            rc.pointsAmount || 0
          ).toLocaleString()}`,
          14,
          y
        );
        y += 8;
        doc.text(
          `Cash-Out Amount: $${(rc.cashOutAmount || 0).toLocaleString()}`,
          14,
          y
        );
        y += 8;
        doc.text(
          `${
            rc.financeCosts ? "Amount Added to Loan" : "Amount Due at Closing"
          }: $${(modeAmount || 0).toLocaleString()}`,
          14,
          y
        );
        // Show base vs adjusted principal if available
        if (
          typeof rc.baseLoanAmount !== "undefined" &&
          typeof rc.adjustedLoanAmount !== "undefined"
        ) {
          y += 8;
          doc.text(
            `Base Loan Amount: $${(rc.baseLoanAmount || 0).toLocaleString()}`,
            14,
            y
          );
          y += 8;
          doc.text(
            `Adjusted Loan Amount: $${(
              rc.adjustedLoanAmount || 0
            ).toLocaleString()}`,
            14,
            y
          );
        }
      }
    }

    // Add payment breakdown section
    y += 20;
    doc.setFontSize(16);

    if (currentTab === "heloc") {
      doc.text("HELOC Payment Structure", 14, y);
      y += 3;
      doc.line(14, y, 196, y);
      y += 15;

      doc.setFontSize(12);
      const interestOnlyPeriod = document.getElementById(
        "helocInterestOnlyPeriod"
      ).value;
      const repaymentPeriod = document.getElementById(
        "helocRepaymentPeriod"
      ).value;

      doc.text(
        `Phase 1 (Years 1-${interestOnlyPeriod}): Interest-Only Payments`,
        14,
        y
      );
      y += 8;
      doc.text(
        `  Monthly Payment: $${totalMonthlyPayment.toLocaleString()}`,
        14,
        y
      );
      y += 12;
      doc.text(
        `Phase 2 (Years ${
          parseInt(interestOnlyPeriod) + 1
        }-${repaymentPeriod}): Principal & Interest`,
        14,
        y
      );
      y += 8;
      doc.text(`  Monthly Payment: $${monthlyPI.toLocaleString()}`, 14, y);
    } else {
      doc.text("Payment Breakdown", 14, y);
      y += 3;
      doc.line(14, y, 196, y);
      y += 15;

      // Calculate payment breakdown values directly from form inputs for current tab
      let propertyTaxValue, homeInsuranceValue, pmiValue, hoaValue;

      if (currentTab === "refinance") {
        // Get values from refinance form inputs
        const refinancePropertyTax = parseFloat(
          document.getElementById("refinancePropertyTax").value || 0
        );
        const refinanceHomeInsurance = parseFloat(
          document.getElementById("refinanceHomeInsurance").value || 0
        );
        const refinancePmiAmount = parseFloat(
          document.getElementById("refinancePmiAmount").value || 0
        );
        const refinancePmiToggle =
          document.getElementById("refinancePmiToggle").checked;

        // Calculate monthly values
        propertyTaxValue = `$${refinancePropertyTax.toLocaleString()}`;
        homeInsuranceValue = `$${refinanceHomeInsurance.toLocaleString()}`;

        // PMI calculation based on toggle (monthly vs annual dollar amount)
        if (refinancePmiToggle) {
          // Annual PMI amount (dollars) - convert to monthly
          pmiValue = `$${(refinancePmiAmount / 12).toLocaleString()}`;
        } else {
          // Monthly PMI amount (dollars)
          pmiValue = `$${refinancePmiAmount.toLocaleString()}`;
        }

        // No HOA field in refinance, set to 0
        hoaValue = "$0";
      } else {
        // Purchase tab - get values from purchase form inputs
        const propertyValue = parseFloat(
          document.getElementById("propertyValue").value || 0
        );
        const propertyTaxRate = parseFloat(
          document.getElementById("propertyTax").value || 0
        );
        const homeInsurance = parseFloat(
          document.getElementById("homeInsurance").value || 0
        );
        const pmiRate = parseFloat(
          document.getElementById("pmiRate").value || 0
        );
        const hoaMonthly = parseFloat(
          document.getElementById("hoa").value || 0
        );

        // Calculate monthly values
        propertyTaxValue = `$${propertyTaxRate.toLocaleString()}`;
        homeInsuranceValue = `$${homeInsurance.toLocaleString()}`;
        pmiValue = `$${((loanAmount * pmiRate) / 100 / 12).toLocaleString()}`;
        hoaValue = `$${hoaMonthly.toLocaleString()}`;
      }

      doc.setFontSize(12);
      doc.text(`Principal & Interest: $${monthlyPI.toLocaleString()}`, 14, y);
      y += 8;
      doc.text(`Property Tax: ${propertyTaxValue}`, 14, y);
      y += 8;
      doc.text(`Home Insurance: ${homeInsuranceValue}`, 14, y);
      y += 8;
      doc.text(`PMI: ${pmiValue}`, 14, y);
      y += 8;
      // For refinance, add PMI mode note (monthly vs annual/12)
      if (currentTab === "refinance") {
        const refinancePmiToggle =
          document.getElementById("refinancePmiToggle").checked;
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `PMI Mode: ${
            refinancePmiToggle ? "Annual amount ÷ 12" : "Monthly amount"
          }`,
          14,
          y
        );
        y += 8;
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
      }

      // Only show HOA for Purchase tab
      if (currentTab === "purchase") {
        doc.text(`HOA: ${hoaValue}`, 14, y);
        y += 8;
      }
    }

    // Add Extra Payment Savings section if applicable (not for HELOC)
    if (
      currentTab !== "heloc" &&
      extraPayment > 0 &&
      amortizationData.length > 0
    ) {
      const actualPayments = amortizationData.length;
      const originalPayments = loanTerm * 12;
      const monthsSaved = originalPayments - actualPayments;
      const yearsSaved = Math.floor(monthsSaved / 12);
      const remainingMonths = monthsSaved % 12;

      // Calculate interest saved (compare to original schedule without extra payments)
      const originalTotalInterest = monthlyPI * originalPayments - loanAmount;
      const interestSaved = originalTotalInterest - totalInterest;

      // Calculate PMI savings by comparing schedules (with extra vs no extra)
      let pmiSavingsAmount = 0;
      let pmiMonthsEarlier = 0;
      try {
        // Determine inputs for schedule generation
        const rateNum = parseFloat(interestRateValue || 0);
        const monthlyRate = isNaN(rateNum) ? 0 : rateNum / 100 / 12;
        const nper = loanTerm * 12;

        // For refinance, pass appraised value and flag; otherwise not required
        let appraisedVal = 0;
        const isRefi = currentTab === "refinance";
        if (isRefi) {
          const appraisedEl = document.getElementById("appraisedValue");
          appraisedVal =
            parseFloat(
              (appraisedEl?.value || 0).toString().replace(/,/g, "")
            ) || 0;
        }

        // Generate a baseline schedule WITHOUT extra payments
        let noExtraSchedule;
        if (isRefi) {
          noExtraSchedule = generateAmortizationSchedule(
            loanAmount,
            monthlyRate,
            nper,
            monthlyPropertyTax,
            monthlyHomeInsurance,
            monthlyPMI,
            hoa,
            0, // no extra
            appraisedVal,
            isRefi
          );
        } else {
          // Purchase: derive a no-extra snapshot using existing purchase schedule snapshot logic
          const purchaseBaseline = [];
          let balance = loanAmount;
          for (let i = 1; i <= nper && balance > 0.01; i++) {
            const monthlyRateEff = monthlyRate;
            let interestPortion =
              monthlyRateEff === 0 ? 0 : balance * monthlyRateEff;
            let principalPortion =
              monthlyRateEff === 0
                ? balance / (nper - i + 1)
                : monthlyPI - interestPortion;
            if (principalPortion > balance) principalPortion = balance;
            // PMI replicate baseline rule (monthlyPMI already reflects current user input; if PMI ends earlier with extra, baseline may pay PMI longer)
            // Simpler: reuse existing amortizationData row PMI if available index, else approximate using monthlyPMI heuristic.
            let pmi = 0;
            if (monthlyPMI > 0) {
              // rough LTV based drop: assume threshold pmiEndThresholdLtv and original property value = loanAmount / (1 - downPaymentPercent)
              // We lack down payment percent in this isolated block; safe fallback: if current amortizationData row had PMI >0 at i-1 use it.
              if (amortizationData[i - 1] && amortizationData[i - 1].pmi > 0) {
                pmi = amortizationData[i - 1].pmi; // mirror actual charged PMI for month index
              }
            }
            balance = round2(balance - principalPortion);
            const totalPayment = round2(
              principalPortion +
                interestPortion +
                monthlyPropertyTax +
                monthlyHomeInsurance +
                pmi +
                hoa
            );
            purchaseBaseline.push({
              paymentNumber: i,
              paymentDate: new Date(),
              payment: totalPayment,
              principal: principalPortion,
              interest: interestPortion,
              balance: balance < 0 ? 0 : balance,
              propertyTax: monthlyPropertyTax,
              insurance: monthlyHomeInsurance,
              pmi: pmi,
              hoa: hoa,
              extraPayment: 0,
            });
            if (balance <= 0) break;
          }
          noExtraSchedule = purchaseBaseline;
        }

        // Helper to sum PMI and find drop index
        const sumPMI = (sched) => sched.reduce((s, r) => s + (r.pmi || 0), 0);
        const findDropIndex = (sched) => {
          let sawPmi = false;
          for (let i = 0; i < sched.length; i++) {
            const p = sched[i].pmi || 0;
            if (p > 0) sawPmi = true;
            if (sawPmi && p === 0) return i; // first zero after any positive PMI
          }
          return -1;
        };

        const pmiWithExtra = sumPMI(amortizationData);
        const pmiNoExtra = sumPMI(noExtraSchedule);
        pmiSavingsAmount = Math.max(0, pmiNoExtra - pmiWithExtra);

        const dropWithExtra = findDropIndex(amortizationData);
        const dropNoExtra = findDropIndex(noExtraSchedule);
        if (dropWithExtra >= 0 && dropNoExtra >= 0) {
          pmiMonthsEarlier = Math.max(0, dropNoExtra - dropWithExtra);
        }
      } catch (e) {
        console.warn("PMI savings calc skipped:", e);
      }

      // Calculate total height needed for entire section including the box
      const sectionHeight = 86; // Increased to accommodate PMI savings lines

      // Check if entire section fits on current page, if not start new page
      if (y + sectionHeight > 280) {
        doc.addPage();
        y = 20;
      } else {
        y += 15; // Reduced spacing from previous section
      }

      // Section title
      doc.setFontSize(16);
      doc.setTextColor(220, 53, 69); // Red color for emphasis
      doc.text("Extra Payment Savings", 14, y);

      // Add underline
      y += 3;
      doc.setDrawColor(220, 53, 69);
      doc.setLineWidth(0.5);
      doc.line(14, y, 120, y); // Shorter line to match text width

      y += 10; // Reduced spacing after title
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80); // Dark text color

      // Time savings
      let timeSavingsText = "Payoff Time Reduced: ";
      if (yearsSaved > 0) {
        timeSavingsText += `${yearsSaved} year${yearsSaved > 1 ? "s" : ""}`;
        if (remainingMonths > 0) {
          timeSavingsText += ` and ${remainingMonths} month${
            remainingMonths > 1 ? "s" : ""
          }`;
        }
      } else if (remainingMonths > 0) {
        timeSavingsText += `${remainingMonths} month${
          remainingMonths > 1 ? "s" : ""
        }`;
      }

      doc.text(timeSavingsText, 14, y);
      y += 8; // Reduced line spacing

      // Interest savings
      doc.text(`Interest Savings: $${interestSaved.toLocaleString()}`, 14, y);
      y += 8; // Reduced line spacing

      // PMI savings (if any)
      if (pmiSavingsAmount > 0 || pmiMonthsEarlier > 0) {
        doc.text(`PMI Savings: $${pmiSavingsAmount.toLocaleString()}`, 14, y);
        y += 8;
        if (pmiMonthsEarlier > 0) {
          doc.text(
            `PMI Drop Moved Up: ${pmiMonthsEarlier} month${
              pmiMonthsEarlier !== 1 ? "s" : ""
            }`,
            14,
            y
          );
          y += 8;
        }
      }

      // Extra payment amount for reference
      doc.text(
        `Monthly Extra Payment: $${extraPayment.toLocaleString()}`,
        14,
        y
      );
      y += 12; // Reduced spacing before box

      // Create a clean highlighted box (no page break check since we pre-calculated)
      const boxHeight = 18;
      const boxWidth = 175;

      doc.setFillColor(255, 248, 225); // Light yellow background
      doc.setDrawColor(255, 193, 7); // Yellow border
      doc.setLineWidth(1);
      doc.roundedRect(14, y, boxWidth, boxHeight, 3, 3, "FD");

      // Add benefit text inside the box
      doc.setFontSize(12);
      doc.setTextColor(133, 100, 4); // Dark yellow text
      doc.text(
        "KEY BENEFIT: Pay off your mortgage earlier and save thousands!",
        20,
        y + 12
      );
    }

    // Add new page for amortization schedule
    doc.addPage();
    y = 20;

    // Add amortization schedule header on new page
    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    const scheduleTitle =
      currentTab === "heloc"
        ? "Complete HELOC Payment Schedule"
        : "Complete Amortization Schedule";
    doc.text(scheduleTitle, 14, y);
    y += 5;
    doc.line(14, y, 196, y);
    y += 20;

    // Add table headers
    doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
    doc.text("Payment #", 14, y);
    doc.text("Date", 30, y);
    doc.text("Payment", 55, y);
    doc.text("Principal", 80, y);
    doc.text("Interest", 105, y);
    doc.text("Balance", 130, y);
    if (currentTab === "heloc") {
      doc.text("Phase", 155, y);
      doc.text("Extra", 175, y);
      doc.line(14, y + 2, 190, y + 2);
    } else {
      doc.text("Extra", 155, y);
      doc.line(14, y + 2, 185, y + 2);
    }
    y += 10;

    // Add all amortization payments with pagination
    const recordsPerPage = 35; // More records per page for schedule
    let currentPage = 2; // Starting from page 2 (first page was summary)

    for (let i = 0; i < amortizationData.length; i++) {
      const row = amortizationData[i];

      // Check if we need a new page
      if (i > 0 && i % recordsPerPage === 0) {
        // Add page number to current page
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${currentPage} of ${
            Math.ceil(amortizationData.length / recordsPerPage) + 1
          }`,
          170,
          290
        );

        doc.addPage();
        currentPage++;
        y = 20;

        // Add header on new page
        doc.setFontSize(16);
        doc.setTextColor(44, 62, 80);
        doc.text("Amortization Schedule (continued)", 14, y);
        y += 10;

        doc.setFontSize(10);
        doc.text("Payment #", 14, y);
        doc.text("Date", 35, y);
        doc.text("Payment", 60, y);
        doc.text("Principal", 85, y);
        doc.text("Interest", 110, y);
        doc.text("Balance", 140, y);

        doc.line(14, y + 2, 175, y + 2);
        y += 10;
      }

      // Format data
      const date = `${(row.paymentDate.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${row.paymentDate.getFullYear()}`;

      // Add row data with proper formatting
      doc.setFontSize(9);
      doc.setTextColor(44, 62, 80);
      doc.text(row.paymentNumber.toString(), 14, y);
      doc.text(date, 30, y);
      doc.text("$" + row.payment.toFixed(2), 55, y);

      if (currentTab === "heloc") {
        // HELOC has different data structure
        doc.text("$" + (row.principalPayment || 0).toFixed(2), 80, y);
        doc.text("$" + row.interestPayment.toFixed(2), 105, y);
        doc.text("$" + row.balance.toFixed(2), 130, y);
        doc.text(row.phase || "", 155, y);
        doc.text("$" + (row.extraPayment || 0).toFixed(2), 175, y);
      } else {
        // Regular mortgage structure
        doc.text("$" + row.principal.toFixed(2), 80, y);
        doc.text("$" + row.interest.toFixed(2), 105, y);
        doc.text("$" + row.balance.toFixed(2), 130, y);
        doc.text("$" + (row.extraPayment || 0).toFixed(2), 155, y);
      }

      y += 6;

      // Handle page overflow within a page
      if (y > 275) {
        // Add page number to current page
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${currentPage} of ${
            Math.ceil(amortizationData.length / recordsPerPage) + 1
          }`,
          170,
          290
        );

        doc.addPage();
        currentPage++;
        y = 20;

        // Add header on new page
        doc.setFontSize(16);
        doc.setTextColor(44, 62, 80);
        doc.text("Amortization Schedule (continued)", 14, y);
        y += 10;

        doc.setFontSize(10);
        doc.text("Payment #", 14, y);
        doc.text("Date", 30, y);
        doc.text("Payment", 55, y);
        doc.text("Principal", 80, y);
        doc.text("Interest", 105, y);
        doc.text("Balance", 130, y);
        if (currentTab === "heloc") {
          doc.text("Phase", 155, y);
          doc.text("Extra", 175, y);
          doc.line(14, y + 2, 190, y + 2);
        } else {
          doc.text("Extra", 155, y);
          doc.line(14, y + 2, 185, y + 2);
        }
        y += 10;
      }
    }

    // Add page numbers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 0; i < totalPages; i++) {
      doc.setPage(i + 1);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      if (i === 0) {
        doc.text(`Page 1 of ${totalPages}`, 170, 290);
      } else {
        // Page numbers for schedule pages are already added above
      }
    }

    // Ask user where to save the file
    const savedFilePath = await ipcRenderer.invoke("save-pdf", defaultFileName);
    if (!savedFilePath) return; // User cancelled

    // Save the PDF
    const blob = doc.output("blob");
    const reader = new FileReader();
    reader.onload = function () {
      const base64data = reader.result.split(",")[1];

      ipcRenderer
        .invoke("save-binary-file", savedFilePath, base64data)
        .then(() => {
          // Show success message and ask to open file
          showConfirmDialog(
            `PDF report exported successfully to: ${savedFilePath}\n\nWould you like to open the file now?`,
            () => {
              ipcRenderer.invoke("open-file", savedFilePath).catch((err) => {
                console.error("Error opening file:", err);
                showErrorMessage(
                  "File saved successfully, but could not open it automatically."
                );
              });
            },
            () => {
              showSuccessMessage(
                `PDF report exported successfully to: ${savedFilePath}`
              );
            }
          );
        })
        .catch((err) => {
          console.error("Error saving file:", err);
          showErrorMessage("Error saving PDF report. Please try again.");
        });
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error("Error generating PDF report:", error);
    showErrorMessage("Error generating PDF report. Please try again.");
  }

  return; // Exit here to avoid executing old code below

  // Ask user where to save the file (this code won't execute due to return above)
  ipcRenderer
    .invoke("save-pdf", defaultFileName)
    .then(async (savedFilePath) => {
      if (!savedFilePath) return; // User cancelled

      // Create PDF document
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Add logo if available
      const logoData = await getLogoDataURL();
      if (logoData) {
        // Calculate proper aspect ratio - max height 20, maintain aspect ratio
        const maxHeight = 20;
        const aspectRatio = logoData.width / logoData.height;
        const logoWidth = maxHeight * aspectRatio;
        doc.addImage(logoData.dataURL, "PNG", 14, 10, logoWidth, maxHeight);
      }

      // Add title and logo
      doc.setFontSize(22);
      doc.setTextColor(44, 62, 80); // #2c3e50
      doc.text("MortgagePros™ Report", 105, 20, { align: "center" });

      // Add current date
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Generated on: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
        105,
        30,
        { align: "center" }
      );

      // Add mortgage summary section
      doc.setFontSize(16);
      doc.setTextColor(44, 62, 80);
      doc.text("Mortgage Summary", 14, 45);

      // Add divider line
      doc.setDrawColor(52, 152, 219); // #3498db
      doc.setLineWidth(0.5);
      doc.line(14, 48, 196, 48);

      // Format values
      const propertyValue = parseFloat(
        document.getElementById("propertyValue").value
      );
      const downPaymentAmount = parseFloat(
        document.getElementById("downPaymentAmount").value
      );
      const loanAmount = propertyValue - downPaymentAmount;
      const loanTerm = parseInt(document.getElementById("loanTerm").value);
      const interestRate = parseFloat(
        document.getElementById("interestRate").value
      );
      const monthlyPayment =
        document.getElementById("monthlyPayment").textContent;
      const totalInterest =
        document.getElementById("totalInterest").textContent;
      const totalCost = document.getElementById("totalCost").textContent;

      // Add summary data in two columns
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);

      // Left column
      let y = 60;
      doc.text("Property Value:", 14, y);
      doc.text(`$${propertyValue.toLocaleString()}`, 70, y);
      y += 8;

      doc.text("Down Payment:", 14, y);
      doc.text(
        `$${downPaymentAmount.toLocaleString()} (${(
          (downPaymentAmount / propertyValue) *
          100
        ).toFixed(2)}%)`,
        70,
        y
      );
      y += 8;

      doc.text("Loan Amount:", 14, y);
      doc.text(`$${loanAmount.toLocaleString()}`, 70, y);
      y += 8;

      doc.text("Loan Term:", 14, y);
      doc.text(`${loanTerm} years`, 70, y);
      y += 8;

      doc.text("Interest Rate:", 14, y);
      doc.text(`${interestRate}%`, 70, y);
      y += 8;

      // Right column
      y = 60;
      doc.text("Monthly Payment:", 120, y);
      doc.text(monthlyPayment, 180, y);
      y += 8;

      doc.text("Principal & Interest:", 120, y);
      doc.text(
        document.getElementById("principalInterest").textContent,
        180,
        y
      );
      y += 8;

      doc.text("Taxes & Insurance:", 120, y);
      const taxesInsurance =
        parseFloat(
          document
            .getElementById("propertyTaxAmount")
            .textContent.replace(/[^0-9.-]+/g, "")
        ) +
        parseFloat(
          document
            .getElementById("insuranceAmount")
            .textContent.replace(/[^0-9.-]+/g, "")
        );
      doc.text(`$${taxesInsurance.toFixed(2)}`, 180, y);
      y += 8;

      doc.text("PMI:", 120, y);
      doc.text(document.getElementById("pmiAmount").textContent, 180, y);
      y += 8;

      doc.text("HOA/Other:", 120, y);
      doc.text(document.getElementById("hoaAmount").textContent, 180, y);
      y += 20;

      // Calculate totals for schedule summary
      let totalInterestPaidSummary = 0;
      let totalPrincipalPaidSummary = 0;
      if (amortizationData.length > 0) {
        amortizationData.forEach((payment) => {
          totalInterestPaidSummary += payment.interest;
          totalPrincipalPaidSummary += payment.principal;
        });
      }

      // Add Schedule Summary on first page
      doc.setFontSize(16);
      doc.setTextColor(44, 62, 80);
      doc.text("Schedule Summary", 14, y);
      y += 3;

      doc.setDrawColor(52, 152, 219);
      doc.setLineWidth(0.5);
      doc.line(14, y, 196, y);
      y += 15;

      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Payments: ${amortizationData.length} payments`, 14, y);
      y += 8;
      doc.text(
        `Total Amount Paid: $${(
          totalInterestPaidSummary + totalPrincipalPaidSummary
        ).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        14,
        y
      );
      y += 8;
      doc.text(
        `Total Principal: $${totalPrincipalPaidSummary.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        14,
        y
      );
      y += 8;
      doc.text(
        `Total Interest: $${totalInterestPaidSummary.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        14,
        y
      );
      y += 8;
      doc.text(
        `Interest as % of Total: ${(
          (totalInterestPaidSummary /
            (totalInterestPaidSummary + totalPrincipalPaidSummary)) *
          100
        ).toFixed(2)}%`,
        14,
        y
      );
      y += 15;

      // Create canvas elements for charts that will be added to PDF
      const canvases = [];

      // Pie chart removed per user request - proceeding directly to amortization charts

      // Wait for rendering, then add amortization charts to PDF
      setTimeout(() => {
        // Create amortization chart
        const amortizationCanvas = document.createElement("canvas");
        amortizationCanvas.width = 700; // Larger width
        amortizationCanvas.height = 350; // Larger height
        amortizationCanvas.style.display = "none"; // Hide it from view
        document.body.appendChild(amortizationCanvas);
        const amortizationCtx = amortizationCanvas.getContext("2d");

        // Add new page for more charts
        doc.addPage();
        y = 20;

        doc.setFontSize(16);
        doc.text("Loan Balance Over Time", 105, y, { align: "center" });
        y += 10;

        // Sample data for balance chart
        const years = [];
        const balanceData = [];

        // Sample every 12 months (yearly) for the chart
        for (let i = 0; i < amortizationData.length; i += 12) {
          const payment = amortizationData[i];
          const yearNumber = Math.floor(i / 12) + 1;
          years.push(`Year ${yearNumber}`);
          balanceData.push(payment.balance);
        }

        // Create balance chart with fixed dimensions
        const balanceChart = new Chart(amortizationCtx, {
          type: "line",
          data: {
            labels: years,
            datasets: [
              {
                label: "Loan Balance",
                data: balanceData,
                backgroundColor: "rgba(46, 204, 113, 0.2)",
                borderColor: "rgba(46, 204, 113, 1)",
                borderWidth: 2,
                fill: true,
              },
            ],
          },
          options: {
            responsive: false, // Disable responsiveness
            maintainAspectRatio: false, // Don't maintain aspect ratio
            plugins: {
              legend: { display: true },
              title: {
                display: true,
                text: "Loan Balance Over Time",
                font: {
                  size: 16,
                  weight: "bold",
                },
              },
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: "Year",
                },
                ticks: {
                  font: {
                    size: 12,
                  },
                },
              },
              y: {
                title: {
                  display: true,
                  text: "Balance ($)",
                },
                ticks: {
                  callback: function (value) {
                    return "$" + value.toLocaleString();
                  },
                  font: {
                    size: 12,
                  },
                },
              },
            },
          },
        });

        // Add chart to PDF after rendering
        setTimeout(() => {
          const amortizationImg = amortizationCanvas.toDataURL("image/png");
          doc.addImage(amortizationImg, "PNG", 15, y, 180, 90);
          y += 100;

          // Add full amortization schedule
          doc.addPage(); // Start amortization schedule on a new page

          // Add logo header to amortization schedule page
          y = addLogoHeaderSync(doc, logoData, false);

          doc.setFontSize(18);
          doc.setTextColor(44, 62, 80);
          doc.text("Complete Amortization Schedule", 105, y, {
            align: "center",
          });
          y += 15;

          // Function to add table header
          function addTableHeader() {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            // Adjusted positions to include Extra column
            doc.text("Pmt #", 14, y);
            doc.text("Date", 26, y);
            doc.text("Payment", 44, y);
            doc.text("Principal", 62, y);
            doc.text("Interest", 80, y);
            doc.text("Balance", 100, y);
            doc.text("Extra", 118, y);
            doc.text("Cum. Int.", 140, y);
            doc.text("Cum. Prin.", 162, y);

            // Add horizontal line
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            doc.line(14, y + 2, 196, y + 2);
            y += 7;
          }

          // Add initial header
          addTableHeader();

          // Display all rows
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(8);
          let totalInterestPaid = 0;
          let totalPrincipalPaid = 0;
          const rowsPerPage = 35; // More rows per page with smaller font
          let rowCount = 0;

          for (let i = 0; i < amortizationData.length; i++) {
            const row = amortizationData[i];
            totalInterestPaid += row.interest;
            totalPrincipalPaid += row.principal;

            const date = `${(row.paymentDate.getMonth() + 1)
              .toString()
              .padStart(2, "0")}/${row.paymentDate.getFullYear()}`;

            // Use fixed-width positioning for better alignment
            doc.text(row.paymentNumber.toString(), 14, y, { align: "left" });
            doc.text(date, 26, y, { align: "left" });
            doc.text(
              "$" +
                row.payment.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              44,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                row.principal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              62,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                row.interest.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              80,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                row.balance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              100,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                (row.extraPayment || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              118,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                totalInterestPaid.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              140,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                totalPrincipalPaid.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              162,
              y,
              { align: "left" }
            );

            y += 5.5; // Tighter spacing
            rowCount++;

            // Check if we need a new page
            if (rowCount >= rowsPerPage && i < amortizationData.length - 1) {
              doc.addPage();

              // Add logo header to continuation page
              y = addLogoHeaderSync(doc, logoData, false);

              // Add page title
              doc.setFontSize(14);
              doc.setTextColor(44, 62, 80);
              doc.text("Amortization Schedule (continued)", 105, y, {
                align: "center",
              });
              y += 10;

              // Add header again
              addTableHeader();
              rowCount = 0;
            }
          }

          // Add footer to all pages
          const pageCount = doc.internal.getNumberOfPages();
          for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
              "MortgagePros™ Calculator | Page " + i + " of " + pageCount,
              105,
              290,
              { align: "center" }
            );
          }

          // Clean up temporary canvases
          document.body.removeChild(amortizationCanvas);

          try {
            // Save the PDF directly to the file path instead of opening a dialog
            // This uses the filePath from the earlier dialog
            const blob = doc.output("blob");
            const buffer = new Uint8Array(blob);

            // Use FileReader to convert blob to base64
            const reader = new FileReader();
            reader.onload = function () {
              // Extract the base64 data
              const base64data = reader.result.split(",")[1];

              // Send the base64 data to the main process to save
              ipcRenderer
                .invoke("save-binary-file", savedFilePath, base64data)
                .then(() => {
                  alert(`Report saved as: ${savedFilePath}`);
                })
                .catch((err) => {
                  console.error("Error saving file:", err);
                  alert("Error saving report. Please try again.");
                });
            };
            reader.readAsDataURL(blob);
          } catch (err) {
            console.error("Error saving PDF:", err);
            alert("Error saving report. Please try again.");
          }
        }, 300); // Longer timeout for better rendering
      }, 200);
    })
    .catch((err) => {
      console.error("Error saving report:", err);
      alert("Error saving report. Please try again.");
    });
}

// Export comparison report
async function exportComparisonReport() {
  if (!comparisonData.isCalculated) {
    showErrorMessage("Please run a loan comparison first.");
    return;
  }

  // Generate default filename with date
  const now = new Date();
  const defaultFileName = `loan_comparison_${now.getFullYear()}${(
    now.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}_${now
    .getHours()
    .toString()
    .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}.pdf`;

  try {
    // Create PDF document
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      throw new Error("PDF library not available");
    }
    const doc = new jsPDF();

    // Pre-load logo data for use throughout the PDF
    const logoData = await getLogoDataURL();

    // Add logo header with title
    let contentStartY = addLogoHeaderSync(doc, logoData, true);

    // Add current date centered below title
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const pageWidth = doc.internal.pageSize.width;
    doc.text(
      `Generated on: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      pageWidth / 2,
      contentStartY + 8,
      { align: "center" }
    );
    contentStartY += 18; // Account for date

    let yPosition = contentStartY;

    // Add summary section
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text("Loan Comparison Summary", 14, yPosition);

    // Add divider line
    doc.setDrawColor(52, 152, 219); // #3498db
    doc.setLineWidth(0.5);
    doc.line(14, yPosition + 3, 196, yPosition + 3);

    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);
    yPosition += 13;

    // Prepare data for valid loans
    const validLoans = ["A", "B", "C"].filter((letter) => {
      const calc = comparisonData[`loan${letter}`];
      return calc !== null && calc !== undefined;
    });

    if (validLoans.length > 0) {
      // Build dynamic table headers based on valid loans
      const tableHeaders = ["Metric"];
      const activeLoanData = [];

      validLoans.forEach((letter) => {
        const calc = comparisonData[`loan${letter}`];
        if (calc) {
          tableHeaders.push(calc.name);
          activeLoanData.push(calc);
        }
      });

      const tableData = [];
      const formatCurrency = (value) => {
        // Handle invalid values
        if (value === undefined || value === null || isNaN(value)) {
          return "$0";
        }
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      };

      // Add rows
      const metrics = [
        { label: "Loan Name", getValue: (calc) => (calc ? calc.name : "-") },
        {
          label: "Loan Amount",
          getValue: (calc) => (calc ? formatCurrency(calc.amount) : "-"),
        },
        {
          label: "Interest Rate",
          getValue: (calc) => (calc ? `${calc.rate}%` : "-"),
        },
        {
          label: "Loan Term",
          getValue: (calc) => (calc ? `${calc.term} years` : "-"),
        },
        {
          label: "Monthly Payment",
          getValue: (calc) =>
            calc ? formatCurrency(calc.totalMonthlyPayment) : "-",
        },
        {
          label: "Total Interest",
          getValue: (calc) => (calc ? formatCurrency(calc.totalInterest) : "-"),
        },
        {
          label: "Total Cost",
          getValue: (calc) => (calc ? formatCurrency(calc.totalCost) : "-"),
        },
        {
          label: "Closing Costs",
          getValue: (calc) => (calc ? formatCurrency(calc.fees) : "-"),
        },
        {
          label: "Payoff Time",
          getValue: (calc) =>
            calc && calc.payoffTime
              ? `${calc.payoffTime.years}y ${calc.payoffTime.months}m`
              : "-",
        },
      ];

      metrics.forEach((metric) => {
        const row = [metric.label];
        activeLoanData.forEach((calc) => {
          try {
            const value = metric.getValue(calc);
            row.push(value);
          } catch (error) {
            console.error(`Error getting value for ${metric.label}:`, error);
            row.push("-");
          }
        });
        tableData.push(row);
      });

      // Draw table with better width distribution
      let startX = 14;
      let totalWidth = 185; // Slightly wider

      // Make first column (metric names) wider, other columns equal
      const metricColumnWidth = 60;
      const dataColumnWidth =
        (totalWidth - metricColumnWidth) / (tableHeaders.length - 1);
      let rowHeight = 8;

      // Headers with dynamic widths
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      tableHeaders.forEach((header, index) => {
        const x =
          index === 0
            ? startX
            : startX + metricColumnWidth + (index - 1) * dataColumnWidth;
        const width = index === 0 ? metricColumnWidth : dataColumnWidth;

        doc.rect(x, yPosition, width, rowHeight);

        // Truncate header text if too long
        const maxChars = index === 0 ? 15 : 12;
        const displayText =
          header.length > maxChars
            ? header.substring(0, maxChars - 3) + "..."
            : header;
        doc.text(displayText, x + 2, yPosition + 5);
      });
      yPosition += rowHeight;

      // Data rows with dynamic widths
      doc.setFont(undefined, "normal");
      tableData.forEach((row) => {
        row.forEach((cell, index) => {
          const x =
            index === 0
              ? startX
              : startX + metricColumnWidth + (index - 1) * dataColumnWidth;
          const width = index === 0 ? metricColumnWidth : dataColumnWidth;

          doc.rect(x, yPosition, width, rowHeight);

          const text = typeof cell === "string" ? cell : cell.toString();
          // More generous character limits
          const maxChars = index === 0 ? 15 : 12;
          const displayText =
            text.length > maxChars
              ? text.substring(0, maxChars - 3) + "..."
              : text;
          doc.text(displayText, x + 2, yPosition + 5);
        });
        yPosition += rowHeight;
      });

      yPosition += 10;

      // Best option analysis
      if (comparisonData.bestOption && comparisonData.bestOption.name) {
        try {
          doc.setFontSize(14);
          doc.setFont(undefined, "bold");
          doc.setTextColor(16, 185, 129);
          doc.text("RECOMMENDED OPTION", 14, yPosition);
          yPosition += 10;

          doc.setFontSize(11);
          doc.setFont(undefined, "normal");
          doc.setTextColor(0);
          doc.text(
            `Best Choice: ${comparisonData.bestOption.name || "Unknown"}`,
            14,
            yPosition
          );
          yPosition += 7;
          doc.text(
            `Monthly Payment: ${formatCurrency(
              comparisonData.bestOption.totalMonthlyPayment
            )}`,
            14,
            yPosition
          );
          yPosition += 7;
          doc.text(
            (() => {
              const mode =
                comparisonData.bestOption?.evaluation?.scoreBasis ||
                "totalOutOfPocket";
              if (mode === "principalInterest") {
                return `Principal + Interest: ${formatCurrency(
                  comparisonData.bestOption.totals?.totalCostPI ||
                    comparisonData.bestOption.totalCost
                )}`;
              }
              if (mode === "payoffSpeed") {
                return `Payoff Time: ${
                  comparisonData.bestOption.payoffTime?.years || 0
                }y ${comparisonData.bestOption.payoffTime?.months || 0}m`;
              }
              return `Total Out-of-Pocket: ${formatCurrency(
                comparisonData.bestOption.totals?.totalOutOfPocket ||
                  comparisonData.bestOption.totalCost
              )}`;
            })(),
            14,
            yPosition
          );
          yPosition += 7;

          // Show evaluation mode context line
          const modeLabelMap = {
            totalOutOfPocket:
              "Mode: Total Out-of-Pocket (lifetime all-in cost)",
            principalInterest: "Mode: Principal + Interest (escrow ignored)",
            payoffSpeed:
              "Mode: Payoff Speed (months to payoff; tie-breaker = total out-of-pocket)",
          };
          const mode =
            comparisonData.bestOption?.evaluation?.scoreBasis ||
            "totalOutOfPocket";
          doc.setFontSize(9);
          doc.setTextColor(90);
          doc.text(
            modeLabelMap[mode] || modeLabelMap.totalOutOfPocket,
            14,
            yPosition
          );
          yPosition += 6;
          doc.setFontSize(11);
          doc.setTextColor(0);

          if (comparisonData.savings) {
            doc.text(
              `Monthly Savings vs Next Best: ${formatCurrency(
                Math.abs(comparisonData.savings.monthlyPaymentSavings || 0)
              )}`,
              14,
              yPosition
            );
            yPosition += 7;
            doc.text(
              `Lifetime Interest Savings: ${formatCurrency(
                Math.abs(comparisonData.savings.totalInterestSavings || 0)
              )}`,
              14,
              yPosition
            );
          }
        } catch (bestOptionError) {
          console.error("Error rendering best option:", bestOptionError);
          // Continue without best option section
        }
      }

      // Add new page if needed for detailed breakdown
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      yPosition += 15;

      // Detailed loan breakdown for each option
      validLoans.forEach((letter, index) => {
        const calc = comparisonData[`loan${letter}`];
        if (!calc) return;

        if (yPosition > 200) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setFont(undefined, "bold");
        doc.setTextColor(30, 64, 175);
        doc.text(`${calc.name} - Detailed Analysis`, 14, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.setTextColor(0);

        const details = [
          `Loan Amount: ${formatCurrency(calc.amount)}`,
          `Interest Rate: ${calc.rate}%`,
          `Loan Term: ${calc.term} years`,
          `Monthly P&I: ${formatCurrency(calc.monthlyPI)}`,
          `PMI: ${formatCurrency(calc.pmi)}`,
          `Total Monthly Payment: ${formatCurrency(calc.totalMonthlyPayment)}`,
          `Extra Payment: ${formatCurrency(calc.extra)}`,
          `Closing Costs: ${formatCurrency(calc.fees)}`,
          `Total Interest: ${formatCurrency(calc.totalInterest)}`,
          `Total Cost: ${formatCurrency(calc.totalCost)}`,
          `Payoff Time: ${
            calc.payoffTime
              ? `${calc.payoffTime.years} years, ${calc.payoffTime.months} months`
              : "N/A"
          }`,
        ];

        details.forEach((detail) => {
          doc.text(detail, 14, yPosition);
          yPosition += 6;
        });

        yPosition += 10;

        // Lightweight amortization snapshot (Task 14)
        try {
          const snapshot = buildLightweightSchedule(calc);
          if (snapshot && snapshot.length) {
            if (yPosition > 230) {
              doc.addPage();
              yPosition = 20;
            }
            doc.setFontSize(11);
            doc.setFont(undefined, "bold");
            doc.setTextColor(44, 62, 80);
            doc.text("Amortization Snapshot", 14, yPosition);
            yPosition += 6;
            doc.setFontSize(8);
            doc.setFont(undefined, "bold");
            const headers = [
              "Mo",
              "Payment",
              "Interest",
              "Principal",
              "PMI",
              "Balance",
              "Cum Int",
            ]; // concise
            let x = 14;
            headers.forEach((h) => {
              doc.text(h, x, yPosition);
              x += 23;
            });
            yPosition += 4;
            doc.setFont(undefined, "normal");
            snapshot.forEach((row) => {
              if (yPosition > 280) {
                doc.addPage();
                yPosition = 20;
              }
              let colX = 14;
              const fmt = (v) => {
                if (typeof v !== "number") return v;
                return v.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                });
              };
              const cells = [
                row.month + (row.pmiEnds ? "*" : ""),
                fmt(row.payment),
                fmt(row.interest),
                fmt(row.principal),
                row.pmi > 0 ? fmt(row.pmi) : "-",
                fmt(row.balance),
                fmt(row.cumInterest),
              ];
              cells.forEach((c) => {
                doc.text(String(c), colX, yPosition);
                colX += 23;
              });
              yPosition += 4;
            });
            // PMI footnote if any marker
            if (snapshot.some((r) => r.pmiEnds)) {
              if (yPosition > 285) {
                doc.addPage();
                yPosition = 20;
              }
              doc.setFontSize(7);
              doc.setTextColor(100);
              doc.text("* First month after PMI ended", 14, yPosition);
              yPosition += 5;
              doc.setFontSize(10);
              doc.setTextColor(0);
            }
          }
        } catch (scheduleErr) {
          console.warn("Snapshot generation failed", scheduleErr);
        }
      });
    }

    // Generate filename
    const now2 = new Date();
    const fileName = `loan_comparison_${now2.getFullYear()}${(
      now2.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}${now2.getDate().toString().padStart(2, "0")}.pdf`;

    // Ask user where to save the file (same as refinance export)
    const savedFilePath = await ipcRenderer.invoke("save-pdf", fileName);
    if (!savedFilePath) return; // User cancelled

    // Save the PDF (same as refinance export)
    const blob = doc.output("blob");
    const reader = new FileReader();
    reader.onload = function () {
      const base64data = reader.result.split(",")[1];

      ipcRenderer
        .invoke("save-binary-file", savedFilePath, base64data)
        .then(() => {
          // Show success message and ask to open file
          showConfirmDialog(
            `PDF report exported successfully to: ${savedFilePath}\n\nWould you like to open the file now?`,
            () => {
              ipcRenderer.invoke("open-file", savedFilePath).catch((err) => {
                console.error("Error opening file:", err);
                showErrorMessage(
                  "File saved successfully, but could not open it automatically."
                );
              });
            },
            () => {
              showSuccessMessage(
                `PDF exported successfully to: ${savedFilePath}`
              );
            }
          );
        })
        .catch((err) => {
          console.error("Error saving file:", err);
          showErrorMessage("Error saving PDF. Please try again.");
        });
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error("Error generating comparison report:", error);
    showErrorMessage("Failed to generate comparison report. Please try again.");
  }
}

// ============================================================================
// BLENDED MORTGAGE FUNCTIONS
// ============================================================================

function calculateBlendedMortgage() {
  try {
    // Get form values
    const homeValue = parseFloat(
      (document.getElementById("blendedHomeValue")?.value || "0")
        .toString()
        .replace(/,/g, "")
    );

    // First mortgage component
    const firstAmount = parseFloat(
      (document.getElementById("firstMortgageAmount")?.value || "0")
        .toString()
        .replace(/,/g, "")
    );
    const firstRate = parseFloat(
      document.getElementById("firstMortgageRate")?.value || "0"
    );
    const firstTerm = parseInt(
      document.getElementById("firstMortgageTerm")?.value || "30"
    );

    // Second mortgage component
    const secondAmount = parseFloat(
      (document.getElementById("secondMortgageAmount")?.value || "0")
        .toString()
        .replace(/,/g, "")
    );
    const secondRate = parseFloat(
      document.getElementById("secondMortgageRate")?.value || "0"
    );
    const secondType =
      document.getElementById("secondMortgageType")?.value || "heloc";
    const secondTerm = parseInt(
      document.getElementById("secondMortgageTerm")?.value || "15"
    );

    // Additional costs
    const propertyTax = parseFloat(
      (document.getElementById("blendedPropertyTax")?.value || "0")
        .toString()
        .replace(/,/g, "")
    );
    const insurance = parseFloat(
      (document.getElementById("blendedInsurance")?.value || "0")
        .toString()
        .replace(/,/g, "")
    );
    const pmi = parseFloat(
      (document.getElementById("blendedPMI")?.value || "0")
        .toString()
        .replace(/,/g, "")
    );
    const other = parseFloat(
      (document.getElementById("blendedOther")?.value || "0")
        .toString()
        .replace(/,/g, "")
    );

    // Validate inputs
    if (homeValue <= 0) {
      showErrorMessage("Please enter a valid home value");
      return;
    }

    if (firstAmount <= 0) {
      showErrorMessage("Please enter a valid first mortgage amount");
      return;
    }

    if (firstRate <= 0) {
      showErrorMessage("Please enter a valid first mortgage interest rate");
      return;
    }

    // Get additional components
    const additionalComponents = getAdditionalComponents();

    // Prepare calculation parameters
    const params = {
      homeValue,
      firstMortgage: {
        amount: firstAmount,
        rate: firstRate,
        term: firstTerm,
      },
      secondMortgage: {
        amount: secondAmount,
        rate: secondRate,
        type: secondType,
        term: secondTerm,
      },
      additionalComponents,
      additionalCosts: {
        propertyTax,
        insurance,
        pmi,
        other,
      },
    };

    // Calculate using the modular system
    let results;
    if (window.calculators && window.calculators.blended) {
      results = window.calculators.blended.calculateBlendedMortgage(params);
    } else {
      // Fallback calculation
      results = calculateBlendedMortgageFallback(params);
    }

    // Display results
    displayBlendedResults(results);
    showBlendedResultsWithAnimation();

    // Cache the results for export
    window.blendedMortgageData = results;
  } catch (error) {
    console.error("Blended mortgage calculation error:", error);
    showErrorMessage(
      "Error calculating blended mortgage. Please check your inputs and try again."
    );
  }
}

function calculateBlendedMortgageFallback(params) {
  // Simple fallback calculation if module isn't loaded
  const {
    homeValue,
    firstMortgage,
    secondMortgage,
    additionalComponents = [],
    additionalCosts,
  } = params;

  // First mortgage calculation
  const firstMonthlyRate = firstMortgage.rate / 100 / 12;
  const firstPayments = firstMortgage.term * 12;
  const firstMonthlyPayment =
    (firstMortgage.amount *
      firstMonthlyRate *
      Math.pow(1 + firstMonthlyRate, firstPayments)) /
    (Math.pow(1 + firstMonthlyRate, firstPayments) - 1);

  // Second mortgage calculation (simplified)
  let secondMonthlyPayment = 0;
  if (secondMortgage.amount > 0) {
    if (secondMortgage.type === "heloc") {
      secondMonthlyPayment =
        (secondMortgage.amount * secondMortgage.rate) / 100 / 12;
    } else {
      const secondMonthlyRate = secondMortgage.rate / 100 / 12;
      const secondPayments = secondMortgage.term * 12;
      secondMonthlyPayment =
        (secondMortgage.amount *
          secondMonthlyRate *
          Math.pow(1 + secondMonthlyRate, secondPayments)) /
        (Math.pow(1 + secondMonthlyRate, secondPayments) - 1);
    }
  }

  // Calculate additional components
  let additionalComponentsMonthlyPayment = 0;
  const additionalComponentsResults = [];

  additionalComponents.forEach((component) => {
    let monthlyPayment = 0;

    if (component.amount > 0 && component.rate > 0) {
      if (component.type === "heloc") {
        // Interest-only payment for HELOC
        monthlyPayment = (component.amount * component.rate) / 100 / 12;
      } else {
        // Fixed loan calculation
        const monthlyRate = component.rate / 100 / 12;
        const numPayments = component.term * 12;
        monthlyPayment =
          (component.amount *
            monthlyRate *
            Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1);
      }

      additionalComponentsMonthlyPayment += monthlyPayment;
      additionalComponentsResults.push({
        amount: component.amount,
        rate: component.rate,
        monthlyPayment: monthlyPayment,
        type: component.type,
        term: component.term,
      });
    }
  });

  const totalAdditionalCosts =
    additionalCosts.propertyTax +
    additionalCosts.insurance +
    additionalCosts.pmi +
    additionalCosts.other;
  const totalMonthlyPayment =
    firstMonthlyPayment +
    secondMonthlyPayment +
    additionalComponentsMonthlyPayment +
    totalAdditionalCosts;

  // Calculate blended rate (weighted average)
  const totalPrincipal =
    firstMortgage.amount +
    secondMortgage.amount +
    additionalComponentsResults.reduce((sum, c) => sum + c.amount, 0);
  let effectiveBlendedRate = 0;

  if (totalPrincipal > 0) {
    const firstWeightedRate = firstMortgage.amount * firstMortgage.rate;
    const secondWeightedRate = secondMortgage.amount * secondMortgage.rate;
    const additionalWeightedRate = additionalComponentsResults.reduce(
      (sum, c) => sum + c.amount * c.rate,
      0
    );

    effectiveBlendedRate =
      (firstWeightedRate + secondWeightedRate + additionalWeightedRate) /
      totalPrincipal;
  }

  return {
    homeValue,
    firstMortgage: {
      amount: firstMortgage.amount,
      monthlyPayment: firstMonthlyPayment,
    },
    secondMortgage: {
      amount: secondMortgage.amount,
      monthlyPayment: secondMonthlyPayment,
      type: secondMortgage.type,
    },
    additionalComponents: additionalComponentsResults,
    combined: {
      totalMonthlyPayment,
      totalPrincipalInterest:
        firstMonthlyPayment +
        secondMonthlyPayment +
        additionalComponentsMonthlyPayment,
      effectiveBlendedRate: effectiveBlendedRate,
    },
    additionalCosts: {
      total: totalAdditionalCosts,
    },
  };
}

function displayBlendedResults(results) {
  // Local currency formatting function
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Update summary section
  const summaryData = document.getElementById("summaryData");
  if (summaryData) {
    summaryData.innerHTML = `
      <div class="row g-2">
        <div class="col-6">
          <div class="result-item">
            <h6>First Mortgage</h6>
            <p class="result-value">${formatCurrency(
              results.firstMortgage.monthlyPayment
            )}</p>
            <small class="text-muted">Monthly P&I</small>
          </div>
        </div>
        <div class="col-6">
          <div class="result-item">
            <h6>Second Component</h6>
            <p class="result-value">${formatCurrency(
              results.secondMortgage.monthlyPayment
            )}</p>
            <small class="text-muted">${
              results.secondMortgage.type === "heloc"
                ? "Interest-Only"
                : "Monthly P&I"
            }</small>
          </div>
        </div>
        ${
          results.additionalComponents &&
          results.additionalComponents.length > 0
            ? results.additionalComponents
                .map(
                  (component, index) => `
            <div class="col-6">
              <div class="result-item">
                <h6>Component ${index + 3}</h6>
                <p class="result-value">${formatCurrency(
                  component.monthlyPayment
                )}</p>
                <small class="text-muted">${
                  component.type === "heloc" ? "Interest-Only" : "Monthly P&I"
                }</small>
              </div>
            </div>
          `
                )
                .join("")
            : ""
        }
        <div class="col-12">
          <hr class="my-2">
          <div class="result-item">
            <h6>Total P&I Payment</h6>
            <p class="result-value">${formatCurrency(
              results.combined.totalPrincipalInterest
            )}</p>
            <small class="text-muted">Combined Principal & Interest</small>
          </div>
        </div>
        <div class="col-12">
          <div class="result-item highlight-result">
            <h6>Total Monthly Payment</h6>
            <p class="result-value highlight">${formatCurrency(
              results.combined.totalMonthlyPayment
            )}</p>
            <small class="text-muted">Including All Costs</small>
          </div>
        </div>
        <div class="col-12">
          <div class="result-item">
            <h6>Blended Rate</h6>
            <p class="result-value">${(
              results.combined.effectiveBlendedRate || 0
            ).toFixed(3)}%</p>
            <small class="text-muted">Weighted Average Rate</small>
          </div>
        </div>
      </div>
    `;
  }

  // Update detailed breakdown if available
  if (results.ltv) {
    const breakdownData = document.getElementById("breakdownData");
    if (breakdownData) {
      // Handle potential NaN or undefined values
      const firstLTV = isNaN(results.ltv.firstMortgageLTV)
        ? 0
        : results.ltv.firstMortgageLTV;
      const combinedLTV = isNaN(results.ltv.combinedLTV)
        ? 0
        : results.ltv.combinedLTV;
      const availableEquity = isNaN(results.ltv.availableEquity)
        ? 0
        : results.ltv.availableEquity;

      breakdownData.innerHTML = `
        <div class="row g-2">
          <div class="col-6">
            <div class="result-item">
              <h6>First Mortgage LTV</h6>
              <p class="result-value">${firstLTV.toFixed(2)}%</p>
            </div>
          </div>
          <div class="col-6">
            <div class="result-item">
              <h6>Combined LTV</h6>
              <p class="result-value">${combinedLTV.toFixed(2)}%</p>
            </div>
          </div>
          <div class="col-12">
            <div class="result-item">
              <h6>Available Equity</h6>
              <p class="result-value">${formatCurrency(availableEquity)}</p>
            </div>
          </div>
        </div>
      `;
    }
  }
}

function showBlendedResultsWithAnimation() {
  const blendedResultsSummary = document.getElementById(
    "blendedResultsSummary"
  );
  if (blendedResultsSummary) {
    blendedResultsSummary.style.display = "block";
    addFadeInAnimation(blendedResultsSummary, 200);
  }
}

function handleSecondMortgageTypeChange() {
  const typeSelect = document.getElementById("secondMortgageType");
  const termContainer = document.getElementById("secondTermContainer");

  if (typeSelect && termContainer) {
    const selectedType = typeSelect.value;
    if (selectedType === "fixed" || selectedType === "variable") {
      termContainer.style.display = "block";
    } else {
      termContainer.style.display = "none";
    }
  }
}

function clearBlendedForm() {
  // Clear all form fields
  const fields = [
    "blendedHomeValue",
    "firstMortgageAmount",
    "firstMortgageRate",
    "firstMortgageTerm",
    "secondMortgageAmount",
    "secondMortgageRate",
    "secondMortgageTerm",
    "blendedPropertyTax",
    "blendedInsurance",
    "blendedPMI",
    "blendedOther",
  ];

  fields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = "";
    }
  });

  // Reset selects to default
  const typeSelect = document.getElementById("secondMortgageType");
  if (typeSelect) {
    typeSelect.value = "heloc";
  }

  // Hide term container
  const termContainer = document.getElementById("secondTermContainer");
  if (termContainer) {
    termContainer.style.display = "none";
  }

  // Hide results
  const blendedResultsSummary = document.getElementById(
    "blendedResultsSummary"
  );
  if (blendedResultsSummary) {
    blendedResultsSummary.style.display = "none";
  }

  // Clear additional components
  const additionalContainer = document.getElementById("additionalComponents");
  if (additionalContainer) {
    additionalContainer.innerHTML = "";
  }

  // Reset component counter
  componentCounter = 0;

  // Clear cached data
  window.blendedMortgageData = null;

  showSuccessMessage("Blended mortgage form cleared");
}

// Dynamic Component Functions
let componentCounter = 0;

function addBlendedComponent() {
  componentCounter++;
  const container = document.getElementById("additionalComponents");

  if (container) {
    const newComponent = document.createElement("div");
    newComponent.className = "col-12 component-item border rounded p-3 mb-3";
    newComponent.id = `component${componentCounter}`;

    newComponent.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0">Component ${componentCounter + 2}</h6>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeBlendedComponent(${componentCounter})">
          <i class="fas fa-times"></i> Remove
        </button>
      </div>
      <div class="row g-3">
        <div class="col-md-3">
          <label for="componentAmount${componentCounter}" class="form-label">Amount</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="text" class="form-control currency-input component-amount" id="componentAmount${componentCounter}" placeholder="50,000">
          </div>
        </div>
        <div class="col-md-3">
          <label for="componentRate${componentCounter}" class="form-label">Interest Rate</label>
          <div class="input-group">
            <input type="text" class="form-control percentage-input component-rate" id="componentRate${componentCounter}" placeholder="7.5">
            <span class="input-group-text">%</span>
          </div>
        </div>
        <div class="col-md-3">
          <label for="componentType${componentCounter}" class="form-label">Type</label>
          <select class="form-select component-type" id="componentType${componentCounter}" onchange="handleComponentTypeChange(${componentCounter})">
            <option value="heloc">HELOC (Interest Only)</option>
            <option value="fixed">Fixed Term Loan</option>
            <option value="variable">Variable Rate</option>
          </select>
        </div>
        <div class="col-md-3" id="componentTermContainer${componentCounter}" style="display: none;">
          <label for="componentTerm${componentCounter}" class="form-label">Term (Years)</label>
          <input type="number" class="form-control component-term" id="componentTerm${componentCounter}" value="15" min="5" max="30">
        </div>
      </div>
    `;

    container.appendChild(newComponent);
  }
}

function removeBlendedComponent(componentId) {
  const component = document.getElementById(`component${componentId}`);
  if (component) {
    component.remove();
  }
}

function handleComponentTypeChange(componentId) {
  const typeSelect = document.getElementById(`componentType${componentId}`);
  const termContainer = document.getElementById(
    `componentTermContainer${componentId}`
  );

  if (typeSelect && termContainer) {
    const selectedType = typeSelect.value;
    if (selectedType === "fixed" || selectedType === "variable") {
      termContainer.style.display = "block";
    } else {
      termContainer.style.display = "none";
    }
  }
}

function getAdditionalComponents() {
  const components = [];
  const container = document.getElementById("additionalComponents");

  if (container) {
    const componentItems = container.querySelectorAll(".component-item");

    componentItems.forEach((item) => {
      const amountInput = item.querySelector(".component-amount");
      const rateInput = item.querySelector(".component-rate");
      const typeSelect = item.querySelector(".component-type");
      const termInput = item.querySelector(".component-term");

      if (amountInput && rateInput && typeSelect) {
        const amount = parseFloat(
          (amountInput.value || "0").toString().replace(/,/g, "")
        );
        const rate = parseFloat(rateInput.value || "0");
        const type = typeSelect.value || "heloc";
        const term = parseInt(termInput?.value || "15");

        if (!isNaN(amount) && amount > 0 && !isNaN(rate) && rate > 0) {
          components.push({ amount, rate, type, term });
        }
      }
    });
  }

  return components;
}

async function exportBlendedReport() {
  if (!window.blendedMortgageData) {
    showErrorMessage("Please calculate a blended mortgage first");
    return;
  }

  // Generate default filename with date
  const now = new Date();
  const defaultFileName = `blended_mortgage_${now.getFullYear()}${(
    now.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}_${now
    .getHours()
    .toString()
    .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}.pdf`;

  try {
    // Create PDF document
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      throw new Error("PDF library not available");
    }
    const doc = new jsPDF();

    // Pre-load logo data for use throughout the PDF
    const logoData = await getLogoDataURL();

    // Add logo header with title
    let contentStartY = addLogoHeaderSync(doc, logoData, true);

    // Add current date centered below title
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const pageWidth = doc.internal.pageSize.width;
    doc.text(
      `Generated on: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      pageWidth / 2,
      contentStartY + 8,
      { align: "center" }
    );
    contentStartY += 18; // Account for date

    let yPosition = contentStartY;

    // Add title section
    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.text("Blended Mortgage Analysis", 14, yPosition);
    yPosition += 15;

    // Add divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, yPosition, pageWidth - 14, yPosition);
    yPosition += 15;

    // Add mortgage components
    const data = window.blendedMortgageData;

    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);
    doc.text("Mortgage Components:", 14, yPosition);
    yPosition += 8;

    // First mortgage component
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Home Value: ${formatCurrency(data.homeValue || 0)}`,
      20,
      yPosition
    );
    yPosition += 6;
    doc.text(
      `First Mortgage Amount: ${formatCurrency(data.firstMortgageAmount || 0)}`,
      20,
      yPosition
    );
    yPosition += 6;
    doc.text(
      `First Mortgage Rate: ${data.firstMortgageRate || 0}%`,
      20,
      yPosition
    );
    yPosition += 6;
    doc.text(
      `First Mortgage Term: ${data.firstMortgageTerm || 0} years`,
      20,
      yPosition
    );
    yPosition += 10;

    // Additional components
    if (data.additionalComponents && data.additionalComponents.length > 0) {
      data.additionalComponents.forEach((component, index) => {
        doc.text(`Additional Component ${index + 1}:`, 20, yPosition);
        yPosition += 6;
        doc.text(
          `  Amount: ${formatCurrency(component.amount || 0)}`,
          25,
          yPosition
        );
        yPosition += 5;
        doc.text(`  Rate: ${component.rate || 0}%`, 25, yPosition);
        yPosition += 5;
        doc.text(`  Term: ${component.term || 0} years`, 25, yPosition);
        yPosition += 5;
        doc.text(`  Type: ${component.type || "Interest-Only"}`, 25, yPosition);
        yPosition += 8;
      });
    }

    // Add calculation results
    if (data.calculationResults) {
      yPosition += 5;
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      doc.text("Payment Summary:", 14, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);

      const results = data.calculationResults;
      doc.text(
        `First Mortgage Payment: ${formatCurrency(
          results.firstMortgagePayment || 0
        )}`,
        20,
        yPosition
      );
      yPosition += 6;

      if (results.additionalPayments && results.additionalPayments.length > 0) {
        results.additionalPayments.forEach((payment, index) => {
          doc.text(
            `Additional Component ${index + 1} Payment: ${formatCurrency(
              payment || 0
            )}`,
            20,
            yPosition
          );
          yPosition += 6;
        });
      }

      yPosition += 4;
      doc.setFontSize(11);
      doc.setTextColor(44, 62, 80);
      doc.text(
        `Total Monthly Payment: ${formatCurrency(
          results.totalMonthlyPayment || 0
        )}`,
        20,
        yPosition
      );
      yPosition += 8;

      if (results.effectiveBlendedRate) {
        doc.text(
          `Blended Rate: ${results.effectiveBlendedRate.toFixed(3)}%`,
          20,
          yPosition
        );
        yPosition += 8;
      }
    }

    // Save the PDF
    doc.save(defaultFileName);

    // Show success message and ask to open file after a short delay
    setTimeout(() => {
      showConfirmDialog(
        `PDF report exported successfully as: ${defaultFileName}\n\nWould you like to open the file now?`,
        () => {
          // Try to open the file using ipcRenderer if available
          if (typeof ipcRenderer !== "undefined") {
            ipcRenderer.invoke("open-file", defaultFileName).catch((err) => {
              console.error("Error opening file:", err);
              showErrorMessage(
                "File saved successfully, but could not open it automatically. Please check your Downloads folder."
              );
            });
          } else {
            showErrorMessage(
              "File saved successfully to your Downloads folder. Please open it manually."
            );
          }
        },
        () => {
          showSuccessMessage(
            `PDF exported successfully as: ${defaultFileName}`
          );
        }
      );
    }, 500); // Small delay to ensure file download starts
  } catch (error) {
    console.error("Export error:", error);
    showErrorMessage("Failed to export report. Please try again.");
  }
}

// Initialize event listeners when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Check if Chart.js is loaded
  console.log("Chart.js available:", typeof Chart);
  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded!");
  }

  // Check if canvas elements exist
  const amortChart = document.getElementById("amortizationChart");
  const balChart = document.getElementById("balanceChart");
  console.log("amortizationChart element exists:", !!amortChart);
  console.log("balanceChart element exists:", !!balChart);

  // Note: loadCachedData() is already called in the first DOMContentLoaded handler
  // Removing duplicate call to prevent tab state conflicts

  // Blended Mortgage Functions
  window.calculateBlendedMortgage = calculateBlendedMortgage;
  window.exportBlendedReport = exportBlendedReport;
  window.clearBlendedForm = clearBlendedForm;
  window.handleSecondMortgageTypeChange = handleSecondMortgageTypeChange;

  // Add event listener for chart tab to render charts when clicked
  const chartTab = document.getElementById("chart-tab");
  if (chartTab) {
    chartTab.addEventListener("click", function () {
      console.log("Chart tab clicked");
      // Test if Chart.js works at all with a simple chart
      if (typeof Chart !== "undefined") {
        createTestChart();
      }
      // Small delay to ensure tab is fully shown before rendering
      setTimeout(renderCharts, 100);
    });
  }

  // --- Purchase PMI End Rule persistence (Task 11) ---
  try {
    const storedPurchasePmiRule = localStorage.getItem("purchase_pmiEndRule");
    if (storedPurchasePmiRule === "78" || storedPurchasePmiRule === "80") {
      const purchaseRuleSel = document.getElementById("pmiEndRule");
      if (purchaseRuleSel) {
        purchaseRuleSel.value = storedPurchasePmiRule;
        try {
          updatePurchaseLtvPmiStatus && updatePurchaseLtvPmiStatus();
        } catch (e) {
          console.warn("PMI status refresh failed during rule restore", e);
        }
      }
    }
  } catch (e) {
    console.warn("PMI rule load skipped", e);
  }
  const purchaseRuleSel = document.getElementById("pmiEndRule");
  if (purchaseRuleSel) {
    purchaseRuleSel.addEventListener("change", () => {
      const val = purchaseRuleSel.value;
      if (val === "78" || val === "80") {
        try {
          localStorage.setItem("purchase_pmiEndRule", val);
        } catch (e) {
          console.warn("PMI rule persist failed", e);
        }
        try {
          updatePurchaseLtvPmiStatus && updatePurchaseLtvPmiStatus();
        } catch (e) {
          console.warn("PMI status refresh failed after rule change", e);
        }
      }
    });
  }
});
