/**
 * Circuit CLI Commands
 *
 * Commands for querying and controlling circuit breaker states.
 * Provides status display, on/off toggling, and reset functionality.
 *
 * These commands use lightweight initialization (database only) instead of
 * full bootstrap to avoid starting the web server, scheduler, and HA client.
 *
 * Exception: SLEEP_MODE circuit uses full bootstrap to enable content generation
 * when toggling sleep mode on/off.
 *
 * @module cli/commands/circuit
 */

import { getKnexInstance, closeKnexInstance } from '../../storage/knex.js';
import { CircuitBreakerService } from '../../services/circuit-breaker-service.js';
import { CircuitBreakerRepository } from '../../storage/repositories/circuit-breaker-repo.js';
import type { CircuitBreakerState } from '../../types/circuit-breaker.js';
import { bootstrap, type BootstrapResult } from '../../bootstrap.js';
import { log, warn } from '../../utils/logger.js';

/**
 * Options for circuit:on and circuit:off commands
 */
interface CircuitToggleOptions {
  circuitId: string;
}

/**
 * Options for circuit:reset command
 */
interface CircuitResetOptions {
  circuitId: string;
}

/**
 * Options for circuit:watch command
 */
export interface CircuitWatchOptions {
  /** Refresh interval in milliseconds (default: 2000) */
  interval?: number;
  /** Output in JSON format instead of human-readable */
  json?: boolean;
  /** Maximum iterations before exiting (for testing, undefined = infinite) */
  maxIterations?: number;
}

/**
 * Format circuit state for display with color indication
 */
function formatState(state: string): string {
  switch (state) {
    case 'on':
      return 'ON (enabled)';
    case 'off':
      return 'OFF (disabled)';
    case 'half_open':
      return 'HALF_OPEN (testing)';
    default:
      return state.toUpperCase();
  }
}

/**
 * Format circuit type for display
 */
function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Display a single circuit row in the status table
 */
function displayCircuitRow(circuit: CircuitBreakerState): void {
  const id = circuit.circuitId.padEnd(20);
  const type = formatType(circuit.circuitType).padEnd(10);
  const state = formatState(circuit.state).padEnd(18);
  const defaultState = circuit.defaultState.toUpperCase().padEnd(10);

  console.log(`  ${id} ${type} ${state} ${defaultState}`);

  // Show additional info for provider circuits
  if (circuit.circuitType === 'provider') {
    const failureInfo = `    Failures: ${circuit.failureCount}/${circuit.failureThreshold}`;
    const successInfo = `Successes: ${circuit.successCount}`;
    const lastFailure = circuit.lastFailureAt
      ? `Last failure: ${new Date(circuit.lastFailureAt).toLocaleString()}`
      : 'No failures recorded';

    console.log(`    ${failureInfo}  ${successInfo}  ${lastFailure}`);
  }
}

/**
 * Circuit status command - displays all circuit breaker states
 *
 * Lists all circuits with their current state, type, default state,
 * and for provider circuits, additional failure/success information.
 *
 * Uses lightweight initialization (database only) - does not start
 * web server, scheduler, or Home Assistant client.
 *
 * @example
 * ```bash
 * npm run circuit:status
 * ```
 */
export async function circuitStatusCommand(): Promise<void> {
  const knex = getKnexInstance();

  try {
    const repository = new CircuitBreakerRepository(knex);
    const circuitBreaker = new CircuitBreakerService(repository);
    await circuitBreaker.initialize();

    const circuits = await circuitBreaker.getAllCircuits();

    console.log('');
    console.log('='.repeat(70));
    console.log('                    Circuit Breaker Status');
    console.log('='.repeat(70));
    console.log('');

    if (circuits.length === 0) {
      console.log('  No circuits found in the system.');
      console.log('');
      return;
    }

    // Display header
    console.log('  ' + 'ID'.padEnd(20) + 'Type'.padEnd(10) + 'State'.padEnd(18) + 'Default');
    console.log('  ' + '-'.repeat(66));

    // Group circuits by type
    const manualCircuits = circuits.filter(c => c.circuitType === 'manual');
    const providerCircuits = circuits.filter(c => c.circuitType === 'provider');

    if (manualCircuits.length > 0) {
      console.log('');
      console.log('  -- Manual Circuits --');
      manualCircuits.forEach(displayCircuitRow);
    }

    if (providerCircuits.length > 0) {
      console.log('');
      console.log('  -- Provider Circuits --');
      providerCircuits.forEach(displayCircuitRow);
    }

    console.log('');
    console.log('='.repeat(70));
    console.log(`  Total: ${circuits.length} circuit${circuits.length === 1 ? '' : 's'}`);
    console.log('='.repeat(70));
    console.log('');
  } finally {
    await closeKnexInstance();
  }
}

