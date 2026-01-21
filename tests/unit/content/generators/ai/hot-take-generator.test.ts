/**
 * Tests for HotTakeGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - HOT_TAKE_DOMAINS array (50 items) for topic categories
 * - HOT_TAKE_ANGLES array (12 items) for opinion styles
 * - getTemplateVariables() returning { hotTakeDomain, hotTakeAngle }
 * - getCustomMetadata() returning selection tracking
 * - Private selectRandom<T>() helper method
 * - Private instance variables for storing selections
 */

import {
  HotTakeGenerator,
  HOT_TAKE_DOMAINS,
  HOT_TAKE_ANGLES,
} from '@/content/generators/ai/hot-take-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedHotTakeGenerator = HotTakeGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedDomain: string;
  selectedAngle: string;
  modelTier: ModelTier;
};

describe('HotTakeGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  /**
   * Sample AI-generated hot take content.
   */
  const mockAIContent = `CEREAL IS SOUP
AND I WILL DIE ON
THIS DELICIOUS HILL`;

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    // Mock AIProvider with successful response
    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: mockAIContent,
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(HotTakeGenerator);
    });

    it('should use LIGHT model tier for efficiency', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify via observable behavior: modelTierSelector.select is called with LIGHT tier
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should work without API keys (default empty object)', () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(HotTakeGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return hot-take.txt', () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('hot-take.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content') // system prompt exists
        .mockRejectedValueOnce(new Error('File not found: hot-take.txt')); // user prompt missing

      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('variety arrays', () => {
    it('should have HOT_TAKE_DOMAINS array with 50 items', () => {
      expect(HOT_TAKE_DOMAINS).toBeDefined();
      expect(Array.isArray(HOT_TAKE_DOMAINS)).toBe(true);
      expect(HOT_TAKE_DOMAINS).toHaveLength(50);
    });

    it('should have HOT_TAKE_ANGLES array with 12 items', () => {
      expect(HOT_TAKE_ANGLES).toBeDefined();
      expect(Array.isArray(HOT_TAKE_ANGLES)).toBe(true);
      expect(HOT_TAKE_ANGLES).toHaveLength(12);
    });

    it('should have unique domains in HOT_TAKE_DOMAINS', () => {
      const uniqueDomains = new Set(HOT_TAKE_DOMAINS);
      expect(uniqueDomains.size).toBe(HOT_TAKE_DOMAINS.length);
    });

    it('should have unique angles in HOT_TAKE_ANGLES', () => {
      const uniqueAngles = new Set(HOT_TAKE_ANGLES);
      expect(uniqueAngles.size).toBe(HOT_TAKE_ANGLES.length);
    });

    it('should have non-empty string values in domains', () => {
      HOT_TAKE_DOMAINS.forEach((domain: string) => {
        expect(typeof domain).toBe('string');
        expect(domain.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty string values in angles', () => {
      HOT_TAKE_ANGLES.forEach((angle: string) => {
        expect(typeof angle).toBe('string');
        expect(angle.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getTemplateVariables()', () => {
    it('should return hotTakeDomain and hotTakeAngle', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.hotTakeDomain).toBeDefined();
      expect(templateVars.hotTakeAngle).toBeDefined();
    });

    it('should return domain from HOT_TAKE_DOMAINS array', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(HOT_TAKE_DOMAINS).toContain(templateVars.hotTakeDomain);
    });

    it('should return angle from HOT_TAKE_ANGLES array', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(HOT_TAKE_ANGLES).toContain(templateVars.hotTakeAngle);
    });

    it('should store selected domain in instance property', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedDomain).toBe(templateVars.hotTakeDomain);
    });

    it('should store selected angle in instance property', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedAngle).toBe(templateVars.hotTakeAngle);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      // Generate multiple times and collect results
      const domainResults = new Set<string>();
      const angleResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        domainResults.add(templateVars.hotTakeDomain);
        angleResults.add(templateVars.hotTakeAngle);
      }

      // With random selection from 50 domains and 12 angles,
      // we should get at least 2 different values for each
      expect(domainResults.size).toBeGreaterThan(1);
      expect(angleResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should return selectedDomain in metadata', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      // First call getTemplateVariables to populate selections
      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.selectedDomain).toBeDefined();
      expect(typeof metadata.selectedDomain).toBe('string');
    });

    it('should return selectedAngle in metadata', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      // First call getTemplateVariables to populate selections
      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.selectedAngle).toBeDefined();
      expect(typeof metadata.selectedAngle).toBe('string');
    });

    it('should match instance properties', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.selectedDomain).toBe(generator.selectedDomain);
      expect(metadata.selectedAngle).toBe(generator.selectedAngle);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      // Mock createProviderForSelection to return our AI provider mock
      jest
        .spyOn(
          HotTakeGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should load correct prompts and use LIGHT tier', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('hot-take.txt');

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should pass hotTakeDomain and hotTakeAngle to PromptLoader template variables', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      // Verify loadPromptWithVariables was called with hotTakeDomain and hotTakeAngle
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalled();

      // Find the call for the user prompt (hot-take.txt)
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'hot-take.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.hotTakeDomain).toBeDefined();
      expect(templateVars.hotTakeAngle).toBeDefined();
    });

    it('should include selectedDomain and selectedAngle in result metadata', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.selectedDomain).toBeDefined();
      expect(result.metadata?.selectedAngle).toBeDefined();
    });

    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result).toBeDefined();
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('gpt-4.1-nano');
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
    });

    describe('error handling', () => {
      it('should handle AI provider failures gracefully', async () => {
        const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        mockAIProvider.generate.mockRejectedValue(new Error('AI provider error'));
        mockModelTierSelector.getAlternate.mockReturnValue(null);

        await expect(generator.generate(mockContext)).rejects.toThrow(
          /All AI providers failed for tier/
        );
      });
    });
  });
});
