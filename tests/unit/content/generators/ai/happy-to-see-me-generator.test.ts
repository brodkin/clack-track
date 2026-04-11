/**
 * Tests for HappyToSeeMeGenerator
 *
 * Generator-specific behavior:
 * - Vibe selection (thing/location/emotion)
 * - THING_VIBES/LOCATION_VIBES/EMOTION_VIBES constants (20+ each, unique)
 * - 100-output variability tests
 * - Template variable injection (thingVibe, locationVibe, emotionVibe)
 * - Custom metadata and design philosophy
 */

import { HappyToSeeMeGenerator } from '@/content/generators/ai/happy-to-see-me-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedHappyToSeeMeGenerator = HappyToSeeMeGenerator & {
  selectRandomThingVibe(): string;
  selectRandomLocationVibe(): string;
  selectRandomEmotionVibe(): string;
};

describe('HappyToSeeMeGenerator', () => {
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

  describe('thing vibe selection', () => {
    it('should select from valid thing vibes', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const validVibes = HappyToSeeMeGenerator.THING_VIBES;

      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomThingVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections (100-output variability test)', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomThingVibe());
      }

      expect(selectedVibes.size).toBeGreaterThan(5);
    });
  });

  describe('location vibe selection', () => {
    it('should select from valid location vibes', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const validVibes = HappyToSeeMeGenerator.LOCATION_VIBES;

      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomLocationVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomLocationVibe());
      }

      expect(selectedVibes.size).toBeGreaterThan(5);
    });
  });

  describe('emotion vibe selection', () => {
    it('should select from valid emotion vibes', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const validVibes = HappyToSeeMeGenerator.EMOTION_VIBES;

      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomEmotionVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomEmotionVibe());
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
          model: 'gpt-4.1-mini',
          tokensUsed: 50,
        }),
        validateConnection: jest.fn().mockResolvedValue(true),
      } as unknown as jest.Mocked<AIProvider>;

      jest
        .spyOn(
          HappyToSeeMeGenerator.prototype as { createProviderForSelection: () => unknown },
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

      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate({ updateType: 'major', timestamp: new Date() });

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'happy-to-see-me.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('thingVibe');
      expect(variables).toHaveProperty('locationVibe');
      expect(variables).toHaveProperty('emotionVibe');
    });
  });

  describe('THING_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = HappyToSeeMeGenerator.THING_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = HappyToSeeMeGenerator.THING_VIBES;

      expect(vibes).toContain('retro tech nostalgia');
      expect(vibes).toContain('artisanal food culture');
      expect(vibes).toContain('wellness obsession');
      expect(vibes).toContain('hipster accessories');
    });
  });

  describe('LOCATION_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = HappyToSeeMeGenerator.LOCATION_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = HappyToSeeMeGenerator.LOCATION_VIBES;

      expect(vibes).toContain('domestic hiding spots');
      expect(vibes).toContain('travel storage chaos');
      expect(vibes).toContain('office desk archaeology');
      expect(vibes).toContain('pocket ecosystems');
    });
  });

  describe('EMOTION_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = HappyToSeeMeGenerator.EMOTION_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = HappyToSeeMeGenerator.EMOTION_VIBES;

      expect(vibes).toContain('caffeinated energy');
      expect(vibes).toContain('fermented patience');
      expect(vibes).toContain('organized chaos');
      expect(vibes).toContain('nostalgic yearning');
    });
  });

  describe('metadata', () => {
    it('should include thingVibe, locationVibe, and emotionVibe in metadata', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
        promptsOnly: true,
      });

      expect(result.metadata).toHaveProperty('thingVibe');
      expect(result.metadata).toHaveProperty('locationVibe');
      expect(result.metadata).toHaveProperty('emotionVibe');

      expect(HappyToSeeMeGenerator.THING_VIBES).toContain(result.metadata?.thingVibe);
      expect(HappyToSeeMeGenerator.LOCATION_VIBES).toContain(result.metadata?.locationVibe);
      expect(HappyToSeeMeGenerator.EMOTION_VIBES).toContain(result.metadata?.emotionVibe);
    });
  });

  describe('design philosophy', () => {
    it('should use vibes as inspiration not literal requirements', () => {
      const thingVibes = HappyToSeeMeGenerator.THING_VIBES;
      const locationVibes = HappyToSeeMeGenerator.LOCATION_VIBES;
      const emotionVibes = HappyToSeeMeGenerator.EMOTION_VIBES;

      const thematicWords = ['vibes', 'energy', 'culture', 'aesthetics', 'chaos', 'obsession'];
      const hasThematicContent = thingVibes.some(vibe =>
        thematicWords.some(word => vibe.includes(word))
      );
      expect(hasThematicContent).toBe(true);

      const conceptualWords = ['archaeology', 'ecosystems', 'portals', 'dimensions', 'mysteries'];
      const hasConceptualLocations = locationVibes.some(vibe =>
        conceptualWords.some(word => vibe.includes(word))
      );
      expect(hasConceptualLocations).toBe(true);

      const nonStandardEmotions = emotionVibes.filter(
        vibe => !['happy', 'sad', 'angry', 'excited', 'scared'].some(basic => vibe.includes(basic))
      );
      expect(nonStandardEmotions.length).toBeGreaterThan(15);
    });
  });
});
