/**
 * Tests for ParadoxEngineGenerator
 *
 * Generator-specific behavior:
 * - PARADOX_DATABASE (20+) and APPLICATION_CONTEXTS (15+) static arrays
 * - Template variable injection (paradox, application)
 */

import { ParadoxEngineGenerator } from '@/content/generators/ai/paradox-engine-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

describe('ParadoxEngineGenerator', () => {
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

  describe('paradox database', () => {
    it('should have at least 20 curated paradoxes', () => {
      const paradoxes = ParadoxEngineGenerator.PARADOX_DATABASE;
      expect(paradoxes).toBeDefined();
      expect(Array.isArray(paradoxes)).toBe(true);
      expect(paradoxes.length).toBeGreaterThanOrEqual(20);
    });

    it('should contain known paradoxes', () => {
      const paradoxes = ParadoxEngineGenerator.PARADOX_DATABASE;
      expect(paradoxes).toContain('SHIP_OF_THESEUS');
      expect(paradoxes).toContain('LIARS_PARADOX');
      expect(paradoxes).toContain('GRANDFATHER');
    });
  });

  describe('application contexts', () => {
    it('should have at least 15 relatable application contexts', () => {
      const applications = ParadoxEngineGenerator.APPLICATION_CONTEXTS;
      expect(applications).toBeDefined();
      expect(Array.isArray(applications)).toBe(true);
      expect(applications.length).toBeGreaterThanOrEqual(15);
    });

    it('should contain known applications', () => {
      const applications = ParadoxEngineGenerator.APPLICATION_CONTEXTS;
      expect(applications).toContain('YOUR_COUCH');
      expect(applications).toContain('YOUR_PLAYLIST');
      expect(applications).toContain('YOUR_RELATIONSHIP');
    });
  });

  describe('template variable injection', () => {
    it('should inject paradox and application template variables', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider
      }

      const userPromptCalls = mockPromptLoader.loadPromptWithVariables.mock.calls.filter(
        call => call[0] === 'user'
      );
      expect(userPromptCalls.length).toBeGreaterThan(0);

      const lastUserCall = userPromptCalls[userPromptCalls.length - 1];
      const variables = lastUserCall[2];
      expect(variables).toHaveProperty('paradox');
      expect(variables).toHaveProperty('application');
      expect(typeof variables.paradox).toBe('string');
      expect(typeof variables.application).toBe('string');
    });
  });
});
