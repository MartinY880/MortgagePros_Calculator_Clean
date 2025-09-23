/**
 * UIManager - Handles all user interface operations and interactions
 */

class UIManager {
  constructor() {
    this.activeNotifications = new Map();
    this.notificationId = 0;
    this.currentTheme = localStorage.getItem("mtgpros-theme") || "light";
    this.animationDuration = 300; // Default animation duration in ms
  }

  /**
   * Show notification message to user
   * @param {string} message - Message to display
   * @param {string} type - Notification type ('success', 'error', 'warning', 'info')
   * @param {number} duration - Duration in ms (0 for persistent)
   * @returns {string} Notification ID for manual dismissal
   */
  showNotification(message, type = "info", duration = 5000) {
    const id = `notification-${++this.notificationId}`;

    // Create notification element
    const notification = document.createElement("div");
    notification.id = id;
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">${this.getNotificationIcon(type)}</div>
        <div class="notification-message">${message}</div>
        <button class="notification-close" onclick="window.uiManager.dismissNotification('${id}')">&times;</button>
      </div>
    `;

    // Add to container
    let container = document.getElementById("notification-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "notification-container";
      container.className = "notification-container";
      document.body.appendChild(container);
    }

    container.appendChild(notification);
    this.activeNotifications.set(id, notification);

    // Animate in
    setTimeout(() => notification.classList.add("show"), 10);

    // Auto-dismiss if duration specified
    if (duration > 0) {
      setTimeout(() => this.dismissNotification(id), duration);
    }

    return id;
  }

  /**
   * Dismiss notification by ID
   * @param {string} id - Notification ID to dismiss
   */
  dismissNotification(id) {
    const notification = this.activeNotifications.get(id);
    if (!notification) return;

    notification.classList.remove("show");
    notification.classList.add("hide");

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      this.activeNotifications.delete(id);
    }, this.animationDuration);
  }

  /**
   * Get icon for notification type
   * @param {string} type - Notification type
   * @returns {string} Icon HTML
   */
  getNotificationIcon(type) {
    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };
    return icons[type] || icons.info;
  }

  /**
   * Show loading spinner
   * @param {string} message - Loading message
   * @param {string} containerId - Container element ID
   */
  showLoading(message = "Loading...", containerId = null) {
    const loadingHtml = `
      <div class="loading-overlay" id="loading-overlay">
        <div class="loading-content">
          <div class="spinner"></div>
          <div class="loading-message">${message}</div>
        </div>
      </div>
    `;

    if (containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        container.insertAdjacentHTML("beforeend", loadingHtml);
      }
    } else {
      document.body.insertAdjacentHTML("beforeend", loadingHtml);
    }
  }

  /**
   * Hide loading spinner
   * @param {string} containerId - Container element ID
   */
  hideLoading(containerId = null) {
    const selector = containerId
      ? `#${containerId} .loading-overlay`
      : ".loading-overlay";
    const loading = document.querySelector(selector);
    if (loading) {
      loading.classList.add("fade-out");
      setTimeout(() => {
        if (loading.parentNode) {
          loading.parentNode.removeChild(loading);
        }
      }, this.animationDuration);
    }
  }

