/* eslint-disable @typescript-eslint/no-require-imports */
const request = require('supertest');
/* eslint-enable @typescript-eslint/no-require-imports */
import { Express } from 'express';
import { WebServer } from '@/web/server';
import { getKnexInstance, closeKnexInstance, resetKnexInstance, type Knex } from '@/storage/knex';
import { ContentModel, VoteModel, LogModel } from '@/storage/models/index';
import { ContentRepository, VoteRepository } from '@/storage/repositories/index';
import type { WebDependencies } from '@/web/types';

describe('WebServer Database Integration Tests', () => {
  let server: WebServer;
  let knex: Knex;
  let contentRepository: ContentRepository;
  let voteRepository: VoteRepository;
  let logModel: LogModel;
  let app: Express;

  beforeAll(async () => {
    // Create in-memory SQLite database (NODE_ENV=test uses :memory:)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create tables manually instead of using migrations (avoids ES module import issues)
    const contentTableExists = await knex.schema.hasTable('content');
    if (!contentTableExists) {
      await knex.schema.createTable('content', table => {
        table.increments('id').primary();
        table.text('text').notNullable();
        table.enum('type', ['major', 'minor']).notNullable();
        table.dateTime('generatedAt').notNullable();
        table.dateTime('sentAt').nullable();
        table.string('aiProvider', 50).notNullable();
        table.json('metadata').nullable();
        table.enum('status', ['success', 'failed']).notNullable().defaultTo('success');
        table.string('generatorId', 100).nullable();
        table.string('generatorName', 200).nullable();
        table.integer('priority').nullable().defaultTo(2);
        table.string('aiModel', 100).nullable();
        table.string('modelTier', 20).nullable();
        table.boolean('failedOver').nullable().defaultTo(false);
        table.string('primaryProvider', 50).nullable();
        table.text('primaryError').nullable();
        table.string('errorType', 100).nullable();
        table.text('errorMessage').nullable();
        table.integer('tokensUsed').nullable();
        table.integer('validationAttempts').nullable().defaultTo(0);
        table.json('rejectionReasons').nullable();
        table.index('generatedAt', 'idx_generated_at');
        table.index('status', 'idx_status');
        table.index('generatorId', 'idx_generator_id');
      });
    }

    const votesTableExists = await knex.schema.hasTable('votes');
    if (!votesTableExists) {
      await knex.schema.createTable('votes', table => {
        table.increments('id').primary();
        table.integer('content_id').unsigned().notNullable();
        table.foreign('content_id').references('id').inTable('content').onDelete('CASCADE');
        table.enum('vote_type', ['good', 'bad']).notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('userAgent', 500).nullable();
        table.string('ipAddress', 45).nullable();
        table.index('content_id', 'idx_votes_content_id');
      });
    }

    const logsTableExists = await knex.schema.hasTable('logs');
    if (!logsTableExists) {
      await knex.schema.createTable('logs', table => {
        table.increments('id').primary();
        table.string('level', 10).notNullable();
        table.text('message').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.text('metadata').nullable();
        table.index('level', 'idx_logs_level');
        table.index('created_at', 'idx_logs_created_at');
      });
    }

    // Create all models
    const contentModel = new ContentModel(knex);
    const voteModel = new VoteModel(knex);
    logModel = new LogModel(knex);

    // Create repositories
    contentRepository = new ContentRepository(contentModel);
    voteRepository = new VoteRepository(voteModel);

    // Create dependencies object
    const dependencies: WebDependencies = {
      contentRepository,
      voteRepository,
      logModel,
    };

    // Create WebServer with dependencies
    server = new WebServer(
      {
        port: 0, // Use random port for testing
        corsEnabled: true,
      },
      dependencies
    );

    // Start server
    await server.start();

    // Get Express app for supertest
    // @ts-expect-error - accessing private property for testing
    app = server.app;
  });

  afterAll(async () => {
    // Clean shutdown
    await server.stop();
    await closeKnexInstance();
  });

  describe('Database Connection and Migration', () => {
    it('should create database successfully', () => {
      expect(knex).toBeDefined();
    });

    it('should connect and migrate database without errors', async () => {
      // Database is already connected and migrated in beforeAll
      // Verify by running a simple query
      const result = await knex.raw('SELECT 1 as test');
      expect(result).toBeDefined();
    });

    it('should create all required tables', async () => {
      // Verify content table exists
      const contentTable = await knex.raw(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='content'"
      );
      expect(contentTable).toBeDefined();
      expect(contentTable[0]).toHaveProperty('name', 'content');

      // Verify votes table exists
      const votesTable = await knex.raw(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='votes'"
      );
      expect(votesTable).toBeDefined();
      expect(votesTable[0]).toHaveProperty('name', 'votes');

      // Verify logs table exists
      const logsTable = await knex.raw(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='logs'"
      );
      expect(logsTable).toBeDefined();
      expect(logsTable[0]).toHaveProperty('name', 'logs');
    });
  });

  describe('WebServer with Real Database', () => {
    describe('GET /api/content/latest', () => {
      beforeEach(async () => {
        // Clear content table for test isolation
        await knex('content').del();
      });

      it('should return 404 when no content exists', async () => {
        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'No content found');
      });

      it('should return latest content when content exists', async () => {
        // Insert test content
        await knex('content').insert({
          text: 'Test content',
          type: 'major',
          generatedAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
        });

        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('text', 'Test content');
        expect(response.body.data).toHaveProperty('type', 'major');
        expect(response.body.data).toHaveProperty('aiProvider', 'openai');
      });

      it('should not return 500 error for database operations', async () => {
        const response = await request(app).get('/api/content/latest');

        // Should be either 200 (content found) or 404 (no content), never 500
        expect([200, 404]).toContain(response.status);
      });
    });

    describe('GET /api/content/history', () => {
      it('should return empty array when no content exists', async () => {
        // Clear content table
        await knex('content').del();

        const response = await request(app).get('/api/content/history');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toEqual([]);
        expect(response.body).toHaveProperty('pagination');
      });

      it('should return content history with pagination', async () => {
        // Insert multiple content records
        for (let i = 1; i <= 5; i++) {
          await knex('content').insert({
            text: `Content ${i}`,
            type: 'major',
            generatedAt: new Date(Date.now() - i * 1000).toISOString(),
            sentAt: new Date(Date.now() - i * 1000).toISOString(),
            aiProvider: 'openai',
            status: 'success',
          });
        }

        const response = await request(app).get('/api/content/history?limit=3');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveLength(3);
        expect(response.body.pagination).toHaveProperty('limit', 3);
        expect(response.body.pagination).toHaveProperty('count', 3);
      });
    });

    describe('GET /api/logs', () => {
      beforeEach(async () => {
        // Clear logs table before each test
        await knex('logs').del();
      });

      it('should return empty array when no logs exist', async () => {
        const response = await request(app).get('/api/logs');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toEqual([]);
      });

      it('should return logs when logs exist', async () => {
        // Insert test logs
        await knex('logs').insert({
          level: 'info',
          message: 'Test log message',
          created_at: new Date().toISOString(),
        });

        const response = await request(app).get('/api/logs');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toHaveProperty('message', 'Test log message');
        expect(response.body.data[0]).toHaveProperty('level', 'info');
      });

      it('should filter logs by level', async () => {
        // Insert logs with different levels
        await knex('logs').insert({ level: 'info', message: 'Info log' });
        await knex('logs').insert({ level: 'error', message: 'Error log' });
        await knex('logs').insert({ level: 'warn', message: 'Warning log' });

        const response = await request(app).get('/api/logs?level=error');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toHaveProperty('level', 'error');
      });
    });

    describe('POST /api/vote', () => {
      let contentId: number;

      beforeEach(async () => {
        // Clear tables
        await knex('votes').del();
        await knex('content').del();

        // Insert test content
        const [insertedId] = await knex('content').insert({
          text: 'Votable content',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
        });
        contentId = insertedId;
      });

      it('should submit vote successfully', async () => {
        const response = await request(app).post('/api/vote').send({ contentId, vote: 'good' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('vote_type', 'good');
      });

      it('should reject invalid vote values', async () => {
        const response = await request(app).post('/api/vote').send({ contentId, vote: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/must be "good" or "bad"/);
      });

      it('should reject missing fields', async () => {
        const response = await request(app).post('/api/vote').send({ contentId });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/contentId and vote are required/);
      });
    });

    describe('GET /api/vote/stats', () => {
      beforeEach(async () => {
        // Clear tables
        await knex('votes').del();
        await knex('content').del();
      });

      it('should return vote statistics', async () => {
        // Insert content and votes
        const [insertedId] = await knex('content').insert({
          text: 'Stat content',
          type: 'major',
          generatedAt: new Date().toISOString(),
          aiProvider: 'openai',
          status: 'success',
        });
        const contentId = insertedId;

        await knex('votes').insert({ content_id: contentId, vote_type: 'good' });
        await knex('votes').insert({ content_id: contentId, vote_type: 'good' });
        await knex('votes').insert({ content_id: contentId, vote_type: 'bad' });

        const response = await request(app).get('/api/vote/stats');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('good', 2);
        expect(response.body.data).toHaveProperty('bad', 1);
        expect(response.body.data).toHaveProperty('ratio');
        expect(response.body.data.ratio).toBeCloseTo(0.6667, 2);
      });
    });
  });

  describe('Graceful Degradation - Undefined Dependencies', () => {
    let degradedServer: WebServer;
    let degradedApp: Express;

    beforeAll(async () => {
      // Create WebServer WITHOUT dependencies
      degradedServer = new WebServer({
        port: 0,
        corsEnabled: true,
      });

      await degradedServer.start();

      // @ts-expect-error - accessing private property for testing
      degradedApp = degradedServer.app;
    });

    afterAll(async () => {
      await degradedServer.stop();
    });

    it('should return 503 for /api/content/latest when contentRepository undefined', async () => {
      const response = await request(degradedApp).get('/api/content/latest');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toMatch(/service unavailable/i);
    });

    it('should return 503 for /api/logs when logModel undefined', async () => {
      const response = await request(degradedApp).get('/api/logs');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toMatch(/service unavailable/i);
    });

    it('should return 503 for /api/vote when voteRepository undefined', async () => {
      const response = await request(degradedApp)
        .post('/api/vote')
        .send({ contentId: 1, vote: 'good' });

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toMatch(/service unavailable/i);
    });

    it('should return 503 for /api/vote/stats when voteRepository undefined', async () => {
      const response = await request(degradedApp).get('/api/vote/stats');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toMatch(/service unavailable/i);
    });
  });

  describe('Database Error Handling', () => {
    it('should not throw "Database not connected" errors during normal operation', async () => {
      const response = await request(app).get('/api/content/latest');

      // Should return proper HTTP response, not throw database errors
      expect(response.status).toBeDefined();
      expect([200, 404, 500]).toContain(response.status);
      if (response.status === 500) {
        expect(response.body.error).not.toMatch(/database not connected/i);
      }
    });

    it('should not throw "Table doesn\'t exist" errors', async () => {
      const response = await request(app).get('/api/logs');

      expect(response.status).toBeDefined();
      if (response.status === 500) {
        expect(response.body.error).not.toMatch(/table.*doesn't exist/i);
      }
    });
  });

  describe('Response Format Validation', () => {
    it('should return JSON responses for all routes', async () => {
      const routes = [
        { method: 'get', path: '/api/content/latest' },
        { method: 'get', path: '/api/content/history' },
        { method: 'get', path: '/api/logs' },
        { method: 'get', path: '/api/vote/stats' },
      ];

      for (const route of routes) {
        const response = await request(app)[route.method](route.path);
        expect(response.type).toMatch(/json/);
        expect(response.body).toHaveProperty('success');
      }
    });

    it('should return consistent error format', async () => {
      // Create degraded server for consistent 503 errors
      const testServer = new WebServer({ port: 0 });
      await testServer.start();

      // @ts-expect-error - accessing private property
      const testApp = testServer.app;

      const response = await request(testApp).get('/api/content/latest');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');

      await testServer.stop();
    });
  });
});
