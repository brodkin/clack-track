/**
 * Voting Routes Integration Tests - Reason Field
 *
 * Tests the POST /api/vote endpoint's handling of the optional reason field:
 * - Valid reasons are passed through to the repository
 * - Invalid reasons return 400 with descriptive error
 * - Votes without reason continue to work (backward compatible)
 * - Reason is only relevant for 'bad' votes conceptually, but accepted regardless
 *
 * @group integration
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const request = require('supertest');
const express = require('express');
/* eslint-enable @typescript-eslint/no-require-imports */

import { Express } from 'express';
import knex, { Knex } from 'knex';
import { createVotingRouter } from '@/web/routes/voting';
import { VoteRepository } from '@/storage/repositories/vote-repo';
import { VoteModel } from '@/storage/models/vote';

describe('Voting Routes - reason field', () => {
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

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());

    const votingRouter = createVotingRouter({ voteRepository });
    app.use('/api/vote', votingRouter);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('POST /api/vote - backward compatibility', () => {
    it('should accept a vote without reason', async () => {
      const response = await request(app).post('/api/vote').send({ contentId: '1', vote: 'good' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.vote_type).toBe('good');
    });

    it('should accept a bad vote without reason', async () => {
      const response = await request(app).post('/api/vote').send({ contentId: '1', vote: 'bad' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vote_type).toBe('bad');
    });
  });

  describe('POST /api/vote - valid reasons', () => {
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

    it.each(validReasons)('should accept reason "%s" and pass it to repository', async reason => {
      const response = await request(app)
        .post('/api/vote')
        .send({ contentId: '1', vote: 'bad', reason });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reason).toBe(reason);
    });

    it('should persist the reason in the database', async () => {
      await request(app).post('/api/vote').send({ contentId: '1', vote: 'bad', reason: 'boring' });

      // Verify in database directly
      const votes = await db('votes').select('*').where('content_id', 1);
      expect(votes).toHaveLength(1);
      expect(votes[0].reason).toBe('boring');
    });
  });

  describe('POST /api/vote - invalid reasons', () => {
    it('should reject an invalid reason string with 400', async () => {
      const response = await request(app)
        .post('/api/vote')
        .send({ contentId: '1', vote: 'bad', reason: 'invalid_reason' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('reason');
    });

    it('should reject a numeric reason with 400', async () => {
      const response = await request(app)
        .post('/api/vote')
        .send({ contentId: '1', vote: 'bad', reason: 123 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('reason');
    });

    it('should reject an empty string reason with 400', async () => {
      const response = await request(app)
        .post('/api/vote')
        .send({ contentId: '1', vote: 'bad', reason: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('reason');
    });

    it('should include valid reason values in the error message', async () => {
      const response = await request(app)
        .post('/api/vote')
        .send({ contentId: '1', vote: 'bad', reason: 'wrong_value' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('boring');
      expect(response.body.error).toContain('other');
    });
  });

  describe('POST /api/vote - existing validations still work', () => {
    it('should reject missing contentId', async () => {
      const response = await request(app).post('/api/vote').send({ vote: 'good' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing vote', async () => {
      const response = await request(app).post('/api/vote').send({ contentId: '1' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid vote value', async () => {
      const response = await request(app)
        .post('/api/vote')
        .send({ contentId: '1', vote: 'neutral' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject empty body', async () => {
      const response = await request(app).post('/api/vote').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
