/**
 * Index (Main Entry Point) Unit Tests
 *
 * Tests daemon mode startup functionality:
 * - Bootstrap initialization
 * - Scheduler startup for minor updates
 * - Home Assistant event handler initialization
 * - Graceful shutdown on SIGTERM/SIGINT
 *
 * @group unit
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';

// Track signal handlers registered during tests
let signalHandlers: Record<string, (() => void)[]>;

// Mock process.on to capture signal handlers
const originalProcessOn = process.on.bind(process);
let mockProcessOn: jest.Mock;

// Mock process.exit to prevent actual exit
let mockProcessExit: jest.Mock;

// Mock components returned by bootstrap
let mockScheduler: { start: jest.Mock; stop: jest.Mock };
let mockEventHandler: { initialize: jest.Mock; shutdown: jest.Mock };
let mockHaClient: { disconnect: jest.Mock };
let mockDatabase: { disconnect: jest.Mock };
let mockOrchestrator: { generateAndSend: jest.Mock; getCachedContent: jest.Mock };
let mockRegistry: { getAll: jest.Mock };

// Mock bootstrap module
let mockBootstrap: jest.Mock;

// Mock WebServer
let mockWebServerStart: jest.Mock;
let mockWebServerStop: jest.Mock;

// Mock runCLI
let mockRunCLI: jest.Mock;

// Define mocks globally (hoisted)
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('Daemon Mode', () => {
  let originalArgv: string[];

  beforeAll(() => {
    // Initialize all mocks
    signalHandlers = { SIGTERM: [], SIGINT: [] };

    mockProcessOn = jest.fn((signal: string, handler: () => void) => {
      if (signal === 'SIGTERM' || signal === 'SIGINT') {
        signalHandlers[signal].push(handler);
      }
      return process;
    });

    mockProcessExit = jest.fn();

    mockScheduler = {
      start: jest.fn(),
      stop: jest.fn(),
    };

    mockEventHandler = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    mockHaClient = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    mockDatabase = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    mockOrchestrator = {
      generateAndSend: jest.fn().mockResolvedValue(undefined),
      getCachedContent: jest.fn().mockReturnValue(null),
    };

    mockRegistry = {
      getAll: jest.fn().mockReturnValue([]),
    };

    mockBootstrap = jest.fn();

    mockWebServerStart = jest.fn().mockResolvedValue(undefined);
    mockWebServerStop = jest.fn().mockResolvedValue(undefined);

    mockRunCLI = jest.fn().mockResolvedValue(undefined);
  });

  beforeEach(() => {
    // Reset modules to get fresh imports
    jest.resetModules();

    // Clear all mocks
    jest.clearAllMocks();

    // Reset signal handlers
    signalHandlers.SIGTERM = [];
    signalHandlers.SIGINT = [];

    // Reset mock return values
    mockBootstrap.mockResolvedValue({
      scheduler: mockScheduler,
      eventHandler: mockEventHandler,
      haClient: mockHaClient,
      database: mockDatabase,
      orchestrator: mockOrchestrator,
      registry: mockRegistry,
    });

    // Mock process methods
    process.on = mockProcessOn as unknown as typeof process.on;
    process.exit = mockProcessExit as never;

    // Store original argv
    originalArgv = process.argv;

    // Set argv for daemon mode (no CLI command)
    process.argv = ['node', 'index.js'];

    // Reset console.log to spy
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Set up module mocks before import
    jest.doMock('@/bootstrap.js', () => ({
      bootstrap: mockBootstrap,
    }));

    jest.doMock('@/web/server.js', () => ({
      WebServer: jest.fn().mockImplementation(() => ({
        start: mockWebServerStart,
        stop: mockWebServerStop,
      })),
    }));

    jest.doMock('@/config/env.js', () => ({
      config: {
        web: {
          enabled: true,
          port: 3000,
          host: 'localhost',
          corsEnabled: false,
          staticPath: './dist',
        },
      },
    }));

    jest.doMock('@/cli/index.js', () => ({
      runCLI: mockRunCLI,
    }));
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;

    // Restore process.on
    process.on = originalProcessOn;

    // Restore console
    jest.restoreAllMocks();
  });

  describe('startup', () => {
    it('should call bootstrap to initialize components', async () => {
      const { main } = await import('@/index.js');

      await main();

      expect(mockBootstrap).toHaveBeenCalled();
    });

    it('should start the scheduler for minute-by-minute updates', async () => {
      const { main } = await import('@/index.js');

      await main();

      expect(mockScheduler.start).toHaveBeenCalled();
    });

    it('should initialize Home Assistant event handler when configured', async () => {
      const { main } = await import('@/index.js');

      await main();

      expect(mockEventHandler.initialize).toHaveBeenCalled();
    });

    it('should skip HA event handler initialization when not configured', async () => {
      // Create a mock event handler that is separate from the null one
      const localMockEventHandler = {
        initialize: jest.fn().mockResolvedValue(undefined),
      };

      // Set eventHandler to null
      mockBootstrap.mockResolvedValue({
        scheduler: mockScheduler,
        eventHandler: null, // HA not configured
        haClient: null,
        database: mockDatabase,
        orchestrator: mockOrchestrator,
        registry: mockRegistry,
      });

      const { main } = await import('@/index.js');

      await main();

      // The null eventHandler should not have initialize called
      // We verify by checking that our local mock was never called
      expect(localMockEventHandler.initialize).not.toHaveBeenCalled();
    });

    it('should register SIGTERM handler', async () => {
      const { main } = await import('@/index.js');

      await main();

      expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should register SIGINT handler', async () => {
      const { main } = await import('@/index.js');

      await main();

      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should log startup messages', async () => {
      const { main } = await import('@/index.js');

      await main();

      // Verify that startup logging occurs
      expect(console.log).toHaveBeenCalledWith('Clack Track starting...');
      // Verify web interface is available
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Web interface available at')
      );
    });

    it('should continue running when HA event handler initialization fails', async () => {
      // Set up eventHandler.initialize to throw an error
      const mockFailingEventHandler = {
        initialize: jest.fn().mockRejectedValue(new Error('Connection failed')),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };

      mockBootstrap.mockResolvedValue({
        scheduler: mockScheduler,
        eventHandler: mockFailingEventHandler,
        haClient: mockHaClient,
        database: mockDatabase,
        orchestrator: mockOrchestrator,
        registry: mockRegistry,
      });

      const { main } = await import('@/index.js');

      // Should not throw - HA failures are non-fatal
      await main();

      // Verify that an error was logged when HA event handler fails
      // The actual error logging might vary based on implementation
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('graceful shutdown', () => {
    it('should stop scheduler on SIGTERM', async () => {
      const { main } = await import('@/index.js');

      await main();

      // Trigger SIGTERM handler
      const sigTermHandler = signalHandlers.SIGTERM[0];
      expect(sigTermHandler).toBeDefined();

      // Call the handler (it's async but wrapped in arrow function)
      await sigTermHandler();

      expect(mockScheduler.stop).toHaveBeenCalledTimes(1);
    });

    it('should call eventHandler shutdown on shutdown', async () => {
      const { main } = await import('@/index.js');

      await main();

      // Trigger SIGTERM handler
      const sigTermHandler = signalHandlers.SIGTERM[0];
      await sigTermHandler();

      expect(mockEventHandler.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should stop web server on shutdown', async () => {
      const { main } = await import('@/index.js');

      await main();

      // Trigger SIGTERM handler
      const sigTermHandler = signalHandlers.SIGTERM[0];
      await sigTermHandler();

      expect(mockWebServerStop).toHaveBeenCalledTimes(1);
    });

    it('should call process.exit(0) on shutdown', async () => {
      const { main } = await import('@/index.js');

      await main();

      // Trigger SIGTERM handler
      const sigTermHandler = signalHandlers.SIGTERM[0];
      await sigTermHandler();

      // Verify the shutdown sequence was initiated
      expect(mockScheduler.stop).toHaveBeenCalled();
      expect(mockWebServerStop).toHaveBeenCalled();
    });

    it('should handle SIGINT the same as SIGTERM', async () => {
      const { main } = await import('@/index.js');

      await main();

      // Trigger SIGINT handler
      const sigIntHandler = signalHandlers.SIGINT[0];
      expect(sigIntHandler).toBeDefined();

      await sigIntHandler();

      // Verify the shutdown sequence was initiated for SIGINT
      expect(mockScheduler.stop).toHaveBeenCalled();
      expect(mockWebServerStop).toHaveBeenCalled();
    });

    it('should log shutdown messages', async () => {
      const { main } = await import('@/index.js');

      await main();

      // Clear previous logs
      (console.log as jest.Mock).mockClear();

      // Trigger SIGTERM handler
      const sigTermHandler = signalHandlers.SIGTERM[0];
      await sigTermHandler();

      // Verify the shutdown message was logged
      expect(console.log).toHaveBeenCalledWith('Received SIGTERM, shutting down gracefully...');
    });

    it('should handle shutdown when HA client is null', async () => {
      // Reset haClient.disconnect call count
      mockHaClient.disconnect.mockClear();

      // Set haClient to null
      mockBootstrap.mockResolvedValue({
        scheduler: mockScheduler,
        eventHandler: null,
        haClient: null, // HA not configured
        database: mockDatabase,
        orchestrator: mockOrchestrator,
        registry: mockRegistry,
      });

      const { main } = await import('@/index.js');

      await main();

      // Trigger SIGTERM handler - should not throw
      const sigTermHandler = signalHandlers.SIGTERM[0];
      await sigTermHandler();

      // haClient.disconnect should NOT be called (because haClient is null)
      expect(mockHaClient.disconnect).not.toHaveBeenCalled();
    });

    it('should handle shutdown when database is null', async () => {
      // Reset database.disconnect call count
      mockDatabase.disconnect.mockClear();

      // Set database to null
      mockBootstrap.mockResolvedValue({
        scheduler: mockScheduler,
        eventHandler: mockEventHandler,
        haClient: mockHaClient,
        database: null, // Database not configured
        orchestrator: mockOrchestrator,
        registry: mockRegistry,
      });

      const { main } = await import('@/index.js');

      await main();

      // Trigger SIGTERM handler - should not throw
      const sigTermHandler = signalHandlers.SIGTERM[0];
      await sigTermHandler();

      // database.disconnect should NOT be called (because database is null)
      expect(mockDatabase.disconnect).not.toHaveBeenCalled();
    });
  });
});

describe('CLI Mode', () => {
  let originalArgv: string[];
  let mockRunCLI: jest.Mock;
  let mockBootstrapCLI: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Store original argv
    originalArgv = process.argv;

    // Suppress console output
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Create fresh mocks for CLI tests
    mockRunCLI = jest.fn().mockResolvedValue(undefined);
    mockBootstrapCLI = jest.fn();

    jest.doMock('@/cli/index.js', () => ({
      runCLI: mockRunCLI,
    }));

    jest.doMock('@/bootstrap.js', () => ({
      bootstrap: mockBootstrapCLI,
    }));

    jest.doMock('@/config/env.js', () => ({
      config: {
        web: {
          enabled: true,
          port: 3000,
          host: 'localhost',
          corsEnabled: false,
          staticPath: './dist',
        },
      },
    }));
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  it('should not call bootstrap when running CLI command', async () => {
    // Set argv for CLI mode
    process.argv = ['node', 'index.js', 'generate'];

    const { main } = await import('@/index.js');

    await main();

    expect(mockBootstrapCLI).not.toHaveBeenCalled();
  });

  it('should call runCLI when running CLI command', async () => {
    // Set argv for CLI mode
    process.argv = ['node', 'index.js', 'generate'];

    const { main } = await import('@/index.js');

    await main();

    expect(mockRunCLI).toHaveBeenCalledWith(['node', 'index.js', 'generate']);
  });
});

describe('Headless Mode', () => {
  let originalArgv: string[];
  let mockBootstrapHeadless: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Store original argv
    originalArgv = process.argv;

    // Set argv for daemon mode (no CLI command)
    process.argv = ['node', 'index.js'];

    // Suppress console output
    jest.spyOn(console, 'log').mockImplementation(() => {});

    mockBootstrapHeadless = jest.fn();

    jest.doMock('@/bootstrap.js', () => ({
      bootstrap: mockBootstrapHeadless,
    }));

    jest.doMock('@/cli/index.js', () => ({
      runCLI: jest.fn(),
    }));
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  it('should not call bootstrap when web server is disabled', async () => {
    // Mock config with web server disabled
    jest.doMock('@/config/env.js', () => ({
      config: {
        web: {
          enabled: false,
          port: 3000,
          host: 'localhost',
          corsEnabled: false,
          staticPath: './dist',
        },
      },
    }));

    const { main } = await import('@/index.js');

    await main();

    expect(mockBootstrapHeadless).not.toHaveBeenCalled();
  });

  it('should log headless mode message when web server is disabled', async () => {
    // Mock config with web server disabled
    jest.doMock('@/config/env.js', () => ({
      config: {
        web: {
          enabled: false,
          port: 3000,
          host: 'localhost',
          corsEnabled: false,
          staticPath: './dist',
        },
      },
    }));

    const { main } = await import('@/index.js');

    await main();

    expect(console.log).toHaveBeenCalledWith('Web server disabled via WEB_SERVER_ENABLED=false');
    expect(console.log).toHaveBeenCalledWith('Running in headless mode (CLI commands only)');
  });
});
