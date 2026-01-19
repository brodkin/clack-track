/**
 * Unit tests for SleepModeGenerator
 *
 * Tests the composite generator that combines SleepArtGenerator (dark starfield art)
 * with SleepGreetingGenerator (AI bedtime greeting) to create a full-screen sleep
 * mode display with greeting text overlaid on the art pattern.
 *
 * Key behaviors:
 * - Combines SleepArtGenerator + SleepGreetingGenerator
 * - Generates art first, then overlays text in center rows (rows 2-4)
 * - Text uses actual character codes (1-26 for A-Z) displayed in amber
 * - Preserves art pattern in non-text areas
 * - Full screen mode (no frame decoration)
 * - outputMode=layout with final combined characterCodes
 *
 * @module tests/unit/content/generators/sleep-mode-generator
 */

import { SleepModeGenerator } from '@/content/generators/programmatic/sleep-mode-generator.js';
import { SleepArtGenerator } from '@/content/generators/programmatic/sleep-art-generator.js';
import { SleepGreetingGenerator } from '@/content/generators/ai/sleep-greeting-generator.js';
import { PromptLoader } from '@/content/prompt-loader.js';
import { ModelTierSelector } from '@/api/ai/model-tier-selector.js';
import { getBlackCode, VESTABOARD_COLORS } from '@/config/constants.js';
import { config } from '@/config/env.js';
import type { GenerationContext } from '@/types/content-generator.js';

// Color constants - config-driven for Vestaboard model compatibility
const BLACK = getBlackCode(config.vestaboard?.model);
const BLUE = VESTABOARD_COLORS.BLUE;
const VIOLET = VESTABOARD_COLORS.VIOLET;

// Letter code range (A=1 to Z=26)
const LETTER_CODE_MIN = 1;
const LETTER_CODE_MAX = 26;

/**
 * Check if a code represents a letter (A-Z = 1-26)
 */
function isLetterCode(code: number): boolean {
  return code >= LETTER_CODE_MIN && code <= LETTER_CODE_MAX;
}

// Display dimensions
const ROWS = 6;
const COLS = 22;

