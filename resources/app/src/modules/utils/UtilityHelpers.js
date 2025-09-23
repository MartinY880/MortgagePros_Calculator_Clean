/**
 * StorageUtils - Utility functions for local storage and data persistence
 */

class StorageUtils {
  /**
   * Set item in localStorage with error handling
   * @param {string} key - Storage key
   * @param {*} value - Value to store (will be JSON stringified)
   * @param {number} ttl - Time to live in milliseconds (optional)
   * @returns {boolean} Success status
   */
  static setItem(key, value, ttl = null) {
    try {
      const item = {
        value: value,
        timestamp: Date.now(),
        ttl: ttl,
      };

      localStorage.setItem(key, JSON.stringify(item));
      return true;
    } catch (error) {
      console.error("Error setting localStorage item:", error);
      return false;
    }
  }

  /**
   * Get item from localStorage with error handling and TTL support
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Stored value or default
   */
  static getItem(key, defaultValue = null) {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return defaultValue;

      const item = JSON.parse(itemStr);

      // Check if item has expired
      if (item.ttl && Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(key);
        return defaultValue;
      }

      return item.value !== undefined ? item.value : defaultValue;
    } catch (error) {
      console.error("Error getting localStorage item:", error);
      return defaultValue;
    }
  }

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  static removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error("Error removing localStorage item:", error);
      return false;
    }
  }

  /**
   * Clear all localStorage items
   * @returns {boolean} Success status
   */
  static clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error("Error clearing localStorage:", error);
      return false;
    }
  }

  /**
   * Get all keys from localStorage with optional prefix filter
   * @param {string} prefix - Key prefix filter
   * @returns {Array<string>} Array of keys
   */
  static getKeys(prefix = "") {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      console.error("Error getting localStorage keys:", error);
      return [];
    }
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} Availability status
   */
  static isAvailable() {
    try {
      const testKey = "__localStorage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get localStorage usage information
   * @returns {Object} Usage statistics
   */
  static getUsageInfo() {
    if (!StorageUtils.isAvailable()) {
      return { available: false, used: 0, remaining: 0, total: 0 };
    }

    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }

      // Typical localStorage limit is 5-10MB, we'll use 5MB as estimate
      const total = 5 * 1024 * 1024; // 5MB in bytes
      const remaining = total - used;

      return {
        available: true,
        used: used,
        remaining: Math.max(0, remaining),
        total: total,
        usedPercentage: Math.round((used / total) * 100),
      };
    } catch (error) {
      console.error("Error getting storage usage info:", error);
      return { available: true, used: 0, remaining: 0, total: 0 };
    }
  }

  /**
   * Clean expired items from localStorage
   * @returns {number} Number of items cleaned
   */
  static cleanExpired() {
    let cleaned = 0;

    try {
      const keys = StorageUtils.getKeys();

      keys.forEach((key) => {
        try {
          const itemStr = localStorage.getItem(key);
          if (itemStr) {
            const item = JSON.parse(itemStr);

            // Check if item has TTL and is expired
            if (item.ttl && Date.now() - item.timestamp > item.ttl) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        } catch (error) {
          // If we can't parse an item, it might be corrupted, remove it
          localStorage.removeItem(key);
          cleaned++;
        }
      });
    } catch (error) {
      console.error("Error cleaning expired items:", error);
    }

    return cleaned;
  }
}

/**
 * EventUtils - Utility functions for event handling and management
 */

class EventUtils {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Add event listener with automatic cleanup tracking
   * @param {Element|Window|Document} element - Element to attach listener to
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   * @param {Object|boolean} options - Event options
   * @returns {Function} Cleanup function
   */
  static addEventListener(element, event, handler, options = {}) {
    if (!element || !event || typeof handler !== "function") {
      return () => {};
    }

    element.addEventListener(event, handler, options);

    // Return cleanup function
    return () => {
      element.removeEventListener(event, handler, options);
    };
  }

  /**
   * Add multiple event listeners to an element
   * @param {Element|Window|Document} element - Element to attach listeners to
   * @param {Object} events - Object with event names as keys and handlers as values
   * @param {Object|boolean} options - Event options
   * @returns {Function} Cleanup function for all listeners
   */
  static addMultipleEventListeners(element, events, options = {}) {
    const cleanupFunctions = [];

    Object.entries(events).forEach(([event, handler]) => {
      const cleanup = EventUtils.addEventListener(
        element,
        event,
        handler,
        options
      );
      cleanupFunctions.push(cleanup);
    });

    // Return function that cleans up all listeners
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }

