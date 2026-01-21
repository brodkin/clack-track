/**
 * CircuitBreakerService - Service layer for circuit breaker operations
 *
 * Provides high-level circuit breaker control for manual system switches.
 * Uses repository pattern for data persistence with graceful degradation.
 *
 * Circuit States:
 * - 'on' - Circuit is enabled (traffic flows)
 * - 'off' - Circuit is disabled (traffic blocked)
 * - 'half_open' - Testing recovery (provider circuits only)
 *
 * "Open" circuit (isCircuitOpen=true) means traffic is BLOCKED (state='off')
 * "Closed" circuit (isCircuitOpen=false) means traffic is ALLOWED (state='on' or 'half_open')
 *
 * @module services/circuit-breaker-service
 */

import type { CircuitBreakerRepository } from '../storage/repositories/circuit-breaker-repo.js';
import type {
  CircuitBreakerState,
  CircuitDefinition,
  CircuitState,
  CircuitType,
  ProviderCircuitStatus,
} from '../types/circuit-breaker.js';
import { AuthenticationError } from '../types/errors.js';

/**
 * Manual circuit definitions - hardcoded system control switches
 *
 * These circuits provide admin-level control over system behavior.
 * Unlike provider circuits, they are not auto-managed based on failures.
 */
export const MANUAL_CIRCUITS: CircuitDefinition[] = [
  {
    circuitId: 'MASTER',
    circuitType: 'manual',
    defaultState: 'on',
    description: 'Global kill switch - blocks all updates when off',
  },
  {
    circuitId: 'SLEEP_MODE',
    circuitType: 'manual',
    defaultState: 'off',
    description: 'Quiet hours mode - blocks all updates when on',
  },
];

/**
 * Provider circuit definitions - auto-managed based on API failures
 *
 * These circuits implement the circuit breaker pattern for AI providers.
 * They automatically trip when failure thresholds are exceeded.
 */
export const PROVIDER_CIRCUITS: CircuitDefinition[] = [
  {
    circuitId: 'PROVIDER_OPENAI',
    circuitType: 'provider',
    defaultState: 'on',
    description: 'Auto-trips on OpenAI API failures',
    failureThreshold: 5,
  },
  {
    circuitId: 'PROVIDER_ANTHROPIC',
    circuitType: 'provider',
    defaultState: 'on',
    description: 'Auto-trips on Anthropic API failures',
    failureThreshold: 5,
  },
];

/**
 * Combined list of all circuit definitions
 */
export const ALL_CIRCUITS: CircuitDefinition[] = [...MANUAL_CIRCUITS, ...PROVIDER_CIRCUITS];

/**
 * Configuration constants for circuit breaker behavior
 */
export const CIRCUIT_BREAKER_CONFIG = {
  /** Number of failures before circuit trips to OPEN state */
  DEFAULT_FAILURE_THRESHOLD: 5,
  /** Time in milliseconds to wait in OPEN before transitioning to HALF_OPEN */
  DEFAULT_RESET_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  /** Number of successful attempts in HALF_OPEN to return to CLOSED */
  DEFAULT_HALF_OPEN_ATTEMPTS: 2,
} as const;

/**
 * Service for managing circuit breaker states
 *
 * Provides methods for:
 * - Initializing manual circuits on startup
 * - Checking if circuits are open (blocking traffic)
 * - Setting circuit states manually
 * - Querying circuit status and filtering by type
 *
 * @example
 * ```typescript
 * const service = new CircuitBreakerService(repository);
 * await service.initialize();
 *
 * // Check if MASTER is blocking
 * if (await service.isCircuitOpen('MASTER')) {
 *   console.log('System is disabled');
 *   return;
 * }
 *
 * // Disable system
 * await service.setCircuitState('MASTER', 'off');
 * ```
 */
let instanceCounter = 0;

export class CircuitBreakerService {
  private instanceId: number;

  constructor(private repository: CircuitBreakerRepository) {
    this.instanceId = ++instanceCounter;
    console.log(`[DEBUG] CircuitBreakerService instance #${this.instanceId} created`);
  }

  /**
   * Initialize all circuits (manual and provider) in the database
   *
   * Calls repository.initializeCircuit for each circuit in ALL_CIRCUITS.
   * Idempotent - safe to call multiple times (won't overwrite existing).
   * Handles errors gracefully - logs but doesn't throw.
   */
  async initialize(): Promise<void> {
    for (const circuit of ALL_CIRCUITS) {
      try {
        await this.repository.initializeCircuit(circuit);
      } catch (error) {
        console.warn(`Failed to initialize circuit ${circuit.circuitId}:`, error);
      }
    }
  }

