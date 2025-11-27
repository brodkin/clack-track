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
    light: 'gpt-4.1-nano',
    medium: 'gpt-4.1-mini',
    heavy: 'gpt-4.1',
  },
  anthropic: {
    light: 'claude-haiku-4-5-20251001',
    medium: 'claude-sonnet-4-5-20250929',
    heavy: 'claude-opus-4-5-20251101',
  },
} as const;
