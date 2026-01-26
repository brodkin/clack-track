/**
 * Session Middleware Integration Tests
 *
 * Tests for database-backed session management:
 * - Session creation on successful login
 * - Session validation via HTTP-only cookie
 * - Session expiration handling
 * - Automatic expired session cleanup
 * - Configurable session duration
 *
 * @module tests/integration/web/middleware
 */

import { Knex } from 'knex';
import express, { Express, Request, Response } from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { getKnexInstance, resetKnexInstance, closeKnexInstance } from '@/storage/knex.js';
import { SessionModel } from '@/storage/models/session.js';
import { SessionRepository } from '@/storage/repositories/session-repo.js';
import { UserModel } from '@/storage/models/user.js';
import { UserRepository } from '@/storage/repositories/user-repo.js';
import {
  createSessionMiddleware,
  requireAuth,
  SESSION_COOKIE_NAME,
  getSessionDurationMs,
  type AuthenticatedRequest,
} from '@/web/middleware/session.js';

describe('Session Middleware Integration', () => {
  let knex: Knex;
  let app: Express;
  let sessionModel: SessionModel;
  let sessionRepo: SessionRepository;
  let userModel: UserModel;
  let userRepo: UserRepository;

  beforeAll(async () => {
    resetKnexInstance();
    knex = getKnexInstance();

    // Create users table
    await knex.schema.createTable('users', table => {
      table.increments('id').primary();
      table.string('email', 255).notNullable().unique();
      table.string('name', 255).nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // Create sessions table
    // Uses snake_case column names to match migration 008_create_sessions_table.cjs
    await knex.schema.createTable('sessions', table => {
      table.increments('id').primary();
      table.string('token', 255).notNullable().unique();
      table.integer('user_id').unsigned().notNullable();
      table.timestamp('expires_at').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('last_accessed_at').defaultTo(knex.fn.now());
      table.text('data').nullable();
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });

    // Initialize models and repositories
    sessionModel = new SessionModel(knex);
    sessionRepo = new SessionRepository(sessionModel);
    userModel = new UserModel(knex);
    userRepo = new UserRepository(userModel);
  });

  beforeEach(async () => {
    // Clean data before each test
    await knex('sessions').del();
    await knex('users').del();

    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());

    // Set up session middleware with test dependencies
    const sessionMiddleware = createSessionMiddleware(sessionRepo, userRepo);
    app.use(sessionMiddleware);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('Session Cookie Configuration', () => {
    it('should use SESSION_DURATION_DAYS environment variable (default: 30)', () => {
      const originalEnv = process.env.SESSION_DURATION_DAYS;

      // Test default value
      delete process.env.SESSION_DURATION_DAYS;
      expect(getSessionDurationMs()).toBe(30 * 24 * 60 * 60 * 1000);

      // Test custom value
      process.env.SESSION_DURATION_DAYS = '7';
      expect(getSessionDurationMs()).toBe(7 * 24 * 60 * 60 * 1000);

      // Restore
      if (originalEnv) {
        process.env.SESSION_DURATION_DAYS = originalEnv;
      } else {
        delete process.env.SESSION_DURATION_DAYS;
      }
    });

    it('should export correct cookie name constant', () => {
      expect(SESSION_COOKIE_NAME).toBe('clack_session');
    });
  });

  describe('Session Creation', () => {
    it('should create session in database on successful login', async () => {
      // Create a test user
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });

      // Set up a route that creates a session
      app.post('/login', async (req, res) => {
        const token = crypto.randomBytes(32).toString('hex');
        const now = new Date();
        const expiresAt = new Date(now.getTime() + getSessionDurationMs());

        const session = await sessionRepo.createSession({
          token,
          userId: user.id,
          expiresAt,
          createdAt: now,
          lastAccessedAt: now,
        });

        if (session) {
          res.cookie(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: getSessionDurationMs(),
          });
          res.json({ success: true, user: { id: user.id, email: user.email } });
        } else {
          res.status(500).json({ error: 'Failed to create session' });
        }
      });

      const response = await request(app).post('/login').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify session was created in database
      const sessions = await sessionRepo.getUserSessions(user.id);
      expect(sessions.length).toBe(1);
      expect(sessions[0].userId).toBe(user.id);

      // Verify cookie was set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(SESSION_COOKIE_NAME);
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('should generate cryptographically secure session token', async () => {
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');

      // Token should be 64 characters (32 bytes hex encoded)
      expect(token.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);

      const now = new Date();
      const session = await sessionRepo.createSession({
        token,
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      expect(session).not.toBeNull();
      expect(session?.token).toBe(token);
    });
  });

  describe('Session Validation (requireAuth middleware)', () => {
    it('should reject requests without session cookie', async () => {
      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject requests with invalid session token', async () => {
      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      const response = await request(app)
        .get('/protected')
        .set('Cookie', `${SESSION_COOKIE_NAME}=invalid-token`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired session');
    });

    it('should allow requests with valid session token', async () => {
      // Create user and session
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      await sessionRepo.createSession({
        token,
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - user is attached by middleware
        res.json({ message: 'Protected content', user: req.user });
      });

      const response = await request(app)
        .get('/protected')
        .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Protected content');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should attach user and session to request object', async () => {
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      const session = await sessionRepo.createSession({
        token,
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - session and user are attached by middleware
        res.json({ userId: req.user?.id, sessionId: req.session?.id });
      });

      const response = await request(app)
        .get('/protected')
        .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(user.id);
      expect(response.body.sessionId).toBe(session?.id);
    });
  });

  describe('Session Expiration', () => {
    it('should reject expired sessions', async () => {
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      // Create an expired session (1 hour in the past)
      await sessionRepo.createSession({
        token,
        userId: user.id,
        expiresAt: new Date(now.getTime() - 3600000),
        createdAt: new Date(now.getTime() - 7200000),
        lastAccessedAt: new Date(now.getTime() - 3600000),
      });

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      const response = await request(app)
        .get('/protected')
        .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired session');
    });

    it('should update lastAccessedAt on valid session access', async () => {
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');
      const initialTime = new Date(Date.now() - 60000); // 1 minute ago

      const session = await sessionRepo.createSession({
        token,
        userId: user.id,
        expiresAt: new Date(initialTime.getTime() + getSessionDurationMs()),
        createdAt: initialTime,
        lastAccessedAt: initialTime,
      });

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      await request(app).get('/protected').set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);

      // Verify lastAccessedAt was updated
      const updatedSession = await sessionRepo.getSessionByToken(token);
      expect(updatedSession).not.toBeNull();
      expect(updatedSession!.lastAccessedAt.getTime()).toBeGreaterThan(
        session!.lastAccessedAt.getTime()
      );
    });
  });

  describe('Expired Session Cleanup', () => {
    it('should clean up expired sessions', async () => {
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const now = new Date();

      // Create expired session
      await sessionRepo.createSession({
        token: 'expired-token',
        userId: user.id,
        expiresAt: new Date(now.getTime() - 3600000),
        createdAt: new Date(now.getTime() - 7200000),
        lastAccessedAt: new Date(now.getTime() - 3600000),
      });

      // Create valid session
      await sessionRepo.createSession({
        token: 'valid-token',
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      // Run cleanup
      const deletedCount = await sessionRepo.cleanupExpiredSessions();

      expect(deletedCount).toBe(1);

      // Verify expired session was deleted
      const expiredSession = await sessionRepo.getSessionByToken('expired-token');
      expect(expiredSession).toBeNull();

      // Verify valid session still exists
      const validSession = await sessionRepo.getSessionByToken('valid-token');
      expect(validSession).not.toBeNull();
    });
  });

  describe('Session Logout', () => {
    it('should delete session from database on logout', async () => {
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      await sessionRepo.createSession({
        token,
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      app.post('/logout', requireAuth(sessionRepo, userRepo), async (req, res) => {
        // @ts-expect-error - session is attached by middleware
        const deleted = await sessionRepo.deleteSession(req.session.id);
        if (deleted) {
          res.clearCookie(SESSION_COOKIE_NAME);
          res.json({ success: true });
        } else {
          res.status(500).json({ error: 'Failed to logout' });
        }
      });

      const response = await request(app)
        .post('/logout')
        .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify session was deleted
      const session = await sessionRepo.getSessionByToken(token);
      expect(session).toBeNull();
    });

    it('should clear session cookie on logout', async () => {
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      await sessionRepo.createSession({
        token,
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      app.post('/logout', requireAuth(sessionRepo, userRepo), async (req, res) => {
        // @ts-expect-error - session is attached by middleware
        await sessionRepo.deleteSession(req.session.id);
        res.clearCookie(SESSION_COOKIE_NAME);
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/logout')
        .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);

      // Verify cookie is cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(SESSION_COOKIE_NAME);
      expect(cookies[0]).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
    });
  });

  describe('Session Cookie Security', () => {
    it('should set httpOnly flag on session cookie', async () => {
      // Create user to ensure database is populated (not used directly in this test)
      await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');

      app.post('/login', (req, res) => {
        res.cookie(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          secure: false, // Test environment
          sameSite: 'strict',
          maxAge: getSessionDurationMs(),
        });
        res.json({ success: true });
      });

      const response = await request(app).post('/login');

      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('should set sameSite=strict on session cookie', async () => {
      const token = crypto.randomBytes(32).toString('hex');

      app.post('/login', (req, res) => {
        res.cookie(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: getSessionDurationMs(),
        });
        res.json({ success: true });
      });

      const response = await request(app).post('/login');

      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('SameSite=Strict');
    });
  });

  describe('Multiple Sessions', () => {
    it('should allow multiple active sessions per user', async () => {
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const now = new Date();

      // Create two sessions
      await sessionRepo.createSession({
        token: 'session-1',
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionRepo.createSession({
        token: 'session-2',
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      const sessions = await sessionRepo.getUserSessions(user.id);
      expect(sessions.length).toBe(2);
    });

    it('should invalidate all sessions when requested', async () => {
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const now = new Date();

      // Create multiple sessions
      await sessionRepo.createSession({
        token: 'session-1',
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionRepo.createSession({
        token: 'session-2',
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      // Delete all sessions for user
      const deletedCount = await sessionRepo.deleteUserSessions(user.id);

      expect(deletedCount).toBe(2);

      const sessions = await sessionRepo.getUserSessions(user.id);
      expect(sessions.length).toBe(0);
    });
  });

  describe('Orphaned Session Handling', () => {
    it('should reject and clean up session when user no longer exists', async () => {
      // Create user and session
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      await sessionRepo.createSession({
        token,
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      // Delete the user (orphaning the session)
      await userModel.delete(user.id);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      const response = await request(app)
        .get('/protected')
        .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired session');

      // Verify orphaned session was cleaned up
      const orphanedSession = await sessionRepo.getSessionByToken(token);
      expect(orphanedSession).toBeNull();
    });
  });

  describe('Helper Function Exports', () => {
    it('should export generateSessionToken function', async () => {
      const { generateSessionToken } = await import('@/web/middleware/session.js');
      const token = generateSessionToken();

      // Token should be 64 hex characters (32 bytes)
      expect(token.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens on each call', async () => {
      const { generateSessionToken } = await import('@/web/middleware/session.js');
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('createSession Helper', () => {
    it('should create session and set cookie', async () => {
      const { createSession: createSessionHelper } = await import('@/web/middleware/session.js');
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });

      // Create a mock response object
      const mockRes = {
        cookie: jest.fn(),
      } as unknown as Response;

      const session = await createSessionHelper(mockRes, sessionRepo, user.id);

      expect(session).not.toBeNull();
      expect(session?.userId).toBe(user.id);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        })
      );
    });

    it('should create session with optional data', async () => {
      const { createSession: createSessionHelper } = await import('@/web/middleware/session.js');
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });

      const mockRes = {
        cookie: jest.fn(),
      } as unknown as Response;

      const customData = { loginSource: 'magic-link', browser: 'Chrome' };
      const session = await createSessionHelper(mockRes, sessionRepo, user.id, customData);

      expect(session).not.toBeNull();
      expect(session?.data).toEqual(customData);
    });
  });

  describe('destroySession Helper', () => {
    it('should delete session and clear cookie', async () => {
      const { destroySession: destroySessionHelper } = await import('@/web/middleware/session.js');
      const user = await userModel.create({ email: 'test@example.com', name: 'Test User' });
      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      const session = await sessionRepo.createSession({
        token,
        userId: user.id,
        expiresAt: new Date(now.getTime() + getSessionDurationMs()),
        createdAt: now,
        lastAccessedAt: now,
      });

      // Create mock request with session attached
      const mockReq = {
        session,
      } as AuthenticatedRequest;

      const mockRes = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const deleted = await destroySessionHelper(mockReq, mockRes, sessionRepo);

      expect(deleted).toBe(true);
      expect(mockRes.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME);

      // Verify session was deleted from database
      const deletedSession = await sessionRepo.getSessionByToken(token);
      expect(deletedSession).toBeNull();
    });

    it('should return false when no session attached to request', async () => {
      const { destroySession: destroySessionHelper } = await import('@/web/middleware/session.js');

      // Create mock request without session
      const mockReq = {} as Request;

      const mockRes = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const deleted = await destroySessionHelper(mockReq, mockRes, sessionRepo);

      expect(deleted).toBe(false);
      // Cookie should not be cleared when no session
      expect(mockRes.clearCookie).not.toHaveBeenCalled();
    });
  });
});
