/**
 * Registration Routes Integration Tests
 *
 * Tests for the complete registration flow:
 * - Token validation via MagicLinkService
 * - User creation via UserRepository
 * - Credential storage via CredentialRepository
 * - Session creation for automatic login
 *
 * TDD Phase 1 (RED): These tests define expected behavior.
 *
 * @jest-environment node
 */

import type { Express } from 'express';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getKnexInstance, closeKnexInstance, resetKnexInstance, type Knex } from '@/storage/knex';
import { MagicLinkModel } from '@/storage/models/magic-link';
import { MagicLinkRepository } from '@/storage/repositories/magic-link-repo';
import { UserModel } from '@/storage/models/user';
import { UserRepository } from '@/storage/repositories/user-repo';
import { CredentialModel } from '@/storage/models/credential';
import { CredentialRepository } from '@/storage/repositories/credential-repo';
import { SessionModel } from '@/storage/models/session';
import { SessionRepository } from '@/storage/repositories/session-repo';
import { MagicLinkService } from '@/auth/magic-link-service';
import { createAuthRouter } from '@/web/routes/auth';

// Mock verifyRegistrationResponse - WebAuthn library handles cryptographic verification
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn().mockReturnValue({
    challenge: 'test-registration-challenge',
    rp: { name: 'Clack Track', id: 'localhost' },
    user: {
      id: 'dXNlci1pZA==',
      name: 'test@example.com',
      displayName: 'Test User',
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    timeout: 60000,
  }),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn().mockReturnValue({
    challenge: 'test-challenge',
    timeout: 60000,
    rpId: 'localhost',
    userVerification: 'preferred',
  }),
  verifyAuthenticationResponse: jest.fn(),
}));

import { verifyRegistrationResponse } from '@simplewebauthn/server';
const mockVerifyRegistrationResponse = verifyRegistrationResponse as jest.Mock;