  /**
   * Show modal dialog
   * @param {string} title - Modal title
   * @param {string} content - Modal content HTML
   * @param {Object} options - Modal options
   * @returns {Promise} Promise that resolves with user action
   */
  showModal(title, content, options = {}) {
    return new Promise((resolve) => {
      const {
        showCancel = true,
        confirmText = "OK",
        cancelText = "Cancel",
        confirmClass = "btn-primary",
        size = "medium",
      } = options;

      const modalId = `modal-${Date.now()}`;
      const modalHtml = `
        <div class="modal-overlay" id="${modalId}">
          <div class="modal-dialog modal-${size}">
            <div class="modal-header">
              <h3 class="modal-title">${title}</h3>
              <button class="modal-close" data-action="cancel">&times;</button>
            </div>
            <div class="modal-body">
              ${content}
            </div>
            <div class="modal-footer">
              ${
                showCancel
                  ? `<button class="btn btn-secondary" data-action="cancel">${cancelText}</button>`
                  : ""
              }
              <button class="btn ${confirmClass}" data-action="confirm">${confirmText}</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modalHtml);
      const modal = document.getElementById(modalId);

      // Add event listeners
      modal.addEventListener("click", (e) => {
        const action = e.target.dataset.action;
        if (action || e.target === modal) {
          this.closeModal(modalId);
          resolve(action === "confirm");
        }
      });

      // Show modal
      setTimeout(() => modal.classList.add("show"), 10);

      // ESC key support
      const escHandler = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          this.closeModal(modalId);
          resolve(false);
        }
      };
      document.addEventListener("keydown", escHandler);
    });
  }

  /**
   * Close modal by ID
   * @param {string} modalId - Modal element ID
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove("show");
    modal.classList.add("hide");

    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, this.animationDuration);
  }

  /**
   * Toggle theme between light and dark
   */
  toggleTheme() {
    const newTheme = this.currentTheme === "light" ? "dark" : "light";
    this.setTheme(newTheme);
  }

  /**
   * Set application theme
   * @param {string} theme - Theme name ('light' or 'dark')
   */
  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mtgpros-theme", theme);

    // Update theme toggle button
    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      themeBtn.textContent = theme === "light" ? "🌙" : "☀️";
      themeBtn.title = `Switch to ${theme === "light" ? "dark" : "light"} mode`;
    }

    this.showNotification(`Switched to ${theme} theme`, "success", 2000);
  }

  /**
   * Initialize theme on page load
   */
  initializeTheme() {
    this.setTheme(this.currentTheme);
  }

  /**
   * Animate element with specified animation
   * @param {HTMLElement|string} element - Element or selector
   * @param {string} animation - Animation class name
   * @param {number} duration - Animation duration in ms
   * @returns {Promise} Promise that resolves when animation completes
   */
  animateElement(element, animation, duration = this.animationDuration) {
    return new Promise((resolve) => {
      const el =
        typeof element === "string" ? document.querySelector(element) : element;
      if (!el) {
        resolve();
        return;
      }

      el.classList.add(animation);

      setTimeout(() => {
        el.classList.remove(animation);
        resolve();
      }, duration);
    });
  }

  /**
   * Fade in element
   * @param {HTMLElement|string} element - Element or selector
   * @param {number} duration - Fade duration in ms
   */
  fadeIn(element, duration = this.animationDuration) {
    return this.animateElement(element, "fade-in", duration);
  }

  /**
   * Fade out element
   * @param {HTMLElement|string} element - Element or selector
   * @param {number} duration - Fade duration in ms
   */
  fadeOut(element, duration = this.animationDuration) {
    return this.animateElement(element, "fade-out", duration);
  }

  /**
   * Slide in element from direction
   * @param {HTMLElement|string} element - Element or selector
   * @param {string} direction - Direction ('up', 'down', 'left', 'right')
   * @param {number} duration - Animation duration in ms
   */
  slideIn(element, direction = "down", duration = this.animationDuration) {
    return this.animateElement(element, `slide-in-${direction}`, duration);
  }

  /**
   * Update progress bar
   * @param {string} progressId - Progress bar element ID
   * @param {number} percentage - Progress percentage (0-100)
   * @param {string} label - Optional label text
   */
  updateProgress(progressId, percentage, label = "") {
    const progressBar = document.getElementById(progressId);
    if (!progressBar) return;

    const fill = progressBar.querySelector(".progress-fill");
    const text = progressBar.querySelector(".progress-text");

    if (fill) {
      fill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }

    if (text) {
      text.textContent = label || `${Math.round(percentage)}%`;
    }
  }

  /**
   * Highlight form field with error
   * @param {string} fieldId - Field element ID
   * @param {string} errorMessage - Error message to display
   */
  showFieldError(fieldId, errorMessage) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    // Add error class
    field.classList.add("field-error");

    // Remove existing error message
    this.clearFieldError(fieldId);

    // Add error message
    const errorElement = document.createElement("div");
    errorElement.className = "field-error-message";
    errorElement.textContent = errorMessage;
    errorElement.id = `${fieldId}-error`;

    field.parentNode.insertBefore(errorElement, field.nextSibling);

    // Auto-clear on input
    const clearError = () => {
      this.clearFieldError(fieldId);
      field.removeEventListener("input", clearError);
      field.removeEventListener("change", clearError);
    };

    field.addEventListener("input", clearError);
    field.addEventListener("change", clearError);
  }

  /**
   * Clear field error styling and message
   * @param {string} fieldId - Field element ID
   */
  clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorMsg = document.getElementById(`${fieldId}-error`);

    if (field) {
      field.classList.remove("field-error");
    }

    if (errorMsg) {
      errorMsg.remove();
    }
  }

  /**
   * Clear all field errors in container
   * @param {string} containerId - Container element ID
   */
  clearAllFieldErrors(containerId = null) {
    const container = containerId
      ? document.getElementById(containerId)
      : document;
    if (!container) return;

    // Remove error classes
    const errorFields = container.querySelectorAll(".field-error");
    errorFields.forEach((field) => field.classList.remove("field-error"));

    // Remove error messages
    const errorMessages = container.querySelectorAll(".field-error-message");
    errorMessages.forEach((msg) => msg.remove());
  }

  /**
   * Scroll to element smoothly
   * @param {string} elementId - Element ID to scroll to
   * @param {number} offset - Offset from top in pixels
   */
  scrollToElement(elementId, offset = 0) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const elementPosition = element.offsetTop - offset;
    window.scrollTo({
      top: elementPosition,
      behavior: "smooth",
    });
  }

  /**
   * Toggle element visibility
   * @param {string} elementId - Element ID
   * @param {boolean} show - Force show/hide (optional)
   */
  toggleVisibility(elementId, show = null) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (show === null) {
      element.classList.toggle("hidden");
    } else {
      element.classList.toggle("hidden", !show);
    }
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification("Copied to clipboard", "success", 2000);
      return true;
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      this.showNotification("Failed to copy to clipboard", "error", 3000);
      return false;
    }
  }

  /**
   * Format and display calculation results in UI
   * @param {Object} results - Calculation results
   * @param {string} containerId - Container element ID
   */
  displayResults(results, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear previous results
    container.innerHTML = "";

    // Add results with animation
    Object.entries(results).forEach(([key, value], index) => {
      const resultElement = document.createElement("div");
      resultElement.className = "result-item";
      resultElement.innerHTML = `
        <div class="result-label">${this.formatLabel(key)}</div>
        <div class="result-value">${this.formatResultValue(key, value)}</div>
      `;

      container.appendChild(resultElement);

      // Stagger animations
      setTimeout(() => {
        this.fadeIn(resultElement);
      }, index * 100);
    });
  }

  /**
   * Format label for display
   * @param {string} key - Result key
   * @returns {string} Formatted label
   */
  formatLabel(key) {
    const labels = {
      monthlyPayment: "Monthly Payment",
      totalInterest: "Total Interest",
      totalPaid: "Total Amount Paid",
      payoffTime: "Payoff Time",
      loanToValue: "Loan-to-Value Ratio",
      debtToIncome: "Debt-to-Income Ratio",
    };

    return (
      labels[key] ||
      key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
    );
  }

  /**
   * Format result value for display
   * @param {string} key - Result key
   * @param {*} value - Result value
   * @returns {string} Formatted value
   */
  formatResultValue(key, value) {
    if (typeof value === "number") {
      if (
        key.includes("Payment") ||
        key.includes("Interest") ||
        key.includes("Paid") ||
        key.includes("Amount")
      ) {
        return window.NumberFormatter
          ? NumberFormatter.formatCurrency(value)
          : `$${value.toFixed(2)}`;
      } else if (
        key.includes("Rate") ||
        key.includes("Ratio") ||
        key.includes("Percent")
      ) {
        return window.NumberFormatter
          ? NumberFormatter.formatPercentage(value)
          : `${value.toFixed(2)}%`;
      } else if (
        key.includes("Time") &&
        typeof value === "object" &&
        value.years !== undefined
      ) {
        return window.NumberFormatter
          ? NumberFormatter.formatDuration(value.years, value.months)
          : `${value.years} years, ${value.months} months`;
      }
    }

    return String(value);
  }
}

// Initialize global UI manager
if (typeof window !== "undefined") {
  window.uiManager = new UIManager();

  // Initialize theme on page load
  document.addEventListener("DOMContentLoaded", () => {
    window.uiManager.initializeTheme();
  });
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = UIManager;
} else {
  window.UIManager = UIManager;
}
