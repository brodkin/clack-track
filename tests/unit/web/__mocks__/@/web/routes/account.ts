/**
 * Mock for @/web/routes/account.ts
 */

export const createAccountRouter = jest.fn(() => ({
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
