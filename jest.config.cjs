/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',

  // ESM support for TypeScript files
  extensionsToTreatAsEsm: ['.ts'],

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Global setup file
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],

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

  // Multi-environment project configuration
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
    },
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      testTimeout: 60000, // E2E tests may take longer
    },
    {
      displayName: 'web',
      testEnvironment: 'jsdom', // Web UI tests need DOM
      testMatch: ['<rootDir>/tests/web/**/*.test.ts'],
    },
  ],

  // Module name mapping for mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
};
