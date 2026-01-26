/**
 * Auth Bypass Middleware Integration Tests
 *
 * Tests for environment-based auth bypass for automated testing with Playwright.
 * The bypass allows automated tests to authenticate without going through
 * the full WebAuthn/magic link flow.
 *
 * Security guarantees:
 * - Only works when AUTH_BYPASS_ENABLED=true (default: false)
 * - Hard block when NODE_ENV === 'production' (cannot be bypassed)
 * - Creates real sessions that work with requireAuth middleware
 *
 * @module tests/integration/web/middleware
 */

import { Knex } from 'knex';
import express, { Express } from 'express';
import request from 'supertest';
import { getKnexInstance, resetKnexInstance, closeKnexInstance } from '@/storage/knex.js';
import { SessionModel } from '@/storage/models/session.js';
import { SessionRepository } from '@/storage/repositories/session-repo.js';
import { UserModel } from '@/storage/models/user.js';
import { UserRepository } from '@/storage/repositories/user-repo.js';
import {
  createSessionMiddleware,
  requireAuth,
  SESSION_COOKIE_NAME,
} from '@/web/middleware/session.js';
import {
  createAuthBypassMiddleware,
  AUTH_BYPASS_HEADER,
  isAuthBypassEnabled,
} from '@/web/middleware/auth-bypass.js';

