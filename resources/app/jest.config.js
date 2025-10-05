module.exports = {
  // Default to node; specific DOM integration tests declare `@jest-environment jsdom` at file top.
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.js"],
  verbose: true,
  collectCoverage: true,
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov"],
};
