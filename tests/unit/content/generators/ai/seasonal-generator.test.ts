import { SeasonalGenerator } from '@/content/generators/ai/seasonal-generator.js';
import { PromptLoader } from '@/content/prompt-loader.js';
import { ModelTierSelector } from '@/api/ai/model-tier-selector.js';
import { AIProviderType } from '@/api/ai/index.js';

// Helper type for accessing protected members in tests
type ProtectedSeasonalGenerator = SeasonalGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
};

// Mock the AI provider factory
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn().mockReturnValue({
    generate: jest.fn().mockResolvedValue({
      text: 'HAPPY HOLIDAYS\nFROM ALL OF US',
      model: 'test-model',
      tokensUsed: 50,
    }),
  }),
  AIProviderType: { OPENAI: 'openai', ANTHROPIC: 'anthropic' },
}));

describe('SeasonalGenerator', () => {
  let generator: SeasonalGenerator;
  let promptLoader: PromptLoader;
  let modelTierSelector: ModelTierSelector;

  beforeEach(() => {
    promptLoader = new PromptLoader('./prompts');
    modelTierSelector = new ModelTierSelector(AIProviderType.OPENAI, [AIProviderType.OPENAI]);

    generator = new SeasonalGenerator(promptLoader, modelTierSelector, {
      openai: 'test-api-key',
    });
  });

  describe('validate', () => {
    it('should pass validation when prompt files exist', async () => {
      const result = await generator.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate', () => {
    it('should generate seasonal content successfully', async () => {
      const context = {
        updateType: 'major' as const,
        timestamp: new Date('2024-12-25T10:00:00Z'),
      };

      const result = await generator.generate(context);

      expect(result.text).toBeDefined();
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
    });

    it('should include model tier in metadata', async () => {
      const context = {
        updateType: 'major' as const,
        timestamp: new Date(),
      };

      const result = await generator.generate(context);

      expect(result.metadata?.tier).toBe('light');
    });
  });

  describe('prompt files', () => {
    it('should use major-update-base.txt for system prompt', async () => {
      // Access protected method via typed cast for testing
      const protectedGenerator = generator as ProtectedSeasonalGenerator;
      const systemFile = protectedGenerator.getSystemPromptFile();
      expect(systemFile).toBe('major-update-base.txt');
    });

    it('should use seasonal.txt for user prompt', async () => {
      // Access protected method via typed cast for testing
      const protectedGenerator = generator as ProtectedSeasonalGenerator;
      const userFile = protectedGenerator.getUserPromptFile();
      expect(userFile).toBe('seasonal.txt');
    });
  });
});
