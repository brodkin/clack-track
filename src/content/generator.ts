import { ContentType } from '../types/index.js';

export class ContentGenerator {
  async generate(type: ContentType): Promise<string> {
    // Stub implementation
    return `Placeholder content for type: ${type}`;
  }
}
