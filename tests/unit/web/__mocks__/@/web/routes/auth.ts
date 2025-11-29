/**
 * Mock for @/web/routes/auth.ts
 */

export const createAuthRouter = jest.fn(() => ({
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
