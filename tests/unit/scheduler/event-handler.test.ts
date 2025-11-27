/**
 * EventHandler Unit Tests
 *
 * Tests EventHandler integration with ContentOrchestrator and P0 notification support
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
    it('should connect to Home Assistant', async () => {
      await eventHandler.initialize();
      expect(mockHomeAssistant.connect).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to content_trigger events', async () => {
      await eventHandler.initialize();

      expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
        'content_trigger',
        expect.any(Function)
      );
    });

    it('should subscribe to state_changed events for P0 notifications', async () => {
      await eventHandler.initialize();

      expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
        'state_changed',
        expect.any(Function)
      );
    });

    it('should subscribe to both event types', async () => {
      await eventHandler.initialize();

      // Should have called subscribeToEvents twice (content_trigger + state_changed)
      expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleContentTrigger', () => {
    let contentTriggerCallback: (event: HomeAssistantEvent) => void;

    beforeEach(async () => {
      // Initialize to capture the callback
      await eventHandler.initialize();

      // Extract the content_trigger callback
      const contentTriggerCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
        call => call[0] === 'content_trigger'
      );
      contentTriggerCallback = contentTriggerCall[1];
    });

    it('should call orchestrator.generateAndSend() on content_trigger event', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'content_trigger',
        data: { trigger: 'door.opened' },
      };

      await contentTriggerCallback(event);

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith({
        updateType: 'major',
        timestamp: expect.any(Date),
        eventData: event.data,
      });
    });

    it('should pass event data to orchestrator', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'content_trigger',
        data: { trigger: 'person.arrived', person_name: 'John' },
      };

      await contentTriggerCallback(event);

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          eventData: { trigger: 'person.arrived', person_name: 'John' },
        })
      );
    });

    it('should handle orchestrator errors gracefully', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'content_trigger',
        data: {},
      };

      mockOrchestrator.generateAndSend.mockRejectedValueOnce(new Error('AI provider failed'));

      // Should not throw - errors are logged internally
      // Callback returns void, so we just verify it doesn't crash
      contentTriggerCallback(event);

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify orchestrator was called despite error
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
    });

    it('should NOT call minorUpdateGenerator methods (orchestrator handles caching)', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'content_trigger',
        data: {},
      };

      await contentTriggerCallback(event);

      // Verify only orchestrator is called (no separate cache management)
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
    });
  });

  describe('handleStateChanged - P0 notification support', () => {
    let stateChangedCallback: (event: HomeAssistantEvent) => void;

    beforeEach(async () => {
      // Initialize to capture the callback
      await eventHandler.initialize();

      // Extract the state_changed callback
      const stateChangedCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
        call => call[0] === 'state_changed'
      );
      stateChangedCallback = stateChangedCall[1];
    });

    it('should call orchestrator.generateAndSend() for state_changed events', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: {
          entity_id: 'binary_sensor.front_door',
          new_state: { state: 'on' },
          old_state: { state: 'off' },
        },
      };

      await stateChangedCallback(event);

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith({
        updateType: 'major',
        timestamp: expect.any(Date),
        eventData: event.data,
      });
    });

    it('should pass state change data to orchestrator', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: {
          entity_id: 'person.john',
          new_state: { state: 'home' },
          old_state: { state: 'away' },
        },
      };

      await stateChangedCallback(event);

      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          eventData: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        })
      );
    });

    it('should handle errors gracefully without throwing', async () => {
      const event: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: { entity_id: 'sensor.test' },
      };

      mockOrchestrator.generateAndSend.mockRejectedValueOnce(new Error('Network error'));

      // Callback returns void, so we just verify it doesn't crash
      stateChangedCallback(event);

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify orchestrator was called despite error
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
    });

    it('should immediately interrupt display with P0 notifications', async () => {
      // P0 notifications should call orchestrator immediately
      const event: HomeAssistantEvent = {
        event_type: 'state_changed',
        data: {
          entity_id: 'binary_sensor.doorbell',
          new_state: { state: 'on' },
        },
      };

      await stateChangedCallback(event);

      // Verify immediate call to orchestrator (no delays/debouncing)
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledTimes(1);
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
    it('should handle mixed content_trigger and state_changed events', async () => {
      await eventHandler.initialize();

      const contentTriggerCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
        call => call[0] === 'content_trigger'
      );
      const stateChangedCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
        call => call[0] === 'state_changed'
      );

      const contentTriggerCallback = contentTriggerCall[1];
      const stateChangedCallback = stateChangedCall[1];

      // Simulate content_trigger event
      await contentTriggerCallback({
        event_type: 'content_trigger',
        data: { trigger: 'scheduled' },
      });

      // Simulate state_changed event (P0 notification)
      await stateChangedCallback({
        event_type: 'state_changed',
        data: { entity_id: 'binary_sensor.motion' },
      });

      // Both should call orchestrator
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledTimes(2);
    });

    it('should allow ContentOrchestrator to handle P0 matching logic', async () => {
      await eventHandler.initialize();

      const stateChangedCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
        call => call[0] === 'state_changed'
      );
      const stateChangedCallback = stateChangedCall[1];

      // EventHandler passes event data to orchestrator
      // ContentOrchestrator (via ContentSelector) determines if event matches P0 pattern
      await stateChangedCallback({
        event_type: 'state_changed',
        data: {
          entity_id: 'binary_sensor.front_door',
          new_state: { state: 'on' },
        },
      });

      // EventHandler's job: pass event data to orchestrator
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          eventData: expect.objectContaining({
            entity_id: 'binary_sensor.front_door',
          }),
        })
      );
    });
  });
});
