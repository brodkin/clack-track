/**
 * Home Assistant WebSocket Mock
 *
 * This module provides factory functions for creating mock Home Assistant
 * WebSocket connection objects that conform to the home-assistant-js-websocket
 * library interfaces. These mocks are used throughout the test suite to simulate
 * WebSocket connections, event subscriptions, and state queries without making
 * real network calls.
 *
 * @module home-assistant
 */

import type { Connection, HassEntity } from 'home-assistant-js-websocket';
import type {
  HomeAssistantEvent,
  EventCallback,
  HassEntityState,
  ServiceCallResponse,
} from '@/types/home-assistant.js';

/**
 * Configuration options for mock Home Assistant connection behavior
 */
export interface MockHomeAssistantOptions {
  /**
   * Whether the mock should simulate connection failures
   * @default false
   */
  shouldFailConnection?: boolean;

  /**
   * Whether the mock should simulate authentication failures
   * @default false
   */
  shouldFailAuth?: boolean;

  /**
   * Whether the mock should simulate subscription failures
   * @default false
   */
  shouldFailSubscription?: boolean;

  /**
   * Whether the mock should simulate state query failures
   * @default false
   */
  shouldFailStateQuery?: boolean;

  /**
   * Whether the mock should simulate service call failures
   * @default false
   */
  shouldFailServiceCall?: boolean;

  /**
   * Mock entity states to return from getStates()
   * @default []
   */
  mockStates?: HassEntityState[];

  /**
   * Simulate connection close event after this delay (ms)
   * Set to 0 to disable, positive number to trigger close
   * @default 0
   */
  closeAfterMs?: number;

  /**
   * Home Assistant version to report
   * @default '2024.1.0'
   */
  haVersion?: string;
}

/**
 * Mock event listener map type
 */
type EventListenerMap = Map<string, Set<EventCallback>>;

/**
 * Creates a mock Home Assistant WebSocket Connection for testing
 *
 * Returns a mock implementation that simulates the home-assistant-js-websocket
 * Connection interface. Supports configurable success/failure modes for various
 * operations (connection, auth, subscription, state queries, service calls).
 *
 * @param options - Configuration options for mock behavior
 * @returns Mock Connection instance
 *
 * @example
 * ```typescript
 * // Create a successful mock connection
 * const mockConnection = createMockConnection();
 * await mockConnection.subscribeEvents((event) => {
 *   console.log('Event received:', event);
 * }, 'state_changed');
 *
 * // Create a failing subscription mock
 * const failingConnection = createMockConnection({
 *   shouldFailSubscription: true
 * });
 * await failingConnection.subscribeEvents(...); // Throws error
 *
 * // Create a mock with custom states
 * const statesConnection = createMockConnection({
 *   mockStates: [
 *     { entity_id: 'light.living_room', state: 'on', ... }
 *   ]
 * });
 * ```
 */
