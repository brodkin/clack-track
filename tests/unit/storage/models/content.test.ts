import { ContentModel } from '../../../../src/storage/models/index.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('ContentModel', () => {
  let knex: Knex;
  let contentModel: ContentModel;

  beforeAll(async () => {
    // Reset singleton to ensure clean state (once per test file)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create table manually instead of using migrations (avoids ES module import issues)
    // This pattern matches VoteModel and LogModel tests
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

        // Validation attempts tracking
        table.integer('validationAttempts').nullable().defaultTo(0);
        table.json('rejectionReasons').nullable();

        // Indexes for common queries
        table.index('generatedAt', 'idx_generated_at');
        table.index('status', 'idx_status');
        table.index('generatorId', 'idx_generator_id');
      });
    }
  });

  beforeEach(async () => {
    // Clean table data for isolated tests (table structure persists)
    await knex('content').del();
    contentModel = new ContentModel(knex);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('create', () => {
    test('should create a content record with all fields', async () => {
      const now = new Date();
      const sentAt = new Date(now.getTime() + 1000);
      const contentData = {
        text: 'Hello World',
        type: 'major' as const,
        generatedAt: now,
        sentAt,
        aiProvider: 'openai',
        metadata: { model: 'gpt-4' },
      };

      const result = await contentModel.create(contentData);

      expect(result).toMatchObject({
        text: 'Hello World',
        type: 'major',
        aiProvider: 'openai',
        metadata: { model: 'gpt-4' },
      });
      expect(result.id).toBeDefined();
      expect(result.generatedAt).toEqual(now);
      expect(result.sentAt).toEqual(sentAt);
    });

    test('should create a content record without sentAt', async () => {
      const now = new Date();
      const contentData = {
        text: 'Test Content',
        type: 'minor' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'anthropic',
      };

      const result = await contentModel.create(contentData);

      expect(result.text).toBe('Test Content');
      expect(result.sentAt).toBeNull();
    });

    test('should generate unique IDs for each content', async () => {
      const now = new Date();
      const content1 = await contentModel.create({
        text: 'Content 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const content2 = await contentModel.create({
        text: 'Content 2',
        type: 'minor',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'anthropic',
      });

      expect(content1.id).not.toBe(content2.id);
    });

    test('should accept both major and minor types', async () => {
      const now = new Date();

      const major = await contentModel.create({
        text: 'Major Update',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const minor = await contentModel.create({
        text: 'Minor Update',
        type: 'minor',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      expect(major.type).toBe('major');
      expect(minor.type).toBe('minor');
    });

    test('should preserve metadata object', async () => {
      const now = new Date();
      const metadata = {
        tokens: 150,
        source: 'rss_feed',
        category: 'news',
      };

      const result = await contentModel.create({
        text: 'Content',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        metadata,
      });

      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('findById', () => {
    test('should find a content record by ID', async () => {
      const now = new Date();
      const created = await contentModel.create({
        text: 'Test Content',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const found = await contentModel.findById(created.id);

      expect(found).toMatchObject({
        id: created.id,
        text: 'Test Content',
        type: 'major',
      });
    });

    test('should return null for nonexistent ID', async () => {
      const found = await contentModel.findById(99999);

      expect(found).toBeNull();
    });
  });

  describe('findLatest', () => {
    test('should return latest content records in descending order', async () => {
      const now = new Date();

      // Use explicit timestamps with 1 second difference for deterministic ordering
      // This avoids MySQL DATETIME precision issues without real-time delays
      const content1 = await contentModel.create({
        text: 'Content 1',
        type: 'major',
        generatedAt: new Date(now.getTime()),
        sentAt: null,
        aiProvider: 'openai',
      });

      // Create second content with generatedAt 1 second later (no real-time wait needed)
      const content2 = await contentModel.create({
        text: 'Content 2',
        type: 'minor',
        generatedAt: new Date(now.getTime() + 1000),
        sentAt: null,
        aiProvider: 'openai',
      });

      const results = await contentModel.findLatest(10);

      expect(results).toHaveLength(2);
      // Verify descending order by generatedAt: content2 (later timestamp) should be first
      expect(results[0].id).toBe(content2.id);
      expect(results[1].id).toBe(content1.id);
    });

    test('should respect limit parameter', async () => {
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        await contentModel.create({
          text: `Content ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
        });
      }

      const results = await contentModel.findLatest(2);

      expect(results).toHaveLength(2);
    });

    test('should return empty array when no content exists', async () => {
      const results = await contentModel.findLatest(10);

      expect(results).toEqual([]);
    });

    test('should default to limit of 10', async () => {
      const now = new Date();

      for (let i = 0; i < 15; i++) {
        await contentModel.create({
          text: `Content ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
        });
      }

      const results = await contentModel.findLatest();

      expect(results).toHaveLength(10);
    });
  });

  describe('findByType', () => {
    test('should find content records by type', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Major 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      await contentModel.create({
        text: 'Minor 1',
        type: 'minor',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      await contentModel.create({
        text: 'Major 2',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const majorOnly = await contentModel.findByType('major', 10);
      const minorOnly = await contentModel.findByType('minor', 10);

      expect(majorOnly).toHaveLength(2);
      expect(majorOnly.every(c => c.type === 'major')).toBe(true);
      expect(minorOnly).toHaveLength(1);
      expect(minorOnly[0].type).toBe('minor');
    });

    test('should return empty array for type with no content', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Major 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const minorResults = await contentModel.findByType('minor', 10);

      expect(minorResults).toEqual([]);
    });

    test('should respect limit parameter by type', async () => {
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        await contentModel.create({
          text: `Major ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
        });
      }

      const results = await contentModel.findByType('major', 2);

      expect(results).toHaveLength(2);
    });
  });

  describe('findLatestSent', () => {
    test('should find sent content (first sent record)', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Unsent',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const sent1 = await contentModel.create({
        text: 'Sent 1',
        type: 'major',
        generatedAt: new Date(),
        sentAt: new Date(),
        aiProvider: 'openai',
      });

      const result = await contentModel.findLatestSent();

      expect(result?.id).toBe(sent1.id);
      expect(result?.sentAt).not.toBeNull();
    });

    test('should return null when no content has been sent', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Unsent 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const result = await contentModel.findLatestSent();

      expect(result).toBeNull();
    });
  });

  describe('markSent', () => {
    test('should update sentAt timestamp', async () => {
      const now = new Date();
      const created = await contentModel.create({
        text: 'Test Content',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      expect(created.sentAt).toBeNull();

      const marked = await contentModel.markSent(created.id);

      expect(marked?.sentAt).not.toBeNull();
      expect(marked?.sentAt).toBeInstanceOf(Date);
    });

    test('should return updated record', async () => {
      const now = new Date();
      const created = await contentModel.create({
        text: 'Test Content',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const marked = await contentModel.markSent(created.id);

      expect(marked?.id).toBe(created.id);
      expect(marked?.text).toBe('Test Content');
    });

    test('should return null for nonexistent ID', async () => {
      const result = await contentModel.markSent(99999);

      expect(result).toBeNull();
    });
  });

  describe('deleteOlderThan', () => {
    test('should delete content older than specified days', async () => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      await contentModel.create({
        text: 'Old Content',
        type: 'major',
        generatedAt: twoWeeksAgo,
        sentAt: null,
        aiProvider: 'openai',
      });

      await contentModel.create({
        text: 'Recent Content',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const deleted = await contentModel.deleteOlderThan(7);

      expect(deleted).toBe(1);

      const remaining = await contentModel.findLatest(10);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].text).toBe('Recent Content');
    });

    test('should return 0 when no content is old enough', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Recent Content',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const deleted = await contentModel.deleteOlderThan(7);

      expect(deleted).toBe(0);
    });

    test('should handle empty database', async () => {
      const deleted = await contentModel.deleteOlderThan(7);

      expect(deleted).toBe(0);
    });
  });

  // NEW TESTS FOR ENHANCED SCHEMA

  describe('create with new fields', () => {
    test('should create content with status and generator metadata', async () => {
      const now = new Date();
      const contentData = {
        text: 'Test Content',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'success' as const,
        generatorId: 'motivational-quote',
        generatorName: 'Motivational Quote Generator',
        priority: 2,
        aiModel: 'gpt-4.1-nano',
        modelTier: 'LIGHT',
      };

      const result = await contentModel.create(contentData);

      expect(result).toMatchObject({
        text: 'Test Content',
        type: 'major',
        status: 'success',
        generatorId: 'motivational-quote',
        generatorName: 'Motivational Quote Generator',
        priority: 2,
        aiProvider: 'openai',
        aiModel: 'gpt-4.1-nano',
        modelTier: 'LIGHT',
      });
      expect(result.id).toBeDefined();
    });

    test('should create content with failed status and error details', async () => {
      const now = new Date();
      const contentData = {
        text: 'Failed generation placeholder',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'failed' as const,
        generatorId: 'news-summary',
        generatorName: 'News Summary Generator',
        priority: 2,
        errorType: 'RateLimitError',
        errorMessage: 'API rate limit exceeded',
      };

      const result = await contentModel.create(contentData);

      expect(result).toMatchObject({
        status: 'failed',
        errorType: 'RateLimitError',
        errorMessage: 'API rate limit exceeded',
      });
    });

    test('should create content with failover metadata', async () => {
      const now = new Date();
      const contentData = {
        text: 'Content generated with failover',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'anthropic',
        status: 'success' as const,
        generatorId: 'weather-focus',
        generatorName: 'Weather Focus Generator',
        priority: 2,
        aiModel: 'claude-haiku-4.5',
        modelTier: 'LIGHT',
        failedOver: true,
        primaryProvider: 'openai',
        primaryError: 'Authentication failed',
      };

      const result = await contentModel.create(contentData);

      expect(result).toMatchObject({
        failedOver: true,
        primaryProvider: 'openai',
        primaryError: 'Authentication failed',
        aiProvider: 'anthropic',
      });
    });

    test('should create content with tokens used', async () => {
      const now = new Date();
      const contentData = {
        text: 'Content with token tracking',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'success' as const,
        generatorId: 'test-gen',
        generatorName: 'Test Generator',
        priority: 2,
        tokensUsed: 150,
      };

      const result = await contentModel.create(contentData);

      expect(result.tokensUsed).toBe(150);
    });

    test('should default status to success if not provided', async () => {
      const now = new Date();
      const contentData = {
        text: 'Content without explicit status',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'test-gen',
        generatorName: 'Test Generator',
        priority: 2,
      };

      const result = await contentModel.create(contentData);

      expect(result.status).toBe('success');
    });
  });

  describe('findByStatus', () => {
    test('should find content records by success status', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Success 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'success',
        generatorId: 'gen1',
        generatorName: 'Gen 1',
        priority: 2,
      });

      await contentModel.create({
        text: 'Failed 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'failed',
        generatorId: 'gen2',
        generatorName: 'Gen 2',
        priority: 2,
        errorType: 'Error',
        errorMessage: 'Failed',
      });

      await contentModel.create({
        text: 'Success 2',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'success',
        generatorId: 'gen3',
        generatorName: 'Gen 3',
        priority: 2,
      });

      const successResults = await contentModel.findByStatus('success', 10);

      expect(successResults).toHaveLength(2);
      expect(successResults.every(c => c.status === 'success')).toBe(true);
    });

    test('should find content records by failed status', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Success 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'success',
        generatorId: 'gen1',
        generatorName: 'Gen 1',
        priority: 2,
      });

      await contentModel.create({
        text: 'Failed 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'failed',
        generatorId: 'gen2',
        generatorName: 'Gen 2',
        priority: 2,
      });

      const failedResults = await contentModel.findByStatus('failed', 10);

      expect(failedResults).toHaveLength(1);
      expect(failedResults[0].status).toBe('failed');
      expect(failedResults[0].text).toBe('Failed 1');
    });

    test('should respect limit parameter in findByStatus', async () => {
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        await contentModel.create({
          text: `Success ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
          status: 'success',
          generatorId: `gen${i}`,
          generatorName: `Gen ${i}`,
          priority: 2,
        });
      }

      const results = await contentModel.findByStatus('success', 2);

      expect(results).toHaveLength(2);
    });

    test('should return empty array when no content matches status', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Success 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'success',
        generatorId: 'gen1',
        generatorName: 'Gen 1',
        priority: 2,
      });

      const failedResults = await contentModel.findByStatus('failed', 10);

      expect(failedResults).toEqual([]);
    });
  });

  describe('findByGeneratorIdLatest', () => {
    test('should find content records by generatorId ordered by generatedAt DESC', async () => {
      const now = new Date();

      // Create content for generator 'haiku'
      await contentModel.create({
        text: 'Haiku 1',
        type: 'major',
        generatedAt: new Date(now.getTime()),
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'haiku',
        generatorName: 'Haiku Generator',
        priority: 2,
      });

      await contentModel.create({
        text: 'Haiku 2',
        type: 'major',
        generatedAt: new Date(now.getTime() + 1000),
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'haiku',
        generatorName: 'Haiku Generator',
        priority: 2,
      });

      // Create content for a different generator
      await contentModel.create({
        text: 'News 1',
        type: 'major',
        generatedAt: new Date(now.getTime() + 2000),
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'news-summary',
        generatorName: 'News Summary Generator',
        priority: 2,
      });

      const results = await contentModel.findByGeneratorIdLatest('haiku', 10);

      expect(results).toHaveLength(2);
      expect(results.every(c => c.generatorId === 'haiku')).toBe(true);
      // Verify descending order by generatedAt
      expect(results[0].text).toBe('Haiku 2');
      expect(results[1].text).toBe('Haiku 1');
    });

    test('should respect limit parameter', async () => {
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        await contentModel.create({
          text: `Haiku ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
          generatorId: 'haiku',
          generatorName: 'Haiku Generator',
          priority: 2,
        });
      }

      const results = await contentModel.findByGeneratorIdLatest('haiku', 2);

      expect(results).toHaveLength(2);
    });

    test('should return empty array when no content matches generatorId', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'News 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'news-summary',
        generatorName: 'News Summary Generator',
        priority: 2,
      });

      const results = await contentModel.findByGeneratorIdLatest('haiku', 10);

      expect(results).toEqual([]);
    });

    test('should return empty array when no content exists', async () => {
      const results = await contentModel.findByGeneratorIdLatest('haiku', 10);

      expect(results).toEqual([]);
    });

    test('should default to limit of 10', async () => {
      const now = new Date();

      for (let i = 0; i < 15; i++) {
        await contentModel.create({
          text: `Haiku ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
          generatorId: 'haiku',
          generatorName: 'Haiku Generator',
          priority: 2,
        });
      }

      const results = await contentModel.findByGeneratorIdLatest('haiku');

      expect(results).toHaveLength(10);
    });

    test('should include content with null generatorId when searching for null', async () => {
      const now = new Date();

      // Content without generatorId
      await contentModel.create({
        text: 'Legacy Content',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      // Content with generatorId
      await contentModel.create({
        text: 'Haiku 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'haiku',
        generatorName: 'Haiku Generator',
        priority: 2,
      });

      const results = await contentModel.findByGeneratorIdLatest('haiku', 10);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('Haiku 1');
    });
  });

  describe('findFailures', () => {
    test('should find all failed content records', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Success 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'success',
        generatorId: 'gen1',
        generatorName: 'Gen 1',
        priority: 2,
      });

      await contentModel.create({
        text: 'Failed 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'failed',
        generatorId: 'gen2',
        generatorName: 'Gen 2',
        priority: 2,
        errorType: 'RateLimitError',
        errorMessage: 'Rate limit exceeded',
      });

      await contentModel.create({
        text: 'Failed 2',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'anthropic',
        status: 'failed',
        generatorId: 'gen3',
        generatorName: 'Gen 3',
        priority: 2,
        errorType: 'AuthenticationError',
        errorMessage: 'Invalid API key',
      });

      const failures = await contentModel.findFailures(10);

      expect(failures).toHaveLength(2);
      expect(failures.every(f => f.status === 'failed')).toBe(true);
      expect(failures.some(f => f.errorType === 'RateLimitError')).toBe(true);
      expect(failures.some(f => f.errorType === 'AuthenticationError')).toBe(true);
    });

    test('should respect limit parameter in findFailures', async () => {
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        await contentModel.create({
          text: `Failed ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
          status: 'failed',
          generatorId: `gen${i}`,
          generatorName: `Gen ${i}`,
          priority: 2,
        });
      }

      const failures = await contentModel.findFailures(2);

      expect(failures).toHaveLength(2);
    });

    test('should return empty array when no failures exist', async () => {
      const now = new Date();

      await contentModel.create({
        text: 'Success 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        status: 'success',
        generatorId: 'gen1',
        generatorName: 'Gen 1',
        priority: 2,
      });

      const failures = await contentModel.findFailures(10);

      expect(failures).toEqual([]);
    });

    test('should default to limit of 10 for findFailures', async () => {
      const now = new Date();

      for (let i = 0; i < 15; i++) {
        await contentModel.create({
          text: `Failed ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
          status: 'failed',
          generatorId: `gen${i}`,
          generatorName: `Gen ${i}`,
          priority: 2,
        });
      }

      const failures = await contentModel.findFailures();

      expect(failures).toHaveLength(10);
    });
  });
});