  /**
   * Check if a circuit is open (blocking traffic)
   *
   * Returns TRUE when circuit is OFF (blocks traffic)
   * Returns FALSE when circuit is ON or HALF_OPEN (allows traffic)
   * Returns FALSE when circuit doesn't exist (fail-open for safety)
   *
   * @param circuitId - Unique circuit identifier
   * @returns true if circuit is open (blocking), false otherwise
   */
  async isCircuitOpen(circuitId: string): Promise<boolean> {
    try {
      const state = await this.repository.getState(circuitId);
      if (!state) {
        // Circuit doesn't exist - default to allowing traffic
        console.log(
          `[DEBUG] isCircuitOpen #${this.instanceId} ${circuitId}: no state found, returning false (allow)`
        );
        return false;
      }
      // "Open" circuit blocks traffic - only 'off' state blocks
      const isOpen = state.state === 'off';
      console.log(
        `[DEBUG] isCircuitOpen #${this.instanceId} ${circuitId}: state=${state.state}, isOpen=${isOpen}`
      );
      return isOpen;
    } catch (error) {
      console.warn(`Failed to check circuit ${circuitId}:`, error);
      // On error, default to allowing traffic (fail-open)
      return false;
    }
  }

  /**
   * Update circuit state
   *
   * Sets the circuit to a new state and records the timestamp.
   * Handles errors gracefully - logs but doesn't throw.
   *
   * @param circuitId - Circuit to update
   * @param state - New state ('on', 'off', or 'half_open')
   */
  async setCircuitState(circuitId: string, state: CircuitState): Promise<void> {
    try {
      const beforeState = await this.repository.getState(circuitId);
      console.log(
        `[DEBUG] setCircuitState #${this.instanceId} ${circuitId}: before=${beforeState?.state}, setting to=${state}`
      );

      await this.repository.setState(circuitId, {
        state,
        stateChangedAt: new Date().toISOString(),
      });

      const afterState = await this.repository.getState(circuitId);
      console.log(
        `[DEBUG] setCircuitState #${this.instanceId} ${circuitId}: after=${afterState?.state}`
      );
    } catch (error) {
      console.warn(`Failed to set circuit ${circuitId} state:`, error);
    }
  }

  /**
   * Get full circuit status
   *
   * Returns the complete CircuitBreakerState record for a circuit.
   * Returns null if circuit doesn't exist or on error.
   *
   * @param circuitId - Circuit to query
   * @returns Full circuit state or null
   */
  async getCircuitStatus(circuitId: string): Promise<CircuitBreakerState | null> {
    try {
      return await this.repository.getState(circuitId);
    } catch (error) {
      console.warn(`Failed to get circuit ${circuitId} status:`, error);
      return null;
    }
  }

  /**
   * Get all circuit states
   *
   * Returns all circuits from the repository.
   * Returns empty array on error.
   *
   * @returns Array of all circuit states
   */
  async getAllCircuits(): Promise<CircuitBreakerState[]> {
    try {
      return await this.repository.getAllStates();
    } catch (error) {
      console.warn('Failed to get all circuits:', error);
      return [];
    }
  }

  /**
   * Get circuits filtered by type
   *
   * Returns only circuits matching the specified type.
   * Returns empty array if no matches or on error.
   *
   * @param type - Circuit type to filter by ('manual' or 'provider')
   * @returns Array of matching circuit states
   */
  async getCircuitsByType(type: CircuitType): Promise<CircuitBreakerState[]> {
    try {
      const allCircuits = await this.repository.getAllStates();
      return allCircuits.filter(circuit => circuit.circuitType === type);
    } catch (error) {
      console.warn(`Failed to get circuits by type ${type}:`, error);
      return [];
    }
  }

  // ========================================
  // PROVIDER CIRCUIT STATE MACHINE METHODS
  // ========================================