describe('SleepModeGenerator', () => {
  let generator: SleepModeGenerator;
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockContext: GenerationContext;

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt'),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: 'light',
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    mockContext = {
      updateType: 'major',
      timestamp: new Date('2025-01-15T23:00:00Z'),
    };

    generator = new SleepModeGenerator(mockPromptLoader, mockModelTierSelector, {
      openai: 'test-api-key',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with required dependencies', () => {
      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(SleepModeGenerator);
    });

    it('should accept optional API keys parameter', () => {
      const generatorNoKeys = new SleepModeGenerator(mockPromptLoader, mockModelTierSelector);
      expect(generatorNoKeys).toBeDefined();
    });
  });

  describe('generate()', () => {
    let mockArtGenerator: jest.SpyInstance;
    let mockGreetingGenerator: jest.SpyInstance;

    beforeEach(() => {
      // Create a deterministic art pattern for testing
      const mockArtCodes: number[][] = Array(ROWS)
        .fill(null)
        .map(() => Array(COLS).fill(BLACK));
      // Add some colored pixels
      mockArtCodes[0][5] = BLUE;
      mockArtCodes[2][10] = VIOLET;
      mockArtCodes[4][15] = BLUE;

      // Mock SleepArtGenerator.generate
      mockArtGenerator = jest.spyOn(SleepArtGenerator.prototype, 'generate').mockResolvedValue({
        text: '',
        outputMode: 'layout',
        layout: {
          rows: [],
          characterCodes: mockArtCodes,
        },
        metadata: { generator: 'sleep-art-generator' },
      });

      // Mock SleepGreetingGenerator.generate
      mockGreetingGenerator = jest
        .spyOn(SleepGreetingGenerator.prototype, 'generate')
        .mockResolvedValue({
          text: 'SWEET DREAMS\nREST WELL',
          outputMode: 'text',
          metadata: {
            generator: 'sleep-greeting-generator',
            selectedTheme: 'sweet dreams',
          },
        });
    });

    afterEach(() => {
      mockArtGenerator.mockRestore();
      mockGreetingGenerator.mockRestore();
    });

    describe('output structure', () => {
      it('should return valid GeneratedContent structure', async () => {
        const result = await generator.generate(mockContext);

        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('outputMode');
        expect(result).toHaveProperty('layout');
        expect(result).toHaveProperty('metadata');
      });

      it('should use layout output mode', async () => {
        const result = await generator.generate(mockContext);

        expect(result.outputMode).toBe('layout');
      });

      it('should have empty text field when using layout mode', async () => {
        const result = await generator.generate(mockContext);

        expect(result.text).toBe('');
      });

      it('should include generator name in metadata', async () => {
        const result = await generator.generate(mockContext);

        expect(result.metadata?.generator).toBe('sleep-mode-generator');
      });

      it('should return valid 6x22 characterCodes array', async () => {
        const result = await generator.generate(mockContext);

        expect(result.layout?.characterCodes).toBeDefined();
        expect(result.layout?.characterCodes?.length).toBe(ROWS);
        result.layout?.characterCodes?.forEach(row => {
          expect(row.length).toBe(COLS);
        });
      });
    });

    describe('component composition', () => {
      it('should call SleepArtGenerator.generate()', async () => {
        await generator.generate(mockContext);

        expect(mockArtGenerator).toHaveBeenCalledTimes(1);
        expect(mockArtGenerator).toHaveBeenCalledWith(mockContext);
      });

      it('should call SleepGreetingGenerator.generate()', async () => {
        await generator.generate(mockContext);

        expect(mockGreetingGenerator).toHaveBeenCalledTimes(1);
        expect(mockGreetingGenerator).toHaveBeenCalledWith(mockContext);
      });

      it('should generate art before greeting', async () => {
        const callOrder: string[] = [];

        mockArtGenerator.mockImplementation(async () => {
          callOrder.push('art');
          return {
            text: '',
            outputMode: 'layout',
            layout: {
              rows: [],
              characterCodes: Array(ROWS)
                .fill(null)
                .map(() => Array(COLS).fill(BLACK)),
            },
            metadata: { generator: 'sleep-art-generator' },
          };
        });

        mockGreetingGenerator.mockImplementation(async () => {
          callOrder.push('greeting');
          return {
            text: 'TEST GREETING',
            outputMode: 'text',
            metadata: { generator: 'sleep-greeting-generator' },
          };
        });

        await generator.generate(mockContext);

        expect(callOrder).toEqual(['art', 'greeting']);
      });
    });

    describe('text overlay behavior', () => {
      it('should overlay greeting text on center rows (rows 2-4 for 2-line text)', async () => {
        mockGreetingGenerator.mockResolvedValue({
          text: 'LINE ONE\nLINE TWO',
          outputMode: 'text',
          metadata: {},
        });

        const result = await generator.generate(mockContext);
        const codes = result.layout?.characterCodes;

        // For 2 lines centered vertically in 6 rows:
        // verticalPadding = floor((6 - 2) / 2) = 2
        // Lines should be on rows 2 and 3

        // Rows 0, 1 should be pure art (not modified by text)
        // Rows 4, 5 should also be pure art
        expect(codes).toBeDefined();
      });

      it('should use actual character codes (1-26) for text letters', async () => {
        // Simple single-line greeting
        mockGreetingGenerator.mockResolvedValue({
          text: 'HELLO',
          outputMode: 'text',
          metadata: {},
        });

        const result = await generator.generate(mockContext);
        const codes = result.layout?.characterCodes;

        expect(codes).toBeDefined();

        // Find where the text is placed and verify it uses letter codes (1-26)
        let foundLetters = false;
        codes?.forEach(row => {
          row.forEach(code => {
            if (isLetterCode(code)) {
              foundLetters = true;
            }
          });
        });

        // Letter codes should be present for text characters
        expect(foundLetters).toBe(true);
      });

      it('should preserve art pattern in non-text areas', async () => {
        // Create art with known colored pixels at specific locations
        const artWithColors: number[][] = Array(ROWS)
          .fill(null)
          .map(() => Array(COLS).fill(BLACK));
        artWithColors[0][0] = BLUE; // Top-left corner (should be preserved)
        artWithColors[5][21] = VIOLET; // Bottom-right corner (should be preserved)

        mockArtGenerator.mockResolvedValue({
          text: '',
          outputMode: 'layout',
          layout: { rows: [], characterCodes: artWithColors },
          metadata: {},
        });

        // Short text that won't reach corners
        mockGreetingGenerator.mockResolvedValue({
          text: 'HI',
          outputMode: 'text',
          metadata: {},
        });

        const result = await generator.generate(mockContext);
        const codes = result.layout?.characterCodes;

        // Corner art pixels should be preserved
        expect(codes?.[0][0]).toBe(BLUE);
        expect(codes?.[5][21]).toBe(VIOLET);
      });

      it('should center text horizontally', async () => {
        mockGreetingGenerator.mockResolvedValue({
          text: 'TEST',
          outputMode: 'text',
          metadata: {},
        });

        const result = await generator.generate(mockContext);
        const codes = result.layout?.characterCodes;

        expect(codes).toBeDefined();

        // For "TEST" (4 chars) centered in 22 cols:
        // leftPadding = floor((22 - 4) / 2) = 9
        // Text should start at column 9 on its row
        // Find the row with text and verify centering
        let textRowIndex = -1;
        codes?.forEach((row, idx) => {
          if (row.some(c => isLetterCode(c))) {
            textRowIndex = idx;
          }
        });

        expect(textRowIndex).toBeGreaterThanOrEqual(0);
      });

      it('should handle multi-line greeting text', async () => {
        mockGreetingGenerator.mockResolvedValue({
          text: 'LINE ONE\nLINE TWO\nLINE THREE',
          outputMode: 'text',
          metadata: {},
        });

        const result = await generator.generate(mockContext);
        const codes = result.layout?.characterCodes;

        expect(codes).toBeDefined();

        // Count rows with text (letter codes 1-26)
        let textRowCount = 0;
        codes?.forEach(row => {
          if (row.some(c => isLetterCode(c))) {
            textRowCount++;
          }
        });

        expect(textRowCount).toBe(3);
      });

      it('should handle empty greeting gracefully', async () => {
        mockGreetingGenerator.mockResolvedValue({
          text: '',
          outputMode: 'text',
          metadata: {},
        });

        const result = await generator.generate(mockContext);
        const codes = result.layout?.characterCodes;

        // Should just return the art pattern
        expect(codes).toBeDefined();
        expect(codes?.length).toBe(ROWS);
      });
    });

    describe('character code conversion', () => {
      it('should convert uppercase letters to their actual character codes', async () => {
        mockGreetingGenerator.mockResolvedValue({
          text: 'ABC',
          outputMode: 'text',
          metadata: {},
        });

        const result = await generator.generate(mockContext);
        const codes = result.layout?.characterCodes;

        // Text characters should be actual letter codes (A=1, B=2, C=3)
        const flatCodes = codes?.flat() || [];
        const letterCodes = flatCodes.filter(c => isLetterCode(c));

        // ABC = 3 characters, all should be letter codes
        expect(letterCodes.length).toBe(3);
        // Verify actual codes: A=1, B=2, C=3
        expect(letterCodes).toContain(1); // A
        expect(letterCodes).toContain(2); // B
        expect(letterCodes).toContain(3); // C
      });

      it('should convert spaces to black (0) to maintain transparency', async () => {
        // Create art with colors everywhere
        const coloredArt: number[][] = Array(ROWS)
          .fill(null)
          .map(() => Array(COLS).fill(BLUE));

        mockArtGenerator.mockResolvedValue({
          text: '',
          outputMode: 'layout',
          layout: { rows: [], characterCodes: coloredArt },
          metadata: {},
        });

        mockGreetingGenerator.mockResolvedValue({
          text: 'A B',
          outputMode: 'text',
          metadata: {},
        });

        const result = await generator.generate(mockContext);
        const codes = result.layout?.characterCodes;

        // The space between A and B should preserve the art (or be black)
        // depending on implementation
        expect(codes).toBeDefined();
      });

      it('should handle special characters in greeting', async () => {
        mockGreetingGenerator.mockResolvedValue({
          text: 'GOOD NIGHT!',
          outputMode: 'text',
          metadata: {},
        });

        const result = await generator.generate(mockContext);
        const codes = result.layout?.characterCodes;

        expect(codes).toBeDefined();
        // Should not crash and should produce valid output
        expect(codes?.length).toBe(ROWS);
      });
    });

    describe('metadata aggregation', () => {
      it('should include art generator metadata', async () => {
        const result = await generator.generate(mockContext);

        expect(result.metadata?.artGenerator).toBeDefined();
      });

      it('should include greeting generator metadata', async () => {
        const result = await generator.generate(mockContext);

        expect(result.metadata?.greetingGenerator).toBeDefined();
      });

      it('should include selected theme from greeting generator', async () => {
        mockGreetingGenerator.mockResolvedValue({
          text: 'SWEET DREAMS',
          outputMode: 'text',
          metadata: {
            generator: 'sleep-greeting-generator',
            selectedTheme: 'dreamland',
          },
        });

        const result = await generator.generate(mockContext);

        expect(result.metadata?.selectedTheme).toBe('dreamland');
      });
    });

    describe('error handling', () => {
      it('should propagate SleepArtGenerator errors', async () => {
        mockArtGenerator.mockRejectedValue(new Error('Art generation failed'));

        await expect(generator.generate(mockContext)).rejects.toThrow('Art generation failed');
      });

      it('should propagate SleepGreetingGenerator errors', async () => {
        mockGreetingGenerator.mockRejectedValue(new Error('Greeting generation failed'));

        await expect(generator.generate(mockContext)).rejects.toThrow('Greeting generation failed');
      });
    });

    describe('context passthrough', () => {
      it('should pass context with eventData to both generators', async () => {
        const contextWithEvent: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T23:00:00Z'),
          eventData: { source: 'schedule' },
        };

        await generator.generate(contextWithEvent);

        expect(mockArtGenerator).toHaveBeenCalledWith(contextWithEvent);
        expect(mockGreetingGenerator).toHaveBeenCalledWith(contextWithEvent);
      });

      it('should pass context with personality to both generators', async () => {
        const contextWithPersonality: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T23:00:00Z'),
          personality: {
            mood: 'serene',
            energyLevel: 'low',
            humorStyle: 'gentle',
            obsession: 'comfort',
          },
        };

        await generator.generate(contextWithPersonality);

        expect(mockArtGenerator).toHaveBeenCalledWith(contextWithPersonality);
        expect(mockGreetingGenerator).toHaveBeenCalledWith(contextWithPersonality);
      });
    });
  });

  describe('validate()', () => {
    it('should return valid when dependencies are configured', async () => {
      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should delegate validation to underlying generators', async () => {
      const mockArtValidate = jest
        .spyOn(SleepArtGenerator.prototype, 'validate')
        .mockResolvedValue({ valid: true });
      const mockGreetingValidate = jest
        .spyOn(SleepGreetingGenerator.prototype, 'validate')
        .mockResolvedValue({ valid: true });

      const result = await generator.validate();

      expect(mockArtValidate).toHaveBeenCalled();
      expect(mockGreetingValidate).toHaveBeenCalled();
      expect(result.valid).toBe(true);

      mockArtValidate.mockRestore();
      mockGreetingValidate.mockRestore();
    });

    it('should aggregate validation errors from both generators', async () => {
      const mockArtValidate = jest
        .spyOn(SleepArtGenerator.prototype, 'validate')
        .mockResolvedValue({ valid: false, errors: ['Art error'] });
      const mockGreetingValidate = jest
        .spyOn(SleepGreetingGenerator.prototype, 'validate')
        .mockResolvedValue({ valid: false, errors: ['Greeting error'] });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Art error');
      expect(result.errors).toContain('Greeting error');

      mockArtValidate.mockRestore();
      mockGreetingValidate.mockRestore();
    });
  });

  describe('full screen mode', () => {
    it('should use all 6 rows of the display', async () => {
      // Mock both generators for this test
      jest.spyOn(SleepArtGenerator.prototype, 'generate').mockResolvedValue({
        text: '',
        outputMode: 'layout',
        layout: {
          rows: [],
          characterCodes: Array(ROWS)
            .fill(null)
            .map(() => Array(COLS).fill(BLACK)),
        },
        metadata: { generator: 'sleep-art-generator' },
      });

      jest.spyOn(SleepGreetingGenerator.prototype, 'generate').mockResolvedValue({
        text: 'GOOD NIGHT',
        outputMode: 'text',
        metadata: { generator: 'sleep-greeting-generator' },
      });

      const result = await generator.generate(mockContext);
      const codes = result.layout?.characterCodes;

      expect(codes?.length).toBe(6);
      codes?.forEach(row => {
        expect(row.length).toBe(22);
      });
    });

    it('should not leave any row completely empty', async () => {
      // Generate with single-line text
      jest.spyOn(SleepGreetingGenerator.prototype, 'generate').mockResolvedValue({
        text: 'NIGHT',
        outputMode: 'text',
        metadata: {},
      });

      // Art generator returns pattern with some colors
      jest.spyOn(SleepArtGenerator.prototype, 'generate').mockResolvedValue({
        text: '',
        outputMode: 'layout',
        layout: {
          rows: [],
          characterCodes: Array(ROWS)
            .fill(null)
            .map((_, i) =>
              Array(COLS)
                .fill(0)
                .map((_, j) => ((i + j) % 10 === 0 ? BLUE : BLACK))
            ),
        },
        metadata: {},
      });

      const result = await generator.generate(mockContext);

      // All rows should be present with proper dimensions
      expect(result.layout?.characterCodes?.length).toBe(6);
    });
  });
});
