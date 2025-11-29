import { describe, it, expect } from '@jest/globals';
import { MODEL_TIERS, ModelTier, AIProviderType } from '@/config/model-tiers';

describe('Model Tiers Configuration', () => {
  describe('MODEL_TIERS Structure', () => {
    it('should export MODEL_TIERS constant', () => {
      expect(MODEL_TIERS).toBeDefined();
      expect(typeof MODEL_TIERS).toBe('object');
    });

    it('should have openai provider configuration', () => {
      expect(MODEL_TIERS.openai).toBeDefined();
      expect(typeof MODEL_TIERS.openai).toBe('object');
    });

    it('should have anthropic provider configuration', () => {
      expect(MODEL_TIERS.anthropic).toBeDefined();
      expect(typeof MODEL_TIERS.anthropic).toBe('object');
    });
  });

  describe('OpenAI Model Tiers', () => {
    it('should have light tier with gpt-4.1-nano', () => {
      expect(MODEL_TIERS.openai.light).toBe('gpt-4.1-nano');
    });

    it('should have medium tier with gpt-4.1-mini', () => {
      expect(MODEL_TIERS.openai.medium).toBe('gpt-4.1-mini');
    });

    it('should have heavy tier with gpt-4.1', () => {
      expect(MODEL_TIERS.openai.heavy).toBe('gpt-4.1');
    });

    it('should have all three tiers defined', () => {
      const tiers = Object.keys(MODEL_TIERS.openai);
      expect(tiers).toHaveLength(3);
      expect(tiers).toContain('light');
      expect(tiers).toContain('medium');
      expect(tiers).toContain('heavy');
    });
  });

  describe('Anthropic Model Tiers', () => {
    it('should have light tier with claude-haiku-4-5-20251001', () => {
      expect(MODEL_TIERS.anthropic.light).toBe('claude-haiku-4-5-20251001');
    });

    it('should have medium tier with claude-sonnet-4-5-20250929', () => {
      expect(MODEL_TIERS.anthropic.medium).toBe('claude-sonnet-4-5-20250929');
    });

    it('should have heavy tier with claude-opus-4-5-20251101', () => {
      expect(MODEL_TIERS.anthropic.heavy).toBe('claude-opus-4-5-20251101');
    });

    it('should have all three tiers defined', () => {
      const tiers = Object.keys(MODEL_TIERS.anthropic);
      expect(tiers).toHaveLength(3);
      expect(tiers).toContain('light');
      expect(tiers).toContain('medium');
      expect(tiers).toContain('heavy');
    });
  });

  describe('Type Safety', () => {
    it('should allow accessing models with valid tier names', () => {
      const tier: ModelTier = 'medium';
      const openaiModel = MODEL_TIERS.openai[tier];
      const anthropicModel = MODEL_TIERS.anthropic[tier];

      expect(openaiModel).toBe('gpt-4.1-mini');
      expect(anthropicModel).toBe('claude-sonnet-4-5-20250929');
    });

    it('should allow accessing models with valid provider names', () => {
      const provider: AIProviderType = 'openai';
      const models = MODEL_TIERS[provider];

      expect(models.light).toBe('gpt-4.1-nano');
      expect(models.medium).toBe('gpt-4.1-mini');
      expect(models.heavy).toBe('gpt-4.1');
    });
  });

  describe('Configuration Completeness', () => {
    it('should have exactly two providers', () => {
      const providers = Object.keys(MODEL_TIERS);
      expect(providers).toHaveLength(2);
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
    });

    it('should have consistent tier structure across providers', () => {
      const openaiTiers = Object.keys(MODEL_TIERS.openai).sort();
      const anthropicTiers = Object.keys(MODEL_TIERS.anthropic).sort();

      expect(openaiTiers).toEqual(anthropicTiers);
      expect(openaiTiers).toEqual(['heavy', 'light', 'medium']);
    });

    it('should have non-empty string values for all model identifiers', () => {
      Object.values(MODEL_TIERS).forEach(provider => {
        Object.values(provider).forEach(model => {
          expect(typeof model).toBe('string');
          expect(model.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
