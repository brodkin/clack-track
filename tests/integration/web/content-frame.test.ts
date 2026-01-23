/**
 * Content Frame Display Pipeline Integration Tests
 *
 * Tests the complete pipeline from database to API response for frame display:
 * - outputMode='text' content returns decorated characterCodes
 * - outputMode='layout' content returns original characterCodes unchanged
 * - null outputMode (legacy) treated as 'text' with frame decoration
 * - Weather API unavailable still returns frame (time only, no weather)
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
import type { HomeAssistantClient } from '@/api/data-sources/home-assistant';

describe('Content Frame Display Pipeline Integration Tests', () => {
  let app: Express;
  let db: Knex;
  let contentModel: ContentModel;
  let contentRepository: ContentRepository;
  let frameDecorator: FrameDecorator;

  // Import migration modules
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration001 = require('../../../migrations/001_create_content_table.cjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration005 = require('../../../migrations/005_add_validation_attempts.cjs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration006 = require('../../../migrations/006_add_output_mode.cjs');

  /**
   * Create a valid 6x22 character codes grid
   * Used for layout mode content stored in metadata
   */
  function createMockCharacterCodes(): number[][] {
    return Array(6)
      .fill(null)
      .map(() => Array(22).fill(0));
  }

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
    // In integration tests, we test with minimal dependencies to isolate behavior
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

  describe('GET /api/content/latest - Frame Decoration Pipeline', () => {
    describe('outputMode=text', () => {
      it('should apply frame decoration and return characterCodes for text mode content', async () => {
        // Insert content with outputMode='text'
        await db('content').insert({
          text: 'HELLO WORLD',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('text', 'HELLO WORLD');
        expect(response.body.data).toHaveProperty('outputMode', 'text');
        expect(response.body.data).toHaveProperty('characterCodes');

        // Verify characterCodes structure (6 rows x 22 columns)
        const characterCodes = response.body.data.characterCodes;
        expect(Array.isArray(characterCodes)).toBe(true);
        expect(characterCodes.length).toBe(6);
        characterCodes.forEach((row: number[]) => {
          expect(Array.isArray(row)).toBe(true);
          expect(row.length).toBe(22);
          row.forEach((code: number) => {
            expect(typeof code).toBe('number');
          });
        });
      });

      it('should include frame decoration with time in info bar', async () => {
        await db('content').insert({
          text: 'CURRENT TIME TEST',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.data.characterCodes).toBeDefined();

        // Row 5 (index 5) is the info bar - should contain time data
        // Info bar contains time codes - verify it's not all zeros
        const infoBarRow = response.body.data.characterCodes[5];
        const hasNonZeroValues = infoBarRow.some((code: number) => code !== 0);
        expect(hasNonZeroValues).toBe(true);
      });
    });

    describe('outputMode=layout', () => {
      it('should return stored characterCodes unchanged for layout mode content', async () => {
        const storedCharacterCodes = createMockCharacterCodes();
        // Set distinctive values to verify they're returned as-is
        storedCharacterCodes[0][0] = 63; // Red color tile
        storedCharacterCodes[2][5] = 64; // Orange color tile
        storedCharacterCodes[5][10] = 69; // White/Black color tile

        await db('content').insert({
          text: '', // Layout mode typically has empty text
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'programmatic',
          status: 'success',
          outputMode: 'layout',
          metadata: JSON.stringify({ characterCodes: storedCharacterCodes }),
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('outputMode', 'layout');
        expect(response.body.data).toHaveProperty('characterCodes');

        // Verify the stored characterCodes are returned unchanged
        const returnedCodes = response.body.data.characterCodes;
        expect(returnedCodes[0][0]).toBe(63);
        expect(returnedCodes[2][5]).toBe(64);
        expect(returnedCodes[5][10]).toBe(69);
      });

      it('should not apply frame decoration for layout mode', async () => {
        const storedCharacterCodes = createMockCharacterCodes();
        // Fill with specific pattern to verify no decoration applied
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < 22; col++) {
            storedCharacterCodes[row][col] = row + col;
          }
        }

        await db('content').insert({
          text: 'SLEEP MODE ART',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'programmatic',
          status: 'success',
          outputMode: 'layout',
          metadata: JSON.stringify({ characterCodes: storedCharacterCodes }),
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);

        // Verify the exact stored pattern is returned (no frame overlay)
        const returnedCodes = response.body.data.characterCodes;
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < 22; col++) {
            expect(returnedCodes[row][col]).toBe(row + col);
          }
        }
      });

      it('should gracefully handle layout mode without characterCodes in metadata', async () => {
        await db('content').insert({
          text: 'BROKEN LAYOUT',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'programmatic',
          status: 'success',
          outputMode: 'layout',
          metadata: JSON.stringify({ generator: 'test' }), // No characterCodes
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('outputMode', 'layout');
        // characterCodes should be undefined (graceful degradation)
        expect(response.body.data.characterCodes).toBeUndefined();
      });

      it('should gracefully handle layout mode with invalid characterCodes format', async () => {
        await db('content').insert({
          text: '',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'programmatic',
          status: 'success',
          outputMode: 'layout',
          metadata: JSON.stringify({ characterCodes: 'not-an-array' }),
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // Invalid format should result in undefined characterCodes
        expect(response.body.data.characterCodes).toBeUndefined();
      });
    });

    describe('null outputMode (legacy)', () => {
      it('should treat null outputMode as text mode and apply frame decoration', async () => {
        await db('content').insert({
          text: 'LEGACY CONTENT',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: null, // Legacy record before outputMode was added
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('text', 'LEGACY CONTENT');
        // null outputMode should be treated as 'text'
        expect(response.body.data.outputMode).toBeNull();

        // Should still get characterCodes from frame decoration
        expect(response.body.data).toHaveProperty('characterCodes');
        expect(response.body.data.characterCodes.length).toBe(6);
        expect(response.body.data.characterCodes[0].length).toBe(22);
      });

      it('should decorate legacy content the same as explicit text mode', async () => {
        // Insert legacy content (null outputMode)
        await db('content').insert({
          id: 1,
          text: 'SAME TEXT',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: null,
        });

        const legacyResponse = await request(app).get('/api/content/latest');
        const legacyCharCodes = legacyResponse.body.data.characterCodes;

        // Clear and insert text mode content
        await db('content').del();
        await db('content').insert({
          id: 2,
          text: 'SAME TEXT',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        });

        const textResponse = await request(app).get('/api/content/latest');
        const textCharCodes = textResponse.body.data.characterCodes;

        // Both should produce valid 6x22 grids
        expect(legacyCharCodes.length).toBe(6);
        expect(textCharCodes.length).toBe(6);

        // The content area (rows 0-4) should match as both have same text
        // Note: Timing differences may affect info bar (row 5), so we only check content rows
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 21; col++) {
            expect(legacyCharCodes[row][col]).toBe(textCharCodes[row][col]);
          }
        }
      });
    });

    describe('Weather unavailable scenario', () => {
      it('should return frame with time only when no HomeAssistant is configured', async () => {
        // Frame decorator is created without HomeAssistant client
        // This simulates weather being unavailable
        await db('content').insert({
          text: 'NO WEATHER TEST',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('characterCodes');

        // Frame should still be valid 6x22
        const characterCodes = response.body.data.characterCodes;
        expect(characterCodes.length).toBe(6);
        expect(characterCodes[0].length).toBe(22);

        // Info bar should have time data (codes for digits)
        // Without weather, info bar shows time centered
        const infoBarRow = characterCodes[5];
        expect(infoBarRow.length).toBe(22);
      });

      it('should produce valid frame when weather service throws error', async () => {
        // Create mock HomeAssistant that throws errors
        const faultyHA = {
          connect: jest.fn(),
          disconnect: jest.fn(),
          isConnected: jest.fn(() => false),
          validateConnection: jest.fn().mockRejectedValue(new Error('Connection failed')),
          subscribeToEvents: jest.fn(),
          unsubscribeFromEvents: jest.fn(),
          getState: jest.fn().mockRejectedValue(new Error('State unavailable')),
          getAllStates: jest.fn().mockRejectedValue(new Error('States unavailable')),
          callService: jest.fn(),
          triggerReconnection: jest.fn(),
        } as unknown as HomeAssistantClient;

        // Create decorator with faulty HA client
        const faultyDecorator = new FrameDecorator({ homeAssistant: faultyHA });

        // Create app with faulty decorator
        const faultyApp = express();
        faultyApp.use(express.json());
        const faultyRouter = createContentRouter({
          contentRepository,
          frameDecorator: faultyDecorator,
        });
        faultyApp.use('/api/content', faultyRouter);

        await db('content').insert({
          text: 'WEATHER ERROR TEST',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        });

        const response = await request(faultyApp).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('characterCodes');

        // Frame should still be valid despite weather error
        const characterCodes = response.body.data.characterCodes;
        expect(characterCodes.length).toBe(6);
        expect(characterCodes[0].length).toBe(22);
      });
    });

    describe('Edge cases and error handling', () => {
      it('should return 404 when no content exists', async () => {
        // Database is empty after beforeEach cleanup
        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('No content found');
      });

      it('should handle database errors gracefully', async () => {
        // Create app with closed database connection
        const closedDb = knex({
          client: 'sqlite3',
          connection: { filename: ':memory:' },
          useNullAsDefault: true,
        });
        await closedDb.destroy(); // Close immediately

        const brokenModel = new ContentModel(closedDb);
        const brokenRepo = new ContentRepository(brokenModel);
        const brokenApp = express();
        brokenApp.use(express.json());
        brokenApp.use(
          '/api/content',
          createContentRouter({
            contentRepository: brokenRepo,
            frameDecorator,
          })
        );

        const response = await request(brokenApp).get('/api/content/latest');

        // Repository uses graceful degradation - returns null on error
        expect(response.status).toBe(404);
      });

      it('should return content without characterCodes when frameDecorator is undefined', async () => {
        // Create app without frame decorator
        const noDecoratorApp = express();
        noDecoratorApp.use(express.json());
        noDecoratorApp.use(
          '/api/content',
          createContentRouter({
            contentRepository,
            frameDecorator: undefined,
          })
        );

        await db('content').insert({
          text: 'NO DECORATOR',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        });

        const response = await request(noDecoratorApp).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('text', 'NO DECORATOR');
        // characterCodes should be undefined when decorator not available
        expect(response.body.data.characterCodes).toBeUndefined();
      });

      it('should handle empty text content gracefully', async () => {
        await db('content').insert({
          text: '',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('characterCodes');

        // Empty text should still produce valid frame
        const characterCodes = response.body.data.characterCodes;
        expect(characterCodes.length).toBe(6);
        expect(characterCodes[0].length).toBe(22);
      });

      it('should handle very long text content gracefully', async () => {
        const longText = 'A'.repeat(500); // Much longer than display capacity

        await db('content').insert({
          text: longText,
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('characterCodes');

        // Long text should be truncated but frame is still valid
        const characterCodes = response.body.data.characterCodes;
        expect(characterCodes.length).toBe(6);
        expect(characterCodes[0].length).toBe(22);
      });

      it('should handle special characters in text gracefully', async () => {
        await db('content').insert({
          text: 'HELLO\nWORLD\nTEST!@#',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('characterCodes');

        // Special characters should be handled (unsupported chars become spaces)
        const characterCodes = response.body.data.characterCodes;
        expect(characterCodes.length).toBe(6);
        expect(characterCodes[0].length).toBe(22);
      });
    });

    describe('Response data structure validation', () => {
      it('should include all required fields in response for text mode', async () => {
        await db('content').insert({
          text: 'FULL RESPONSE',
          type: 'major',
          generatedAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
          generatorId: 'test-generator',
          generatorName: 'Test Generator',
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');

        const data = response.body.data;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('text');
        expect(data).toHaveProperty('type');
        expect(data).toHaveProperty('generatedAt');
        expect(data).toHaveProperty('aiProvider');
        expect(data).toHaveProperty('outputMode');
        expect(data).toHaveProperty('characterCodes');
      });

      it('should include metadata for layout mode content', async () => {
        const metadata = {
          characterCodes: createMockCharacterCodes(),
          generator: 'sleep-mode',
          additionalData: { custom: 'value' },
        };

        await db('content').insert({
          text: '',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'programmatic',
          status: 'success',
          outputMode: 'layout',
          metadata: JSON.stringify(metadata),
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('metadata');
        expect(response.body.data.metadata).toHaveProperty('generator', 'sleep-mode');
        expect(response.body.data.metadata).toHaveProperty('additionalData');
      });
    });
  });

  describe('GET /api/content/history - No frame decoration', () => {
    it('should return history without characterCodes decoration', async () => {
      // Insert multiple content records
      await db('content').insert([
        {
          text: 'CONTENT 1',
          type: 'major',
          generatedAt: new Date(Date.now() - 3000).toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        },
        {
          text: 'CONTENT 2',
          type: 'major',
          generatedAt: new Date(Date.now() - 2000).toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'text',
        },
        {
          text: 'CONTENT 3',
          type: 'major',
          generatedAt: new Date(Date.now() - 1000).toISOString(),
          aiProvider: 'openai',
          status: 'success',
          outputMode: 'layout',
          metadata: JSON.stringify({ characterCodes: createMockCharacterCodes() }),
        },
      ]);

      const response = await request(app).get('/api/content/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);

      // History endpoint does NOT apply frame decoration
      // It returns raw data for efficiency
      response.body.data.forEach((item: Record<string, unknown>) => {
        expect(item).toHaveProperty('text');
        expect(item).toHaveProperty('outputMode');
        // characterCodes are NOT computed for history (no frame decoration)
        expect(item).not.toHaveProperty('characterCodes');
      });
    });
  });
});
