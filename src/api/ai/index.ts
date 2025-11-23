import { OpenAIClient } from './openai.js';
import { AnthropicClient } from './anthropic.js';
import { AIProvider } from '../../types/ai.js';

export { OpenAIClient } from './openai.js';
export { AnthropicClient } from './anthropic.js';

export enum AIProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

export function createAIProvider(type: AIProviderType, apiKey: string): AIProvider {
  switch (type) {
    case AIProviderType.OPENAI:
      return new OpenAIClient(apiKey);
    case AIProviderType.ANTHROPIC:
      return new AnthropicClient(apiKey);
    default:
      throw new Error(`Unknown AI provider type: ${type}`);
  }
}
