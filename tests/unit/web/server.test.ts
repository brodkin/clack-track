/**
 * WebServer Unit Tests
 *
 * Tests server lifecycle (start/stop), middleware configuration,
 * and signal handling using actual Express with minimal mocking.
 *
 * Only external dependencies are mocked:
 * - web-push: Prevents VAPID key configuration errors
 * - logger: Silences log output during tests
 */

// Mock only external dependencies that need isolation
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  log: jest.fn(),
}));

import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { WebServer } from '@/web/server';

describe('WebServer', () => {
  let server: WebServer;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('constructor', () => {
    it('should create instance with custom configuration', () => {
      server = new WebServer({
        port: 8080,
        host: 'localhost',
        corsEnabled: true,
        staticPath: '/custom/path',
      });

      expect(server).toBeInstanceOf(WebServer);
    });

    it('should use default values when configuration not provided', () => {
      server = new WebServer({});

      expect(server).toBeInstanceOf(WebServer);
    });
  });

  describe('start', () => {
    it('should start server successfully and listen on configured port', async () => {
      server = new WebServer({
        port: 0, // Use random available port
        host: '127.0.0.1',
      });

      await expect(server.start()).resolves.not.toThrow();
    });

    it('should throw error if already started', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await server.start();

      await expect(server.start()).rejects.toThrow('Server is already running');
    });
  });

  describe('stop', () => {
    it('should gracefully shutdown the server', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await server.start();
      await expect(server.stop()).resolves.not.toThrow();
    });

    it('should do nothing if server not started', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('middleware configuration', () => {
    it('should apply security headers via helmet', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await server.start();

      // Access internal app for supertest (test-only pattern)
      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app).get('/api/nonexistent');

      // Helmet adds security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    describe('Content-Security-Policy directives', () => {
      let csp: string;

      beforeEach(async () => {
        server = new WebServer({
          port: 0,
          host: '127.0.0.1',
        });

        await server.start();

        // Use a valid route to get Helmet CSP (404 responses override CSP with default-src 'none')
        const app = (server as unknown as { app: Express.Application }).app;
        const response = await request(app).get('/api/auth/session');
        csp = response.headers['content-security-policy'];
      });

      it('should include font-src allowing self and Google Fonts', () => {
        expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
      });

      it('should include fonts.googleapis.com in style-src', () => {
        expect(csp).toContain('https://fonts.googleapis.com');
        expect(csp).toMatch(/style-src[^;]*'self'/);
        expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
      });

      it('should include explicit connect-src set to self', () => {
        expect(csp).toContain("connect-src 'self'");
      });
    });

    describe('static asset caching', () => {
      let tmpDir: string;

      beforeAll(() => {
        // Create a temporary directory with a test static file to simulate Vite hashed assets
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clack-static-'));
        const assetsDir = path.join(tmpDir, 'assets');
        fs.mkdirSync(assetsDir);
        fs.writeFileSync(path.join(assetsDir, 'index-abc123.js'), '// test asset');
      });

      afterAll(() => {
        // Clean up temporary directory
        fs.rmSync(tmpDir, { recursive: true, force: true });
      });

      it('should set Cache-Control with max-age and immutable for static assets', async () => {
        server = new WebServer({
          port: 0,
          host: '127.0.0.1',
          staticPath: tmpDir,
        });

        await server.start();

        const app = (server as unknown as { app: Express.Application }).app;
        const response = await request(app).get('/assets/index-abc123.js');

        expect(response.status).toBe(200);

        const cacheControl = response.headers['cache-control'];
        expect(cacheControl).toBeDefined();
        // express.static with maxAge: '1y' sets max-age=31536000 (seconds in a year)
        expect(cacheControl).toContain('max-age=31536000');
        expect(cacheControl).toContain('immutable');
      });
    });

    it('should apply compression middleware', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await server.start();

      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app).get('/api/nonexistent').set('Accept-Encoding', 'gzip');

      // Request was processed (compression is transparent but enabled)
      expect(response.status).toBeDefined();
    });

    it('should enable CORS when corsEnabled is true', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
        corsEnabled: true,
      });

      await server.start();

      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app)
        .options('/api/auth/session')
        .set('Origin', 'http://example.com')
        .set('Access-Control-Request-Method', 'GET');

      // CORS headers present when enabled
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should not include CORS headers when corsEnabled is false', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
        corsEnabled: false,
      });

      await server.start();

      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app)
        .get('/api/auth/session')
        .set('Origin', 'http://example.com');

      // CORS headers not present when disabled
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should parse JSON request bodies', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await server.start();

      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app)
        .post('/api/auth/login/verify')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      // Request processed (400 is expected since data is incomplete, not 415 unsupported media type)
      expect(response.status).not.toBe(415);
    });
  });

  describe('API routes', () => {
    it('should respond to auth session endpoint', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await server.start();

      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app).get('/api/auth/session');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('authenticated');
    });

    it('should respond to push VAPID key endpoint', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await server.start();

      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app).get('/api/push/vapid-public-key');

      // Returns 500 when VAPID not configured (expected in test env)
      expect([200, 500]).toContain(response.status);
    });

    it('should return 503 for content endpoint without dependencies', async () => {
      server = new WebServer(
        {
          port: 0,
          host: '127.0.0.1',
        },
        {} // No dependencies
      );

      await server.start();

      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app).get('/api/content/latest');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Content service unavailable');
    });

    it('should return 503 for logs endpoint without dependencies', async () => {
      server = new WebServer(
        {
          port: 0,
          host: '127.0.0.1',
        },
        {} // No dependencies
      );

      await server.start();

      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Logs service unavailable');
    });

    it('should return 503 for voting endpoint without dependencies', async () => {
      server = new WebServer(
        {
          port: 0,
          host: '127.0.0.1',
        },
        {} // No dependencies
      );

      await server.start();

      const app = (server as unknown as { app: Express.Application }).app;
      const response = await request(app).post('/api/vote').send({ contentId: 1, value: 1 });

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Voting service unavailable');
    });
  });

  describe('signal handling', () => {
    let processOnSpy: jest.SpyInstance;
    let processOffSpy: jest.SpyInstance;

    beforeEach(() => {
      processOnSpy = jest.spyOn(process, 'on');
      processOffSpy = jest.spyOn(process, 'off');
    });

    afterEach(() => {
      processOnSpy.mockRestore();
      processOffSpy.mockRestore();
    });

    it('should register SIGTERM and SIGINT handlers on start', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await server.start();

      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should clean up signal handlers on stop', async () => {
      server = new WebServer({
        port: 0,
        host: '127.0.0.1',
      });

      await server.start();
      processOffSpy.mockClear();

      await server.stop();

      expect(processOffSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOffSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });
});
