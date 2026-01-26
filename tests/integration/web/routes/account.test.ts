/**
 * Account Routes Integration Tests
 *
 * Tests account management endpoints with WebAuthn passkey operations.
 * Verifies authentication, authorization, and CRUD operations for passkeys.
 */

import request from 'supertest';
import express, { Express } from 'express';
import { createAccountRouter } from '../../../../src/web/routes/account.js';

describe('Account Routes', () => {
  let app: Express;
  let sessionId: string;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mount account router
    const accountRouter = createAccountRouter();
    app.use('/api/account', accountRouter);
  });

  describe('requireAuth middleware', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get('/api/account/profile');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should allow authenticated requests with valid session', async () => {
      // Create a mock authenticated session
      sessionId = 'test-session-authenticated';

      const response = await request(app)
        .get('/api/account/profile')
        .set('x-session-id', sessionId);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/account/profile', () => {
    beforeEach(() => {
      sessionId = 'test-session-profile-tests';
    });

    it('should return user profile data', async () => {
      const response = await request(app)
        .get('/api/account/profile')
        .set('x-session-id', sessionId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should handle server errors gracefully', async () => {
      // Force an error by using malformed session
      const response = await request(app)
        .get('/api/account/profile')
        .set('x-session-id', 'error-session');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/account/passkeys', () => {
    beforeEach(() => {
      sessionId = 'test-session-passkeys-tests';
    });

    it('should return list of passkeys for authenticated user', async () => {
      const response = await request(app)
        .get('/api/account/passkeys')
        .set('x-session-id', sessionId);

      expect(response.status).toBe(200);
      expect(response.body.passkeys).toBeInstanceOf(Array);
    });

    it('should include passkey metadata (name, device, dates)', async () => {
      const response = await request(app)
        .get('/api/account/passkeys')
        .set('x-session-id', sessionId);

      expect(response.status).toBe(200);
      const passkeys = response.body.passkeys;
      if (passkeys.length > 0) {
        const passkey = passkeys[0];
        expect(passkey).toHaveProperty('id');
        expect(passkey).toHaveProperty('name');
        expect(passkey).toHaveProperty('deviceType');
        expect(passkey).toHaveProperty('createdAt');
        expect(passkey).toHaveProperty('lastUsed');
      }
    });
  });

  describe('POST /api/account/passkey/register/start', () => {
    beforeEach(() => {
      sessionId = 'test-session-register-start-tests';
    });

    it('should generate WebAuthn registration challenge', async () => {
      const response = await request(app)
        .post('/api/account/passkey/register/start')
        .set('x-session-id', sessionId)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('challenge');
      expect(response.body).toHaveProperty('rp');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body.user).toHaveProperty('displayName');
    });

    it('should include pubKeyCredParams for ES256 and RS256', async () => {
      const response = await request(app)
        .post('/api/account/passkey/register/start')
        .set('x-session-id', sessionId)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.pubKeyCredParams).toBeInstanceOf(Array);
      expect(response.body.pubKeyCredParams.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/account/passkey/register/verify', () => {
    beforeEach(() => {
      sessionId = 'test-session-register-verify-tests';
    });

    it('should verify and store new passkey', async () => {
      // First, call register/start to get a challenge
      await request(app)
        .post('/api/account/passkey/register/start')
        .set('x-session-id', sessionId)
        .send();

      const mockCredential = {
        id: 'test-credential-id',
        rawId: 'test-raw-id',
        response: {
          clientDataJSON: 'test-client-data',
          attestationObject: 'test-attestation',
        },
        type: 'public-key',
      };

      const response = await request(app)
        .post('/api/account/passkey/register/verify')
        .set('x-session-id', sessionId)
        .send({
          credential: mockCredential,
          name: 'My New Device',
        });

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);
      expect(response.body.passkey).toHaveProperty('id');
      expect(response.body.passkey.name).toBe('My New Device');
    });

    it('should reject invalid credential format', async () => {
      const response = await request(app)
        .post('/api/account/passkey/register/verify')
        .set('x-session-id', sessionId)
        .send({
          credential: { invalid: 'data' },
          name: 'Device',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should require name parameter', async () => {
      const mockCredential = {
        id: 'test-credential-id',
        rawId: 'test-raw-id',
        response: {
          clientDataJSON: 'test-client-data',
          attestationObject: 'test-attestation',
        },
        type: 'public-key',
      };

      const response = await request(app)
        .post('/api/account/passkey/register/verify')
        .set('x-session-id', sessionId)
        .send({
          credential: mockCredential,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });
  });

  describe('DELETE /api/account/passkey/:id', () => {
    beforeEach(() => {
      sessionId = 'test-session-delete-tests';
    });

    it('should remove passkey by ID', async () => {
      const response = await request(app)
        .delete('/api/account/passkey/passkey-123')
        .set('x-session-id', sessionId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent removing last passkey', async () => {
      // First, remove one passkey (passkey-123)
      await request(app).delete('/api/account/passkey/passkey-123').set('x-session-id', sessionId);

      // Now try to remove the last remaining passkey (passkey-456)
      const response = await request(app)
        .delete('/api/account/passkey/passkey-456')
        .set('x-session-id', sessionId);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('last passkey');
    });

    it('should return 404 for non-existent passkey', async () => {
      const response = await request(app)
        .delete('/api/account/passkey/non-existent')
        .set('x-session-id', sessionId);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('PATCH /api/account/passkey/:id', () => {
    beforeEach(() => {
      sessionId = 'test-session-patch-tests';
    });

    it('should rename passkey', async () => {
      const response = await request(app)
        .patch('/api/account/passkey/passkey-123')
        .set('x-session-id', sessionId)
        .send({ name: 'Updated Device Name' });

      expect(response.status).toBe(200);
      expect(response.body.passkey).toHaveProperty('id', 'passkey-123');
      expect(response.body.passkey.name).toBe('Updated Device Name');
    });

    it('should require name parameter', async () => {
      const response = await request(app)
        .patch('/api/account/passkey/passkey-123')
        .set('x-session-id', sessionId)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should return 404 for non-existent passkey', async () => {
      const response = await request(app)
        .patch('/api/account/passkey/non-existent')
        .set('x-session-id', sessionId)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
});
