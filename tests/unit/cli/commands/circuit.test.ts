/**
 * Unit tests for Circuit CLI Commands
 *
 * Tests the CLI commands for querying and controlling circuit breaker states.
 * All dependencies are mocked to isolate command logic.
 *
 * These tests verify the lightweight initialization pattern (database only)
 * used by circuit commands - no bootstrap, scheduler, or HA client.
 *
 * @module tests/unit/cli/commands/circuit
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { CircuitBreakerState } from '@/types/circuit-breaker';

// Capture console output for testing
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

// Mock Knex instance
const mockKnex = {};

// Note: closeKnexInstance mock is defined inline in jest.mock below

// Mock CircuitBreakerService
const mockCircuitBreakerService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  getAllCircuits: jest.fn(),
  getCircuitStatus: jest.fn(),
  setCircuitState: jest.fn().mockResolvedValue(undefined),
  resetProviderCircuit: jest.fn().mockResolvedValue(undefined),
  getProviderStatus: jest.fn(),
  isCircuitOpen: jest.fn(),
};

// Mock CircuitBreakerRepository
const mockCircuitBreakerRepository = {};

// Set up module mocks BEFORE imports
jest.mock('@/storage/knex', () => ({
  getKnexInstance: jest.fn().mockImplementation(() => mockKnex),
  closeKnexInstance: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('@/services/circuit-breaker-service', () => ({
  CircuitBreakerService: jest.fn().mockImplementation(() => mockCircuitBreakerService),
}));

jest.mock('@/storage/repositories/circuit-breaker-repo', () => ({
  CircuitBreakerRepository: jest.fn().mockImplementation(() => mockCircuitBreakerRepository),
}));

/**
 * Create a mock CircuitBreakerState for testing
 */
