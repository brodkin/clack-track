# Home Assistant Client API Reference

This document provides detailed API documentation for the `HomeAssistantClient` class used in Clack Track for event-driven content updates.

## Overview

`HomeAssistantClient` manages WebSocket connections to Home Assistant using long-lived access tokens. It provides:

- Connection management with automatic reconnection
- Event subscription system (multiple subscribers per event type)
- State query methods with optional caching
- Service call methods for device control
- Graceful degradation on connection failures

**File**: `src/api/data-sources/home-assistant.ts`

## Connection Management

### connect()

Establishes WebSocket connection to Home Assistant.

```typescript
await client.connect();
```

**Throws**:

- `HAAuthenticationError` - Invalid or expired access token
- `ConnectionError` - WebSocket connection failed

### disconnect()

Gracefully disconnects and cleans up all resources.

```typescript
await client.disconnect();
```

- Unsubscribes all event listeners
- Clears state cache
- Cancels pending reconnection attempts

### isConnected()

Check current connection status.

```typescript
const connected: boolean = client.isConnected();
```

### validateConnection()

Validates connection and measures latency.

```typescript
const result: ValidationResult = await client.validateConnection();
// Returns: { success: boolean, message: string, latencyMs?: number }
```

## Event Subscriptions

### subscribeToEvents(eventType, callback)

Subscribe to Home Assistant events. Supports multiple subscribers per event type.

```typescript
const unsubscribe = await client.subscribeToEvents('state_changed', event => {
  console.log('Entity changed:', event.data.entity_id);
  console.log('New state:', event.data.new_state.state);
  console.log('Old state:', event.data.old_state.state);
});

// Later: unsubscribe this specific callback
unsubscribe();
```

**Parameters**:

- `eventType` (string) - Event type to subscribe to (e.g., `'state_changed'`)
- `callback` (EventCallback) - Function called when event received

**Returns**: `UnsubscribeFunction` - Function to unsubscribe this specific callback

**Throws**:

- `Error` - If not connected
- `SubscriptionError` - If subscription fails

### unsubscribeFromEvents(eventType)

Unsubscribe all callbacks for a specific event type.

```typescript
client.unsubscribeFromEvents('state_changed');
```

### Multiple Subscribers Example

```typescript
// Handler 1: Log all changes
const unsubscribe1 = await client.subscribeToEvents('state_changed', event => {
  console.log('State changed:', event.data.entity_id);
});

// Handler 2: Trigger updates for specific entities
const unsubscribe2 = await client.subscribeToEvents('state_changed', event => {
  if (event.data.entity_id.startsWith('binary_sensor.')) {
    triggerUpdate();
  }
});

// Each can unsubscribe independently
unsubscribe1(); // Handler 2 still active
unsubscribe2(); // Both unsubscribed
```

## State Queries

### getState(entityId)

Get current state of a specific entity.

```typescript
const lightState = await client.getState('light.living_room');
console.log(`Light is ${lightState.state}`);
console.log(`Brightness: ${lightState.attributes.brightness}`);
```

**Parameters**:

- `entityId` (string) - Entity ID to query (e.g., `'light.living_room'`)

**Returns**: `Promise<HassEntityState>` - Current state of the entity

**Throws**:

- `Error` - If not connected
- `StateQueryError` - If entity not found or query fails

### getAllStates()

Get current state of all entities.

```typescript
const allStates = await client.getAllStates();
const lights = allStates.filter(s => s.entity_id.startsWith('light.'));
console.log(`Found ${lights.length} lights`);
```

**Returns**: `Promise<HassEntityState[]>` - Array of all entity states

**Throws**:

- `Error` - If not connected
- `StateQueryError` - If query fails

### State Caching Example

```typescript
// Enable caching for performance
const client = new HomeAssistantClient({
  url: process.env.HOME_ASSISTANT_URL!,
  token: process.env.HOME_ASSISTANT_TOKEN!,
  stateCache: {
    enabled: true,
    ttlMs: 5000, // 5 second cache
  },
});

await client.connect();

// First call queries Home Assistant
const state1 = await client.getState('sensor.temperature'); // Network call

// Second call within 5s returns cached value
const state2 = await client.getState('sensor.temperature'); // Cached

// After 5s, cache expires and fresh query is made
await new Promise(resolve => setTimeout(resolve, 5000));
const state3 = await client.getState('sensor.temperature'); // Network call
```

## Service Calls

### callService(domain, service, serviceData?)

Call a Home Assistant service to control devices.

```typescript
// Turn on a light with brightness
await client.callService('light', 'turn_on', {
  entity_id: 'light.living_room',
  brightness: 255,
  color_temp: 400,
});

// Turn off a switch
await client.callService('switch', 'turn_off', {
  entity_id: 'switch.coffee_maker',
});
```

**Parameters**:

- `domain` (string) - Service domain (e.g., `'light'`, `'switch'`)
- `service` (string) - Service name (e.g., `'turn_on'`, `'turn_off'`)
- `serviceData` (Record<string, unknown>, optional) - Parameters for the service

**Returns**: `Promise<ServiceCallResponse | null>` - Service call response or null

**Throws**:

- `Error` - If not connected or invalid parameters
- `ServiceCallError` - If service call fails

