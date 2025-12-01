/**
 * Integration tests for Knex migrations
 * Tests migration up/down for all tables and validates schema structure
 *
 * @group integration
 */

import knex, { Knex } from 'knex';

describe('Knex Migrations', () => {
  let db: Knex;

  // Import migration modules directly (avoids Knex dynamic import issues in Jest)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration001 = require('../../../migrations/001_create_content_table.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration002 = require('../../../migrations/002_create_votes_table.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration003 = require('../../../migrations/003_create_logs_table.js');

  beforeEach(async () => {
    // Create in-memory SQLite database for testing
    db = knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
      },
      useNullAsDefault: true,
    });
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('Migration Up', () => {
    it('should run all migrations successfully', async () => {
      // Run migrations in order
      await migration001.up(db);
      await migration002.up(db);
      await migration003.up(db);

      // Verify all tables were created
      expect(await db.schema.hasTable('content')).toBe(true);
      expect(await db.schema.hasTable('votes')).toBe(true);
      expect(await db.schema.hasTable('logs')).toBe(true);
    });

    it('should create content table with correct schema', async () => {
      await migration001.up(db);

      const hasTable = await db.schema.hasTable('content');
      expect(hasTable).toBe(true);

      // Verify columns exist
      const columns = await db.table('content').columnInfo();

      expect(columns).toHaveProperty('id');
      expect(columns).toHaveProperty('text');
      expect(columns).toHaveProperty('type');
      expect(columns).toHaveProperty('generatedAt');
      expect(columns).toHaveProperty('sentAt');
      expect(columns).toHaveProperty('aiProvider');
      expect(columns).toHaveProperty('metadata');
      expect(columns).toHaveProperty('status');
      expect(columns).toHaveProperty('generatorId');
      expect(columns).toHaveProperty('generatorName');
      expect(columns).toHaveProperty('priority');
      expect(columns).toHaveProperty('aiModel');
      expect(columns).toHaveProperty('modelTier');
      expect(columns).toHaveProperty('failedOver');
      expect(columns).toHaveProperty('primaryProvider');
      expect(columns).toHaveProperty('primaryError');
      expect(columns).toHaveProperty('errorType');
      expect(columns).toHaveProperty('errorMessage');
      expect(columns).toHaveProperty('tokensUsed');
    });

    it('should create votes table with correct schema', async () => {
      await migration001.up(db); // votes depends on content table
      await migration002.up(db);

      const hasTable = await db.schema.hasTable('votes');
      expect(hasTable).toBe(true);

      // Verify columns exist
      const columns = await db.table('votes').columnInfo();

      expect(columns).toHaveProperty('id');
      expect(columns).toHaveProperty('content_id');
      expect(columns).toHaveProperty('vote_type');
      expect(columns).toHaveProperty('created_at');
      expect(columns).toHaveProperty('userAgent');
      expect(columns).toHaveProperty('ipAddress');
    });

    it('should create logs table with correct schema', async () => {
      await migration003.up(db);

      const hasTable = await db.schema.hasTable('logs');
      expect(hasTable).toBe(true);

      // Verify columns exist
      const columns = await db.table('logs').columnInfo();

      expect(columns).toHaveProperty('id');
      expect(columns).toHaveProperty('level');
      expect(columns).toHaveProperty('message');
      expect(columns).toHaveProperty('created_at');
      expect(columns).toHaveProperty('metadata');
    });

    it('should enforce foreign key constraint on votes.content_id', async () => {
      await migration001.up(db);
      await migration002.up(db);

      // Enable foreign keys for SQLite
      await db.raw('PRAGMA foreign_keys = ON');

      // Insert a content record
      const [contentId] = await db('content').insert({
        text: 'Test content',
        type: 'major',
        generatedAt: new Date().toISOString(),
        aiProvider: 'test',
        status: 'success',
      });

      // Should allow vote with valid content_id
      await expect(
        db('votes').insert({
          content_id: contentId,
          vote_type: 'good',
        })
      ).resolves.not.toThrow();

      // Should reject vote with invalid content_id (999 doesn't exist)
      await expect(
        db('votes').insert({
          content_id: 999,
          vote_type: 'good',
        })
      ).rejects.toThrow();
    });

    it('should cascade delete votes when content is deleted', async () => {
      await migration001.up(db);
      await migration002.up(db);

      // Enable foreign keys for SQLite
      await db.raw('PRAGMA foreign_keys = ON');

      // Insert content and vote
      const [contentId] = await db('content').insert({
        text: 'Test content',
        type: 'major',
        generatedAt: new Date().toISOString(),
        aiProvider: 'test',
        status: 'success',
      });

      await db('votes').insert({
        content_id: contentId,
        vote_type: 'good',
      });

      // Verify vote exists
      const votesBefore = await db('votes').where({ content_id: contentId });
      expect(votesBefore).toHaveLength(1);

      // Delete content
      await db('content').where({ id: contentId }).delete();

      // Verify vote was cascade deleted
      const votesAfter = await db('votes').where({ content_id: contentId });
      expect(votesAfter).toHaveLength(0);
    });

    it('should allow inserting and querying content records', async () => {
      await migration001.up(db);

      const testData = {
        text: 'Test motivational quote',
        type: 'major',
        generatedAt: new Date().toISOString(),
        aiProvider: 'openai',
        status: 'success',
        generatorId: 'motivational',
        generatorName: 'Motivational Generator',
        priority: 2,
        aiModel: 'gpt-4.1-nano',
        modelTier: 'LIGHT',
        tokensUsed: 150,
      };

      const [id] = await db('content').insert(testData);

      const record = await db('content').where({ id }).first();

      expect(record).toBeDefined();
      expect(record?.text).toBe(testData.text);
      expect(record?.type).toBe(testData.type);
      expect(record?.aiProvider).toBe(testData.aiProvider);
    });

    it('should allow inserting and querying log records', async () => {
      await migration003.up(db);

      const testData = {
        level: 'info',
        message: 'Test log message',
        metadata: JSON.stringify({ context: 'test' }),
      };

      const [id] = await db('logs').insert(testData);

      const record = await db('logs').where({ id }).first();

      expect(record).toBeDefined();
      expect(record?.level).toBe(testData.level);
      expect(record?.message).toBe(testData.message);
    });
  });

  describe('Migration Down', () => {
    it('should rollback all migrations successfully', async () => {
      // Run migrations
      await migration001.up(db);
      await migration002.up(db);
      await migration003.up(db);

      // Verify tables exist
      expect(await db.schema.hasTable('content')).toBe(true);
      expect(await db.schema.hasTable('votes')).toBe(true);
      expect(await db.schema.hasTable('logs')).toBe(true);

      // Rollback all migrations (reverse order)
      await migration003.down(db);
      await migration002.down(db);
      await migration001.down(db);

      // Verify tables were dropped
      expect(await db.schema.hasTable('content')).toBe(false);
      expect(await db.schema.hasTable('votes')).toBe(false);
      expect(await db.schema.hasTable('logs')).toBe(false);
    });

    it('should allow re-running migrations after rollback', async () => {
      // Run, rollback, run again
      await migration001.up(db);
      await migration002.up(db);
      await migration003.up(db);

      await migration003.down(db);
      await migration002.down(db);
      await migration001.down(db);

      await migration001.up(db);
      await migration002.up(db);
      await migration003.up(db);

      // Verify tables were recreated
      expect(await db.schema.hasTable('content')).toBe(true);
      expect(await db.schema.hasTable('votes')).toBe(true);
      expect(await db.schema.hasTable('logs')).toBe(true);
    });
  });

  describe('Cross-Database Compatibility', () => {
    it('should use database-agnostic column types', async () => {
      await migration001.up(db);

      // Verify we can insert typical data without type issues
      const testData = {
        text: 'Cross-database test',
        type: 'major',
        generatedAt: new Date().toISOString(),
        aiProvider: 'openai',
        status: 'success',
        failedOver: 0, // SQLite uses 0/1 for boolean
        metadata: JSON.stringify({ test: true }), // JSON as string
      };

      await expect(db('content').insert(testData)).resolves.not.toThrow();
    });
  });
});
