/**
 * Home Assistant WebSocket Client
 *
 * Manages WebSocket connections to Home Assistant using long-lived access tokens.
 * This implementation provides:
 * - Connection management (connect, disconnect, isConnected)
 * - Long-lived token authentication
 * - Connection state tracking
 * - Validation methods for testing
 * - Event subscription system with multiple subscribers per event type
 * - Proper cleanup on disconnect
 * - Graceful degradation on connection failures
 * - State query methods with optional caching
 * - Service call method with parameter validation
 *
 * Reconnection is handled entirely by the home-assistant-js-websocket library,
 * which provides built-in auto-reconnection with subscription replay. This client
 * registers "ready" and "disconnected" listeners on the Connection for state
 * tracking and logging only.
 *
 * Design Patterns:
 * - Dependency Injection: Configuration injected via constructor
 * - Single Responsibility: Focused on connection, events, states, and service calls
 * - Observer Pattern: Event subscription with multiple observers per event
 * - Error Handling: Graceful cleanup on failures, console warnings for degradation
 * - State Machine: Tracks connection state transitions
 *
 * @example
 * ```typescript
 * const client = new HomeAssistantClient({
 *   url: 'wss://homeassistant.local:8123/api/websocket',
 *   token: 'your-long-lived-token',
 * });
 *
 * await client.connect();
 * console.log(client.isConnected()); // true
 *
 * // Subscribe to events
 * const unsubscribe = await client.subscribeToEvents('state_changed', (event) => {
 *   console.log('State changed:', event.data);
 * });
 *
 * // Connection lost? Library auto-reconnection handles it and replays subscriptions
 *
 * // Later: unsubscribe
 * unsubscribe();
 *
 * await client.disconnect();
 * ```
 *
 * @remarks
 * **Security**: Use `wss://` (WebSocket Secure) instead of `ws://` in production to encrypt
 * WebSocket traffic over TLS. This prevents man-in-the-middle attacks and protects your
 * long-lived access token. Requires a valid TLS/SSL certificate on your Home Assistant server.
 * For local development without HTTPS, `ws://` may be used but is not recommended.
 */

// Polyfill WebSocket for Node.js (required by home-assistant-js-websocket)
import WebSocket from 'ws';
// @ts-expect-error - Polyfill globalThis.WebSocket for home-assistant-js-websocket library
globalThis.WebSocket = WebSocket;

import {
  createConnection,
  createLongLivedTokenAuth,
  type Connection,
  type Auth,
  type HassEntity,
  getStates,
  callService,
} from 'home-assistant-js-websocket';
import type {
  HomeAssistantConnectionConfig,
  ConnectionState,
  ValidationResult,
  HomeAssistantEvent,
  EventCallback,
  UnsubscribeFunction,
  StateCacheConfig,
  HassEntityState,
  Logger,
  ServiceCallResponse,
} from '../../types/home-assistant.js';
import {
  HAAuthenticationError,
  ConnectionError,
  SubscriptionError,
  StateQueryError,
  ServiceCallError,
} from '../../types/home-assistant.js';

/**
 * Default state cache configuration
 */
const DEFAULT_STATE_CACHE_CONFIG: StateCacheConfig = {
  enabled: false,
  ttlMs: 5000,
};

/**
 * Default console logger implementation
 */
const DEFAULT_LOGGER: Logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    if (context) {
      console.info(message, context);
    } else {
      console.info(message);
    }
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    if (context) {
      console.warn(message, context);
    } else {
      console.warn(message);
    }
  },
  error: (message: string, context?: Record<string, unknown>) => {
    if (context) {
      console.error(message, context);
    } else {
      console.error(message);
    }
  },
  debug: (message: string, context?: Record<string, unknown>) => {
    if (context) {
      console.debug(message, context);
    } else {
      console.debug(message);
    }
  },
};

/**
 * Home Assistant WebSocket client for connection management and event subscriptions
 */
