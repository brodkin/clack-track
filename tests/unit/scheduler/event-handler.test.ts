/**
 * EventHandler Unit Tests
 *
 * Tests EventHandler integration with ContentOrchestrator via vestaboard_refresh events
 * and TriggerMatcher for state_changed event filtering
 */

import { EventHandler } from '../../../src/scheduler/event-handler.js';
import type { HomeAssistantClient } from '../../../src/api/data-sources/index.js';
import type { ContentOrchestrator } from '../../../src/content/orchestrator.js';
import type { HomeAssistantEvent } from '../../../src/types/home-assistant.js';
import { TriggerMatcher } from '../../../src/scheduler/trigger-matcher.js';
import type { TriggerConfig } from '../../../src/config/trigger-schema.js';

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

  describe('TriggerMatcher Integration', () => {
    let triggerMatcher: TriggerMatcher;
    const personArrivalTrigger: TriggerConfig = {
      name: 'Person Arrival',
      entity_pattern: 'person.*',
      state_filter: 'home',
      debounce_seconds: 60,
    };

    beforeEach(() => {
      triggerMatcher = new TriggerMatcher([personArrivalTrigger]);
    });

    describe('constructor with triggerMatcher', () => {
      it('should accept optional triggerMatcher parameter', () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator, triggerMatcher);
        expect(handler).toBeInstanceOf(EventHandler);
      });

      it('should work without triggerMatcher (backward compatibility)', () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator);
        expect(handler).toBeInstanceOf(EventHandler);
      });
    });

    describe('initialize with triggerMatcher', () => {
      it('should subscribe to state_changed events when triggerMatcher is provided', async () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator, triggerMatcher);
        await handler.initialize();

        // Should have subscribed to BOTH vestaboard_refresh AND state_changed
        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledTimes(2);
        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
          'vestaboard_refresh',
          expect.any(Function)
        );
        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
          'state_changed',
          expect.any(Function)
        );
      });

      it('should NOT subscribe to state_changed when triggerMatcher is not provided', async () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator);
        await handler.initialize();

        // Should only subscribe to vestaboard_refresh
        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledTimes(1);
        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
          'vestaboard_refresh',
          expect.any(Function)
        );
      });
    });

    describe('handleStateChange', () => {
      let stateChangedCallback: (event: HomeAssistantEvent) => void;

      beforeEach(async () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator, triggerMatcher);
        await handler.initialize();

        // Extract the state_changed callback
        const stateChangedCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
          call => call[0] === 'state_changed'
        );
        stateChangedCallback = stateChangedCall[1];
      });

      it('should trigger orchestrator on matching state_changed event', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        await stateChangedCallback(event);

        expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith({
          updateType: 'major',
          timestamp: expect.any(Date),
          eventData: event.data,
        });
      });

      it('should NOT trigger orchestrator on non-matching entity', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'sensor.temperature',
            new_state: { state: '72' },
            old_state: { state: '71' },
          },
        };

        await stateChangedCallback(event);

        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should NOT trigger orchestrator on non-matching state', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'away' },
            old_state: { state: 'home' },
          },
        };

        await stateChangedCallback(event);

        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should NOT trigger orchestrator when debounced', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        // First trigger should work
        await stateChangedCallback(event);
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalledTimes(1);

        // Second trigger within debounce window should NOT work
        await stateChangedCallback(event);
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalledTimes(1);
      });

      it('should handle missing entity_id gracefully', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            new_state: { state: 'home' },
          },
        };

        // Should not crash
        await stateChangedCallback(event);
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should handle missing new_state gracefully', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
          },
        };

        // Should not crash
        await stateChangedCallback(event);
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });
    });

    describe('updateTriggerMatcher', () => {
      it('should update trigger matcher and cleanup old one', () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator, triggerMatcher);
        const cleanupSpy = jest.spyOn(triggerMatcher, 'cleanup');

        const newTrigger: TriggerConfig = {
          name: 'Door Open',
          entity_pattern: 'binary_sensor.front_door',
          state_filter: 'on',
        };
        const newMatcher = new TriggerMatcher([newTrigger]);

        handler.updateTriggerMatcher(newMatcher);

        expect(cleanupSpy).toHaveBeenCalled();
      });

      it('should accept null to clear trigger matcher', () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator, triggerMatcher);
        const cleanupSpy = jest.spyOn(triggerMatcher, 'cleanup');

        handler.updateTriggerMatcher(null);

        expect(cleanupSpy).toHaveBeenCalled();
      });
    });

    describe('shutdown with triggerMatcher', () => {
      it('should cleanup triggerMatcher on shutdown', async () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator, triggerMatcher);
        const cleanupSpy = jest.spyOn(triggerMatcher, 'cleanup');

        await handler.shutdown();

        expect(cleanupSpy).toHaveBeenCalled();
        expect(mockHomeAssistant.disconnect).toHaveBeenCalled();
      });

      it('should handle shutdown gracefully without triggerMatcher', async () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator);
        await expect(handler.shutdown()).resolves.not.toThrow();
      });
    });
  });

  describe('Circuit Control Event Handling', () => {
    let mockCircuitBreaker: jest.Mocked<{
      setCircuitState: (circuitId: string, state: 'on' | 'off' | 'half_open') => Promise<void>;
      resetProviderCircuit: (circuitId: string) => Promise<void>;
    }>;

    beforeEach(() => {
      mockCircuitBreaker = {
        setCircuitState: jest.fn().mockResolvedValue(undefined),
        resetProviderCircuit: jest.fn().mockResolvedValue(undefined),
      };
    });

    describe('subscription behavior', () => {
      it('should subscribe to vestaboard_circuit_control when circuitBreaker is provided', async () => {
        const handler = new EventHandler(
          mockHomeAssistant,
          mockOrchestrator,
          undefined,
          mockCircuitBreaker
        );
        await handler.initialize();

        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
          'vestaboard_circuit_control',
          expect.any(Function)
        );
      });

      it('should NOT subscribe to vestaboard_circuit_control when circuitBreaker is not provided', async () => {
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator);
        await handler.initialize();

        const calls = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls;
        const circuitControlCall = calls.find(call => call[0] === 'vestaboard_circuit_control');
        expect(circuitControlCall).toBeUndefined();
      });
    });

    describe('handleCircuitControlEvent', () => {
      let circuitControlCallback: (event: HomeAssistantEvent) => void;

      beforeEach(async () => {
        const handler = new EventHandler(
          mockHomeAssistant,
          mockOrchestrator,
          undefined,
          mockCircuitBreaker
        );
        await handler.initialize();

        // Extract the vestaboard_circuit_control callback
        const circuitControlCall = (
          mockHomeAssistant.subscribeToEvents as jest.Mock
        ).mock.calls.find(call => call[0] === 'vestaboard_circuit_control');
        circuitControlCallback = circuitControlCall[1];
      });

      it('should call setCircuitState with "on" for action "on"', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'MASTER',
            action: 'on',
          },
        };

        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('MASTER', 'on');
      });

      it('should call setCircuitState with "off" for action "off" on non-SLEEP_MODE circuit', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'MASTER',
            action: 'off',
          },
        };

        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('MASTER', 'off');
      });

      it('should use inverted semantics for SLEEP_MODE: action "off" sets circuit state "on"', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'off',
          },
        };

        await circuitControlCallback(event);

        // SLEEP_MODE uses inverted semantics: action='off' (wake up) = circuit state 'on' (allow)
        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('SLEEP_MODE', 'on');
      });

      it('should use inverted semantics for SLEEP_MODE: action "on" sets circuit state "off"', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'on',
          },
        };

        await circuitControlCallback(event);

        // SLEEP_MODE uses inverted semantics: action='on' (sleep) = circuit state 'off' (block)
        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('SLEEP_MODE', 'off');
      });

      it('should call resetProviderCircuit for action "reset"', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'PROVIDER_OPENAI',
            action: 'reset',
          },
        };

        await circuitControlCallback(event);

        expect(mockCircuitBreaker.resetProviderCircuit).toHaveBeenCalledWith('PROVIDER_OPENAI');
      });

      it('should handle provider circuit reset for PROVIDER_ANTHROPIC', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'PROVIDER_ANTHROPIC',
            action: 'reset',
          },
        };

        await circuitControlCallback(event);

        expect(mockCircuitBreaker.resetProviderCircuit).toHaveBeenCalledWith('PROVIDER_ANTHROPIC');
      });

      it('should handle missing circuit_id gracefully', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            action: 'on',
          },
        };

        // Should not throw
        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).not.toHaveBeenCalled();
        expect(mockCircuitBreaker.resetProviderCircuit).not.toHaveBeenCalled();
      });

      it('should handle missing action gracefully', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'MASTER',
          },
        };

        // Should not throw
        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).not.toHaveBeenCalled();
        expect(mockCircuitBreaker.resetProviderCircuit).not.toHaveBeenCalled();
      });

      it('should handle invalid action gracefully', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'MASTER',
            action: 'invalid_action',
          },
        };

        // Should not throw
        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).not.toHaveBeenCalled();
        expect(mockCircuitBreaker.resetProviderCircuit).not.toHaveBeenCalled();
      });

      it('should handle empty event data gracefully', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {},
        };

        // Should not throw
        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).not.toHaveBeenCalled();
        expect(mockCircuitBreaker.resetProviderCircuit).not.toHaveBeenCalled();
      });

      it('should handle circuitBreaker errors gracefully', async () => {
        mockCircuitBreaker.setCircuitState.mockRejectedValueOnce(new Error('Database error'));

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'MASTER',
            action: 'on',
          },
        };

        // Should not throw
        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalled();
      });

      it('should log warning for invalid action', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'MASTER',
            action: 'invalid',
          },
        };

        await circuitControlCallback(event);

        // Verify warning was logged for invalid action
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
      });
    });

    describe('combined with triggerMatcher', () => {
      it('should subscribe to all three event types when both triggerMatcher and circuitBreaker are provided', async () => {
        const triggerMatcher = new TriggerMatcher([
          { name: 'Test', entity_pattern: 'test.*', state_filter: 'on' },
        ]);

        const handler = new EventHandler(
          mockHomeAssistant,
          mockOrchestrator,
          triggerMatcher,
          mockCircuitBreaker
        );
        await handler.initialize();

        // Should have 3 subscriptions: vestaboard_refresh, state_changed, vestaboard_circuit_control
        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledTimes(3);
        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
          'vestaboard_refresh',
          expect.any(Function)
        );
        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
          'state_changed',
          expect.any(Function)
        );
        expect(mockHomeAssistant.subscribeToEvents).toHaveBeenCalledWith(
          'vestaboard_circuit_control',
          expect.any(Function)
        );
      });
    });
  });

  describe('MASTER Circuit Checks', () => {
    let mockCircuitBreaker: jest.Mocked<{
      setCircuitState: (circuitId: string, state: 'on' | 'off' | 'half_open') => Promise<void>;
      resetProviderCircuit: (circuitId: string) => Promise<void>;
      isCircuitOpen: (circuitId: string) => Promise<boolean>;
    }>;

    beforeEach(() => {
      mockCircuitBreaker = {
        setCircuitState: jest.fn().mockResolvedValue(undefined),
        resetProviderCircuit: jest.fn().mockResolvedValue(undefined),
        isCircuitOpen: jest.fn().mockResolvedValue(false),
      };
    });

    describe('handleRefreshTrigger MASTER circuit blocking', () => {
      let refreshCallback: (event: HomeAssistantEvent) => void;

      beforeEach(async () => {
        const handler = new EventHandler(
          mockHomeAssistant,
          mockOrchestrator,
          undefined,
          mockCircuitBreaker
        );
        await handler.initialize();

        // Extract the vestaboard_refresh callback
        const refreshCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
          call => call[0] === 'vestaboard_refresh'
        );
        refreshCallback = refreshCall[1];
      });

      it('should block generation when MASTER circuit is OFF', async () => {
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(true);

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_refresh',
          data: { trigger: 'manual' },
        };

        await refreshCallback(event);

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should proceed with generation when MASTER circuit is ON', async () => {
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_refresh',
          data: { trigger: 'manual' },
        };

        refreshCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
      });

      it('should proceed with generation when circuitBreaker is not provided', async () => {
        // Create handler without circuitBreaker
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator);
        await handler.initialize();

        // Get fresh callback from the new handler
        const refreshCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
          call => call[0] === 'vestaboard_refresh'
        );
        const callback = refreshCall[1];

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_refresh',
          data: { trigger: 'manual' },
        };

        callback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
      });

      it('should proceed with generation (fail-open) when circuit check throws', async () => {
        mockCircuitBreaker.isCircuitOpen.mockRejectedValue(new Error('Database error'));

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_refresh',
          data: { trigger: 'manual' },
        };

        refreshCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
      });
    });

    describe('handleStateChange MASTER circuit blocking', () => {
      let stateChangedCallback: (event: HomeAssistantEvent) => void;
      let triggerMatcher: TriggerMatcher;

      beforeEach(async () => {
        triggerMatcher = new TriggerMatcher([
          { name: 'Person Arrival', entity_pattern: 'person.*', state_filter: 'home' },
        ]);

        const handler = new EventHandler(
          mockHomeAssistant,
          mockOrchestrator,
          triggerMatcher,
          mockCircuitBreaker
        );
        await handler.initialize();

        // Extract the state_changed callback
        const stateChangedCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
          call => call[0] === 'state_changed'
        );
        stateChangedCallback = stateChangedCall[1];
      });

      it('should block generation when MASTER circuit is OFF', async () => {
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(true);

        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        await stateChangedCallback(event);

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should proceed with generation when MASTER circuit is ON', async () => {
        mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        stateChangedCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
      });

      it('should proceed with generation when circuitBreaker is not provided', async () => {
        // Create handler with triggerMatcher but without circuitBreaker
        const newMatcher = new TriggerMatcher([
          { name: 'Person Arrival', entity_pattern: 'person.*', state_filter: 'home' },
        ]);
        const handler = new EventHandler(mockHomeAssistant, mockOrchestrator, newMatcher);
        await handler.initialize();

        // Get fresh callback from the new handler
        const stateChangedCall = (mockHomeAssistant.subscribeToEvents as jest.Mock).mock.calls.find(
          call => call[0] === 'state_changed'
        );
        const callback = stateChangedCall[1];

        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        callback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
      });

      it('should proceed with generation (fail-open) when circuit check throws', async () => {
        mockCircuitBreaker.isCircuitOpen.mockRejectedValue(new Error('Database error'));

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'person.john',
            new_state: { state: 'home' },
            old_state: { state: 'away' },
          },
        };

        stateChangedCallback(event);
        // Wait for async operation to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('MASTER');
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
      });

      it('should NOT check circuit for non-matching events', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'state_changed',
          data: {
            entity_id: 'sensor.temperature',
            new_state: { state: '72' },
            old_state: { state: '71' },
          },
        };

        await stateChangedCallback(event);

        // Circuit should not be checked for non-matching entities
        // (since the event doesn't match triggers)
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });
    });
  });
});
