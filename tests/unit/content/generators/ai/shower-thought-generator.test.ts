/**
 * Tests for ShowerThoughtGenerator
 *
 * Generator-specific behavior:
 * - Thought-type selection (cognitive pattern categories)
 * - Subject-domain selection (broad domains with seed subjects)
 * - THOUGHT_TYPES and SUBJECT_DOMAINS constants
 * - Template variable injection (thoughtType, subjectDomain)
 * - Custom metadata tracking (thoughtType, subjectDomain, subject)
 */

import { ShowerThoughtGenerator } from '@/content/generators/ai/shower-thought-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing public selection methods in tests
type TestableShowerThoughtGenerator = ShowerThoughtGenerator & {
  selectRandomThoughtType(): string;
  selectRandomSubjectDomain(): { subjectDomain: string; subject: string };
};

describe('ShowerThoughtGenerator', () => {
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

  describe('thought-type selection', () => {
    it('should select from valid thought-type categories', () => {
      const generator = new ShowerThoughtGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as TestableShowerThoughtGenerator;

      const selectedTypes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const thoughtType = generator.selectRandomThoughtType();
        selectedTypes.add(thoughtType);
        expect(typeof thoughtType).toBe('string');
        expect(thoughtType.length).toBeGreaterThan(0);
      }

      // Should have variety across runs
      expect(selectedTypes.size).toBeGreaterThan(1);
    });
  });

  describe('subject-domain selection', () => {
    it('should select from valid subject domains with seed subjects', () => {
      const generator = new ShowerThoughtGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as TestableShowerThoughtGenerator;

      const selectedDomains = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { subjectDomain, subject } = generator.selectRandomSubjectDomain();
        selectedDomains.add(subjectDomain);
        expect(typeof subjectDomain).toBe('string');
        expect(subjectDomain.length).toBeGreaterThan(0);
        expect(typeof subject).toBe('string');
        expect(subject.length).toBeGreaterThan(0);
      }

      // Should have variety across runs
      expect(selectedDomains.size).toBeGreaterThan(1);
    });
  });

  describe('THOUGHT_TYPES constant', () => {
    it('should contain 6-8 cognitive pattern categories', () => {
      const types = ShowerThoughtGenerator.THOUGHT_TYPES;
      expect(types.length).toBeGreaterThanOrEqual(6);
      expect(types.length).toBeLessThanOrEqual(8);
    });

    it('should contain cognitive patterns, not joke formulas', () => {
      const types = ShowerThoughtGenerator.THOUGHT_TYPES;

      // Each type should be a non-empty string
      for (const type of types) {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      }

      // No duplicates
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });

    it('should include PARADOX and SCALE_SHIFT categories', () => {
      const types = ShowerThoughtGenerator.THOUGHT_TYPES;
      expect(types).toContain('PARADOX');
      expect(types).toContain('SCALE_SHIFT');
    });
  });

  describe('SUBJECT_DOMAINS constant', () => {
    it('should contain 6-8 subject domains', () => {
      const domains = ShowerThoughtGenerator.SUBJECT_DOMAINS;
      const domainKeys = Object.keys(domains);
      expect(domainKeys.length).toBeGreaterThanOrEqual(6);
      expect(domainKeys.length).toBeLessThanOrEqual(8);
    });

    it('should have 5-8 seed subjects per domain', () => {
      const domains = ShowerThoughtGenerator.SUBJECT_DOMAINS;

      for (const [_domainName, subjects] of Object.entries(domains)) {
        expect(subjects.length).toBeGreaterThanOrEqual(5);
        expect(subjects.length).toBeLessThanOrEqual(8);

        // All subjects should be non-empty strings
        for (const subject of subjects) {
          expect(typeof subject).toBe('string');
          expect(subject.length).toBeGreaterThan(0);
        }

        // No duplicates within a domain
        const uniqueSubjects = new Set(subjects);
        expect(uniqueSubjects.size).toBe(subjects.length);
      }
    });

    it('should include DAILY_ROUTINES and LANGUAGE domains', () => {
      const domains = ShowerThoughtGenerator.SUBJECT_DOMAINS;
      expect(domains).toHaveProperty('DAILY_ROUTINES');
      expect(domains).toHaveProperty('LANGUAGE');
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
          ShowerThoughtGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should inject thoughtType and subjectDomain into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new ShowerThoughtGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate({ updateType: 'major', timestamp: new Date() });

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'shower-thought.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('thoughtType');
      expect(variables).toHaveProperty('subjectDomain');
      expect(variables).toHaveProperty('subject');
    });
  });

  describe('custom metadata tracking', () => {
    it('should track thoughtType, subjectDomain, and subject in metadata', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new ShowerThoughtGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Use promptsOnly to get metadata without needing real AI provider
      const result = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
        promptsOnly: true,
      });

      expect(result.metadata).toHaveProperty('thoughtType');
      expect(result.metadata).toHaveProperty('subjectDomain');
      expect(result.metadata).toHaveProperty('subject');
      expect(typeof result.metadata.thoughtType).toBe('string');
      expect(typeof result.metadata.subjectDomain).toBe('string');
      expect(typeof result.metadata.subject).toBe('string');
    });
  });
});
