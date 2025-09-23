#!/usr/bin/env node

/**
 * Version Sync Script
 *
 * This script reads the version from version.js and updates package.json
 * Run this script whenever you update the APP_VERSION in version.js
 *
 * Usage: node sync-version.js
 */

const fs = require("fs");
const path = require("path");

try {
  // Read version from version.js
  const versionPath = path.join(__dirname, "src", "version.js");
  const versionContent = fs.readFileSync(versionPath, "utf8");

  // Extract APP_VERSION using regex
  const versionMatch = versionContent.match(/const APP_VERSION = "([^"]+)"/);
  if (!versionMatch) {
    throw new Error("Could not find APP_VERSION in version.js");
  }

  const newVersion = versionMatch[1];
  console.log(`Found version: ${newVersion}`);

  // Read package.json
  const packagePath = path.join(__dirname, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  // Update version
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;

  // Write updated package.json
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n");

  console.log(
    `✅ Version updated in package.json: ${oldVersion} → ${newVersion}`
  );

  // Also update any build scripts or other files that reference version
  console.log("\n📋 Remember to also update:");
  console.log("   • Git tag when ready to release");
  console.log("   • Release notes in GitHub");
  console.log("   • Any documentation files");
} catch (error) {
  console.error("❌ Error syncing version:", error.message);
  process.exit(1);
}
