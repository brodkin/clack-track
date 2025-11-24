/**
 * test-ha CLI Command
 *
 * Tests Home Assistant connectivity and provides entity inspection tools.
 * Supports connection validation, entity listing, and event watching.
 *
 * @module cli/commands/test-ha
 */

import { HomeAssistantClient } from '../../api/data-sources/home-assistant.js';
import type { HomeAssistantConnectionConfig } from '../../types/home-assistant.js';

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

/**
 * Options for the test-ha command
 */
export interface TestHAOptions {
  /**
   * List all entities
   */
  list?: boolean;

  /**
   * Get specific entity state
   */
  entity?: string;

  /**
   * Subscribe to events for 30 seconds
   */
  watch?: string;
}

/**
 * Format colored output for success messages
 */
function success(message: string): string {
  return `${colors.green}✓${colors.reset} ${message}`;
}

/**
 * Format colored output for error messages
 */
function error(message: string): string {
  return `${colors.red}✗${colors.reset} ${message}`;
}

/**
 * Format colored output for info messages
 */
function info(message: string): string {
  return `${colors.cyan}ℹ${colors.reset} ${message}`;
}

/**
 * Format colored output for warning messages
 */
function warning(message: string): string {
  return `${colors.yellow}⚠${colors.reset} ${message}`;
}

/**
 * Test Home Assistant connectivity and functionality
 *
 * This command validates that Home Assistant is properly configured and can:
 * 1. Establish a WebSocket connection using access token
 * 2. List all entities (with --list flag)
 * 3. Query specific entity states (with --entity flag)
 * 4. Subscribe to events (with --watch flag)
 *
 * @param options - Command configuration options
 * @returns Promise that resolves when testing is complete
 *
 * @example
 * ```typescript
 * // Test connection only
 * await testHACommand({});
 *
 * // List all entities
 * await testHACommand({ list: true });
 *
 * // Get specific entity state
 * await testHACommand({ entity: 'light.living_room' });
 *
 * // Watch state_changed events for 30 seconds
 * await testHACommand({ watch: 'state_changed' });
 * ```
 */
export async function testHACommand(options: TestHAOptions): Promise<void> {
  console.log('\n🏠 Home Assistant Connectivity Test\n');

  // Validate environment variables
  const url = process.env.HA_URL;
  const token = process.env.HA_TOKEN;

  if (!url || !token) {
    console.error(error('Missing required environment variables'));
    console.error('  Please set the following:');
    if (!url) {
      console.error(
        `    ${colors.dim}HA_URL${colors.reset}     - WebSocket URL (e.g., ws://homeassistant.local:8123/api/websocket)`
      );
    }
    if (!token) {
      console.error(`    ${colors.dim}HA_TOKEN${colors.reset}   - Long-lived access token`);
    }
    console.error('\n  Get a token from: Home Assistant → Profile → Long-Lived Access Tokens\n');
    return;
  }

  // Create client with configuration
  const config: HomeAssistantConnectionConfig = {
    url,
    token,
    reconnection: {
      enabled: false, // Disable for testing
    },
  };

  const client = new HomeAssistantClient(config);

  try {
    // Step 1: Connect
    await testConnection(client);

    // Step 2: Execute requested operation
    if (options.list) {
      await listEntities(client);
    } else if (options.entity) {
      await getEntityState(client, options.entity);
    } else if (options.watch) {
      await watchEvents(client, options.watch);
    }

    console.log(`\n${success('Testing complete')}\n`);
  } catch (err) {
    handleError(err);
  } finally {
    // Always disconnect
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  }
}

/**
 * Test connection to Home Assistant
 */
