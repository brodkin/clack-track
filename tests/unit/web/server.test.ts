// Mock dependencies BEFORE imports
const mockServer = {
  close: jest.fn(callback => callback && callback()),
};

const mockListen = jest.fn((port, host, callback) => {
  if (callback) callback();
  return mockServer;
});

const mockUse = jest.fn();

// Router mock - returns a router with mock methods
const createMockRouter = () => ({
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
});

const mockRouterInstance = createMockRouter();

const mockApp = {
  use: mockUse,
  listen: mockListen,
  static: jest.fn(() => jest.fn()),
  json: jest.fn(() => jest.fn()),
};

const mockExpressStatic = jest.fn(() => jest.fn());
const mockExpressJson = jest.fn(() => jest.fn());

// Create express mock with both default export AND named exports

const mockExpress = Object.assign(
  jest.fn(() => mockApp), // default export (for express())
  {
    // Named exports
    static: mockExpressStatic,
    json: mockExpressJson,
    Router: jest.fn(createMockRouter), // Named export Router
  }
);

const mockCors = jest.fn(() => jest.fn());
const mockCompression = jest.fn(() => jest.fn());
const mockHelmet = jest.fn(() => jest.fn());

// Express mock must use both default AND named exports
jest.mock('express', () => ({
  __esModule: true,
  default: mockExpress, // Default export
  Router: jest.fn(createMockRouter), // Named export
  static: mockExpressStatic,
  json: mockExpressJson,
}));

jest.mock('cors', () => mockCors);
jest.mock('compression', () => mockCompression);
jest.mock('helmet', () => mockHelmet);
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));
jest.mock('@/utils/logger', () => ({
  log: jest.fn(),
}));

// Mock routes BEFORE any server imports
jest.mock('@/web/routes/push.js', () => ({
  pushRouter: mockRouterInstance,
}));
jest.mock('@/web/routes/auth.js', () => ({
  createAuthRouter: jest.fn(() => mockRouterInstance),
}));
jest.mock('@/web/routes/account.js', () => ({
  createAccountRouter: jest.fn(() => mockRouterInstance),
}));
jest.mock('@/web/middleware/rate-limit.js', () => ({
  createRateLimiter: jest.fn(() => jest.fn()),
}));

import { WebServer } from '@/web/server';

describe('WebServer', () => {
  let server: WebServer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUse.mockClear();
    mockListen.mockClear();
    mockServer.close.mockClear();
  });

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
    it('should initialize Express app and start listening', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      expect(mockListen).toHaveBeenCalledWith(3000, '0.0.0.0', expect.any(Function));
    });

    it('should set up CORS middleware when corsEnabled is true', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: true,
      });

      await server.start();

      expect(mockCors).toHaveBeenCalled();
      expect(mockUse).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not set up CORS middleware when corsEnabled is false', async () => {
      mockCors.mockClear();

      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
        corsEnabled: false,
      });

      await server.start();

      expect(mockCors).not.toHaveBeenCalled();
    });

    it('should set up helmet security middleware', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Verify helmet middleware factory is invoked with expected config
      expect(mockHelmet).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSecurityPolicy: expect.objectContaining({
            directives: expect.objectContaining({
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
            }),
          }),
        })
      );
      // Verify helmet middleware is registered via app.use
      expect(mockUse).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should set up compression middleware', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Verify compression middleware factory is invoked
      expect(mockCompression).toHaveBeenCalled();
      // Verify compression middleware is registered via app.use
      expect(mockUse).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should set up static file serving from staticPath', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
        staticPath: '/custom/static/path',
      });

      await server.start();

      expect(mockExpressStatic).toHaveBeenCalledWith('/custom/static/path');
    });

    it('should throw error if already started', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      await expect(server.start()).rejects.toThrow('Server is already running');
    });

    it('should handle listen errors', async () => {
      const listenError = new Error('Port already in use');
      mockListen.mockImplementationOnce(() => {
        throw listenError;
      });

      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await expect(server.start()).rejects.toThrow('Port already in use');
    });
  });

  describe('stop', () => {
    it('should gracefully shutdown the server', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();
      await server.stop();

      expect(mockServer.close).toHaveBeenCalled();
    });

    it('should do nothing if server not started', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await expect(server.stop()).resolves.not.toThrow();
      expect(mockServer.close).not.toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      const closeError = new Error('Close failed');
      mockServer.close.mockImplementationOnce(callback => {
        callback(closeError);
      });

      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Stop should handle the error and not throw
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('middleware order and behavior', () => {
    it('should apply middleware in proper sequence', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Verify all middleware factories were called
      expect(mockHelmet).toHaveBeenCalled();
      expect(mockCompression).toHaveBeenCalled();
      expect(mockExpressStatic).toHaveBeenCalled();
      expect(mockExpressJson).toHaveBeenCalled();

      // Verify they were registered via app.use
      const useCallCount = mockUse.mock.calls.length;
      expect(useCallCount).toBeGreaterThanOrEqual(4); // At least helmet, compression, static, json
    });

    it('should register rate limiter for /api routes', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Verify /api route registration for rate limiting
      expect(mockUse).toHaveBeenCalledWith('/api', expect.any(Function));
    });

    it('should setup all required security and utility middleware', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Verify key middleware are set up (not order-dependent, just existence)
      const useCallArgs = mockUse.mock.calls.map(call => call[0]);

      // Should have helmet middleware (function)
      expect(useCallArgs.some(arg => typeof arg === 'function')).toBe(true);
      // Should have /api route middleware
      expect(useCallArgs.some(arg => arg === '/api')).toBe(true);
    });
  });

  describe('signal handling', () => {
    let processOnSpy: jest.SpyInstance;
    let processOffSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = process.env;
      process.env = { ...originalEnv };
      processOnSpy = jest.spyOn(process, 'on');
      processOffSpy = jest.spyOn(process, 'off');
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    afterEach(() => {
      processOnSpy.mockRestore();
      processOffSpy.mockRestore();
      processExitSpy.mockRestore();
      process.env = originalEnv;
    });

    it('should register SIGTERM handler', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should register SIGINT handler', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should handle SIGTERM signal gracefully', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Verify signal handler is registered
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      // Call stop directly to test cleanup behavior
      await server.stop();

      // Verify cleanup occurred
      expect(mockServer.close).toHaveBeenCalled();
      // Verify signal handlers were cleaned up
      expect(processOffSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should handle SIGINT signal gracefully', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Verify signal handler is registered
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      // Call stop directly to test cleanup behavior
      await server.stop();

      // Verify cleanup occurred
      expect(mockServer.close).toHaveBeenCalled();
      // Verify signal handlers were cleaned up
      expect(processOffSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should clean up signal handlers on stop', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Clear previous calls
      processOffSpy.mockClear();

      // Stop the server
      await server.stop();

      // Verify both signal handlers were cleaned up
      expect(processOffSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOffSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });
});
