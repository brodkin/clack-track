/**
 * Tests for validation attempt tracking in content storage
 *
 * This feature tracks LLM submission attempts for tool-based content generation.
 * Each attempt that fails validation is recorded for debugging and analytics.
 */
import { ContentRepository } from '../../../src/storage/repositories/content-repo.js';
import { ContentModel } from '../../../src/storage/models/index.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../src/storage/knex.js';

describe('Validation Attempts Tracking', () => {
  let knex: Knex;
  let contentModel: ContentModel;
  let contentRepo: ContentRepository;

  beforeEach(async () => {
    // Reset singleton to ensure clean state
    resetKnexInstance();
    knex = getKnexInstance();

    // Create table with new validation attempts columns
    const contentTableExists = await knex.schema.hasTable('content');
    if (!contentTableExists) {
      await knex.schema.createTable('content', table => {
        // Primary key
        table.increments('id').primary();

        // Content data
        table.text('text').notNullable();
        table.enum('type', ['major', 'minor']).notNullable();

        // Timestamps
        table.dateTime('generatedAt').notNullable();
        table.dateTime('sentAt').nullable();

        // AI Provider information
        table.string('aiProvider', 50).notNullable();
        table.json('metadata').nullable();

        // Status tracking
        table.enum('status', ['success', 'failed']).notNullable().defaultTo('success');

        // Generator information
        table.string('generatorId', 100).nullable();
        table.string('generatorName', 200).nullable();
        table.integer('priority').nullable().defaultTo(2);

        // AI Model details
        table.string('aiModel', 100).nullable();
        table.string('modelTier', 20).nullable();

        // Failover tracking
        table.boolean('failedOver').nullable().defaultTo(false);
        table.string('primaryProvider', 50).nullable();
        table.text('primaryError').nullable();

        // Error tracking
        table.string('errorType', 100).nullable();
        table.text('errorMessage').nullable();

        // Token usage
        table.integer('tokensUsed').nullable();

        // NEW: Validation attempts tracking
        table.integer('validationAttempts').nullable().defaultTo(0);
        table.json('rejectionReasons').nullable();

        // Indexes for common queries
        table.index('generatedAt', 'idx_generated_at');
        table.index('status', 'idx_status');
        table.index('generatorId', 'idx_generator_id');
      });
    }

    // Clean table for isolated tests
    await knex('content').del();
    contentModel = new ContentModel(knex);
    contentRepo = new ContentRepository(contentModel);
  });

  afterEach(async () => {
    await closeKnexInstance();
  });

  describe('ContentRecord interface', () => {
    test('should include validationAttempts field', async () => {
      const now = new Date();
      const contentData = {
        text: 'Test Content',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 3,
      };

      const result = await contentRepo.saveContent(contentData);

      expect(result).not.toBeNull();
      expect(result?.validationAttempts).toBe(3);
    });

    test('should include rejectionReasons field', async () => {
      const now = new Date();
      const rejectionReasons = [
        { attempt: 1, reason: 'Content too long', timestamp: now.toISOString() },
        { attempt: 2, reason: 'Invalid characters', timestamp: now.toISOString() },
      ];
      const contentData = {
        text: 'Test Content',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 2,
        rejectionReasons,
      };

      const result = await contentRepo.saveContent(contentData);

      expect(result).not.toBeNull();
      expect(result?.rejectionReasons).toEqual(rejectionReasons);
    });

    test('should default validationAttempts to 0', async () => {
      const now = new Date();
      const contentData = {
        text: 'Test Content',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      };

      const result = await contentRepo.saveContent(contentData);

      expect(result).not.toBeNull();
      // When not provided, should default to 0
      expect(result?.validationAttempts).toBe(0);
    });
  });

  describe('ContentModel create', () => {
    test('should persist validationAttempts to database', async () => {
      const now = new Date();
      const contentData = {
        text: 'Test Content',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 5,
      };

      const created = await contentModel.create(contentData);
      const retrieved = await contentModel.findById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.validationAttempts).toBe(5);
    });

    test('should persist rejectionReasons as JSON to database', async () => {
      const now = new Date();
      const rejectionReasons = [
        { attempt: 1, reason: 'Exceeds 132 characters', timestamp: '2024-01-15T10:00:00Z' },
        { attempt: 2, reason: 'Contains invalid symbols', timestamp: '2024-01-15T10:00:05Z' },
        { attempt: 3, reason: 'Row 3 too long', timestamp: '2024-01-15T10:00:10Z' },
      ];
      const contentData = {
        text: 'Test Content',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 3,
        rejectionReasons,
      };

      const created = await contentModel.create(contentData);
      const retrieved = await contentModel.findById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.rejectionReasons).toEqual(rejectionReasons);
    });

    test('should handle null rejectionReasons', async () => {
      const now = new Date();
      const contentData = {
        text: 'Test Content',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 0,
      };

      const created = await contentModel.create(contentData);
      const retrieved = await contentModel.findById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.rejectionReasons).toBeUndefined();
    });
  });

  describe('ContentModel findLatest', () => {
    test('should include validationAttempts in returned records', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Content with retries',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 4,
        rejectionReasons: [{ attempt: 1, reason: 'Too long' }],
      });

      const results = await contentModel.findLatest(1);

      expect(results).toHaveLength(1);
      expect(results[0].validationAttempts).toBe(4);
      expect(results[0].rejectionReasons).toEqual([{ attempt: 1, reason: 'Too long' }]);
    });
  });

  describe('ContentRepository save', () => {
    test('should preserve validationAttempts through save operation', async () => {
      const now = new Date();
      const contentData = {
        text: 'Validated Content',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'anthropic',
        validationAttempts: 2,
        rejectionReasons: [
          { attempt: 1, reason: 'Invalid format', timestamp: '2024-01-15T10:00:00Z' },
        ],
      };

      await contentRepo.save(contentData);

      const latest = await contentRepo.getLatestContent();

      expect(latest).not.toBeNull();
      expect(latest?.validationAttempts).toBe(2);
      expect(latest?.rejectionReasons).toEqual([
        { attempt: 1, reason: 'Invalid format', timestamp: '2024-01-15T10:00:00Z' },
      ]);
    });
  });

  describe('Analytics queries', () => {
    test('should find records with high validation attempts', async () => {
      const now = new Date();

      // Create records with varying attempt counts
      await contentModel.create({
        text: 'Easy content',
        type: 'major',
        generatedAt: new Date(now.getTime() - 3000),
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 1,
      });

      await contentModel.create({
        text: 'Difficult content',
        type: 'major',
        generatedAt: new Date(now.getTime() - 2000),
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 5,
      });

      await contentModel.create({
        text: 'Very difficult content',
        type: 'major',
        generatedAt: new Date(now.getTime() - 1000),
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 10,
      });

      // Query for records with more than 3 attempts
      const highAttemptRecords = await contentModel.findWithHighAttempts(3);

      expect(highAttemptRecords).toHaveLength(2);
      expect(highAttemptRecords.every(r => (r.validationAttempts ?? 0) > 3)).toBe(true);
    });

    test('should calculate average validation attempts', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Content 1',
        type: 'major',
        generatedAt: new Date(now.getTime() - 3000),
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 2,
      });

      await contentModel.create({
        text: 'Content 2',
        type: 'major',
        generatedAt: new Date(now.getTime() - 2000),
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 4,
      });

      await contentModel.create({
        text: 'Content 3',
        type: 'major',
        generatedAt: new Date(now.getTime() - 1000),
        sentAt: null,
        aiProvider: 'openai',
        validationAttempts: 6,
      });

      const avgAttempts = await contentModel.getAverageValidationAttempts();

      expect(avgAttempts).toBe(4); // (2 + 4 + 6) / 3 = 4
    });
  });
});