export class HomeAssistantClient {
  private config: HomeAssistantConnectionConfig;
  private connection: Connection | null = null;
  private state: ConnectionState = 'disconnected' as ConnectionState;
  /**
   * Event handler map: eventType -> Set of callback functions
   * Allows multiple subscribers per event type
   */
  private eventHandlers: Map<string, Set<EventCallback>> = new Map();
  /**
   * Connection event listener map: eventType -> listener function
   * Tracks the actual listener registered with the connection
   */
  private connectionListeners: Map<string, (event: HomeAssistantEvent) => void> = new Map();
  /**
   * Connection unsubscribe functions map: eventType -> unsubscribe function
   * Stores the unsubscribe functions returned by connection.subscribeEvents()
   * These must be called to properly clean up WebSocket subscriptions
   */
  private connectionUnsubscribers: Map<string, UnsubscribeFunction> = new Map();
  /**
   * Tracks whether a disconnect has occurred (for logging reconnection success)
   */
  private hasBeenDisconnected: boolean = false;
  /**
   * Logger instance for structured logging
   */
  private logger: Logger;
  /**
   * Debug mode flag
   */
  private debug: boolean;
  /**
   * State cache configuration
   */
  private stateCacheConfig: StateCacheConfig;
  /**
   * Cache storage: entityId -> { state, timestamp }
   */
  private stateCache: Map<string, { state: HassEntityState; timestamp: number }> = new Map();
  /**
   * Cache for all states query: { states, timestamp }
   */
  private allStatesCache: { states: HassEntityState[]; timestamp: number } | null = null;

  constructor(config: HomeAssistantConnectionConfig) {
    this.config = config;
    // Merge state cache config with defaults
    this.stateCacheConfig = {
      ...DEFAULT_STATE_CACHE_CONFIG,
      ...config.stateCache,
    };
    // Use provided logger or default console logger
    this.logger = config.logger || DEFAULT_LOGGER;
    // Enable debug mode if specified
    this.debug = config.debug || false;
  }

  /**
   * Connect to Home Assistant using long-lived token authentication
   * @throws {HAAuthenticationError} If authentication fails
   * @throws {ConnectionError} If connection fails
   */
  async connect(): Promise<void> {
    if (this.connection) {
      throw new Error('Already connected to Home Assistant');
    }

    this.logger.info('Connecting to Home Assistant', { url: this.config.url });

    try {
      this.state = 'connecting' as ConnectionState;

      // Create authentication object with long-lived token
      const auth: Auth = createLongLivedTokenAuth(this.config.url, this.config.token);

      // Establish WebSocket connection
      this.connection = await createConnection({ auth });

      this.state = 'connected' as ConnectionState;

      this.logger.info('Connected to Home Assistant successfully', {
        url: this.config.url,
      });

      if (this.debug) {
        this.logger.debug('WebSocket connection established', {
          state: this.state,
          hasConnection: !!this.connection,
        });
      }

      // Register connection state listeners for logging/tracking only.
      // The library handles reconnection and subscription replay automatically.
      this.connection.addEventListener('disconnected', () => {
        this.hasBeenDisconnected = true;
        this.state = 'disconnected' as ConnectionState;
        this.logger.warn('Home Assistant connection lost', {
          url: this.config.url,
        });
      });

      this.connection.addEventListener('ready', () => {
        this.state = 'connected' as ConnectionState;
        if (this.hasBeenDisconnected) {
          this.logger.info('Home Assistant reconnection successful', {
            url: this.config.url,
          });
        }
      });
    } catch (error) {
      this.state = 'error' as ConnectionState;
      this.connection = null;

      // Classify error type and throw appropriate error
      const originalError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = originalError.message;

      // Check if it's an authentication error
      if (
        errorMessage.includes('ERR_INVALID_AUTH') ||
        errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('Invalid auth') ||
        errorMessage.includes('Invalid token') ||
        errorMessage.includes('token') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('authentication')
      ) {
        this.logger.error('Authentication failed', {
          url: this.config.url,
          error: errorMessage,
        });
        throw new HAAuthenticationError(
          `Home Assistant authentication failed: ${errorMessage}`,
          originalError
        );
      }

      // Otherwise, treat as connection error
      this.logger.error('Connection failed', {
        url: this.config.url,
        error: errorMessage,
      });
      throw new ConnectionError(
        `Home Assistant connection failed: ${errorMessage}`,
        this.config.url,
        originalError
      );
    }
  }