export function createMockConnection(options: MockHomeAssistantOptions = {}): Connection {
  const {
    shouldFailConnection = false,
    shouldFailSubscription = false,
    closeAfterMs = 0,
    haVersion = '2024.1.0',
  } = options;

  // Event listener storage: eventType -> Set of callbacks
  const eventListeners: EventListenerMap = new Map();

  // Connection state
  let isClosed = false;

  // Mock connection object
  const mockConnection: Connection = {
    // Connection properties (matching home-assistant-js-websocket Connection interface)
    haVersion,
    connected: !shouldFailConnection,

    /**
     * Subscribe to Home Assistant events
     *
     * @param callback - Function to call when event is received
     * @param eventType - Optional event type filter
     * @returns Promise resolving to unsubscribe function
     * @throws Error if shouldFailSubscription is true
     */
    async subscribeEvents(
      callback: (event: HomeAssistantEvent) => void,
      eventType?: string
    ): Promise<() => void> {
      if (shouldFailSubscription) {
        throw new Error(
          `Mock subscription error: Failed to subscribe to event type '${eventType}'`
        );
      }

      if (isClosed) {
        throw new Error('Connection is closed');
      }

      const type = eventType || 'all';

      // Get or create the set of listeners for this event type
      if (!eventListeners.has(type)) {
        eventListeners.set(type, new Set());
      }

      const listeners = eventListeners.get(type)!;
      listeners.add(callback);

      // Return unsubscribe function
      return () => {
        listeners.delete(callback);
        if (listeners.size === 0) {
          eventListeners.delete(type);
        }
      };
    },

    /**
     * Send a message through the WebSocket connection
     *
     * @param _message - Message to send (unused in mock)
     * @returns Promise resolving when message is sent
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async sendMessage(_message: Record<string, unknown>): Promise<void> {
      if (isClosed) {
        throw new Error('Connection is closed');
      }

      // Mock implementation - no-op for testing
      return Promise.resolve();
    },

    /**
     * Send a message and wait for a response
     *
     * @param _message - Message to send (unused in mock)
     * @returns Promise resolving to response
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async sendMessagePromise<T>(_message: Record<string, unknown>): Promise<T> {
      if (isClosed) {
        throw new Error('Connection is closed');
      }

      // Mock implementation - return empty response
      return Promise.resolve({} as T);
    },

    /**
     * Close the WebSocket connection
     */
    close(): void {
      isClosed = true;
      // Clear all event listeners
      eventListeners.clear();
    },

    /**
     * Suspend the connection (used for reconnection scenarios)
     */
    suspend(): void {
      // Mock implementation - no-op for testing
    },

    /**
     * Reconnect to Home Assistant
     *
     * @returns Promise resolving when reconnected
     */
    async reconnect(): Promise<void> {
      if (shouldFailConnection) {
        throw new Error('Mock connection error: Reconnection failed');
      }

      isClosed = false;
      return Promise.resolve();
    },

    /**
     * Check if connection is closed
     *
     * @returns True if connection is closed
     */
    get isClosed(): boolean {
      return isClosed;
    },
  } as Connection;

  // Simulate connection close after delay if configured
  if (closeAfterMs > 0) {
    setTimeout(() => {
      mockConnection.close();
    }, closeAfterMs);
  }

  return mockConnection;
}

/**
 * Creates a mock Auth object for authentication testing
 *
 * Returns a mock authentication object that simulates the home-assistant-js-websocket
 * Auth interface for long-lived token authentication.
 *
 * @param options - Configuration options for auth behavior
 * @returns Mock Auth object
 *
 * @example
 * ```typescript
 * // Create a successful auth mock
 * const mockAuth = createMockAuth();
 * const connection = await createConnection({ auth: mockAuth });
 *
 * // Create a failing auth mock
 * const failingAuth = createMockAuth({ shouldFailAuth: true });
 * await createConnection({ auth: failingAuth }); // Throws error
 * ```
 */
export function createMockAuth(options: MockHomeAssistantOptions = {}) {
  const { shouldFailAuth = false } = options;

  return {
    async refreshAccessToken(): Promise<string> {
      if (shouldFailAuth) {
        throw new Error('Mock authentication error: Invalid token');
      }

      return Promise.resolve('mock-access-token');
    },
    async ensureAccessToken(): Promise<string> {
      if (shouldFailAuth) {
        throw new Error('Mock authentication error: Invalid token');
      }

      return Promise.resolve('mock-access-token');
    },
    data: {
      hassUrl: 'ws://localhost:8123',
      access_token: 'mock-token',
      expires: Date.now() + 3600000, // 1 hour from now
    },
  };
}

/**
 * Mock implementation of getStates function from home-assistant-js-websocket
 *
 * Returns mock entity states for testing. Use this to mock the imported
 * getStates function in your tests.
 *
 * @param connection - Mock connection (not used, for interface compatibility)
 * @param options - Configuration options for mock behavior
 * @returns Promise resolving to array of entity states
 * @throws Error if shouldFailStateQuery is true
 *
 * @example
 * ```typescript
 * // In your test setup
 * jest.mock('home-assistant-js-websocket', () => ({
 *   getStates: jest.fn(() => mockGetStates(mockConnection, options)),
 *   // ... other mocks
 * }));
 * ```
 */
export function mockGetStates(
  connection: Connection,
  options: MockHomeAssistantOptions = {}
): Promise<HassEntity[]> {
  const { shouldFailStateQuery = false, mockStates = [] } = options;

  if (shouldFailStateQuery) {
    return Promise.reject(new Error('Mock state query error: Failed to query states'));
  }

  // Cast HassEntityState to HassEntity (compatible types)
  return Promise.resolve(mockStates as HassEntity[]);
}

