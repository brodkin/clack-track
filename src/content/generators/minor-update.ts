import { VestaboardContent } from '../../types/content.js';

export class MinorUpdateGenerator {
  private lastMajorContent: VestaboardContent | null = null;

  setLastMajorContent(content: VestaboardContent): void {
    this.lastMajorContent = content;
  }

  async generate(): Promise<VestaboardContent> {
    // TODO: Implement minor update generation
    // 1. Keep existing content structure
    // 2. Update only time and weather fields
    // 3. Return updated content
    throw new Error('Not implemented');
  }

  private async getCurrentTime(): Promise<string> {
    // TODO: Implement time formatting
    return new Date().toLocaleTimeString();
  }

  private async getCurrentWeather(): Promise<string> {
    // TODO: Implement weather fetching
    return 'Sunny 72°F';
  }
}
