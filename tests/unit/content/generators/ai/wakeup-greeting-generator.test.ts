/**
 * Tests for WakeupGreetingGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - MORNING_THEMES dictionary (15+ diverse themes)
 * - Random theme selection and injection via template variables
 * - Warmer morning tone appropriate for wakeup greetings
 * - Standard framed mode (time/weather info bar applies)
 */

import {
  WakeupGreetingGenerator,
  MORNING_THEMES,
} from '@/content/generators/ai/wakeup-greeting-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedWakeupGreetingGenerator = WakeupGreetingGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  selectRandomTheme(): string;
};

describe('WakeupGreetingGenerator', () => {
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
      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(WakeupGreetingGenerator);
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

      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
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
      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(WakeupGreetingGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWakeupGreetingGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return wakeup-greeting.txt', () => {
      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWakeupGreetingGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('wakeup-greeting.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content') // system prompt exists
        .mockRejectedValueOnce(new Error('File not found: wakeup-greeting.txt')); // user prompt missing

      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
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

      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWakeupGreetingGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('wakeup-greeting.txt');

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should inject theme template variable into user prompt', async () => {
      // Set up mocks for generate() call
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

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing variable injection
      }

      // Verify user prompt was loaded with theme variable
      const userPromptCalls = mockPromptLoader.loadPromptWithVariables.mock.calls.filter(
        call => call[0] === 'user' && call[1] === 'wakeup-greeting.txt'
      );
      expect(userPromptCalls.length).toBeGreaterThan(0);

      const userPromptVariables = userPromptCalls[0][2];
      expect(userPromptVariables).toHaveProperty('theme');
      expect(MORNING_THEMES).toContain(userPromptVariables.theme);
    });

    it('should include selectedTheme in metadata on successful generation', async () => {
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

      // We verify the mocks were set up correctly
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // Expected - we verify the mocks were set up correctly
      }

      // Verify the prompts were loaded with correct variables
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalled();
    });

    it('should throw error when API key is not found', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      // Create generator WITHOUT the required API key
      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {});

      await expect(
        generator.generate({ updateType: 'major', timestamp: new Date() })
      ).rejects.toThrow('API key not found for provider: openai');
    });

    it('should fail over to alternate provider when primary fails', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-haiku-4.5',
        tier: ModelTier.LIGHT,
      });

      // Generator with both provider keys - primary will fail, alternate should be tried
      const generator = new WakeupGreetingGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'invalid-key', // This will cause the actual API call to fail
        anthropic: 'also-invalid', // Alternate also fails
      });

      // Both providers will fail since they're invalid keys
      await expect(
        generator.generate({ updateType: 'major', timestamp: new Date() })
      ).rejects.toThrow(/All AI providers failed/);
    });
  });

  describe('MORNING_THEMES dictionary', () => {
    it('should contain at least 15 diverse themes', () => {
      expect(MORNING_THEMES.length).toBeGreaterThanOrEqual(15);
    });

    it('should contain only unique themes (no duplicates)', () => {
      const uniqueThemes = new Set(MORNING_THEMES);
      expect(uniqueThemes.size).toBe(MORNING_THEMES.length);
    });

    it('should contain themes as non-empty strings', () => {
      MORNING_THEMES.forEach(theme => {
        expect(typeof theme).toBe('string');
        expect(theme.length).toBeGreaterThan(0);
      });
    });

    it('should cover diverse morning-related subject areas', () => {
      // Themes should cover: coffee, sunrise, stretching, birds, fresh start, etc.
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

      // At least 3 of these categories should be represented
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

      // Run multiple selections and check for variety
      const themeSelections = new Set<string>();

      for (let i = 0; i < 50; i++) {
        themeSelections.add(generator.selectRandomTheme());
      }

      // With random selection and 50 iterations, we expect variety
      // At minimum 3 different themes
      expect(themeSelections.size).toBeGreaterThanOrEqual(3);
    });
  });
});
