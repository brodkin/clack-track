/**
 * Tests for SleepGreetingGenerator
 *
 * Generator-specific behavior:
 * - BEDTIME_THEMES dictionary (15+ diverse themes)
 * - selectRandomTheme() selection and variability
 * - Template variable injection (theme)
 */

import {
  SleepGreetingGenerator,
  BEDTIME_THEMES,
} from '@/content/generators/ai/sleep-greeting-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedSleepGreetingGenerator = SleepGreetingGenerator & {
  selectRandomTheme(): string;
};

describe('SleepGreetingGenerator', () => {
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

  describe('BEDTIME_THEMES dictionary', () => {
    it('should contain at least 15 diverse themes', () => {
      expect(BEDTIME_THEMES.length).toBeGreaterThanOrEqual(15);
    });

    it('should contain only unique themes (no duplicates)', () => {
      const uniqueThemes = new Set(BEDTIME_THEMES);
      expect(uniqueThemes.size).toBe(BEDTIME_THEMES.length);
    });

    it('should cover diverse bedtime/sleep concepts', () => {
      const themesLower = BEDTIME_THEMES.map(t => t.toLowerCase());
      const hasDreaming = themesLower.some(t => t.includes('dream') || t.includes('dreamland'));
      const hasCozy = themesLower.some(
        t => t.includes('cozy') || t.includes('blanket') || t.includes('pillow')
      );
      const hasNight = themesLower.some(
        t => t.includes('star') || t.includes('moon') || t.includes('night')
      );
      const hasClassic = themesLower.some(
        t => t.includes('sheep') || t.includes('lullaby') || t.includes('bedtime')
      );

      const categoriesPresent = [hasDreaming, hasCozy, hasNight, hasClassic].filter(Boolean).length;
      expect(categoriesPresent).toBeGreaterThanOrEqual(3);
    });
  });

  describe('random selection', () => {
    it('selectRandomTheme() should return a valid theme from dictionary', () => {
      const generator = new SleepGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedSleepGreetingGenerator;

      const theme = generator.selectRandomTheme();
      expect(BEDTIME_THEMES).toContain(theme);
    });

    it('should produce varied selections over multiple calls', () => {
      const generator = new SleepGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedSleepGreetingGenerator;

      const themeSelections = new Set<string>();
      for (let i = 0; i < 50; i++) {
        themeSelections.add(generator.selectRandomTheme());
      }

      expect(themeSelections.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('100-output variability test', () => {
    it('should produce varied themes across 100 generations via dictionary injection', () => {
      const generator = new SleepGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedSleepGreetingGenerator;

      const themeFrequency = new Map<string, number>();
      for (let i = 0; i < 100; i++) {
        const theme = generator.selectRandomTheme();
        themeFrequency.set(theme, (themeFrequency.get(theme) || 0) + 1);
      }

      expect(themeFrequency.size).toBeGreaterThanOrEqual(8);
      const maxFrequency = Math.max(...themeFrequency.values());
      expect(maxFrequency).toBeLessThan(30);
    });
  });

  describe('template variable injection', () => {
    it('should inject theme template variable into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new SleepGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider
      }

      const userPromptCalls = mockPromptLoader.loadPromptWithVariables.mock.calls.filter(
        call => call[0] === 'user' && call[1] === 'sleep-greeting.txt'
      );
      expect(userPromptCalls.length).toBeGreaterThan(0);

      const userPromptVariables = userPromptCalls[0][2];
      expect(userPromptVariables).toHaveProperty('theme');
      expect(BEDTIME_THEMES).toContain(userPromptVariables.theme);
    });
  });
});
