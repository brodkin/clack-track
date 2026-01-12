/**
 * Tests for ParadoxEngineGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Generates paradox content via AI provider with curated selection
 * - Handles AI provider failures gracefully
 * - Selects random paradox and application from curated databases
 */

import { ParadoxEngineGenerator } from '@/content/generators/ai/paradox-engine-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedParadoxEngineGenerator = ParadoxEngineGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('ParadoxEngineGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn(),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn(),
      getAlternate: jest.fn(),
    } as unknown as jest.Mocked<ModelTierSelector>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(ParadoxEngineGenerator);
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

      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
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
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedParadoxEngineGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return logical-paradox.txt', () => {
      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedParadoxEngineGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('logical-paradox.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      // Assuming prompts exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when system prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockRejectedValueOnce(new Error('File not found')) // system prompt fails
        .mockResolvedValueOnce('user prompt content'); // user prompt succeeds

      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('System prompt not found');
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content') // system prompt succeeds
        .mockRejectedValueOnce(new Error('File not found')); // user prompt fails

      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('User prompt not found');
    });

    it('should return invalid when both prompt files are missing', async () => {
      mockPromptLoader.loadPrompt.mockRejectedValue(new Error('File not found'));

      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('generate()', () => {
    it('should load correct prompts and use LIGHT tier', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedParadoxEngineGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('logical-paradox.txt');

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should inject paradox and application template variables', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue(
        'test prompt with {{paradox}} and {{application}}'
      );
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the variable injection
      }

      // Check that loadPromptWithVariables was called with paradox and application
      const userPromptCalls = mockPromptLoader.loadPromptWithVariables.mock.calls.filter(
        call => call[0] === 'user'
      );
      expect(userPromptCalls.length).toBeGreaterThan(0);

      // The variables should include paradox and application
      const lastUserCall = userPromptCalls[userPromptCalls.length - 1];
      const variables = lastUserCall[2];
      expect(variables).toHaveProperty('paradox');
      expect(variables).toHaveProperty('application');
      expect(typeof variables.paradox).toBe('string');
      expect(typeof variables.application).toBe('string');
    });

    it('should throw error when API key is missing for provider', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      // Create generator without API keys
      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {});

      await expect(
        generator.generate({ updateType: 'major', timestamp: new Date() })
      ).rejects.toThrow('API key not found for provider: openai');
    });

    it('should throw error when all providers fail', async () => {
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

      // The generate will fail because the AI provider won't be properly mocked
      await expect(
        generator.generate({ updateType: 'major', timestamp: new Date() })
      ).rejects.toThrow(/All AI providers failed/);
    });

    it('should try alternate provider when primary fails and alternate exists', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      // Return an alternate provider
      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-haiku-4.5',
        tier: ModelTier.LIGHT,
      });

      // Create generator with both API keys
      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-openai-key',
        anthropic: 'test-anthropic-key',
      });

      // Both providers will fail due to mocking, but we verify the alternate is tried
      await expect(
        generator.generate({ updateType: 'major', timestamp: new Date() })
      ).rejects.toThrow(/All AI providers failed/);

      // Verify getAlternate was called (indicating failover attempt)
      expect(mockModelTierSelector.getAlternate).toHaveBeenCalled();
    });

    it('should throw error when alternate provider also has no API key', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      // Return an alternate provider
      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-haiku-4.5',
        tier: ModelTier.LIGHT,
      });

      // Create generator with only openai key (anthropic missing)
      const generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-openai-key',
      });

      // Primary will fail on API call, then alternate will fail on missing API key
      await expect(
        generator.generate({ updateType: 'major', timestamp: new Date() })
      ).rejects.toThrow(/All AI providers failed/);
    });
  });

  describe('paradox database', () => {
    it('should have curated paradoxes available for selection', () => {
      const _generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Access the static paradox database
      const paradoxes = ParadoxEngineGenerator.PARADOX_DATABASE;

      expect(paradoxes).toBeDefined();
      expect(Array.isArray(paradoxes)).toBe(true);
      expect(paradoxes.length).toBeGreaterThanOrEqual(20);

      // Verify some known paradoxes are included
      expect(paradoxes).toContain('SHIP_OF_THESEUS');
      expect(paradoxes).toContain('LIARS_PARADOX');
      expect(paradoxes).toContain('GRANDFATHER');
    });
  });

  describe('application contexts', () => {
    it('should have relatable application contexts available', () => {
      const _generator = new ParadoxEngineGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Access the static application database
      const applications = ParadoxEngineGenerator.APPLICATION_CONTEXTS;

      expect(applications).toBeDefined();
      expect(Array.isArray(applications)).toBe(true);
      expect(applications.length).toBeGreaterThanOrEqual(15);

      // Verify some known applications are included
      expect(applications).toContain('YOUR_COUCH');
      expect(applications).toContain('YOUR_PLAYLIST');
      expect(applications).toContain('YOUR_RELATIONSHIP');
    });
  });
});
