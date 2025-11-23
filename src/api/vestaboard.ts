import { VestaboardConfig, VestaboardMessage } from '../types/index.js';

export class VestaboardClient {
  private config: VestaboardConfig;

  constructor(config: VestaboardConfig) {
    this.config = config;
  }

  async sendMessage(message: VestaboardMessage): Promise<void> {
    // Stub implementation
    console.log('Sending message to Vestaboard:', message);
  }
}
