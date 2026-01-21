/**
 * CircuitBreakerRepository - Repository pattern for circuit breaker state persistence
 *
 * Provides data access layer for circuit breaker states with graceful degradation.
 * All methods handle database errors gracefully - logging errors but never throwing.
 * This ensures the circuit breaker system never crashes the application.
 *
 * @module storage/repositories/circuit-breaker-repo
 */

import type { Knex } from 'knex';
import type {
  CircuitBreakerState,
  CircuitDefinition,
  CircuitStateUpdate,
} from '../../types/circuit-breaker.js';

/**
 * Database row representation for circuit_breaker_state table
 */
interface CircuitBreakerRow {
  id: number;
  circuit_id: string;
  circuit_type: string;
  state: string;
  default_state: string;
  description: string | null;
  failure_count: number;
  success_count: number;
  failure_threshold: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  state_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Repository for circuit breaker state persistence with graceful degradation
 *
 * All methods handle database errors gracefully:
 * - Read operations return null/empty arrays on errors
 * - Write operations log errors but don't throw
 * - Application continues to function without database
 *
 * @example
 * ```typescript
 * const repository = new CircuitBreakerRepository(knex);
 *
 * // Initialize a circuit (idempotent - won't overwrite)
 * await repository.initializeCircuit({
 *   circuitId: 'PROVIDER_OPENAI',
 *   circuitType: 'provider',
 *   defaultState: 'on',
 * });
 *
 * // Get circuit state (returns null if not found or on error)
 * const state = await repository.getState('PROVIDER_OPENAI');
 *
 * // Record failure and get new count
 * const failureCount = await repository.recordFailure('PROVIDER_OPENAI');
 * ```
 */
export class CircuitBreakerRepository {
  private knex: Knex;

  constructor(knex: Knex) {
    this.knex = knex;
  }

  /**
   * Get circuit state by ID
   * Returns null if circuit doesn't exist or on database error
   *
   * @param circuitId - Unique circuit identifier
   * @returns Circuit state or null
   */
  async getState(circuitId: string): Promise<CircuitBreakerState | null> {
    try {
      const row = await this.knex<CircuitBreakerRow>('circuit_breaker_state')
        .where('circuit_id', circuitId)
        .first();

      console.log(`[DEBUG] getState ${circuitId}: row.state=${row?.state}`);

      if (!row) {
        return null;
      }

      return this.mapRowToState(row);
    } catch (error) {
      console.warn('Failed to get circuit state:', error);
      return null;
    }
  }

  /**
   * Update circuit state with partial update
   * Does not throw on error - logs and continues
   *
   * @param circuitId - Circuit to update
   * @param update - Partial state update
   */
  async setState(circuitId: string, update: CircuitStateUpdate): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (update.state !== undefined) {
        updateData.state = update.state;
      }
      if (update.failureCount !== undefined) {
        updateData.failure_count = update.failureCount;
      }
      if (update.successCount !== undefined) {
        updateData.success_count = update.successCount;
      }
      if (update.lastFailureAt !== undefined) {
        updateData.last_failure_at = update.lastFailureAt;
      }
      if (update.lastSuccessAt !== undefined) {
        updateData.last_success_at = update.lastSuccessAt;
      }
      if (update.stateChangedAt !== undefined) {
        updateData.state_changed_at = update.stateChangedAt;
      }

      const rowsAffected = await this.knex('circuit_breaker_state')
        .where('circuit_id', circuitId)
        .update(updateData);
      console.log(
        `[DEBUG] setState ${circuitId}: rows affected=${rowsAffected}, updateData=`,
        JSON.stringify(updateData)
      );
    } catch (error) {
      console.warn('Failed to set circuit state:', error);
    }
  }

  /**
   * Get all circuit states
   * Returns empty array on database error
   *
   * @returns Array of all circuit states
   */
  async getAllStates(): Promise<CircuitBreakerState[]> {
    try {
      const rows = await this.knex<CircuitBreakerRow>('circuit_breaker_state').select('*');
      return rows.map(row => this.mapRowToState(row));
    } catch (error) {
      console.warn('Failed to get all circuit states:', error);
      return [];
    }
  }

  /**
   * Initialize a circuit if it doesn't exist
   * Idempotent - will not modify existing circuits
   *
   * @param circuit - Circuit definition
   */
  async initializeCircuit(circuit: CircuitDefinition): Promise<void> {
    try {
      await this.knex('circuit_breaker_state')
        .insert({
          circuit_id: circuit.circuitId,
          circuit_type: circuit.circuitType,
          state: circuit.defaultState,
          default_state: circuit.defaultState,
          description: circuit.description ?? null,
          failure_threshold: circuit.failureThreshold ?? 5,
          failure_count: 0,
          success_count: 0,
        })
        .onConflict('circuit_id')
        .ignore();
    } catch (error) {
      console.warn('Failed to initialize circuit:', error);
    }
  }

  /**
   * Record a failure for a circuit
   * Increments failure count and updates last_failure_at
   *
   * @param circuitId - Circuit to record failure for
   * @returns New failure count (0 on error or if circuit not found)
   */
  async recordFailure(circuitId: string): Promise<number> {
    try {
      const now = new Date().toISOString();

      await this.knex('circuit_breaker_state')
        .where('circuit_id', circuitId)
        .update({
          failure_count: this.knex.raw('failure_count + 1'),
          last_failure_at: now,
          updated_at: now,
        });

      const state = await this.getState(circuitId);
      return state?.failureCount ?? 0;
    } catch (error) {
      console.warn('Failed to record failure:', error);
      return 0;
    }
  }

  /**
   * Record a success for a circuit
   * Increments success count and updates last_success_at
   *
   * @param circuitId - Circuit to record success for
   * @returns New success count (0 on error or if circuit not found)
   */
  async recordSuccess(circuitId: string): Promise<number> {
    try {
      const now = new Date().toISOString();

      await this.knex('circuit_breaker_state')
        .where('circuit_id', circuitId)
        .update({
          success_count: this.knex.raw('success_count + 1'),
          last_success_at: now,
          updated_at: now,
        });

      const state = await this.getState(circuitId);
      return state?.successCount ?? 0;
    } catch (error) {
      console.warn('Failed to record success:', error);
      return 0;
    }
  }

  /**
   * Reset failure and success counters to 0
   * Does not affect timestamps or state
   *
   * @param circuitId - Circuit to reset
   */
  async resetCounters(circuitId: string): Promise<void> {
    try {
      await this.knex('circuit_breaker_state').where('circuit_id', circuitId).update({
        failure_count: 0,
        success_count: 0,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Failed to reset counters:', error);
    }
  }

  /**
   * Map database row to CircuitBreakerState interface
   */
  private mapRowToState(row: CircuitBreakerRow): CircuitBreakerState {
    return {
      id: row.id,
      circuitId: row.circuit_id,
      circuitType: row.circuit_type as 'manual' | 'provider',
      state: row.state as 'on' | 'off' | 'half_open',
      defaultState: row.default_state as 'on' | 'off' | 'half_open',
      description: row.description,
      failureCount: row.failure_count,
      successCount: row.success_count,
      failureThreshold: row.failure_threshold,
      lastFailureAt: row.last_failure_at,
      lastSuccessAt: row.last_success_at,
      stateChangedAt: row.state_changed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
