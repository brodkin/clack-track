// Set environment variables BEFORE any imports that call bootstrap
process.env.OPENAI_API_KEY = 'test-key';
process.env.VESTABOARD_LOCAL_API_KEY = 'test-vestaboard-key';
process.env.VESTABOARD_LOCAL_API_URL = 'http://localhost:7000';

// Mock VestaboardHTTPClient to avoid real API calls
jest.mock('../../src/api/vestaboard/http-client.js', () => {
  // Create a 6x22 empty board layout (all zeros)
  const emptyBoard = Array.from({ length: 6 }, () => Array.from({ length: 22 }, () => 0));

  return {
    VestaboardHTTPClient: jest.fn().mockImplementation(() => ({
      post: jest.fn().mockResolvedValue(undefined),
      postWithAnimation: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(emptyBoard),
    })),
  };
});

import { bootstrap } from '../../src/bootstrap.js';
import { Database, createDatabase } from '../../src/storage/database.js';
import { ContentModel } from '../../src/storage/models/content.js';

describe('Bootstrap - Retention Cleanup Integration', () => {
  let database: Database;

  beforeAll(async () => {
    // Connect to test database (uses in-memory SQLite in test env)
    database = await createDatabase();
    await database.connect();
    await database.migrate();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  beforeEach(async () => {
    // Clean table before each test (DELETE works in both MySQL and SQLite)
    await database.run('DELETE FROM content');
  });

  test('should run retention cleanup on startup', async () => {
    const contentModel = new ContentModel(database);
    const now = new Date();
    const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
    const recentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Create old record that should be deleted
    await contentModel.create({
      text: 'Old Content',
      type: 'major',
      generatedAt: oldDate,
      sentAt: null,
      aiProvider: 'openai',
    });

    // Create recent record that should be kept
    await contentModel.create({
      text: 'Recent Content',
      type: 'major',
      generatedAt: recentDate,
      sentAt: null,
      aiProvider: 'openai',
    });

    // Verify both records exist before bootstrap
    const beforeCleanup = await contentModel.findLatest(10);
    expect(beforeCleanup).toHaveLength(2);

    // Bootstrap should trigger cleanup (wait a moment for fire-and-forget to complete)
    const { scheduler, haClient } = await bootstrap();

    // Give cleanup time to complete (fire-and-forget pattern)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify old record was deleted
    const afterCleanup = await contentModel.findLatest(10);
    expect(afterCleanup).toHaveLength(1);
    expect(afterCleanup[0].text).toBe('Recent Content');

    // Cleanup
    scheduler.stop();
    if (haClient) {
      await haClient.disconnect();
    }
  }, 10000); // Increase timeout for bootstrap
});
