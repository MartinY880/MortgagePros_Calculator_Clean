/**
 * MortgagePros Calculator Version Configuration
 *
 * Update this file to change the version number across the entire application.
 * This ensures consistency between package.json, UI display, and any other version references.
 */

// Main application version
const APP_VERSION = "12.5.0";

// Version metadata
const VERSION_INFO = {
  version: APP_VERSION,
  name: "MortgagePros Calculator",
  codename: "Enhanced Edition", // Optional: Add codenames for major releases
  releaseDate: "2025-09-23",
  buildType: "Production", // Options: "Production", "Beta", "Alpha", "Development"

  // Detailed version components
  major: 12,
  minor: 0,
  patch: 0,

  // Release notes for this version
  releaseNotes: [
    "Major version 12.5.0 - Enhanced Edition",
    "Centralized version management system",
    "Interactive version badge with release notes",
    "Automated version syncing across all files",
    "Professional version documentation system",
    "All previous v12.5.0 optimizations and fixes included",
  ],
};

// Helper functions
const VersionUtils = {
  /**
   * Get the full version string
   * @returns {string} Version string (e.g., "12.5.0")
   */
  getVersion: () => APP_VERSION,

  /**
   * Get version with build type if not production
   * @returns {string} Version with build type (e.g., "12.5.0-beta")
   */
  getDisplayVersion: () => {
    return VERSION_INFO.buildType === "Production"
      ? APP_VERSION
      : `${APP_VERSION}-${VERSION_INFO.buildType.toLowerCase()}`;
  },

  /**
   * Get formatted version info for about dialogs
   * @returns {string} Formatted version info
   */
  getFullVersionInfo: () => {
    return (
      `${VERSION_INFO.name} v${VersionUtils.getDisplayVersion()}\n` +
      `Release: ${VERSION_INFO.codename}\n` +
      `Date: ${VERSION_INFO.releaseDate}`
    );
  },

  /**
   * Check if this is a pre-release version
   * @returns {boolean} True if beta/alpha/development
   */
  isPreRelease: () => VERSION_INFO.buildType !== "Production",
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  // Node.js environment
  module.exports = { APP_VERSION, VERSION_INFO, VersionUtils };
} else {
  // Browser environment - make available globally
  window.AppVersion = { APP_VERSION, VERSION_INFO, VersionUtils };
}
