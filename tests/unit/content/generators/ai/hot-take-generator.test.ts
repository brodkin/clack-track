/**
 * Tests for HotTakeGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - HOT_TAKE_SUBJECTS array (192 items) for broad topics
 * - HOT_TAKE_DEVICES array (32 items) for rhetorical structures
 * - getTemplateVariables() returning { hotTakeSubject, hotTakeDevice }
 * - getCustomMetadata() returning selection tracking
 * - Private selectRandom<T>() helper method
 * - Private instance variables for storing selections
 */

import {
  HotTakeGenerator,
  HOT_TAKE_SUBJECTS,
  HOT_TAKE_DEVICES,
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
  selectedSubject: string;
  selectedDevice: string;
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
  const mockAIContent = `THERE ARE TWO TYPES
OF DOG PEOPLE AND
THE WRONG KIND`;

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
    it('should have HOT_TAKE_SUBJECTS array with 192 items', () => {
      expect(HOT_TAKE_SUBJECTS).toBeDefined();
      expect(Array.isArray(HOT_TAKE_SUBJECTS)).toBe(true);
      expect(HOT_TAKE_SUBJECTS).toHaveLength(192);
    });

    it('should have HOT_TAKE_DEVICES array with 32 items', () => {
      expect(HOT_TAKE_DEVICES).toBeDefined();
      expect(Array.isArray(HOT_TAKE_DEVICES)).toBe(true);
      expect(HOT_TAKE_DEVICES).toHaveLength(32);
    });

    it('should have unique subjects in HOT_TAKE_SUBJECTS', () => {
      const uniqueSubjects = new Set(HOT_TAKE_SUBJECTS);
      expect(uniqueSubjects.size).toBe(HOT_TAKE_SUBJECTS.length);
    });

    it('should have unique devices in HOT_TAKE_DEVICES', () => {
      const uniqueDevices = new Set(HOT_TAKE_DEVICES);
      expect(uniqueDevices.size).toBe(HOT_TAKE_DEVICES.length);
    });

    it('should have non-empty string values in subjects', () => {
      HOT_TAKE_SUBJECTS.forEach((subject: string) => {
        expect(typeof subject).toBe('string');
        expect(subject.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty string values in devices', () => {
      HOT_TAKE_DEVICES.forEach((device: string) => {
        expect(typeof device).toBe('string');
        expect(device.length).toBeGreaterThan(0);
      });
    });

    it('should have at least 150 subjects for novelty', () => {
      expect(HOT_TAKE_SUBJECTS.length).toBeGreaterThanOrEqual(150);
    });

    it('should have at least 30 devices for structural variety', () => {
      expect(HOT_TAKE_DEVICES.length).toBeGreaterThanOrEqual(30);
    });
  });

  describe('getTemplateVariables()', () => {
    it('should return hotTakeSubject and hotTakeDevice', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.hotTakeSubject).toBeDefined();
      expect(templateVars.hotTakeDevice).toBeDefined();
    });

    it('should return subject from HOT_TAKE_SUBJECTS array', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(HOT_TAKE_SUBJECTS).toContain(templateVars.hotTakeSubject);
    });

    it('should return device from HOT_TAKE_DEVICES array', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(HOT_TAKE_DEVICES).toContain(templateVars.hotTakeDevice);
    });

    it('should store selected subject in instance property', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedSubject).toBe(templateVars.hotTakeSubject);
    });

    it('should store selected device in instance property', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedDevice).toBe(templateVars.hotTakeDevice);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      // Generate multiple times and collect results
      const subjectResults = new Set<string>();
      const deviceResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        subjectResults.add(templateVars.hotTakeSubject);
        deviceResults.add(templateVars.hotTakeDevice);
      }

      // With random selection from 192 subjects and 32 devices,
      // we should get at least 2 different values for each
      expect(subjectResults.size).toBeGreaterThan(1);
      expect(deviceResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should return selectedSubject in metadata', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      // First call getTemplateVariables to populate selections
      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.selectedSubject).toBeDefined();
      expect(typeof metadata.selectedSubject).toBe('string');
    });

    it('should return selectedDevice in metadata', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      // First call getTemplateVariables to populate selections
      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.selectedDevice).toBeDefined();
      expect(typeof metadata.selectedDevice).toBe('string');
    });

    it('should match instance properties', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.selectedSubject).toBe(generator.selectedSubject);
      expect(metadata.selectedDevice).toBe(generator.selectedDevice);
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

    it('should pass hotTakeSubject and hotTakeDevice to PromptLoader template variables', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      // Verify loadPromptWithVariables was called with hotTakeSubject and hotTakeDevice
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalled();

      // Find the call for the user prompt (hot-take.txt)
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'hot-take.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.hotTakeSubject).toBeDefined();
      expect(templateVars.hotTakeDevice).toBeDefined();
    });

    it('should include selectedSubject and selectedDevice in result metadata', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.selectedSubject).toBeDefined();
      expect(result.metadata?.selectedDevice).toBeDefined();
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
