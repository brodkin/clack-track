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
import { getKnexInstance, closeKnexInstance, resetKnexInstance } from '../../src/storage/knex.js';
import { ContentModel } from '../../src/storage/models/content.js';
import { ContentRepository } from '../../src/storage/repositories/content-repo.js';

describe('Bootstrap - Retention Cleanup Integration', () => {
  beforeAll(async () => {
    // Initialize Knex connection and create table manually (avoids ES module import issues)
    resetKnexInstance();
    const knex = getKnexInstance();

    // Create table if it doesn't exist
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

  afterAll(async () => {
    await closeKnexInstance();
  });

  beforeEach(async () => {
    // Clean table before each test (DELETE works in both MySQL and SQLite)
    const knex = getKnexInstance();
    await knex('content').del();
  });

  test('should run retention cleanup on startup', async () => {
    const knex = getKnexInstance();
    const contentModel = new ContentModel(knex);
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

    // Create a deferred promise that resolves when cleanupOldRecords completes
    let resolveCleanup: () => void;
    const cleanupCompleted = new Promise<void>(resolve => {
      resolveCleanup = resolve;
    });

    // Spy on cleanupOldRecords to track when fire-and-forget operation completes
    const originalCleanup = ContentRepository.prototype.cleanupOldRecords;
    const cleanupSpy = jest
      .spyOn(ContentRepository.prototype, 'cleanupOldRecords')
      .mockImplementation(async function (this: ContentRepository, retentionDays?: number) {
        const result = await originalCleanup.call(this, retentionDays);
        resolveCleanup();
        return result;
      });

    // Bootstrap should trigger cleanup
    const { scheduler, haClient } = await bootstrap();

    // Wait for the fire-and-forget cleanup to complete (deterministic, no arbitrary timeout)
    await cleanupCompleted;

    // Restore spy
    cleanupSpy.mockRestore();

    // Verify old record was deleted
    const afterCleanup = await contentModel.findLatest(10);
    expect(afterCleanup).toHaveLength(1);
    expect(afterCleanup[0].text).toBe('Recent Content');

    // Cleanup
    scheduler.stop();
    if (haClient) {
      await haClient.disconnect();
    }
  }, 15000); // Timeout for bootstrap
});
