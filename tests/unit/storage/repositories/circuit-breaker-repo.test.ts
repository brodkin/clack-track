/**
 * CircuitBreakerRepository Tests
 *
 * Comprehensive tests for the circuit breaker persistence layer.
 * Tests all repository methods and graceful degradation behavior.
 *
 * @module tests/unit/storage/repositories/circuit-breaker-repo
 */

import { CircuitBreakerRepository } from '../../../../src/storage/repositories/circuit-breaker-repo.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';
import type {
  CircuitDefinition,
  CircuitStateUpdate,
} from '../../../../src/types/circuit-breaker.js';

describe('CircuitBreakerRepository', () => {
  let knex: Knex;
  let repository: CircuitBreakerRepository;

  beforeAll(async () => {
    // Reset singleton to ensure clean state (once per test file)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create table manually instead of using migrations (avoids ES module import issues)
    const tableExists = await knex.schema.hasTable('circuit_breaker_state');
    if (!tableExists) {
      await knex.schema.createTable('circuit_breaker_state', table => {
        // Primary key
        table.increments('id').primary();

        // Circuit identification
        table.text('circuit_id').unique().notNullable();
        table.text('circuit_type').notNullable();

        // State management
        table.text('state').notNullable();
        table.text('default_state').notNullable();
        table.text('description').nullable();

        // Failure tracking for provider circuits
        table.integer('failure_count').defaultTo(0);
        table.integer('success_count').defaultTo(0);
        table.integer('failure_threshold').defaultTo(5);

        // Timestamps for state transitions
        table.text('last_failure_at').nullable();
        table.text('last_success_at').nullable();
        table.text('state_changed_at').nullable();

        // Audit timestamps
        table.text('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
        table.text('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));

        // Indexes for common queries
        table.index('circuit_id', 'idx_circuit_breaker_circuit_id');
        table.index('circuit_type', 'idx_circuit_breaker_circuit_type');
      });
    }
  });

  beforeEach(async () => {
    // Clean table data for isolated tests (table structure persists)
    await knex('circuit_breaker_state').del();
    repository = new CircuitBreakerRepository(knex);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('getState', () => {
    test('should return null when circuit does not exist', async () => {
      const result = await repository.getState('NON_EXISTENT');

      expect(result).toBeNull();
    });

    test('should return circuit state when it exists', async () => {
      // Insert a circuit directly
      await knex('circuit_breaker_state').insert({
        circuit_id: 'MASTER',
        circuit_type: 'manual',
        state: 'on',
        default_state: 'on',
        description: 'Master circuit',
        failure_count: 0,
        success_count: 0,
        failure_threshold: 5,
      });

      const result = await repository.getState('MASTER');

      expect(result).not.toBeNull();
      expect(result?.circuitId).toBe('MASTER');
      expect(result?.circuitType).toBe('manual');
      expect(result?.state).toBe('on');
      expect(result?.defaultState).toBe('on');
      expect(result?.description).toBe('Master circuit');
      expect(result?.failureCount).toBe(0);
      expect(result?.successCount).toBe(0);
      expect(result?.failureThreshold).toBe(5);
    });

    test('should return circuit with all timestamp fields', async () => {
      const now = new Date().toISOString();
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_OPENAI',
        circuit_type: 'provider',
        state: 'off',
        default_state: 'on',
        failure_count: 3,
        success_count: 1,
        failure_threshold: 5,
        last_failure_at: now,
        last_success_at: now,
        state_changed_at: now,
      });

      const result = await repository.getState('PROVIDER_OPENAI');

      expect(result).not.toBeNull();
      expect(result?.lastFailureAt).toBe(now);
      expect(result?.lastSuccessAt).toBe(now);
      expect(result?.stateChangedAt).toBe(now);
    });
  });

  describe('setState', () => {
    test('should update circuit state', async () => {
      // Insert initial circuit
      await knex('circuit_breaker_state').insert({
        circuit_id: 'MASTER',
        circuit_type: 'manual',
        state: 'on',
        default_state: 'on',
      });

      const update: CircuitStateUpdate = {
        state: 'off',
        stateChangedAt: new Date().toISOString(),
      };

      await repository.setState('MASTER', update);

      const result = await repository.getState('MASTER');
      expect(result?.state).toBe('off');
      expect(result?.stateChangedAt).not.toBeNull();
    });

    test('should update failure count and last failure timestamp', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_OPENAI',
        circuit_type: 'provider',
        state: 'on',
        default_state: 'on',
        failure_count: 0,
      });

      const now = new Date().toISOString();
      await repository.setState('PROVIDER_OPENAI', {
        failureCount: 3,
        lastFailureAt: now,
      });

      const result = await repository.getState('PROVIDER_OPENAI');
      expect(result?.failureCount).toBe(3);
      expect(result?.lastFailureAt).toBe(now);
    });

    test('should update success count and last success timestamp', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_ANTHROPIC',
        circuit_type: 'provider',
        state: 'half_open',
        default_state: 'on',
        success_count: 0,
      });

      const now = new Date().toISOString();
      await repository.setState('PROVIDER_ANTHROPIC', {
        successCount: 2,
        lastSuccessAt: now,
      });

      const result = await repository.getState('PROVIDER_ANTHROPIC');
      expect(result?.successCount).toBe(2);
      expect(result?.lastSuccessAt).toBe(now);
    });

    test('should update multiple fields at once', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_OPENAI',
        circuit_type: 'provider',
        state: 'on',
        default_state: 'on',
        failure_count: 0,
        success_count: 0,
      });

      const now = new Date().toISOString();
      await repository.setState('PROVIDER_OPENAI', {
        state: 'off',
        failureCount: 5,
        successCount: 0,
        lastFailureAt: now,
        stateChangedAt: now,
      });

      const result = await repository.getState('PROVIDER_OPENAI');
      expect(result?.state).toBe('off');
      expect(result?.failureCount).toBe(5);
      expect(result?.successCount).toBe(0);
    });

    test('should not throw when updating non-existent circuit', async () => {
      // Graceful degradation - should not throw
      await expect(repository.setState('NON_EXISTENT', { state: 'off' })).resolves.not.toThrow();
    });
  });

  describe('getAllStates', () => {
    test('should return empty array when no circuits exist', async () => {
      const result = await repository.getAllStates();

      expect(result).toEqual([]);
    });

    test('should return all circuit states', async () => {
      await knex('circuit_breaker_state').insert([
        {
          circuit_id: 'MASTER',
          circuit_type: 'manual',
          state: 'on',
          default_state: 'on',
        },
        {
          circuit_id: 'PROVIDER_OPENAI',
          circuit_type: 'provider',
          state: 'on',
          default_state: 'on',
        },
        {
          circuit_id: 'PROVIDER_ANTHROPIC',
          circuit_type: 'provider',
          state: 'off',
          default_state: 'on',
        },
      ]);

      const result = await repository.getAllStates();

      expect(result).toHaveLength(3);
      expect(result.map(r => r.circuitId).sort()).toEqual([
        'MASTER',
        'PROVIDER_ANTHROPIC',
        'PROVIDER_OPENAI',
      ]);
    });

    test('should map all fields correctly for each circuit', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'MASTER',
        circuit_type: 'manual',
        state: 'on',
        default_state: 'on',
        description: 'Main switch',
        failure_count: 1,
        success_count: 10,
        failure_threshold: 3,
      });

      const result = await repository.getAllStates();

      expect(result[0]).toMatchObject({
        circuitId: 'MASTER',
        circuitType: 'manual',
        state: 'on',
        defaultState: 'on',
        description: 'Main switch',
        failureCount: 1,
        successCount: 10,
        failureThreshold: 3,
      });
    });
  });

  describe('initializeCircuit', () => {
    test('should insert new circuit when it does not exist', async () => {
      const definition: CircuitDefinition = {
        circuitId: 'MASTER',
        circuitType: 'manual',
        defaultState: 'on',
        description: 'Master control circuit',
        failureThreshold: 3,
      };

      await repository.initializeCircuit(definition);

      const result = await repository.getState('MASTER');
      expect(result).not.toBeNull();
      expect(result?.circuitId).toBe('MASTER');
      expect(result?.circuitType).toBe('manual');
      expect(result?.state).toBe('on');
      expect(result?.defaultState).toBe('on');
      expect(result?.description).toBe('Master control circuit');
      expect(result?.failureThreshold).toBe(3);
    });

    test('should not modify existing circuit', async () => {
      // Pre-insert a circuit with specific values
      await knex('circuit_breaker_state').insert({
        circuit_id: 'MASTER',
        circuit_type: 'manual',
        state: 'off', // Changed from default
        default_state: 'on',
        description: 'Original description',
        failure_count: 5,
      });

      // Try to initialize with different values
      const definition: CircuitDefinition = {
        circuitId: 'MASTER',
        circuitType: 'manual',
        defaultState: 'on',
        description: 'New description',
      };

      await repository.initializeCircuit(definition);

      // Should preserve original values
      const result = await repository.getState('MASTER');
      expect(result?.state).toBe('off');
      expect(result?.description).toBe('Original description');
      expect(result?.failureCount).toBe(5);
    });

    test('should use default failure threshold when not provided', async () => {
      const definition: CircuitDefinition = {
        circuitId: 'PROVIDER_OPENAI',
        circuitType: 'provider',
        defaultState: 'on',
      };

      await repository.initializeCircuit(definition);

      const result = await repository.getState('PROVIDER_OPENAI');
      expect(result?.failureThreshold).toBe(5); // Default from schema
    });

    test('should initialize circuit with null description', async () => {
      const definition: CircuitDefinition = {
        circuitId: 'SLEEP_MODE',
        circuitType: 'manual',
        defaultState: 'off',
      };

      await repository.initializeCircuit(definition);

      const result = await repository.getState('SLEEP_MODE');
      expect(result?.description).toBeNull();
    });
  });

  describe('recordFailure', () => {
    test('should increment failure count and return new count', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_OPENAI',
        circuit_type: 'provider',
        state: 'on',
        default_state: 'on',
        failure_count: 0,
      });

      const count1 = await repository.recordFailure('PROVIDER_OPENAI');
      expect(count1).toBe(1);

      const count2 = await repository.recordFailure('PROVIDER_OPENAI');
      expect(count2).toBe(2);

      const count3 = await repository.recordFailure('PROVIDER_OPENAI');
      expect(count3).toBe(3);
    });

    test('should update last_failure_at timestamp', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_OPENAI',
        circuit_type: 'provider',
        state: 'on',
        default_state: 'on',
        failure_count: 0,
        last_failure_at: null,
      });

      await repository.recordFailure('PROVIDER_OPENAI');

      const result = await repository.getState('PROVIDER_OPENAI');
      expect(result?.lastFailureAt).not.toBeNull();
    });

    test('should return 0 for non-existent circuit', async () => {
      const count = await repository.recordFailure('NON_EXISTENT');

      expect(count).toBe(0);
    });
  });

  describe('recordSuccess', () => {
    test('should increment success count and return new count', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_ANTHROPIC',
        circuit_type: 'provider',
        state: 'half_open',
        default_state: 'on',
        success_count: 0,
      });

      const count1 = await repository.recordSuccess('PROVIDER_ANTHROPIC');
      expect(count1).toBe(1);

      const count2 = await repository.recordSuccess('PROVIDER_ANTHROPIC');
      expect(count2).toBe(2);
    });

    test('should update last_success_at timestamp', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_ANTHROPIC',
        circuit_type: 'provider',
        state: 'half_open',
        default_state: 'on',
        success_count: 0,
        last_success_at: null,
      });

      await repository.recordSuccess('PROVIDER_ANTHROPIC');

      const result = await repository.getState('PROVIDER_ANTHROPIC');
      expect(result?.lastSuccessAt).not.toBeNull();
    });

    test('should return 0 for non-existent circuit', async () => {
      const count = await repository.recordSuccess('NON_EXISTENT');

      expect(count).toBe(0);
    });
  });

  describe('resetCounters', () => {
    test('should reset failure and success counts to 0', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_OPENAI',
        circuit_type: 'provider',
        state: 'on',
        default_state: 'on',
        failure_count: 10,
        success_count: 5,
      });

      await repository.resetCounters('PROVIDER_OPENAI');

      const result = await repository.getState('PROVIDER_OPENAI');
      expect(result?.failureCount).toBe(0);
      expect(result?.successCount).toBe(0);
    });

    test('should not affect other circuit fields', async () => {
      const now = new Date().toISOString();
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_OPENAI',
        circuit_type: 'provider',
        state: 'off',
        default_state: 'on',
        description: 'OpenAI provider',
        failure_count: 10,
        success_count: 5,
        failure_threshold: 3,
        last_failure_at: now,
        last_success_at: now,
      });

      await repository.resetCounters('PROVIDER_OPENAI');

      const result = await repository.getState('PROVIDER_OPENAI');
      expect(result?.state).toBe('off');
      expect(result?.description).toBe('OpenAI provider');
      expect(result?.failureThreshold).toBe(3);
      // Timestamps preserved
      expect(result?.lastFailureAt).toBe(now);
      expect(result?.lastSuccessAt).toBe(now);
    });

    test('should not throw for non-existent circuit', async () => {
      await expect(repository.resetCounters('NON_EXISTENT')).resolves.not.toThrow();
    });
  });

  describe('graceful degradation', () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    test('getState should return null on database error', async () => {
      // Create a broken Knex mock that throws on queries
      const brokenKnex = {
        from: () => {
          throw new Error('Database connection lost');
        },
      } as unknown as Knex;
      (brokenKnex as { [key: string]: unknown })['circuit_breaker_state'] = () => {
        throw new Error('Database connection lost');
      };

      const brokenRepo = new CircuitBreakerRepository(brokenKnex);

      const result = await brokenRepo.getState('MASTER');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get circuit state'),
        expect.any(Error)
      );
    });

    test('setState should not throw on database error', async () => {
      const brokenKnex = {
        from: () => {
          throw new Error('Database connection lost');
        },
      } as unknown as Knex;
      (brokenKnex as { [key: string]: unknown })['circuit_breaker_state'] = () => {
        throw new Error('Database connection lost');
      };

      const brokenRepo = new CircuitBreakerRepository(brokenKnex);

      await expect(brokenRepo.setState('MASTER', { state: 'off' })).resolves.not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to set circuit state'),
        expect.any(Error)
      );
    });

    test('getAllStates should return empty array on database error', async () => {
      const brokenKnex = {
        from: () => {
          throw new Error('Database connection lost');
        },
      } as unknown as Knex;
      (brokenKnex as { [key: string]: unknown })['circuit_breaker_state'] = () => {
        throw new Error('Database connection lost');
      };

      const brokenRepo = new CircuitBreakerRepository(brokenKnex);

      const result = await brokenRepo.getAllStates();

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get all circuit states'),
        expect.any(Error)
      );
    });

    test('initializeCircuit should not throw on database error', async () => {
      const brokenKnex = {
        from: () => {
          throw new Error('Database connection lost');
        },
      } as unknown as Knex;
      (brokenKnex as { [key: string]: unknown })['circuit_breaker_state'] = () => {
        throw new Error('Database connection lost');
      };

      const brokenRepo = new CircuitBreakerRepository(brokenKnex);

      await expect(
        brokenRepo.initializeCircuit({
          circuitId: 'TEST',
          circuitType: 'manual',
          defaultState: 'on',
        })
      ).resolves.not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize circuit'),
        expect.any(Error)
      );
    });

    test('recordFailure should return 0 on database error', async () => {
      const brokenKnex = {
        from: () => {
          throw new Error('Database connection lost');
        },
      } as unknown as Knex;
      (brokenKnex as { [key: string]: unknown })['circuit_breaker_state'] = () => {
        throw new Error('Database connection lost');
      };

      const brokenRepo = new CircuitBreakerRepository(brokenKnex);

      const result = await brokenRepo.recordFailure('MASTER');

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record failure'),
        expect.any(Error)
      );
    });

    test('recordSuccess should return 0 on database error', async () => {
      const brokenKnex = {
        from: () => {
          throw new Error('Database connection lost');
        },
      } as unknown as Knex;
      (brokenKnex as { [key: string]: unknown })['circuit_breaker_state'] = () => {
        throw new Error('Database connection lost');
      };

      const brokenRepo = new CircuitBreakerRepository(brokenKnex);

      const result = await brokenRepo.recordSuccess('MASTER');

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record success'),
        expect.any(Error)
      );
    });

    test('resetCounters should not throw on database error', async () => {
      const brokenKnex = {
        from: () => {
          throw new Error('Database connection lost');
        },
      } as unknown as Knex;
      (brokenKnex as { [key: string]: unknown })['circuit_breaker_state'] = () => {
        throw new Error('Database connection lost');
      };

      const brokenRepo = new CircuitBreakerRepository(brokenKnex);

      await expect(brokenRepo.resetCounters('MASTER')).resolves.not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reset counters'),
        expect.any(Error)
      );
    });
  });

  describe('edge cases', () => {
    test('should handle circuit with all nullable fields as null', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'MINIMAL',
        circuit_type: 'manual',
        state: 'on',
        default_state: 'on',
        description: null,
        last_failure_at: null,
        last_success_at: null,
        state_changed_at: null,
      });

      const result = await repository.getState('MINIMAL');

      expect(result?.description).toBeNull();
      expect(result?.lastFailureAt).toBeNull();
      expect(result?.lastSuccessAt).toBeNull();
      expect(result?.stateChangedAt).toBeNull();
    });

    test('should handle half_open state for provider circuits', async () => {
      await knex('circuit_breaker_state').insert({
        circuit_id: 'PROVIDER_OPENAI',
        circuit_type: 'provider',
        state: 'half_open',
        default_state: 'on',
      });

      const result = await repository.getState('PROVIDER_OPENAI');

      expect(result?.state).toBe('half_open');
    });

    test('should preserve circuit_id case sensitivity', async () => {
      await knex('circuit_breaker_state').insert([
        {
          circuit_id: 'MASTER',
          circuit_type: 'manual',
          state: 'on',
          default_state: 'on',
        },
        {
          circuit_id: 'master',
          circuit_type: 'manual',
          state: 'off',
          default_state: 'on',
        },
      ]);

      const upper = await repository.getState('MASTER');
      const lower = await repository.getState('master');

      expect(upper?.state).toBe('on');
      expect(lower?.state).toBe('off');
    });
  });
});
