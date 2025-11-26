// Mock dependencies BEFORE imports
const mockServer = {
  close: jest.fn(callback => callback && callback()),
};

const mockListen = jest.fn((port, host, callback) => {
  if (callback) callback();
  return mockServer;
});

const mockUse = jest.fn();

const mockApp = {
  use: mockUse,
  listen: mockListen,
  static: jest.fn(() => jest.fn()),
  json: jest.fn(() => jest.fn()),
};

const mockExpressStatic = jest.fn(() => jest.fn());
const mockExpressJson = jest.fn(() => jest.fn());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExpress: any = jest.fn(() => mockApp);
mockExpress.static = mockExpressStatic;
mockExpress.json = mockExpressJson;

const mockCors = jest.fn(() => jest.fn());
const mockCompression = jest.fn(() => jest.fn());
const mockHelmet = jest.fn(() => jest.fn());

jest.mock('express', () => mockExpress);
jest.mock('cors', () => mockCors);
jest.mock('compression', () => mockCompression);
jest.mock('helmet', () => mockHelmet);
jest.mock('@/utils/logger', () => ({
  log: jest.fn(),
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

    it('should set up helmet security middleware first', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      expect(mockHelmet).toHaveBeenCalled();
      // Helmet should be called before other middleware (first app.use call)
      const helmetCallIndex = mockUse.mock.calls.findIndex(
        call => call[0] === mockHelmet.mock.results[0]?.value
      );
      expect(helmetCallIndex).toBe(0);
    });

    it('should set up compression middleware', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      expect(mockCompression).toHaveBeenCalled();
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

  describe('signal handling', () => {
    let processOnSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = process.env;
      process.env = { ...originalEnv };
      processOnSpy = jest.spyOn(process, 'on');
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    afterEach(() => {
      processOnSpy.mockRestore();
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

      // Get the SIGTERM handler
      const sigtermCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGTERM');
      const sigtermHandler = sigtermCall![1];

      // Call the handler and expect process.exit to be called
      await expect(async () => {
        await sigtermHandler();
      }).rejects.toThrow('process.exit called');

      expect(mockServer.close).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT signal gracefully', async () => {
      server = new WebServer({
        port: 3000,
        host: '0.0.0.0',
      });

      await server.start();

      // Get the SIGINT handler
      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      const sigintHandler = sigintCall![1];

      // Call the handler and expect process.exit to be called
      await expect(async () => {
        await sigintHandler();
      }).rejects.toThrow('process.exit called');

      expect(mockServer.close).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });
});
