/**
 * Account Routes Integration Tests
 *
 * Tests account management endpoints with WebAuthn passkey operations.
 * Uses database-backed session middleware with mocked repositories.
 * Authentication is via session cookies, not legacy x-session-id headers.
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createAccountRouter } from '../../../../src/web/routes/account.js';
import { SESSION_COOKIE_NAME } from '../../../../src/web/middleware/session.js';
import type { SessionRepository } from '../../../../src/storage/repositories/session-repo.js';
import type { UserRepository } from '../../../../src/storage/repositories/user-repo.js';
import type { CredentialRepository } from '../../../../src/storage/repositories/credential-repo.js';
import type { CredentialRecord } from '../../../../src/storage/models/credential.js';

/**
 * Helper to create mock session and user repositories for database-backed auth
 */
function createMockRepos(opts?: { validToken?: string; userId?: number }) {
  const validToken = opts?.validToken ?? 'valid-session-token';
  const userId = opts?.userId ?? 1;

  const mockSessionRepo = {
    getValidSessionByToken: jest.fn().mockImplementation(async (token: string) => {
      if (token === validToken) {
        return {
          id: 100,
          token: validToken,
          userId,
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          lastAccessedAt: new Date(),
        };
      }
      return null;
    }),
    touchSession: jest.fn().mockResolvedValue(undefined),
    deleteSession: jest.fn().mockResolvedValue(true),
    createSession: jest.fn().mockResolvedValue(null),
  } as unknown as SessionRepository;

  const mockUserRepo = {
    findById: jest.fn().mockImplementation(async (id: number) => {
      if (id === userId) {
        return {
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        };
      }
      return null;
    }),
  } as unknown as UserRepository;

  return { mockSessionRepo, mockUserRepo };
}

/**
 * Helper to create mock credential repository
 */
function createMockCredentialRepo(initialCredentials?: CredentialRecord[]) {
  const credentials: CredentialRecord[] = initialCredentials ?? [
    {
      id: 1,
      userId: 1,
      credentialId: 'cred-abc',
      publicKey: 'pk-abc',
      counter: 0,
      deviceType: 'platform',
      name: 'iPhone 15 Pro',
      createdAt: new Date('2024-01-01'),
      lastUsedAt: new Date('2024-06-01'),
    },
    {
      id: 2,
      userId: 1,
      credentialId: 'cred-def',
      publicKey: 'pk-def',
      counter: 0,
      deviceType: 'platform',
      name: 'MacBook Pro',
      createdAt: new Date('2024-02-01'),
      lastUsedAt: new Date('2024-11-01'),
    },
  ];

  const repo = {
    findByUserId: jest.fn().mockImplementation(async (userId: number) => {
      return credentials.filter(c => c.userId === userId);
    }),
    findById: jest.fn().mockImplementation(async (id: number) => {
      return credentials.find(c => c.id === id) ?? null;
    }),
    findByCredentialId: jest.fn().mockImplementation(async (credId: string) => {
      return credentials.find(c => c.credentialId === credId) ?? null;
    }),
    save: jest.fn().mockImplementation(async (cred: Omit<CredentialRecord, 'id'>) => {
      const newCred = { ...cred, id: credentials.length + 10 } as CredentialRecord;
      credentials.push(newCred);
      return newCred;
    }),
    delete: jest.fn().mockImplementation(async (id: number) => {
      const idx = credentials.findIndex(c => c.id === id);
      if (idx === -1) return false;
      credentials.splice(idx, 1);
      return true;
    }),
    updateName: jest.fn().mockImplementation(async (id: number, name: string) => {
      const cred = credentials.find(c => c.id === id);
      if (!cred) return false;
      cred.name = name;
      return true;
    }),
    countByUserId: jest.fn().mockImplementation(async (userId: number) => {
      return credentials.filter(c => c.userId === userId).length;
    }),
  } as unknown as CredentialRepository;

  return repo;
}

/**
 * Helper to create an Express app with database-backed account router
 */
