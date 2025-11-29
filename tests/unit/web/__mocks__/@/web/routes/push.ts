/**
 * Mock for @/web/routes/push.ts
 * Prevents execution of actual push route module during tests
 */

export const pushRouter = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};
