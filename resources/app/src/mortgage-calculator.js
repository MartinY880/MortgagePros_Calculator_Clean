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

  // Scroll to top to ensure visibility
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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
  console.log("DOM loaded - initializing app quickly...");
  
  // Initialize theme first (fast)
  initializeTheme();

  // Show app immediately
  document.body.style.visibility = 'visible';

  // Defer heavy operations to allow UI to show first
  setTimeout(() => {
    console.log("Initializing heavy operations...");
    
    // Test jsPDF availability
    console.log("Testing jsPDF availability...");
    console.log("window.jspdf:", window.jspdf);
    console.log("typeof window.jspdf:", typeof window.jspdf);
    if (window.jspdf) {
      console.log("jsPDF constructor:", window.jspdf.jsPDF);
      console.log("typeof jsPDF constructor:", typeof window.jspdf.jsPDF);
    }

    // Initialize event listeners
    initializeEventListeners();

    // Load logo with proper path handling
    loadLogo();

    // Load cached data from localStorage
    loadCachedData();

    // Listen for menu commands from the main process
    ipcRenderer.on("menu-export-schedule", () => {
      exportToCSV();
    });
    
    console.log("App fully initialized!");
  }, 10); // Very small delay to allow UI to render first
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
  const propertyValue = document.getElementById("propertyValue");
  if (propertyValue) {
    propertyValue.addEventListener("input", updateDownPaymentAmount);
  }

  const downPaymentPercent = document.getElementById("downPaymentPercent");
  if (downPaymentPercent) {
    downPaymentPercent.addEventListener("input", updateDownPaymentAmount);
  }

  const downPaymentAmount = document.getElementById("downPaymentAmount");
  if (downPaymentAmount) {
    downPaymentAmount.addEventListener("input", updateDownPaymentPercent);
  }

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

  // Set the logo source to the local copy in src folder
  logoElement.src = "./logo.png";

  // Fallback: if logo fails to load, try alternative paths
  logoElement.onerror = function () {
    console.log("Logo failed to load from ./logo.png, trying alternatives...");
    const fallbacks = ["./assets/logo.png", "../assets/logo.png"];
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
function calculateMortgage(formType = "purchase") {
  let propertyValue,
    loanAmount,
    loanTerm,
    interestRate,
    propertyTax,
    homeInsurance,
    hoa,
    pmiRate;

  let extraPayment = 0;

  if (formType === "refinance") {
    // Get values from refinance form
    propertyValue = parseFloat(document.getElementById("appraisedValue").value);
    loanAmount = parseFloat(
      document.getElementById("refinanceLoanAmount").value
    );
    loanTerm = parseInt(document.getElementById("refinanceLoanTerm").value);
    interestRate = parseFloat(
      document.getElementById("refinanceInterestRate").value
    );
    propertyTax = parseFloat(
      document.getElementById("refinancePropertyTax").value
    );
    homeInsurance = parseFloat(
      document.getElementById("refinanceHomeInsurance").value
    );
    hoa = 0; // Not included in refinance form
    pmiRate = parseFloat(document.getElementById("refinancePmiAmount").value);
    extraPayment =
      parseFloat(document.getElementById("refinanceExtraPayment").value) || 0;

    // For refinance, there's no down payment - loan amount is specified directly
    var downPaymentAmount = 0;
  } else {
    // Get values from purchase form
    propertyValue = parseFloat(document.getElementById("propertyValue").value);
    var downPaymentAmount = parseFloat(
      document.getElementById("downPaymentAmount").value
    );
    loanAmount = propertyValue - downPaymentAmount;
    loanTerm = parseInt(document.getElementById("loanTerm").value);
    interestRate = parseFloat(document.getElementById("interestRate").value);
    propertyTax = parseFloat(document.getElementById("propertyTax").value);
    homeInsurance = parseFloat(document.getElementById("homeInsurance").value);
    hoa = parseFloat(document.getElementById("hoa").value);
    pmiRate = parseFloat(document.getElementById("pmiRate").value);
    extraPayment =
      parseFloat(document.getElementById("extraPayment").value) || 0;
  }

  // Validate inputs
  if (formType === "purchase") {
    if (
      !validateInputs(propertyValue, downPaymentAmount, loanTerm, interestRate)
    ) {
      return;
    }
  } else {
    if (!validateInputs(propertyValue, loanAmount, loanTerm, interestRate)) {
      return;
    }
  }

  // Calculate monthly interest rate
  const monthlyInterestRate = interestRate / 100 / 12;

  // Calculate number of payments
  const numberOfPayments = loanTerm * 12;

  // Calculate monthly principal and interest payment
  const monthlyPI =
    (loanAmount *
      (monthlyInterestRate *
        Math.pow(1 + monthlyInterestRate, numberOfPayments))) /
    (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);

  // Calculate PMI (if down payment < 20% for purchase, or if specified for refinance)
  const loanToValueRatio = (loanAmount / propertyValue) * 100;
  let monthlyPMI;

  if (formType === "refinance") {
    // For refinance, check if PMI is in annual or monthly mode
    const pmiToggle = document.getElementById("refinancePmiToggle");
    const pmiAmount = pmiRate || 0;

    if (pmiToggle && pmiToggle.checked) {
      // Annual mode - convert to monthly
      monthlyPMI = pmiAmount / 12;
    } else {
      // Monthly mode - use as is
      monthlyPMI = pmiAmount;
    }
  } else {
    // For purchase, PMI is calculated as a rate if LTV > 80%
    monthlyPMI = loanToValueRatio > 80 ? (pmiRate / 100 / 12) * loanAmount : 0;
  }

  // Calculate monthly property tax and insurance
  const monthlyPropertyTax = (propertyValue * propertyTax) / 100 / 12;
  const monthlyHomeInsurance = homeInsurance / 12;

  // Calculate total monthly payment (including extra payment)
  const totalMonthlyPayment =
    monthlyPI +
    monthlyPMI +
    monthlyPropertyTax +
    monthlyHomeInsurance +
    hoa +
    extraPayment;

  // Generate amortization schedule first to get accurate totals
  const currentAmortizationData = generateAmortizationSchedule(
    loanAmount,
    monthlyInterestRate,
    numberOfPayments,
    monthlyPropertyTax,
    monthlyHomeInsurance,
    monthlyPMI,
    hoa,
    extraPayment
  );

  // Calculate actual total interest and cost from schedule
  const totalInterest = currentAmortizationData.reduce(
    (sum, payment) => sum + payment.interest,
    0
  );
  const totalCost = currentAmortizationData.reduce(
    (sum, payment) => sum + payment.payment,
    0
  );

  // Store data in the appropriate tab structure
  const tabData = formType === "purchase" ? purchaseData : refinanceData;
  tabData.amortizationData = currentAmortizationData;
  tabData.calculationResults = [
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
  ];
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

  const isValid = amount > 0 && rate > 0 && term > 0;

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
  };
}

