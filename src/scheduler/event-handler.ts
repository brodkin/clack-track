import { HomeAssistantClient } from '../api/data-sources/index.js';
import type { ContentOrchestrator } from '../content/orchestrator.js';
import { HomeAssistantEvent } from '../types/home-assistant.js';
import { log, warn } from '../utils/logger.js';
import type { TriggerMatcher } from './trigger-matcher.js';

export class EventHandler {
  private homeAssistant: HomeAssistantClient;
  private orchestrator: ContentOrchestrator;
  private triggerMatcher: TriggerMatcher | null = null;

  constructor(
    homeAssistant: HomeAssistantClient,
    orchestrator: ContentOrchestrator,
    triggerMatcher?: TriggerMatcher
  ) {
    this.homeAssistant = homeAssistant;
    this.orchestrator = orchestrator;
    this.triggerMatcher = triggerMatcher ?? null;
  }

  async initialize(): Promise<void> {
    // Note: Connection is already established by bootstrap()
    // EventHandler only sets up event subscriptions

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
      log('Event handler initialized - subscribed to vestaboard_refresh and state_changed events');
    } else {
      log('Event handler initialized - subscribed to vestaboard_refresh events');
    }
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
}
