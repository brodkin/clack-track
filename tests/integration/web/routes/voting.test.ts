/**
 * Voting Routes Integration Tests
 *
 * Tests the POST /api/vote endpoint with authentication requirement:
 * - Unauthenticated requests return 401
 * - Authenticated votes store user_id in the database
 * - Valid/invalid reason handling still works with auth
 * - GET /api/vote/stats remains public (no auth required)
 *
 * @group integration
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
/* eslint-enable @typescript-eslint/no-require-imports */

import { Express } from 'express';
import knex, { Knex } from 'knex';
import { createVotingRouter } from '@/web/routes/voting';
import { VoteRepository } from '@/storage/repositories/vote-repo';
import { VoteModel } from '@/storage/models/vote';
import { SESSION_COOKIE_NAME } from '@/web/middleware/session';
import type { SessionRepository } from '@/storage/repositories/session-repo';
import type { UserRepository } from '@/storage/repositories/user-repo';

/**
 * Helper to create mock session and user repositories for database-backed auth
 */
function createMockRepos(opts?: { validToken?: string; userId?: number }) {
  const validToken = opts?.validToken ?? 'valid-session-token';
  const userId = opts?.userId ?? 42;

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
          email: 'voter@example.com',
          name: 'Test Voter',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        };
      }
      return null;
    }),
  } as unknown as UserRepository;

  return { mockSessionRepo, mockUserRepo, validToken, userId };
}

describe('Voting Routes - authentication and reason field', () => {
  let app: Express;
  let db: Knex;
  let voteModel: VoteModel;
  let voteRepository: VoteRepository;

  // Import migrations
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration001 = require('../../../../migrations/001_create_content_table.cjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration002 = require('../../../../migrations/002_create_votes_table.cjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration011 = require('../../../../migrations/011_add_vote_reason.cjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration012 = require('../../../../migrations/012_add_vote_user_id.cjs');

  beforeAll(async () => {
    db = knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });

    // Run required migrations
    await migration001.up(db);
    await migration002.up(db);
    await migration011.up(db);
    await migration012.up(db);

    voteModel = new VoteModel(db);
    voteRepository = new VoteRepository(voteModel);
  });

  beforeEach(async () => {
    // Clean tables between tests
    await db('votes').del();
    await db('content').del();

    // Insert a content record to vote on
    await db('content').insert({
      id: 1,
      text: 'Test content for voting',
      type: 'major',
      generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      sentAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      aiProvider: 'openai',
    });

    // Create fresh Express app for each test with auth repos
    const { mockSessionRepo, mockUserRepo } = createMockRepos();
    app = express();
    app.use(cookieParser());
    app.use(express.json());

    const votingRouter = createVotingRouter({
      voteRepository,
      sessionRepository: mockSessionRepo,
      userRepository: mockUserRepo,
    });
    app.use('/api/vote', votingRouter);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('POST /api/vote - authentication required', () => {
    it('should return 401 when no session cookie is provided', async () => {
      const response = await request(app).post('/api/vote').send({ contentId: '1', vote: 'good' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should return 401 when session token is invalid', async () => {
      const response = await request(app)
        .post('/api/vote')
        .set('Cookie', `${SESSION_COOKIE_NAME}=invalid-token`)
        .send({ contentId: '1', vote: 'good' });

      expect(response.status).toBe(401);
    });

    it('should accept a vote when authenticated with valid session', async () => {
      const response = await request(app)
        .post('/api/vote')
        .set('Cookie', `${SESSION_COOKIE_NAME}=valid-session-token`)
        .send({ contentId: '1', vote: 'good' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.vote_type).toBe('good');
    });

    it('should store user_id in the database when authenticated', async () => {
      await request(app)
        .post('/api/vote')
        .set('Cookie', `${SESSION_COOKIE_NAME}=valid-session-token`)
        .send({ contentId: '1', vote: 'good' });

      // Verify user_id in database directly
      const votes = await db('votes').select('*').where('content_id', 1);
      expect(votes).toHaveLength(1);
      expect(votes[0].user_id).toBe(42);
    });
  });

  describe('POST /api/vote - reason field with auth', () => {
    const validReasons = [
      'not_funny',
      'doesnt_make_sense',
      'factually_wrong',
      'too_negative',
      'boring',
      'badly_formatted',
      'almost_there',
      'other',
    ];

    it.each(validReasons)('should accept reason "%s" when authenticated', async reason => {
      const response = await request(app)
        .post('/api/vote')
        .set('Cookie', `${SESSION_COOKIE_NAME}=valid-session-token`)
        .send({ contentId: '1', vote: 'bad', reason });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reason).toBe(reason);
    });

    it('should persist reason and user_id in the database', async () => {
      await request(app)
        .post('/api/vote')
        .set('Cookie', `${SESSION_COOKIE_NAME}=valid-session-token`)
        .send({ contentId: '1', vote: 'bad', reason: 'boring' });

      const votes = await db('votes').select('*').where('content_id', 1);
      expect(votes).toHaveLength(1);
      expect(votes[0].reason).toBe('boring');
      expect(votes[0].user_id).toBe(42);
    });

    it('should reject an invalid reason with 400 even when authenticated', async () => {
      const response = await request(app)
        .post('/api/vote')
        .set('Cookie', `${SESSION_COOKIE_NAME}=valid-session-token`)
        .send({ contentId: '1', vote: 'bad', reason: 'invalid_reason' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('reason');
    });
  });

  describe('POST /api/vote - validation with auth', () => {
    it('should reject missing contentId', async () => {
      const response = await request(app)
        .post('/api/vote')
        .set('Cookie', `${SESSION_COOKIE_NAME}=valid-session-token`)
        .send({ vote: 'good' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing vote', async () => {
      const response = await request(app)
        .post('/api/vote')
        .set('Cookie', `${SESSION_COOKIE_NAME}=valid-session-token`)
        .send({ contentId: '1' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid vote value', async () => {
      const response = await request(app)
        .post('/api/vote')
        .set('Cookie', `${SESSION_COOKIE_NAME}=valid-session-token`)
        .send({ contentId: '1', vote: 'neutral' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/vote/stats - no auth required', () => {
    it('should return stats without authentication', async () => {
      const response = await request(app).get('/api/vote/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });
});