async function testConnection(client: HomeAssistantClient): Promise<void> {
  console.log('1. Testing connection...');

  try {
    const startTime = Date.now();
    await client.connect();
    const duration = Date.now() - startTime;

    console.log(`   ${success(`Connected successfully (${duration}ms)`)}`);

    // Validate connection
    const validation = await client.validateConnection();
    if (validation.success) {
      const latency = validation.latencyMs ? ` (latency: ${validation.latencyMs}ms)` : '';
      console.log(`   ${success(`Connection validated${latency}`)}`);
    } else {
      console.error(`   ${error('Connection validation failed')}`);
      if (validation.message) {
        console.error(`   ${validation.message}`);
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`   ${error('Connection failed')}`);
    console.error(`   ${errorMessage}`);

    // Provide helpful diagnostics
    if (
      errorMessage.includes('authentication') ||
      errorMessage.includes('auth') ||
      errorMessage.includes('401')
    ) {
      console.error(`\n   ${warning('Authentication issue detected:')}`);
      console.error('   • Check that HA_TOKEN is a valid long-lived access token');
      console.error('   • Verify the token has not been revoked or expired');
      console.error('   • Create a new token from: Profile → Long-Lived Access Tokens\n');
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
      console.error(`\n   ${warning('Connection issue detected:')}`);
      console.error('   • Check that Home Assistant is running');
      console.error(
        '   • Verify HA_URL is correct (e.g., ws://homeassistant.local:8123/api/websocket)'
      );
      console.error('   • Ensure port 8123 is accessible from this machine\n');
    } else {
      console.error(`\n   ${warning('Troubleshooting:')}`);
      console.error('   • Verify environment variables are set correctly');
      console.error('   • Check Home Assistant logs for errors');
      console.error('   • Ensure WebSocket API is enabled\n');
    }

    throw err;
  }
}

/**
 * List all entities from Home Assistant
 */
async function listEntities(client: HomeAssistantClient): Promise<void> {
  console.log('\n2. Listing all entities...');

  try {
    const states = await client.getAllStates();

    if (states.length === 0) {
      console.log(`   ${info('No entities found')}`);
      return;
    }

    console.log(`   ${success(`Found ${states.length} entities`)}\n`);

    // Group entities by domain
    const byDomain = new Map<string, typeof states>();
    for (const state of states) {
      const domain = state.entity_id.split('.')[0];
      if (!byDomain.has(domain)) {
        byDomain.set(domain, []);
      }
      byDomain.get(domain)!.push(state);
    }

    // Display entities grouped by domain
    for (const [domain, domainStates] of Array.from(byDomain.entries()).sort()) {
      console.log(`   ${colors.cyan}${domain}${colors.reset} (${domainStates.length})`);
      for (const state of domainStates.slice(0, 5)) {
        const stateValue = state.state.length > 20 ? state.state.slice(0, 20) + '...' : state.state;
        console.log(`     ${colors.dim}${state.entity_id}${colors.reset} = ${stateValue}`);
      }
      if (domainStates.length > 5) {
        console.log(`     ${colors.dim}... and ${domainStates.length - 5} more${colors.reset}`);
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`   ${error('Failed to list entities')}`);
    console.error(`   ${errorMessage}`);
    throw err;
  }
}

/**
 * Get state of a specific entity
 */
async function getEntityState(client: HomeAssistantClient, entityId: string): Promise<void> {
  console.log(`\n2. Getting state for entity: ${colors.cyan}${entityId}${colors.reset}\n`);

  try {
    const state = await client.getState(entityId);

    console.log(`   ${success('Entity found')}\n`);
    console.log(`   Entity ID:    ${colors.cyan}${state.entity_id}${colors.reset}`);
    console.log(`   State:        ${colors.green}${state.state}${colors.reset}`);
    console.log(`   Last Updated: ${state.last_updated}`);
    console.log(`   Last Changed: ${state.last_changed}`);

    // Display attributes if present
    const attributes = state.attributes;
    if (attributes && Object.keys(attributes).length > 0) {
      console.log(`\n   Attributes:`);
      for (const [key, value] of Object.entries(attributes)) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        const truncated = valueStr.length > 50 ? valueStr.slice(0, 50) + '...' : valueStr;
        console.log(`     ${colors.dim}${key}${colors.reset} = ${truncated}`);
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`   ${error('Failed to get entity state')}`);
    console.error(`   ${errorMessage}`);

    if (errorMessage.includes('not found')) {
      console.error(`\n   ${warning('Entity not found. Use --list to see available entities.')}\n`);
    }

    throw err;
  }
}

/**
 * Watch events for 30 seconds
 */
async function watchEvents(client: HomeAssistantClient, eventType: string): Promise<void> {
  console.log(`\n2. Watching events: ${colors.cyan}${eventType}${colors.reset}`);
  console.log(`   ${info('Listening for 30 seconds... (press Ctrl+C to stop)')}\n`);

  let eventCount = 0;
  const startTime = Date.now();

  try {
    // Subscribe to events
    const unsubscribe = await client.subscribeToEvents(eventType, event => {
      eventCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   [${elapsed}s] ${colors.green}Event received${colors.reset}`);

      // Display event data
      const eventData = JSON.stringify(event, null, 2)
        .split('\n')
        .map(line => `     ${colors.dim}${line}${colors.reset}`)
        .join('\n');
      console.log(eventData);
    });

    // Wait for 30 seconds using setTimeout
    await new Promise<void>(resolve => {
      setTimeout(resolve, 30000);
    });

    // Unsubscribe from events
    unsubscribe();

    console.log(`\n   ${success(`Received ${eventCount} events in 30 seconds`)}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`   ${error('Failed to watch events')}`);
    console.error(`   ${errorMessage}`);
    throw err;
  }
}

/**
 * Handle and format errors
 */
function handleError(err: unknown): void {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error(`\n${error('Test failed')}`);
  console.error(`${errorMessage}\n`);
}
