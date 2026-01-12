/**
 * Unit tests for CircuitBreakerService
 *
 * Tests the circuit breaker service layer for manual circuit control.
 * Repository calls are mocked to isolate service logic.
 */

import {
  CircuitBreakerService,
  MANUAL_CIRCUITS,
  PROVIDER_CIRCUITS,
  ALL_CIRCUITS,
  CIRCUIT_BREAKER_CONFIG,
} from '@/services/circuit-breaker-service';
import type { CircuitBreakerRepository } from '@/storage/repositories/circuit-breaker-repo';
import type { CircuitBreakerState } from '@/types/circuit-breaker';
import { AuthenticationError, RateLimitError, OverloadedError } from '@/types/errors';

/**
 * Create a mock CircuitBreakerRepository for testing
 */
function createMockRepository(
  overrides: Partial<CircuitBreakerRepository> = {}
): CircuitBreakerRepository {
  return {
    getState: jest.fn(),
    setState: jest.fn(),
    getAllStates: jest.fn(),
    initializeCircuit: jest.fn(),
    recordFailure: jest.fn(),
    recordSuccess: jest.fn(),
    resetCounters: jest.fn(),
    ...overrides,
  } as unknown as CircuitBreakerRepository;
}

/**
 * Create a mock CircuitBreakerState for testing
 */