## Configuration Options

### Constructor Configuration

```typescript
const client = new HomeAssistantClient({
  url: 'ws://homeassistant.local:8123/api/websocket',
  token: 'your-long-lived-token',

  // Reconnection settings (optional)
  reconnection: {
    enabled: true,
    maxAttempts: 10,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },

  // State cache settings (optional)
  stateCache: {
    enabled: true,
    ttlMs: 5000, // Cache states for 5 seconds
  },

  // Logger (optional, defaults to console)
  logger: customLogger,

  // Debug mode (optional, defaults to false)
  debug: true,
});
```

### Environment Variables

From `.env.example`:

- `HOME_ASSISTANT_URL` - WebSocket URL (typically `ws://homeassistant.local:8123/api/websocket`)
- `HOME_ASSISTANT_TOKEN` - Long-lived access token from HA profile
- `HA_RECONNECT_ENABLED` - Enable automatic reconnection (default: true)
- `HA_RECONNECT_MAX_ATTEMPTS` - Maximum reconnection attempts (default: 10)
- `HA_RECONNECT_INITIAL_DELAY` - Initial reconnection delay in ms (default: 1000)
- `HA_RECONNECT_MAX_DELAY` - Maximum reconnection delay in ms (default: 30000)
- `HA_RECONNECT_BACKOFF_MULTIPLIER` - Exponential backoff multiplier (default: 2)
- `HA_STATE_CACHE_ENABLED` - Enable state query caching (default: false)
- `HA_STATE_CACHE_TTL` - Cache time-to-live in ms (default: 5000)
- `HA_DEBUG` - Enable detailed WebSocket logging (default: false)

## Error Types

All errors extend base `Error` class and include `originalError` property for debugging.

### HAAuthenticationError

Thrown when authentication fails (invalid or expired token).

**Thrown by**: `connect()`

```typescript
try {
  await client.connect();
} catch (error) {
  if (error instanceof HAAuthenticationError) {
    console.error('Invalid Home Assistant token');
  }
}
```

### ConnectionError

Thrown when WebSocket connection fails.

**Thrown by**: `connect()`

**Properties**: `message`, `url`, `originalError`

### SubscriptionError

Thrown when event subscription fails.

**Thrown by**: `subscribeToEvents()`

**Properties**: `message`, `eventType`, `originalError`

### StateQueryError

Thrown when entity state query fails (e.g., entity not found).

**Thrown by**: `getState()`, `getAllStates()`

**Properties**: `message`, `entityId?`, `originalError`

### ServiceCallError

Thrown when service call fails.

**Thrown by**: `callService()`

**Properties**: `message`, `domain`, `service`, `originalError`

## Reconnection Behavior

The client automatically handles connection loss if reconnection is enabled:

1. Attempts reconnection with exponential backoff
2. Delay calculation: `initialDelay * (multiplier ^ attempt)`
3. Respects `maxDelayMs` cap and `maxAttempts` limit
4. Resubscribes to all events after successful reconnection
5. Logs warnings on failures, never crashes the application

```typescript
// Manual reconnection trigger (for testing)
client.triggerReconnection();

// Connection will:
// 1. Attempt reconnection with exponential backoff
// 2. Resubscribe to all events after successful reconnection
// 3. Log warnings if reconnection fails
// 4. Never crash the application
```

## Security Notes

- **Production**: Use `wss://` (WebSocket Secure) instead of `ws://` to encrypt WebSocket traffic over TLS
- **Development**: `ws://` may be used locally but is not recommended
- **Token Storage**: NEVER commit tokens to version control, use environment variables or secret managers
- **Token Rotation**: Rotate long-lived tokens periodically for security
- **TLS Requirement**: `wss://` requires a valid TLS/SSL certificate on your Home Assistant server

## Complete Usage Example

```typescript
import { HomeAssistantClient } from '@/api/data-sources/home-assistant.js';

const client = new HomeAssistantClient({
  url: process.env.HOME_ASSISTANT_URL!,
  token: process.env.HOME_ASSISTANT_TOKEN!,
  reconnection: {
    enabled: true,
    maxAttempts: 10,
  },
  stateCache: {
    enabled: true,
    ttlMs: 5000,
  },
  debug: true,
});

try {
  // Connect
  await client.connect();
  console.log('Connected to Home Assistant');

  // Subscribe to door events
  await client.subscribeToEvents('state_changed', async event => {
    const entityId = event.data.entity_id;
    if (entityId === 'binary_sensor.front_door') {
      const newState = event.data.new_state.state;
      if (newState === 'on') {
        console.log('Front door opened - triggering content update');
        // Trigger major update here
      }
    }
  });

  // Query state
  const doorState = await client.getState('binary_sensor.front_door');
  console.log(`Door is ${doorState.state}`);

  // Call service
  await client.callService('light', 'turn_on', {
    entity_id: 'light.living_room',
    brightness: 255,
  });

  // Connection lost? Auto-reconnection handles it and resubscribes events
} catch (error) {
  if (error instanceof HAAuthenticationError) {
    console.error('Invalid Home Assistant token');
  } else if (error instanceof ConnectionError) {
    console.error('Failed to connect to Home Assistant');
  }
}
```