/**
 * Circuit on command - enables a circuit (turns it ON)
 *
 * Sets the specified circuit state to 'on', allowing traffic to flow.
 *
 * Uses lightweight initialization (database only) - does not start
 * web server, scheduler, or Home Assistant client.
 *
 * Exception: SLEEP_MODE circuit uses full bootstrap to display wakeup greeting
 * when exiting sleep mode.
 *
 * @param options - Command options containing circuitId
 *
 * @example
 * ```bash
 * npm run circuit:on -- MASTER
 * npm run circuit:on -- SLEEP_MODE  # Enters sleep mode (display art, block updates)
 * ```
 */
export async function circuitOnCommand(options: CircuitToggleOptions): Promise<void> {
  // SLEEP_MODE uses inverted semantics: ON = enter sleep, OFF = wake up
  if (options.circuitId === 'SLEEP_MODE') {
    await enterSleepMode();
    return;
  }

  const knex = getKnexInstance();

  try {
    const repository = new CircuitBreakerRepository(knex);
    const circuitBreaker = new CircuitBreakerService(repository);
    await circuitBreaker.initialize();

    // Validate circuit exists
    const circuit = await circuitBreaker.getCircuitStatus(options.circuitId);
    if (!circuit) {
      console.error(`Error: Circuit '${options.circuitId}' not found`);
      return;
    }

    await circuitBreaker.setCircuitState(options.circuitId, 'on');
    console.log(`Circuit '${options.circuitId}' has been turned ON (enabled)`);
  } finally {
    await closeKnexInstance();
  }
}

/**
 * Exit sleep mode (wake up) with full bootstrap
 *
 * Called by `circuit:off SLEEP_MODE` (inverted semantics)
 *
 * When waking up from sleep mode:
 * 1. Unblock the circuit FIRST (allow content generation)
 * 2. Display wakeup greeting using WakeupGreetingGenerator
 *
 * Uses full bootstrap to access ContentOrchestrator for content generation.
 */
async function exitSleepMode(): Promise<void> {
  let scheduler: BootstrapResult['scheduler'] | null = null;
  let haClient: BootstrapResult['haClient'] = null;
  let knex: BootstrapResult['knex'] = null;

  try {
    log('Waking up from sleep mode...');

    // Full bootstrap to access orchestrator for content generation
    const {
      orchestrator,
      circuitBreaker,
      scheduler: bootstrapScheduler,
      haClient: bootstrapHaClient,
      knex: bootstrapKnex,
    } = await bootstrap();
    scheduler = bootstrapScheduler;
    haClient = bootstrapHaClient;
    knex = bootstrapKnex;

    // Validate circuit exists
    if (!circuitBreaker) {
      console.error('Error: Circuit breaker service not available');
      return;
    }

    const circuit = await circuitBreaker.getCircuitStatus('SLEEP_MODE');
    if (!circuit) {
      console.error("Error: Circuit 'SLEEP_MODE' not found");
      return;
    }

    // Step 1: Unblock the circuit FIRST (allow content generation)
    await circuitBreaker.setCircuitState('SLEEP_MODE', 'on');
    log('Sleep mode disabled - updates now allowed');

    // Step 2: Display wakeup greeting
    try {
      const result = await orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
        generatorId: 'wakeup-greeting-generator',
      });
      if (result.success) {
        log('Wakeup greeting displayed successfully');
      } else {
        warn('Wakeup greeting not displayed:', result.blockReason ?? 'unknown');
      }
    } catch (error) {
      warn('Failed to display wakeup greeting:', error);
      // Circuit is already unblocked, so normal content updates can resume
    }

    console.log('Sleep mode is now OFF - wakeup greeting displayed, regular updates will resume');
  } finally {
    await cleanupBootstrapResources(scheduler, haClient, knex);
  }
}

/**
 * Circuit off command - disables a circuit (turns it OFF)
 *
 * Sets the specified circuit state to 'off', blocking traffic.
 *
 * Uses lightweight initialization (database only) - does not start
 * web server, scheduler, or Home Assistant client.
 *
 * Exception: SLEEP_MODE circuit uses full bootstrap to display sleep art
 * before entering sleep mode.
 *
 * @param options - Command options containing circuitId
 *
 * @example
 * ```bash
 * npm run circuit:off -- MASTER
 * npm run circuit:off -- SLEEP_MODE  # Exits sleep mode (wake up, display greeting)
 * ```
 */