describe('Auth Bypass Middleware Integration', () => {
  let knex: Knex;
  let app: Express;
  let sessionModel: SessionModel;
  let sessionRepo: SessionRepository;
  let userModel: UserModel;
  let userRepo: UserRepository;

  // Store original env values
  let originalNodeEnv: string | undefined;
  let originalAuthBypass: string | undefined;

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
    // Store original environment values
    originalNodeEnv = process.env.NODE_ENV;
    originalAuthBypass = process.env.AUTH_BYPASS_ENABLED;

    // Clean data before each test
    await knex('sessions').del();
    await knex('users').del();

    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());

    // Set up session middleware (cookie parser)
    const sessionMiddleware = createSessionMiddleware(sessionRepo, userRepo);
    app.use(sessionMiddleware);
  });

  afterEach(() => {
    // Restore original environment values
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    if (originalAuthBypass !== undefined) {
      process.env.AUTH_BYPASS_ENABLED = originalAuthBypass;
    } else {
      delete process.env.AUTH_BYPASS_ENABLED;
    }
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('Environment Configuration', () => {
    it('should be disabled by default (AUTH_BYPASS_ENABLED not set)', () => {
      delete process.env.AUTH_BYPASS_ENABLED;
      process.env.NODE_ENV = 'development';

      expect(isAuthBypassEnabled()).toBe(false);
    });

    it('should be enabled when AUTH_BYPASS_ENABLED=true', () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      expect(isAuthBypassEnabled()).toBe(true);
    });

    it('should be disabled when AUTH_BYPASS_ENABLED=false', () => {
      process.env.AUTH_BYPASS_ENABLED = 'false';
      process.env.NODE_ENV = 'development';

      expect(isAuthBypassEnabled()).toBe(false);
    });

    it('should NEVER be enabled in production (hard block)', () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'production';

      expect(isAuthBypassEnabled()).toBe(false);
    });

    it('should be case-insensitive for AUTH_BYPASS_ENABLED value', () => {
      process.env.NODE_ENV = 'development';

      process.env.AUTH_BYPASS_ENABLED = 'TRUE';
      expect(isAuthBypassEnabled()).toBe(true);

      process.env.AUTH_BYPASS_ENABLED = 'True';
      expect(isAuthBypassEnabled()).toBe(true);
    });
  });

  describe('Header Recognition', () => {
    it('should export AUTH_BYPASS_HEADER constant', () => {
      expect(AUTH_BYPASS_HEADER).toBe('X-Auth-Bypass');
    });

    it('should ignore bypass header when disabled', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'false';
      process.env.NODE_ENV = 'development';

      // Apply bypass middleware before requireAuth
      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      const response = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should process bypass header when enabled', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - user is attached by middleware
        res.json({ message: 'Protected content', user: req.user });
      });

      const response = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Protected content');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@playwright.local');
    });
  });

  describe('User Lookup and Creation', () => {
    it('should use existing user when email matches', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      // Create existing user
      const existingUser = await userModel.create({
        email: 'existing@example.com',
        name: 'Existing User',
      });

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - user is attached by middleware
        res.json({ userId: req.user.id, name: req.user.name });
      });

      const response = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'existing@example.com');

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(existingUser.id);
      expect(response.body.name).toBe('Existing User');

      // Verify no duplicate user was created
      const userCount = await userModel.count();
      expect(userCount).toBe(1);
    });

    it('should create test user automatically when user-id does not exist', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - user is attached by middleware
        res.json({ userId: req.user.id, email: req.user.email });
      });

      const response = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'new-test@playwright.local');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('new-test@playwright.local');

      // Verify user was created
      const createdUser = await userModel.findByEmail('new-test@playwright.local');
      expect(createdUser).not.toBeNull();
      expect(createdUser?.email).toBe('new-test@playwright.local');
    });

    it('should set default name for auto-created test users', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - user is attached by middleware
        res.json({ name: req.user.name });
      });

      const response = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      expect(response.status).toBe(200);

      // Verify user was created with default name
      const user = await userModel.findByEmail('test@playwright.local');
      expect(user?.name).toBe('Test User (Playwright)');
    });
  });

  describe('Session Creation', () => {
    it('should create valid session for the request', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - session is attached by middleware
        res.json({ sessionId: req.session.id });
      });

      const response = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBeDefined();
      expect(typeof response.body.sessionId).toBe('number');

      // Verify session was created in database
      const user = await userModel.findByEmail('test@playwright.local');
      const sessions = await sessionRepo.getUserSessions(user!.id);
      expect(sessions.length).toBe(1);
    });

    it('should set session cookie for subsequent requests', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      const response = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      expect(response.status).toBe(200);

      // Verify session cookie was set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(SESSION_COOKIE_NAME);
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('should mark session data as bypass-created for auditing', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - session is attached by middleware
        res.json({ sessionData: req.session.data });
      });

      const response = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      expect(response.status).toBe(200);
      expect(response.body.sessionData).toEqual({
        authBypass: true,
        source: 'playwright',
      });
    });
  });

  describe('Production Hard Block', () => {
    it('should reject bypass header in production even if AUTH_BYPASS_ENABLED=true', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'production';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      const response = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should not create any users or sessions in production mode', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'production';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      await request(app).get('/protected').set('X-Auth-Bypass', 'test@playwright.local');

      // Verify no users or sessions were created
      const userCount = await userModel.count();
      expect(userCount).toBe(0);

      const user = await userModel.findByEmail('test@playwright.local');
      expect(user).toBeNull();
    });
  });

  describe('Integration with requireAuth', () => {
    it('should allow subsequent requests without bypass header (using session cookie)', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - user is attached by middleware
        res.json({ email: req.user.email });
      });

      // First request with bypass header
      const firstResponse = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      expect(firstResponse.status).toBe(200);

      // Extract session cookie
      const cookies = firstResponse.headers['set-cookie'];
      const sessionCookie = cookies[0].split(';')[0];

      // Second request with session cookie only (no bypass header)
      const secondResponse = await request(app).get('/protected').set('Cookie', sessionCookie);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.email).toBe('test@playwright.local');
    });

    it('should pass through when no bypass header and no session (let requireAuth handle)', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      const response = await request(app).get('/protected');

      // Should get 401 from requireAuth, not from bypass middleware
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid email format gracefully', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      // Empty header value should be ignored (pass through to requireAuth)
      const response = await request(app).get('/protected').set('X-Auth-Bypass', '');

      expect(response.status).toBe(401);
    });

    it('should handle whitespace-only email gracefully', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        res.json({ message: 'Protected content' });
      });

      const response = await request(app).get('/protected').set('X-Auth-Bypass', '   ');

      expect(response.status).toBe(401);
    });
  });

  describe('Multiple Requests', () => {
    it('should create new session on each bypass request for same user', async () => {
      process.env.AUTH_BYPASS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      const bypassMiddleware = createAuthBypassMiddleware(sessionRepo, userRepo);
      app.use(bypassMiddleware);

      app.get('/protected', requireAuth(sessionRepo, userRepo), (req, res) => {
        // @ts-expect-error - session is attached by middleware
        res.json({ sessionId: req.session.id });
      });

      // First request
      const response1 = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      // Second request (new session expected since we're not sending the cookie)
      const response2 = await request(app)
        .get('/protected')
        .set('X-Auth-Bypass', 'test@playwright.local');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Different session IDs
      expect(response1.body.sessionId).not.toBe(response2.body.sessionId);

      // But same user
      const user = await userModel.findByEmail('test@playwright.local');
      const sessions = await sessionRepo.getUserSessions(user!.id);
      expect(sessions.length).toBe(2);
    });
  });
});
