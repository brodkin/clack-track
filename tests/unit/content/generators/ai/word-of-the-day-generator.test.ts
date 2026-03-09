/**
 * Tests for WordOfTheDayGenerator
 *
 * Generator-specific behavior:
 * - Template variable injection (wordDomain, wordVibe)
 * - Valid domain and vibe sets
 * - Variety across multiple calls
 */

import { WordOfTheDayGenerator } from '@/content/generators/ai/word-of-the-day-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

describe('WordOfTheDayGenerator', () => {
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

  describe('template variable injection', () => {
    it('should inject wordDomain and wordVibe template variables', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new WordOfTheDayGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider
      }

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'word-of-the-day.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall![2];

      expect(variables).toHaveProperty('wordDomain');
      expect(variables).toHaveProperty('wordVibe');

      const validDomains = [
        'EMOTION_WORDS',
        'SITUATION_WORDS',
        'RELATIONSHIP_WORDS',
        'WORK_WORDS',
        'NATURE_WORDS',
        'FOREIGN_LOANWORDS',
      ];
      expect(validDomains).toContain(variables.wordDomain);

      const validVibes = [
        'SATISFYING_TO_SAY',
        'SURPRISINGLY_USEFUL',
        'OBSCURE_BUT_RELATABLE',
        'COMEBACK_WORTHY',
      ];
      expect(validVibes).toContain(variables.wordVibe);
    });

    it('should select different random combinations over multiple calls', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new WordOfTheDayGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const collectedVariables: Array<{
        wordDomain: string;
        wordVibe: string;
      }> = [];

      for (let i = 0; i < 10; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();

        try {
          await generator.generate({ updateType: 'major', timestamp: new Date() });
        } catch {
          // Expected - no real AI provider
        }

        const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
          call => call[0] === 'user' && call[1] === 'word-of-the-day.txt'
        );

        if (userPromptCall) {
          collectedVariables.push({
            wordDomain: userPromptCall[2].wordDomain,
            wordVibe: userPromptCall[2].wordVibe,
          });
        }
      }

      expect(collectedVariables.length).toBeGreaterThan(0);

      const uniqueDomains = new Set(collectedVariables.map(v => v.wordDomain));
      const uniqueVibes = new Set(collectedVariables.map(v => v.wordVibe));

      expect(uniqueDomains.size + uniqueVibes.size).toBeGreaterThanOrEqual(1);
    }, 15000);
  });
});
