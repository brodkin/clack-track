/**
 * Tests for LanguageLessonGenerator
 *
 * Generator-specific behavior:
 * - DUOLINGO_VOICES (6), PHRASE_TYPES (6), LANGUAGES (7), FORMATS (1) static arrays
 * - Static selection methods (selectDuolingoVoice, selectPhraseType, selectLanguage, selectFormat)
 * - Template variable injection (duolingoVoice, phraseType, language, format)
 */

import { LanguageLessonGenerator } from '@/content/generators/ai/language-lesson-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

describe('LanguageLessonGenerator', () => {
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
      it('should have exactly 1 format (PHRASE_TRANSLATION)', () => {
        expect(LanguageLessonGenerator.FORMATS).toHaveLength(1);
        expect(LanguageLessonGenerator.FORMATS).toContain('PHRASE_TRANSLATION');
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
      it('should always return PHRASE_TRANSLATION since only one format exists', () => {
        const formats = new Set<string>();
        for (let i = 0; i < 10; i++) {
          formats.add(LanguageLessonGenerator.selectFormat());
        }
        expect(formats.size).toBe(1);
        expect(formats.has('PHRASE_TRANSLATION')).toBe(true);
      });
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
          LanguageLessonGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
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

      await generator.generate({ updateType: 'major', timestamp: new Date() });

      const userPromptCalls = mockPromptLoader.loadPromptWithVariables.mock.calls.filter(
        call => call[0] === 'user' && call[1] === 'language-lesson.txt'
      );

      expect(userPromptCalls.length).toBe(1);
      const variables = userPromptCalls[0][2];

      expect(variables).toHaveProperty('duolingoVoice');
      expect(variables).toHaveProperty('phraseType');
      expect(variables).toHaveProperty('language');
      expect(variables).toHaveProperty('format');

      expect(LanguageLessonGenerator.DUOLINGO_VOICES).toContain(variables.duolingoVoice);
      expect(LanguageLessonGenerator.PHRASE_TYPES).toContain(variables.phraseType);
      expect(LanguageLessonGenerator.LANGUAGES).toContain(variables.language);
      expect(LanguageLessonGenerator.FORMATS).toContain(variables.format);
    });
  });
});