  /**
   * Dispatch custom event
   * @param {Element|Window|Document} element - Element to dispatch from
   * @param {string} eventName - Custom event name
   * @param {Object} detail - Event detail data
   * @param {Object} options - Event options
   */
  static dispatchEvent(element, eventName, detail = {}, options = {}) {
    if (!element || !eventName) return;

    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      cancelable: true,
      ...options,
    });

    element.dispatchEvent(event);
  }

  /**
   * Wait for DOM element to be available
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Element>} Promise that resolves with element
   */
  static waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Wait for DOM to be ready
   * @returns {Promise} Promise that resolves when DOM is ready
   */
  static waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", resolve, { once: true });
      } else {
        resolve();
      }
    });
  }

  /**
   * Prevent default behavior and stop propagation
   * @param {Event} event - Event object
   */
  static preventDefault(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Get mouse/touch position from event
   * @param {Event} event - Mouse or touch event
   * @returns {Object} Position object with x and y coordinates
   */
  static getEventPosition(event) {
    if (event.touches && event.touches.length > 0) {
      return {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      return {
        x: event.changedTouches[0].clientX,
        y: event.changedTouches[0].clientY,
      };
    } else {
      return {
        x: event.clientX || 0,
        y: event.clientY || 0,
      };
    }
  }

  /**
   * Check if click/touch is outside element
   * @param {Event} event - Click or touch event
   * @param {Element} element - Element to check against
   * @returns {boolean} True if click is outside element
   */
  static isClickOutside(event, element) {
    if (!element || !event.target) return true;
    return !element.contains(event.target);
  }
}

/**
 * FormUtils - Utility functions for form handling and validation
 */

class FormUtils {
  /**
   * Get form data as object
   * @param {HTMLFormElement|string} form - Form element or selector
   * @param {boolean} includeEmpty - Include empty values
   * @returns {Object} Form data object
   */
  static getFormData(form, includeEmpty = false) {
    const formElement =
      typeof form === "string" ? document.querySelector(form) : form;
    if (!formElement) return {};

    const formData = new FormData(formElement);
    const result = {};

    for (const [key, value] of formData.entries()) {
      if (includeEmpty || (value !== "" && value !== null)) {
        // Handle multiple values (like checkboxes with same name)
        if (result[key]) {
          if (Array.isArray(result[key])) {
            result[key].push(value);
          } else {
            result[key] = [result[key], value];
          }
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Set form data from object
   * @param {HTMLFormElement|string} form - Form element or selector
   * @param {Object} data - Data object to populate form
   */
  static setFormData(form, data) {
    const formElement =
      typeof form === "string" ? document.querySelector(form) : form;
    if (!formElement || !data) return;

    Object.entries(data).forEach(([key, value]) => {
      const elements = formElement.elements[key];
      if (!elements) return;

      if (elements.type === "radio" || elements.type === "checkbox") {
        // Handle radio buttons and checkboxes
        if (elements.length) {
          // Multiple elements with same name
          Array.from(elements).forEach((element) => {
            if (Array.isArray(value)) {
              element.checked = value.includes(element.value);
            } else {
              element.checked = element.value === String(value);
            }
          });
        } else {
          // Single element
          elements.checked = Array.isArray(value)
            ? value.includes(elements.value)
            : elements.value === String(value);
        }
      } else {
        // Handle input, select, textarea
        elements.value = value;
      }
    });
  }

  /**
   * Clear form data
   * @param {HTMLFormElement|string} form - Form element or selector
   */
  static clearForm(form) {
    const formElement =
      typeof form === "string" ? document.querySelector(form) : form;
    if (!formElement) return;

    formElement.reset();
  }

  /**
   * Validate form using HTML5 validation
   * @param {HTMLFormElement|string} form - Form element or selector
   * @returns {Object} Validation result
   */
  static validateForm(form) {
    const formElement =
      typeof form === "string" ? document.querySelector(form) : form;
    if (!formElement) return { isValid: false, errors: ["Form not found"] };

    const isValid = formElement.checkValidity();
    const errors = [];

    if (!isValid) {
      const invalidElements = formElement.querySelectorAll(":invalid");
      invalidElements.forEach((element) => {
        if (element.validationMessage) {
          errors.push({
            field: element.name || element.id,
            message: element.validationMessage,
            element: element,
          });
        }
      });
    }

    return { isValid, errors };
  }

  /**
   * Auto-format input fields (phone, currency, etc.)
   * @param {HTMLInputElement} input - Input element
   * @param {string} format - Format type ('phone', 'currency', 'percentage')
   */
  static autoFormatInput(input, format) {
    if (!input) return;

    const formatters = {
      phone: (value) => {
        const cleaned = value.replace(/\D/g, "");
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        return match ? `(${match[1]}) ${match[2]}-${match[3]}` : value;
      },
      currency: (value) => {
        const cleaned = value.replace(/[^\d.]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num)
          ? ""
          : num.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 2,
            });
      },
      percentage: (value) => {
        const cleaned = value.replace(/[^\d.]/g, "");
        return cleaned ? `${cleaned}%` : "";
      },
    };

    const formatter = formatters[format];
    if (!formatter) return;

    input.addEventListener("input", (e) => {
      const cursorPos = e.target.selectionStart;
      const oldValue = e.target.value;
      const newValue = formatter(oldValue);

      if (newValue !== oldValue) {
        e.target.value = newValue;
        // Try to maintain cursor position
        const newCursorPos = cursorPos + (newValue.length - oldValue.length);
        e.target.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  }
}

// Export classes
if (typeof module !== "undefined" && module.exports) {
  module.exports = { StorageUtils, EventUtils, FormUtils };
} else {
  window.StorageUtils = StorageUtils;
  window.EventUtils = EventUtils;
  window.FormUtils = FormUtils;
}
