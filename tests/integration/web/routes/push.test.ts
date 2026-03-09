/**
 * Push Routes Integration Tests
 *
 * Tests for push notification subscription endpoints:
 * - POST /api/push/subscribe
 * - DELETE /api/push/unsubscribe
 * - GET /api/push/vapid-public-key
 * - POST /api/push/test (development only)
 */

// With @swc/jest, imports are hoisted above process.env assignments.
// Mock the secrets utility so the push router captures test VAPID keys at module load time.
jest.mock('@/utils/secrets.js', () => ({
  getSecretOrEnv: jest.fn((secretName: string, _envName: string, defaultValue: string = '') => {
    const secrets: Record<string, string> = {
      vapid_public_key: 'test-public-key-base64',
      vapid_private_key: 'test-private-key-base64',
      vapid_subject: 'mailto:test@example.com',
    };
    return secrets[secretName] || defaultValue;
  }),
}));

// Mock web-push module
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}));

// Also set env vars for any code that reads them directly
process.env.VAPID_PUBLIC_KEY = 'test-public-key-base64';
process.env.VAPID_PRIVATE_KEY = 'test-private-key-base64';
process.env.VAPID_SUBJECT = 'mailto:test@example.com';
process.env.NODE_ENV = 'test';

import request from 'supertest';
import express from 'express';
import { pushRouter } from '@/web/routes/push';

describe('Push Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/push', pushRouter);
  });

  describe('POST /api/push/subscribe', () => {
    it('should save a valid push subscription', async () => {
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      const response = await request(app)
        .post('/api/push/subscribe')
        .send(subscription)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Subscription saved successfully',
      });
    });

    it('should reject subscription without endpoint', async () => {
      const subscription = {
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      const response = await request(app)
        .post('/api/push/subscribe')
        .send(subscription)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid subscription object',
      });
    });

    it('should reject empty body', async () => {
      const response = await request(app).post('/api/push/subscribe').send({}).expect(400);

      expect(response.body).toEqual({
        error: 'Invalid subscription object',
      });
    });
  });

  describe('DELETE /api/push/unsubscribe', () => {
    it('should remove an existing subscription', async () => {
      // First subscribe
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-2',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      await request(app).post('/api/push/subscribe').send(subscription).expect(201);

      // Then unsubscribe
      const response = await request(app)
        .delete('/api/push/unsubscribe')
        .send({ endpoint: subscription.endpoint })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Subscription removed successfully',
      });
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await request(app)
        .delete('/api/push/unsubscribe')
        .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/non-existent' })
        .expect(404);

      expect(response.body).toEqual({
        error: 'Subscription not found',
      });
    });

    it('should reject request without endpoint', async () => {
      const response = await request(app).delete('/api/push/unsubscribe').send({}).expect(400);

      expect(response.body).toEqual({
        error: 'Endpoint is required',
      });
    });
  });

  describe('GET /api/push/vapid-public-key', () => {
    it('should return the VAPID public key', async () => {
      const response = await request(app).get('/api/push/vapid-public-key').expect(200);

      expect(response.body).toEqual({
        publicKey: 'test-public-key-base64',
      });
    });

    it('should return 500 when VAPID key not configured', async () => {
      // Save original key and clear it
      const originalKey = process.env.VAPID_PUBLIC_KEY;
      process.env.VAPID_PUBLIC_KEY = '';

      // Reset module cache to force re-import with empty key
      jest.resetModules();

      // Mock secrets utility to return empty for VAPID keys
      jest.mock('@/utils/secrets.js', () => ({
        getSecretOrEnv: jest.fn(() => ''),
      }));
      // Re-mock web-push since modules were reset
      jest.mock('web-push', () => ({
        setVapidDetails: jest.fn(),
        sendNotification: jest.fn().mockResolvedValue({}),
      }));

      // Re-import router with empty VAPID key
      const { pushRouter: testRouter } = await import('@/web/routes/push');

      // Create app with re-imported router
      const testApp = express();
      testApp.use(express.json());
      testApp.use('/api/push', testRouter);

      // Make request and verify 500 response
      const response = await request(testApp).get('/api/push/vapid-public-key').expect(500);

      expect(response.body).toEqual({
        error: 'VAPID keys not configured',
      });

      // Restore original key and reset modules again for other tests
      process.env.VAPID_PUBLIC_KEY = originalKey;
      jest.resetModules();
    });
  });

  describe('POST /api/push/test', () => {
    it('should send a test notification in non-production', async () => {
      // First subscribe
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-3',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      await request(app).post('/api/push/subscribe').send(subscription).expect(201);

      // Then send test notification
      const response = await request(app)
        .post('/api/push/test')
        .send({
          endpoint: subscription.endpoint,
          title: 'Test Title',
          body: 'Test Body',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Test notification sent successfully',
      });
    });

    it('should reject test without endpoint', async () => {
      const response = await request(app)
        .post('/api/push/test')
        .send({ title: 'Test' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Endpoint is required',
      });
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await request(app)
        .post('/api/push/test')
        .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/non-existent-test' })
        .expect(404);

      expect(response.body).toEqual({
        error: 'Subscription not found',
      });
    });

    it('should be forbidden in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Create new app with production env
      const prodApp = express();
      prodApp.use(express.json());
      prodApp.use('/api/push', pushRouter);

      const response = await request(prodApp)
        .post('/api/push/test')
        .send({ endpoint: 'https://test.com/endpoint' })
        .expect(403);

      expect(response.body).toEqual({
        error: 'Test endpoint disabled in production',
      });

      process.env.NODE_ENV = originalEnv;
    });
  });
});
