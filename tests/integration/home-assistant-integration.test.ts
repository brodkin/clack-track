/**
 * Home Assistant WebSocket Client Integration Tests
 *
 * Tests end-to-end integration of the Home Assistant WebSocket client.
 * Uses mocks to simulate WebSocket connections and Home Assistant API without real API calls.
 * Focuses on integration points:
 * - Full lifecycle: connect → subscribe → events → state → service → disconnect
 * - Connection management with authentication
 * - Event subscription system with multiple subscribers
 * - State query operations
 * - Service call operations
 * - Reconnection logic with exponential backoff
 * - Error handling and propagation
 * - Graceful cleanup on disconnect
 *
 * @group integration
 */

import { jest } from '@jest/globals';
import { HomeAssistantClient } from '@/api/data-sources/home-assistant';
import type {
  HomeAssistantConnectionConfig,
  HomeAssistantEvent,
  HassEntityState,
  Logger,
} from '@/types/home-assistant';
import {
  AuthenticationError,
  ConnectionError,
  StateQueryError,
  ServiceCallError,
} from '@/types/home-assistant';
import * as haWebsocket from 'home-assistant-js-websocket';

// Mock the home-assistant-js-websocket library
jest.mock('home-assistant-js-websocket');

describe('Home Assistant WebSocket Client Integration Tests', () => {
  // Enable fake timers for all tests in this suite
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Test configuration
  const testConfig: HomeAssistantConnectionConfig = {
    url: 'ws://homeassistant.local:8123/api/websocket',
    token: 'test-long-lived-token-12345',
    stateCache: {
      enabled: true,
      ttlMs: 5000,
    },
    debug: false,
  };

  // Mock connection object
  let mockConnection: {
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    close: jest.Mock;
    subscribeEvents: jest.Mock;
  };
  let eventListeners: Map<string, (event: HomeAssistantEvent) => void>;
  let unsubscribeFunctions: Map<string, () => void>;
  let subscriptionCounts: Map<string, number>;

  // Test logger to capture logs
  let mockLogger: Logger;
  let logCapture: {
    info: Array<{ message: string; context?: Record<string, unknown> }>;
    warn: Array<{ message: string; context?: Record<string, unknown> }>;
    error: Array<{ message: string; context?: Record<string, unknown> }>;
    debug: Array<{ message: string; context?: Record<string, unknown> }>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize event listeners map
    eventListeners = new Map();
    unsubscribeFunctions = new Map();
    subscriptionCounts = new Map();

    // Create mock connection with event listener support
    mockConnection = {
      addEventListener: jest.fn(
        (eventType: string, listener: (event: HomeAssistantEvent) => void) => {
          eventListeners.set(eventType, listener);
        }
      ),
      removeEventListener: jest.fn((eventType: string) => {
        eventListeners.delete(eventType);
        unsubscribeFunctions.delete(eventType);
        subscriptionCounts.delete(eventType);
      }),
      close: jest.fn(() => {
        // When connection closes, clean up all listeners
        // Call removeEventListener for each active listener to simulate cleanup
        eventListeners.forEach((_, eventType) => {
          mockConnection.removeEventListener(eventType);
        });
      }),
      subscribeEvents: jest.fn(
        (callback: (event: HomeAssistantEvent) => void, eventType: string) => {
          // Track the connection-level listener (one per event type)
          if (!eventListeners.has(eventType)) {
            eventListeners.set(eventType, callback);
            subscriptionCounts.set(eventType, 1);
          } else {
            // Increment subscription count for this event type
            subscriptionCounts.set(eventType, (subscriptionCounts.get(eventType) || 0) + 1);
          }

          // Create unsubscribe function
          const unsubscribe = () => {
            const count = subscriptionCounts.get(eventType) || 0;
            if (count <= 1) {
              // Last subscriber - remove the connection listener
              eventListeners.delete(eventType);
              unsubscribeFunctions.delete(eventType);
              subscriptionCounts.delete(eventType);
            } else {
              // Still have other subscribers - just decrement count
              subscriptionCounts.set(eventType, count - 1);
            }
          };

          unsubscribeFunctions.set(eventType, unsubscribe);
          // Return unsubscribe function wrapped in Promise
          return Promise.resolve(unsubscribe);
        }
      ),
    };

    // Initialize log capture
    logCapture = {
      info: [],
      warn: [],
      error: [],
      debug: [],
    };

    // Create mock logger
    mockLogger = {
      info: (message: string, context?: Record<string, unknown>) => {
        logCapture.info.push({ message, context });
      },
      warn: (message: string, context?: Record<string, unknown>) => {
        logCapture.warn.push({ message, context });
      },
      error: (message: string, context?: Record<string, unknown>) => {
        logCapture.error.push({ message, context });
      },
      debug: (message: string, context?: Record<string, unknown>) => {
        logCapture.debug.push({ message, context });
      },
    };

    // Setup default mock implementations
    (haWebsocket.createLongLivedTokenAuth as jest.Mock).mockReturnValue({
      access_token: testConfig.token,
    });

    (haWebsocket.createConnection as jest.Mock).mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    eventListeners.clear();
  });

  describe('Full Lifecycle Integration', () => {
    it('should complete full lifecycle: connect → subscribe → events → state → service → disconnect', async () => {
      // Arrange: Setup mock states and service responses
      const mockStates: HassEntityState[] = [
        {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: { brightness: 255 },
          last_changed: '2024-11-24T00:00:00Z',
          last_updated: '2024-11-24T00:00:00Z',
        },
        {
          entity_id: 'switch.kitchen',
          state: 'off',
          attributes: {},
          last_changed: '2024-11-24T00:00:00Z',
          last_updated: '2024-11-24T00:00:00Z',
        },
      ];

      (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);
      (haWebsocket.callService as jest.Mock).mockResolvedValue({
        context: { id: 'ctx-123', parent_id: null, user_id: null },
      });

      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });

      // Act & Assert: Step 1 - Connect
      await client.connect();
      expect(client.isConnected()).toBe(true);
      expect(haWebsocket.createConnection).toHaveBeenCalledTimes(1);

      // Act & Assert: Step 2 - Subscribe to events
      const receivedEvents: HomeAssistantEvent[] = [];
      const unsubscribe = await client.subscribeToEvents('state_changed', event => {
        receivedEvents.push(event);
      });

      expect(eventListeners.has('state_changed')).toBe(true);

      // Act & Assert: Step 3 - Receive events
      const testEvent: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: {
          entity_id: 'light.living_room',
          old_state: { state: 'off' },
          new_state: { state: 'on' },
        },
        origin: 'LOCAL',
        time_fired: '2024-11-24T00:00:00Z',
      };

      const listener = eventListeners.get('state_changed');
      listener?.(testEvent);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(testEvent);

      // Act & Assert: Step 4 - Query state
      const state = await client.getState('light.living_room');
      expect(state.entity_id).toBe('light.living_room');
      expect(state.state).toBe('on');
      expect(haWebsocket.getStates).toHaveBeenCalledTimes(1);

      // Act & Assert: Step 5 - Call service
      const serviceResponse = await client.callService('light', 'turn_off', {
        entity_id: 'light.living_room',
      });
      expect(serviceResponse).toBeDefined();
      expect(serviceResponse?.context.id).toBe('ctx-123');
      expect(haWebsocket.callService).toHaveBeenCalledWith(mockConnection, 'light', 'turn_off', {
        entity_id: 'light.living_room',
      });

      // Act & Assert: Step 6 - Unsubscribe from events
      unsubscribe();
      expect(eventListeners.has('state_changed')).toBe(false);

      // Act & Assert: Step 7 - Disconnect
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple subscribers on the same event type', async () => {
      // Arrange
      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      const subscriber1Events: HomeAssistantEvent[] = [];
      const subscriber2Events: HomeAssistantEvent[] = [];
      const subscriber3Events: HomeAssistantEvent[] = [];

      // Act: Subscribe multiple callbacks to the same event
      const unsub1 = await client.subscribeToEvents('state_changed', event => {
        subscriber1Events.push(event);
      });
      const unsub2 = await client.subscribeToEvents('state_changed', event => {
        subscriber2Events.push(event);
      });
      const unsub3 = await client.subscribeToEvents('state_changed', event => {
        subscriber3Events.push(event);
      });

      // Trigger event
      const testEvent: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'sensor.temperature' },
      };
      eventListeners.get('state_changed')?.(testEvent);

      // Assert: All subscribers receive the event
      expect(subscriber1Events).toHaveLength(1);
      expect(subscriber2Events).toHaveLength(1);
      expect(subscriber3Events).toHaveLength(1);

      // Act: Unsubscribe one subscriber
      unsub2();
      eventListeners.get('state_changed')?.(testEvent);

      // Assert: Only remaining subscribers receive the event
      expect(subscriber1Events).toHaveLength(2);
      expect(subscriber2Events).toHaveLength(1); // Not incremented
      expect(subscriber3Events).toHaveLength(2);

      // Cleanup
      unsub1();
      unsub3();
      await client.disconnect();
    });

    it('should handle multiple event types simultaneously', async () => {
      // Arrange
      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      const stateChangedEvents: HomeAssistantEvent[] = [];
      const callServiceEvents: HomeAssistantEvent[] = [];
      const customEvents: HomeAssistantEvent[] = [];

      // Act: Subscribe to multiple event types
      await client.subscribeToEvents('state_changed', event => {
        stateChangedEvents.push(event);
      });
      await client.subscribeToEvents('call_service', event => {
        callServiceEvents.push(event);
      });
      await client.subscribeToEvents('custom_event', event => {
        customEvents.push(event);
      });

      // Trigger different event types
      eventListeners.get('state_changed')?.({ event_type: 'state_changed', data: {} });
      eventListeners.get('call_service')?.({ event_type: 'call_service', data: {} });
      eventListeners.get('custom_event')?.({ event_type: 'custom_event', data: {} });

      // Assert: Each subscriber receives only its event type
      expect(stateChangedEvents).toHaveLength(1);
      expect(callServiceEvents).toHaveLength(1);
      expect(customEvents).toHaveLength(1);

      // Cleanup
      await client.disconnect();
    });
  });

  describe('Connection Management Integration', () => {
    it('should authenticate with long-lived token', async () => {
      // Arrange
      const client = new HomeAssistantClient(testConfig);

      // Act
      await client.connect();

      // Assert
      expect(haWebsocket.createLongLivedTokenAuth).toHaveBeenCalledWith(
        testConfig.url,
        testConfig.token
      );
      expect(haWebsocket.createConnection).toHaveBeenCalledWith({
        auth: { access_token: testConfig.token },
      });
    });

    it('should validate connection and measure latency', async () => {
      // Arrange
      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      // Act
      const result = await client.validateConnection();

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully connected');
      expect(result.latencyMs).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup resources on disconnect', async () => {
      // Arrange
      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      // Subscribe to events
      await client.subscribeToEvents('state_changed', () => {});
      await client.subscribeToEvents('call_service', () => {});

      // Verify subscriptions are active
      expect(eventListeners.has('state_changed')).toBe(true);
      expect(eventListeners.has('call_service')).toBe(true);

      // Act
      await client.disconnect();

      // Assert: Connection closed
      expect(client.isConnected()).toBe(false);
      expect(mockConnection.close).toHaveBeenCalledTimes(1);

      // Assert: Event listeners cleaned up (unsubscribed from the connection)
      expect(eventListeners.has('state_changed')).toBe(false);
      expect(eventListeners.has('call_service')).toBe(false);
    });

    it('should prevent operations when not connected', async () => {
      // Arrange
      const client = new HomeAssistantClient(testConfig);

      // Assert: Operations should fail when not connected
      await expect(client.subscribeToEvents('state_changed', () => {})).rejects.toThrow(
        'Must be connected'
      );
      await expect(client.getState('light.living_room')).rejects.toThrow('Must be connected');
      await expect(client.callService('light', 'turn_on')).rejects.toThrow('Must be connected');
    });
  });

  describe('State Query Integration', () => {
    it('should query specific entity state', async () => {
      // Arrange
      const mockStates: HassEntityState[] = [
        {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: { brightness: 255, color_temp: 370 },
          last_changed: '2024-11-24T00:00:00Z',
          last_updated: '2024-11-24T00:00:00Z',
        },
      ];

      (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);
      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      // Act
      const state = await client.getState('light.living_room');

      // Assert
      expect(state.entity_id).toBe('light.living_room');
      expect(state.state).toBe('on');
      expect(state.attributes.brightness).toBe(255);
      expect(haWebsocket.getStates).toHaveBeenCalledTimes(1);
    });

    it('should query all entity states', async () => {
      // Arrange
      const mockStates: HassEntityState[] = [
        {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: {},
          last_changed: '2024-11-24T00:00:00Z',
          last_updated: '2024-11-24T00:00:00Z',
        },
        {
          entity_id: 'switch.kitchen',
          state: 'off',
          attributes: {},
          last_changed: '2024-11-24T00:00:00Z',
          last_updated: '2024-11-24T00:00:00Z',
        },
      ];

      (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);
      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      // Act
      const states = await client.getAllStates();

      // Assert
      expect(states).toHaveLength(2);
      expect(states[0].entity_id).toBe('light.living_room');
      expect(states[1].entity_id).toBe('switch.kitchen');
      expect(haWebsocket.getStates).toHaveBeenCalledTimes(1);
    });

    it('should cache entity states when caching enabled', async () => {
      // Arrange
      const mockStates: HassEntityState[] = [
        {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: {},
          last_changed: '2024-11-24T00:00:00Z',
          last_updated: '2024-11-24T00:00:00Z',
        },
      ];

      (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);
      const client = new HomeAssistantClient({
        ...testConfig,
        stateCache: { enabled: true, ttlMs: 5000 },
      });
      await client.connect();

      // Act: Query same state twice
      const state1 = await client.getState('light.living_room');
      const state2 = await client.getState('light.living_room');

      // Assert: Should use cache on second call
      expect(state1).toEqual(state2);
      expect(haWebsocket.getStates).toHaveBeenCalledTimes(1); // Only called once, cache used for second
    });

    it('should expire cache after TTL', async () => {
      // Arrange
      const mockStates: HassEntityState[] = [
        {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: {},
          last_changed: '2024-11-24T00:00:00Z',
          last_updated: '2024-11-24T00:00:00Z',
        },
      ];

      (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);
      const client = new HomeAssistantClient({
        ...testConfig,
        stateCache: { enabled: true, ttlMs: 100 },
      });
      await client.connect();

      // Act: Query, wait for cache expiry, query again
      await client.getState('light.living_room');
      await jest.advanceTimersByTimeAsync(150); // Wait for cache to expire
      await client.getState('light.living_room');

      // Assert: Should call getStates twice (cache expired)
      expect(haWebsocket.getStates).toHaveBeenCalledTimes(2);
    });
  });

  describe('Service Call Integration', () => {
    it('should call service with parameters', async () => {
      // Arrange
      (haWebsocket.callService as jest.Mock).mockResolvedValue({
        context: { id: 'ctx-456', parent_id: null, user_id: 'user-123' },
      });

      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      // Act
      const response = await client.callService('light', 'turn_on', {
        entity_id: 'light.living_room',
        brightness: 200,
        color_temp: 370,
      });

      // Assert
      expect(response).toBeDefined();
      expect(response?.context.id).toBe('ctx-456');
      expect(haWebsocket.callService).toHaveBeenCalledWith(mockConnection, 'light', 'turn_on', {
        entity_id: 'light.living_room',
        brightness: 200,
        color_temp: 370,
      });
    });

    it('should validate required service parameters', async () => {
      // Arrange
      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      // Assert: Empty domain should fail
      await expect(client.callService('', 'turn_on')).rejects.toThrow('Domain is required');

      // Assert: Empty service should fail
      await expect(client.callService('light', '')).rejects.toThrow('Service is required');
    });

    it('should handle service call without data', async () => {
      // Arrange
      (haWebsocket.callService as jest.Mock).mockResolvedValue({
        context: { id: 'ctx-789', parent_id: null, user_id: null },
      });

      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      // Act
      const response = await client.callService('homeassistant', 'restart');

      // Assert
      expect(response).toBeDefined();
      expect(haWebsocket.callService).toHaveBeenCalledWith(
        mockConnection,
        'homeassistant',
        'restart',
        undefined
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should throw AuthenticationError on invalid token', async () => {
      // Arrange
      (haWebsocket.createConnection as jest.Mock).mockRejectedValue(
        new Error('ERR_INVALID_AUTH: Invalid token')
      );
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });

      // Act & Assert
      await expect(client.connect()).rejects.toThrow(AuthenticationError);
      await expect(client.connect()).rejects.toThrow('authentication failed');

      // Assert: Should log error
      expect(logCapture.error.some(log => log.message.includes('Authentication failed'))).toBe(
        true
      );
    });

    it('should throw ConnectionError on network failure', async () => {
      // Arrange
      (haWebsocket.createConnection as jest.Mock).mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused')
      );
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });

      // Act & Assert
      await expect(client.connect()).rejects.toThrow(ConnectionError);
      await expect(client.connect()).rejects.toThrow('connection failed');

      // Assert: Should log error
      expect(logCapture.error.some(log => log.message.includes('Connection failed'))).toBe(true);
    });

    it('should throw StateQueryError when entity not found', async () => {
      // Arrange
      (haWebsocket.getStates as jest.Mock).mockResolvedValue([]);
      const client = new HomeAssistantClient(testConfig);
      await client.connect();

      // Act & Assert
      await expect(client.getState('light.nonexistent')).rejects.toThrow(StateQueryError);
      await expect(client.getState('light.nonexistent')).rejects.toThrow('Entity not found');
    });

    it('should throw ServiceCallError on service failure', async () => {
      // Arrange
      (haWebsocket.callService as jest.Mock).mockRejectedValue(
        new Error('Service not found: invalid.service')
      );
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });
      await client.connect();

      // Act & Assert
      await expect(client.callService('invalid', 'service')).rejects.toThrow(ServiceCallError);

      // Assert: Should log error
      expect(logCapture.error.some(log => log.message.includes('Failed to call service'))).toBe(
        true
      );
    });

    it('should handle validation failure when not connected', async () => {
      // Arrange
      const client = new HomeAssistantClient(testConfig);

      // Act
      const result = await client.validateConnection();

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('not connected');
    });
  });

  describe('Library-Delegated Reconnection Integration', () => {
    // Helper to capture addEventListener callbacks registered by connect()
    let connectionEventCallbacks: Record<string, () => void>;

    beforeEach(() => {
      connectionEventCallbacks = {};
      mockConnection.addEventListener.mockImplementation(
        (eventType: string, callback: () => void) => {
          connectionEventCallbacks[eventType] = callback;
        }
      );
    });

    it('should track state through disconnect and reconnect cycle', async () => {
      // Arrange
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Act: Library fires disconnected event (connection lost)
      connectionEventCallbacks['disconnected']();

      // Assert: Client reflects disconnected state
      expect(client.isConnected()).toBe(false);
      expect(logCapture.warn.some(log => log.message.includes('connection lost'))).toBe(true);

      // Act: Library reconnects and fires ready event
      connectionEventCallbacks['ready']();

      // Assert: Client reflects connected state and logs reconnection
      expect(client.isConnected()).toBe(true);
      expect(logCapture.info.some(log => log.message.includes('reconnection successful'))).toBe(
        true
      );

      // Cleanup
      await client.disconnect();
    });

    it('should deliver events to subscribers after library reconnection', async () => {
      // Arrange: Create client and subscribe to events
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });
      await client.connect();

      const receivedEvents: HomeAssistantEvent[] = [];
      await client.subscribeToEvents('state_changed', event => {
        receivedEvents.push(event);
      });

      // Verify events work before disconnect
      const preDisconnectEvent: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: { phase: 'before_disconnect' },
      };
      eventListeners.get('state_changed')?.(preDisconnectEvent);
      expect(receivedEvents).toHaveLength(1);

      // Act: Simulate library disconnect then reconnect
      connectionEventCallbacks['disconnected']();
      connectionEventCallbacks['ready']();

      // Library replays subscriptions automatically - events through the original
      // connection listener should still be delivered to callbacks
      const postReconnectEvent: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: { phase: 'after_reconnect' },
      };
      eventListeners.get('state_changed')?.(postReconnectEvent);

      // Assert: Received events from both before and after reconnection
      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].data.phase).toBe('before_disconnect');
      expect(receivedEvents[1].data.phase).toBe('after_reconnect');

      // Cleanup
      await client.disconnect();
    });

    it('should deliver events to multiple subscribers after library reconnection', async () => {
      // Arrange
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });
      await client.connect();

      const subscriber1Events: HomeAssistantEvent[] = [];
      const subscriber2Events: HomeAssistantEvent[] = [];

      await client.subscribeToEvents('vestaboard_refresh', event => {
        subscriber1Events.push(event);
      });
      await client.subscribeToEvents('vestaboard_refresh', event => {
        subscriber2Events.push(event);
      });

      // Simulate library disconnect then reconnect
      connectionEventCallbacks['disconnected']();
      connectionEventCallbacks['ready']();

      // Fire event after reconnection
      const postReconnectEvent: HomeAssistantEvent = {
        event_type: 'vestaboard_refresh',
        data: { phase: 'after_reconnect' },
        origin: 'LOCAL',
        time_fired: '2024-12-01T00:01:00Z',
      };
      eventListeners.get('vestaboard_refresh')?.(postReconnectEvent);

      // Assert: Both subscribers receive the event after reconnection
      expect(subscriber1Events).toHaveLength(1);
      expect(subscriber2Events).toHaveLength(1);
      expect(subscriber1Events[0].data.phase).toBe('after_reconnect');
      expect(subscriber2Events[0].data.phase).toBe('after_reconnect');

      // Cleanup
      await client.disconnect();
    });

    it('should not log reconnection successful on initial connect', async () => {
      // Arrange
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });
      await client.connect();

      // Fire ready without prior disconnect (simulating initial connection stability)
      connectionEventCallbacks['ready']();

      // Assert: No "reconnection successful" log on first ready
      expect(logCapture.info.some(log => log.message.includes('reconnection successful'))).toBe(
        false
      );

      // Cleanup
      await client.disconnect();
    });

    it('should prevent library auto-reconnect on manual disconnect via connection.close()', async () => {
      // Arrange
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });
      await client.connect();

      const initialConnectCalls = (haWebsocket.createConnection as jest.Mock).mock.calls.length;

      // Act: Manual disconnect
      await client.disconnect();

      // Assert: connection.close() was called (which sets library's closeRequested=true)
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
      expect(client.isConnected()).toBe(false);

      // No additional connection attempts should have been made
      expect((haWebsocket.createConnection as jest.Mock).mock.calls.length).toBe(
        initialConnectCalls
      );
    });
  });

  describe('Logger Integration', () => {
    it('should log connection lifecycle events', async () => {
      // Arrange
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });

      // Act: Connect and disconnect
      await client.connect();
      await client.disconnect();

      // Assert: Should log info messages
      expect(logCapture.info.some(log => log.message.includes('Connecting'))).toBe(true);
      expect(logCapture.info.some(log => log.message.includes('Connected'))).toBe(true);
    });

    it('should log debug messages when debug enabled', async () => {
      // Arrange
      const client = new HomeAssistantClient({ ...testConfig, debug: true, logger: mockLogger });

      // Act
      await client.connect();
      await client.subscribeToEvents('state_changed', () => {});

      // Assert: Should log debug messages
      expect(logCapture.debug.some(log => log.message.includes('WebSocket connection'))).toBe(true);
      expect(logCapture.debug.some(log => log.message.includes('Subscribing to event'))).toBe(true);

      // Cleanup
      await client.disconnect();
    });

    it('should include context in log messages', async () => {
      // Arrange
      (haWebsocket.createConnection as jest.Mock).mockRejectedValue(new Error('Test error'));
      const client = new HomeAssistantClient({ ...testConfig, logger: mockLogger });

      // Act
      try {
        await client.connect();
      } catch {
        // Expected error
      }

      // Assert: Error logs should include context
      const errorLog = logCapture.error.find(log => log.message.includes('Connection failed'));
      expect(errorLog).toBeDefined();
      expect(errorLog?.context).toBeDefined();
      expect(errorLog?.context?.url).toBe(testConfig.url);
    });
  });
});
