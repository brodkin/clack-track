/**
 * Tests for WakeupGreetingGenerator
 *
 * Generator-specific behavior:
 * - MORNING_THEMES dictionary (15+ diverse themes)
 * - selectRandomTheme() selection and variability
 * - Template variable injection (theme)
 */

import {
  WakeupGreetingGenerator,
  MORNING_THEMES,
} from '@/content/generators/ai/wakeup-greeting-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedWakeupGreetingGenerator = WakeupGreetingGenerator & {
  selectRandomTheme(): string;
};

describe('WakeupGreetingGenerator', () => {
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

  describe('MORNING_THEMES dictionary', () => {
    it('should contain at least 15 diverse themes', () => {
      expect(MORNING_THEMES.length).toBeGreaterThanOrEqual(15);
    });

    it('should contain only unique themes (no duplicates)', () => {
      const uniqueThemes = new Set(MORNING_THEMES);
      expect(uniqueThemes.size).toBe(MORNING_THEMES.length);
    });

    it('should cover diverse morning-related subject areas', () => {
      const themesLower = MORNING_THEMES.map(t => t.toLowerCase());
      const hasCoffee = themesLower.some(
        t => t.includes('coffee') || t.includes('brew') || t.includes('caffeine')
      );
      const hasSunrise = themesLower.some(
        t => t.includes('sunrise') || t.includes('dawn') || t.includes('light')
      );
      const hasNature = themesLower.some(
        t => t.includes('bird') || t.includes('morning air') || t.includes('dew')
      );
      const hasBody = themesLower.some(
        t => t.includes('stretch') || t.includes('wake') || t.includes('energy')
      );
      const hasFreshStart = themesLower.some(
        t =>
          t.includes('fresh') ||
          t.includes('new day') ||
          t.includes('possibilities') ||
          t.includes('start')
      );

      const categoriesPresent = [hasCoffee, hasSunrise, hasNature, hasBody, hasFreshStart].filter(
        Boolean
      ).length;
      expect(categoriesPresent).toBeGreaterThanOrEqual(3);
    });
  });

  describe('random selection', () => {
    it('selectRandomTheme() should return a valid theme from dictionary', () => {
      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWakeupGreetingGenerator;

      const theme = generator.selectRandomTheme();
      expect(MORNING_THEMES).toContain(theme);
    });

    it('should produce varied selections over multiple calls', () => {
      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWakeupGreetingGenerator;

      const themeSelections = new Set<string>();
      for (let i = 0; i < 50; i++) {
        themeSelections.add(generator.selectRandomTheme());
      }

      expect(themeSelections.size).toBeGreaterThanOrEqual(3);
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
          WakeupGreetingGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should inject theme template variable into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate({ updateType: 'major', timestamp: new Date() });

      const userPromptCalls = mockPromptLoader.loadPromptWithVariables.mock.calls.filter(
        call => call[0] === 'user' && call[1] === 'wakeup-greeting.txt'
      );
      expect(userPromptCalls.length).toBeGreaterThan(0);

      const userPromptVariables = userPromptCalls[0][2];
      expect(userPromptVariables).toHaveProperty('theme');
      expect(MORNING_THEMES).toContain(userPromptVariables.theme);
    });
  });
});
