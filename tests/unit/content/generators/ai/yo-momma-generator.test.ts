/**
 * Tests for YoMommaGenerator
 *
 * Generator-specific behavior:
 * - QUALITY_VIBES/ACTION_VIBES/TONE_VIBES (20+ each, unique)
 * - Vibe selection methods and 100-output variability
 * - Template variable injection (qualityVibe, actionVibe, toneVibe)
 * - Custom metadata via promptsOnly mode
 * - Design philosophy (vibes as inspiration, burn vs compliment tones)
 */

import { YoMommaGenerator } from '@/content/generators/ai/yo-momma-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedYoMommaGenerator = YoMommaGenerator & {
  selectRandomQualityVibe(): string;
  selectRandomActionVibe(): string;
  selectRandomToneVibe(): string;
};

describe('YoMommaGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  beforeEach(() => {
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn(),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn(),
      getAlternate: jest.fn(),
    } as unknown as jest.Mocked<ModelTierSelector>;
  });

  describe('quality vibe selection', () => {
    it('should select from valid quality vibes', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      const validVibes = YoMommaGenerator.QUALITY_VIBES;

      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomQualityVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections (100-output variability test)', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomQualityVibe());
      }

      expect(selectedVibes.size).toBeGreaterThan(5);
    });
  });

  describe('action vibe selection', () => {
    it('should select from valid action vibes', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      const validVibes = YoMommaGenerator.ACTION_VIBES;

      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomActionVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomActionVibe());
      }

      expect(selectedVibes.size).toBeGreaterThan(5);
    });
  });

  describe('tone vibe selection', () => {
    it('should select from valid tone vibes', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      const validVibes = YoMommaGenerator.TONE_VIBES;

      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomToneVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomToneVibe());
      }

      expect(selectedVibes.size).toBeGreaterThan(5);
    });
  });

  describe('template variable injection', () => {
    let mockAIProvider: jest.Mocked<AIProvider>;

    beforeEach(() => {
      mockAIProvider = {
        generate: jest.fn().mockResolvedValue({
          text: 'MOCK CONTENT',
          model: 'gpt-4.1-nano',
          tokensUsed: 50,
        }),
        validateConnection: jest.fn().mockResolvedValue(true),
      } as unknown as jest.Mocked<AIProvider>;

      jest
        .spyOn(
          YoMommaGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should inject all three vibe template variables into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate({ updateType: 'major', timestamp: new Date() });

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'yo-momma.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('qualityVibe');
      expect(variables).toHaveProperty('actionVibe');
      expect(variables).toHaveProperty('toneVibe');
    });
  });

  describe('QUALITY_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = YoMommaGenerator.QUALITY_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = YoMommaGenerator.QUALITY_VIBES;

      expect(vibes).toContain('athletic prowess');
      expect(vibes).toContain('intellectual brilliance');
      expect(vibes).toContain('culinary mastery');
      expect(vibes).toContain('generous spirit');
    });
  });

  describe('ACTION_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = YoMommaGenerator.ACTION_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = YoMommaGenerator.ACTION_VIBES;

      expect(vibes).toContain('household miracle feats');
      expect(vibes).toContain('food-related achievements');
      expect(vibes).toContain('technology mishaps triumphs');
      expect(vibes).toContain('celebrity encounters');
    });
  });

  describe('TONE_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = YoMommaGenerator.TONE_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = YoMommaGenerator.TONE_VIBES;

      expect(vibes).toContain('sick burn');
      expect(vibes).toContain('backhanded compliment');
      expect(vibes).toContain('genuine hype');
      expect(vibes).toContain('wholesome flex');
    });
  });

  describe('metadata', () => {
    it('should include qualityVibe, actionVibe, and toneVibe in metadata', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
        promptsOnly: true,
      });

      expect(result.metadata).toHaveProperty('qualityVibe');
      expect(result.metadata).toHaveProperty('actionVibe');
      expect(result.metadata).toHaveProperty('toneVibe');

      expect(YoMommaGenerator.QUALITY_VIBES).toContain(result.metadata?.qualityVibe);
      expect(YoMommaGenerator.ACTION_VIBES).toContain(result.metadata?.actionVibe);
      expect(YoMommaGenerator.TONE_VIBES).toContain(result.metadata?.toneVibe);
    });
  });

  describe('design philosophy', () => {
    it('should use vibes as inspiration not literal requirements', () => {
      const qualityVibes = YoMommaGenerator.QUALITY_VIBES;
      const actionVibes = YoMommaGenerator.ACTION_VIBES;
      const toneVibes = YoMommaGenerator.TONE_VIBES;

      const qualityThematicWords = [
        'prowess',
        'brilliance',
        'mastery',
        'spirit',
        'genius',
        'savviness',
      ];
      const hasQualityThematicContent = qualityVibes.some(vibe =>
        qualityThematicWords.some(word => vibe.includes(word))
      );
      expect(hasQualityThematicContent).toBe(true);

      const actionConceptualWords = [
        'feats',
        'achievements',
        'mishaps',
        'encounters',
        'powers',
        'legends',
      ];
      const hasConceptualActions = actionVibes.some(vibe =>
        actionConceptualWords.some(word => vibe.includes(word))
      );
      expect(hasConceptualActions).toBe(true);

      const burnTones = toneVibes.filter(vibe =>
        ['burn', 'roast', 'shade', 'dig', 'mockery', 'ribbing'].some(word => vibe.includes(word))
      );
      const complimentTones = toneVibes.filter(vibe =>
        ['hype', 'praise', 'flex', 'tribute', 'celebration', 'flattery', 'appreciation'].some(
          word => vibe.includes(word)
        )
      );

      expect(burnTones.length).toBeGreaterThan(3);
      expect(complimentTones.length).toBeGreaterThan(3);
    });
  });
});
