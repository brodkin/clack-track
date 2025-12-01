/* eslint-disable @typescript-eslint/no-require-imports */
const request = require('supertest');
/* eslint-enable @typescript-eslint/no-require-imports */
import { Express } from 'express';
import { WebServer } from '@/web/server';
import { createDatabase, Database } from '@/storage/database';
import { ContentModel, VoteModel, LogModel } from '@/storage/models/index';
import { ContentRepository, VoteRepository } from '@/storage/repositories/index';
import type { WebDependencies } from '@/web/types';

describe('WebServer Database Integration Tests', () => {
  let server: WebServer;
  let database: Database;
  let contentRepository: ContentRepository;
  let voteRepository: VoteRepository;
  let logModel: LogModel;
  let app: Express;

  beforeAll(async () => {
    // Create in-memory SQLite database (NODE_ENV=test uses :memory:)
    database = await createDatabase();
    await database.connect();
    await database.migrate();

    // Create all models
    const contentModel = new ContentModel(database);
    const voteModel = new VoteModel(database);
    logModel = new LogModel(database);

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
    await database.disconnect();
  });

  describe('Database Connection and Migration', () => {
    it('should create database successfully', () => {
      expect(database).toBeDefined();
    });

    it('should connect and migrate database without errors', async () => {
      // Database is already connected and migrated in beforeAll
      // Verify by running a simple query
      const result = await database.all('SELECT 1 as test');
      expect(result).toEqual([{ test: 1 }]);
    });

    it('should create all required tables', async () => {
      // Verify content table exists
      const contentTable = await database.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='content'"
      );
      expect(contentTable).toBeDefined();
      expect(contentTable).toHaveProperty('name', 'content');

      // Verify votes table exists
      const votesTable = await database.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='votes'"
      );
      expect(votesTable).toBeDefined();
      expect(votesTable).toHaveProperty('name', 'votes');

      // Verify logs table exists
      const logsTable = await database.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='logs'"
      );
      expect(logsTable).toBeDefined();
      expect(logsTable).toHaveProperty('name', 'logs');
    });
  });

  describe('WebServer with Real Database', () => {
    describe('GET /api/content/latest', () => {
      beforeEach(async () => {
        // Clear content table for test isolation
        await database.run('DELETE FROM content');
      });

      it('should return 404 when no content exists', async () => {
        const response = await request(app).get('/api/content/latest');

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'No content found');
      });

      it('should return latest content when content exists', async () => {
        // Insert test content
        await database.run(
          'INSERT INTO content (text, type, generatedAt, sentAt, aiProvider, status) VALUES (?, ?, ?, ?, ?, ?)',
          [
            'Test content',
            'major',
            new Date().toISOString(),
            new Date().toISOString(),
            'openai',
            'success',
          ]
        );

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
        await database.run('DELETE FROM content');

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
          await database.run(
            'INSERT INTO content (text, type, generatedAt, sentAt, aiProvider, status) VALUES (?, ?, ?, ?, ?, ?)',
            [
              `Content ${i}`,
              'major',
              new Date(Date.now() - i * 1000).toISOString(),
              new Date(Date.now() - i * 1000).toISOString(),
              'openai',
              'success',
            ]
          );
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
        await database.run('DELETE FROM logs');
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
        await database.run('INSERT INTO logs (level, message, created_at) VALUES (?, ?, ?)', [
          'info',
          'Test log message',
          new Date().toISOString(),
        ]);

        const response = await request(app).get('/api/logs');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toHaveProperty('message', 'Test log message');
        expect(response.body.data[0]).toHaveProperty('level', 'info');
      });

      it('should filter logs by level', async () => {
        // Insert logs with different levels
        await database.run('INSERT INTO logs (level, message) VALUES (?, ?)', ['info', 'Info log']);
        await database.run('INSERT INTO logs (level, message) VALUES (?, ?)', [
          'error',
          'Error log',
        ]);
        await database.run('INSERT INTO logs (level, message) VALUES (?, ?)', [
          'warn',
          'Warning log',
        ]);

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
        await database.run('DELETE FROM votes');
        await database.run('DELETE FROM content');

        // Insert test content
        const result = await database.run(
          'INSERT INTO content (text, type, generatedAt, aiProvider, status) VALUES (?, ?, ?, ?, ?)',
          ['Votable content', 'major', new Date().toISOString(), 'openai', 'success']
        );
        contentId = result.lastID!;
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
        await database.run('DELETE FROM votes');
        await database.run('DELETE FROM content');
      });

      it('should return vote statistics', async () => {
        // Insert content and votes
        const result = await database.run(
          'INSERT INTO content (text, type, generatedAt, aiProvider, status) VALUES (?, ?, ?, ?, ?)',
          ['Stat content', 'major', new Date().toISOString(), 'openai', 'success']
        );
        const contentId = result.lastID!;

        await database.run('INSERT INTO votes (content_id, vote_type) VALUES (?, ?)', [
          contentId,
          'good',
        ]);
        await database.run('INSERT INTO votes (content_id, vote_type) VALUES (?, ?)', [
          contentId,
          'good',
        ]);
        await database.run('INSERT INTO votes (content_id, vote_type) VALUES (?, ?)', [
          contentId,
          'bad',
        ]);

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
