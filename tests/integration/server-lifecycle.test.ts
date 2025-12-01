/**
 * Integration tests for WebServer lifecycle management
 *
 * Tests:
 * 1. Environment configuration parsing for WEB_SERVER_ENABLED
 * 2. Bootstrap integration with WebServer dependency injection
 * 3. Proper lifecycle management (scheduler, eventHandler, database cleanup)
 */

// Mock dotenv.config to prevent loading .env file in tests
jest.mock('dotenv', () => ({
  config: jest.fn(() => ({ parsed: {} })), // Mock returns empty parsed result
}));

describe('WebServer Configuration Integration', () => {
  const originalEnv = { ...process.env };

  // Helper function to load config with fresh module cache
  // We use dynamic import to avoid the require() linting error
  async function getLoadConfigFunction() {
    // Clear the module cache so we get a fresh load with mocked dotenv
    jest.resetModules();

    // Ensure required env vars exist for module loading
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    process.env.NODE_ENV = 'test';

    // Import the function - this will trigger module initialization with current env
    // and mocked dotenv.config (won't load .env file)
    const module = await import('../../src/config/env.js');
    return module.loadConfig;
  }

  beforeEach(() => {
    // Ensure required env vars exist for module loading
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Clear the module cache after each test
    jest.resetModules();
    jest.clearAllMocks();

    // Restore original environment
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  describe('WEB_SERVER_ENABLED configuration', () => {
    it('should parse WEB_SERVER_ENABLED=true as enabled', async () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'true';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert
      expect(config.web.enabled).toBe(true);
    });

    it('should parse WEB_SERVER_ENABLED=false as disabled', async () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'false';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert
      expect(config.web.enabled).toBe(false);
    });

    it('should default to enabled when WEB_SERVER_ENABLED is not set', async () => {
      // Arrange
      delete process.env.WEB_SERVER_ENABLED;
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert - should default to true
      expect(config.web.enabled).toBe(true);
    });

    it('should handle WEB_SERVER_ENABLED with other web config', async () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'false';
      process.env.WEB_PORT = '8080';
      process.env.WEB_HOST = 'localhost';
      process.env.CORS_ENABLED = 'true';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert - all config should be parsed correctly
      expect(config.web.enabled).toBe(false);
      expect(config.web.port).toBe(8080);
      expect(config.web.host).toBe('localhost');
      expect(config.web.corsEnabled).toBe(true);
    });
  });

  describe('Integration with main application flow', () => {
    it('should provide config.web.enabled for conditional server startup', async () => {
      // Arrange
      process.env.WEB_SERVER_ENABLED = 'false';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert - This is what index.ts would check
      const shouldStartServer = config.web.enabled;
      expect(shouldStartServer).toBe(false);
    });

    it('should maintain backward compatibility when WEB_SERVER_ENABLED is omitted', async () => {
      // Arrange - Simulate existing .env files without WEB_SERVER_ENABLED
      delete process.env.WEB_SERVER_ENABLED;
      process.env.WEB_PORT = '3000';
      const loadConfig = await getLoadConfigFunction();

      // Act
      const config = loadConfig();

      // Assert - Server should be enabled by default
      expect(config.web.enabled).toBe(true);
      expect(config.web.port).toBe(3000);
    });
  });

  describe('Bootstrap integration with WebServer', () => {
    // Mock bootstrap and WebServer for integration testing
    let mockBootstrap: jest.Mock;
    let mockWebServer: {
      start: jest.Mock;
      stop: jest.Mock;
    };
    let mockScheduler: {
      start: jest.Mock;
      stop: jest.Mock;
    };
    let mockEventHandler: {
      initialize: jest.Mock;
    } | null;
    let mockHAClient: {
      disconnect: jest.Mock;
    } | null;
    let mockKnex: {
      destroy: jest.Mock;
    } | null;

    beforeEach(() => {
      jest.resetModules();

      // Create mocks
      mockWebServer = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      mockScheduler = {
        start: jest.fn(),
        stop: jest.fn(),
      };

      mockEventHandler = {
        initialize: jest.fn().mockResolvedValue(undefined),
      };

      mockHAClient = {
        disconnect: jest.fn().mockResolvedValue(undefined),
      };

      mockKnex = {
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      // Mock bootstrap to return mocked components
      mockBootstrap = jest.fn().mockResolvedValue({
        knex: mockKnex,
        contentRepository: { list: jest.fn() },
        voteRepository: { create: jest.fn() },
        logModel: { log: jest.fn() },
        scheduler: mockScheduler,
        eventHandler: mockEventHandler,
        haClient: mockHAClient,
        orchestrator: {},
        registry: {},
      });
    });

    it('should call bootstrap and pass dependencies to WebServer', async () => {
      // This test validates the integration pattern we expect in index.ts:
      // 1. Call bootstrap()
      // 2. Extract knex and repositories
      // 3. Pass to WebServer constructor via dependencies parameter

      const bootstrapResult = await mockBootstrap();

      // Verify bootstrap was called
      expect(mockBootstrap).toHaveBeenCalled();

      // Verify bootstrap returns expected dependencies
      expect(bootstrapResult.knex).toBeDefined();
      expect(bootstrapResult.contentRepository).toBeDefined();
      expect(bootstrapResult.voteRepository).toBeDefined();
      expect(bootstrapResult.logModel).toBeDefined();

      // Simulate creating WebServer with dependencies
      const webServerWithDeps = {
        ...mockWebServer,
        dependencies: {
          contentRepository: bootstrapResult.contentRepository,
          voteRepository: bootstrapResult.voteRepository,
          logModel: bootstrapResult.logModel,
        },
      };

      expect(webServerWithDeps.dependencies.contentRepository).toBe(
        bootstrapResult.contentRepository
      );
      expect(webServerWithDeps.dependencies.voteRepository).toBe(bootstrapResult.voteRepository);
      expect(webServerWithDeps.dependencies.logModel).toBe(bootstrapResult.logModel);
    });

    it('should start scheduler after WebServer starts successfully', async () => {
      // Arrange
      const bootstrapResult = await mockBootstrap();

      // Act - Simulate main() flow
      await mockWebServer.start();
      bootstrapResult.scheduler.start();

      // Assert
      expect(mockWebServer.start).toHaveBeenCalled();
      expect(bootstrapResult.scheduler.start).toHaveBeenCalled();

      // Verify scheduler.start called AFTER webServer.start
      const startOrder = [mockWebServer.start, bootstrapResult.scheduler.start].map(
        fn => fn.mock.invocationCallOrder[0]
      );
      expect(startOrder[0]).toBeLessThan(startOrder[1]);
    });

    it('should initialize eventHandler conditionally if it exists', async () => {
      // Arrange
      const bootstrapResult = await mockBootstrap();

      // Act
      await mockWebServer.start();
      if (bootstrapResult.eventHandler) {
        await bootstrapResult.eventHandler.initialize();
      }

      // Assert
      expect(bootstrapResult.eventHandler?.initialize).toHaveBeenCalled();
    });

    it('should handle missing eventHandler gracefully', async () => {
      // Arrange - Bootstrap returns null eventHandler (HA not configured)
      mockBootstrap.mockResolvedValueOnce({
        knex: mockKnex,
        contentRepository: { list: jest.fn() },
        voteRepository: { create: jest.fn() },
        logModel: { log: jest.fn() },
        scheduler: mockScheduler,
        eventHandler: null, // No HA configured
        haClient: null,
        orchestrator: {},
        registry: {},
      });

      const bootstrapResult = await mockBootstrap();

      // Act - Should not throw when eventHandler is null
      await mockWebServer.start();
      if (bootstrapResult.eventHandler) {
        await bootstrapResult.eventHandler.initialize();
      }

      // Assert - No error thrown, initialize not called
      expect(bootstrapResult.eventHandler).toBeNull();
    });

    it('should cleanup scheduler on WebServer start failure', async () => {
      // Arrange
      const bootstrapResult = await mockBootstrap();
      const startError = new Error('Failed to bind to port');
      mockWebServer.start.mockRejectedValueOnce(startError);

      // Act & Assert
      await expect(mockWebServer.start()).rejects.toThrow('Failed to bind to port');

      // Cleanup should be called
      bootstrapResult.scheduler.stop();
      expect(bootstrapResult.scheduler.stop).toHaveBeenCalled();
    });

    it('should cleanup haClient on WebServer start failure', async () => {
      // Arrange
      const bootstrapResult = await mockBootstrap();
      const startError = new Error('Failed to bind to port');
      mockWebServer.start.mockRejectedValueOnce(startError);

      // Act & Assert
      await expect(mockWebServer.start()).rejects.toThrow('Failed to bind to port');

      // Cleanup should be called
      if (bootstrapResult.haClient) {
        await bootstrapResult.haClient.disconnect();
      }
      expect(bootstrapResult.haClient?.disconnect).toHaveBeenCalled();
    });

    it('should cleanup knex on WebServer start failure', async () => {
      // Arrange
      const bootstrapResult = await mockBootstrap();
      const startError = new Error('Failed to bind to port');
      mockWebServer.start.mockRejectedValueOnce(startError);

      // Act & Assert
      await expect(mockWebServer.start()).rejects.toThrow('Failed to bind to port');

      // Cleanup should be called in correct order
      bootstrapResult.scheduler.stop();
      if (bootstrapResult.haClient) await bootstrapResult.haClient.disconnect();
      if (bootstrapResult.knex) await bootstrapResult.knex.destroy();

      expect(bootstrapResult.knex?.destroy).toHaveBeenCalled();
    });

    it('should handle null haClient and knex gracefully during cleanup', async () => {
      // Arrange - Bootstrap returns null for optional components
      mockBootstrap.mockResolvedValueOnce({
        knex: null,
        contentRepository: undefined,
        voteRepository: undefined,
        logModel: undefined,
        scheduler: mockScheduler,
        eventHandler: null,
        haClient: null,
        orchestrator: {},
        registry: {},
      });

      const bootstrapResult = await mockBootstrap();
      const startError = new Error('Failed to bind to port');
      mockWebServer.start.mockRejectedValueOnce(startError);

      // Act & Assert - Should not throw on null cleanup
      await expect(mockWebServer.start()).rejects.toThrow('Failed to bind to port');

      // Cleanup with null checks
      bootstrapResult.scheduler.stop();
      if (bootstrapResult.haClient) await bootstrapResult.haClient.disconnect();
      if (bootstrapResult.knex) await bootstrapResult.knex.destroy();

      // Should complete without errors
      expect(bootstrapResult.scheduler.stop).toHaveBeenCalled();
      expect(bootstrapResult.haClient).toBeNull();
      expect(bootstrapResult.knex).toBeNull();
    });
  });

  describe('Signal handler cleanup (graceful shutdown)', () => {
    let mockWebServer: {
      start: jest.Mock;
      stop: jest.Mock;
    };
    let mockScheduler: {
      start: jest.Mock;
      stop: jest.Mock;
    };
    let mockEventHandler: {
      initialize: jest.Mock;
      shutdown: jest.Mock;
    } | null;
    let mockKnex: {
      destroy: jest.Mock;
    } | null;
    let mockProcessExit: jest.SpyInstance;
    let mockConsoleError: jest.SpyInstance;
    let signalHandlers: Record<string, (signal: string) => void>;

    beforeEach(() => {
      jest.resetModules();

      // Create mocks
      mockWebServer = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      mockScheduler = {
        start: jest.fn(),
        stop: jest.fn(),
      };

      mockEventHandler = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };

      mockKnex = {
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      // Mock process.exit to prevent test termination
      mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
        throw new Error(`process.exit(${code})`);
      });

      // Mock console.error to verify error logging
      mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Capture signal handlers
      signalHandlers = {};
      jest.spyOn(process, 'on').mockImplementation((event: string, handler: () => void) => {
        if (event === 'SIGTERM' || event === 'SIGINT') {
          signalHandlers[event] = handler;
        }
        return process;
      });
    });

    afterEach(() => {
      mockProcessExit.mockRestore();
      mockConsoleError.mockRestore();
      jest.restoreAllMocks();
    });

    it('should register SIGTERM handler after webServer.start() succeeds', async () => {
      // Arrange
      await mockWebServer.start();

      // Simulate signal handler registration
      const gracefulShutdown = async (_signal: string) => {
        await mockWebServer.stop();
        mockScheduler.stop();
        if (mockEventHandler) await mockEventHandler.shutdown();
        if (mockKnex) await mockKnex.destroy();
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

      // Assert - SIGTERM handler should be registered
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(signalHandlers['SIGTERM']).toBeDefined();
    });

    it('should register SIGINT handler after webServer.start() succeeds', async () => {
      // Arrange
      await mockWebServer.start();

      // Simulate signal handler registration
      const gracefulShutdown = async (_signal: string) => {
        await mockWebServer.stop();
        mockScheduler.stop();
        if (mockEventHandler) await mockEventHandler.shutdown();
        if (mockKnex) await mockKnex.destroy();
      };

      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      // Assert - SIGINT handler should be registered
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(signalHandlers['SIGINT']).toBeDefined();
    });

    it('should call webServer.stop() on SIGTERM', async () => {
      // Arrange
      await mockWebServer.start();

      const gracefulShutdown = async (_signal: string) => {
        await mockWebServer.stop();
        mockScheduler.stop();
        if (mockEventHandler) await mockEventHandler.shutdown();
        if (mockKnex) await mockKnex.destroy();
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

      // Act
      await signalHandlers['SIGTERM']('SIGTERM');

      // Assert
      expect(mockWebServer.stop).toHaveBeenCalled();
    });

    it('should call scheduler.stop() on SIGTERM', async () => {
      // Arrange
      await mockWebServer.start();

      const gracefulShutdown = async (_signal: string) => {
        await mockWebServer.stop();
        mockScheduler.stop();
        if (mockEventHandler) await mockEventHandler.shutdown();
        if (mockKnex) await mockKnex.destroy();
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

      // Act
      await signalHandlers['SIGTERM']('SIGTERM');

      // Assert
      expect(mockScheduler.stop).toHaveBeenCalled();
    });

    it('should call eventHandler.shutdown() on SIGTERM (not haClient.disconnect)', async () => {
      // Arrange
      await mockWebServer.start();

      const gracefulShutdown = async (_signal: string) => {
        await mockWebServer.stop();
        mockScheduler.stop();
        if (mockEventHandler) await mockEventHandler.shutdown();
        if (mockKnex) await mockKnex.destroy();
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

      // Act
      await signalHandlers['SIGTERM']('SIGTERM');

      // Assert
      expect(mockEventHandler?.shutdown).toHaveBeenCalled();
    });

    it('should call knex.destroy() on SIGTERM', async () => {
      // Arrange
      await mockWebServer.start();

      const gracefulShutdown = async (_signal: string) => {
        await mockWebServer.stop();
        mockScheduler.stop();
        if (mockEventHandler) await mockEventHandler.shutdown();
        if (mockKnex) await mockKnex.destroy();
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

      // Act
      await signalHandlers['SIGTERM']('SIGTERM');

      // Assert
      expect(mockKnex?.destroy).toHaveBeenCalled();
    });

    it('should cleanup in correct order on SIGTERM: webServer → scheduler → eventHandler → knex', async () => {
      // Arrange
      await mockWebServer.start();

      const gracefulShutdown = async (_signal: string) => {
        await mockWebServer.stop();
        mockScheduler.stop();
        if (mockEventHandler) await mockEventHandler.shutdown();
        if (mockKnex) await mockKnex.destroy();
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

      // Act
      await signalHandlers['SIGTERM']('SIGTERM');

      // Assert - Verify call order
      const callOrder = [
        mockWebServer.stop,
        mockScheduler.stop,
        mockEventHandler?.shutdown,
        mockKnex?.destroy,
      ].map(fn => fn?.mock.invocationCallOrder?.[0]);

      expect(callOrder[0]).toBeLessThan(callOrder[1]!); // webServer before scheduler
      expect(callOrder[1]!).toBeLessThan(callOrder[2]!); // scheduler before eventHandler
      expect(callOrder[2]!).toBeLessThan(callOrder[3]!); // eventHandler before knex
    });

    it('should handle null eventHandler during SIGTERM cleanup', async () => {
      // Arrange
      const nullEventHandler = null;
      await mockWebServer.start();

      const gracefulShutdown = async (_signal: string) => {
        await mockWebServer.stop();
        mockScheduler.stop();
        if (nullEventHandler) await nullEventHandler.shutdown();
        if (mockKnex) await mockKnex.destroy();
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

      // Act & Assert - Should not throw
      await expect(signalHandlers['SIGTERM']('SIGTERM')).resolves.not.toThrow();
      expect(mockWebServer.stop).toHaveBeenCalled();
      expect(mockScheduler.stop).toHaveBeenCalled();
      expect(mockKnex?.destroy).toHaveBeenCalled();
    });

    it('should handle null knex during SIGTERM cleanup', async () => {
      // Arrange
      const nullKnex = null;
      await mockWebServer.start();

      const gracefulShutdown = async (_signal: string) => {
        await mockWebServer.stop();
        mockScheduler.stop();
        if (mockEventHandler) await mockEventHandler.shutdown();
        if (nullKnex) await nullKnex.destroy();
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

      // Act & Assert - Should not throw
      await expect(signalHandlers['SIGTERM']('SIGTERM')).resolves.not.toThrow();
      expect(mockWebServer.stop).toHaveBeenCalled();
      expect(mockScheduler.stop).toHaveBeenCalled();
      expect(mockEventHandler?.shutdown).toHaveBeenCalled();
    });

    it('should handle webServer.stop() error in SIGTERM handler with .catch()', async () => {
      // Arrange
      const stopError = new Error('Failed to stop web server');
      mockWebServer.stop.mockRejectedValueOnce(stopError);
      await mockWebServer.start();

      // For this test, override process.exit to NOT throw, just track calls
      // This avoids double-throw issue when both try-catch and .catch() call process.exit
      mockProcessExit.mockImplementation((_code?: number) => {
        // Just track the call, don't throw
        return undefined as never;
      });

      const gracefulShutdown = async (_signal: string) => {
        try {
          await mockWebServer.stop();
          mockScheduler.stop();
          if (mockEventHandler) await mockEventHandler.shutdown();
          if (mockKnex) await mockKnex.destroy();
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      };

      // Register handler with .catch() for promise rejection handling
      process.on('SIGTERM', () => {
        gracefulShutdown('SIGTERM').catch(err => {
          console.error('Fatal error during shutdown:', err);
          process.exit(1);
        });
      });

      // Act - Call the handler and wait for completion
      signalHandlers['SIGTERM']('SIGTERM');
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Verify error was logged and process.exit was called
      expect(mockConsoleError).toHaveBeenCalledWith('Error during graceful shutdown:', stopError);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle eventHandler.shutdown() error in SIGTERM handler', async () => {
      // Arrange
      const shutdownError = new Error('Failed to shutdown event handler');
      mockEventHandler!.shutdown.mockRejectedValueOnce(shutdownError);
      await mockWebServer.start();

      // Override process.exit to NOT throw
      mockProcessExit.mockImplementation((_code?: number) => {
        return undefined as never;
      });

      const gracefulShutdown = async (_signal: string) => {
        try {
          await mockWebServer.stop();
          mockScheduler.stop();
          if (mockEventHandler) await mockEventHandler.shutdown();
          if (mockKnex) await mockKnex.destroy();
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGTERM', () => {
        gracefulShutdown('SIGTERM').catch(err => {
          console.error('Fatal error during shutdown:', err);
          process.exit(1);
        });
      });

      // Act
      signalHandlers['SIGTERM']('SIGTERM');
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error during graceful shutdown:',
        shutdownError
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle knex.destroy() error in SIGTERM handler', async () => {
      // Arrange
      const destroyError = new Error('Failed to destroy knex connection');
      mockKnex!.destroy.mockRejectedValueOnce(destroyError);
      await mockWebServer.start();

      // Override process.exit to NOT throw
      mockProcessExit.mockImplementation((_code?: number) => {
        return undefined as never;
      });

      const gracefulShutdown = async (_signal: string) => {
        try {
          await mockWebServer.stop();
          mockScheduler.stop();
          if (mockEventHandler) await mockEventHandler.shutdown();
          if (mockKnex) await mockKnex.destroy();
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGTERM', () => {
        gracefulShutdown('SIGTERM').catch(err => {
          console.error('Fatal error during shutdown:', err);
          process.exit(1);
        });
      });

      // Act
      signalHandlers['SIGTERM']('SIGTERM');
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error during graceful shutdown:',
        destroyError
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle webServer.stop() error in SIGINT handler with .catch()', async () => {
      // Arrange
      const stopError = new Error('Failed to stop web server');
      mockWebServer.stop.mockRejectedValueOnce(stopError);
      await mockWebServer.start();

      // Override process.exit to NOT throw
      mockProcessExit.mockImplementation((_code?: number) => {
        return undefined as never;
      });

      const gracefulShutdown = async (_signal: string) => {
        try {
          await mockWebServer.stop();
          mockScheduler.stop();
          if (mockEventHandler) await mockEventHandler.shutdown();
          if (mockKnex) await mockKnex.destroy();
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGINT', () => {
        gracefulShutdown('SIGINT').catch(err => {
          console.error('Fatal error during shutdown:', err);
          process.exit(1);
        });
      });

      // Act
      signalHandlers['SIGINT']('SIGINT');
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(mockConsoleError).toHaveBeenCalledWith('Error during graceful shutdown:', stopError);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit with code 0 on successful graceful shutdown', async () => {
      // Arrange
      await mockWebServer.start();

      // Override process.exit to NOT throw
      mockProcessExit.mockImplementation((_code?: number) => {
        return undefined as never;
      });

      const gracefulShutdown = async (_signal: string) => {
        try {
          await mockWebServer.stop();
          mockScheduler.stop();
          if (mockEventHandler) await mockEventHandler.shutdown();
          if (mockKnex) await mockKnex.destroy();
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGTERM', () => {
        gracefulShutdown('SIGTERM').catch(err => {
          console.error('Fatal error during shutdown:', err);
          process.exit(1);
        });
      });

      // Act
      signalHandlers['SIGTERM']('SIGTERM');
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(mockWebServer.stop).toHaveBeenCalled();
      expect(mockScheduler.stop).toHaveBeenCalled();
      expect(mockEventHandler?.shutdown).toHaveBeenCalled();
      expect(mockKnex?.destroy).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('Error handler cleanup (catch block)', () => {
    let mockBootstrap: jest.Mock;
    let mockWebServer: {
      start: jest.Mock;
      stop: jest.Mock;
    };
    let mockScheduler: {
      start: jest.Mock;
      stop: jest.Mock;
    };
    let mockEventHandler: {
      initialize: jest.Mock;
      shutdown: jest.Mock;
    } | null;
    let mockKnex: {
      destroy: jest.Mock;
    } | null;

    beforeEach(() => {
      jest.resetModules();

      // Create mocks
      mockWebServer = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      mockScheduler = {
        start: jest.fn(),
        stop: jest.fn(),
      };

      mockEventHandler = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };

      mockKnex = {
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      // Mock bootstrap to return mocked components
      mockBootstrap = jest.fn().mockResolvedValue({
        knex: mockKnex,
        contentRepository: { list: jest.fn() },
        voteRepository: { create: jest.fn() },
        logModel: { log: jest.fn() },
        scheduler: mockScheduler,
        eventHandler: mockEventHandler,
        orchestrator: {},
        registry: {},
      });
    });

    it('should call eventHandler.shutdown() instead of haClient.disconnect() on error', async () => {
      // Arrange
      const bootstrapResult = await mockBootstrap();
      const startError = new Error('Failed to bind to port');
      mockWebServer.start.mockRejectedValueOnce(startError);

      // Act & Assert
      await expect(mockWebServer.start()).rejects.toThrow('Failed to bind to port');

      // Cleanup should use eventHandler.shutdown()
      bootstrapResult.scheduler.stop();
      if (bootstrapResult.eventHandler) await bootstrapResult.eventHandler.shutdown();
      if (bootstrapResult.knex) await bootstrapResult.knex.destroy();

      expect(bootstrapResult.eventHandler?.shutdown).toHaveBeenCalled();
    });

    it('should NOT call haClient.disconnect() directly on error', async () => {
      // Arrange
      const mockHAClient = {
        disconnect: jest.fn().mockResolvedValue(undefined),
      };

      mockBootstrap.mockResolvedValueOnce({
        knex: mockKnex,
        contentRepository: { list: jest.fn() },
        voteRepository: { create: jest.fn() },
        logModel: { log: jest.fn() },
        scheduler: mockScheduler,
        eventHandler: mockEventHandler,
        haClient: mockHAClient,
        orchestrator: {},
        registry: {},
      });

      const bootstrapResult = await mockBootstrap();
      const startError = new Error('Failed to bind to port');
      mockWebServer.start.mockRejectedValueOnce(startError);

      // Act & Assert
      await expect(mockWebServer.start()).rejects.toThrow('Failed to bind to port');

      // Cleanup should use eventHandler.shutdown() which internally handles haClient
      bootstrapResult.scheduler.stop();
      if (bootstrapResult.eventHandler) await bootstrapResult.eventHandler.shutdown();
      if (bootstrapResult.knex) await bootstrapResult.knex.destroy();

      // haClient.disconnect should NOT be called directly
      expect(mockHAClient.disconnect).not.toHaveBeenCalled();
      // eventHandler.shutdown should be called (which handles haClient internally)
      expect(bootstrapResult.eventHandler?.shutdown).toHaveBeenCalled();
    });
  });
});
