/** @type {import('jest').Config} */

// Set NODE_ENV to 'test' BEFORE any imports happen
// This must come before ts-jest loads files, which may import dotenv
process.env.NODE_ENV = 'test';

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
  // Foundation scope: ONLY measure env.ts and errors.ts
  // Other modules are out-of-scope for this iteration
  coverageThreshold: {
    './src/config/env.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/types/errors.ts': {
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
      transform: {
        '^.+\\.ts$': [
          'ts-jest',
          {
            isolatedModules: true,
            diagnostics: {
              ignoreCodes: [151002, 2339, 2307],
            },
            tsconfig: {
              module: 'commonjs',
              esModuleInterop: true,
            },
          },
        ],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/$1',
        '(.+)\\.js$': '$1',
      },
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      extensionsToTreatAsEsm: ['.ts'],
      transform: {
        '^.+\\.ts$': [
          'ts-jest',
          {
            isolatedModules: true,
            diagnostics: {
              ignoreCodes: [151002, 2339, 2307, 7016, 2322, 2345],
            },
            tsconfig: {
              module: 'commonjs',
              esModuleInterop: true,
            },
          },
        ],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      testTimeout: 60000, // E2E tests may take longer
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/$1',
        '(.+)\\.js$': '$1',
      },
    },
    {
      displayName: 'web',
      preset: 'ts-jest',
      testEnvironment: 'jsdom', // Web UI tests need DOM
      testMatch: ['<rootDir>/tests/web/**/*.test.ts', '<rootDir>/tests/web/**/*.test.tsx'],
      extensionsToTreatAsEsm: ['.ts', '.tsx'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '(.+)\\.js$': '$1',
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.web.setup.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
            tsconfig: {
              jsx: 'react-jsx',
              module: 'esnext',
              target: 'es2022',
              types: ['jest', 'node'],
            },
          },
        ],
      },
    },
  ],

  // Module name mapping for mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
};