function createApp(opts?: {
  validToken?: string;
  userId?: number;
  credentialRepo?: CredentialRepository;
}) {
  const validToken = opts?.validToken ?? 'valid-session-token';
  const userId = opts?.userId ?? 1;
  const { mockSessionRepo, mockUserRepo } = createMockRepos({ validToken, userId });
  const credentialRepo = opts?.credentialRepo ?? createMockCredentialRepo();

  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  const accountRouter = createAccountRouter({
    sessionRepository: mockSessionRepo,
    userRepository: mockUserRepo,
    credentialRepository: credentialRepo,
  });
  app.use('/api/account', accountRouter);

  return { app, mockSessionRepo, mockUserRepo, credentialRepo };
}

describe('Account Routes', () => {
  describe('createAccountRouter', () => {
    it('should throw when called without dependencies', () => {
      expect(() => createAccountRouter()).toThrow(
        'Account routes require sessionRepository, userRepository, and credentialRepository'
      );
    });

    it('should throw when called with partial dependencies', () => {
      const { mockSessionRepo } = createMockRepos();
      expect(() =>
        createAccountRouter({ sessionRepository: mockSessionRepo })
      ).toThrow(
        'Account routes require sessionRepository, userRepository, and credentialRepository'
      );
    });
  });

  describe('requireAuth middleware (database-backed)', () => {
    it('should return 401 for unauthenticated requests (no cookie)', async () => {
      const { app } = createApp();

      const response = await request(app).get('/api/account/profile');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should return 401 for invalid session token', async () => {
      const { app } = createApp();

      const response = await request(app)
        .get('/api/account/profile')
        .set('Cookie', `${SESSION_COOKIE_NAME}=invalid-token`);

      expect(response.status).toBe(401);
    });

    it('should allow authenticated requests with valid session cookie', async () => {
      const { app } = createApp({ validToken: 'my-good-token' });

      const response = await request(app)
        .get('/api/account/profile')
        .set('Cookie', `${SESSION_COOKIE_NAME}=my-good-token`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/account/profile', () => {
    it('should return user profile data from database', async () => {
      const { app } = createApp({ validToken: 'profile-token' });

      const response = await request(app)
        .get('/api/account/profile')
        .set('Cookie', `${SESSION_COOKIE_NAME}=profile-token`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Test User');
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(response.body).toHaveProperty('createdAt');
    });
  });

  describe('GET /api/account/passkeys', () => {
    it('should return list of passkeys from credential repository', async () => {
      const { app } = createApp({ validToken: 'pk-token' });

      const response = await request(app)
        .get('/api/account/passkeys')
        .set('Cookie', `${SESSION_COOKIE_NAME}=pk-token`);

      expect(response.status).toBe(200);
      expect(response.body.passkeys).toBeInstanceOf(Array);
      expect(response.body.passkeys.length).toBe(2);
    });

    it('should include passkey metadata (name, device, dates)', async () => {
      const { app } = createApp({ validToken: 'pk-token' });

      const response = await request(app)
        .get('/api/account/passkeys')
        .set('Cookie', `${SESSION_COOKIE_NAME}=pk-token`);

      expect(response.status).toBe(200);
      const passkeys = response.body.passkeys;
      expect(passkeys.length).toBeGreaterThan(0);
      const passkey = passkeys[0];
      expect(passkey).toHaveProperty('id');
      expect(passkey).toHaveProperty('name');
      expect(passkey).toHaveProperty('deviceType');
      expect(passkey).toHaveProperty('createdAt');
      expect(passkey).toHaveProperty('lastUsed');
    });

    it('should return empty array when user has no passkeys', async () => {
      const emptyCredRepo = createMockCredentialRepo([]);
      const { app } = createApp({ validToken: 'pk-token', credentialRepo: emptyCredRepo });

      const response = await request(app)
        .get('/api/account/passkeys')
        .set('Cookie', `${SESSION_COOKIE_NAME}=pk-token`);

      expect(response.status).toBe(200);
      expect(response.body.passkeys).toEqual([]);
    });
  });

  describe('POST /api/account/passkey/register/start', () => {
    it('should generate WebAuthn registration challenge', async () => {
      const { app } = createApp({ validToken: 'reg-start-token' });

      const response = await request(app)
        .post('/api/account/passkey/register/start')
        .set('Cookie', `${SESSION_COOKIE_NAME}=reg-start-token`)
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
      const { app } = createApp({ validToken: 'reg-start-token' });

      const response = await request(app)
        .post('/api/account/passkey/register/start')
        .set('Cookie', `${SESSION_COOKIE_NAME}=reg-start-token`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.pubKeyCredParams).toBeInstanceOf(Array);
      expect(response.body.pubKeyCredParams.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/account/passkey/register/verify', () => {
    it('should reject invalid credential format', async () => {
      const { app } = createApp({ validToken: 'reg-verify-token' });

      const response = await request(app)
        .post('/api/account/passkey/register/verify')
        .set('Cookie', `${SESSION_COOKIE_NAME}=reg-verify-token`)
        .send({
          credential: { invalid: 'data' },
          name: 'Device',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should require credential parameter', async () => {
      const { app } = createApp({ validToken: 'reg-verify-token' });

      const response = await request(app)
        .post('/api/account/passkey/register/verify')
        .set('Cookie', `${SESSION_COOKIE_NAME}=reg-verify-token`)
        .send({
          name: 'Device',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('credential');
    });

    it('should require name parameter', async () => {
      const { app } = createApp({ validToken: 'reg-verify-token' });

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
        .set('Cookie', `${SESSION_COOKIE_NAME}=reg-verify-token`)
        .send({
          credential: mockCredential,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });
  });

  describe('DELETE /api/account/passkey/:id', () => {
    it('should remove passkey by ID from credential repository', async () => {
      const credRepo = createMockCredentialRepo();
      const { app } = createApp({ validToken: 'del-token', credentialRepo: credRepo });

      const response = await request(app)
        .delete('/api/account/passkey/1')
        .set('Cookie', `${SESSION_COOKIE_NAME}=del-token`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent removing last passkey', async () => {
      const singleCredRepo = createMockCredentialRepo([
        {
          id: 1,
          userId: 1,
          credentialId: 'only-cred',
          publicKey: 'pk',
          counter: 0,
          deviceType: 'platform',
          name: 'Only Device',
          createdAt: new Date(),
          lastUsedAt: null,
        },
      ]);
      const { app } = createApp({ validToken: 'del-token', credentialRepo: singleCredRepo });

      const response = await request(app)
        .delete('/api/account/passkey/1')
        .set('Cookie', `${SESSION_COOKIE_NAME}=del-token`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('last passkey');
    });

    it('should return 404 for non-existent passkey', async () => {
      const { app } = createApp({ validToken: 'del-token' });

      const response = await request(app)
        .delete('/api/account/passkey/999')
        .set('Cookie', `${SESSION_COOKIE_NAME}=del-token`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('PATCH /api/account/passkey/:id', () => {
    it('should rename passkey via credential repository', async () => {
      const { app } = createApp({ validToken: 'patch-token' });

      const response = await request(app)
        .patch('/api/account/passkey/1')
        .set('Cookie', `${SESSION_COOKIE_NAME}=patch-token`)
        .send({ name: 'Updated Device Name' });

      expect(response.status).toBe(200);
      expect(response.body.passkey).toHaveProperty('id');
      expect(response.body.passkey.name).toBe('Updated Device Name');
    });

    it('should require name parameter', async () => {
      const { app } = createApp({ validToken: 'patch-token' });

      const response = await request(app)
        .patch('/api/account/passkey/1')
        .set('Cookie', `${SESSION_COOKIE_NAME}=patch-token`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should return 404 for non-existent passkey', async () => {
      const { app } = createApp({ validToken: 'patch-token' });

      const response = await request(app)
        .patch('/api/account/passkey/999')
        .set('Cookie', `${SESSION_COOKIE_NAME}=patch-token`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
});
