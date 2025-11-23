import { AIProvider } from '../../types/ai.js';
import { VestaboardContent } from '../../types/content.js';
import { PromptLoader } from '../prompt-loader.js';

export class MajorUpdateGenerator {
  private aiProvider: AIProvider;
  private promptLoader: PromptLoader;

  constructor(aiProvider: AIProvider, promptLoader: PromptLoader) {
    this.aiProvider = aiProvider;
    this.promptLoader = promptLoader;
  }

  async generate(_eventData?: Record<string, unknown>): Promise<VestaboardContent> {
    void _eventData;
    // TODO: Implement major update generation
    // 1. Load system and user prompts
    // 2. Gather data from RSS, RapidAPI, etc.
    // 3. Call AI provider to generate engaging content
    // 4. Format for Vestaboard display
    throw new Error('Not implemented');
  }
}
