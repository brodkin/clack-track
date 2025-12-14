import { HomeAssistantClient } from '../api/data-sources/index.js';
import type { ContentOrchestrator } from '../content/orchestrator.js';
import { HomeAssistantEvent } from '../types/home-assistant.js';
import { log, warn } from '../utils/logger.js';

export class EventHandler {
  private homeAssistant: HomeAssistantClient;
  private orchestrator: ContentOrchestrator;

  constructor(homeAssistant: HomeAssistantClient, orchestrator: ContentOrchestrator) {
    this.homeAssistant = homeAssistant;
    this.orchestrator = orchestrator;
  }

  async initialize(): Promise<void> {
    // Note: Connection is already established by bootstrap()
    // EventHandler only sets up event subscriptions

    // Subscribe to vestaboard_refresh events for major content updates
    // Fire this event from Home Assistant automations to trigger a refresh
    await this.homeAssistant.subscribeToEvents('vestaboard_refresh', event => {
      void this.handleRefreshTrigger(event);
    });

    log('Event handler initialized - subscribed to vestaboard_refresh events');
  }

  async shutdown(): Promise<void> {
    await this.homeAssistant.disconnect();
    log('Event handler disconnected from Home Assistant');
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
}
