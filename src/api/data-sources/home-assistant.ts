import { HomeAssistantConfig, HomeAssistantEvent } from '../../types/data-sources.js';

export class HomeAssistantClient {
  private config: HomeAssistantConfig;
  private eventHandlers: Map<string, (event: HomeAssistantEvent) => void>;

  constructor(config: HomeAssistantConfig) {
    this.config = config;
    this.eventHandlers = new Map();
  }

  async connect(): Promise<void> {
    // TODO: Implement WebSocket connection to Home Assistant
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    // TODO: Implement disconnection
    throw new Error('Not implemented');
  }

  on(eventType: string, handler: (event: HomeAssistantEvent) => void): void {
    this.eventHandlers.set(eventType, handler);
  }

  async triggerEvent(_eventType: string, _data?: Record<string, unknown>): Promise<void> {
    void _eventType;
    void _data;
    // TODO: Implement event triggering
    throw new Error('Not implemented');
  }
}
