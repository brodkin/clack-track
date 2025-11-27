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
      it('should return preferred openai provider for light tier', () => {
        const selector = new ModelTierSelector('openai', ['openai', 'anthropic']);
        const result = selector.select('light');

        expect(result).toEqual({
          provider: 'openai',
          model: MODEL_TIERS.openai.light,
        });
      });

      it('should return preferred openai provider for medium tier', () => {
        const selector = new ModelTierSelector('openai', ['openai', 'anthropic']);
        const result = selector.select('medium');

        expect(result).toEqual({
          provider: 'openai',
          model: MODEL_TIERS.openai.medium,
        });
      });

      it('should return preferred openai provider for heavy tier', () => {
        const selector = new ModelTierSelector('openai', ['openai', 'anthropic']);
        const result = selector.select('heavy');

        expect(result).toEqual({
          provider: 'openai',
          model: MODEL_TIERS.openai.heavy,
        });
      });

      it('should return preferred anthropic provider for light tier', () => {
        const selector = new ModelTierSelector('anthropic', ['anthropic', 'openai']);
        const result = selector.select('light');

        expect(result).toEqual({
          provider: 'anthropic',
          model: MODEL_TIERS.anthropic.light,
        });
      });

      it('should return preferred anthropic provider for medium tier', () => {
        const selector = new ModelTierSelector('anthropic', ['anthropic', 'openai']);
        const result = selector.select('medium');

        expect(result).toEqual({
          provider: 'anthropic',
          model: MODEL_TIERS.anthropic.medium,
        });
      });

      it('should return preferred anthropic provider for heavy tier', () => {
        const selector = new ModelTierSelector('anthropic', ['anthropic', 'openai']);
        const result = selector.select('heavy');

        expect(result).toEqual({
          provider: 'anthropic',
          model: MODEL_TIERS.anthropic.heavy,
        });
      });
    });

    describe('with preferred provider unavailable (fallback)', () => {
      it('should fallback to first available provider when preferred is openai but only anthropic available', () => {
        const selector = new ModelTierSelector('openai', ['anthropic']);
        const result = selector.select('medium');

        expect(result).toEqual({
          provider: 'anthropic',
          model: MODEL_TIERS.anthropic.medium,
        });
      });

      it('should fallback to first available provider when preferred is anthropic but only openai available', () => {
        const selector = new ModelTierSelector('anthropic', ['openai']);
        const result = selector.select('light');

        expect(result).toEqual({
          provider: 'openai',
          model: MODEL_TIERS.openai.light,
        });
      });

      it('should fallback to anthropic for heavy tier when openai not available', () => {
        const selector = new ModelTierSelector('openai', ['anthropic']);
        const result = selector.select('heavy');

        expect(result).toEqual({
          provider: 'anthropic',
          model: MODEL_TIERS.anthropic.heavy,
        });
      });
    });
  });

  describe('getAlternate()', () => {
    describe('with alternate available', () => {
      it('should return anthropic alternate when current is openai', () => {
        const selector = new ModelTierSelector('openai', ['openai', 'anthropic']);
        const current = { provider: 'openai' as AIProviderType, model: MODEL_TIERS.openai.medium };
        const result = selector.getAlternate(current);

        expect(result).toEqual({
          provider: 'anthropic',
          model: MODEL_TIERS.anthropic.medium,
        });
      });

      it('should return openai alternate when current is anthropic', () => {
        const selector = new ModelTierSelector('anthropic', ['anthropic', 'openai']);
        const current = {
          provider: 'anthropic' as AIProviderType,
          model: MODEL_TIERS.anthropic.light,
        };
        const result = selector.getAlternate(current);

        expect(result).toEqual({
          provider: 'openai',
          model: MODEL_TIERS.openai.light,
        });
      });

      it('should match tier when providing alternate (light tier)', () => {
        const selector = new ModelTierSelector('openai', ['openai', 'anthropic']);
        const current = { provider: 'openai' as AIProviderType, model: MODEL_TIERS.openai.light };
        const result = selector.getAlternate(current);

        expect(result?.model).toBe(MODEL_TIERS.anthropic.light);
      });

      it('should match tier when providing alternate (heavy tier)', () => {
        const selector = new ModelTierSelector('anthropic', ['anthropic', 'openai']);
        const current = {
          provider: 'anthropic' as AIProviderType,
          model: MODEL_TIERS.anthropic.heavy,
        };
        const result = selector.getAlternate(current);

        expect(result?.model).toBe(MODEL_TIERS.openai.heavy);
      });
    });

    describe('with no alternate available', () => {
      it('should return null when only openai is available', () => {
        const selector = new ModelTierSelector('openai', ['openai']);
        const current = { provider: 'openai' as AIProviderType, model: MODEL_TIERS.openai.medium };
        const result = selector.getAlternate(current);

        expect(result).toBeNull();
      });

      it('should return null when only anthropic is available', () => {
        const selector = new ModelTierSelector('anthropic', ['anthropic']);
        const current = {
          provider: 'anthropic' as AIProviderType,
          model: MODEL_TIERS.anthropic.light,
        };
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