/**
 * Mock implementation of callService function from home-assistant-js-websocket
 *
 * Returns mock service call response for testing. Use this to mock the imported
 * callService function in your tests.
 *
 * @param connection - Mock connection (not used, for interface compatibility)
 * @param domain - Service domain (e.g., 'light')
 * @param service - Service name (e.g., 'turn_on')
 * @param serviceData - Optional service data
 * @param options - Configuration options for mock behavior
 * @returns Promise resolving to service call response
 * @throws Error if shouldFailServiceCall is true
 *
 * @example
 * ```typescript
 * // In your test setup
 * jest.mock('home-assistant-js-websocket', () => ({
 *   callService: jest.fn(() => mockCallService(mockConnection, 'light', 'turn_on', {}, options)),
 *   // ... other mocks
 * }));
 * ```
 */
export function mockCallService(
  connection: Connection,
  domain: string,
  service: string,
  serviceData?: Record<string, unknown>,
  options: MockHomeAssistantOptions = {}
): Promise<ServiceCallResponse | null> {
  const { shouldFailServiceCall = false } = options;

  if (shouldFailServiceCall) {
    return Promise.reject(
      new Error(`Mock service call error: Failed to call ${domain}.${service}`)
    );
  }

  // Return mock response
  return Promise.resolve({
    context: {
      id: '01HM8QZXK3YJ7W5VBNTPQR4STU',
      parent_id: null,
      user_id: 'mock-user-id',
    },
  });
}

/**
 * Mock implementation of createConnection function from home-assistant-js-websocket
 *
 * Returns a mock connection for testing. Use this to mock the imported
 * createConnection function in your tests.
 *
 * @param config - Connection configuration (auth object)
 * @param options - Configuration options for mock behavior
 * @returns Promise resolving to mock Connection
 * @throws Error if shouldFailConnection or shouldFailAuth is true
 *
 * @example
 * ```typescript
 * // In your test setup
 * jest.mock('home-assistant-js-websocket', () => ({
 *   createConnection: jest.fn((config) => mockCreateConnection(config, options)),
 *   // ... other mocks
 * }));
 * ```
 */
export function mockCreateConnection(
  config: { auth: unknown },
  options: MockHomeAssistantOptions = {}
): Promise<Connection> {
  const { shouldFailConnection = false, shouldFailAuth = false } = options;

  if (shouldFailAuth) {
    return Promise.reject(new Error('Mock authentication error: Invalid access token'));
  }

  if (shouldFailConnection) {
    return Promise.reject(new Error('Mock connection error: Connection refused'));
  }

  return Promise.resolve(createMockConnection(options));
}

/**
 * Trigger an event on all subscribed listeners
 *
 * Helper function to simulate Home Assistant events in tests.
 * Call this to trigger event callbacks registered via subscribeEvents.
 *
 * Note: This is a documentation helper. In actual tests, you should maintain
 * a reference to the callback function and call it directly to simulate events.
 *
 * @param _connection - Mock connection instance (unused, for interface compatibility)
 * @param _event - Event to trigger (unused, for interface compatibility)
 *
 * @example
 * ```typescript
 * const mockConnection = createMockConnection();
 * const eventCallback = jest.fn();
 * await mockConnection.subscribeEvents(eventCallback, 'state_changed');
 *
 * // Trigger event in your test by calling the callback directly
 * eventCallback({
 *   event_type: 'state_changed',
 *   data: { entity_id: 'light.living_room', new_state: { state: 'on' } }
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function triggerMockEvent(_connection: Connection, _event: HomeAssistantEvent): void {
  // For testing purposes, we can't access private eventListeners
  // Tests should maintain their own reference to callbacks for triggering
  // This is a documentation helper - actual triggering happens in test code
}

/**
 * Type guard to check if an object is a valid Connection
 *
 * @param obj - Object to check
 * @returns True if object has required Connection methods
 */
export function isConnection(obj: unknown): obj is Connection {
  return (
    !!obj &&
    typeof (obj as Record<string, unknown>).subscribeEvents === 'function' &&
    typeof (obj as Record<string, unknown>).sendMessage === 'function' &&
    typeof (obj as Record<string, unknown>).close === 'function'
  );
}
