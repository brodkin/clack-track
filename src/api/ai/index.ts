import { OpenAIClient } from './openai.js';
import { AnthropicClient } from './anthropic.js';
import { AIProvider } from '../../types/ai.js';

export { OpenAIClient } from './openai.js';
export { AnthropicClient } from './anthropic.js';
export { ModelTierSelector, type ModelSelection } from './model-tier-selector.js';
export { MODEL_TIERS, type ModelTier } from '../../config/model-tiers.js';

export enum AIProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

/**
 * Creates an AI provider instance with optional model override
 *
 * @param type - The AI provider type (OpenAI or Anthropic)
 * @param apiKey - The API key for the provider
 * @param model - Optional model identifier for tier-based model selection
 * @returns An AIProvider instance configured with the specified provider and model
 */
export function createAIProvider(type: AIProviderType, apiKey: string, model?: string): AIProvider {
  switch (type) {
    case AIProviderType.OPENAI:
      return new OpenAIClient(apiKey, model);
    case AIProviderType.ANTHROPIC:
      return new AnthropicClient(apiKey, model);
    default:
      throw new Error(`Unknown AI provider type: ${type}`);
  }
}
