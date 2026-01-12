import { HomeAssistantClient } from '../api/data-sources/index.js';
import type { ContentOrchestrator } from '../content/orchestrator.js';
import type { CircuitState } from '../types/circuit-breaker.js';
import { HomeAssistantEvent } from '../types/home-assistant.js';
import { log, warn } from '../utils/logger.js';
import type { TriggerMatcher } from './trigger-matcher.js';

/**
 * Interface for circuit breaker control operations
 * Uses dependency injection to decouple EventHandler from CircuitBreakerService
 */
export interface CircuitBreakerController {
  setCircuitState(circuitId: string, state: CircuitState): Promise<void>;
  resetProviderCircuit(circuitId: string): Promise<void>;
  isCircuitOpen(circuitId: string): Promise<boolean>;
}

/**
 * Valid actions for circuit control events from Home Assistant
 */
type CircuitControlAction = 'on' | 'off' | 'reset';

export class EventHandler {
  private homeAssistant: HomeAssistantClient;
  private orchestrator: ContentOrchestrator;
  private triggerMatcher: TriggerMatcher | null = null;
  private circuitBreaker: CircuitBreakerController | null = null;

  constructor(
    homeAssistant: HomeAssistantClient,
    orchestrator: ContentOrchestrator,
    triggerMatcher?: TriggerMatcher,
    circuitBreaker?: CircuitBreakerController
  ) {
    this.homeAssistant = homeAssistant;
    this.orchestrator = orchestrator;
    this.triggerMatcher = triggerMatcher ?? null;
    this.circuitBreaker = circuitBreaker ?? null;
  }

  async initialize(): Promise<void> {
    // Note: Connection is already established by bootstrap()
    // EventHandler only sets up event subscriptions
    const subscriptions: string[] = ['vestaboard_refresh'];

    // Subscribe to vestaboard_refresh events for major content updates
    // Fire this event from Home Assistant automations to trigger a refresh
    await this.homeAssistant.subscribeToEvents('vestaboard_refresh', event => {
      void this.handleRefreshTrigger(event);
    });

    // If triggerMatcher is configured, subscribe to state_changed events for trigger matching
    if (this.triggerMatcher) {
      await this.homeAssistant.subscribeToEvents('state_changed', event => {
        void this.handleStateChange(event);
      });
      subscriptions.push('state_changed');
    }

    // If circuitBreaker is configured, subscribe to circuit control events
    if (this.circuitBreaker) {
      await this.homeAssistant.subscribeToEvents('vestaboard_circuit_control', event => {
        void this.handleCircuitControlEvent(event);
      });
      subscriptions.push('vestaboard_circuit_control');
    }

    log(`Event handler initialized - subscribed to ${subscriptions.join(' and ')} events`);
  }

  async shutdown(): Promise<void> {
    this.triggerMatcher?.cleanup();
    await this.homeAssistant.disconnect();
    log('Event handler disconnected from Home Assistant');
  }

  /**
   * Update trigger matcher (for hot-reload support)
   * @param triggerMatcher - New TriggerMatcher instance or null to clear
   */
  updateTriggerMatcher(triggerMatcher: TriggerMatcher | null): void {
    this.triggerMatcher?.cleanup();
    this.triggerMatcher = triggerMatcher;
  }

  private async handleRefreshTrigger(event: HomeAssistantEvent): Promise<void> {
    try {
      log(`Received vestaboard_refresh event: ${event.event_type}`);

      // Check MASTER circuit before generating content
      if (this.circuitBreaker) {
        try {
          if (await this.circuitBreaker.isCircuitOpen('MASTER')) {
            log('MASTER circuit is OFF - blocking HA-triggered generation');
            return;
          }
        } catch (error) {
          // Fail-open: if circuit check fails, proceed with generation
          warn('Circuit check failed, proceeding with generation:', error);
        }
      }

      // Use orchestrator to generate and send content
      await this.orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
        eventData: event.data,
      });

      log('Major update triggered successfully via vestaboard_refresh');
    } catch (error) {
      warn('Failed to handle vestaboard_refresh:', error);
    }
  }

  private async handleStateChange(event: HomeAssistantEvent): Promise<void> {
    if (!this.triggerMatcher) return;

    // Extract entity_id and new_state from event.data
    const entityId = event.data?.entity_id as string | undefined;
    const newStateObj = event.data?.new_state as Record<string, unknown> | undefined;
    const newState = newStateObj?.state as string | undefined;

    if (!entityId || !newState) return;

    const result = this.triggerMatcher.match(entityId, newState);

    if (result.matched && !result.debounced) {
      // Check MASTER circuit before generating content
      if (this.circuitBreaker) {
        try {
          if (await this.circuitBreaker.isCircuitOpen('MASTER')) {
            log('MASTER circuit is OFF - blocking HA-triggered generation');
            return;
          }
        } catch (error) {
          // Fail-open: if circuit check fails, proceed with generation
          warn('Circuit check failed, proceeding with generation:', error);
        }
      }

      log(`Trigger matched: ${result.trigger?.name} for ${entityId} -> ${newState}`);
      await this.orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
        eventData: event.data,
      });
    } else if (result.debounced) {
      log(`Trigger debounced: ${result.trigger?.name} for ${entityId}`);
    }
  }

  /**
   * Handle circuit control events from Home Assistant
   *
   * Event payload format:
   * {
   *   circuit_id: string,  // e.g., 'MASTER', 'SLEEP_MODE', 'PROVIDER_OPENAI'
   *   action: 'on' | 'off' | 'reset'
   * }
   *
   * Actions:
   * - 'on': Enable the circuit (allow traffic)
   * - 'off': Disable the circuit (block traffic)
   * - 'reset': Reset provider circuit to operational state with cleared counters
   */
  private async handleCircuitControlEvent(event: HomeAssistantEvent): Promise<void> {
    if (!this.circuitBreaker) return;

    const circuitId = event.data?.circuit_id as string | undefined;
    const action = event.data?.action as string | undefined;

    // Validate required fields
    if (!circuitId || !action) {
      warn('Circuit control event missing required fields', { circuitId, action });
      return;
    }

    // Validate action is a known type
    if (!this.isValidCircuitAction(action)) {
      warn(`Invalid circuit control action: ${action}`, { circuitId, action });
      return;
    }

    try {
      if (action === 'reset') {
        // Reset is specifically for provider circuits
        await this.circuitBreaker.resetProviderCircuit(circuitId);
        log(`Circuit ${circuitId} reset via Home Assistant event`);
      } else {
        // 'on' or 'off' actions use setCircuitState
        await this.circuitBreaker.setCircuitState(circuitId, action);
        log(`Circuit ${circuitId} set to ${action} via Home Assistant event`);
      }
    } catch (error) {
      warn(`Failed to handle circuit control event for ${circuitId}:`, error);
    }
  }

  /**
   * Type guard to validate circuit control action
   */
  private isValidCircuitAction(action: string): action is CircuitControlAction {
    return action === 'on' || action === 'off' || action === 'reset';
  }
}