function calculateSingleLoan(loanData) {
  const {
    amount,
    rate,
    term,
    pmi,
    propertyTax,
    homeInsurance,
    extra,
    appraisedValue,
  } = loanData;

  // Calculate monthly interest rate and number of payments
  const monthlyRate = rate / 100 / 12;
  const numberOfPayments = term * 12;

  // Calculate monthly principal and interest payment
  const monthlyPI =
    (amount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments))) /
    (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

  // Calculate monthly property tax (percentage of appraised value)
  const monthlyPropertyTax =
    appraisedValue > 0 ? (appraisedValue * (propertyTax / 100)) / 12 : 0;

  // Total monthly payment including PMI, property tax, and home insurance
  const totalMonthlyPayment =
    monthlyPI + pmi + monthlyPropertyTax + homeInsurance;

  // Calculate total interest over life of loan (without extra payments initially)
  const totalInterestBase = monthlyPI * numberOfPayments - amount;

  // Calculate payoff time with extra payments
  let balance = amount;
  let totalInterest = 0;
  let month = 0;
  const maxMonths = numberOfPayments;

  if (extra > 0) {
    // Recalculate with extra payments
    while (balance > 0.01 && month < maxMonths) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPI - interestPayment;
      const totalPrincipal = principalPayment + extra;

      if (totalPrincipal >= balance) {
        totalInterest += balance * monthlyRate;
        balance = 0;
      } else {
        totalInterest += interestPayment;
        balance -= totalPrincipal;
      }
      month++;
    }
  } else {
    totalInterest = totalInterestBase;
    month = numberOfPayments;
  }

  const payoffYears = Math.floor(month / 12);
  const payoffMonths = month % 12;

  return {
    ...loanData,
    monthlyPI: monthlyPI,
    monthlyPropertyTax: monthlyPropertyTax,
    totalMonthlyPayment: totalMonthlyPayment,
    totalInterest: totalInterest,
    totalCost: amount + totalInterest,
    payoffTime: {
      years: payoffYears,
      months: payoffMonths,
      totalMonths: month,
    },
    calculations: {
      monthlyRate,
      numberOfPayments,
      originalTerm: numberOfPayments,
    },
  };
}

