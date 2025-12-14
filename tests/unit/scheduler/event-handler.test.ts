/**
 * EventHandler Unit Tests
 *
 * Tests EventHandler integration with ContentOrchestrator via vestaboard_refresh events
 */

import { EventHandler } from '../../../src/scheduler/event-handler.js';
import type { HomeAssistantClient } from '../../../src/api/data-sources/index.js';
import type { ContentOrchestrator } from '../../../src/content/orchestrator.js';
import type { HomeAssistantEvent } from '../../../src/types/home-assistant.js';

describe('EventHandler', () => {
  let mockHomeAssistant: jest.Mocked<HomeAssistantClient>;
  let mockOrchestrator: jest.Mocked<ContentOrchestrator>;
  let eventHandler: EventHandler;

  beforeEach(() => {
    // Create mock HomeAssistantClient
    mockHomeAssistant = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      subscribeToEvents: jest.fn().mockResolvedValue(() => {}),
      getState: jest.fn(),
      callService: jest.fn(),
      validateConnection: jest.fn(),
    } as unknown as jest.Mocked<HomeAssistantClient>;

    // Create mock ContentOrchestrator
    mockOrchestrator = {
      generateAndSend: jest.fn().mockResolvedValue(undefined),
      getCachedContent: jest.fn().mockReturnValue(null),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<ContentOrchestrator>;

    eventHandler = new EventHandler(mockHomeAssistant, mockOrchestrator);
  });

  describe('constructor', () => {
    it('should accept HomeAssistantClient and ContentOrchestrator', () => {
      expect(eventHandler).toBeInstanceOf(EventHandler);
    });

    it('should store orchestrator reference', () => {
      // This test validates that the constructor properly stores the orchestrator
      // We'll verify this indirectly through initialize() behavior
      expect(eventHandler).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should subscribe to vestaboard_refresh events', async () => {
      await eventHandler.initialize();

      expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
        'vestaboard_refresh',
        expect.any(Function)
      );
    });

    it('should subscribe to only one event type', async () => {
      await eventHandler.initialize();

      // Should have called subscribeToEvents once (vestaboard_refresh only)
      expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledTimes(1);
    });

    it('should NOT subscribe to state_changed events', async () => {
      await eventHandler.initialize();

      // Verify no state_changed subscription
      const calls = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls;
      const stateChangedCall = calls.find(call => call[0] === 'state_changed');
      expect(stateChangedCall).toBeUndefined();
    });
  });

  describe('handleRefreshTrigger', () => {
    let refreshCallback: (event: HomeAssistantEvent) => void;

    beforeEach(async () => {
      // Initialize to capture the callback
      await eventHandler.initialize();

      // Extract the vestaboard_refresh callback
      const refreshCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
        call => call[0] === 'vestaboard_refresh'
      );
      refreshCallback = refreshCall[1];
    });

    it('should call orchestrator.generateAndSend() on vestaboard_refresh event', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'vestaboard_refresh',
        data: { trigger: 'manual' },
      };

      await refreshCallback(event);

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith({
        updateType: 'major',
        timestamp: expect.any(Date),
        eventData: event.data,
      });
    });

    it('should pass event data to orchestrator', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'vestaboard_refresh',
        data: { trigger: 'person_arrived', person: 'John' },
      };

      await refreshCallback(event);

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          eventData: { trigger: 'person_arrived', person: 'John' },
        })
      );
    });

    it('should handle orchestrator errors gracefully', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'vestaboard_refresh',
        data: {},
      };

      mockOrchestrator.generateAndSend.mockRejectedValueOnce(new Error('AI provider failed'));

      // Should not throw - errors are logged internally
      // Callback returns void, so we just verify it doesn't crash
      refreshCallback(event);

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify orchestrator was called despite error
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
    });

    it('should work with empty event data', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'vestaboard_refresh',
        data: {},
      };

      await refreshCallback(event);

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          updateType: 'major',
          eventData: {},
        })
      );
    });
  });

  describe('shutdown', () => {
    it('should disconnect from Home Assistant', async () => {
      await eventHandler.shutdown();
      expect(mockHomeAssistant.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle shutdown gracefully even if not initialized', async () => {
      const handler = new EventHandler(mockHomeAssistant, mockOrchestrator);
      await expect(handler.shutdown()).resolves.not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple vestaboard_refresh events', async () => {
      await eventHandler.initialize();

      const refreshCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
        call => call[0] === 'vestaboard_refresh'
      );
      const refreshCallback = refreshCall[1];

      // Simulate multiple refresh events
      await refreshCallback({
        event_type: 'vestaboard_refresh',
        data: { trigger: 'scheduled' },
      });

      await refreshCallback({
        event_type: 'vestaboard_refresh',
        data: { trigger: 'manual' },
      });

      // Both should call orchestrator
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledTimes(2);
    });

    it('should include timestamp in orchestrator call', async () => {
      await eventHandler.initialize();

      const refreshCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
        call => call[0] === 'vestaboard_refresh'
      );
      const refreshCallback = refreshCall[1];

      const beforeCall = new Date();
      await refreshCallback({
        event_type: 'vestaboard_refresh',
        data: {},
      });
      const afterCall = new Date();

      const callArgs = mockOrchestrator.generateAndSend.mock.calls[0][0];
      expect(callArgs.timestamp).toBeInstanceOf(Date);
      expect(callArgs.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(callArgs.timestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });
});
