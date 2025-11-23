/**
 * Global Jest Setup Configuration
 *
 * This file runs once before all test suites.
 * Use it for:
 * - Setting up global test environment variables
 * - Configuring test timeouts
 * - Setting up global mocks
 * - Initializing test utilities
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Configure global test timeout (30 seconds)
jest.setTimeout(30000);

// Example: Add custom matchers
// expect.extend({
//   toBeValidCharacterCode(received: number) {
//     const pass = received >= 0 && received <= 69;
//     return {
//       pass,
//       message: () =>
//         `expected ${received} to be a valid Vestaboard character code (0-69)`,
//     };
//   },
// });

// Example: Mock console methods to reduce test noise
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

export {};
