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

      // Check SLEEP_MODE circuit after MASTER
      if (this.circuitBreaker) {
        try {
          if (await this.circuitBreaker.isCircuitOpen('SLEEP_MODE')) {
            log('SLEEP_MODE circuit is active - blocking HA-triggered generation');
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

      // Check SLEEP_MODE circuit after MASTER
      if (this.circuitBreaker) {
        try {
          if (await this.circuitBreaker.isCircuitOpen('SLEEP_MODE')) {
            log('SLEEP_MODE circuit is active - blocking HA-triggered generation');
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
   *
   * Special handling for SLEEP_MODE circuit:
   * - When SLEEP_MODE turns OFF (entering sleep): Display sleep art BEFORE blocking
   * - When SLEEP_MODE turns ON (waking up): Unblock FIRST, then display wakeup greeting
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
      } else if (circuitId === 'SLEEP_MODE') {
        // Special handling for SLEEP_MODE circuit
        await this.handleSleepModeChange(action);
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
   * Handle SLEEP_MODE circuit state changes with content generation
   *
   * User-facing semantics (matches CLI commands):
   * - action='on' = user wants to ENTER sleep mode (be quiet, block updates)
   * - action='off' = user wants to EXIT sleep mode (wake up, allow updates)
   *
   * Sleep mode transitions require specific content display:
   * - Entering sleep (action='on'): Display sleep art, THEN block
   * - Waking up (action='off'): Unblock FIRST, then display wakeup greeting
   *
   * @param action - The SLEEP_MODE action ('on' to sleep, 'off' to wake)
   */
  private async handleSleepModeChange(action: 'on' | 'off'): Promise<void> {
    if (!this.circuitBreaker) return;

    // User-facing sleep mode semantics:
    // - action='on' = user wants to ENTER sleep mode (be quiet, block updates)
    // - action='off' = user wants to EXIT sleep mode (wake up, allow updates)

    if (action === 'on') {
      // Entering sleep mode: display sleep art BEFORE blocking
      // This ensures the sleep art is shown before subsequent updates are blocked
      try {
        const result = await this.orchestrator.generateAndSend({
          updateType: 'major',
          timestamp: new Date(),
          generatorId: 'sleep-mode-generator',
        });
        if (result.success) {
          log('Sleep mode art displayed successfully');
        } else if (result.blocked) {
          warn(`Sleep mode art blocked: ${result.blockReason}`);
        } else {
          warn('Sleep mode art generation failed');
        }
      } catch (error) {
        warn('Failed to display sleep mode art:', error);
        // Continue to set circuit state even if content generation fails
      }

      // Now set the circuit to OFF (block subsequent updates)
      await this.circuitBreaker.setCircuitState('SLEEP_MODE', 'off');
      log('SLEEP_MODE activated - updates blocked');
    } else {
      // Waking up: unblock FIRST, then display wakeup greeting
      // This ensures the wakeup greeting generation isn't blocked
      await this.circuitBreaker.setCircuitState('SLEEP_MODE', 'on');
      log('SLEEP_MODE deactivated - updates allowed');

      // Now display the wakeup greeting
      try {
        const result = await this.orchestrator.generateAndSend({
          updateType: 'major',
          timestamp: new Date(),
          generatorId: 'wakeup-greeting-generator',
        });
        if (result.success) {
          log('Wakeup greeting displayed successfully');
        } else if (result.blocked) {
          warn(`Wakeup greeting blocked: ${result.blockReason}`);
        } else {
          warn('Wakeup greeting generation failed');
        }
      } catch (error) {
        warn('Failed to display wakeup greeting:', error);
        // Circuit is already unblocked, so normal content updates can resume
      }
    }
  }

  /**
   * Type guard to validate circuit control action
   */
  private isValidCircuitAction(action: string): action is CircuitControlAction {
    return action === 'on' || action === 'off' || action === 'reset';
  }
}
