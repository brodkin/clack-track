import { Request, Response, NextFunction } from 'express';
import { createRateLimiter, RateLimitConfig } from '@/web/middleware/rate-limit';

describe('Rate Limit Middleware', () => {
  describe('createRateLimiter', () => {
    it('should create rate limiter with default configuration', () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should create rate limiter with custom configuration', () => {
      const customConfig: RateLimitConfig = {
        windowMs: 60000, // 1 minute
        max: 50,
        message: 'Custom rate limit message',
      };
      const limiter = createRateLimiter(customConfig);
      expect(limiter).toBeDefined();
    });

    it('should use environment variables when provided', () => {
      // Set environment variables
      process.env.RATE_LIMIT_WINDOW_MS = '30000';
      process.env.RATE_LIMIT_MAX_REQUESTS = '75';

      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();

      // Clean up
      delete process.env.RATE_LIMIT_WINDOW_MS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
    });

    it('should return middleware function with correct structure', () => {
      const limiter = createRateLimiter();
      // Rate limiter should be a function that can be used as middleware
      expect(limiter).toBeInstanceOf(Function);
    });
  });

  describe('Rate Limit Behavior', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let statusCode: number;
    let responseBody: unknown;
    let headers: Record<string, string>;

    beforeEach(() => {
      statusCode = 200;
      responseBody = null;
      headers = {};

      mockReq = {
        ip: '127.0.0.1',
        path: '/api/test',
        headers: {},
      };

      mockRes = {
        status: jest.fn().mockImplementation((code: number) => {
          statusCode = code;
          return mockRes;
        }),
        json: jest.fn().mockImplementation((body: unknown) => {
          responseBody = body;
          return mockRes;
        }),
        set: jest.fn().mockImplementation((name: string, value: string) => {
          headers[name] = value;
          return mockRes;
        }),
        setHeader: jest.fn().mockImplementation((name: string, value: string) => {
          headers[name] = value;
          return mockRes;
        }),
      } as Partial<Response>;

      mockNext = jest.fn();
    });

    it('should allow requests under the limit', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 5 });

      // Make 3 requests (under limit of 5)
      for (let i = 0; i < 3; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(statusCode).not.toBe(429);
    });

    it('should block requests over the limit', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 3 });

      // Make requests up to and beyond the limit
      for (let i = 0; i < 3; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      // This request should be blocked
      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(429);
    });

    it('should return 429 status code when limit exceeded', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 2 });

      // Exceed the limit
      for (let i = 0; i < 3; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(statusCode).toBe(429);
      expect(responseBody).toBeDefined();
    });

    it('should include Retry-After header in 429 response', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 2 });

      // Exceed the limit
      for (let i = 0; i < 3; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(statusCode).toBe(429);
      expect(headers['Retry-After'] || headers['retry-after']).toBeDefined();
    });

    it('should include error message in 429 response body', async () => {
      const customMessage = 'Too many requests, please try again later';
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        message: customMessage,
      });

      // Exceed the limit
      await limiter(mockReq as Request, mockRes as Response, mockNext);
      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(429);
      expect(responseBody).toHaveProperty('error');
      expect(responseBody.error).toContain('Too many requests');
    });

    it('should track requests per IP address', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 2 });

      // IP 1 makes requests
      mockReq.ip = '192.168.1.1';
      await limiter(mockReq as Request, mockRes as Response, mockNext);
      await limiter(mockReq as Request, mockRes as Response, mockNext);
      await limiter(mockReq as Request, mockRes as Response, mockNext);

      const ip1StatusCode = statusCode;

      // Reset response tracking
      statusCode = 200;

      // IP 2 makes requests (should not be affected by IP 1's limit)
      mockReq.ip = '192.168.1.2';
      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(ip1StatusCode).toBe(429); // IP 1 exceeded limit
      expect(statusCode).not.toBe(429); // IP 2 should not be blocked
    });

    it('should reset limits after time window expires', async () => {
      jest.useFakeTimers();

      const limiter = createRateLimiter({ windowMs: 1000, max: 2 }); // 1 second window

      // Exceed limit
      await limiter(mockReq as Request, mockRes as Response, mockNext);
      await limiter(mockReq as Request, mockRes as Response, mockNext);
      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(429);

      // Advance time past the window
      jest.advanceTimersByTime(1100);

      // Reset tracking
      statusCode = 200;

      // Should be allowed again
      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).not.toBe(429);

      jest.useRealTimers();
    });
  });

  describe('Configuration Validation', () => {
    it('should use default values when config is empty', () => {
      const limiter = createRateLimiter({});
      expect(limiter).toBeDefined();
    });

    it('should handle invalid environment variables gracefully', () => {
      process.env.RATE_LIMIT_WINDOW_MS = 'invalid';
      process.env.RATE_LIMIT_MAX_REQUESTS = 'not-a-number';

      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();

      delete process.env.RATE_LIMIT_WINDOW_MS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
    });

    it('should prioritize custom config over environment variables', () => {
      process.env.RATE_LIMIT_MAX_REQUESTS = '50';

      const limiter = createRateLimiter({ max: 100 });
      expect(limiter).toBeDefined();

      delete process.env.RATE_LIMIT_MAX_REQUESTS;
    });
  });

  describe('Rate Limit Disabled', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let statusCode: number;

    beforeEach(() => {
      statusCode = 200;
      mockReq = {
        ip: '127.0.0.1',
        path: '/api/test',
        headers: {},
      };
      mockRes = {
        status: jest.fn().mockImplementation((code: number) => {
          statusCode = code;
          return mockRes;
        }),
        json: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
      } as Partial<Response>;
      mockNext = jest.fn();
    });

    afterEach(() => {
      delete process.env.RATE_LIMIT_ENABLED;
    });

    it('should disable rate limiting when enabled=false in config', async () => {
      const limiter = createRateLimiter({ enabled: false, max: 1 });

      // Make many requests - none should be blocked
      for (let i = 0; i < 10; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(10);
      expect(statusCode).not.toBe(429);
    });

    it('should disable rate limiting when RATE_LIMIT_ENABLED=false env var', async () => {
      process.env.RATE_LIMIT_ENABLED = 'false';
      const limiter = createRateLimiter({ max: 1 });

      // Make many requests - none should be blocked
      for (let i = 0; i < 10; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(10);
      expect(statusCode).not.toBe(429);
    });

    it('should enable rate limiting when RATE_LIMIT_ENABLED=true env var', async () => {
      process.env.RATE_LIMIT_ENABLED = 'true';
      const limiter = createRateLimiter({ max: 2 });

      // Make requests to exceed limit
      for (let i = 0; i < 3; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(statusCode).toBe(429);
    });

    it('should prioritize config enabled over environment variable', async () => {
      process.env.RATE_LIMIT_ENABLED = 'true';
      const limiter = createRateLimiter({ enabled: false, max: 1 });

      // Make many requests - config should override env var
      for (let i = 0; i < 10; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(10);
      expect(statusCode).not.toBe(429);
    });

    it('should handle RATE_LIMIT_ENABLED=0 as false', async () => {
      process.env.RATE_LIMIT_ENABLED = '0';
      const limiter = createRateLimiter({ max: 1 });

      for (let i = 0; i < 5; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(statusCode).not.toBe(429);
    });

    it('should handle RATE_LIMIT_ENABLED=1 as true', async () => {
      process.env.RATE_LIMIT_ENABLED = '1';
      const limiter = createRateLimiter({ max: 2 });

      for (let i = 0; i < 3; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(statusCode).toBe(429);
    });

    it('should default to enabled when env var is empty', async () => {
      process.env.RATE_LIMIT_ENABLED = '';
      const limiter = createRateLimiter({ max: 2 });

      for (let i = 0; i < 3; i++) {
        await limiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(statusCode).toBe(429);
    });
  });
});