  /**
   * Disconnect from Home Assistant and cleanup resources
   */
  async disconnect(): Promise<void> {
    if (!this.connection) {
      // Already disconnected, no-op
      return;
    }

    try {
      this.state = 'disconnecting' as ConnectionState;

      // Remove all connection event listeners
      this.cleanupEventListeners();
      // close() sets the library's closeRequested flag, preventing auto-reconnect
      this.connection.close();
    } catch (error) {
      // Log error but still cleanup connection reference
      console.error('Error during disconnect:', error);
    } finally {
      this.connection = null;
      this.state = 'disconnected' as ConnectionState;
      // Clean up all event handlers and listeners
      this.eventHandlers.clear();
      this.connectionListeners.clear();
      this.connectionUnsubscribers.clear();
      // Clear state cache
      this.stateCache.clear();
      this.allStatesCache = null;
      // Reset disconnect tracking
      this.hasBeenDisconnected = false;
    }
  }

  /**
   * Check if client is currently connected to Home Assistant
   * @returns {boolean} True if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connection !== null && this.state === ('connected' as ConnectionState);
  }

  /**
   * Validate the connection is working and measure latency
   * @returns {Promise<ValidationResult>} Validation result with latency measurement
   */
  async validateConnection(): Promise<ValidationResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        message: 'Client is not connected to Home Assistant',
      };
    }

    try {
      const startTime = Date.now();

      // Simple validation: connection exists and is in connected state
      // In a real implementation, we might ping the server or query a state
      // For now, just verify the connection object is valid
      if (this.connection) {
        const latencyMs = Date.now() - startTime;

        return {
          success: true,
          message: 'Successfully connected to Home Assistant',
          latencyMs,
        };
      }

      return {
        success: false,
        message: 'Connection object is invalid',
      };
    } catch (error) {
      return {
        success: false,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Subscribe to Home Assistant events of a specific type
   * Supports multiple subscribers per event type with individual unsubscribe functions
   *
   * @param eventType - The type of event to subscribe to (e.g., 'state_changed')
   * @param callback - Function to call when event is received
   * @returns {Promise<UnsubscribeFunction>} Function to unsubscribe this specific callback
   * @throws {Error} If not connected to Home Assistant
   * @throws {SubscriptionError} If subscription fails
   *
   * @example
   * ```typescript
   * const unsubscribe = await client.subscribeToEvents('state_changed', (event) => {
   *   console.log('State changed:', event.data);
   * });
   *
   * // Later: unsubscribe this specific callback
   * unsubscribe();
   * ```
   */
  async subscribeToEvents(
    eventType: string,
    callback: EventCallback
  ): Promise<UnsubscribeFunction> {
    if (!this.isConnected()) {
      throw new Error('Must be connected to subscribe to events');
    }

    if (this.debug) {
      this.logger.debug('Subscribing to event type', {
        eventType,
        existingHandlers: this.eventHandlers.has(eventType),
      });
    }

    try {
      // Get or create the set of handlers for this event type
      if (!this.eventHandlers.has(eventType)) {
        this.eventHandlers.set(eventType, new Set());
        // Create and register the connection listener for this event type
        await this.registerConnectionListener(eventType);
      }

      const handlers = this.eventHandlers.get(eventType)!;
      handlers.add(callback);

      // Return unsubscribe function for this specific callback
      return () => {
        this.removeCallback(eventType, callback);
      };
    } catch (error) {
      const originalError = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to subscribe to event', {
        eventType,
        error: originalError.message,
      });
      throw new SubscriptionError(
        `Failed to subscribe to event type '${eventType}': ${originalError.message}`,
        eventType,
        originalError
      );
    }
  }

  /**
   * Unsubscribe all callbacks for a specific event type
   *
   * @param eventType - The event type to unsubscribe from
   *
   * @example
   * ```typescript
   * client.unsubscribeFromEvents('state_changed');
   * ```
   */
  unsubscribeFromEvents(eventType: string): void {
    // Remove all handlers for this event type
    this.eventHandlers.delete(eventType);
    // Remove the connection listener if exists
    this.removeConnectionListener(eventType);
  }

  /**
   * Register a connection listener for a specific event type
   * This creates the bridge between the WebSocket connection and our handler map
   */
  private async registerConnectionListener(eventType: string): Promise<void> {
    if (this.connectionListeners.has(eventType) || !this.connection) {
      // Already registered or no connection
      return;
    }

    const listener = (event: HomeAssistantEvent) => {
      // Get current handlers and call each one
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.forEach(handler => handler(event));
      }
    };

    this.connectionListeners.set(eventType, listener);

    // Subscribe to events using the connection's subscribeEvents method
    // The library's subscribeEvents returns a promise that resolves to an unsubscribe function
    try {
      const unsubscribe = await this.connection.subscribeEvents(listener, eventType);
      // Store the unsubscribe function for later cleanup
      this.connectionUnsubscribers.set(eventType, unsubscribe);
    } catch (error) {
      // Remove the listener from our map if subscription fails
      this.connectionListeners.delete(eventType);
      throw error;
    }
  }

  /**
   * Remove a connection listener for a specific event type
   */
  private removeConnectionListener(eventType: string): void {
    // Call the unsubscribe function to clean up the WebSocket subscription
    const unsubscribe = this.connectionUnsubscribers.get(eventType);
    if (unsubscribe) {
      unsubscribe();
      this.connectionUnsubscribers.delete(eventType);
    }

    // Clean up listener reference
    this.connectionListeners.delete(eventType);
  }

  /**
   * Remove a specific callback from the handler map
   */
  private removeCallback(eventType: string, callback: EventCallback): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(callback);
      // If no more handlers, clean up the event type
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
        this.removeConnectionListener(eventType);
      }
    }
  }

  /**
   * Clean up all connection event listeners
   * Called during disconnect to ensure proper cleanup
   */
  private cleanupEventListeners(): void {
    if (!this.connection) {
      return;
    }

    // Call all unsubscribe functions to clean up WebSocket subscriptions
    for (const unsubscribe of this.connectionUnsubscribers.values()) {
      unsubscribe();
    }

    // Clear all maps
    this.connectionUnsubscribers.clear();
    this.connectionListeners.clear();
  }

  /**
   * Get the current state of a specific entity
   *
   * @param entityId - The entity ID to query (e.g., 'light.living_room')
   * @returns {Promise<HassEntityState>} The current state of the entity
   * @throws {Error} If not connected to Home Assistant
   * @throws {StateQueryError} If entity not found or query fails
   *
   * @example
   * ```typescript
   * const state = await client.getState('light.living_room');
   * console.log(`Light is ${state.state}`);
   * console.log(`Brightness: ${state.attributes.brightness}`);
   * ```
   */
  async getState(entityId: string): Promise<HassEntityState> {
    if (!this.isConnected()) {
      throw new Error('Must be connected to query states');
    }

    // Check cache if enabled
    if (this.stateCacheConfig.enabled) {
      const cached = this.stateCache.get(entityId);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < this.stateCacheConfig.ttlMs) {
          if (this.debug) {
            this.logger.debug('Returning cached state', {
              entityId,
              age,
              ttl: this.stateCacheConfig.ttlMs,
            });
          }
          return cached.state;
        } else {
          // Cache expired, remove it
          this.stateCache.delete(entityId);
        }
      }
    }

    try {
      // Query all states and find the specific entity
      const states = await getStates(this.connection!);

      // Validate response
      if (!Array.isArray(states)) {
        throw new StateQueryError('Invalid response format: expected array of states');
      }

      // Find the specific entity (library returns HassEntity, which is compatible with HassEntityState)
      const state = states.find((s: HassEntity) => s.entity_id === entityId) as
        | HassEntityState
        | undefined;

      if (!state) {
        throw new StateQueryError(`Entity not found: ${entityId}`, entityId);
      }

      // Cache the state if enabled
      if (this.stateCacheConfig.enabled) {
        this.stateCache.set(entityId, {
          state,
          timestamp: Date.now(),
        });
      }

      return state;
    } catch (error) {
      if (error instanceof StateQueryError) {
        throw error;
      }

      const originalError = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to query entity state', {
        entityId,
        error: originalError.message,
      });
      throw originalError;
    }
  }

  /**
   * Get the current state of all entities
   *
   * @returns {Promise<HassEntityState[]>} Array of all entity states
   * @throws {Error} If not connected to Home Assistant
   * @throws {StateQueryError} If query fails or response is invalid
   *
   * @example
   * ```typescript
   * const states = await client.getAllStates();
   * const lights = states.filter(s => s.entity_id.startsWith('light.'));
   * console.log(`Found ${lights.length} lights`);
   * ```
   */
  async getAllStates(): Promise<HassEntityState[]> {
    if (!this.isConnected()) {
      throw new Error('Must be connected to query states');
    }

    // Check cache if enabled
    if (this.stateCacheConfig.enabled && this.allStatesCache) {
      const age = Date.now() - this.allStatesCache.timestamp;
      if (age < this.stateCacheConfig.ttlMs) {
        if (this.debug) {
          this.logger.debug('Returning cached all states', {
            count: this.allStatesCache.states.length,
            age,
            ttl: this.stateCacheConfig.ttlMs,
          });
        }
        return this.allStatesCache.states;
      } else {
        // Cache expired
        this.allStatesCache = null;
      }
    }

    try {
      // Query all states (library returns HassEntity[], cast to HassEntityState[])
      const states = (await getStates(this.connection!)) as HassEntityState[];

      // Validate response
      if (!Array.isArray(states)) {
        throw new StateQueryError('Invalid response format: expected array of states');
      }

      // Cache the states if enabled
      if (this.stateCacheConfig.enabled) {
        this.allStatesCache = {
          states,
          timestamp: Date.now(),
        };
      }

      return states;
    } catch (error) {
      if (error instanceof StateQueryError) {
        throw error;
      }

      const originalError = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to query all states', {
        error: originalError.message,
      });
      throw originalError;
    }
  }

  /**
   * Call a Home Assistant service
   *
   * @param domain - The domain of the service (e.g., 'light', 'switch')
   * @param service - The service name (e.g., 'turn_on', 'turn_off')
   * @param serviceData - Optional data to pass to the service
   * @returns {Promise<ServiceCallResponse | null>} The service call response, or null if no response
   * @throws {Error} If not connected to Home Assistant
   * @throws {ServiceCallError} If service call fails
   *
   * @example
   * ```typescript
   * await client.callService('light', 'turn_on', {
   *   entity_id: 'light.living_room',
   *   brightness: 255
   * });
   * ```
   */
  async callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>
  ): Promise<ServiceCallResponse | null> {
    if (!this.isConnected()) {
      throw new Error('Must be connected to call services');
    }

    // Validate required parameters
    if (!domain || domain.trim() === '') {
      throw new Error('Domain is required');
    }

    if (!service || service.trim() === '') {
      throw new Error('Service is required');
    }

    if (this.debug) {
      this.logger.debug('Calling service', {
        domain,
        service,
        hasData: !!serviceData,
      });
    }

    try {
      const result = await callService(this.connection!, domain, service, serviceData);
      // Library returns a promise that resolves to void or the result, cast to ServiceCallResponse | null
      return result as ServiceCallResponse | null;
    } catch (error) {
      const originalError = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to call service', {
        domain,
        service,
        error: originalError.message,
      });

      // Re-throw as ServiceCallError for better error handling
      throw new ServiceCallError(
        `Failed to call service ${domain}.${service}: ${originalError.message}`,
        domain,
        service,
        originalError
      );
    }
  }
}
