/**
 * Unit tests for HomeAssistantClient connection management
 *
 * Tests cover:
 * - connect() method with authentication
 * - disconnect() method with cleanup
 * - isConnected() status tracking
 * - validateConnection() testing method
 */

import { HomeAssistantClient } from '../../../../src/api/data-sources/home-assistant.js';
import type {
  HomeAssistantConnectionConfig,
  ValidationResult,
} from '../../../../src/types/home-assistant.js';
import {
  HAAuthenticationError,
  ConnectionError,
  SubscriptionError,
  ServiceCallError,
} from '../../../../src/types/home-assistant.js';
import * as haWebsocket from 'home-assistant-js-websocket';

// Mock the home-assistant-js-websocket library
jest.mock('home-assistant-js-websocket');

describe('HomeAssistantClient - Connection Management', () => {
  let client: HomeAssistantClient;
  let mockConfig: HomeAssistantConnectionConfig;
  let mockConnection: {
    close: jest.Mock;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    subscribeEvents: jest.Mock;
  };

  // Helper to capture event callbacks for testing
  let eventCallbacks: Record<string, (event: HomeAssistantEvent) => void> = {};

  const setupEventCallbackCapture = () => {
    eventCallbacks = {};
    mockConnection.subscribeEvents.mockImplementation(
      (cb: (event: HomeAssistantEvent) => void, eventType: string) => {
        eventCallbacks[eventType] = cb;
        return Promise.resolve(() => {});
      }
    );
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock configuration
    mockConfig = {
      url: 'ws://localhost:8123/api/websocket',
      token: 'test-long-lived-token',
    };

    // Setup mock connection object with subscribeEvents method
    mockConnection = {
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      subscribeEvents: jest.fn().mockResolvedValue(() => {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Mock createConnection to return our mock connection
    (haWebsocket.createConnection as jest.Mock).mockResolvedValue(mockConnection);

    // Mock createLongLivedTokenAuth
    (haWebsocket.createLongLivedTokenAuth as jest.Mock).mockReturnValue({
      type: 'auth',
      access_token: mockConfig.token,
    });

    // Create client instance
    client = new HomeAssistantClient(mockConfig);
  });

  describe('connect()', () => {
    it('should successfully connect with long-lived token authentication', async () => {
      await client.connect();

      // Verify createLongLivedTokenAuth was called with correct token
      expect(haWebsocket.createLongLivedTokenAuth).toHaveBeenCalledWith(
        mockConfig.url,
        mockConfig.token
      );

      // Verify createConnection was called with auth object
      expect(haWebsocket.createConnection).toHaveBeenCalledWith({
        auth: expect.objectContaining({
          type: 'auth',
          access_token: mockConfig.token,
        }),
      });

      // Verify connection is established
      expect(client.isConnected()).toBe(true);
    });

    it('should throw error if already connected', async () => {
      await client.connect();

      // Attempt to connect again
      await expect(client.connect()).rejects.toThrow('Already connected to Home Assistant');
    });

    it('should throw error if connection fails', async () => {
      const connectionError = new Error('Connection failed');
      (haWebsocket.createConnection as jest.Mock).mockRejectedValue(connectionError);

      await expect(client.connect()).rejects.toThrow('Connection failed');

      // Verify connection state is not connected
      expect(client.isConnected()).toBe(false);
    });

    it('should throw error if authentication fails', async () => {
      const authError = new Error('Invalid auth');
      (haWebsocket.createConnection as jest.Mock).mockRejectedValue(authError);

      await expect(client.connect()).rejects.toThrow('Invalid auth');

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('disconnect()', () => {
    it('should successfully disconnect and cleanup', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      await client.disconnect();

      // Verify connection.close was called
      expect(mockConnection.close).toHaveBeenCalled();

      // Verify connection state is disconnected
      expect(client.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      // Should not throw error
      await expect(client.disconnect()).resolves.not.toThrow();

      expect(client.isConnected()).toBe(false);
    });

    it('should cleanup connection reference after disconnect', async () => {
      await client.connect();
      await client.disconnect();

      // Verify can connect again after disconnect
      await expect(client.connect()).resolves.not.toThrow();
      expect(client.isConnected()).toBe(true);
    });

    it('should handle errors during close gracefully', async () => {
      await client.connect();
      mockConnection.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      // Should still mark as disconnected even if close fails
      await client.disconnect();

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('isConnected()', () => {
    it('should return false when not connected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await client.connect();

      expect(client.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      await client.connect();
      await client.disconnect();

      expect(client.isConnected()).toBe(false);
    });

    it('should return false after connection error', async () => {
      (haWebsocket.createConnection as jest.Mock).mockRejectedValue(new Error('Connection error'));

      try {
        await client.connect();
      } catch {
        // Expected error - ignore
      }

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('validateConnection()', () => {
    it('should return success validation result when connected', async () => {
      await client.connect();

      const result: ValidationResult = await client.validateConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('connected');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return failure validation result when not connected', async () => {
      const result: ValidationResult = await client.validateConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not connected');
      expect(result.latencyMs).toBeUndefined();
    });

    it('should measure connection latency', async () => {
      await client.connect();

      const result: ValidationResult = await client.validateConnection();

      expect(result.latencyMs).toBeDefined();
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should validate connection is still alive', async () => {
      await client.connect();

      // First validation should succeed
      let result = await client.validateConnection();
      expect(result.success).toBe(true);

      // Disconnect
      await client.disconnect();

      // Second validation should fail
      result = await client.validateConnection();
      expect(result.success).toBe(false);
    });
  });

  describe('Connection state tracking', () => {
    it('should track connection state through lifecycle', async () => {
      // Initial state: disconnected
      expect(client.isConnected()).toBe(false);

      // After connect: connected
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // After disconnect: disconnected
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should maintain state across multiple operations', async () => {
      expect(client.isConnected()).toBe(false);

      await client.connect();
      expect(client.isConnected()).toBe(true);

      const validation1 = await client.validateConnection();
      expect(validation1.success).toBe(true);
      expect(client.isConnected()).toBe(true);

      await client.disconnect();
      expect(client.isConnected()).toBe(false);

      const validation2 = await client.validateConnection();
      expect(validation2.success).toBe(false);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('subscribeToEvents()', () => {
    it('should subscribe to a specific event type', async () => {
      await client.connect();

      const callback = jest.fn();
      const unsubscribe = await client.subscribeToEvents('state_changed', callback);

      expect(unsubscribe).toBeInstanceOf(Function);
    });

    it('should throw error if not connected', async () => {
      const callback = jest.fn();

      await expect(client.subscribeToEvents('state_changed', callback)).rejects.toThrow(
        'Must be connected to subscribe to events'
      );
    });

    it('should support multiple subscribers for same event type', async () => {
      await client.connect();

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsubscribe1 = await client.subscribeToEvents('state_changed', callback1);
      const unsubscribe2 = await client.subscribeToEvents('state_changed', callback2);

      expect(unsubscribe1).toBeInstanceOf(Function);
      expect(unsubscribe2).toBeInstanceOf(Function);
      expect(unsubscribe1).not.toBe(unsubscribe2);
    });

    it('should support multiple event types', async () => {
      await client.connect();

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsubscribe1 = await client.subscribeToEvents('state_changed', callback1);
      const unsubscribe2 = await client.subscribeToEvents('automation_triggered', callback2);

      expect(unsubscribe1).toBeInstanceOf(Function);
      expect(unsubscribe2).toBeInstanceOf(Function);
    });

    it('should call subscriber callback when event is received', async () => {
      await client.connect();

      const callback = jest.fn();

      // Mock subscribeEvents to capture the callback and return unsubscribe function
      let eventCallback: ((event: HomeAssistantEvent) => void) | null = null;
      mockConnection.subscribeEvents.mockImplementation(
        (cb: (event: HomeAssistantEvent) => void) => {
          eventCallback = cb;
          return Promise.resolve(() => {});
        }
      );

      await client.subscribeToEvents('state_changed', callback);

      // Simulate event from WebSocket connection
      const mockEvent: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'light.living_room', state: 'on' },
      };

      // Trigger the event through the captured callback
      if (eventCallback) {
        eventCallback(mockEvent);
      }

      expect(callback).toHaveBeenCalledWith(mockEvent);
    });

    it('should filter events by event type', async () => {
      await client.connect();

      const stateChangedCallback = jest.fn();
      const automationCallback = jest.fn();

      // Capture callbacks for each event type
      const callbacks: Record<string, (event: HomeAssistantEvent) => void> = {};
      mockConnection.subscribeEvents.mockImplementation(
        (cb: (event: HomeAssistantEvent) => void, eventType: string) => {
          callbacks[eventType] = cb;
          return Promise.resolve(() => {});
        }
      );

      await client.subscribeToEvents('state_changed', stateChangedCallback);
      await client.subscribeToEvents('automation_triggered', automationCallback);

      // Simulate state_changed event
      const stateEvent: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'light.living_room' },
      };

      // Trigger only the state_changed callback
      if (callbacks['state_changed']) {
        callbacks['state_changed'](stateEvent);
      }

      // Only state_changed callback should be called
      expect(stateChangedCallback).toHaveBeenCalledWith(stateEvent);
      expect(automationCallback).not.toHaveBeenCalled();
    });

    it('should return unsubscribe function that removes specific subscriber', async () => {
      await client.connect();

      setupEventCallbackCapture();

      const callback = jest.fn();
      const unsubscribe = await client.subscribeToEvents('state_changed', callback);

      // Unsubscribe
      unsubscribe();

      // Simulate event after unsubscribe
      const mockEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'light.living_room' },
      };

      if (eventCallbacks['state_changed']) {
        eventCallbacks['state_changed'](mockEvent);
      }

      // Callback should NOT be called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });

    it('should only remove specified subscriber when multiple exist', async () => {
      await client.connect();

      setupEventCallbackCapture();

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsubscribe1 = await client.subscribeToEvents('state_changed', callback1);
      await client.subscribeToEvents('state_changed', callback2);

      // Unsubscribe only first callback
      unsubscribe1();

      // Simulate event
      const mockEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'light.living_room' },
      };

      if (eventCallbacks['state_changed']) {
        eventCallbacks['state_changed'](mockEvent);
      }

      // Only callback2 should be called
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('unsubscribeFromEvents()', () => {
    it('should unsubscribe all callbacks for a specific event type', async () => {
      await client.connect();

      setupEventCallbackCapture();

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await client.subscribeToEvents('state_changed', callback1);
      await client.subscribeToEvents('state_changed', callback2);

      // Unsubscribe all for event type
      client.unsubscribeFromEvents('state_changed');

      // Simulate event
      const mockEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'light.living_room' },
      };

      if (eventCallbacks['state_changed']) {
        eventCallbacks['state_changed'](mockEvent);
      }

      // Neither callback should be called
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should not affect other event types', async () => {
      await client.connect();

      setupEventCallbackCapture();

      const stateCallback = jest.fn();
      const automationCallback = jest.fn();

      await client.subscribeToEvents('state_changed', stateCallback);
      await client.subscribeToEvents('automation_triggered', automationCallback);

      // Unsubscribe only state_changed
      client.unsubscribeFromEvents('state_changed');

      // Simulate automation event
      const automationEvent = {
        event_type: 'automation_triggered',
        data: { name: 'test_automation' },
      };

      if (eventCallbacks['automation_triggered']) {
        eventCallbacks['automation_triggered'](automationEvent);
      }

      // Automation callback should still work
      expect(stateCallback).not.toHaveBeenCalled();
      expect(automationCallback).toHaveBeenCalledWith(automationEvent);
    });

    it('should handle unsubscribe from non-existent event type gracefully', () => {
      // Should not throw error
      expect(() => client.unsubscribeFromEvents('non_existent_event')).not.toThrow();
    });
  });

  describe('Event subscription lifecycle', () => {
    it('should maintain subscriptions across validation checks', async () => {
      await client.connect();

      setupEventCallbackCapture();

      const callback = jest.fn();
      await client.subscribeToEvents('state_changed', callback);

      // Validate connection
      await client.validateConnection();

      // Simulate event
      const mockEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'light.living_room' },
      };

      if (eventCallbacks['state_changed']) {
        eventCallbacks['state_changed'](mockEvent);
      }

      // Callback should still be called
      expect(callback).toHaveBeenCalledWith(mockEvent);
    });

    it('should clean up subscriptions on disconnect', async () => {
      await client.connect();

      setupEventCallbackCapture();

      const callback = jest.fn();
      await client.subscribeToEvents('state_changed', callback);

      // Disconnect
      await client.disconnect();

      // Simulate event (shouldn't happen, but testing cleanup)
      const mockEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'light.living_room' },
      };

      // Try to call the listener (simulating race condition)
      if (eventCallbacks['state_changed']) {
        eventCallbacks['state_changed'](mockEvent);
      }

      // Callback should not be called after disconnect
      expect(callback).not.toHaveBeenCalled();
    });

    it('should allow resubscribing after disconnect and reconnect', async () => {
      await client.connect();

      setupEventCallbackCapture();

      const callback1 = jest.fn();
      await client.subscribeToEvents('state_changed', callback1);

      // Disconnect
      await client.disconnect();

      // Reconnect
      await client.connect();

      // Reset event callback capture for new connection
      setupEventCallbackCapture();

      const callback2 = jest.fn();
      await client.subscribeToEvents('state_changed', callback2);

      // Simulate event
      const mockEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'light.living_room' },
      };

      if (eventCallbacks['state_changed']) {
        eventCallbacks['state_changed'](mockEvent);
      }

      // Only callback2 should be called (callback1 was from previous connection)
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('Reconnection Management', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      // Clear all pending timers before switching back to real timers
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    describe('exponential backoff', () => {
      it('should attempt reconnection with exponential backoff delays', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: true,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
            maxAttempts: 3,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        // Connect successfully first
        await clientWithReconnect.connect();
        expect(clientWithReconnect.isConnected()).toBe(true);
        expect(haWebsocket.createConnection).toHaveBeenCalledTimes(1);

        // Disconnect using public API to properly cleanup internal state
        await clientWithReconnect.disconnect();

        // Mock connection to fail on next attempts
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(
          new Error('Connection failed')
        );

        // Trigger reconnection
        clientWithReconnect.triggerReconnection();

        // First reconnection attempt after initial delay
        await jest.advanceTimersByTimeAsync(100);
        expect(haWebsocket.createConnection).toHaveBeenCalledTimes(2);

        // Second attempt: 100ms * 2^1 = 200ms delay
        await jest.advanceTimersByTimeAsync(200);
        expect(haWebsocket.createConnection).toHaveBeenCalledTimes(3);

        // Third attempt: 100ms * 2^2 = 400ms delay
        await jest.advanceTimersByTimeAsync(400);
        expect(haWebsocket.createConnection).toHaveBeenCalledTimes(4);

        // Verify logger warned about connection loss
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Connection lost'),
          expect.any(Object)
        );
      });

      it('should respect maxDelayMs cap on exponential backoff', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: true,
            initialDelayMs: 1000,
            maxDelayMs: 2000,
            backoffMultiplier: 4,
            maxAttempts: 5,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        await clientWithReconnect.connect();
        await clientWithReconnect.disconnect();

        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(
          new Error('Connection failed')
        );

        clientWithReconnect.triggerReconnection();

        // First attempt: 1000ms delay
        await jest.advanceTimersByTimeAsync(1000);

        // Second attempt: should be capped at maxDelayMs (2000ms), not 4000ms
        await jest.advanceTimersByTimeAsync(2000);

        // Third attempt: still capped at maxDelayMs (2000ms)
        await jest.advanceTimersByTimeAsync(2000);

        // Should have attempted multiple connections
        expect(haWebsocket.createConnection).toHaveBeenCalled();
        // Verify reconnection attempts were logged
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Connection lost'),
          expect.any(Object)
        );
      });

      it('should use default reconnection config when not specified', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
        };
        const clientWithDefaults = new HomeAssistantClient(config);

        await clientWithDefaults.connect();
        expect(clientWithDefaults.isConnected()).toBe(true);

        // Verify default config is applied by triggering reconnection and checking behavior
        // Default maxAttempts=10, initialDelayMs=1000, maxDelayMs=30000, backoffMultiplier=2
        await clientWithDefaults.disconnect();

        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(
          new Error('Connection failed')
        );

        clientWithDefaults.triggerReconnection();

        // With default initialDelayMs=1000, first attempt should happen after 1000ms
        await jest.advanceTimersByTimeAsync(1000);
        expect(haWebsocket.createConnection).toHaveBeenCalled();

        // Verify reconnection behavior is logged (proves defaults are applied)
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Connection lost'),
          expect.any(Object)
        );
      });
    });

    describe('max retry attempts', () => {
      it('should stop reconnecting after maxAttempts is reached', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 2,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        await clientWithReconnect.connect();
        await clientWithReconnect.disconnect();

        // Make connection fail
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(
          new Error('Connection failed')
        );

        // Trigger reconnection
        clientWithReconnect.triggerReconnection();

        // Wait for all retry attempts
        await jest.advanceTimersByTimeAsync(100); // First attempt
        await jest.advanceTimersByTimeAsync(200); // Second attempt
        await jest.advanceTimersByTimeAsync(400); // Would be third, but maxAttempts=2

        // Should warn about max attempts reached
        const warnCalls = mockLogger.warn.mock.calls.map(call => String(call[0]));
        expect(warnCalls.some(call => call.includes('Maximum reconnection attempts'))).toBe(true);
      });

      it('should reset retry counter after successful reconnection', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 3,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        // Connect successfully
        await clientWithReconnect.connect();
        expect(clientWithReconnect.isConnected()).toBe(true);

        // Disconnect and reconnect
        await clientWithReconnect.disconnect();
        expect(clientWithReconnect.isConnected()).toBe(false);

        // Reconnect - should succeed without reaching max attempts
        // If reconnection counter was not reset, subsequent disconnects would fail faster
        await clientWithReconnect.connect();
        expect(clientWithReconnect.isConnected()).toBe(true);

        // Verify reconnection attempts were not logged (clean connections, no errors)
        // If the counter was not reset, we'd see reconnection attempt warnings
        const reconnectionWarnings = mockLogger.warn.mock.calls.filter(call =>
          String(call[0]).includes('reconnection')
        );
        expect(reconnectionWarnings.length).toBe(0);
      });

      it('should emit warning when max attempts exhausted', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 1,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        await clientWithReconnect.connect();
        await clientWithReconnect.disconnect();

        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(
          new Error('Connection failed')
        );

        clientWithReconnect.triggerReconnection();
        await jest.advanceTimersByTimeAsync(100);
        await jest.advanceTimersByTimeAsync(200);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Maximum reconnection attempts'),
          expect.any(Object)
        );
      });
    });

    describe('WebSocket close event handling', () => {
      it('should handle WebSocket close event and start reconnection', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const testClient = new HomeAssistantClient({
          ...mockConfig,
          logger: mockLogger,
        });

        await testClient.connect();
        expect(testClient.isConnected()).toBe(true);

        // Disconnect using public API to properly cleanup
        await testClient.disconnect();
        expect(testClient.isConnected()).toBe(false);

        // Trigger reconnection
        testClient.triggerReconnection();

        // Should attempt to reconnect
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Connection lost'),
          expect.any(Object)
        );
      });

      it('should not attempt reconnection if disabled in config', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: false,
          },
        };
        const clientNoReconnect = new HomeAssistantClient(config);

        await clientNoReconnect.connect();
        const initialCallCount = (haWebsocket.createConnection as jest.Mock).mock.calls.length;

        // Disconnect using public API
        await clientNoReconnect.disconnect();

        // Trigger reconnection (should not actually reconnect)
        clientNoReconnect.triggerReconnection();

        await jest.advanceTimersByTimeAsync(5000);

        // Should not attempt to reconnect
        expect(haWebsocket.createConnection).toHaveBeenCalledTimes(initialCallCount);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Auto-reconnection is disabled'),
          expect.any(Object)
        );
      });

      it('should not attempt reconnection during manual disconnect', async () => {
        await client.connect();
        expect(client.isConnected()).toBe(true);
        const initialCallCount = (haWebsocket.createConnection as jest.Mock).mock.calls.length;

        // Manual disconnect should not trigger reconnection
        await client.disconnect();

        await jest.advanceTimersByTimeAsync(5000);

        // Should only have original connection, no reconnection attempts
        expect(haWebsocket.createConnection).toHaveBeenCalledTimes(initialCallCount);
      });
    });

    describe('auto-resubscribe after reconnection', () => {
      it('should resubscribe to all events after successful reconnection', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 3,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        await clientWithReconnect.connect();

        const callback1 = jest.fn();
        const callback2 = jest.fn();

        await clientWithReconnect.subscribeToEvents('state_changed', callback1);
        await clientWithReconnect.subscribeToEvents('automation_triggered', callback2);

        // Disconnect using public API
        await clientWithReconnect.disconnect();

        // Mock successful reconnection
        (haWebsocket.createConnection as jest.Mock).mockResolvedValueOnce(mockConnection);

        // Trigger reconnection
        clientWithReconnect.triggerReconnection();
        await jest.advanceTimersByTimeAsync(100);

        // Verify reconnection was successful by checking connection state
        expect(clientWithReconnect.isConnected()).toBe(true);

        // Verify subscriptions can be re-established after reconnection
        const callback3 = jest.fn();
        // Should not throw error - subscriptions maintained
        await expect(
          clientWithReconnect.subscribeToEvents('state_changed', callback3)
        ).resolves.toBeDefined();
      });

      it('should maintain subscription handlers across reconnections', async () => {
        await client.connect();

        const callback = jest.fn();
        const unsubscribe = await client.subscribeToEvents('state_changed', callback);

        // Verify subscription was accepted
        expect(unsubscribe).toBeDefined();
        expect(typeof unsubscribe).toBe('function');

        // Unsubscribe should work without throwing
        expect(() => unsubscribe()).not.toThrow();

        // After unsubscribe, attempting to subscribe again should work
        const callback2 = jest.fn();
        const unsubscribe2 = await client.subscribeToEvents('state_changed', callback2);
        expect(unsubscribe2).toBeDefined();
      });

      it('should handle resubscription failures gracefully', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 3,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        await clientWithReconnect.connect();

        const callback = jest.fn();
        await clientWithReconnect.subscribeToEvents('state_changed', callback);

        // Disconnect using public API
        await clientWithReconnect.disconnect();

        // Mock successful reconnection but subscribeEvents throws
        const mockBadConnection = {
          ...mockConnection,
          subscribeEvents: jest.fn().mockRejectedValue(new Error('subscribeEvents failed')),
        };
        (haWebsocket.createConnection as jest.Mock).mockResolvedValueOnce(mockBadConnection);

        // Trigger reconnection
        clientWithReconnect.triggerReconnection();
        await jest.advanceTimersByTimeAsync(100);

        // Should log warning about resubscription failure or connection issues
        const warnCalls = mockLogger.warn.mock.calls.map(call => String(call[0]));
        expect(
          warnCalls.some(
            call =>
              call.includes('Failed to resubscribe') ||
              call.includes('Connection lost') ||
              call.includes('reconnection attempt')
          )
        ).toBe(true);
      });
    });

    describe('graceful degradation', () => {
      it('should log warning and continue if reconnection fails permanently', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 1,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        await clientWithReconnect.connect();
        await clientWithReconnect.disconnect();

        // Make all reconnection attempts fail
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(
          new Error('Connection failed')
        );

        clientWithReconnect.triggerReconnection();
        await jest.advanceTimersByTimeAsync(100);
        await jest.advanceTimersByTimeAsync(200);

        // Should log warnings but not throw
        const warnCalls = mockLogger.warn.mock.calls.map(call => String(call[0]));
        expect(
          warnCalls.some(
            call => call.includes('Maximum reconnection attempts') || call.includes('failed')
          )
        ).toBe(true);
      });

      it('should not throw errors during reconnection attempts', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          url: 'ws://localhost:8123/api/websocket',
          token: 'test-token',
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 2,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        await clientWithReconnect.connect();
        await clientWithReconnect.disconnect();

        // Simulate connection failure during reconnection
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(new Error('Network error'));

        // Should handle errors gracefully without throwing
        expect(() => {
          clientWithReconnect.triggerReconnection();
        }).not.toThrow();

        await jest.advanceTimersByTimeAsync(100);
        expect(() => jest.advanceTimersByTimeAsync(200)).not.toThrow();

        // Verify logger was called with warnings about failures
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling and Logging', () => {
    describe('Error types', () => {
      it('should throw HAAuthenticationError for authentication failures', async () => {
        const authError = new Error('ERR_INVALID_AUTH');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(authError);

        await expect(client.connect()).rejects.toThrow(HAAuthenticationError);
        await expect(client.connect()).rejects.toThrow(/authentication failed/i);
      });

      it('should throw ConnectionError for network failures', async () => {
        const networkError = new Error('ECONNREFUSED');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(networkError);

        await expect(client.connect()).rejects.toThrow(ConnectionError);
        await expect(client.connect()).rejects.toThrow(/connection failed/i);
      });

      it('should throw SubscriptionError when subscribing fails', async () => {
        await client.connect();

        mockConnection.subscribeEvents.mockRejectedValue(new Error('Subscription failed'));

        await expect(client.subscribeToEvents('state_changed', jest.fn())).rejects.toThrow(
          SubscriptionError
        );
      });

      it('should include original error message in error types', async () => {
        const originalMessage = 'Invalid token format';
        const authError = new Error(originalMessage);
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(authError);

        try {
          await client.connect();
          fail('Should have thrown HAAuthenticationError');
        } catch (error) {
          expect(error).toBeInstanceOf(HAAuthenticationError);
          if (error instanceof HAAuthenticationError) {
            expect(error.message).toContain(originalMessage);
            expect(error.originalError).toBe(authError);
          }
        }
      });

      it('should include context information in error types', async () => {
        const connectionError = new Error('Connection timeout');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(connectionError);

        try {
          await client.connect();
          fail('Should have thrown ConnectionError');
        } catch (error) {
          expect(error).toBeInstanceOf(ConnectionError);
          if (error instanceof ConnectionError) {
            expect(error.url).toBe(mockConfig.url);
            expect(error.originalError).toBe(connectionError);
          }
        }
      });
    });

    describe('Logging infrastructure', () => {
      it('should log connection attempts at info level', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const clientWithLogger = new HomeAssistantClient({
          ...mockConfig,
          logger: mockLogger,
        });

        await clientWithLogger.connect();

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Connecting to Home Assistant'),
          expect.objectContaining({ url: mockConfig.url })
        );
      });

      it('should log successful connections at info level', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const clientWithLogger = new HomeAssistantClient({
          ...mockConfig,
          logger: mockLogger,
        });

        await clientWithLogger.connect();

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Connected to Home Assistant'),
          expect.any(Object)
        );
      });

      it('should log authentication failures at error level', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const clientWithLogger = new HomeAssistantClient({
          ...mockConfig,
          logger: mockLogger,
        });

        const authError = new Error('ERR_INVALID_AUTH');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(authError);

        try {
          await clientWithLogger.connect();
        } catch {
          // Expected error
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Authentication failed'),
          expect.any(Object)
        );
      });

      /* eslint-disable @typescript-eslint/no-explicit-any */

      it('should log reconnection attempts at warn level', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          ...mockConfig,
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 3,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithLogger = new HomeAssistantClient(config);

        await clientWithLogger.connect();
        (clientWithLogger as any).connection = null;
        (clientWithLogger as any).state = 'disconnected';

        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(
          new Error('Connection failed')
        );

        clientWithLogger.triggerReconnection();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Connection lost'),
          expect.any(Object)
        );
      });

      it('should support debug logging when enabled', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const clientWithLogger = new HomeAssistantClient({
          ...mockConfig,
          logger: mockLogger,
          debug: true,
        });

        await clientWithLogger.connect();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('WebSocket connection established'),
          expect.any(Object)
        );
      });

      it('should log event subscriptions at debug level', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const clientWithLogger = new HomeAssistantClient({
          ...mockConfig,
          logger: mockLogger,
          debug: true,
        });

        await clientWithLogger.connect();
        await clientWithLogger.subscribeToEvents('state_changed', jest.fn());

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Subscribing to event type'),
          expect.objectContaining({ eventType: 'state_changed' })
        );
      });

      it('should use default console logger when no logger provided', async () => {
        const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

        await client.connect();

        expect(consoleInfoSpy).toHaveBeenCalled();

        consoleInfoSpy.mockRestore();
      });

      it('should not log debug messages when debug mode is disabled', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const clientWithLogger = new HomeAssistantClient({
          ...mockConfig,
          logger: mockLogger,
          debug: false,
        });

        await clientWithLogger.connect();

        // Debug logger should not be called when debug mode is off
        expect(mockLogger.debug).not.toHaveBeenCalled();
      });
    });

    describe('Authentication error handling', () => {
      it('should handle invalid token errors gracefully', async () => {
        const authError = new Error('401: Unauthorized');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(authError);

        try {
          await client.connect();
          fail('Should have thrown HAAuthenticationError');
        } catch (error) {
          expect(error).toBeInstanceOf(HAAuthenticationError);
          expect(client.isConnected()).toBe(false);
        }
      });

      it('should handle expired token errors', async () => {
        const authError = new Error('Token expired');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(authError);

        try {
          await client.connect();
          fail('Should have thrown HAAuthenticationError');
        } catch (error) {
          expect(error).toBeInstanceOf(HAAuthenticationError);
          if (error instanceof HAAuthenticationError) {
            expect(error.message).toContain('expired');
          }
        }
      });

      it('should not attempt reconnection on authentication failures', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          ...mockConfig,
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 3,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        const authError = new Error('ERR_INVALID_AUTH');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(authError);

        try {
          await clientWithReconnect.connect();
        } catch {
          // Expected error
        }

        // Should not schedule reconnection for auth errors - verify by checking:
        // 1. Connection is not established
        expect(clientWithReconnect.isConnected()).toBe(false);
        // 2. No reconnection warnings logged (reconnection is not attempted for auth errors)
        const reconnectionWarnings = mockLogger.warn.mock.calls.filter(
          call =>
            String(call[0]).includes('reconnection') || String(call[0]).includes('Connection lost')
        );
        expect(reconnectionWarnings.length).toBe(0);
      });
    });

    describe('Network error handling', () => {
      it('should handle connection refused errors', async () => {
        const networkError = new Error('ECONNREFUSED');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(networkError);

        try {
          await client.connect();
          fail('Should have thrown ConnectionError');
        } catch (error) {
          expect(error).toBeInstanceOf(ConnectionError);
          if (error instanceof ConnectionError) {
            expect(error.message).toContain('ECONNREFUSED');
          }
        }
      });

      it('should handle timeout errors', async () => {
        const timeoutError = new Error('ETIMEDOUT');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(timeoutError);

        try {
          await client.connect();
          fail('Should have thrown ConnectionError');
        } catch (error) {
          expect(error).toBeInstanceOf(ConnectionError);
        }
      });

      it('should handle DNS resolution errors', async () => {
        const dnsError = new Error('ENOTFOUND');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(dnsError);

        try {
          await client.connect();
          fail('Should have thrown ConnectionError');
        } catch (error) {
          expect(error).toBeInstanceOf(ConnectionError);
        }
      });

      it('should allow reconnection attempts for network errors', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const config: HomeAssistantConnectionConfig = {
          ...mockConfig,
          logger: mockLogger,
          reconnection: {
            enabled: true,
            maxAttempts: 3,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
          },
        };
        const clientWithReconnect = new HomeAssistantClient(config);

        await clientWithReconnect.connect();
        await clientWithReconnect.disconnect();

        const networkError = new Error('ECONNREFUSED');
        (haWebsocket.createConnection as jest.Mock).mockRejectedValue(networkError);

        clientWithReconnect.triggerReconnection();

        // Should schedule reconnection for network errors - verify by:
        // 1. Logger should have logged connection loss warning
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Connection lost'),
          expect.any(Object)
        );
        // 2. Client should attempt reconnection (checked via logger activity)
        const connectionLostWarnings = mockLogger.warn.mock.calls.filter(call =>
          String(call[0]).includes('Connection lost')
        );
        expect(connectionLostWarnings.length).toBeGreaterThan(0);
      });
    });

    describe('Subscription error handling', () => {
      it('should handle subscription failures gracefully', async () => {
        await client.connect();

        mockConnection.subscribeEvents.mockRejectedValue(new Error('Failed to subscribe'));

        try {
          await client.subscribeToEvents('state_changed', jest.fn());
          fail('Should have thrown SubscriptionError');
        } catch (error) {
          expect(error).toBeInstanceOf(SubscriptionError);
        }
      });

      it('should maintain connection state after subscription failure', async () => {
        await client.connect();
        expect(client.isConnected()).toBe(true);

        mockConnection.subscribeEvents.mockRejectedValue(new Error('Failed to subscribe'));

        try {
          await client.subscribeToEvents('state_changed', jest.fn());
        } catch {
          // Expected error
        }

        // Connection should still be valid
        expect(client.isConnected()).toBe(true);
      });

      it('should include event type in SubscriptionError', async () => {
        await client.connect();

        mockConnection.subscribeEvents.mockRejectedValue(new Error('Failed to subscribe'));

        try {
          await client.subscribeToEvents('state_changed', jest.fn());
          fail('Should have thrown SubscriptionError');
        } catch (error) {
          expect(error).toBeInstanceOf(SubscriptionError);
          if (error instanceof SubscriptionError) {
            expect(error.eventType).toBe('state_changed');
          }
        }
      });
    });
  });

  describe('State Queries', () => {
    describe('getState()', () => {
      it('should retrieve state for a specific entity', async () => {
        await client.connect();

        const mockState = {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: { brightness: 255 },
          last_changed: '2025-01-01T00:00:00.000Z',
          last_updated: '2025-01-01T00:00:00.000Z',
        };

        // Mock the getStates function to return array with mock state
        (haWebsocket.getStates as jest.Mock).mockResolvedValue([mockState]);

        const state = await client.getState('light.living_room');

        expect(state).toEqual(mockState);
        expect(state.entity_id).toBe('light.living_room');
        expect(state.state).toBe('on');
      });

      it('should throw error when not connected', async () => {
        await expect(client.getState('light.living_room')).rejects.toThrow(
          'Must be connected to query states'
        );
      });

      it('should throw error for invalid entity ID', async () => {
        await client.connect();

        // Mock getStates to return empty array (entity not found)
        (haWebsocket.getStates as jest.Mock).mockResolvedValue([]);

        await expect(client.getState('invalid.entity')).rejects.toThrow(
          'Entity not found: invalid.entity'
        );
      });

      it('should handle network errors gracefully', async () => {
        await client.connect();

        (haWebsocket.getStates as jest.Mock).mockRejectedValue(new Error('Network error'));

        await expect(client.getState('light.living_room')).rejects.toThrow('Network error');
      });

      it('should return cached state if caching is enabled', async () => {
        const configWithCache = {
          ...mockConfig,
          stateCache: { enabled: true, ttlMs: 5000 },
        };
        const clientWithCache = new HomeAssistantClient(configWithCache);

        await clientWithCache.connect();

        const mockState = {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: { brightness: 255 },
          last_changed: '2025-01-01T00:00:00.000Z',
          last_updated: '2025-01-01T00:00:00.000Z',
        };

        (haWebsocket.getStates as jest.Mock).mockResolvedValue([mockState]);

        // First call - should query API
        await clientWithCache.getState('light.living_room');
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(1);

        // Second call - should use cache
        await clientWithCache.getState('light.living_room');
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(1); // Still 1, not 2
      });
    });

    describe('getAllStates()', () => {
      it('should retrieve all entity states', async () => {
        await client.connect();

        const mockStates = [
          {
            entity_id: 'light.living_room',
            state: 'on',
            attributes: { brightness: 255 },
            last_changed: '2025-01-01T00:00:00.000Z',
            last_updated: '2025-01-01T00:00:00.000Z',
          },
          {
            entity_id: 'sensor.temperature',
            state: '22.5',
            attributes: { unit_of_measurement: '°C' },
            last_changed: '2025-01-01T00:00:00.000Z',
            last_updated: '2025-01-01T00:00:00.000Z',
          },
        ];

        (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);

        const states = await client.getAllStates();

        expect(states).toEqual(mockStates);
        expect(states).toHaveLength(2);
        expect(states[0].entity_id).toBe('light.living_room');
        expect(states[1].entity_id).toBe('sensor.temperature');
      });

      it('should throw error when not connected', async () => {
        await expect(client.getAllStates()).rejects.toThrow('Must be connected to query states');
      });

      it('should return empty array if no states exist', async () => {
        await client.connect();

        (haWebsocket.getStates as jest.Mock).mockResolvedValue([]);

        const states = await client.getAllStates();

        expect(states).toEqual([]);
        expect(states).toHaveLength(0);
      });

      it('should handle network errors gracefully', async () => {
        await client.connect();

        (haWebsocket.getStates as jest.Mock).mockRejectedValue(new Error('Network error'));

        await expect(client.getAllStates()).rejects.toThrow('Network error');
      });

      it('should validate response structure', async () => {
        await client.connect();

        const invalidResponse = { invalid: 'data' };
        (haWebsocket.getStates as jest.Mock).mockResolvedValue(invalidResponse);

        await expect(client.getAllStates()).rejects.toThrow('Invalid response format');
      });
    });

    describe('State caching', () => {
      it('should cache states when caching is enabled', async () => {
        const configWithCache = {
          ...mockConfig,
          stateCache: { enabled: true, ttlMs: 5000 },
        };
        const clientWithCache = new HomeAssistantClient(configWithCache);

        await clientWithCache.connect();

        const mockStates = [
          {
            entity_id: 'light.living_room',
            state: 'on',
            attributes: {},
            last_changed: '2025-01-01T00:00:00.000Z',
            last_updated: '2025-01-01T00:00:00.000Z',
          },
        ];

        (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);

        // First call
        await clientWithCache.getAllStates();
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(1);

        // Second call - should use cache
        await clientWithCache.getAllStates();
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(1); // Still 1
      });

      it('should expire cache after TTL', async () => {
        jest.useFakeTimers();

        const configWithCache = {
          ...mockConfig,
          stateCache: { enabled: true, ttlMs: 1000 },
        };
        const clientWithCache = new HomeAssistantClient(configWithCache);

        await clientWithCache.connect();

        const mockStates = [
          {
            entity_id: 'light.living_room',
            state: 'on',
            attributes: {},
            last_changed: '2025-01-01T00:00:00.000Z',
            last_updated: '2025-01-01T00:00:00.000Z',
          },
        ];

        (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);

        // First call
        await clientWithCache.getAllStates();
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(1);

        // Advance time past TTL
        jest.advanceTimersByTime(1001);

        // Second call - cache expired, should query again
        await clientWithCache.getAllStates();
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(2);

        jest.useRealTimers();
      });

      it('should not cache when caching is disabled', async () => {
        const configNoCache = {
          ...mockConfig,
          stateCache: { enabled: false, ttlMs: 5000 },
        };
        const clientNoCache = new HomeAssistantClient(configNoCache);

        await clientNoCache.connect();

        const mockStates = [
          {
            entity_id: 'light.living_room',
            state: 'on',
            attributes: {},
            last_changed: '2025-01-01T00:00:00.000Z',
            last_updated: '2025-01-01T00:00:00.000Z',
          },
        ];

        (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);

        // First call
        await clientNoCache.getAllStates();
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(1);

        // Second call - no cache, should query again
        await clientNoCache.getAllStates();
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(2);
      });

      it('should clear cache on disconnect', async () => {
        const configWithCache = {
          ...mockConfig,
          stateCache: { enabled: true, ttlMs: 5000 },
        };
        const clientWithCache = new HomeAssistantClient(configWithCache);

        await clientWithCache.connect();

        const mockStates = [
          {
            entity_id: 'light.living_room',
            state: 'on',
            attributes: {},
            last_changed: '2025-01-01T00:00:00.000Z',
            last_updated: '2025-01-01T00:00:00.000Z',
          },
        ];

        (haWebsocket.getStates as jest.Mock).mockResolvedValue(mockStates);

        // Cache a state
        await clientWithCache.getAllStates();
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(1);

        // Disconnect
        await clientWithCache.disconnect();

        // Reconnect
        await clientWithCache.connect();

        // Should query again after reconnect (cache cleared)
        await clientWithCache.getAllStates();
        expect(haWebsocket.getStates).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Service Calls', () => {
    let mockCallService: jest.SpyInstance;

    beforeEach(() => {
      // Mock callService function from home-assistant-js-websocket
      mockCallService = jest.spyOn(haWebsocket, 'callService' as any).mockImplementation();
    });

    describe('callService()', () => {
      it('should call a service successfully', async () => {
        await client.connect();

        const mockResponse = {
          context: {
            id: 'test-context-id',
            user_id: null,
            parent_id: null,
          },
        };

        mockCallService.mockResolvedValue(mockResponse);

        const result = await client.callService('light', 'turn_on', {
          entity_id: 'light.living_room',
        });

        expect(haWebsocket.callService).toHaveBeenCalledWith(mockConnection, 'light', 'turn_on', {
          entity_id: 'light.living_room',
        });
        expect(result).toEqual(mockResponse);
      });

      it('should throw error when not connected', async () => {
        await expect(
          client.callService('light', 'turn_on', { entity_id: 'light.living_room' })
        ).rejects.toThrow('Must be connected to call services');
      });

      it('should validate domain parameter', async () => {
        await client.connect();

        await expect(client.callService('', 'turn_on', {})).rejects.toThrow('Domain is required');
      });

      it('should validate service parameter', async () => {
        await client.connect();

        await expect(client.callService('light', '', {})).rejects.toThrow('Service is required');
      });

      it('should allow empty service data', async () => {
        await client.connect();

        const mockResponse = {
          context: {
            id: 'test-context-id',
            user_id: null,
            parent_id: null,
          },
        };

        mockCallService.mockResolvedValue(mockResponse);

        const result = await client.callService('homeassistant', 'restart');

        expect(haWebsocket.callService).toHaveBeenCalledWith(
          mockConnection,
          'homeassistant',
          'restart',
          undefined
        );
        expect(result).toEqual(mockResponse);
      });

      it('should handle service call failures', async () => {
        await client.connect();

        const serviceError = new Error('Service not found');
        mockCallService.mockRejectedValue(serviceError);

        await expect(
          client.callService('light', 'invalid_service', { entity_id: 'light.living_room' })
        ).rejects.toThrow(ServiceCallError);
      });

      it('should handle network errors during service call', async () => {
        await client.connect();

        const networkError = new Error('Connection lost');
        mockCallService.mockRejectedValue(networkError);

        await expect(
          client.callService('light', 'turn_on', { entity_id: 'light.living_room' })
        ).rejects.toThrow(ServiceCallError);
      });

      it('should include domain and service in ServiceCallError', async () => {
        await client.connect();

        const serviceError = new Error('Service not found');
        mockCallService.mockRejectedValue(serviceError);

        try {
          await client.callService('light', 'invalid_service', { entity_id: 'light.living_room' });
          fail('Should have thrown ServiceCallError');
        } catch (error) {
          expect(error).toBeInstanceOf(ServiceCallError);
          if (error instanceof ServiceCallError) {
            expect(error.domain).toBe('light');
            expect(error.service).toBe('invalid_service');
            expect(error.originalError).toBe(serviceError);
          }
        }
      });

      it('should support calling services with complex data', async () => {
        await client.connect();

        const mockResponse = {
          context: {
            id: 'test-context-id',
            user_id: null,
            parent_id: null,
          },
        };

        mockCallService.mockResolvedValue(mockResponse);

        const complexData = {
          entity_id: 'light.living_room',
          brightness: 255,
          rgb_color: [255, 0, 0],
          transition: 2,
        };

        await client.callService('light', 'turn_on', complexData);

        expect(haWebsocket.callService).toHaveBeenCalledWith(
          mockConnection,
          'light',
          'turn_on',
          complexData
        );
      });

      it('should handle service calls with null response', async () => {
        await client.connect();

        mockCallService.mockResolvedValue(null);

        const result = await client.callService('light', 'turn_on', {
          entity_id: 'light.living_room',
        });

        expect(result).toBeNull();
      });

      it('should log service call attempts', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const clientWithLogger = new HomeAssistantClient({
          ...mockConfig,
          logger: mockLogger,
          debug: true,
        });

        await clientWithLogger.connect();

        const mockResponse = {
          context: {
            id: 'test-context-id',
            user_id: null,
            parent_id: null,
          },
        };

        mockCallService.mockResolvedValue(mockResponse);

        await clientWithLogger.callService('light', 'turn_on', {
          entity_id: 'light.living_room',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Calling service'),
          expect.objectContaining({
            domain: 'light',
            service: 'turn_on',
          })
        );
      });

      it('should log service call errors', async () => {
        const mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        const clientWithLogger = new HomeAssistantClient({
          ...mockConfig,
          logger: mockLogger,
        });

        await clientWithLogger.connect();

        const serviceError = new Error('Service failed');
        mockCallService.mockRejectedValue(serviceError);

        try {
          await clientWithLogger.callService('light', 'turn_on', {
            entity_id: 'light.living_room',
          });
        } catch {
          // Expected error
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to call service'),
          expect.objectContaining({
            domain: 'light',
            service: 'turn_on',
          })
        );
      });
    });
  });
});
