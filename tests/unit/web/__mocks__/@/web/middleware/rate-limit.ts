/**
 * Mock for @/web/middleware/rate-limit.ts
 */

export const createRateLimiter = jest.fn(() => jest.fn((req, res, next) => {
  next();
}));
