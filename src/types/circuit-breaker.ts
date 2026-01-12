/**
 * Circuit Breaker Type Definitions
 *
 * Types for the circuit breaker system that provides resilience
 * for both manual controls and AI provider failover.
 *
 * @module types/circuit-breaker
 */

/**
 * Circuit type classification
 * - 'manual' - System-wide controls (MASTER, SLEEP_MODE)
 * - 'provider' - AI provider circuits (PROVIDER_OPENAI, PROVIDER_ANTHROPIC)
 */
export type CircuitType = 'manual' | 'provider';

/**
 * Circuit state values
 * - 'on' - Circuit is operational/enabled
 * - 'off' - Circuit is disabled/tripped
 * - 'half_open' - Testing recovery (provider circuits only)
 */
export type CircuitState = 'on' | 'off' | 'half_open';

/**
 * Full circuit breaker state record from database
 * Maps directly to the circuit_breaker_state table schema
 */
export interface CircuitBreakerState {
  /** Auto-incrementing primary key */
  id: number;
  /** Unique circuit identifier (e.g., 'MASTER', 'PROVIDER_OPENAI') */
  circuitId: string;
  /** Circuit classification (manual or provider) */
  circuitType: CircuitType;
  /** Current circuit state */
  state: CircuitState;
  /** Default state when circuit is reset */
  defaultState: CircuitState;
  /** Human-readable description */
  description: string | null;
  /** Count of consecutive failures */
  failureCount: number;
  /** Count of consecutive successes (for half_open recovery) */
  successCount: number;
  /** Number of failures before circuit trips */
  failureThreshold: number;
  /** Timestamp of last recorded failure */
  lastFailureAt: string | null;
  /** Timestamp of last recorded success */
  lastSuccessAt: string | null;
  /** Timestamp of last state change */
  stateChangedAt: string | null;
  /** Record creation timestamp */
  createdAt: string;
  /** Record last update timestamp */
  updatedAt: string;
}

/**
 * Circuit definition for initialization
 * Used when registering a new circuit in the system
 */
export interface CircuitDefinition {
  /** Unique circuit identifier */
  circuitId: string;
  /** Circuit classification */
  circuitType: CircuitType;
  /** Default/initial state */
  defaultState: CircuitState;
  /** Human-readable description */
  description?: string;
  /** Failure threshold (defaults to 5) */
  failureThreshold?: number;
}

/**
 * Partial state update for circuit
 * Used when modifying circuit state without providing all fields
 */
export interface CircuitStateUpdate {
  /** New circuit state */
  state?: CircuitState;
  /** Updated failure count */
  failureCount?: number;
  /** Updated success count */
  successCount?: number;
  /** Timestamp of failure */
  lastFailureAt?: string;
  /** Timestamp of success */
  lastSuccessAt?: string;
  /** Timestamp of state change */
  stateChangedAt?: string;
}

/**
 * Provider circuit status with state machine metadata
 *
 * Extends basic CircuitBreakerState with computed fields for
 * provider circuit state machine operations.
 */
export interface ProviderCircuitStatus {
  /** Unique circuit identifier */
  circuitId: string;
  /** Current circuit state */
  state: CircuitState;
  /** Count of consecutive failures */
  failureCount: number;
  /** Count of consecutive successes (for half_open recovery) */
  successCount: number;
  /** Number of failures before circuit trips */
  failureThreshold: number;
  /** Timestamp of last recorded failure */
  lastFailureAt: string | null;
  /** Timestamp of last recorded success */
  lastSuccessAt: string | null;
  /** Timestamp of last state change */
  stateChangedAt: string | null;
  /** Whether attempts are currently allowed (computed from state) */
  canAttempt: boolean;
  /** Reset timeout in milliseconds for OPEN -> HALF_OPEN transition */
  resetTimeoutMs: number;
}
