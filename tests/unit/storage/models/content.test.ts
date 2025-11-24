import { ContentModel } from '../../../../src/storage/models/index.js';
import { Database } from '../../../../src/storage/database.js';

describe('ContentModel', () => {
  let db: Database;
  let contentModel: ContentModel;

  beforeEach(async () => {
    db = new Database();
    await db.connect();
    await db.migrate();
    contentModel = new ContentModel(db);
  });

  afterEach(async () => {
    await db.disconnect();
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

      const content1 = await contentModel.create({
        text: 'Content 1',
        type: 'major',
        generatedAt: new Date(now.getTime()),
        sentAt: null,
        aiProvider: 'openai',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const content2 = await contentModel.create({
        text: 'Content 2',
        type: 'minor',
        generatedAt: new Date(),
        sentAt: null,
        aiProvider: 'openai',
      });

      const results = await contentModel.findLatest(10);

      expect(results).toHaveLength(2);
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
});
