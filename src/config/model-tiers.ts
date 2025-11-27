/**
 * Model Tier Configuration
 *
 * Defines the mapping of model tiers (light, medium, heavy) to specific
 * AI model identifiers for OpenAI and Anthropic providers.
 *
 * Tiers represent computational complexity and capability:
 * - light: Fast, cost-effective models for simple tasks
 * - medium: Balanced performance for most use cases
 * - heavy: Most capable models for complex reasoning
 */

export type ModelTier = 'light' | 'medium' | 'heavy';
export type AIProviderType = 'openai' | 'anthropic';

/**
 * Model tier mappings for supported AI providers
 */
export const MODEL_TIERS = {
  openai: {
    light: 'gpt-4o-mini',
    medium: 'gpt-4o',
    heavy: 'gpt-4-turbo',
  },
  anthropic: {
    light: 'claude-3-haiku-20240307',
    medium: 'claude-3-5-sonnet-20241022',
    heavy: 'claude-3-opus-20240229',
  },
} as const;
