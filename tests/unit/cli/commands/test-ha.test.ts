/**
 * test-ha CLI Command Unit Tests
 *
 * Tests the Home Assistant connectivity testing CLI command.
 */

import { testHACommand } from '../../../../src/cli/commands/test-ha.js';
import { HomeAssistantClient } from '../../../../src/api/data-sources/home-assistant.js';
import type { HassEntityState } from '../../../../src/types/home-assistant.js';

// Mock HomeAssistantClient
jest.mock('../../../../src/api/data-sources/home-assistant.js');

describe('test-ha CLI Command', () => {
  let mockClient: jest.Mocked<HomeAssistantClient>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create mock client instance
    mockClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn(),
      validateConnection: jest.fn(),
      getAllStates: jest.fn(),
      getState: jest.fn(),
      subscribeToEvents: jest.fn(),
    } as unknown as jest.Mocked<HomeAssistantClient>;

    // Mock the constructor
    (HomeAssistantClient as jest.MockedClass<typeof HomeAssistantClient>).mockImplementation(
      () => mockClient
    );

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Setup default environment
    process.env.HA_URL = 'ws://homeassistant.local:8123/api/websocket';
    process.env.HA_TOKEN = 'test-token-123';
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.isConnected.mockReturnValue(true);
      mockClient.validateConnection.mockResolvedValue({
        success: true,
        message: 'Successfully connected',
        latencyMs: 45,
      });
      mockClient.disconnect.mockResolvedValue(undefined);

      await testHACommand({});

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.validateConnection).toHaveBeenCalled();
      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓'));
    });

    it('should handle connection failure gracefully', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockClient.disconnect.mockResolvedValue(undefined);

      await testHACommand({});

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('✗'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
    });

    it('should show helpful diagnostics on authentication error', async () => {
      const authError = new Error('ERR_INVALID_AUTH');
      mockClient.connect.mockRejectedValue(authError);
      mockClient.disconnect.mockResolvedValue(undefined);

      await testHACommand({});

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ERR_INVALID_AUTH'));
    });

    it('should handle missing environment variables', async () => {
      delete process.env.HA_URL;
      delete process.env.HA_TOKEN;

      await testHACommand({});

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('HA_URL'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('HA_TOKEN'));
      expect(mockClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('--list Option', () => {
    it('should list all entities', async () => {
      const mockStates: HassEntityState[] = [
        {
          entity_id: 'light.living_room',
          state: 'on',
          attributes: { brightness: 255 },
          last_changed: '2024-01-01T00:00:00Z',
          last_updated: '2024-01-01T00:00:00Z',
        },
        {
          entity_id: 'switch.kitchen',
          state: 'off',
          attributes: {},
          last_changed: '2024-01-01T00:00:00Z',
          last_updated: '2024-01-01T00:00:00Z',
        },
      ];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.isConnected.mockReturnValue(true);
      mockClient.validateConnection.mockResolvedValue({ success: true, message: 'OK' });
      mockClient.getAllStates.mockResolvedValue(mockStates);
      mockClient.disconnect.mockResolvedValue(undefined);

      await testHACommand({ list: true });

      expect(mockClient.getAllStates).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('light.living_room'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('switch.kitchen'));
    });

    it('should handle empty entity list', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.isConnected.mockReturnValue(true);
      mockClient.validateConnection.mockResolvedValue({ success: true, message: 'OK' });
      mockClient.getAllStates.mockResolvedValue([]);
      mockClient.disconnect.mockResolvedValue(undefined);

      await testHACommand({ list: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No entities found'));
    });
  });

  describe('--entity Option', () => {
    it('should get specific entity state', async () => {
      const mockState: HassEntityState = {
        entity_id: 'light.living_room',
        state: 'on',
        attributes: { brightness: 200, color_temp: 370 },
        last_changed: '2024-01-01T00:00:00Z',
        last_updated: '2024-01-01T00:00:00Z',
      };

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.isConnected.mockReturnValue(true);
      mockClient.validateConnection.mockResolvedValue({ success: true, message: 'OK' });
      mockClient.getState.mockResolvedValue(mockState);
      mockClient.disconnect.mockResolvedValue(undefined);

      await testHACommand({ entity: 'light.living_room' });

      expect(mockClient.getState).toHaveBeenCalledWith('light.living_room');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('light.living_room'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('on'));
    });

    it('should handle entity not found', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.isConnected.mockReturnValue(true);
      mockClient.validateConnection.mockResolvedValue({ success: true, message: 'OK' });
      mockClient.getState.mockRejectedValue(new Error('Entity not found: light.invalid'));
      mockClient.disconnect.mockResolvedValue(undefined);

      await testHACommand({ entity: 'light.invalid' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });
  });

  describe('--watch Option', () => {
    it('should subscribe to events for 30 seconds', async () => {
      jest.useFakeTimers();

      const mockUnsubscribe = jest.fn();
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.isConnected.mockReturnValue(true);
      mockClient.validateConnection.mockResolvedValue({ success: true, message: 'OK' });
      mockClient.subscribeToEvents.mockResolvedValue(mockUnsubscribe);
      mockClient.disconnect.mockResolvedValue(undefined);

      const commandPromise = testHACommand({ watch: 'state_changed' });

      // Fast-forward time and run all pending timers/promises
      await jest.advanceTimersByTimeAsync(30000);

      await commandPromise;

      expect(mockClient.subscribeToEvents).toHaveBeenCalledWith(
        'state_changed',
        expect.any(Function)
      );
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockClient.disconnect).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should display received events', async () => {
      jest.useFakeTimers();

      let eventCallback: ((event: unknown) => void) | undefined;
      const mockUnsubscribe = jest.fn();

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.isConnected.mockReturnValue(true);
      mockClient.validateConnection.mockResolvedValue({ success: true, message: 'OK' });
      mockClient.subscribeToEvents.mockImplementation(async (eventType, callback) => {
        eventCallback = callback as (event: unknown) => void;
        return mockUnsubscribe;
      });
      mockClient.disconnect.mockResolvedValue(undefined);

      const commandPromise = testHACommand({ watch: 'state_changed' });

      // Wait for subscription to be set up
      await jest.advanceTimersByTimeAsync(0);

      // Simulate event
      if (eventCallback) {
        eventCallback({
          event_type: 'state_changed',
          data: { entity_id: 'light.living_room', new_state: { state: 'on' } },
        });
      }

      // Fast-forward time
      await jest.advanceTimersByTimeAsync(30000);

      await commandPromise;

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('state_changed'));

      jest.useRealTimers();
    });

    it('should handle subscription errors', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.isConnected.mockReturnValue(true);
      mockClient.validateConnection.mockResolvedValue({ success: true, message: 'OK' });
      mockClient.subscribeToEvents.mockRejectedValue(new Error('Subscription failed'));
      mockClient.disconnect.mockResolvedValue(undefined);

      await testHACommand({ watch: 'invalid_event' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Subscription failed'));
    });
  });

  describe('Output Formatting', () => {
    it('should use green color for success messages', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.validateConnection.mockResolvedValue({
        success: true,
        message: 'Success',
        latencyMs: 50,
      });
      mockClient.disconnect.mockResolvedValue(undefined);

      await testHACommand({});

      // Check for ANSI green color code
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m'));
    });

    it('should use red color for error messages', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      await testHACommand({});

      // Check for ANSI red color code
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[31m'));
    });
  });
});
