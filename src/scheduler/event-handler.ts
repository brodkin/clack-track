import { HomeAssistantClient } from '../api/data-sources/index.js';
import { MajorUpdateGenerator } from '../content/generators/index.js';
import { MinorUpdateGenerator } from '../content/generators/index.js';
import { VestaboardClient } from '../api/vestaboard.js';
import { HomeAssistantEvent } from '../types/data-sources.js';
import { log, warn } from '../utils/logger.js';

export class EventHandler {
  private homeAssistant: HomeAssistantClient;
  private majorUpdateGenerator: MajorUpdateGenerator;
  private minorUpdateGenerator: MinorUpdateGenerator;
  private vestaboardClient: VestaboardClient;

  constructor(
    homeAssistant: HomeAssistantClient,
    majorUpdateGenerator: MajorUpdateGenerator,
    minorUpdateGenerator: MinorUpdateGenerator,
    vestaboardClient: VestaboardClient
  ) {
    this.homeAssistant = homeAssistant;
    this.majorUpdateGenerator = majorUpdateGenerator;
    this.minorUpdateGenerator = minorUpdateGenerator;
    this.vestaboardClient = vestaboardClient;
  }

  async initialize(): Promise<void> {
    // TODO: Register event handlers for Home Assistant events
    this.homeAssistant.on('content_trigger', event => this.handleContentTrigger(event));
    await this.homeAssistant.connect();
    log('Event handler initialized and connected to Home Assistant');
  }

  async shutdown(): Promise<void> {
    await this.homeAssistant.disconnect();
    log('Event handler disconnected from Home Assistant');
  }

  private async handleContentTrigger(event: HomeAssistantEvent): Promise<void> {
    try {
      log(`Received content trigger event: ${event.event_type}`);

      // Generate new major content update
      const content = await this.majorUpdateGenerator.generate(event.data);

      // Send to Vestaboard
      await this.vestaboardClient.sendMessage({ text: content.text });

      // Update minor generator with new content
      this.minorUpdateGenerator.setLastMajorContent(content);

      log('Major update triggered successfully');
    } catch (error) {
      warn('Failed to handle content trigger:', error);
    }
  }
}
