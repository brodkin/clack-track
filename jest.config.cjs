/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // ESM support for TypeScript files
  extensionsToTreatAsEsm: ['.ts'],

  // Test file patterns
  testMatch: ['**/tests/**/*.test.ts'],

  // Module file extensions
  moduleFileExtensions: ['ts', 'js'],

  // Coverage configuration
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/types.ts', '!src/**/index.ts'],

  // Coverage thresholds (SPICE requirement: 80% for application code)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Clear mocks between tests for clean test isolation
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,
};
