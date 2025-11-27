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
    // Connect to Home Assistant
    await this.homeAssistant.connect();

    // Subscribe to content_trigger events for standard updates
    await this.homeAssistant.subscribeToEvents('content_trigger', event => {
      void this.handleContentTrigger(event);
    });

    // Subscribe to state_changed events for P0 notifications
    await this.homeAssistant.subscribeToEvents('state_changed', event => {
      void this.handleStateChanged(event);
    });

    log('Event handler initialized and connected to Home Assistant');
  }

  async shutdown(): Promise<void> {
    await this.homeAssistant.disconnect();
    log('Event handler disconnected from Home Assistant');
  }

  private async handleContentTrigger(event: HomeAssistantEvent): Promise<void> {
    try {
      log(`Received content trigger event: ${event.event_type}`);

      // Use orchestrator to generate and send content
      await this.orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
        eventData: event.data,
      });

      log('Major update triggered successfully');
    } catch (error) {
      warn('Failed to handle content trigger:', error);
    }
  }

  private async handleStateChanged(event: HomeAssistantEvent): Promise<void> {
    try {
      // P0 notification support: pass state change to orchestrator
      // Orchestrator (via ContentSelector) will determine if event matches P0 pattern
      await this.orchestrator.generateAndSend({
        updateType: 'major',
        timestamp: new Date(),
        eventData: event.data,
      });
    } catch (error) {
      // Log errors without crashing the event handler
      warn('Failed to handle state change event:', error);
    }
  }
}