export async function circuitOffCommand(options: CircuitToggleOptions): Promise<void> {
  // SLEEP_MODE uses inverted semantics: ON = enter sleep, OFF = wake up
  if (options.circuitId === 'SLEEP_MODE') {
    await exitSleepMode();
    return;
  }

  const knex = getKnexInstance();

  try {
    const repository = new CircuitBreakerRepository(knex);
    const circuitBreaker = new CircuitBreakerService(repository);
    await circuitBreaker.initialize();

    // Validate circuit exists
    const circuit = await circuitBreaker.getCircuitStatus(options.circuitId);
    if (!circuit) {
      console.error(`Error: Circuit '${options.circuitId}' not found`);
      return;
    }

    await circuitBreaker.setCircuitState(options.circuitId, 'off');
    console.log(`Circuit '${options.circuitId}' has been turned OFF (disabled)`);
  } finally {
    await closeKnexInstance();
  }
}

/**
 * Enter sleep mode with full bootstrap
 *
 * Called by `circuit:on SLEEP_MODE` (inverted semantics)
 *
 * When entering sleep mode:
 * 1. Display sleep art using SleepModeGenerator FIRST
 * 2. Block the circuit (prevent subsequent updates)
 *
 * Uses full bootstrap to access ContentOrchestrator for content generation.
 */
async function enterSleepMode(): Promise<void> {
  let scheduler: BootstrapResult['scheduler'] | null = null;
  let haClient: BootstrapResult['haClient'] = null;
  let knex: BootstrapResult['knex'] = null;

  try {
    log('Entering sleep mode...');

    // Full bootstrap to access orchestrator for content generation
    const {
      orchestrator,
      circuitBreaker,
      scheduler: bootstrapScheduler,
      haClient: bootstrapHaClient,
      knex: bootstrapKnex,
    } = await bootstrap();
    scheduler = bootstrapScheduler;
    haClient = bootstrapHaClient;
    knex = bootstrapKnex;

    // Validate circuit exists
    if (!circuitBreaker) {
      console.error('Error: Circuit breaker service not available');
      return;
    }

    const circuit = await circuitBreaker.getCircuitStatus('SLEEP_MODE');
    if (!circuit) {
      console.error("Error: Circuit 'SLEEP_MODE' not found");
      return;
    }

    // Step 1: Display sleep art BEFORE blocking
    try {
      const result = await orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
        generatorId: 'sleep-mode-generator',
      });
      if (result.success) {
        log('Sleep mode art displayed successfully');
      } else {
        warn('Sleep mode art not displayed:', result.blockReason ?? 'unknown');
      }
    } catch (error) {
      warn('Failed to display sleep mode art:', error);
      // Continue to set circuit state even if content generation fails
    }

    // Step 2: Block the circuit (prevent subsequent updates)
    await circuitBreaker.setCircuitState('SLEEP_MODE', 'off');
    log('Sleep mode enabled - updates now blocked');

    console.log('Sleep mode is now ON - goodnight art displayed, updates are blocked');
  } finally {
    await cleanupBootstrapResources(scheduler, haClient, knex);
  }
}

/**
 * Clean up bootstrap resources for CLI commands
 *
 * Stops scheduler, disconnects HA client, and closes Knex connection
 * to allow the CLI process to exit cleanly.
 *
 * @param scheduler - CronScheduler instance from bootstrap
 * @param haClient - HomeAssistantClient instance from bootstrap
 * @param knex - Knex instance from bootstrap
 */
async function cleanupBootstrapResources(
  scheduler: BootstrapResult['scheduler'] | null,
  haClient: BootstrapResult['haClient'],
  knex: BootstrapResult['knex']
): Promise<void> {
  // Stop scheduler to prevent dangling timers
  if (scheduler) {
    try {
      scheduler.stop();
    } catch {
      // Ignore scheduler stop errors - not critical for CLI command
    }
  }

  // Disconnect Home Assistant WebSocket to allow process to exit
  if (haClient) {
    try {
      await haClient.disconnect();
    } catch {
      // Ignore disconnect errors - not critical for CLI command
    }
  }

  // Close Knex database connection to allow process to exit
  if (knex) {
    try {
      await closeKnexInstance();
    } catch {
      // Ignore Knex close errors - not critical for CLI command
    }
  }
}

/**
 * Circuit reset command - resets a provider circuit
 *
 * Resets the specified provider circuit to ON state and clears all counters.
 * Only works on provider circuits (not manual circuits).
 *
 * Uses lightweight initialization (database only) - does not start
 * web server, scheduler, or Home Assistant client.
 *
 * @param options - Command options containing circuitId
 *
 * @example
 * ```bash
 * npm run circuit:reset -- PROVIDER_OPENAI
 * ```
 */