describe('Registration Routes', () => {
  let app: Express;
  let knex: Knex;
  let magicLinkModel: MagicLinkModel;
  let magicLinkRepo: MagicLinkRepository;
  let magicLinkService: MagicLinkService;
  let userModel: UserModel;
  let userRepo: UserRepository;
  let credentialModel: CredentialModel;
  let credentialRepo: CredentialRepository;
  let sessionModel: SessionModel;
  let sessionRepo: SessionRepository;

  beforeAll(async () => {
    resetKnexInstance();
    knex = getKnexInstance();

    // Create users table
    const usersTableExists = await knex.schema.hasTable('users');
    if (!usersTableExists) {
      await knex.schema.createTable('users', table => {
        table.increments('id').primary();
        table.string('email', 255).unique().notNullable();
        table.string('name', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      });
    }

    // Create magic_links table
    const magicLinksTableExists = await knex.schema.hasTable('magic_links');
    if (!magicLinksTableExists) {
      await knex.schema.createTable('magic_links', table => {
        table.increments('id').primary();
        table.string('token', 128).unique().notNullable();
        table.string('email', 255).notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('used_at').nullable();
        table.integer('created_by').unsigned().nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.index('token', 'idx_magic_links_token');
        table.index('email', 'idx_magic_links_email');
      });
    }

    // Create credentials table
    // Uses snake_case column names to match migration 009_create_credentials_table.cjs
    const credentialsTableExists = await knex.schema.hasTable('credentials');
    if (!credentialsTableExists) {
      await knex.schema.createTable('credentials', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable();
        table.string('credential_id', 512).unique().notNullable();
        table.text('public_key').notNullable();
        table.integer('counter').unsigned().notNullable().defaultTo(0);
        table.string('device_type', 50).nullable();
        table.string('name', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('last_used_at').nullable();
        table.index('user_id', 'idx_credentials_user_id');
        table.index('credential_id', 'idx_credentials_credential_id');
      });
    }

    // Create sessions table
    // Uses snake_case column names to match migration 008_create_sessions_table.cjs
    const sessionsTableExists = await knex.schema.hasTable('sessions');
    if (!sessionsTableExists) {
      await knex.schema.createTable('sessions', table => {
        table.increments('id').primary();
        table.string('token', 128).unique().notNullable();
        table.integer('user_id').unsigned().notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('last_accessed_at').notNullable().defaultTo(knex.fn.now());
        table.text('data').nullable();
        table.index('token', 'idx_sessions_token');
        table.index('user_id', 'idx_sessions_user_id');
      });
    }
  });

  beforeEach(async () => {
    // Clear tables in correct order due to foreign key relationships
    await knex('sessions').del();
    await knex('credentials').del();
    await knex('magic_links').del();
    await knex('users').del();

    // Reset mocks
    mockVerifyRegistrationResponse.mockReset();
    // Configure mock for successful verification - returns credential info in v13 format
    mockVerifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'bW9jay1jcmVkZW50aWFsLWlk', // base64url credential ID
          publicKey: Buffer.from('mock-cose-public-key'),
          counter: 0,
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        fmt: 'none',
        aaguid: '00000000-0000-0000-0000-000000000000',
      },
    });

    // Create models and repositories
    magicLinkModel = new MagicLinkModel(knex);
    magicLinkRepo = new MagicLinkRepository(magicLinkModel);
    magicLinkService = new MagicLinkService(magicLinkRepo);
    userModel = new UserModel(knex);
    userRepo = new UserRepository(userModel);
    credentialModel = new CredentialModel(knex);
    credentialRepo = new CredentialRepository(credentialModel);
    sessionModel = new SessionModel(knex);
    sessionRepo = new SessionRepository(sessionModel);

    // Create app with all dependencies injected
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(
      '/api/auth',
      createAuthRouter({
        credentialRepository: credentialRepo,
        userRepository: userRepo,
        sessionRepository: sessionRepo,
        magicLinkService: magicLinkService,
      })
    );
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('GET /api/auth/register/validate', () => {
    it('should return valid token info with email', async () => {
      // Create a magic link
      const invite = await magicLinkService.generate('newuser@example.com');

      const response = await request(app)
        .get(`/api/auth/register/validate?token=${invite.token}`)
        .expect(200);

      expect(response.body).toEqual({
        valid: true,
        email: 'newuser@example.com',
      });
    });

    it('should reject invalid token with 400', async () => {
      const response = await request(app)
        .get('/api/auth/register/validate?token=invalid-token-12345')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|expired/i);
    });

    it('should reject expired token', async () => {
      // Create a magic link with very short expiration
      const magicLink = await magicLinkRepo.createInvite('expired@example.com', null, -1);
      expect(magicLink).not.toBeNull();

      const response = await request(app)
        .get(`/api/auth/register/validate?token=${magicLink!.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|expired/i);
    });

    it('should reject already used token', async () => {
      // Create and use a magic link
      const invite = await magicLinkService.generate('used@example.com');
      await magicLinkService.validate(invite.token); // Use the token

      const response = await request(app)
        .get(`/api/auth/register/validate?token=${invite.token}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|expired|used/i);
    });

    it('should reject missing token parameter', async () => {
      const response = await request(app).get('/api/auth/register/validate').expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/token.*required/i);
    });
  });

  describe('POST /api/auth/register', () => {
    /**
     * Helper to create a mock credential with proper clientDataJSON containing challenge
     */
    async function createMockCredentialWithChallenge(
      token: string,
      credentialId: string
    ): Promise<{
      credential: {
        id: string;
        rawId: string;
        response: {
          clientDataJSON: string;
          attestationObject: string;
        };
        type: string;
      };
      challenge: string;
    }> {
      // First call /register/options to get a challenge
      const startResponse = await request(app)
        .get('/api/auth/register/options')
        .query({ token })
        .expect(200);

      const challenge = startResponse.body.challenge;

      // Create clientDataJSON with the real challenge
      const clientData = {
        type: 'webauthn.create',
        challenge: challenge,
        origin: 'http://localhost:3000',
      };
      const clientDataJSON = Buffer.from(JSON.stringify(clientData)).toString('base64url');

      return {
        credential: {
          id: credentialId,
          rawId: credentialId,
          response: {
            clientDataJSON,
            attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YQ==',
          },
          type: 'public-key',
        },
        challenge,
      };
    }

    it('should create user with provided name and email from token', async () => {
      const invite = await magicLinkService.generate('newuser@example.com');
      const { credential: mockCredential } = await createMockCredentialWithChallenge(
        invite.token,
        'cmVnaXN0cmF0aW9uLWNyZWQ='
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          token: invite.token,
          name: 'John Doe',
          credential: mockCredential,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('name', 'John Doe');
      expect(response.body.user).toHaveProperty('email', 'newuser@example.com');

      // Verify user was created in database
      const user = await userRepo.findByEmail('newuser@example.com');
      expect(user).not.toBeNull();
      expect(user!.name).toBe('John Doe');
    });

    it('should store credential for the new user', async () => {
      const invite = await magicLinkService.generate('creduser@example.com');
      const { credential: mockCredential } = await createMockCredentialWithChallenge(
        invite.token,
        'c3RvcmVkLWNyZWRlbnRpYWw='
      );

      await request(app)
        .post('/api/auth/register')
        .send({
          token: invite.token,
          name: 'Jane Doe',
          credential: mockCredential,
        })
        .expect(201);

      // Verify credential was stored - use the credential ID from mock verification
      const credential = await credentialRepo.findByCredentialId('bW9jay1jcmVkZW50aWFsLWlk');
      expect(credential).not.toBeNull();
      expect(credential!.counter).toBe(0);
    });

    it('should mark token as used after successful registration', async () => {
      const invite = await magicLinkService.generate('tokenused@example.com');
      const { credential: mockCredential } = await createMockCredentialWithChallenge(
        invite.token,
        'dG9rZW4tdXNlZC1jcmVk'
      );

      await request(app)
        .post('/api/auth/register')
        .send({
          token: invite.token,
          name: 'Token User',
          credential: mockCredential,
        })
        .expect(201);

      // Verify token cannot be used again
      const hasValidInvite = await magicLinkService.hasValidInvite('tokenused@example.com');
      expect(hasValidInvite).toBe(false);
    });

    it('should create session and set cookie after registration', async () => {
      const invite = await magicLinkService.generate('sessionuser@example.com');
      const { credential: mockCredential } = await createMockCredentialWithChallenge(
        invite.token,
        'c2Vzc2lvbi1jcmVk'
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          token: invite.token,
          name: 'Session User',
          credential: mockCredential,
        })
        .expect(201);

      // Check that session cookie was set
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader[0]).toMatch(/clack_session=/);

      // Verify user is automatically logged in
      expect(response.body).toHaveProperty('authenticated', true);
    });

    it('should reject invalid token', async () => {
      const mockCredential = {
        id: 'aW52YWxpZC10b2tlbi1jcmVk',
        rawId: 'aW52YWxpZC10b2tlbi1jcmVk',
        response: {
          clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0=',
          attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YQ==',
          publicKey: 'cHVibGljLWtleS1kYXRh',
        },
        type: 'public-key',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          token: 'invalid-token-12345',
          name: 'Invalid User',
          credential: mockCredential,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|expired/i);
    });

    it('should reject missing name', async () => {
      const invite = await magicLinkService.generate('noname@example.com');

      const mockCredential = {
        id: 'bm8tbmFtZS1jcmVk',
        rawId: 'bm8tbmFtZS1jcmVk',
        response: {
          clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0=',
          attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YQ==',
          publicKey: 'cHVibGljLWtleS1kYXRh',
        },
        type: 'public-key',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          token: invite.token,
          credential: mockCredential,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/name.*required/i);
    });

    it('should reject missing credential', async () => {
      const invite = await magicLinkService.generate('nocred@example.com');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          token: invite.token,
          name: 'No Credential User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/credential.*required/i);
    });

    it('should reject if user already exists with that email', async () => {
      // Create existing user
      await userRepo.createUser({ email: 'existing@example.com', name: 'Existing User' });

      const invite = await magicLinkService.generate('existing@example.com');

      const mockCredential = {
        id: 'ZXhpc3RpbmctdXNlci1jcmVk',
        rawId: 'ZXhpc3RpbmctdXNlci1jcmVk',
        response: {
          clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0=',
          attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YQ==',
          publicKey: 'cHVibGljLWtleS1kYXRh',
        },
        type: 'public-key',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          token: invite.token,
          name: 'Duplicate User',
          credential: mockCredential,
        })
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/already.*exists|already.*registered/i);
    });
  });

  describe('Registration flow without magicLinkService', () => {
    it('should gracefully degrade when MagicLinkService is not provided', async () => {
      // Create app without MagicLinkService
      const appNoService = express();
      appNoService.use(express.json());
      appNoService.use(
        '/api/auth',
        createAuthRouter({
          credentialRepository: credentialRepo,
          userRepository: userRepo,
          sessionRepository: sessionRepo,
          // No magicLinkService
        })
      );

      const response = await request(appNoService)
        .get('/api/auth/register/validate?token=any-token')
        .expect(501);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/registration.*disabled|not.*available/i);
    });
  });
});
