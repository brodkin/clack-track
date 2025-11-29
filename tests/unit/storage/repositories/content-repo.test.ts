import { ContentRepository } from '../../../../src/storage/repositories/content-repo.js';
import { ContentModel } from '../../../../src/storage/models/index.js';
import { Database, createDatabase } from '../../../../src/storage/database.js';

describe('ContentRepository', () => {
  let db: Database;
  let contentModel: ContentModel;
  let contentRepo: ContentRepository;

  beforeEach(async () => {
    db = await createDatabase();
    await db.connect();
    await db.migrate();
    // Clean table for isolated tests (DELETE works in both MySQL and SQLite)
    await db.run('DELETE FROM content');
    contentModel = new ContentModel(db);
    contentRepo = new ContentRepository(contentModel);
  });

  afterEach(async () => {
    await db.disconnect();
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

      // Wait 1 second for MySQL DATETIME precision
      await new Promise(resolve => setTimeout(resolve, 1000));

      await contentRepo.saveContent({
        text: 'Content 2',
        type: 'major',
        generatedAt: new Date(),
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
