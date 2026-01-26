/**
 * Content Routes Integration Tests
 *
 * Tests the complete flow of moreInfoUrl from generator → database → API response.
 * Verifies that moreInfoUrl in metadata flows through the system correctly:
 * - Saved to database in metadata field
 * - Retrieved from database
 * - Included in API responses (/api/content/latest, /api/content/history)
 *
 * @group integration
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const request = require('supertest');
const express = require('express');
/* eslint-enable @typescript-eslint/no-require-imports */

import { Express } from 'express';
import knex, { Knex } from 'knex';
import { createContentRouter } from '@/web/routes/content';
import { ContentRepository } from '@/storage/repositories/content-repo';
import { ContentModel } from '@/storage/models/content';
import { FrameDecorator } from '@/content/frame/frame-decorator';

describe('Content Routes Integration Tests - moreInfoUrl', () => {
  let app: Express;
  let db: Knex;
  let contentModel: ContentModel;
  let contentRepository: ContentRepository;
  let frameDecorator: FrameDecorator;

  // Import migration modules
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration001 = require('../../../../migrations/001_create_content_table.cjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration005 = require('../../../../migrations/005_add_validation_attempts.cjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration006 = require('../../../../migrations/006_add_output_mode.cjs');

  beforeAll(async () => {
    // Create in-memory SQLite database for testing
    db = knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
      },
      useNullAsDefault: true,
    });

    // Run content table migrations
    await migration001.up(db);
    await migration005.up(db);
    await migration006.up(db);

    // Initialize repository with real database
    contentModel = new ContentModel(db);
    contentRepository = new ContentRepository(contentModel);
  });

  beforeEach(async () => {
    // Clean content table between tests
    await db('content').del();

    // Create frame decorator without dependencies (graceful degradation mode)
    frameDecorator = new FrameDecorator();

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());

    // Mount content router with real repository and frame decorator
    const contentRouter = createContentRouter({
      contentRepository,
      frameDecorator,
    });
    app.use('/api/content', contentRouter);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('GET /api/content/latest - moreInfoUrl in response', () => {
    it('should include moreInfoUrl when present in metadata', async () => {
      // RED: This test should FAIL initially - moreInfoUrl not yet in API response
      // Insert content with moreInfoUrl in metadata
      await db('content').insert({
        text: 'Breaking: Major climate summit concludes',
        type: 'major',
        generatedAt: new Date('2025-01-26T10:00:00Z').toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date('2025-01-26T10:01:00Z').toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'openai',
        outputMode: 'text',
        metadata: JSON.stringify({
          model: 'gpt-4o',
          tier: 'medium',
          provider: 'openai',
          moreInfoUrl: 'https://news.example.com/climate-summit-2025',
        }),
      });

      const response = await request(app).get('/api/content/latest');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();
      expect(response.body.data.metadata.moreInfoUrl).toBe(
        'https://news.example.com/climate-summit-2025'
      );
    });

    it('should return undefined/null when moreInfoUrl not present', async () => {
      // Edge case: Content without moreInfoUrl should not break
      await db('content').insert({
        text: 'Stay focused and keep moving',
        type: 'major',
        generatedAt: new Date('2025-01-26T11:00:00Z').toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date('2025-01-26T11:01:00Z').toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'anthropic',
        outputMode: 'text',
        metadata: JSON.stringify({
          model: 'claude-haiku-4.5',
          tier: 'light',
          provider: 'anthropic',
          // No moreInfoUrl
        }),
      });

      const response = await request(app).get('/api/content/latest');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();
      expect(response.body.data.metadata.moreInfoUrl).toBeUndefined();
    });

    it('should handle null metadata gracefully', async () => {
      // Edge case: Content with null metadata
      await db('content').insert({
        text: 'Fallback message',
        type: 'major',
        generatedAt: new Date('2025-01-26T12:00:00Z').toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date('2025-01-26T12:01:00Z').toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'programmatic',
        outputMode: 'text',
        metadata: null,
      });

      const response = await request(app).get('/api/content/latest');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.metadata).toBeUndefined();
    });

    it('should include moreInfoUrl with characterCodes for text mode', async () => {
      // Verify moreInfoUrl coexists with frame decoration
      await db('content').insert({
        text: 'Tech stocks rally on AI news',
        type: 'major',
        generatedAt: new Date('2025-01-26T13:00:00Z').toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date('2025-01-26T13:01:00Z').toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'openai',
        outputMode: 'text',
        metadata: JSON.stringify({
          model: 'gpt-4o',
          tier: 'medium',
          provider: 'openai',
          moreInfoUrl: 'https://finance.example.com/tech-rally',
        }),
      });

      const response = await request(app).get('/api/content/latest');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Should have both characterCodes (from frame decoration) and moreInfoUrl
      expect(response.body.data.characterCodes).toBeDefined();
      expect(Array.isArray(response.body.data.characterCodes)).toBe(true);
      expect(response.body.data.metadata.moreInfoUrl).toBe(
        'https://finance.example.com/tech-rally'
      );
    });

    it('should include moreInfoUrl for layout mode content', async () => {
      // Layout mode content should also preserve moreInfoUrl
      const mockCharacterCodes = Array(6)
        .fill(null)
        .map(() => Array(22).fill(0));

      await db('content').insert({
        text: '',
        type: 'major',
        generatedAt: new Date('2025-01-26T14:00:00Z').toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date('2025-01-26T14:01:00Z').toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'programmatic',
        outputMode: 'layout',
        metadata: JSON.stringify({
          characterCodes: mockCharacterCodes,
          moreInfoUrl: 'https://example.com/custom-layout',
        }),
      });

      const response = await request(app).get('/api/content/latest');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.metadata.moreInfoUrl).toBe('https://example.com/custom-layout');
    });
  });

  describe('GET /api/content/history - moreInfoUrl in items', () => {
    it('should include moreInfoUrl for all items with URLs', async () => {
      // Insert multiple content records with varying moreInfoUrl presence
      const now = new Date();

      // Content 1: With moreInfoUrl
      await db('content').insert({
        text: 'First news article',
        type: 'major',
        generatedAt: new Date(now.getTime() - 3000).toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date(now.getTime() - 2900).toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'openai',
        outputMode: 'text',
        metadata: JSON.stringify({
          moreInfoUrl: 'https://news.example.com/article-1',
        }),
      });

      // Content 2: Without moreInfoUrl
      await db('content').insert({
        text: 'Random motivational quote',
        type: 'major',
        generatedAt: new Date(now.getTime() - 2000).toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date(now.getTime() - 1900).toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'anthropic',
        outputMode: 'text',
        metadata: JSON.stringify({
          model: 'claude-haiku-4.5',
        }),
      });

      // Content 3: With moreInfoUrl
      await db('content').insert({
        text: 'Second news article',
        type: 'major',
        generatedAt: new Date(now.getTime() - 1000).toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date(now.getTime() - 900).toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'openai',
        outputMode: 'text',
        metadata: JSON.stringify({
          moreInfoUrl: 'https://news.example.com/article-2',
        }),
      });

      const response = await request(app).get('/api/content/history?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(3);

      // Verify moreInfoUrl presence in items (reverse order: newest first)
      const items = response.body.data;

      // Item 0: Second news article (newest) - should have moreInfoUrl
      expect(items[0].text).toBe('Second news article');
      expect(items[0].metadata.moreInfoUrl).toBe('https://news.example.com/article-2');

      // Item 1: Motivational quote - should NOT have moreInfoUrl
      expect(items[1].text).toBe('Random motivational quote');
      expect(items[1].metadata.moreInfoUrl).toBeUndefined();

      // Item 2: First news article (oldest) - should have moreInfoUrl
      expect(items[2].text).toBe('First news article');
      expect(items[2].metadata.moreInfoUrl).toBe('https://news.example.com/article-1');
    });

    it('should handle empty history gracefully', async () => {
      // No content in database
      const response = await request(app).get('/api/content/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.count).toBe(0);
    });

    it('should respect limit parameter with moreInfoUrl items', async () => {
      // Insert 5 content records, request only 3
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        await db('content').insert({
          text: `News article ${i + 1}`,
          type: 'major',
          generatedAt: new Date(now.getTime() - (5 - i) * 1000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' '),
          sentAt: new Date(now.getTime() - (5 - i) * 900)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' '),
          aiProvider: 'openai',
          outputMode: 'text',
          metadata: JSON.stringify({
            moreInfoUrl: `https://news.example.com/article-${i + 1}`,
          }),
        });
      }

      const response = await request(app).get('/api/content/history?limit=3');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(3);
      expect(response.body.pagination.limit).toBe(3);

      // Verify all 3 returned items have moreInfoUrl
      response.body.data.forEach((item: { metadata: { moreInfoUrl: string } }) => {
        expect(item.metadata.moreInfoUrl).toBeDefined();
        expect(item.metadata.moreInfoUrl).toMatch(/^https:\/\/news\.example\.com\/article-\d+$/);
      });
    });
  });

  describe('Database Round-trip - moreInfoUrl persistence', () => {
    it('should persist moreInfoUrl through save and retrieve cycle', async () => {
      // Test the complete cycle: save → retrieve via repository
      const contentData = {
        text: 'Database round-trip test',
        type: 'major' as const,
        generatedAt: new Date('2025-01-26T15:00:00Z'),
        sentAt: new Date('2025-01-26T15:01:00Z'),
        aiProvider: 'openai',
        outputMode: 'text' as const,
        metadata: {
          model: 'gpt-4o',
          tier: 'medium',
          provider: 'openai',
          moreInfoUrl: 'https://example.com/round-trip-test',
        },
      };

      // Save via repository
      await contentRepository.saveContent(contentData);

      // Retrieve via repository
      const retrieved = await contentRepository.getLatestContent();

      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata).toBeDefined();
      expect(retrieved?.metadata?.moreInfoUrl).toBe('https://example.com/round-trip-test');
    });

    it('should handle special characters in moreInfoUrl', async () => {
      // Test URL with query parameters, anchors, special chars
      const complexUrl =
        'https://news.example.com/article?id=123&ref=vestaboard#section-2&utm_source=api';

      await db('content').insert({
        text: 'Complex URL test',
        type: 'major',
        generatedAt: new Date('2025-01-26T16:00:00Z').toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date('2025-01-26T16:01:00Z').toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'openai',
        outputMode: 'text',
        metadata: JSON.stringify({
          moreInfoUrl: complexUrl,
        }),
      });

      const response = await request(app).get('/api/content/latest');

      expect(response.status).toBe(200);
      expect(response.body.data.metadata.moreInfoUrl).toBe(complexUrl);
    });

    it('should handle very long URLs', async () => {
      // Test URL at reasonable length limit
      const longUrl = `https://news.example.com/article-with-very-long-path/${'a'.repeat(200)}`;

      await db('content').insert({
        text: 'Long URL test',
        type: 'major',
        generatedAt: new Date('2025-01-26T17:00:00Z').toISOString().slice(0, 19).replace('T', ' '),
        sentAt: new Date('2025-01-26T17:01:00Z').toISOString().slice(0, 19).replace('T', ' '),
        aiProvider: 'openai',
        outputMode: 'text',
        metadata: JSON.stringify({
          moreInfoUrl: longUrl,
        }),
      });

      const response = await request(app).get('/api/content/latest');

      expect(response.status).toBe(200);
      expect(response.body.data.metadata.moreInfoUrl).toBe(longUrl);
      expect(response.body.data.metadata.moreInfoUrl.length).toBeGreaterThan(200);
    });
  });
});
