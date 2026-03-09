/**
 * Tests for HotTakeGenerator
 *
 * Generator-specific behavior:
 * - HOT_TAKE_SUBJECTS (192 items) and HOT_TAKE_DEVICES (32 items) arrays
 * - getTemplateVariables() returning { hotTakeSubject, hotTakeDevice }
 * - Instance property storage and getCustomMetadata()
 * - Template variable passing in generate()
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
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedSubject: string;
  selectedDevice: string;
};

describe('HotTakeGenerator', () => {
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
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: 'THERE ARE TWO TYPES\nOF DOG PEOPLE',
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('variety arrays', () => {
    it('should have HOT_TAKE_SUBJECTS array with 192 unique items', () => {
      expect(HOT_TAKE_SUBJECTS).toHaveLength(192);
      const uniqueSubjects = new Set(HOT_TAKE_SUBJECTS);
      expect(uniqueSubjects.size).toBe(HOT_TAKE_SUBJECTS.length);
    });

    it('should have HOT_TAKE_DEVICES array with 32 unique items', () => {
      expect(HOT_TAKE_DEVICES).toHaveLength(32);
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

    it('should return values from valid arrays', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(HOT_TAKE_SUBJECTS).toContain(templateVars.hotTakeSubject);
      expect(HOT_TAKE_DEVICES).toContain(templateVars.hotTakeDevice);
    });

    it('should store selections in instance properties', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedSubject).toBe(templateVars.hotTakeSubject);
      expect(generator.selectedDevice).toBe(templateVars.hotTakeDevice);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHotTakeGenerator;

      const subjectResults = new Set<string>();
      const deviceResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        subjectResults.add(templateVars.hotTakeSubject);
        deviceResults.add(templateVars.hotTakeDevice);
      }

      expect(subjectResults.size).toBeGreaterThan(1);
      expect(deviceResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
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

    it('should pass hotTakeSubject and hotTakeDevice to PromptLoader template variables', async () => {
      const generator = new HotTakeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

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
  });
});