export async function circuitResetCommand(options: CircuitResetOptions): Promise<void> {
  const knex = getKnexInstance();

  try {
    const repository = new CircuitBreakerRepository(knex);
    const circuitBreaker = new CircuitBreakerService(repository);
    await circuitBreaker.initialize();

    // Validate circuit exists
    const circuit = await circuitBreaker.getCircuitStatus(options.circuitId);
    if (!circuit) {
      console.error(`Error: Circuit '${options.circuitId}' not found`);
      return;
    }

    // Validate it's a provider circuit
    if (circuit.circuitType !== 'provider') {
      console.error(
        `Error: Reset is only available for provider circuits. '${options.circuitId}' is a manual circuit.`
      );
      return;
    }

    await circuitBreaker.resetProviderCircuit(options.circuitId);
    console.log(`Circuit '${options.circuitId}' has been reset (state: ON, counters cleared)`);
  } finally {
    await closeKnexInstance();
  }
}

/**
 * Format relative time from a timestamp
 */
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return 'never';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

/**
 * Display a single circuit row in the watch table with optional change marker
 */
function displayWatchRow(circuit: CircuitBreakerState, changed: boolean): void {
  const id = circuit.circuitId.padEnd(20);
  const type = circuit.circuitType.padEnd(10);
  const state = circuit.state.toUpperCase().padEnd(9);
  const failures =
    circuit.circuitType === 'provider'
      ? `${circuit.failureCount}/${circuit.failureThreshold}`.padEnd(10)
      : '-'.padEnd(10);
  const lastChange = formatRelativeTime(circuit.stateChangedAt).padEnd(13);
  const marker = changed ? '[CHANGED]' : '';

  console.log(`${id} ${type} ${state} ${failures} ${lastChange} ${marker}`);
}

/**
 * Display circuits in JSON format for machine consumption
 */
function displayJsonOutput(circuits: CircuitBreakerState[]): void {
  const output = {
    timestamp: new Date().toISOString(),
    circuits: circuits.map(c => ({
      circuitId: c.circuitId,
      circuitType: c.circuitType,
      state: c.state,
      failureCount: c.failureCount,
      failureThreshold: c.failureThreshold,
      lastFailureAt: c.lastFailureAt,
      lastSuccessAt: c.lastSuccessAt,
      stateChangedAt: c.stateChangedAt,
    })),
  };
  console.log(JSON.stringify(output));
}

/**
 * Display circuits in human-readable table format
 */
function displayHumanOutput(
  circuits: CircuitBreakerState[],
  previousStates: Map<string, string>,
  interval: number
): void {
  console.clear();
  console.log(`Circuit Breaker Status (refreshing every ${interval / 1000}s, Ctrl+C to exit)`);
  console.log('\u2500'.repeat(72));
  console.log(
    'ID'.padEnd(20) +
      ' ' +
      'TYPE'.padEnd(10) +
      ' ' +
      'STATE'.padEnd(9) +
      ' ' +
      'FAILURES'.padEnd(10) +
      ' ' +
      'LAST CHANGE'
  );

  for (const circuit of circuits) {
    const previousState = previousStates.get(circuit.circuitId);
    const changed = previousState !== undefined && previousState !== circuit.state;
    displayWatchRow(circuit, changed);
  }
}

/**
 * Circuit watch command - displays real-time circuit breaker status
 *
 * Provides continuous monitoring of circuit breaker states with
 * configurable refresh interval and change detection.
 *
 * Uses lightweight initialization (database only) - does not start
 * web server, scheduler, or Home Assistant client.
 *
 * @param options - Command options
 *
 * @example
 * ```bash
 * npm run circuit:watch
 * npm run circuit:watch -- --interval 5000
 * npm run circuit:watch -- --json
 * ```
 */
export async function circuitWatchCommand(options: CircuitWatchOptions = {}): Promise<void> {
  const interval = options.interval ?? 2000;
  const isJson = options.json ?? false;
  const maxIterations = options.maxIterations;

  let running = true;
  let iteration = 0;
  const previousStates: Map<string, string> = new Map();

  const cleanup = async (): Promise<void> => {
    running = false;
    await closeKnexInstance();
  };

  // Register SIGINT handler for graceful shutdown
  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  const knex = getKnexInstance();

  try {
    const repository = new CircuitBreakerRepository(knex);
    const circuitBreaker = new CircuitBreakerService(repository);
    await circuitBreaker.initialize();

    while (running) {
      const circuits = await circuitBreaker.getAllCircuits();

      if (isJson) {
        displayJsonOutput(circuits);
      } else {
        displayHumanOutput(circuits, previousStates, interval);
      }

      // Update previous states for change detection
      for (const circuit of circuits) {
        previousStates.set(circuit.circuitId, circuit.state);
      }

      iteration++;

      // Check if we've reached max iterations (for testing)
      if (maxIterations !== undefined && iteration >= maxIterations) {
        break;
      }

      // Wait for next refresh interval
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  } finally {
    await cleanup();
  }
}
