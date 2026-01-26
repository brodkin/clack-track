/* eslint-disable @typescript-eslint/no-require-imports */
const request = require('supertest');
const express = require('express');
/* eslint-enable @typescript-eslint/no-require-imports */
import { Express } from 'express';
import { createRateLimiter } from '@/web/middleware/rate-limit';

describe('Rate Limit Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('API Route Rate Limiting', () => {
    it('should apply rate limiting to /api/* routes', async () => {
      // Configure rate limiter with low limit for testing
      // enabled: true ensures rate limiting works regardless of env var
      const limiter = createRateLimiter({ windowMs: 60000, max: 3, enabled: true });
      app.use('/api', limiter);

      app.get('/api/test', (req, res) => {
        res.json({ success: true });
      });

      // Make requests up to the limit
      for (let i = 0; i < 3; i++) {
        const response = await request(app).get('/api/test');
        expect(response.status).toBe(200);
      }

      // Fourth request should be rate limited
      const blockedResponse = await request(app).get('/api/test');
      expect(blockedResponse.status).toBe(429);
    });

    it('should return 429 with error message when rate limited', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 2, enabled: true });
      app.use('/api', limiter);

      app.get('/api/endpoint', (req, res) => {
        res.json({ data: 'test' });
      });

      // Exceed limit
      await request(app).get('/api/endpoint');
      await request(app).get('/api/endpoint');
      const response = await request(app).get('/api/endpoint');

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/too many requests/i);
    });

    it('should include Retry-After header in rate limit response', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 1, enabled: true });
      app.use('/api', limiter);

      app.get('/api/limited', (req, res) => {
        res.json({ message: 'ok' });
      });

      // Exceed limit
      await request(app).get('/api/limited');
      const response = await request(app).get('/api/limited');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('should not rate limit non-API routes', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 2, enabled: true });
      app.use('/api', limiter);

      app.get('/public', (req, res) => {
        res.json({ public: true });
      });

      // Make many requests to non-API route
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/public');
        expect(response.status).toBe(200);
      }
    });

    it('should rate limit different API endpoints independently under same path', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 3, enabled: true });
      app.use('/api', limiter);

      app.get('/api/endpoint1', (req, res) => {
        res.json({ endpoint: 1 });
      });

      app.get('/api/endpoint2', (req, res) => {
        res.json({ endpoint: 2 });
      });

      // Requests to both endpoints count toward same IP limit
      await request(app).get('/api/endpoint1');
      await request(app).get('/api/endpoint2');
      await request(app).get('/api/endpoint1');

      // Fourth request should be blocked regardless of endpoint
      const response = await request(app).get('/api/endpoint2');
      expect(response.status).toBe(429);
    });

    it('should handle concurrent requests correctly', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 5, enabled: true });
      app.use('/api', limiter);

      app.get('/api/concurrent', (req, res) => {
        res.json({ success: true });
      });

      // Make concurrent requests
      const requests = Array.from({ length: 10 }, () => request(app).get('/api/concurrent'));

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;
      const blockedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeLessThanOrEqual(5);
      expect(blockedCount).toBeGreaterThan(0);
      expect(successCount + blockedCount).toBe(10);
    });

    it('should reset rate limit after time window', async () => {
      jest.useFakeTimers();

      try {
        const limiter = createRateLimiter({ windowMs: 1000, max: 2, enabled: true });
        app.use('/api', limiter);

        app.get('/api/reset-test', (req, res) => {
          res.json({ ok: true });
        });

        // Exceed limit
        await request(app).get('/api/reset-test');
        await request(app).get('/api/reset-test');
        let response = await request(app).get('/api/reset-test');
        expect(response.status).toBe(429);

        // Advance time past window (use async version for proper promise handling)
        await jest.advanceTimersByTimeAsync(1100);

        // Should be allowed again
        response = await request(app).get('/api/reset-test');
        expect(response.status).toBe(200);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should respect custom window duration', async () => {
      jest.useFakeTimers();

      try {
        const limiter = createRateLimiter({ windowMs: 2000, max: 1, enabled: true });
        app.use('/api', limiter);

        app.get('/api/window', (req, res) => {
          res.json({ ok: true });
        });

        // First request succeeds
        let response = await request(app).get('/api/window');
        expect(response.status).toBe(200);

        // Second request blocked
        response = await request(app).get('/api/window');
        expect(response.status).toBe(429);

        // After less than window time, still blocked (use async version)
        await jest.advanceTimersByTimeAsync(1000);
        response = await request(app).get('/api/window');
        expect(response.status).toBe(429);

        // After full window, allowed (use async version)
        await jest.advanceTimersByTimeAsync(1100);
        response = await request(app).get('/api/window');
        expect(response.status).toBe(200);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should respect custom max requests limit', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 10, enabled: true });
      app.use('/api', limiter);

      app.get('/api/max', (req, res) => {
        res.json({ count: true });
      });

      // Make 10 requests (all should succeed)
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/api/max');
        expect(response.status).toBe(200);
      }

      // 11th request should be blocked
      const response = await request(app).get('/api/max');
      expect(response.status).toBe(429);
    });

    it('should use custom error message when provided', async () => {
      const customMessage = 'API rate limit exceeded. Please wait before retrying.';
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        message: customMessage,
        enabled: true,
      });
      app.use('/api', limiter);

      app.get('/api/custom', (req, res) => {
        res.json({ test: true });
      });

      await request(app).get('/api/custom');
      const response = await request(app).get('/api/custom');

      expect(response.status).toBe(429);
      expect(response.body.error).toBe(customMessage);
    });
  });

  describe('Error Response Format', () => {
    it('should return JSON error response', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 1, enabled: true });
      app.use('/api', limiter);

      app.get('/api/json', (req, res) => {
        res.json({ data: 'test' });
      });

      await request(app).get('/api/json');
      const response = await request(app).get('/api/json');

      expect(response.status).toBe(429);
      expect(response.type).toMatch(/json/);
      expect(response.body).toHaveProperty('error');
    });

    it('should include standard rate limit headers', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 2, enabled: true });
      app.use('/api', limiter);

      app.get('/api/headers', (req, res) => {
        res.json({ ok: true });
      });

      // First request to check headers exist
      const firstResponse = await request(app).get('/api/headers');
      expect(firstResponse.status).toBe(200);

      // Exceed limit to get 429 with headers
      await request(app).get('/api/headers');
      const response = await request(app).get('/api/headers');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });
  });

  describe('Rate Limiting Disabled', () => {
    afterEach(() => {
      delete process.env.RATE_LIMIT_ENABLED;
    });

    it('should not rate limit when enabled=false in config', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 2, enabled: false });
      app.use('/api', limiter);

      app.get('/api/disabled', (req, res) => {
        res.json({ success: true });
      });

      // Make many requests - none should be blocked
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/api/disabled');
        expect(response.status).toBe(200);
      }
    });

    it('should not rate limit when RATE_LIMIT_ENABLED=false env var', async () => {
      process.env.RATE_LIMIT_ENABLED = 'false';
      const limiter = createRateLimiter({ windowMs: 60000, max: 2 });
      app.use('/api', limiter);

      app.get('/api/env-disabled', (req, res) => {
        res.json({ success: true });
      });

      // Make many requests - none should be blocked
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/api/env-disabled');
        expect(response.status).toBe(200);
      }
    });

    it('should rate limit when explicitly enabled via config', async () => {
      process.env.RATE_LIMIT_ENABLED = 'false';
      const limiter = createRateLimiter({ windowMs: 60000, max: 2, enabled: true });
      app.use('/api', limiter);

      app.get('/api/force-enabled', (req, res) => {
        res.json({ success: true });
      });

      // Make requests up to the limit
      await request(app).get('/api/force-enabled');
      await request(app).get('/api/force-enabled');

      // Third request should be rate limited (config overrides env)
      const response = await request(app).get('/api/force-enabled');
      expect(response.status).toBe(429);
    });
  });
});