function determineBestLoan(calculations, validLoans) {
  const validCalculations = Object.values(calculations).filter(
    (calc) => calc !== null
  );

  if (validCalculations.length === 0) return null;

  // Find best loan based on total cost (including fees)
  let bestLoan = validCalculations[0];

  for (const loan of validCalculations) {
    if (loan.totalCost < bestLoan.totalCost) {
      bestLoan = loan;
    }
  }

  return bestLoan;
}

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

  return {
    monthlyPaymentSavings:
      secondBest.totalMonthlyPayment - bestOption.totalMonthlyPayment,
    totalInterestSavings: secondBest.totalInterest - bestOption.totalInterest,
    totalCostSavings: secondBest.totalCost - bestOption.totalCost,
    comparedTo: secondBest.name,
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

  // Update headers
  ["A", "B", "C"].forEach((letter) => {
    const calc = calculations[letter];
    const header = document.getElementById(`loan${letter}_header`);
    if (header) {
      if (calc) {
        header.textContent = calc.name;
        header.className = "text-center";
        if (bestOption && calc.letter === bestOption.letter) {
          header.innerHTML = `${calc.name} <span class="badge bg-success ms-1">🏆 Best</span>`;
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
    const total = document.getElementById(`comp${letter}_total`);
    const payoff = document.getElementById(`comp${letter}_payoff`);
    const fees = document.getElementById(`comp${letter}_fees`);

    if (calc) {
      const isBest = bestOption && calc.letter === bestOption.letter;
      const cellClass = isBest
        ? "text-center fw-bold text-success"
        : "text-center";

      monthly.innerHTML = `<span class="${cellClass}">${formatCurrency(
        calc.totalMonthlyPayment
      )}</span>`;
      interest.innerHTML = `<span class="${cellClass}">${formatCurrency(
        calc.totalInterest
      )}</span>`;
      total.innerHTML = `<span class="${cellClass}">${formatCurrency(
        calc.totalCost
      )}</span>`;
      payoff.innerHTML = `<span class="${cellClass}">${calc.payoffTime.years}y ${calc.payoffTime.months}m</span>`;
      fees.innerHTML = `<span class="${cellClass}">${formatCurrency(
        calc.fees
      )}</span>`;
    } else {
      monthly.innerHTML = '<span class="text-muted">-</span>';
      interest.innerHTML = '<span class="text-muted">-</span>';
      total.innerHTML = '<span class="text-muted">-</span>';
      payoff.innerHTML = '<span class="text-muted">-</span>';
      fees.innerHTML = '<span class="text-muted">-</span>';
    }
  });

  // Update winner banner
  const winnerBanner = document.getElementById("comparisonWinner");
  const winnerName = document.getElementById("winnerName");
  const winnerReason = document.getElementById("winnerReason");

  if (bestOption && winnerBanner && winnerName && winnerReason) {
    winnerName.textContent = bestOption.name;
    winnerReason.textContent = `Lowest total cost: ${formatCurrency(
      bestOption.totalCost
    )} | Monthly payment: ${formatCurrency(bestOption.totalMonthlyPayment)}`;
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

  // Update main results section
  document.getElementById("monthlyPayment").textContent =
    formatCurrency(totalMonthlyPayment);
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
  document.getElementById("pmiAmount").textContent = formatCurrency(monthlyPMI);
  document.getElementById("hoaAmount").textContent = formatCurrency(hoa);
  document.getElementById("extraAmount").textContent =
    formatCurrency(extraPayment);
  document.getElementById("totalCost").textContent = formatCurrency(totalCost);

  // Update summary tab content
  document.getElementById("summaryPI").textContent = formatCurrency(monthlyPI);
  document.getElementById("summaryTI").textContent = formatCurrency(
    monthlyPropertyTax + monthlyHomeInsurance
  );
  document.getElementById("summaryPMI").textContent =
    formatCurrency(monthlyPMI);
  document.getElementById("summaryHOA").textContent = formatCurrency(hoa);
  document.getElementById("summaryLTV").textContent =
    loanToValueRatio.toFixed(2) + "%";

  // Calculate and display total interest paid over life of loan
  document.getElementById("summaryTotalInterest").textContent =
    formatCurrency(totalInterest);

  // Calculate and display loan payoff date (use actual payoff from schedule if available)
  let payoffDate;
  if (amortizationData && amortizationData.length > 0) {
    // Use the actual payoff date from the last payment in the schedule
    payoffDate = amortizationData[amortizationData.length - 1].paymentDate;
  } else {
    // Fallback to original calculation
    const currentDate = new Date();
    payoffDate = new Date(currentDate);
    payoffDate.setFullYear(currentDate.getFullYear() + loanTerm);
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

    // Show savings information (you can add these elements to your HTML)
    if (document.getElementById("extraPaymentSavings")) {
      let savingsText = `Extra Payment Savings: `;
      if (yearsSaved > 0) {
        savingsText += `${yearsSaved} year${yearsSaved > 1 ? "s" : ""} `;
        if (remainingMonths > 0) {
          savingsText += `${remainingMonths} month${
            remainingMonths > 1 ? "s" : ""
          } `;
        }
      } else if (remainingMonths > 0) {
        savingsText += `${remainingMonths} month${
          remainingMonths > 1 ? "s" : ""
        } `;
      }
      savingsText += `earlier payoff, ${formatCurrency(
        interestSaved
      )} interest saved`;
      document.getElementById("extraPaymentSavings").textContent = savingsText;
      document.getElementById("extraPaymentSavings").style.display = "block";
    }
  } else if (document.getElementById("extraPaymentSavings")) {
    document.getElementById("extraPaymentSavings").style.display = "none";
  }

  // Show/hide HOA sections based on form type
  const hoaSummarySection = document.getElementById("hoaSummarySection");
  const summaryHOASection = document.getElementById("summaryHOASection");
  if (hoaSummarySection) {
    hoaSummarySection.style.display =
      formType === "purchase" ? "block" : "none";
  }
  if (summaryHOASection) {
    summaryHOASection.style.display =
      formType === "purchase" ? "block" : "none";
  }
}

// Generate amortization schedule data
function generateAmortizationSchedule(
  loanAmount,
  monthlyInterestRate,
  numberOfPayments,
  monthlyPropertyTax,
  monthlyHomeInsurance,
  monthlyPMI,
  hoa,
  extraPayment = 0
) {
  const schedule = [];
  let balance = loanAmount;
  const monthlyPI =
    (loanAmount *
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

    // Calculate PMI (if applicable and LTV > 80%)
    // Fix: Use original property value for proper LTV calculation
    const originalPropertyValue =
      loanAmount /
      (1 - document.getElementById("downPaymentPercent").value / 100);
    const loanToValueRatio = (balance / originalPropertyValue) * 100;
    const pmiRate = parseFloat(document.getElementById("pmiRate").value);
    // Recalculate PMI for each payment based on current balance
    const pmi = loanToValueRatio > 80 ? (pmiRate / 100 / 12) * balance : 0;

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
        <td>${currencyFormatter.format(row.balance)}</td>
      `;
    }

    tableBody.appendChild(tr);
  }

  // Add message if table was truncated
  if (currentAmortizationData.length > displayCount) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="7" class="text-center">
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

// Update down payment amount based on percentage
function updateDownPaymentPercent() {
  const propertyValue =
    parseFloat(document.getElementById("propertyValue").value) || 0;
  const downPaymentAmount =
    parseFloat(document.getElementById("downPaymentAmount").value) || 0;

  if (propertyValue > 0 && downPaymentAmount >= 0) {
    const downPaymentPercent = (downPaymentAmount / propertyValue) * 100;
    document.getElementById("downPaymentPercent").value =
      downPaymentPercent.toFixed(2);
  }
}

// Update down payment percentage based on amount
function updateDownPaymentAmount() {
  const propertyValue =
    parseFloat(document.getElementById("propertyValue").value) || 0;
  const downPaymentPercent =
    parseFloat(document.getElementById("downPaymentPercent").value) || 0;

  if (propertyValue > 0 && downPaymentPercent >= 0) {
    const downPaymentAmount = (propertyValue * downPaymentPercent) / 100;
    document.getElementById("downPaymentAmount").value =
      downPaymentAmount.toFixed(2);
  }
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
}

// Export amortization schedule to CSV
function exportToCSV() {
  if (!amortizationData.length) {
    alert("Please calculate mortgage first.");
    return;
  }

  // Format data for CSV
  const rows = [
    [
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
    ],
  ];

  // Add data rows
  amortizationData.forEach((row) => {
    const date = `${
      row.paymentDate.getMonth() + 1
    }/${row.paymentDate.getFullYear()}`;
    rows.push([
      row.paymentNumber,
      date,
      row.payment.toFixed(2),
      row.principal.toFixed(2),
      row.interest.toFixed(2),
      row.balance.toFixed(2),
      row.propertyTax.toFixed(2),
      row.insurance.toFixed(2),
      row.pmi.toFixed(2),
      row.hoa.toFixed(2),
    ]);
  });

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
    img.src = "./logo.png";
  });
}

// Export amortization schedule to PDF
function exportToPDF() {
  if (!amortizationData.length) {
    showErrorMessage("Please calculate mortgage first.");
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
      doc.text(
        `Interest Rate: ${document.getElementById("interestRate").value}%`,
        14,
        46
      );
      doc.text(
        `Loan Term: ${document.getElementById("loanTerm").value} years`,
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
      currentTab === "heloc" ? "HELOC Summary" : "Mortgage Summary";
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
        const appraisedValue = parseFloat(
          document.getElementById("appraisedValue").value || 0
        );
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
        propertyTaxValue = `$${(
          (appraisedValue * refinancePropertyTax) /
          100 /
          12
        ).toLocaleString()}`;
        homeInsuranceValue = `$${refinanceHomeInsurance.toLocaleString()}`;

        // PMI calculation based on toggle (monthly vs annual)
        if (refinancePmiToggle) {
          // Annual PMI rate - convert to monthly
          pmiValue = `$${(
            (appraisedValue * refinancePmiAmount) /
            100 /
            12
          ).toLocaleString()}`;
        } else {
          // Monthly PMI amount
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
        propertyTaxValue = `$${(
          (propertyValue * propertyTaxRate) /
          100 /
          12
        ).toLocaleString()}`;
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

      // Calculate total height needed for entire section including the box
      const sectionHeight = 70; // Approximate height for title + 3 lines + box

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
    doc.text("Date", 35, y);
    doc.text("Payment", 60, y);
    doc.text("Principal", 85, y);
    doc.text("Interest", 110, y);
    doc.text("Balance", 140, y);
    if (currentTab === "heloc") {
      doc.text("Phase", 170, y);
    }

    doc.line(14, y + 2, 175, y + 2);
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
      doc.text(date, 35, y);
      doc.text("$" + row.payment.toFixed(2), 60, y);

      if (currentTab === "heloc") {
        // HELOC has different data structure
        doc.text("$" + (row.principalPayment || 0).toFixed(2), 85, y);
        doc.text("$" + row.interestPayment.toFixed(2), 110, y);
        doc.text("$" + row.balance.toFixed(2), 140, y);
        doc.text(row.phase || "", 170, y);
      } else {
        // Regular mortgage structure
        doc.text("$" + row.principal.toFixed(2), 85, y);
        doc.text("$" + row.interest.toFixed(2), 110, y);
        doc.text("$" + row.balance.toFixed(2), 140, y);
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
        doc.text("Date", 35, y);
        doc.text("Payment", 60, y);
        doc.text("Principal", 85, y);
        doc.text("Interest", 110, y);
        doc.text("Balance", 140, y);

        doc.line(14, y + 2, 175, y + 2);
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
            doc.text("Pmt #", 14, y);
            doc.text("Date", 30, y);
            doc.text("Payment", 50, y);
            doc.text("Principal", 70, y);
            doc.text("Interest", 92, y);
            doc.text("Balance", 115, y);
            doc.text("Cum. Interest", 145, y);
            doc.text("Cum. Principal", 175, y);

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
            doc.text(date, 30, y, { align: "left" });
            doc.text(
              "$" +
                row.payment.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              50,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                row.principal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              70,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                row.interest.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              92,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                row.balance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              115,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                totalInterestPaid.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              145,
              y,
              { align: "left" }
            );
            doc.text(
              "$" +
                totalPrincipalPaid.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              175,
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
            `Total Cost: ${formatCurrency(
              comparisonData.bestOption.totalCost
            )}`,
            14,
            yPosition
          );
          yPosition += 7;

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
});
