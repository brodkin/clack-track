/**
 * Model Tier Selector
 *
 * Provides tier-based model selection with cross-provider fallback functionality.
 * Supports selecting models based on computational tiers (light, medium, heavy)
 * with automatic failover to alternate providers when primary is unavailable.
 */

import { MODEL_TIERS, type AIProviderType, type ModelTier } from '../../config/model-tiers.js';

/**
 * Result of model selection containing provider and model identifier
 */
export interface ModelSelection {
  provider: AIProviderType;
  model: string;
}

/**
 * Selects appropriate AI models based on tier with cross-provider fallback
 */
export class ModelTierSelector {
  private readonly preferredProvider: AIProviderType;
  private readonly availableProviders: AIProviderType[];

  /**
   * Creates a new ModelTierSelector instance
   *
   * @param preferredProvider - The preferred AI provider to use (e.g., 'openai', 'anthropic')
   * @param availableProviders - List of available providers for fallback
   */
  constructor(preferredProvider: AIProviderType, availableProviders: AIProviderType[]) {
    this.preferredProvider = preferredProvider;
    this.availableProviders = availableProviders;
  }

  /**
   * Selects a model based on the specified tier
   *
   * Uses the preferred provider if available, otherwise falls back to the first
   * available provider in the list.
   *
   * @param tier - The model tier to select ('light', 'medium', or 'heavy')
   * @returns Model selection with provider and model identifier
   */
  select(tier: ModelTier): ModelSelection {
    // Use preferred provider if available
    const provider = this.availableProviders.includes(this.preferredProvider)
      ? this.preferredProvider
      : this.availableProviders[0];

    return {
      provider,
      model: MODEL_TIERS[provider][tier],
    };
  }

  /**
   * Gets an alternate provider/model pair for failover scenarios
   *
   * Returns a different provider than the current one to enable true failover.
   * Returns null if no alternate provider is available.
   *
   * @param current - The current model selection that failed
   * @returns Alternate model selection, or null if no alternate available
   */
  getAlternate(current: ModelSelection): ModelSelection | null {
    // Find providers other than the current one
    const alternateProviders = this.availableProviders.filter(p => p !== current.provider);

    if (alternateProviders.length === 0) {
      return null;
    }

    // Use the first alternate provider
    const alternateProvider = alternateProviders[0];

    // Determine the tier of the current model to match it
    const tier = this.getTierFromModel(current.provider, current.model);

    if (!tier) {
      // If we can't determine tier, default to medium
      return {
        provider: alternateProvider,
        model: MODEL_TIERS[alternateProvider].medium,
      };
    }

    return {
      provider: alternateProvider,
      model: MODEL_TIERS[alternateProvider][tier],
    };
  }

  /**
   * Determines the tier of a given model
   *
   * @param provider - The provider of the model
   * @param model - The model identifier
   * @returns The tier of the model, or null if not found
   */
  private getTierFromModel(provider: AIProviderType, model: string): ModelTier | null {
    const tiers: ModelTier[] = ['light', 'medium', 'heavy'];

    for (const tier of tiers) {
      if (MODEL_TIERS[provider][tier] === model) {
        return tier;
      }
    }

    return null;
  }
}
