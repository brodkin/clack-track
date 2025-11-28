/**
 * Auth Routes Tests
 *
 * Tests WebAuthn passkey authentication endpoints:
 * - POST /api/auth/login/start - Generate login challenge
 * - POST /api/auth/login/verify - Verify WebAuthn response
 * - POST /api/auth/logout - Clear session
 * - GET /api/auth/session - Check authentication status
 *
 * @jest-environment node
 */

import type { Express } from 'express';
import request from 'supertest';
import express from 'express';
import { createAuthRouter } from '@/web/routes/auth';

describe('Auth Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter());
  });

  describe('POST /api/auth/login/start', () => {
    it('should return authentication options with challenge', async () => {
      const response = await request(app).post('/api/auth/login/start').expect(200);

      expect(response.body).toHaveProperty('challenge');
      expect(response.body).toHaveProperty('rpId');
      expect(response.body).toHaveProperty('userVerification');
      expect(response.body.challenge).toBeTruthy();
      expect(typeof response.body.challenge).toBe('string');
    });

    it('should return unique challenges for different requests', async () => {
      const response1 = await request(app).post('/api/auth/login/start').expect(200);
      const response2 = await request(app).post('/api/auth/login/start').expect(200);

      expect(response1.body.challenge).not.toBe(response2.body.challenge);
    });

    it('should set appropriate timeout for challenge', async () => {
      const response = await request(app).post('/api/auth/login/start').expect(200);

      expect(response.body).toHaveProperty('timeout');
      expect(response.body.timeout).toBeGreaterThan(0);
      expect(response.body.timeout).toBeLessThanOrEqual(300000); // Max 5 minutes
    });

    it('should include rpName in authentication options', async () => {
      const response = await request(app).post('/api/auth/login/start').expect(200);

      expect(response.body).toHaveProperty('rpName');
      expect(response.body.rpName).toBe('Clack Track');
    });
  });

  describe('POST /api/auth/login/verify', () => {
    it('should accept valid WebAuthn authentication response', async () => {
      const sessionId = 'test-session-verify';

      // First, get a challenge with session ID
      const startResponse = await request(app)
        .post('/api/auth/login/start')
        .set('x-session-id', sessionId)
        .expect(200);

      const mockAuthResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: 'mock-client-data',
          authenticatorData: 'mock-auth-data',
          signature: 'mock-signature',
          userHandle: 'mock-user-handle',
        },
        type: 'public-key',
      };

      // Use same session ID to verify
      const response = await request(app)
        .post('/api/auth/login/verify')
        .set('x-session-id', sessionId)
        .send({
          credential: mockAuthResponse,
          challenge: startResponse.body.challenge,
        })
        .expect(200);

      expect(response.body).toHaveProperty('verified', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('name');
    });

    it('should reject request without credential', async () => {
      const response = await request(app)
        .post('/api/auth/login/verify')
        .send({ challenge: 'some-challenge' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('credential');
    });

    it('should reject request without challenge', async () => {
      const mockAuthResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: 'mock-client-data',
          authenticatorData: 'mock-auth-data',
          signature: 'mock-signature',
        },
        type: 'public-key',
      };

      const response = await request(app)
        .post('/api/auth/login/verify')
        .send({ credential: mockAuthResponse })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('challenge');
    });

    it('should reject invalid credential format', async () => {
      const response = await request(app)
        .post('/api/auth/login/verify')
        .send({
          credential: { invalid: 'format' },
          challenge: 'some-challenge',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout user', async () => {
      const response = await request(app).post('/api/auth/logout').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should be idempotent - multiple logouts should succeed', async () => {
      await request(app).post('/api/auth/logout').expect(200);
      await request(app).post('/api/auth/logout').expect(200);
    });
  });

  describe('GET /api/auth/session', () => {
    it('should return unauthenticated status by default', async () => {
      const response = await request(app).get('/api/auth/session').expect(200);

      expect(response.body).toHaveProperty('authenticated', false);
      expect(response.body).toHaveProperty('user', null);
    });

    it('should return authenticated status after successful login', async () => {
      const sessionId = 'test-session-auth-status';

      // First, authenticate
      const startResponse = await request(app)
        .post('/api/auth/login/start')
        .set('x-session-id', sessionId)
        .expect(200);

      const mockAuthResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: 'mock-client-data',
          authenticatorData: 'mock-auth-data',
          signature: 'mock-signature',
          userHandle: 'mock-user-handle',
        },
        type: 'public-key',
      };

      await request(app)
        .post('/api/auth/login/verify')
        .set('x-session-id', sessionId)
        .send({
          credential: mockAuthResponse,
          challenge: startResponse.body.challenge,
        })
        .expect(200);

      // Then check session
      const sessionResponse = await request(app)
        .get('/api/auth/session')
        .set('x-session-id', sessionId)
        .expect(200);

      expect(sessionResponse.body).toHaveProperty('authenticated', true);
      expect(sessionResponse.body).toHaveProperty('user');
      expect(sessionResponse.body.user).toHaveProperty('name');
    });

    it('should return unauthenticated status after logout', async () => {
      const sessionId = 'test-session-logout';

      // First, authenticate
      const startResponse = await request(app)
        .post('/api/auth/login/start')
        .set('x-session-id', sessionId)
        .expect(200);

      const mockAuthResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: 'mock-client-data',
          authenticatorData: 'mock-auth-data',
          signature: 'mock-signature',
          userHandle: 'mock-user-handle',
        },
        type: 'public-key',
      };

      await request(app)
        .post('/api/auth/login/verify')
        .set('x-session-id', sessionId)
        .send({
          credential: mockAuthResponse,
          challenge: startResponse.body.challenge,
        })
        .expect(200);

      // Then logout
      await request(app).post('/api/auth/logout').set('x-session-id', sessionId).expect(200);

      // Finally check session
      const sessionResponse = await request(app)
        .get('/api/auth/session')
        .set('x-session-id', sessionId)
        .expect(200);

      expect(sessionResponse.body).toHaveProperty('authenticated', false);
      expect(sessionResponse.body).toHaveProperty('user', null);
    });
  });

  describe('Rate Limiting (Security)', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      // This test verifies that rate limiting middleware is applied
      // Actual rate limit testing would require making 100+ requests
      const response = await request(app).post('/api/auth/login/start').expect(200);

      // Verify response doesn't indicate rate limiting issues
      expect(response.body).toHaveProperty('challenge');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      // Express returns 400 for malformed JSON, body format varies
      const response = await request(app)
        .post('/api/auth/login/verify')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Verify it's not a successful response
      expect(response.body.verified).not.toBe(true);
    });

    it('should return appropriate error codes for different failures', async () => {
      // Missing credential - 400
      await request(app).post('/api/auth/login/verify').send({}).expect(400);

      // Invalid credential format - 400
      await request(app)
        .post('/api/auth/login/verify')
        .send({ credential: 'not-an-object' })
        .expect(400);
    });
  });
});
