/**
 * Unit tests for ModelTierSelector
 *
 * Tests tier-based model selection with cross-provider fallback functionality.
 */

import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import type { AIProviderType, ModelTier } from '@/config/model-tiers';
import { MODEL_TIERS } from '@/config/model-tiers';

describe('ModelTierSelector', () => {
  describe('constructor', () => {
    it('should create instance with preferred provider and available providers', () => {
      const selector = new ModelTierSelector('openai', ['openai', 'anthropic']);
      expect(selector).toBeInstanceOf(ModelTierSelector);
    });

    it('should accept single provider in available providers', () => {
      const selector = new ModelTierSelector('openai', ['openai']);
      expect(selector).toBeInstanceOf(ModelTierSelector);
    });

    it('should accept anthropic as preferred provider', () => {
      const selector = new ModelTierSelector('anthropic', ['anthropic', 'openai']);
      expect(selector).toBeInstanceOf(ModelTierSelector);
    });
  });

  describe('select()', () => {
    describe('with preferred provider available', () => {
      it.each<[AIProviderType, ModelTier]>([
        ['openai', 'light'],
        ['openai', 'medium'],
        ['openai', 'heavy'],
        ['anthropic', 'light'],
        ['anthropic', 'medium'],
        ['anthropic', 'heavy'],
      ])('should return preferred %s provider for %s tier', (provider, tier) => {
        const otherProvider: AIProviderType = provider === 'openai' ? 'anthropic' : 'openai';
        const selector = new ModelTierSelector(provider, [provider, otherProvider]);
        const result = selector.select(tier);

        expect(result).toEqual({
          provider,
          model: MODEL_TIERS[provider][tier],
        });
      });
    });

    describe('with preferred provider unavailable (fallback)', () => {
      it.each<[AIProviderType, AIProviderType, ModelTier]>([
        ['openai', 'anthropic', 'medium'],
        ['anthropic', 'openai', 'light'],
        ['openai', 'anthropic', 'heavy'],
      ])('should fallback from %s to %s for %s tier', (preferred, available, tier) => {
        const selector = new ModelTierSelector(preferred, [available]);
        const result = selector.select(tier);

        expect(result).toEqual({
          provider: available,
          model: MODEL_TIERS[available][tier],
        });
      });
    });
  });

  describe('getAlternate()', () => {
    describe('with alternate available', () => {
      it.each<[AIProviderType, AIProviderType, ModelTier]>([
        ['openai', 'anthropic', 'medium'],
        ['anthropic', 'openai', 'light'],
        ['openai', 'anthropic', 'light'],
        ['anthropic', 'openai', 'heavy'],
      ])(
        'should return alternate when current is %s, expecting %s (%s tier)',
        (currentProvider, alternateProvider, tier) => {
          const selector = new ModelTierSelector(currentProvider, [
            currentProvider,
            alternateProvider,
          ]);
          const currentSelection = {
            provider: currentProvider,
            model: MODEL_TIERS[currentProvider][tier],
          };
          const result = selector.getAlternate(currentSelection);

          expect(result).toEqual({
            provider: alternateProvider,
            model: MODEL_TIERS[alternateProvider][tier],
          });
        }
      );
    });

    describe('with no alternate available', () => {
      it.each<[AIProviderType, ModelTier]>([
        ['openai', 'medium'],
        ['anthropic', 'light'],
      ])('should return null when only %s is available (%s tier)', (provider, tier) => {
        const selector = new ModelTierSelector(provider, [provider]);
        const current = { provider, model: MODEL_TIERS[provider][tier] };
        const result = selector.getAlternate(current);

        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should handle getAlternate when current provider not in available list', () => {
        const selector = new ModelTierSelector('openai', ['anthropic']);
        const current = { provider: 'openai' as AIProviderType, model: MODEL_TIERS.openai.medium };
        const result = selector.getAlternate(current);

        // Should return anthropic since it's the only available provider
        expect(result).toEqual({
          provider: 'anthropic',
          model: MODEL_TIERS.anthropic.medium,
        });
      });

      it('should return different provider than current for true failover', () => {
        const selector = new ModelTierSelector('openai', ['openai', 'anthropic']);
        const current = { provider: 'openai' as AIProviderType, model: MODEL_TIERS.openai.medium };
        const result = selector.getAlternate(current);

        expect(result?.provider).not.toBe(current.provider);
      });
    });
  });

  describe('integration scenarios', () => {
    it('should support complete failover workflow: select → fail → getAlternate', () => {
      const selector = new ModelTierSelector('openai', ['openai', 'anthropic']);

      // Primary selection
      const primary = selector.select('medium');
      expect(primary.provider).toBe('openai');

      // Simulate failure, get alternate
      const alternate = selector.getAlternate(primary);
      expect(alternate?.provider).toBe('anthropic');
      expect(alternate?.model).toBe(MODEL_TIERS.anthropic.medium);
    });

    it('should handle all three tiers consistently', () => {
      const selector = new ModelTierSelector('anthropic', ['anthropic', 'openai']);

      const tiers: ModelTier[] = ['light', 'medium', 'heavy'];

      tiers.forEach(tier => {
        const primary = selector.select(tier);
        expect(primary.provider).toBe('anthropic');
        expect(primary.model).toBe(MODEL_TIERS.anthropic[tier]);

        const alternate = selector.getAlternate(primary);
        expect(alternate?.provider).toBe('openai');
        expect(alternate?.model).toBe(MODEL_TIERS.openai[tier]);
      });
    });
  });
});
