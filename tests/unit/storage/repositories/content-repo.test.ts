import { ContentRepository } from '../../../../src/storage/repositories/content-repo.js';
import { ContentModel } from '../../../../src/storage/models/index.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('ContentRepository', () => {
  let knex: Knex;
  let contentModel: ContentModel;
  let contentRepo: ContentRepository;

  beforeAll(async () => {
    // Reset singleton to ensure clean state (once per test file)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create table manually instead of using migrations (avoids ES module import issues)
    // This pattern matches model tests
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

        // Output mode tracking for frame decoration
        // 'text' = needs frame decoration, 'layout' = raw characterCodes (no frame)
        table.string('outputMode', 20).nullable().defaultTo('text');

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
    contentRepo = new ContentRepository(contentModel);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('saveContent', () => {
    test('should save content record via model', async () => {
      const now = new Date();
      const contentData = {
        text: 'Test Content',
        type: 'major' as const,
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      };

      const result = await contentRepo.saveContent(contentData);

      expect(result).toMatchObject({
        text: 'Test Content',
        type: 'major',
        aiProvider: 'openai',
      });
      expect(result.id).toBeDefined();
    });
  });

  describe('getLatestContent', () => {
    test('should get the latest content record', async () => {
      const now = new Date();

      await contentRepo.saveContent({
        text: 'Content 1',
        type: 'major',
        generatedAt: new Date(now.getTime()),
        sentAt: null,
        aiProvider: 'openai',
      });

      // Use timestamp manipulation instead of real-time delay
      // This avoids the 1-second wait while ensuring deterministic ordering
      await contentRepo.saveContent({
        text: 'Content 2',
        type: 'major',
        generatedAt: new Date(now.getTime() + 1000),
        sentAt: null,
        aiProvider: 'openai',
      });

      const latest = await contentRepo.getLatestContent();

      expect(latest).not.toBeNull();
      expect(latest?.text).toBe('Content 2');
    });

    test('should return null when no content exists', async () => {
      const latest = await contentRepo.getLatestContent();

      expect(latest).toBeNull();
    });
  });

  describe('getContentHistory', () => {
    test('should get content history with default limit', async () => {
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        await contentRepo.saveContent({
          text: `Content ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
        });
      }

      const history = await contentRepo.getContentHistory();

      expect(history).toHaveLength(5);
    });

    test('should respect custom limit', async () => {
      const now = new Date();

      for (let i = 0; i < 10; i++) {
        await contentRepo.saveContent({
          text: `Content ${i}`,
          type: 'major',
          generatedAt: new Date(now.getTime() + i * 1000),
          sentAt: null,
          aiProvider: 'openai',
        });
      }

      const history = await contentRepo.getContentHistory(5);

      expect(history).toHaveLength(5);
    });
  });

  describe('findLatestByGenerator', () => {
    test('should find content records by generatorId', async () => {
      const now = new Date();

      await contentRepo.saveContent({
        text: 'Haiku 1',
        type: 'major',
        generatedAt: new Date(now.getTime()),
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'haiku',
        generatorName: 'Haiku Generator',
        priority: 2,
      });

      await contentRepo.saveContent({
        text: 'Haiku 2',
        type: 'major',
        generatedAt: new Date(now.getTime() + 1000),
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'haiku',
        generatorName: 'Haiku Generator',
        priority: 2,
      });

      await contentRepo.saveContent({
        text: 'News 1',
        type: 'major',
        generatedAt: new Date(now.getTime() + 2000),
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'news-summary',
        generatorName: 'News Summary Generator',
        priority: 2,
      });

      const results = await contentRepo.findLatestByGenerator('haiku', 10);

      expect(results).toHaveLength(2);
      expect(results.every(c => c.generatorId === 'haiku')).toBe(true);
      // Verify descending order by generatedAt
      expect(results[0].text).toBe('Haiku 2');
      expect(results[1].text).toBe('Haiku 1');
    });

    test('should respect limit parameter', async () => {
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        await contentRepo.saveContent({
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

      const results = await contentRepo.findLatestByGenerator('haiku', 2);

      expect(results).toHaveLength(2);
    });

    test('should return empty array when no content matches generatorId', async () => {
      const now = new Date();

      await contentRepo.saveContent({
        text: 'News 1',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
        generatorId: 'news-summary',
        generatorName: 'News Summary Generator',
        priority: 2,
      });

      const results = await contentRepo.findLatestByGenerator('haiku', 10);

      expect(results).toEqual([]);
    });

    test('should return empty array when database is empty', async () => {
      const results = await contentRepo.findLatestByGenerator('haiku', 10);

      expect(results).toEqual([]);
    });

    test('should default to limit of 10', async () => {
      const now = new Date();

      for (let i = 0; i < 15; i++) {
        await contentRepo.saveContent({
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

      const results = await contentRepo.findLatestByGenerator('haiku');

      expect(results).toHaveLength(10);
    });

    test('should handle database errors gracefully and return empty array', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByGeneratorIdLatest: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new ContentRepository(mockModel as unknown as ContentModel);
      const results = await failingRepo.findLatestByGenerator('haiku', 10);

      expect(results).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch content by generator'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('cleanupOldRecords', () => {
    test('should delete records older than retention period', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      const recentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Create old record
      await contentRepo.saveContent({
        text: 'Old Content',
        type: 'major',
        generatedAt: oldDate,
        sentAt: null,
        aiProvider: 'openai',
      });

      // Create recent record
      await contentRepo.saveContent({
        text: 'Recent Content',
        type: 'major',
        generatedAt: recentDate,
        sentAt: null,
        aiProvider: 'openai',
      });

      const deleted = await contentRepo.cleanupOldRecords(90);

      expect(deleted).toBe(1);

      const remaining = await contentRepo.getContentHistory();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].text).toBe('Recent Content');
    });

    test('should return 0 when no records are old enough', async () => {
      const now = new Date();

      await contentRepo.saveContent({
        text: 'Recent Content',
        type: 'major',
        generatedAt: now,
        sentAt: null,
        aiProvider: 'openai',
      });

      const deleted = await contentRepo.cleanupOldRecords(90);

      expect(deleted).toBe(0);
    });

    test('should handle empty database gracefully', async () => {
      const deleted = await contentRepo.cleanupOldRecords(90);

      expect(deleted).toBe(0);
    });

    test('should use default retention period of 90 days', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);

      await contentRepo.saveContent({
        text: 'Old Content',
        type: 'major',
        generatedAt: oldDate,
        sentAt: null,
        aiProvider: 'openai',
      });

      const deleted = await contentRepo.cleanupOldRecords();

      expect(deleted).toBe(1);
    });

    test('should log deletion count when records are deleted', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);

      await contentRepo.saveContent({
        text: 'Old Content',
        type: 'major',
        generatedAt: oldDate,
        sentAt: null,
        aiProvider: 'openai',
      });

      await contentRepo.cleanupOldRecords(90);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retention cleanup: deleted 1 records older than 90 days')
      );

      consoleSpy.mockRestore();
    });

    test('should not log when no records are deleted', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await contentRepo.cleanupOldRecords(90);

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Retention cleanup'));

      consoleSpy.mockRestore();
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Force an error by using invalid retention days
      const invalidModel = {
        deleteOlderThan: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const invalidRepo = new ContentRepository(invalidModel as unknown as ContentModel);

      const deleted = await invalidRepo.cleanupOldRecords(90);

      expect(deleted).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Retention cleanup failed:', 'Database error');

      consoleWarnSpy.mockRestore();
    });
  });
});
