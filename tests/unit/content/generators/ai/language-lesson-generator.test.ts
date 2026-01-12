/**
 * Tests for LanguageLessonGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Generates language lesson content via AI provider
 * - Handles AI provider failures gracefully
 * - Static dictionary arrays contain expected values
 * - Random selection methods work correctly
 */

import { LanguageLessonGenerator } from '@/content/generators/ai/language-lesson-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedLanguageLessonGenerator = LanguageLessonGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('LanguageLessonGenerator', () => {
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
      const generator = new LanguageLessonGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(LanguageLessonGenerator);
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

      const generator = new LanguageLessonGenerator(mockPromptLoader, mockModelTierSelector, {
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
      const generator = new LanguageLessonGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedLanguageLessonGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return language-lesson.txt', () => {
      const generator = new LanguageLessonGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedLanguageLessonGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('language-lesson.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new LanguageLessonGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      // Assuming prompts exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('static dictionaries', () => {
    describe('DUOLINGO_VOICES', () => {
      it('should contain all expected Duolingo character voices', () => {
        expect(LanguageLessonGenerator.DUOLINGO_VOICES).toContain('LILY_GOTH_SASS');
        expect(LanguageLessonGenerator.DUOLINGO_VOICES).toContain('OSCAR_DRAMATIC');
        expect(LanguageLessonGenerator.DUOLINGO_VOICES).toContain('EDDY_AWKWARD');
        expect(LanguageLessonGenerator.DUOLINGO_VOICES).toContain('ZARI_PERFECTIONIST');
        expect(LanguageLessonGenerator.DUOLINGO_VOICES).toContain('JUNIOR_EARNEST');
        expect(LanguageLessonGenerator.DUOLINGO_VOICES).toContain('DUO_CHAOTIC');
      });

      it('should have exactly 6 voices', () => {
        expect(LanguageLessonGenerator.DUOLINGO_VOICES).toHaveLength(6);
      });
    });

    describe('PHRASE_TYPES', () => {
      it('should contain all expected phrase types', () => {
        expect(LanguageLessonGenerator.PHRASE_TYPES).toContain('ABSURD_LITERAL');
        expect(LanguageLessonGenerator.PHRASE_TYPES).toContain('PASSIVE_AGGRESSIVE');
        expect(LanguageLessonGenerator.PHRASE_TYPES).toContain('EXISTENTIAL_FOOD');
        expect(LanguageLessonGenerator.PHRASE_TYPES).toContain('WORKPLACE_CHAOS');
        expect(LanguageLessonGenerator.PHRASE_TYPES).toContain('RELATIONSHIP_DRAMA');
        expect(LanguageLessonGenerator.PHRASE_TYPES).toContain('SELF_AWARE');
      });

      it('should have exactly 6 phrase types', () => {
        expect(LanguageLessonGenerator.PHRASE_TYPES).toHaveLength(6);
      });
    });

    describe('LANGUAGES', () => {
      it('should contain all expected languages', () => {
        expect(LanguageLessonGenerator.LANGUAGES).toContain('SPANISH');
        expect(LanguageLessonGenerator.LANGUAGES).toContain('FRENCH');
        expect(LanguageLessonGenerator.LANGUAGES).toContain('GERMAN');
        expect(LanguageLessonGenerator.LANGUAGES).toContain('CHINESE');
        expect(LanguageLessonGenerator.LANGUAGES).toContain('JAPANESE');
        expect(LanguageLessonGenerator.LANGUAGES).toContain('RUSSIAN');
        expect(LanguageLessonGenerator.LANGUAGES).toContain('CZECH');
      });

      it('should have exactly 7 languages', () => {
        expect(LanguageLessonGenerator.LANGUAGES).toHaveLength(7);
      });
    });

    describe('FORMATS', () => {
      it('should contain all expected formats', () => {
        expect(LanguageLessonGenerator.FORMATS).toContain('PHRASE_TRANSLATION');
        expect(LanguageLessonGenerator.FORMATS).toContain('FILL_THE_BLANK');
      });

      it('should have exactly 2 formats', () => {
        expect(LanguageLessonGenerator.FORMATS).toHaveLength(2);
      });
    });
  });

  describe('static selection methods', () => {
    describe('selectDuolingoVoice()', () => {
      it('should return a voice from DUOLINGO_VOICES', () => {
        const voice = LanguageLessonGenerator.selectDuolingoVoice();
        expect(LanguageLessonGenerator.DUOLINGO_VOICES).toContain(voice);
      });

      it('should return different voices over multiple calls (statistical)', () => {
        const voices = new Set<string>();
        for (let i = 0; i < 100; i++) {
          voices.add(LanguageLessonGenerator.selectDuolingoVoice());
        }
        // With 6 options and 100 iterations, we should see at least 2 different voices
        expect(voices.size).toBeGreaterThan(1);
      });
    });

    describe('selectPhraseType()', () => {
      it('should return a type from PHRASE_TYPES', () => {
        const type = LanguageLessonGenerator.selectPhraseType();
        expect(LanguageLessonGenerator.PHRASE_TYPES).toContain(type);
      });

      it('should return different types over multiple calls (statistical)', () => {
        const types = new Set<string>();
        for (let i = 0; i < 100; i++) {
          types.add(LanguageLessonGenerator.selectPhraseType());
        }
        expect(types.size).toBeGreaterThan(1);
      });
    });

    describe('selectLanguage()', () => {
      it('should return a language from LANGUAGES', () => {
        const language = LanguageLessonGenerator.selectLanguage();
        expect(LanguageLessonGenerator.LANGUAGES).toContain(language);
      });

      it('should return different languages over multiple calls (statistical)', () => {
        const languages = new Set<string>();
        for (let i = 0; i < 100; i++) {
          languages.add(LanguageLessonGenerator.selectLanguage());
        }
        expect(languages.size).toBeGreaterThan(1);
      });
    });

    describe('selectFormat()', () => {
      it('should return a format from FORMATS', () => {
        const format = LanguageLessonGenerator.selectFormat();
        expect(LanguageLessonGenerator.FORMATS).toContain(format);
      });

      it('should return different formats over multiple calls (statistical)', () => {
        const formats = new Set<string>();
        for (let i = 0; i < 100; i++) {
          formats.add(LanguageLessonGenerator.selectFormat());
        }
        // With only 2 options, we should see both
        expect(formats.size).toBe(2);
      });
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

      const generator = new LanguageLessonGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedLanguageLessonGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('language-lesson.txt');

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should inject duolingoVoice, phraseType, language, and format variables into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new LanguageLessonGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider
      }

      // Verify loadPromptWithVariables was called for user prompt with the expected variables
      const userPromptCalls = mockPromptLoader.loadPromptWithVariables.mock.calls.filter(
        call => call[0] === 'user' && call[1] === 'language-lesson.txt'
      );

      expect(userPromptCalls.length).toBe(1);
      const variables = userPromptCalls[0][2];

      // Verify all four custom variables are present
      expect(variables).toHaveProperty('duolingoVoice');
      expect(variables).toHaveProperty('phraseType');
      expect(variables).toHaveProperty('language');
      expect(variables).toHaveProperty('format');

      // Verify they are valid values from the dictionaries
      expect(LanguageLessonGenerator.DUOLINGO_VOICES).toContain(variables.duolingoVoice);
      expect(LanguageLessonGenerator.PHRASE_TYPES).toContain(variables.phraseType);
      expect(LanguageLessonGenerator.LANGUAGES).toContain(variables.language);
      expect(LanguageLessonGenerator.FORMATS).toContain(variables.format);
    });
  });
});