function createMockCircuit(overrides: Partial<CircuitBreakerState> = {}): CircuitBreakerState {
  return {
    id: 1,
    circuitId: 'MASTER',
    circuitType: 'manual',
    state: 'on',
    defaultState: 'on',
    description: 'Global kill switch',
    failureCount: 0,
    successCount: 0,
    failureThreshold: 5,
    lastFailureAt: null,
    lastSuccessAt: null,
    stateChangedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Circuit CLI Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('circuitStatusCommand', () => {
    test('displays all circuits with their status', async () => {
      const circuits = [
        createMockCircuit({ circuitId: 'MASTER', circuitType: 'manual', state: 'on' }),
        createMockCircuit({
          id: 2,
          circuitId: 'SLEEP_MODE',
          circuitType: 'manual',
          state: 'off',
          defaultState: 'off',
          description: 'Quiet hours mode',
        }),
        createMockCircuit({
          id: 3,
          circuitId: 'PROVIDER_OPENAI',
          circuitType: 'provider',
          state: 'on',
          description: 'OpenAI provider circuit',
          failureCount: 2,
          failureThreshold: 5,
        }),
      ];
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue(circuits);

      const { circuitStatusCommand } = await import('@/cli/commands/circuit');
      await circuitStatusCommand();

      // Should display header
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Circuit Breaker Status'));

      // Should display each circuit
      const allCalls = consoleLogSpy.mock.calls.map(call => String(call[0]));
      const output = allCalls.join('\n');

      expect(output).toContain('MASTER');
      expect(output).toContain('SLEEP_MODE');
      expect(output).toContain('PROVIDER_OPENAI');

      // Should call closeKnexInstance for cleanup
      const { closeKnexInstance } = await import('@/storage/knex');
      expect(closeKnexInstance).toHaveBeenCalled();
    });

    test('displays empty message when no circuits exist', async () => {
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue([]);

      const { circuitStatusCommand } = await import('@/cli/commands/circuit');
      await circuitStatusCommand();

      const allCalls = consoleLogSpy.mock.calls.map(call => String(call[0]));
      const output = allCalls.join('\n');

      expect(output).toMatch(/no circuits/i);
    });

    test('displays provider-specific info for provider circuits', async () => {
      const circuits = [
        createMockCircuit({
          circuitId: 'PROVIDER_OPENAI',
          circuitType: 'provider',
          state: 'half_open',
          failureCount: 3,
          successCount: 1,
          failureThreshold: 5,
          lastFailureAt: '2024-01-15T10:30:00.000Z',
        }),
      ];
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue(circuits);

      const { circuitStatusCommand } = await import('@/cli/commands/circuit');
      await circuitStatusCommand();

      const allCalls = consoleLogSpy.mock.calls.map(call => String(call[0]));
      const output = allCalls.join('\n');

      // Should show provider-specific info
      expect(output).toContain('3'); // failure count
      expect(output).toContain('5'); // threshold
    });

    test('properly cleans up resources on success', async () => {
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue([]);

      const { circuitStatusCommand } = await import('@/cli/commands/circuit');
      await circuitStatusCommand();

      const { closeKnexInstance } = await import('@/storage/knex');
      expect(closeKnexInstance).toHaveBeenCalled();
    });

    test('cleans up resources even when service returns empty (graceful degradation)', async () => {
      // Service returns empty array on error (graceful degradation)
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue([]);

      const { circuitStatusCommand } = await import('@/cli/commands/circuit');
      await circuitStatusCommand();

      const { closeKnexInstance } = await import('@/storage/knex');
      expect(closeKnexInstance).toHaveBeenCalled();
    });
  });

  describe('circuitOnCommand', () => {
    test('turns circuit ON with valid circuit_id', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(
        createMockCircuit({ circuitId: 'MASTER', state: 'off' })
      );

      const { circuitOnCommand } = await import('@/cli/commands/circuit');
      await circuitOnCommand({ circuitId: 'MASTER' });

      expect(mockCircuitBreakerService.setCircuitState).toHaveBeenCalledWith('MASTER', 'on');

      const allCalls = consoleLogSpy.mock.calls.map(call => String(call[0]));
      const output = allCalls.join('\n');
      expect(output).toMatch(/MASTER.*ON|turned on|enabled/i);

      const { closeKnexInstance } = await import('@/storage/knex');
      expect(closeKnexInstance).toHaveBeenCalled();
    });

    test('validates circuit_id exists', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(null);

      const { circuitOnCommand } = await import('@/cli/commands/circuit');
      await circuitOnCommand({ circuitId: 'INVALID_CIRCUIT' });

      expect(mockCircuitBreakerService.setCircuitState).not.toHaveBeenCalled();

      const allErrorCalls = consoleErrorSpy.mock.calls.map(call => String(call[0]));
      const errorOutput = allErrorCalls.join('\n');
      expect(errorOutput).toMatch(/not found|invalid|unknown/i);
    });

    test('cleans up resources on success', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(
        createMockCircuit({ circuitId: 'MASTER' })
      );

      const { circuitOnCommand } = await import('@/cli/commands/circuit');
      await circuitOnCommand({ circuitId: 'MASTER' });

      const { closeKnexInstance } = await import('@/storage/knex');
      expect(closeKnexInstance).toHaveBeenCalled();
    });
  });

  describe('circuitOffCommand', () => {
    test('turns circuit OFF with valid circuit_id', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(
        createMockCircuit({ circuitId: 'MASTER', state: 'on' })
      );

      const { circuitOffCommand } = await import('@/cli/commands/circuit');
      await circuitOffCommand({ circuitId: 'MASTER' });

      expect(mockCircuitBreakerService.setCircuitState).toHaveBeenCalledWith('MASTER', 'off');

      const allCalls = consoleLogSpy.mock.calls.map(call => String(call[0]));
      const output = allCalls.join('\n');
      expect(output).toMatch(/MASTER.*OFF|turned off|disabled/i);

      const { closeKnexInstance } = await import('@/storage/knex');
      expect(closeKnexInstance).toHaveBeenCalled();
    });

    test('validates circuit_id exists', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(null);

      const { circuitOffCommand } = await import('@/cli/commands/circuit');
      await circuitOffCommand({ circuitId: 'INVALID_CIRCUIT' });

      expect(mockCircuitBreakerService.setCircuitState).not.toHaveBeenCalled();

      const allErrorCalls = consoleErrorSpy.mock.calls.map(call => String(call[0]));
      const errorOutput = allErrorCalls.join('\n');
      expect(errorOutput).toMatch(/not found|invalid|unknown/i);
    });

    test('cleans up resources on success', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(
        createMockCircuit({ circuitId: 'MASTER' })
      );

      const { circuitOffCommand } = await import('@/cli/commands/circuit');
      await circuitOffCommand({ circuitId: 'MASTER' });

      const { closeKnexInstance } = await import('@/storage/knex');
      expect(closeKnexInstance).toHaveBeenCalled();
    });
  });

  describe('circuitResetCommand', () => {
    test('resets provider circuit with valid circuit_id', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(
        createMockCircuit({
          circuitId: 'PROVIDER_OPENAI',
          circuitType: 'provider',
          state: 'off',
          failureCount: 5,
        })
      );

      const { circuitResetCommand } = await import('@/cli/commands/circuit');
      await circuitResetCommand({ circuitId: 'PROVIDER_OPENAI' });

      expect(mockCircuitBreakerService.resetProviderCircuit).toHaveBeenCalledWith(
        'PROVIDER_OPENAI'
      );

      const allCalls = consoleLogSpy.mock.calls.map(call => String(call[0]));
      const output = allCalls.join('\n');
      expect(output).toMatch(/PROVIDER_OPENAI.*reset/i);

      const { closeKnexInstance } = await import('@/storage/knex');
      expect(closeKnexInstance).toHaveBeenCalled();
    });

    test('validates circuit_id exists', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(null);

      const { circuitResetCommand } = await import('@/cli/commands/circuit');
      await circuitResetCommand({ circuitId: 'INVALID_CIRCUIT' });

      expect(mockCircuitBreakerService.resetProviderCircuit).not.toHaveBeenCalled();

      const allErrorCalls = consoleErrorSpy.mock.calls.map(call => String(call[0]));
      const errorOutput = allErrorCalls.join('\n');
      expect(errorOutput).toMatch(/not found|invalid|unknown/i);
    });

    test('rejects reset on manual circuits', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(
        createMockCircuit({ circuitId: 'MASTER', circuitType: 'manual' })
      );

      const { circuitResetCommand } = await import('@/cli/commands/circuit');
      await circuitResetCommand({ circuitId: 'MASTER' });

      expect(mockCircuitBreakerService.resetProviderCircuit).not.toHaveBeenCalled();

      const allErrorCalls = consoleErrorSpy.mock.calls.map(call => String(call[0]));
      const errorOutput = allErrorCalls.join('\n');
      expect(errorOutput).toMatch(/only.*provider|manual.*cannot|not.*provider/i);
    });

    test('cleans up resources on success', async () => {
      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(
        createMockCircuit({ circuitId: 'PROVIDER_OPENAI', circuitType: 'provider' })
      );

      const { circuitResetCommand } = await import('@/cli/commands/circuit');
      await circuitResetCommand({ circuitId: 'PROVIDER_OPENAI' });

      const { closeKnexInstance } = await import('@/storage/knex');
      expect(closeKnexInstance).toHaveBeenCalled();
    });
  });

  describe('cleanup behavior', () => {
    test('all commands call closeKnexInstance in finally block', async () => {
      const { circuitStatusCommand, circuitOnCommand, circuitOffCommand, circuitResetCommand } =
        await import('@/cli/commands/circuit');
      const { closeKnexInstance } = await import('@/storage/knex');

      mockCircuitBreakerService.getAllCircuits.mockResolvedValue([]);
      await circuitStatusCommand();
      expect(closeKnexInstance).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(
        createMockCircuit({ circuitId: 'MASTER' })
      );
      await circuitOnCommand({ circuitId: 'MASTER' });
      expect(closeKnexInstance).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      await circuitOffCommand({ circuitId: 'MASTER' });
      expect(closeKnexInstance).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      mockCircuitBreakerService.getCircuitStatus.mockResolvedValue(
        createMockCircuit({ circuitId: 'PROVIDER_OPENAI', circuitType: 'provider' })
      );
      await circuitResetCommand({ circuitId: 'PROVIDER_OPENAI' });
      expect(closeKnexInstance).toHaveBeenCalledTimes(1);
    });

    test('uses lightweight initialization (no bootstrap)', async () => {
      // Verify that bootstrap is NOT called - the commands use getKnexInstance directly
      const { circuitStatusCommand } = await import('@/cli/commands/circuit');
      const { getKnexInstance } = await import('@/storage/knex');

      mockCircuitBreakerService.getAllCircuits.mockResolvedValue([]);
      await circuitStatusCommand();

      // getKnexInstance should be called directly
      expect(getKnexInstance).toHaveBeenCalled();
    });
  });

  describe('circuitWatchCommand', () => {
    let consoleClearSpy: jest.SpiedFunction<typeof console.clear>;
    let sigintHandlers: Array<() => void>;

    beforeEach(() => {
      consoleClearSpy = jest.spyOn(console, 'clear').mockImplementation(() => {});
      // Capture SIGINT handlers registered during tests
      sigintHandlers = [];
      jest.spyOn(process, 'on').mockImplementation((event, handler) => {
        if (event === 'SIGINT') {
          sigintHandlers.push(handler as () => void);
        }
        return process;
      });
    });

    afterEach(() => {
      consoleClearSpy.mockRestore();
      (process.on as jest.Mock).mockRestore();
    });

    test('uses getKnexInstance and displays circuit status', async () => {
      const circuits = [
        createMockCircuit({ circuitId: 'MASTER', circuitType: 'manual', state: 'on' }),
        createMockCircuit({
          id: 2,
          circuitId: 'PROVIDER_OPENAI',
          circuitType: 'provider',
          state: 'on',
          failureCount: 0,
          failureThreshold: 5,
        }),
      ];
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue(circuits);

      // Reset modules to get fresh import
      jest.resetModules();
      jest.mock('@/storage/knex', () => ({
        getKnexInstance: jest.fn().mockImplementation(() => mockKnex),
        closeKnexInstance: jest.fn().mockResolvedValue(undefined),
      }));
      jest.mock('@/services/circuit-breaker-service', () => ({
        CircuitBreakerService: jest.fn().mockImplementation(() => mockCircuitBreakerService),
      }));
      jest.mock('@/storage/repositories/circuit-breaker-repo', () => ({
        CircuitBreakerRepository: jest.fn().mockImplementation(() => mockCircuitBreakerRepository),
      }));

      const { circuitWatchCommand } = await import('@/cli/commands/circuit');
      const { getKnexInstance, closeKnexInstance } = await import('@/storage/knex');

      // Run with maxIterations=1 to exit after first refresh
      await circuitWatchCommand({ maxIterations: 1 });

      // Should use getKnexInstance (lightweight init)
      expect(getKnexInstance).toHaveBeenCalled();

      // Should clear console and display circuit info
      expect(consoleClearSpy).toHaveBeenCalled();
      const allCalls = consoleLogSpy.mock.calls.map(call => String(call[0]));
      const output = allCalls.join('\n');
      expect(output).toContain('MASTER');
      expect(output).toContain('PROVIDER_OPENAI');

      // Should call cleanup
      expect(closeKnexInstance).toHaveBeenCalled();
    });

    test('respects interval option', async () => {
      jest.useFakeTimers();

      const circuits = [createMockCircuit({ circuitId: 'MASTER', state: 'on' })];
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue(circuits);

      jest.resetModules();
      jest.mock('@/storage/knex', () => ({
        getKnexInstance: jest.fn().mockImplementation(() => mockKnex),
        closeKnexInstance: jest.fn().mockResolvedValue(undefined),
      }));
      jest.mock('@/services/circuit-breaker-service', () => ({
        CircuitBreakerService: jest.fn().mockImplementation(() => mockCircuitBreakerService),
      }));
      jest.mock('@/storage/repositories/circuit-breaker-repo', () => ({
        CircuitBreakerRepository: jest.fn().mockImplementation(() => mockCircuitBreakerRepository),
      }));

      const { circuitWatchCommand } = await import('@/cli/commands/circuit');

      // Start watch with custom interval and 2 iterations
      const watchPromise = circuitWatchCommand({ interval: 5000, maxIterations: 2 });

      // First iteration happens immediately
      await jest.advanceTimersByTimeAsync(0);

      // Advance less than the interval - second iteration shouldn't have run yet
      await jest.advanceTimersByTimeAsync(4999);
      expect(mockCircuitBreakerService.getAllCircuits).toHaveBeenCalledTimes(1);

      // Advance past the interval - second iteration should run
      await jest.advanceTimersByTimeAsync(1);
      expect(mockCircuitBreakerService.getAllCircuits).toHaveBeenCalledTimes(2);

      await watchPromise;
      jest.useRealTimers();
    });

    test('respects json flag for output format', async () => {
      const circuits = [
        createMockCircuit({ circuitId: 'MASTER', circuitType: 'manual', state: 'on' }),
      ];
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue(circuits);

      jest.resetModules();
      jest.mock('@/storage/knex', () => ({
        getKnexInstance: jest.fn().mockImplementation(() => mockKnex),
        closeKnexInstance: jest.fn().mockResolvedValue(undefined),
      }));
      jest.mock('@/services/circuit-breaker-service', () => ({
        CircuitBreakerService: jest.fn().mockImplementation(() => mockCircuitBreakerService),
      }));
      jest.mock('@/storage/repositories/circuit-breaker-repo', () => ({
        CircuitBreakerRepository: jest.fn().mockImplementation(() => mockCircuitBreakerRepository),
      }));

      const { circuitWatchCommand } = await import('@/cli/commands/circuit');

      await circuitWatchCommand({ json: true, maxIterations: 1 });

      // Should output valid JSON (newline-delimited)
      const allCalls = consoleLogSpy.mock.calls.map(call => String(call[0]));
      const jsonOutput = allCalls.find(line => line.startsWith('{'));
      expect(jsonOutput).toBeDefined();

      const parsed = JSON.parse(jsonOutput!);
      expect(parsed).toHaveProperty('circuits');
      expect(parsed).toHaveProperty('timestamp');
    });

    test('SIGINT handler is registered', async () => {
      const circuits = [createMockCircuit({ circuitId: 'MASTER', state: 'on' })];
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue(circuits);

      jest.resetModules();
      jest.mock('@/storage/knex', () => ({
        getKnexInstance: jest.fn().mockImplementation(() => mockKnex),
        closeKnexInstance: jest.fn().mockResolvedValue(undefined),
      }));
      jest.mock('@/services/circuit-breaker-service', () => ({
        CircuitBreakerService: jest.fn().mockImplementation(() => mockCircuitBreakerService),
      }));
      jest.mock('@/storage/repositories/circuit-breaker-repo', () => ({
        CircuitBreakerRepository: jest.fn().mockImplementation(() => mockCircuitBreakerRepository),
      }));

      const { circuitWatchCommand } = await import('@/cli/commands/circuit');

      await circuitWatchCommand({ maxIterations: 1 });

      // Should have registered SIGINT handler
      expect(sigintHandlers.length).toBeGreaterThan(0);
    });

    test('multiple refresh cycles work correctly', async () => {
      jest.useFakeTimers();

      const circuits = [createMockCircuit({ circuitId: 'MASTER', state: 'on' })];
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue(circuits);

      jest.resetModules();
      jest.mock('@/storage/knex', () => ({
        getKnexInstance: jest.fn().mockImplementation(() => mockKnex),
        closeKnexInstance: jest.fn().mockResolvedValue(undefined),
      }));
      jest.mock('@/services/circuit-breaker-service', () => ({
        CircuitBreakerService: jest.fn().mockImplementation(() => mockCircuitBreakerService),
      }));
      jest.mock('@/storage/repositories/circuit-breaker-repo', () => ({
        CircuitBreakerRepository: jest.fn().mockImplementation(() => mockCircuitBreakerRepository),
      }));

      const { circuitWatchCommand } = await import('@/cli/commands/circuit');

      // Run with 3 iterations
      const watchPromise = circuitWatchCommand({ interval: 1000, maxIterations: 3 });

      // Advance through all iterations
      await jest.advanceTimersByTimeAsync(0); // First iteration
      await jest.advanceTimersByTimeAsync(1000); // Second iteration
      await jest.advanceTimersByTimeAsync(1000); // Third iteration

      await watchPromise;

      // getAllCircuits should have been called 3 times
      expect(mockCircuitBreakerService.getAllCircuits).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    test('cleanup is called on successful completion', async () => {
      const circuits = [createMockCircuit({ circuitId: 'MASTER', state: 'on' })];
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue(circuits);

      jest.resetModules();
      jest.mock('@/storage/knex', () => ({
        getKnexInstance: jest.fn().mockImplementation(() => mockKnex),
        closeKnexInstance: jest.fn().mockResolvedValue(undefined),
      }));
      jest.mock('@/services/circuit-breaker-service', () => ({
        CircuitBreakerService: jest.fn().mockImplementation(() => mockCircuitBreakerService),
      }));
      jest.mock('@/storage/repositories/circuit-breaker-repo', () => ({
        CircuitBreakerRepository: jest.fn().mockImplementation(() => mockCircuitBreakerRepository),
      }));

      const { circuitWatchCommand } = await import('@/cli/commands/circuit');
      const { closeKnexInstance } = await import('@/storage/knex');

      await circuitWatchCommand({ maxIterations: 1 });

      expect(closeKnexInstance).toHaveBeenCalled();
    });

    test('detects and highlights state changes', async () => {
      jest.useFakeTimers();

      // First call returns circuit in 'on' state
      const circuitOn = createMockCircuit({ circuitId: 'MASTER', state: 'on' });
      // Second call returns circuit in 'off' state (simulating a change)
      const circuitOff = createMockCircuit({ circuitId: 'MASTER', state: 'off' });

      mockCircuitBreakerService.getAllCircuits
        .mockResolvedValueOnce([circuitOn])
        .mockResolvedValueOnce([circuitOff]);

      jest.resetModules();
      jest.mock('@/storage/knex', () => ({
        getKnexInstance: jest.fn().mockImplementation(() => mockKnex),
        closeKnexInstance: jest.fn().mockResolvedValue(undefined),
      }));
      jest.mock('@/services/circuit-breaker-service', () => ({
        CircuitBreakerService: jest.fn().mockImplementation(() => mockCircuitBreakerService),
      }));
      jest.mock('@/storage/repositories/circuit-breaker-repo', () => ({
        CircuitBreakerRepository: jest.fn().mockImplementation(() => mockCircuitBreakerRepository),
      }));

      const { circuitWatchCommand } = await import('@/cli/commands/circuit');

      const watchPromise = circuitWatchCommand({ interval: 1000, maxIterations: 2 });

      await jest.advanceTimersByTimeAsync(0); // First iteration
      await jest.advanceTimersByTimeAsync(1000); // Second iteration

      await watchPromise;

      // Check that [CHANGED] marker appears in output
      const allCalls = consoleLogSpy.mock.calls.map(call => String(call[0]));
      const output = allCalls.join('\n');
      expect(output).toContain('CHANGED');

      jest.useRealTimers();
    });

    test('uses default interval of 2000ms when not specified', async () => {
      jest.useFakeTimers();

      const circuits = [createMockCircuit({ circuitId: 'MASTER', state: 'on' })];
      mockCircuitBreakerService.getAllCircuits.mockResolvedValue(circuits);

      jest.resetModules();
      jest.mock('@/storage/knex', () => ({
        getKnexInstance: jest.fn().mockImplementation(() => mockKnex),
        closeKnexInstance: jest.fn().mockResolvedValue(undefined),
      }));
      jest.mock('@/services/circuit-breaker-service', () => ({
        CircuitBreakerService: jest.fn().mockImplementation(() => mockCircuitBreakerService),
      }));
      jest.mock('@/storage/repositories/circuit-breaker-repo', () => ({
        CircuitBreakerRepository: jest.fn().mockImplementation(() => mockCircuitBreakerRepository),
      }));

      const { circuitWatchCommand } = await import('@/cli/commands/circuit');

      // Start watch without interval option (should default to 2000ms), with 2 iterations
      const watchPromise = circuitWatchCommand({ maxIterations: 2 });

      // First iteration happens immediately
      await jest.advanceTimersByTimeAsync(0);
      expect(mockCircuitBreakerService.getAllCircuits).toHaveBeenCalledTimes(1);

      // Advance less than 2000ms - second iteration shouldn't have run
      await jest.advanceTimersByTimeAsync(1999);
      expect(mockCircuitBreakerService.getAllCircuits).toHaveBeenCalledTimes(1);

      // Advance to complete 2000ms - second iteration should run
      await jest.advanceTimersByTimeAsync(1);
      expect(mockCircuitBreakerService.getAllCircuits).toHaveBeenCalledTimes(2);

      await watchPromise;
      jest.useRealTimers();
    });
  });
});
