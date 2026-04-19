/**
 * Tests for FdaGuidelinesGenerator
 */

import { FdaGuidelinesGenerator } from '@/content/generators/ai/fda-guidelines-generator';
import {
  FOOD_CODE_PROVISIONS,
  selectRandomProvision,
} from '@/content/generators/ai/fda-guidelines-dictionaries';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

type ProtectedFdaGuidelinesGenerator = FdaGuidelinesGenerator & {
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedProvision: { section: string; topic: string; facet: string };
};

describe('FdaGuidelinesGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  beforeEach(() => {
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        tier: ModelTier.MEDIUM,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: 'COLD HOLDING MUST BE\nAT 41 F OR BELOW',
        model: 'claude-sonnet-4-5-20250929',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('FOOD_CODE_PROVISIONS', () => {
    it('should contain unique well-formed sections each with topic and facets', () => {
      const sections = new Set(FOOD_CODE_PROVISIONS.map(p => p.section));
      expect(sections.size).toBe(FOOD_CODE_PROVISIONS.length);
      FOOD_CODE_PROVISIONS.forEach(({ section, topic, facets }) => {
        expect(section).toMatch(/^\d-\d{3}\.\d{2,3}$/);
        expect(typeof topic).toBe('string');
        expect(topic.length).toBeGreaterThan(0);
        expect(facets.length).toBeGreaterThanOrEqual(1);
        facets.forEach(f => {
          expect(typeof f).toBe('string');
          expect(f.length).toBeGreaterThan(0);
        });
      });
    });

    it('should produce at least 200 distinct section+facet combinations', () => {
      const total = FOOD_CODE_PROVISIONS.reduce((sum, p) => sum + p.facets.length, 0);
      expect(total).toBeGreaterThanOrEqual(200);
    });
  });

  describe('selectRandomProvision()', () => {
    it('should return a valid section+topic+facet combination', () => {
      const sel = selectRandomProvision();
      const match = FOOD_CODE_PROVISIONS.find(p => p.section === sel.section);
      expect(match).toBeDefined();
      expect(match?.topic).toBe(sel.topic);
      expect(match?.facets).toContain(sel.facet);
    });

    it('should vary selections across calls', () => {
      const seenFacets = new Set<string>();
      for (let i = 0; i < 80; i++) {
        seenFacets.add(selectRandomProvision().facet);
      }
      expect(seenFacets.size).toBeGreaterThan(5);
    });
  });

  describe('getTemplateVariables()', () => {
    it('should return section topicArea and facet', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        anthropic: 'test-key',
      }) as ProtectedFdaGuidelinesGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(Object.keys(templateVars).sort()).toEqual(['facet', 'section', 'topicArea']);
      const match = FOOD_CODE_PROVISIONS.find(p => p.section === templateVars.section);
      expect(match?.topic).toBe(templateVars.topicArea);
      expect(match?.facets).toContain(templateVars.facet);
    });

    it('should cache the selection on the instance', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        anthropic: 'test-key',
      }) as ProtectedFdaGuidelinesGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);
      expect(generator.selectedProvision.section).toBe(templateVars.section);
      expect(generator.selectedProvision.topic).toBe(templateVars.topicArea);
      expect(generator.selectedProvision.facet).toBe(templateVars.facet);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should expose the selected provision', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        anthropic: 'test-key',
      }) as ProtectedFdaGuidelinesGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata).toEqual({
        section: generator.selectedProvision.section,
        topicArea: generator.selectedProvision.topic,
        facet: generator.selectedProvision.facet,
      });
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      jest
        .spyOn(
          FdaGuidelinesGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('passes section topicArea and facet to the user prompt', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        anthropic: 'test-key',
      });

      await generator.generate(mockContext);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'fda-guidelines.txt'
      );
      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      const match = FOOD_CODE_PROVISIONS.find(p => p.section === templateVars.section);
      expect(match?.topic).toBe(templateVars.topicArea);
      expect(match?.facets).toContain(templateVars.facet);
    });

    it('includes section topicArea and facet in result metadata', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        anthropic: 'test-key',
      });

      const result = await generator.generate(mockContext);
      const section = result.metadata?.section as string;
      const match = FOOD_CODE_PROVISIONS.find(p => p.section === section);
      expect(match?.topic).toBe(result.metadata?.topicArea as string);
      expect(match?.facets).toContain(result.metadata?.facet as string);
    });
  });
});
