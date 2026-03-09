/**
 * Integration tests for vote reason field
 *
 * Verifies the reason field flows correctly through VoteRepository -> VoteModel -> database
 * and is properly persisted and retrieved.
 *
 * @group integration
 */

import { Knex } from 'knex';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
} from '../../../src/storage/knex.js';
import { VoteModel } from '../../../src/storage/models/vote.js';
import { VoteRepository } from '../../../src/storage/repositories/vote-repo.js';

describe('VoteRepository reason field', () => {
  let knex: Knex;
  let voteRepository: VoteRepository;

  beforeAll(async () => {
    resetKnexInstance();
    knex = getKnexInstance();

    await knex.raw('PRAGMA foreign_keys = ON');

    // Create content table (votes depends on it via FK)
    const contentTableExists = await knex.schema.hasTable('content');
    if (!contentTableExists) {
      await knex.schema.createTable('content', table => {
        table.increments('id').primary();
        table.text('text').notNullable();
        table.enum('type', ['major', 'minor']).notNullable();
        table.timestamp('generatedAt').notNullable();
        table.timestamp('sentAt').nullable();
        table.string('aiProvider', 50).notNullable();
        table.text('metadata').nullable();
      });
    }

    const votesTableExists = await knex.schema.hasTable('votes');
    if (!votesTableExists) {
      await knex.schema.createTable('votes', table => {
        table.increments('id').primary();
        table.integer('content_id').unsigned().notNullable();
        table.foreign('content_id').references('id').inTable('content').onDelete('CASCADE');
        table.enum('vote_type', ['good', 'bad']).notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('userAgent', 500).nullable();
        table.string('ipAddress', 45).nullable();
        table.string('reason', 50).nullable();
        table.integer('user_id').unsigned().nullable();
        table.index('content_id', 'idx_votes_content_id');
      });
    }

    const voteModel = new VoteModel(knex);
    voteRepository = new VoteRepository(voteModel);
  });

  beforeEach(async () => {
    await knex('votes').del();
    await knex('content').del();
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  async function createContent(): Promise<number> {
    const [id] = await knex('content').insert({
      text: 'Test content',
      type: 'major',
      generatedAt: new Date().toISOString(),
      aiProvider: 'openai',
    });
    return id;
  }

  test('should pass reason through submitVote to the database', async () => {
    const contentId = await createContent();

    const vote = await voteRepository.submitVote(contentId, 'bad', {
      userAgent: 'TestAgent',
      ipAddress: '127.0.0.1',
      reason: 'boring',
    });

    expect(vote.reason).toBe('boring');
  });

  test('should work without reason (backward compatible)', async () => {
    const contentId = await createContent();

    const vote = await voteRepository.submitVote(contentId, 'good', {
      userAgent: 'TestAgent',
    });

    expect(vote.reason).toBeUndefined();
  });

  test('should work without metadata at all (backward compatible)', async () => {
    const contentId = await createContent();

    const vote = await voteRepository.submitVote(contentId, 'good');

    expect(vote.reason).toBeUndefined();
  });

  test('should retrieve reason when getting votes by content', async () => {
    const contentId = await createContent();

    await voteRepository.submitVote(contentId, 'bad', {
      reason: 'repetitive',
    });

    const votes = await voteRepository.getVotesByContent(contentId);

    expect(votes).toHaveLength(1);
    expect(votes[0].reason).toBe('repetitive');
  });
});