function createMockState(overrides: Partial<CircuitBreakerState> = {}): CircuitBreakerState {
  return {
    id: 1,
    circuitId: 'MASTER',
    circuitType: 'manual',
    state: 'on',
    defaultState: 'on',
    description: 'Test circuit',
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

describe('CircuitBreakerService', () => {
  describe('MANUAL_CIRCUITS constant', () => {
    test('contains MASTER circuit with correct defaults', () => {
      const master = MANUAL_CIRCUITS.find(c => c.circuitId === 'MASTER');
      expect(master).toBeDefined();
      expect(master?.circuitType).toBe('manual');
      expect(master?.defaultState).toBe('on');
      expect(master?.description).toContain('kill switch');
    });

    test('contains SLEEP_MODE circuit with correct defaults', () => {
      const sleepMode = MANUAL_CIRCUITS.find(c => c.circuitId === 'SLEEP_MODE');
      expect(sleepMode).toBeDefined();
      expect(sleepMode?.circuitType).toBe('manual');
      expect(sleepMode?.defaultState).toBe('off');
      expect(sleepMode?.description).toContain('Quiet hours');
    });

    test('all circuits have required fields', () => {
      for (const circuit of MANUAL_CIRCUITS) {
        expect(circuit.circuitId).toBeDefined();
        expect(circuit.circuitType).toBe('manual');
        expect(['on', 'off', 'half_open']).toContain(circuit.defaultState);
        expect(circuit.description).toBeDefined();
      }
    });
  });

  describe('constructor', () => {
    test('accepts repository dependency', () => {
      const mockRepo = createMockRepository();
      const service = new CircuitBreakerService(mockRepo);
      expect(service).toBeInstanceOf(CircuitBreakerService);
    });
  });

  describe('initialize', () => {
    test('calls initializeCircuit for all circuits (manual + provider)', async () => {
      const mockRepo = createMockRepository();
      const service = new CircuitBreakerService(mockRepo);

      await service.initialize();

      expect(mockRepo.initializeCircuit).toHaveBeenCalledTimes(ALL_CIRCUITS.length);
      for (const circuit of ALL_CIRCUITS) {
        expect(mockRepo.initializeCircuit).toHaveBeenCalledWith(circuit);
      }
    });

    test('handles repository errors gracefully', async () => {
      const mockRepo = createMockRepository({
        initializeCircuit: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      // Should not throw
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('isCircuitOpen', () => {
    test('returns true when circuit state is "off" (blocks traffic)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(createMockState({ state: 'off' })),
      });
      const service = new CircuitBreakerService(mockRepo);

      const isOpen = await service.isCircuitOpen('MASTER');

      expect(isOpen).toBe(true);
      expect(mockRepo.getState).toHaveBeenCalledWith('MASTER');
    });

    test('returns false when circuit state is "on" (allows traffic)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(createMockState({ state: 'on' })),
      });
      const service = new CircuitBreakerService(mockRepo);

      const isOpen = await service.isCircuitOpen('MASTER');

      expect(isOpen).toBe(false);
    });

    test('returns false when circuit state is "half_open" (allows traffic)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(createMockState({ state: 'half_open' })),
      });
      const service = new CircuitBreakerService(mockRepo);

      const isOpen = await service.isCircuitOpen('MASTER');

      expect(isOpen).toBe(false);
    });

    test('returns false when circuit does not exist (allows traffic by default)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(null),
      });
      const service = new CircuitBreakerService(mockRepo);

      const isOpen = await service.isCircuitOpen('UNKNOWN_CIRCUIT');

      expect(isOpen).toBe(false);
    });

    test('handles repository errors gracefully (returns false)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      const isOpen = await service.isCircuitOpen('MASTER');

      expect(isOpen).toBe(false);
    });
  });

  describe('setCircuitState', () => {
    test('updates circuit state via repository', async () => {
      const mockRepo = createMockRepository();
      const service = new CircuitBreakerService(mockRepo);

      await service.setCircuitState('MASTER', 'off');

      expect(mockRepo.setState).toHaveBeenCalledWith('MASTER', {
        state: 'off',
        stateChangedAt: expect.any(String),
      });
    });

    test('sets stateChangedAt to ISO timestamp', async () => {
      const mockRepo = createMockRepository();
      const service = new CircuitBreakerService(mockRepo);
      const beforeCall = new Date().toISOString();

      await service.setCircuitState('MASTER', 'on');

      const afterCall = new Date().toISOString();
      const callArgs = (mockRepo.setState as jest.Mock).mock.calls[0][1];
      expect(callArgs.stateChangedAt).toBeDefined();
      expect(callArgs.stateChangedAt >= beforeCall).toBe(true);
      expect(callArgs.stateChangedAt <= afterCall).toBe(true);
    });

    test('supports all valid circuit states', async () => {
      const mockRepo = createMockRepository();
      const service = new CircuitBreakerService(mockRepo);

      await service.setCircuitState('MASTER', 'on');
      await service.setCircuitState('MASTER', 'off');
      await service.setCircuitState('MASTER', 'half_open');

      expect(mockRepo.setState).toHaveBeenCalledTimes(3);
    });

    test('handles repository errors gracefully', async () => {
      const mockRepo = createMockRepository({
        setState: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      // Should not throw
      await expect(service.setCircuitState('MASTER', 'off')).resolves.not.toThrow();
    });
  });

  describe('getCircuitStatus', () => {
    test('returns full circuit state from repository', async () => {
      const expectedState = createMockState({ circuitId: 'MASTER', state: 'on' });
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(expectedState),
      });
      const service = new CircuitBreakerService(mockRepo);

      const status = await service.getCircuitStatus('MASTER');

      expect(status).toEqual(expectedState);
      expect(mockRepo.getState).toHaveBeenCalledWith('MASTER');
    });

    test('returns null when circuit does not exist', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(null),
      });
      const service = new CircuitBreakerService(mockRepo);

      const status = await service.getCircuitStatus('UNKNOWN_CIRCUIT');

      expect(status).toBeNull();
    });

    test('handles repository errors gracefully (returns null)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      const status = await service.getCircuitStatus('MASTER');

      expect(status).toBeNull();
    });
  });

  describe('getAllCircuits', () => {
    test('returns all circuit states from repository', async () => {
      const expectedStates = [
        createMockState({ circuitId: 'MASTER', state: 'on' }),
        createMockState({ circuitId: 'SLEEP_MODE', state: 'off', id: 2 }),
      ];
      const mockRepo = createMockRepository({
        getAllStates: jest.fn().mockResolvedValue(expectedStates),
      });
      const service = new CircuitBreakerService(mockRepo);

      const circuits = await service.getAllCircuits();

      expect(circuits).toEqual(expectedStates);
      expect(mockRepo.getAllStates).toHaveBeenCalled();
    });

    test('returns empty array when no circuits exist', async () => {
      const mockRepo = createMockRepository({
        getAllStates: jest.fn().mockResolvedValue([]),
      });
      const service = new CircuitBreakerService(mockRepo);

      const circuits = await service.getAllCircuits();

      expect(circuits).toEqual([]);
    });

    test('handles repository errors gracefully (returns empty array)', async () => {
      const mockRepo = createMockRepository({
        getAllStates: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      const circuits = await service.getAllCircuits();

      expect(circuits).toEqual([]);
    });
  });

  describe('getCircuitsByType', () => {
    test('returns only manual circuits when type is "manual"', async () => {
      const allStates = [
        createMockState({ circuitId: 'MASTER', circuitType: 'manual' }),
        createMockState({ circuitId: 'PROVIDER_OPENAI', circuitType: 'provider', id: 2 }),
        createMockState({ circuitId: 'SLEEP_MODE', circuitType: 'manual', id: 3 }),
      ];
      const mockRepo = createMockRepository({
        getAllStates: jest.fn().mockResolvedValue(allStates),
      });
      const service = new CircuitBreakerService(mockRepo);

      const circuits = await service.getCircuitsByType('manual');

      expect(circuits).toHaveLength(2);
      expect(circuits.every(c => c.circuitType === 'manual')).toBe(true);
      expect(circuits.map(c => c.circuitId)).toContain('MASTER');
      expect(circuits.map(c => c.circuitId)).toContain('SLEEP_MODE');
    });

    test('returns only provider circuits when type is "provider"', async () => {
      const allStates = [
        createMockState({ circuitId: 'MASTER', circuitType: 'manual' }),
        createMockState({ circuitId: 'PROVIDER_OPENAI', circuitType: 'provider', id: 2 }),
        createMockState({ circuitId: 'PROVIDER_ANTHROPIC', circuitType: 'provider', id: 3 }),
      ];
      const mockRepo = createMockRepository({
        getAllStates: jest.fn().mockResolvedValue(allStates),
      });
      const service = new CircuitBreakerService(mockRepo);

      const circuits = await service.getCircuitsByType('provider');

      expect(circuits).toHaveLength(2);
      expect(circuits.every(c => c.circuitType === 'provider')).toBe(true);
    });

    test('returns empty array when no circuits match type', async () => {
      const allStates = [createMockState({ circuitId: 'MASTER', circuitType: 'manual' })];
      const mockRepo = createMockRepository({
        getAllStates: jest.fn().mockResolvedValue(allStates),
      });
      const service = new CircuitBreakerService(mockRepo);

      const circuits = await service.getCircuitsByType('provider');

      expect(circuits).toEqual([]);
    });

    test('handles repository errors gracefully (returns empty array)', async () => {
      const mockRepo = createMockRepository({
        getAllStates: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      const circuits = await service.getCircuitsByType('manual');

      expect(circuits).toEqual([]);
    });
  });

  describe('integration scenarios', () => {
    test('MASTER circuit blocks all traffic when off', async () => {
      const mockRepo = createMockRepository({
        getState: jest
          .fn()
          .mockResolvedValue(createMockState({ circuitId: 'MASTER', state: 'off' })),
      });
      const service = new CircuitBreakerService(mockRepo);

      // When MASTER is off, isCircuitOpen returns true (blocked)
      const isBlocked = await service.isCircuitOpen('MASTER');

      expect(isBlocked).toBe(true);
    });

    test('can toggle circuit state on and off', async () => {
      const mockRepo = createMockRepository();
      const service = new CircuitBreakerService(mockRepo);

      // Turn off
      await service.setCircuitState('MASTER', 'off');
      expect(mockRepo.setState).toHaveBeenLastCalledWith('MASTER', {
        state: 'off',
        stateChangedAt: expect.any(String),
      });

      // Turn back on
      await service.setCircuitState('MASTER', 'on');
      expect(mockRepo.setState).toHaveBeenLastCalledWith('MASTER', {
        state: 'on',
        stateChangedAt: expect.any(String),
      });
    });
  });

  // ========================================
  // PROVIDER CIRCUIT STATE MACHINE TESTS
  // ========================================

  describe('PROVIDER_CIRCUITS constant', () => {
    test('contains PROVIDER_OPENAI circuit with correct defaults', () => {
      const openai = PROVIDER_CIRCUITS.find(c => c.circuitId === 'PROVIDER_OPENAI');
      expect(openai).toBeDefined();
      expect(openai?.circuitType).toBe('provider');
      expect(openai?.defaultState).toBe('on');
      expect(openai?.failureThreshold).toBe(5);
      expect(openai?.description).toContain('OpenAI');
    });

    test('contains PROVIDER_ANTHROPIC circuit with correct defaults', () => {
      const anthropic = PROVIDER_CIRCUITS.find(c => c.circuitId === 'PROVIDER_ANTHROPIC');
      expect(anthropic).toBeDefined();
      expect(anthropic?.circuitType).toBe('provider');
      expect(anthropic?.defaultState).toBe('on');
      expect(anthropic?.failureThreshold).toBe(5);
      expect(anthropic?.description).toContain('Anthropic');
    });

    test('all provider circuits have required fields', () => {
      for (const circuit of PROVIDER_CIRCUITS) {
        expect(circuit.circuitId).toBeDefined();
        expect(circuit.circuitType).toBe('provider');
        expect(['on', 'off', 'half_open']).toContain(circuit.defaultState);
        expect(circuit.description).toBeDefined();
        expect(circuit.failureThreshold).toBeGreaterThan(0);
      }
    });
  });

  describe('ALL_CIRCUITS constant', () => {
    test('contains both manual and provider circuits', () => {
      expect(ALL_CIRCUITS.length).toBe(MANUAL_CIRCUITS.length + PROVIDER_CIRCUITS.length);
      expect(ALL_CIRCUITS).toEqual([...MANUAL_CIRCUITS, ...PROVIDER_CIRCUITS]);
    });

    test('includes MASTER and PROVIDER_OPENAI', () => {
      const ids = ALL_CIRCUITS.map(c => c.circuitId);
      expect(ids).toContain('MASTER');
      expect(ids).toContain('PROVIDER_OPENAI');
      expect(ids).toContain('PROVIDER_ANTHROPIC');
    });
  });

  describe('CIRCUIT_BREAKER_CONFIG constant', () => {
    test('has correct default failure threshold', () => {
      expect(CIRCUIT_BREAKER_CONFIG.DEFAULT_FAILURE_THRESHOLD).toBe(5);
    });

    test('has correct default reset timeout (5 minutes)', () => {
      expect(CIRCUIT_BREAKER_CONFIG.DEFAULT_RESET_TIMEOUT_MS).toBe(5 * 60 * 1000);
    });

    test('has correct default half-open attempts', () => {
      expect(CIRCUIT_BREAKER_CONFIG.DEFAULT_HALF_OPEN_ATTEMPTS).toBe(2);
    });
  });

  describe('recordProviderFailure', () => {
    test('increments failure count via repository', async () => {
      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockResolvedValue(1),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
            failureCount: 1,
            failureThreshold: 5,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderFailure('PROVIDER_OPENAI', new Error('API error'));

      expect(mockRepo.recordFailure).toHaveBeenCalledWith('PROVIDER_OPENAI');
    });

    test('transitions from CLOSED to OPEN when failure count >= threshold', async () => {
      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockResolvedValue(5),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
            failureCount: 5,
            failureThreshold: 5,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderFailure('PROVIDER_OPENAI', new Error('API error'));

      expect(mockRepo.setState).toHaveBeenCalledWith('PROVIDER_OPENAI', {
        state: 'off',
        stateChangedAt: expect.any(String),
      });
    });

    test('does not transition when failure count < threshold', async () => {
      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockResolvedValue(3),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
            failureCount: 3,
            failureThreshold: 5,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderFailure('PROVIDER_OPENAI', new Error('API error'));

      expect(mockRepo.setState).not.toHaveBeenCalled();
    });

    test('AuthenticationError trips circuit immediately (threshold=1)', async () => {
      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockResolvedValue(1),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
            failureCount: 1,
            failureThreshold: 5,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderFailure(
        'PROVIDER_OPENAI',
        new AuthenticationError('Invalid API key', 'openai')
      );

      // Should trip immediately despite threshold being 5
      expect(mockRepo.setState).toHaveBeenCalledWith('PROVIDER_OPENAI', {
        state: 'off',
        stateChangedAt: expect.any(String),
      });
    });

    test('RateLimitError counts toward threshold normally', async () => {
      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockResolvedValue(2),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
            failureCount: 2,
            failureThreshold: 5,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderFailure(
        'PROVIDER_OPENAI',
        new RateLimitError('Rate limited', 'openai')
      );

      // Should not trip - count is only 2
      expect(mockRepo.setState).not.toHaveBeenCalled();
    });

    test('OverloadedError counts toward threshold normally', async () => {
      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockResolvedValue(3),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
            failureCount: 3,
            failureThreshold: 5,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderFailure(
        'PROVIDER_OPENAI',
        new OverloadedError('Overloaded', 'openai')
      );

      // Should not trip - count is only 3
      expect(mockRepo.setState).not.toHaveBeenCalled();
    });

    test('transitions from HALF_OPEN to OPEN on any failure', async () => {
      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockResolvedValue(1),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'half_open',
            failureCount: 1,
            failureThreshold: 5,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderFailure('PROVIDER_OPENAI', new Error('API error'));

      // In HALF_OPEN, any failure immediately trips to OPEN
      expect(mockRepo.setState).toHaveBeenCalledWith('PROVIDER_OPENAI', {
        state: 'off',
        stateChangedAt: expect.any(String),
      });
    });

    test('handles repository errors gracefully', async () => {
      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      await expect(
        service.recordProviderFailure('PROVIDER_OPENAI', new Error('API error'))
      ).resolves.not.toThrow();
    });
  });

  describe('recordProviderSuccess', () => {
    test('increments success count via repository', async () => {
      const mockRepo = createMockRepository({
        recordSuccess: jest.fn().mockResolvedValue(1),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
            successCount: 1,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderSuccess('PROVIDER_OPENAI');

      expect(mockRepo.recordSuccess).toHaveBeenCalledWith('PROVIDER_OPENAI');
    });

    test('does not change state when in CLOSED', async () => {
      const mockRepo = createMockRepository({
        recordSuccess: jest.fn().mockResolvedValue(5),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
            successCount: 5,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderSuccess('PROVIDER_OPENAI');

      expect(mockRepo.setState).not.toHaveBeenCalled();
    });

    test('transitions from HALF_OPEN to CLOSED when successes >= HALF_OPEN_ATTEMPTS', async () => {
      const mockRepo = createMockRepository({
        recordSuccess: jest.fn().mockResolvedValue(2),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'half_open',
            successCount: 2,
          })
        ),
        resetCounters: jest.fn().mockResolvedValue(undefined),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderSuccess('PROVIDER_OPENAI');

      expect(mockRepo.setState).toHaveBeenCalledWith('PROVIDER_OPENAI', {
        state: 'on',
        stateChangedAt: expect.any(String),
      });
      expect(mockRepo.resetCounters).toHaveBeenCalledWith('PROVIDER_OPENAI');
    });

    test('does not transition from HALF_OPEN when successes < HALF_OPEN_ATTEMPTS', async () => {
      const mockRepo = createMockRepository({
        recordSuccess: jest.fn().mockResolvedValue(1),
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'half_open',
            successCount: 1,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      await service.recordProviderSuccess('PROVIDER_OPENAI');

      expect(mockRepo.setState).not.toHaveBeenCalled();
    });

    test('handles repository errors gracefully', async () => {
      const mockRepo = createMockRepository({
        recordSuccess: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      await expect(service.recordProviderSuccess('PROVIDER_OPENAI')).resolves.not.toThrow();
    });
  });

  describe('isProviderAvailable', () => {
    test('returns false when circuit state is OPEN (off)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'off',
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      const available = await service.isProviderAvailable('PROVIDER_OPENAI');

      expect(available).toBe(false);
    });

    test('returns true when circuit state is CLOSED (on)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      const available = await service.isProviderAvailable('PROVIDER_OPENAI');

      expect(available).toBe(true);
    });

    test('returns true when HALF_OPEN and reset timeout elapsed', async () => {
      // stateChangedAt 6 minutes ago (> 5 minute timeout)
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'half_open',
            stateChangedAt: sixMinutesAgo,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      const available = await service.isProviderAvailable('PROVIDER_OPENAI');

      expect(available).toBe(true);
    });

    test('returns true when HALF_OPEN (allows limited requests for testing)', async () => {
      // stateChangedAt 1 minute ago (< 5 minute timeout)
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'half_open',
            stateChangedAt: oneMinuteAgo,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      const available = await service.isProviderAvailable('PROVIDER_OPENAI');

      // HALF_OPEN always allows attempts to test recovery
      expect(available).toBe(true);
    });

    test('returns true when circuit does not exist (fail-open)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(null),
      });
      const service = new CircuitBreakerService(mockRepo);

      const available = await service.isProviderAvailable('UNKNOWN_PROVIDER');

      expect(available).toBe(true);
    });

    test('handles repository errors gracefully (returns true)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      const available = await service.isProviderAvailable('PROVIDER_OPENAI');

      expect(available).toBe(true);
    });
  });

  describe('getProviderStatus', () => {
    test('returns full provider circuit status', async () => {
      const stateChangedAt = new Date().toISOString();
      const lastFailureAt = new Date().toISOString();
      const lastSuccessAt = new Date().toISOString();
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'on',
            failureCount: 2,
            successCount: 10,
            failureThreshold: 5,
            lastFailureAt,
            lastSuccessAt,
            stateChangedAt,
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      const status = await service.getProviderStatus('PROVIDER_OPENAI');

      expect(status).toEqual({
        circuitId: 'PROVIDER_OPENAI',
        state: 'on',
        failureCount: 2,
        successCount: 10,
        failureThreshold: 5,
        lastFailureAt,
        lastSuccessAt,
        stateChangedAt,
        canAttempt: true,
        resetTimeoutMs: CIRCUIT_BREAKER_CONFIG.DEFAULT_RESET_TIMEOUT_MS,
      });
    });

    test('returns canAttempt=false when circuit is OPEN', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'off',
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      const status = await service.getProviderStatus('PROVIDER_OPENAI');

      expect(status?.canAttempt).toBe(false);
    });

    test('returns canAttempt=true when circuit is HALF_OPEN', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(
          createMockState({
            circuitId: 'PROVIDER_OPENAI',
            circuitType: 'provider',
            state: 'half_open',
          })
        ),
      });
      const service = new CircuitBreakerService(mockRepo);

      const status = await service.getProviderStatus('PROVIDER_OPENAI');

      expect(status?.canAttempt).toBe(true);
    });

    test('returns null when circuit does not exist', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockResolvedValue(null),
      });
      const service = new CircuitBreakerService(mockRepo);

      const status = await service.getProviderStatus('UNKNOWN_PROVIDER');

      expect(status).toBeNull();
    });

    test('handles repository errors gracefully (returns null)', async () => {
      const mockRepo = createMockRepository({
        getState: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      const status = await service.getProviderStatus('PROVIDER_OPENAI');

      expect(status).toBeNull();
    });
  });

  describe('resetProviderCircuit', () => {
    test('resets circuit to CLOSED state', async () => {
      const mockRepo = createMockRepository();
      const service = new CircuitBreakerService(mockRepo);

      await service.resetProviderCircuit('PROVIDER_OPENAI');

      expect(mockRepo.setState).toHaveBeenCalledWith('PROVIDER_OPENAI', {
        state: 'on',
        stateChangedAt: expect.any(String),
      });
    });

    test('clears all counters', async () => {
      const mockRepo = createMockRepository();
      const service = new CircuitBreakerService(mockRepo);

      await service.resetProviderCircuit('PROVIDER_OPENAI');

      expect(mockRepo.resetCounters).toHaveBeenCalledWith('PROVIDER_OPENAI');
    });

    test('handles repository errors gracefully', async () => {
      const mockRepo = createMockRepository({
        setState: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const service = new CircuitBreakerService(mockRepo);

      await expect(service.resetProviderCircuit('PROVIDER_OPENAI')).resolves.not.toThrow();
    });
  });

  describe('provider circuit state machine scenarios', () => {
    test('full cycle: CLOSED -> OPEN -> HALF_OPEN -> CLOSED', async () => {
      // This tests the conceptual state machine flow
      // Note: In real usage, OPEN -> HALF_OPEN transition is time-based
      // and would be handled by isProviderAvailable when timeout elapses

      let currentState = 'on';
      let failureCount = 0;
      let successCount = 0;

      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockImplementation(() => {
          failureCount++;
          return Promise.resolve(failureCount);
        }),
        recordSuccess: jest.fn().mockImplementation(() => {
          successCount++;
          return Promise.resolve(successCount);
        }),
        getState: jest.fn().mockImplementation(() =>
          Promise.resolve(
            createMockState({
              circuitId: 'PROVIDER_OPENAI',
              circuitType: 'provider',
              state: currentState as 'on' | 'off' | 'half_open',
              failureCount,
              successCount,
              failureThreshold: 5,
            })
          )
        ),
        setState: jest.fn().mockImplementation((_id, update) => {
          if (update.state) {
            currentState = update.state;
          }
          return Promise.resolve();
        }),
        resetCounters: jest.fn().mockImplementation(() => {
          failureCount = 0;
          successCount = 0;
          return Promise.resolve();
        }),
      });
      const service = new CircuitBreakerService(mockRepo);

      // Start in CLOSED state (on)
      expect(currentState).toBe('on');

      // Record 5 failures -> should transition to OPEN
      for (let i = 0; i < 5; i++) {
        await service.recordProviderFailure('PROVIDER_OPENAI', new Error('fail'));
      }
      expect(currentState).toBe('off');

      // Simulate time passing and entering HALF_OPEN
      currentState = 'half_open';
      successCount = 0;

      // Record 2 successes in HALF_OPEN -> should transition to CLOSED
      await service.recordProviderSuccess('PROVIDER_OPENAI');
      await service.recordProviderSuccess('PROVIDER_OPENAI');
      expect(currentState).toBe('on');
    });

    test('HALF_OPEN failure immediately trips to OPEN', async () => {
      let currentState: 'on' | 'off' | 'half_open' = 'half_open';

      const mockRepo = createMockRepository({
        recordFailure: jest.fn().mockResolvedValue(1),
        getState: jest.fn().mockImplementation(() =>
          Promise.resolve(
            createMockState({
              circuitId: 'PROVIDER_OPENAI',
              circuitType: 'provider',
              state: currentState,
              failureCount: 1,
              failureThreshold: 5,
            })
          )
        ),
        setState: jest.fn().mockImplementation((_id, update) => {
          if (update.state) {
            currentState = update.state;
          }
          return Promise.resolve();
        }),
      });
      const service = new CircuitBreakerService(mockRepo);

      // In HALF_OPEN, a single failure should trip to OPEN
      await service.recordProviderFailure('PROVIDER_OPENAI', new Error('fail'));

      expect(currentState).toBe('off');
    });
  });
});