  /**
   * Record a provider failure and handle state transitions
   *
   * State machine transitions:
   * - CLOSED (on): Increments failure count. Trips to OPEN if count >= threshold.
   * - HALF_OPEN: Any failure immediately trips to OPEN.
   * - OPEN (off): No action (circuit already tripped).
   *
   * Special handling:
   * - AuthenticationError: Trips immediately (threshold = 1)
   * - RateLimitError/OverloadedError: Normal threshold counting
   *
   * @param circuitId - Provider circuit identifier
   * @param error - The error that occurred
   */
  async recordProviderFailure(circuitId: string, error: Error): Promise<void> {
    try {
      // Record the failure
      const failureCount = await this.repository.recordFailure(circuitId);

      // Get current state to determine transition logic
      const state = await this.repository.getState(circuitId);
      if (!state) {
        return;
      }

      // Determine effective threshold
      // AuthenticationError trips immediately (threshold = 1)
      const effectiveThreshold = error instanceof AuthenticationError ? 1 : state.failureThreshold;

      // In HALF_OPEN, any failure immediately trips to OPEN
      const shouldTrip =
        state.state === 'half_open' || (state.state === 'on' && failureCount >= effectiveThreshold);

      if (shouldTrip) {
        await this.repository.setState(circuitId, {
          state: 'off',
          stateChangedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn(`Failed to record provider failure for ${circuitId}:`, error);
    }
  }

  /**
   * Record a provider success and handle state transitions
   *
   * State machine transitions:
   * - CLOSED (on): Records success, no state change.
   * - HALF_OPEN: Increments success count. Transitions to CLOSED if
   *   count >= HALF_OPEN_ATTEMPTS, then resets counters.
   * - OPEN (off): No action (shouldn't receive successes in OPEN).
   *
   * @param circuitId - Provider circuit identifier
   */
  async recordProviderSuccess(circuitId: string): Promise<void> {
    try {
      // Record the success
      const successCount = await this.repository.recordSuccess(circuitId);

      // Get current state to determine transition logic
      const state = await this.repository.getState(circuitId);
      if (!state) {
        return;
      }

      // In HALF_OPEN, check if we should transition to CLOSED
      if (
        state.state === 'half_open' &&
        successCount >= CIRCUIT_BREAKER_CONFIG.DEFAULT_HALF_OPEN_ATTEMPTS
      ) {
        await this.repository.setState(circuitId, {
          state: 'on',
          stateChangedAt: new Date().toISOString(),
        });
        await this.repository.resetCounters(circuitId);
      }
    } catch (error) {
      console.warn(`Failed to record provider success for ${circuitId}:`, error);
    }
  }

  /**
   * Check if a provider circuit allows requests
   *
   * Returns:
   * - true: CLOSED (on) or HALF_OPEN - requests allowed
   * - false: OPEN (off) - requests blocked
   * - true: Circuit not found or error - fail-open for safety
   *
   * @param circuitId - Provider circuit identifier
   * @returns Whether requests should be attempted
   */
  async isProviderAvailable(circuitId: string): Promise<boolean> {
    try {
      const state = await this.repository.getState(circuitId);
      if (!state) {
        // Circuit doesn't exist - default to allowing traffic
        return true;
      }

      // OPEN (off) = blocked, CLOSED (on) or HALF_OPEN = allowed
      return state.state !== 'off';
    } catch (error) {
      console.warn(`Failed to check provider availability for ${circuitId}:`, error);
      // On error, default to allowing traffic (fail-open)
      return true;
    }
  }

  /**
   * Get detailed provider circuit status
   *
   * Returns full status including:
   * - Current state and counts
   * - Whether requests can be attempted
   * - Reset timeout configuration
   *
   * @param circuitId - Provider circuit identifier
   * @returns Provider status or null if not found
   */
  async getProviderStatus(circuitId: string): Promise<ProviderCircuitStatus | null> {
    try {
      const state = await this.repository.getState(circuitId);
      if (!state) {
        return null;
      }

      // canAttempt: true for CLOSED and HALF_OPEN, false for OPEN
      const canAttempt = state.state !== 'off';

      return {
        circuitId: state.circuitId,
        state: state.state,
        failureCount: state.failureCount,
        successCount: state.successCount,
        failureThreshold: state.failureThreshold,
        lastFailureAt: state.lastFailureAt,
        lastSuccessAt: state.lastSuccessAt,
        stateChangedAt: state.stateChangedAt,
        canAttempt,
        resetTimeoutMs: CIRCUIT_BREAKER_CONFIG.DEFAULT_RESET_TIMEOUT_MS,
      };
    } catch (error) {
      console.warn(`Failed to get provider status for ${circuitId}:`, error);
      return null;
    }
  }

  /**
   * Manually reset a provider circuit to CLOSED state
   *
   * Resets the circuit to operational state and clears all counters.
   * Use for manual intervention after fixing provider issues.
   *
   * @param circuitId - Provider circuit identifier
   */
  async resetProviderCircuit(circuitId: string): Promise<void> {
    try {
      await this.repository.setState(circuitId, {
        state: 'on',
        stateChangedAt: new Date().toISOString(),
      });
      await this.repository.resetCounters(circuitId);
    } catch (error) {
      console.warn(`Failed to reset provider circuit ${circuitId}:`, error);
    }
  }
}
