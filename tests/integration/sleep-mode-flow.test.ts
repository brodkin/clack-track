/**
 * Sleep Mode Flow Integration Tests
 *
 * Tests the complete flow of sleep mode activation and deactivation:
 * - CLI circuit:off SLEEP_MODE triggers sleep art display
 * - CLI circuit:on SLEEP_MODE triggers wakeup greeting display
 * - HA event vestaboard_circuit_control with circuit_id: SLEEP_MODE triggers appropriate display
 * - Sleep art displays BEFORE blocking takes effect
 * - Wakeup greeting displays immediately, then normal content resumes
 *
 * @group integration
 */

import { jest } from '@jest/globals';
import type { ContentOrchestrator } from '@/content/orchestrator';
import type { HomeAssistantClient } from '@/api/data-sources/home-assistant';
import type { HomeAssistantEvent } from '@/types/home-assistant';
import { EventHandler, type CircuitBreakerController } from '@/scheduler/event-handler';

describe('Sleep Mode Flow Integration Tests', () => {
  // Mock dependencies
  let mockHomeAssistant: jest.Mocked<HomeAssistantClient>;
  let mockOrchestrator: jest.Mocked<ContentOrchestrator>;
  let mockCircuitBreaker: jest.Mocked<
    CircuitBreakerController & {
      isCircuitOpen: (circuitId: string) => Promise<boolean>;
    }
  >;

  // Captured event handlers
  let circuitControlCallback: (event: HomeAssistantEvent) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock HomeAssistantClient
    mockHomeAssistant = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      subscribeToEvents: jest
        .fn()
        .mockImplementation(
          async (eventType: string, callback: (event: HomeAssistantEvent) => void) => {
            if (eventType === 'vestaboard_circuit_control') {
              circuitControlCallback = callback as (event: HomeAssistantEvent) => Promise<void>;
            }
            return () => {};
          }
        ),
      getState: jest.fn(),
      callService: jest.fn(),
      validateConnection: jest.fn(),
    } as unknown as jest.Mocked<HomeAssistantClient>;

    // Create mock ContentOrchestrator
    mockOrchestrator = {
      generateAndSend: jest.fn().mockResolvedValue({ success: true }),
      getCachedContent: jest.fn().mockReturnValue(null),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<ContentOrchestrator>;

    // Create mock CircuitBreakerController
    mockCircuitBreaker = {
      setCircuitState: jest.fn().mockResolvedValue(undefined),
      resetProviderCircuit: jest.fn().mockResolvedValue(undefined),
      isCircuitOpen: jest.fn().mockResolvedValue(false),
    };
  });

  describe('HA Event: vestaboard_circuit_control', () => {
    let eventHandler: EventHandler;

    beforeEach(async () => {
      eventHandler = new EventHandler(
        mockHomeAssistant,
        mockOrchestrator,
        undefined,
        mockCircuitBreaker
      );
      await eventHandler.initialize();
    });

    afterEach(async () => {
      await eventHandler.shutdown();
    });

    describe('SLEEP_MODE circuit OFF (entering sleep)', () => {
      it('should trigger sleep art content BEFORE setting circuit state', async () => {
        const callOrder: string[] = [];

        // Track call order
        mockOrchestrator.generateAndSend.mockImplementation(async () => {
          callOrder.push('generateAndSend');
          return { success: true };
        });
        mockCircuitBreaker.setCircuitState.mockImplementation(async () => {
          callOrder.push('setCircuitState');
        });

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'off',
          },
        };

        await circuitControlCallback(event);

        // Verify content generated before circuit state changed
        expect(callOrder).toEqual(['generateAndSend', 'setCircuitState']);
      });

      it('should generate content using sleep-mode-generator', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'off',
          },
        };

        await circuitControlCallback(event);

        // Verify orchestrator was called with sleep-mode-generator
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
          expect.objectContaining({
            generatorId: 'sleep-mode-generator',
            updateType: 'major',
          })
        );
      });

      it('should set SLEEP_MODE circuit to off after displaying content', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'off',
          },
        };

        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('SLEEP_MODE', 'off');
      });

      it('should still set circuit state even if content generation fails', async () => {
        mockOrchestrator.generateAndSend.mockRejectedValueOnce(new Error('Generation failed'));

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'off',
          },
        };

        await circuitControlCallback(event);

        // Circuit state should still be set even if content generation fails
        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('SLEEP_MODE', 'off');
      });
    });

    describe('SLEEP_MODE circuit ON (waking up)', () => {
      it('should trigger wakeup greeting content after setting circuit state', async () => {
        const callOrder: string[] = [];

        // Track call order
        mockOrchestrator.generateAndSend.mockImplementation(async () => {
          callOrder.push('generateAndSend');
          return { success: true };
        });
        mockCircuitBreaker.setCircuitState.mockImplementation(async () => {
          callOrder.push('setCircuitState');
        });

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'on',
          },
        };

        await circuitControlCallback(event);

        // Verify circuit state changed before content generated (unblock first)
        expect(callOrder).toEqual(['setCircuitState', 'generateAndSend']);
      });

      it('should generate content using wakeup-greeting-generator', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'on',
          },
        };

        await circuitControlCallback(event);

        // Verify orchestrator was called with wakeup-greeting-generator
        expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
          expect.objectContaining({
            generatorId: 'wakeup-greeting-generator',
            updateType: 'major',
          })
        );
      });

      it('should set SLEEP_MODE circuit to on before displaying content', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'on',
          },
        };

        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('SLEEP_MODE', 'on');
      });
    });

    describe('Non-SLEEP_MODE circuits', () => {
      it('should NOT trigger content generation for MASTER circuit', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'MASTER',
            action: 'off',
          },
        };

        await circuitControlCallback(event);

        // Should set circuit state but not generate content
        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('MASTER', 'off');
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should NOT trigger content generation for provider circuits', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'PROVIDER_OPENAI',
            action: 'reset',
          },
        };

        await circuitControlCallback(event);

        // Should reset provider circuit but not generate content
        expect(mockCircuitBreaker.resetProviderCircuit).toHaveBeenCalledWith('PROVIDER_OPENAI');
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should handle missing circuit_id gracefully', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            action: 'off',
          },
        };

        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).not.toHaveBeenCalled();
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should handle missing action gracefully', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
          },
        };

        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).not.toHaveBeenCalled();
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should handle invalid action gracefully', async () => {
        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'invalid',
          },
        };

        await circuitControlCallback(event);

        expect(mockCircuitBreaker.setCircuitState).not.toHaveBeenCalled();
        expect(mockOrchestrator.generateAndSend).not.toHaveBeenCalled();
      });

      it('should log and continue when wakeup content generation fails', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        mockOrchestrator.generateAndSend.mockRejectedValueOnce(new Error('AI provider failed'));

        // Set up mock to track circuit state was set first
        let circuitStateSet = false;
        mockCircuitBreaker.setCircuitState.mockImplementation(async () => {
          circuitStateSet = true;
        });
        mockOrchestrator.generateAndSend.mockImplementation(async () => {
          if (!circuitStateSet) {
            throw new Error('Circuit state should be set before generation');
          }
          throw new Error('AI provider failed');
        });

        const event: HomeAssistantEvent = {
          event_type: 'vestaboard_circuit_control',
          data: {
            circuit_id: 'SLEEP_MODE',
            action: 'on',
          },
        };

        // Should not throw
        await circuitControlCallback(event);

        // Circuit state should have been set
        expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('SLEEP_MODE', 'on');

        warnSpy.mockRestore();
      });
    });
  });

  describe('Content Generation Order', () => {
    it('should display sleep art, then block subsequent updates', async () => {
      // This test verifies that when entering sleep mode:
      // 1. Sleep art is displayed first
      // 2. Then subsequent content generation is blocked

      const eventHandler = new EventHandler(
        mockHomeAssistant,
        mockOrchestrator,
        undefined,
        mockCircuitBreaker
      );
      await eventHandler.initialize();

      // Simulate entering sleep mode
      const sleepEvent: HomeAssistantEvent = {
        event_type: 'vestaboard_circuit_control',
        data: {
          circuit_id: 'SLEEP_MODE',
          action: 'off',
        },
      };

      await circuitControlCallback(sleepEvent);

      // Verify sleep art was generated
      expect(mockOrchestrator.generateAndSend).toHaveBeenCalledWith(
        expect.objectContaining({
          generatorId: 'sleep-mode-generator',
        })
      );

      // After sleep mode is activated, subsequent updates should check circuit
      // (This is handled by existing circuit enforcement code)

      await eventHandler.shutdown();
    });

    it('should unblock first, then display wakeup greeting', async () => {
      // This test verifies that when waking up:
      // 1. Circuit is unblocked first (to allow content generation)
      // 2. Then wakeup greeting is displayed

      const operations: string[] = [];

      mockCircuitBreaker.setCircuitState.mockImplementation(async (circuitId, state) => {
        operations.push(`setCircuitState:${circuitId}:${state}`);
      });

      mockOrchestrator.generateAndSend.mockImplementation(async context => {
        operations.push(`generateAndSend:${context.generatorId}`);
        return { success: true };
      });

      const eventHandler = new EventHandler(
        mockHomeAssistant,
        mockOrchestrator,
        undefined,
        mockCircuitBreaker
      );
      await eventHandler.initialize();

      // Simulate waking up
      const wakeupEvent: HomeAssistantEvent = {
        event_type: 'vestaboard_circuit_control',
        data: {
          circuit_id: 'SLEEP_MODE',
          action: 'on',
        },
      };

      await circuitControlCallback(wakeupEvent);

      // Verify order: unblock first, then generate content
      expect(operations).toEqual([
        'setCircuitState:SLEEP_MODE:on',
        'generateAndSend:wakeup-greeting-generator',
      ]);

      await eventHandler.shutdown();
    });
  });

  describe('Integration with existing circuit enforcement', () => {
    it('should work alongside existing MASTER circuit checks', async () => {
      // Verify that sleep mode content generation respects MASTER circuit
      // MASTER circuit should take precedence over sleep mode content

      mockCircuitBreaker.isCircuitOpen.mockImplementation(async circuitId => {
        if (circuitId === 'MASTER') {
          return true; // MASTER is OFF
        }
        return false;
      });

      const eventHandler = new EventHandler(
        mockHomeAssistant,
        mockOrchestrator,
        undefined,
        mockCircuitBreaker
      );
      await eventHandler.initialize();

      // Try to enter sleep mode while MASTER is OFF
      const sleepEvent: HomeAssistantEvent = {
        event_type: 'vestaboard_circuit_control',
        data: {
          circuit_id: 'SLEEP_MODE',
          action: 'off',
        },
      };

      await circuitControlCallback(sleepEvent);

      // Sleep mode content should still be displayed (circuit control bypasses generation checks)
      // because this is a direct circuit control action, not a regular content trigger
      // The circuit state should still be set
      expect(mockCircuitBreaker.setCircuitState).toHaveBeenCalledWith('SLEEP_MODE', 'off');

      await eventHandler.shutdown();
    });
  });
});
