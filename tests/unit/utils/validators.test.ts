/**
 * Comprehensive test suite for generator output validation
 *
 * Tests validateGeneratorOutput() for both 'text' and 'layout' output modes
 * against Vestaboard constraints (framed: 5×21, unframed: 6×22).
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateGeneratorOutput,
  validateTextContent,
  validateLayoutContent,
  findInvalidCharacters,
  normalizeText,
  stripUnsupportedEmojis,
  SUPPORTED_COLOR_EMOJIS,
} from '@/utils/validators';
import type { GeneratedContent, VestaboardLayout } from '@/types/index';
import { VESTABOARD } from '@/config/constants';

describe('validateGeneratorOutput', () => {
  describe('text mode validation', () => {
    it('should accept valid text content within framed limits (5 lines, 21 chars/line)', () => {
      const content: GeneratedContent = {
        text: 'LINE 1\nLINE 2\nLINE 3\nLINE 4\nLINE 5',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.lineCount).toBe(5);
      expect(result.maxLineLength).toBeLessThanOrEqual(21);
    });

    it('should accept text exactly at framed limits (5 lines × 21 chars)', () => {
      const maxLine = 'A'.repeat(21);
      const content: GeneratedContent = {
        text: `${maxLine}\n${maxLine}\n${maxLine}\n${maxLine}\n${maxLine}`,
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.lineCount).toBe(5);
      expect(result.maxLineLength).toBe(21);
    });

    it('should reject text with too many lines (>5)', () => {
      const content: GeneratedContent = {
        text: 'L1\nL2\nL3\nL4\nL5\nL6',
        outputMode: 'text',
      };

      expect(() => validateGeneratorOutput(content)).toThrow(
        'text mode content must have at most 5 lines (found: 6)'
      );
    });

    it('should wrap text with line slightly exceeding 21 characters (safety net)', () => {
      // 22 chars gets wrapped to 2 lines that fit
      const longLine = 'GOOD MORNING LAKEWOOD CA'; // 24 chars
      const content: GeneratedContent = {
        text: longLine,
        outputMode: 'text',
      };

      // Should pass because wrapping salvages the content
      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.wrappingApplied).toBe(true);
    });

    it('should reject empty text content', () => {
      const content: GeneratedContent = {
        text: '',
        outputMode: 'text',
      };

      expect(() => validateGeneratorOutput(content)).toThrow('text content cannot be empty');
    });

    it('should reject text with invalid Vestaboard characters', () => {
      const content: GeneratedContent = {
        text: 'Hello™ World€',
        outputMode: 'text',
      };

      expect(() => validateGeneratorOutput(content)).toThrow('contains invalid characters');
    });

    it('should accept all valid Vestaboard characters', () => {
      const content: GeneratedContent = {
        text: 'ABCXYZ 123 .,:;!?',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should handle single line text content', () => {
      const content: GeneratedContent = {
        text: 'SINGLE LINE MESSAGE',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.lineCount).toBe(1);
    });

    it('should count lines correctly with trailing newline', () => {
      const content: GeneratedContent = {
        text: 'LINE 1\nLINE 2\n',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.lineCount).toBe(2); // Trailing newline should not create extra line
    });
  });

  describe('layout mode validation', () => {
    it('should accept valid layout content (6 rows × 22 cols, codes 0-69)', () => {
      const validLayout: VestaboardLayout = {
        rows: [
          'A'.repeat(22),
          'B'.repeat(22),
          'C'.repeat(22),
          'D'.repeat(22),
          'E'.repeat(22),
          'F'.repeat(22),
        ],
      };
      const content: GeneratedContent = {
        text: 'Layout content',
        outputMode: 'layout',
        layout: validLayout,
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject layout with too few rows (<6)', () => {
      const invalidLayout: VestaboardLayout = {
        rows: ['A'.repeat(22), 'B'.repeat(22), 'C'.repeat(22)],
      };
      const content: GeneratedContent = {
        text: 'Layout content',
        outputMode: 'layout',
        layout: invalidLayout,
      };

      expect(() => validateGeneratorOutput(content)).toThrow(
        'layout must have exactly 6 rows (found: 3)'
      );
    });

    it('should reject layout with too many rows (>6)', () => {
      const invalidLayout: VestaboardLayout = {
        rows: [
          'A'.repeat(22),
          'B'.repeat(22),
          'C'.repeat(22),
          'D'.repeat(22),
          'E'.repeat(22),
          'F'.repeat(22),
          'G'.repeat(22),
        ],
      };
      const content: GeneratedContent = {
        text: 'Layout content',
        outputMode: 'layout',
        layout: invalidLayout,
      };

      expect(() => validateGeneratorOutput(content)).toThrow(
        'layout must have exactly 6 rows (found: 7)'
      );
    });

    it('should reject layout with row exceeding 22 characters', () => {
      const invalidLayout: VestaboardLayout = {
        rows: [
          'A'.repeat(22),
          'B'.repeat(23), // Too long
          'C'.repeat(22),
          'D'.repeat(22),
          'E'.repeat(22),
          'F'.repeat(22),
        ],
      };
      const content: GeneratedContent = {
        text: 'Layout content',
        outputMode: 'layout',
        layout: invalidLayout,
      };

      expect(() => validateGeneratorOutput(content)).toThrow(
        'layout row 1 exceeds 22 characters (found: 23)'
      );
    });

    it('should reject layout mode without layout data', () => {
      const content: GeneratedContent = {
        text: 'Missing layout',
        outputMode: 'layout',
        // layout is undefined
      };

      expect(() => validateGeneratorOutput(content)).toThrow('layout mode requires layout data');
    });

    it('should accept layout with varying row lengths (≤22)', () => {
      const validLayout: VestaboardLayout = {
        rows: [
          'A'.repeat(22),
          'B'.repeat(15),
          'C'.repeat(10),
          'D'.repeat(22),
          'E'.repeat(5),
          'F'.repeat(22),
        ],
      };
      const content: GeneratedContent = {
        text: 'Layout content',
        outputMode: 'layout',
        layout: validLayout,
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
    });

    it('should reject layout with invalid characters', () => {
      const invalidLayout: VestaboardLayout = {
        rows: [
          'HELLO™ WORLD',
          'A'.repeat(22),
          'B'.repeat(22),
          'C'.repeat(22),
          'D'.repeat(22),
          'E'.repeat(22),
        ],
      };
      const content: GeneratedContent = {
        text: 'Layout content',
        outputMode: 'layout',
        layout: invalidLayout,
      };

      expect(() => validateGeneratorOutput(content)).toThrow('contains invalid characters');
    });
  });

  describe('edge cases', () => {
    it('should handle content with only whitespace', () => {
      const content: GeneratedContent = {
        text: '   \n   \n   ',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.lineCount).toBe(3);
    });

    it('should handle empty lines within content', () => {
      const content: GeneratedContent = {
        text: 'LINE 1\n\nLINE 3',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.lineCount).toBe(3);
    });

    it('should detect multiple invalid characters', () => {
      const content: GeneratedContent = {
        text: 'Hello™ World€ Test®',
        outputMode: 'text',
      };

      expect(() => {
        validateGeneratorOutput(content);
      }).toThrow();
    });

    it('should reject invalid outputMode', () => {
      const content = {
        text: 'TEST',
        outputMode: 'invalid',
      } as unknown as GeneratedContent;

      expect(() => validateGeneratorOutput(content)).toThrow('Invalid outputMode: invalid');
    });
  });
});

describe('validateTextContent', () => {
  it('should validate text against framed constraints (5 lines × 21 chars)', () => {
    const result = validateTextContent('LINE 1\nLINE 2\nLINE 3');

    expect(result.valid).toBe(true);
    expect(result.lineCount).toBe(3);
    expect(result.maxLineLength).toBeLessThanOrEqual(21);
  });

  it('should return detailed error for too many lines', () => {
    const text = 'L1\nL2\nL3\nL4\nL5\nL6';
    const result = validateTextContent(text);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('text mode content must have at most 5 lines (found: 6)');
  });

  it('should wrap and pass for line slightly exceeding 21 characters', () => {
    // 22 chars gets wrapped - wrapping salvages the content
    const longLine = 'GOOD MORNING EVERYONE'; // 21 chars exactly
    const slightlyLong = 'GOOD MORNING EVERYONE!'; // 22 chars - will be wrapped

    const resultExact = validateTextContent(longLine);
    expect(resultExact.valid).toBe(true);
    expect(resultExact.wrappingApplied).toBeFalsy();

    const resultWrapped = validateTextContent(slightlyLong);
    expect(resultWrapped.valid).toBe(true);
    expect(resultWrapped.wrappingApplied).toBe(true);
  });

  it('should detect invalid characters in text', () => {
    const result = validateTextContent('Hello™ World');

    expect(result.valid).toBe(false);
    expect(result.invalidChars).toContain('™');
  });

  it('should return empty error for empty text', () => {
    const result = validateTextContent('');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('text content cannot be empty');
  });

  it('should accept lowercase letters (uppercased during validation)', () => {
    const result = validateTextContent('hello world');

    expect(result.valid).toBe(true);
    expect(result.invalidChars).toHaveLength(0);
  });

  it('should accept mixed case text', () => {
    const result = validateTextContent('Hello World');

    expect(result.valid).toBe(true);
    expect(result.invalidChars).toHaveLength(0);
  });

  it('should still reject invalid chars even with lowercase', () => {
    const result = validateTextContent('hello™ world');

    expect(result.valid).toBe(false);
    expect(result.invalidChars).toContain('™');
    // Lowercase letters should NOT be in invalidChars
    expect(result.invalidChars).not.toContain('h');
    expect(result.invalidChars).not.toContain('e');
  });
});

describe('pre-validation wrapping (safety net)', () => {
  it('should wrap line exceeding 21 chars and pass validation', () => {
    // "GOOD MORNING LAKEWOOD CA" is 24 chars
    // Should wrap to "GOOD MORNING LAKEWOOD" (21) and "CA" (2)
    const result = validateTextContent('GOOD MORNING LAKEWOOD CA');

    expect(result.valid).toBe(true);
    expect(result.wrappingApplied).toBe(true);
    expect(result.originalMaxLength).toBe(24);
    expect(result.lineCount).toBe(2);
  });

  it('should set wrapping metadata correctly', () => {
    const longLine = 'THIS LINE IS TOO LONG FOR DISPLAY'; // 33 chars
    const result = validateTextContent(longLine);

    expect(result.wrappingApplied).toBe(true);
    expect(result.originalMaxLength).toBe(longLine.length);
    expect(result.normalizedText).toBeDefined();
  });

  it('should not apply wrapping when content fits', () => {
    const result = validateTextContent('SHORT LINE\nANOTHER SHORT');

    expect(result.valid).toBe(true);
    expect(result.wrappingApplied).toBe(false);
    expect(result.originalMaxLength).toBeUndefined();
  });

  it('should FAIL when wrapping causes line count to exceed 5', () => {
    // Create content where wrapping will cause >5 lines
    // 4 short lines + 1 very long line that wraps to 3+ lines = >5 total
    const veryLongLine = 'THIS IS A VERY LONG LINE THAT WILL WRAP TO MULTIPLE LINES';
    const content = `LINE 1\nLINE 2\nLINE 3\nLINE 4\n${veryLongLine}`;

    const result = validateTextContent(content);

    expect(result.valid).toBe(false);
    expect(result.wrappingApplied).toBe(true);
    expect(result.errors[0]).toMatch(/exceeds 5 lines after wrapping/);
  });

  it('should preserve wrapped text in normalizedText', () => {
    const result = validateTextContent('HELLO WORLD EVERYONE TODAY');

    expect(result.valid).toBe(true);
    expect(result.normalizedText).toBeDefined();
    // Check that each line in normalized text is ≤21 chars
    const lines = result.normalizedText!.split('\n');
    lines.forEach(line => {
      expect(line.length).toBeLessThanOrEqual(21);
    });
  });

  it('should handle multiple long lines needing wrapping', () => {
    // Both lines exceed 21 chars
    const content = 'FIRST LONG LINE HERE TODAY\nSECOND LONG LINE ALSO';

    const result = validateTextContent(content);

    expect(result.wrappingApplied).toBe(true);
    expect(result.lineCount).toBeGreaterThan(2);
  });

  it('should truncate single word longer than 21 chars', () => {
    // wrapText truncates single words that exceed maxWidth
    const veryLongWord = 'A'.repeat(25);
    const result = validateTextContent(veryLongWord);

    expect(result.valid).toBe(true);
    expect(result.wrappingApplied).toBe(true);
    expect(result.maxLineLength).toBeLessThanOrEqual(21);
  });

  it('should work with text mode through validateGeneratorOutput', () => {
    const content: GeneratedContent = {
      text: 'THIS LINE EXCEEDS THE LIMIT',
      outputMode: 'text',
    };

    const result = validateGeneratorOutput(content);

    expect(result.valid).toBe(true);
    expect(result.wrappingApplied).toBe(true);
  });

  it('should throw when wrapping exceeds 5 lines through validateGeneratorOutput', () => {
    // 5 lines already + long line that wraps = >5 lines
    const content: GeneratedContent = {
      text: 'L1\nL2\nL3\nL4\nTHIS IS A VERY LONG LINE THAT WILL WRAP',
      outputMode: 'text',
    };

    expect(() => validateGeneratorOutput(content)).toThrow(/exceeds 5 lines after wrapping/);
  });
});

describe('validateLayoutContent', () => {
  it('should validate layout against unframed constraints (6 rows × 22 cols)', () => {
    const layout: VestaboardLayout = {
      rows: [
        'A'.repeat(22),
        'B'.repeat(22),
        'C'.repeat(22),
        'D'.repeat(22),
        'E'.repeat(22),
        'F'.repeat(22),
      ],
    };

    const result = validateLayoutContent(layout);

    expect(result.valid).toBe(true);
    expect(result.lineCount).toBe(6);
    expect(result.maxLineLength).toBe(22);
  });

  it('should return detailed error for wrong row count', () => {
    const layout: VestaboardLayout = {
      rows: ['A'.repeat(22), 'B'.repeat(22)],
    };

    const result = validateLayoutContent(layout);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('layout must have exactly 6 rows (found: 2)');
  });

  it('should return detailed error for row too long', () => {
    const layout: VestaboardLayout = {
      rows: [
        'A'.repeat(22),
        'B'.repeat(25),
        'C'.repeat(22),
        'D'.repeat(22),
        'E'.repeat(22),
        'F'.repeat(22),
      ],
    };

    const result = validateLayoutContent(layout);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/row 1 exceeds 22 characters/);
  });

  it('should detect invalid characters in layout rows', () => {
    const layout: VestaboardLayout = {
      rows: [
        'Hello™',
        'B'.repeat(22),
        'C'.repeat(22),
        'D'.repeat(22),
        'E'.repeat(22),
        'F'.repeat(22),
      ],
    };

    const result = validateLayoutContent(layout);

    expect(result.valid).toBe(false);
    expect(result.invalidChars).toContain('™');
  });

  it('should accept lowercase letters in layout (uppercased during validation)', () => {
    const layout: VestaboardLayout = {
      rows: [
        'hello world test row',
        'B'.repeat(22),
        'C'.repeat(22),
        'D'.repeat(22),
        'E'.repeat(22),
        'F'.repeat(22),
      ],
    };

    const result = validateLayoutContent(layout);

    expect(result.valid).toBe(true);
    expect(result.invalidChars).toHaveLength(0);
  });

  it('should still reject invalid chars in layout even with lowercase', () => {
    const layout: VestaboardLayout = {
      rows: [
        'hello™ world',
        'B'.repeat(22),
        'C'.repeat(22),
        'D'.repeat(22),
        'E'.repeat(22),
        'F'.repeat(22),
      ],
    };

    const result = validateLayoutContent(layout);

    expect(result.valid).toBe(false);
    expect(result.invalidChars).toContain('™');
    expect(result.invalidChars).not.toContain('h');
  });
});

describe('findInvalidCharacters', () => {
  it('should return empty array for valid Vestaboard characters', () => {
    const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?'-()/@#$%&*";
    const invalid = findInvalidCharacters(text);

    expect(invalid).toHaveLength(0);
  });

  it('should detect single invalid character', () => {
    const invalid = findInvalidCharacters('HELLO™');

    expect(invalid).toContain('™');
    expect(invalid).toHaveLength(1);
  });

  it('should detect multiple unique invalid characters', () => {
    const invalid = findInvalidCharacters('Hello™ World€ Test®');

    expect(invalid).toContain('™');
    expect(invalid).toContain('€');
    expect(invalid).toContain('®');
    expect(invalid.length).toBeGreaterThanOrEqual(3);
  });

  it('should not duplicate invalid characters', () => {
    const invalid = findInvalidCharacters('™™™€€€');

    expect(invalid.filter(c => c === '™').length).toBe(1);
    expect(invalid.filter(c => c === '€').length).toBe(1);
  });

  it('should handle empty string', () => {
    const invalid = findInvalidCharacters('');

    expect(invalid).toHaveLength(0);
  });

  it('should detect lowercase letters as invalid', () => {
    const invalid = findInvalidCharacters('hello');

    expect(invalid.length).toBeGreaterThan(0);
    expect(invalid).toContain('h');
    expect(invalid).toContain('e');
    expect(invalid).toContain('l');
    expect(invalid).toContain('o');
  });

  it('should accept all explicitly supported characters', () => {
    // From VESTABOARD.SUPPORTED_CHARS constant
    const supported = VESTABOARD.SUPPORTED_CHARS;
    const invalid = findInvalidCharacters(supported);

    expect(invalid).toHaveLength(0);
  });
});

describe('color emoji validation', () => {
  describe('SUPPORTED_COLOR_EMOJIS export', () => {
    it('should export SUPPORTED_COLOR_EMOJIS Set', () => {
      expect(SUPPORTED_COLOR_EMOJIS).toBeDefined();
      expect(SUPPORTED_COLOR_EMOJIS).toBeInstanceOf(Set);
    });

    it('should contain all color emojis from COLOR_EMOJI_MAP', () => {
      // Test a sample of known color emojis
      expect(SUPPORTED_COLOR_EMOJIS.has('🟥')).toBe(true);
      expect(SUPPORTED_COLOR_EMOJIS.has('🟦')).toBe(true);
      expect(SUPPORTED_COLOR_EMOJIS.has('🟩')).toBe(true);
      expect(SUPPORTED_COLOR_EMOJIS.has('❤️')).toBe(true);
      expect(SUPPORTED_COLOR_EMOJIS.has('❤')).toBe(true);
      expect(SUPPORTED_COLOR_EMOJIS.has('⬛')).toBe(true);
    });

    it('should not contain non-color emojis', () => {
      expect(SUPPORTED_COLOR_EMOJIS.has('😀')).toBe(false);
      expect(SUPPORTED_COLOR_EMOJIS.has('🎉')).toBe(false);
      expect(SUPPORTED_COLOR_EMOJIS.has('☕')).toBe(false);
    });
  });

  describe('supported color emojis should pass validation', () => {
    it('should accept color square emojis', () => {
      const content: GeneratedContent = {
        text: 'HELLO 🟥🟦🟩 WORLD',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should accept all red emoji variants', () => {
      const content: GeneratedContent = {
        text: '🟥 🔴 ❤️ ❤ 🔺',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should accept all blue emoji variants', () => {
      const content: GeneratedContent = {
        text: '🟦 🔵 💙',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should accept all green emoji variants', () => {
      const content: GeneratedContent = {
        text: '🟩 🟢 💚',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should accept white emoji variants with Unicode selectors', () => {
      const content: GeneratedContent = {
        text: '⬜ ◻️ ◻ ◽ ⚪ 🤍',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should accept black emoji variants', () => {
      const content: GeneratedContent = {
        text: '⬛ ◼️ ◼ ◾ ⚫ 🖤',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should accept mixed standard text and color emojis', () => {
      const content: GeneratedContent = {
        text: 'STATUS: 🟩 OK',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should accept adjacent color emojis', () => {
      const content: GeneratedContent = {
        text: '🟥🟥🟥🟦🟦🟩',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should accept color emojis in layout mode', () => {
      const layout: VestaboardLayout = {
        rows: [
          '🟥 RED ALERT 🟥',
          '🟦 INFO 🟦',
          'B'.repeat(22),
          'C'.repeat(22),
          'D'.repeat(22),
          'E'.repeat(22),
        ],
      };
      const content: GeneratedContent = {
        text: 'Layout content',
        outputMode: 'layout',
        layout: layout,
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });
  });

  describe('non-color emojis are stripped (not rejected)', () => {
    it('should strip smiley face emoji and pass validation', () => {
      const content: GeneratedContent = {
        text: 'HELLO 😀 WORLD',
        outputMode: 'text',
      };

      // Previously threw, now strips the emoji and passes
      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
    });

    it('should strip party popper emoji and pass validation', () => {
      const content: GeneratedContent = {
        text: 'PARTY 🎉 TIME',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
    });

    it('should strip coffee emoji and pass validation', () => {
      const content: GeneratedContent = {
        text: 'COFFEE ☕ BREAK',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
    });

    it('should strip sparkles emoji and pass validation', () => {
      const content: GeneratedContent = {
        text: 'SPARKLE ✨ TEXT',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
    });
  });

  describe('findInvalidCharacters with color emojis', () => {
    it('should not report color emojis as invalid', () => {
      const invalid = findInvalidCharacters('HELLO 🟥🟦🟩 WORLD');

      expect(invalid).toHaveLength(0);
    });

    it('should report non-color emojis as invalid', () => {
      const invalid = findInvalidCharacters('HELLO 😀 WORLD');

      expect(invalid).toContain('😀');
      expect(invalid.length).toBeGreaterThan(0);
    });

    it('should distinguish between color and non-color emojis', () => {
      const invalid = findInvalidCharacters('STATUS 🟩 PARTY 🎉');

      expect(invalid).not.toContain('🟩');
      expect(invalid).toContain('🎉');
    });

    it('should handle emoji variants correctly', () => {
      // Both with and without variant selectors should be valid
      const invalidWithVariant = findInvalidCharacters('❤️ HEART');
      const invalidWithout = findInvalidCharacters('❤ HEART');

      expect(invalidWithVariant).toHaveLength(0);
      expect(invalidWithout).toHaveLength(0);
    });
  });
});

describe('normalizeText', () => {
  describe('curly quote normalization', () => {
    it('should convert left double curly quote to straight quote', () => {
      const result = normalizeText('He said \u201Chello"');
      expect(result).toBe('He said "hello"');
    });

    it('should convert right double curly quote to straight quote', () => {
      const result = normalizeText('He said "hello\u201D');
      expect(result).toBe('He said "hello"');
    });

    it('should convert both curly double quotes in a phrase', () => {
      const result = normalizeText('\u201CHello World\u201D');
      expect(result).toBe('"Hello World"');
    });

    it('should convert low double quote to straight quote', () => {
      const result = normalizeText('\u201EHello\u201D');
      expect(result).toBe('"Hello"');
    });

    it('should convert left single curly quote to apostrophe', () => {
      const result = normalizeText('\u2018twas the night');
      expect(result).toBe("'twas the night");
    });

    it('should convert right single curly quote to apostrophe', () => {
      const result = normalizeText('it\u2019s working');
      expect(result).toBe("it's working");
    });

    it('should convert low single quote to apostrophe', () => {
      const result = normalizeText('\u201Ahello');
      expect(result).toBe("'hello");
    });
  });

  describe('dash normalization', () => {
    it('should convert em-dash to hyphen', () => {
      const result = normalizeText('hello\u2014world');
      expect(result).toBe('hello-world');
    });

    it('should convert en-dash to hyphen', () => {
      const result = normalizeText('pages 1\u201310');
      expect(result).toBe('pages 1-10');
    });
  });

  describe('ellipsis normalization', () => {
    it('should convert ellipsis character to three dots', () => {
      const result = normalizeText('wait\u2026');
      expect(result).toBe('wait...');
    });
  });

  describe('combined normalizations', () => {
    it('should normalize multiple typographic characters in one string', () => {
      const result = normalizeText('\u201CHello\u2026\u201D she said\u2014quietly');
      expect(result).toBe('"Hello..." she said-quietly');
    });

    it('should handle text with no typographic characters', () => {
      const text = 'PLAIN TEXT 123';
      const result = normalizeText(text);
      expect(result).toBe(text);
    });

    it('should handle empty string', () => {
      expect(normalizeText('')).toBe('');
    });
  });

  describe('integration with validation', () => {
    it('should allow text with curly quotes to pass validation after normalization', () => {
      // This would have failed before normalization was added
      const content: GeneratedContent = {
        text: '\u201CHELLO WORLD\u201D',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
    });

    it('should allow text with em-dash to pass validation after normalization', () => {
      const content: GeneratedContent = {
        text: 'HELLO\u2014WORLD',
        outputMode: 'text',
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
    });

    it('should allow layout with curly quotes to pass validation after normalization', () => {
      const layout: VestaboardLayout = {
        rows: [
          '\u201CQUOTED TEXT\u201D',
          'B'.repeat(22),
          'C'.repeat(22),
          'D'.repeat(22),
          'E'.repeat(22),
          'F'.repeat(22),
        ],
      };
      const content: GeneratedContent = {
        text: 'Layout content',
        outputMode: 'layout',
        layout: layout,
      };

      const result = validateGeneratorOutput(content);
      expect(result.valid).toBe(true);
    });
  });
});

describe('stripUnsupportedEmojis', () => {
  describe('basic functionality', () => {
    it('should return unchanged text when no emojis present', () => {
      const result = stripUnsupportedEmojis('HELLO WORLD');

      expect(result.text).toBe('HELLO WORLD');
      expect(result.emojisStripped).toBe(false);
    });

    it('should strip unsupported emoji (🎯) from text', () => {
      const result = stripUnsupportedEmojis('GOAL 🎯 ACHIEVED');

      expect(result.text).toBe('GOAL  ACHIEVED');
      expect(result.emojisStripped).toBe(true);
    });

    it('should preserve color emoji (🔴) in output', () => {
      const result = stripUnsupportedEmojis('STATUS 🔴 ALERT');

      expect(result.text).toBe('STATUS 🔴 ALERT');
      expect(result.emojisStripped).toBe(false);
    });

    it('should preserve color emoji (🟩) in output', () => {
      const result = stripUnsupportedEmojis('STATUS 🟩 OK');

      expect(result.text).toBe('STATUS 🟩 OK');
      expect(result.emojisStripped).toBe(false);
    });

    it('should handle mixed content (text + unsupported + supported emoji)', () => {
      const result = stripUnsupportedEmojis('HELLO 😀 WORLD 🟥 TEST 🎉');

      expect(result.text).toBe('HELLO  WORLD 🟥 TEST ');
      expect(result.emojisStripped).toBe(true);
    });

    it('should strip multiple unsupported emojis in single pass', () => {
      const result = stripUnsupportedEmojis('🎯 TARGETS 🎉 PARTY 😀 SMILE');

      expect(result.text).toBe(' TARGETS  PARTY  SMILE');
      expect(result.emojisStripped).toBe(true);
    });
  });

  describe('variant selector handling', () => {
    it('should handle variant selectors (U+FE0F) for supported color emojis', () => {
      // ❤️ is ❤ + U+FE0F variant selector
      const result = stripUnsupportedEmojis('LOVE ❤️ YOU');

      expect(result.text).toBe('LOVE ❤️ YOU');
      expect(result.emojisStripped).toBe(false);
    });

    it('should handle color emoji without variant selector', () => {
      // ❤ without variant selector
      const result = stripUnsupportedEmojis('LOVE ❤ YOU');

      expect(result.text).toBe('LOVE ❤ YOU');
      expect(result.emojisStripped).toBe(false);
    });

    it('should handle ◻️ (white square with variant selector)', () => {
      const result = stripUnsupportedEmojis('BOX ◻️ END');

      expect(result.text).toBe('BOX ◻️ END');
      expect(result.emojisStripped).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return empty string when all content is stripped emojis', () => {
      const result = stripUnsupportedEmojis('🎯😀🎉');

      expect(result.text).toBe('');
      expect(result.emojisStripped).toBe(true);
    });

    it('should handle empty string input', () => {
      const result = stripUnsupportedEmojis('');

      expect(result.text).toBe('');
      expect(result.emojisStripped).toBe(false);
    });

    it('should preserve non-emoji invalid characters (for other validation to handle)', () => {
      // ™ is not an emoji, so should be preserved (other validation handles it)
      const result = stripUnsupportedEmojis('HELLO™ WORLD');

      expect(result.text).toBe('HELLO™ WORLD');
      expect(result.emojisStripped).toBe(false);
    });

    it('should handle adjacent emojis correctly', () => {
      const result = stripUnsupportedEmojis('🟥🎯🟦😀🟩');

      expect(result.text).toBe('🟥🟦🟩');
      expect(result.emojisStripped).toBe(true);
    });

    it('should preserve all supported color emojis', () => {
      // Test all color emoji variants
      const allColorEmojis = '🟥🔴❤️❤🔺🟦🔵💙🟩🟢💚🟨🟡💛🟧🟠🧡🟪🟣💜⬜◻️◻◽⚪🤍⬛◼️◼◾⚫🖤';
      const result = stripUnsupportedEmojis(allColorEmojis);

      expect(result.text).toBe(allColorEmojis);
      expect(result.emojisStripped).toBe(false);
    });
  });

  describe('production error case', () => {
    it('should strip 🎯 from motivational quote (root cause bug)', () => {
      // This is the exact production case that triggered this feature
      const productionQuote = 'AIM FOR THE STARS 🎯\nNEVER GIVE UP';
      const result = stripUnsupportedEmojis(productionQuote);

      expect(result.text).toBe('AIM FOR THE STARS \nNEVER GIVE UP');
      expect(result.emojisStripped).toBe(true);
    });
  });
});

describe('emoji stripping integration with validation', () => {
  describe('validateTextContent with emoji stripping', () => {
    it('should pass validation after stripping unsupported emoji', () => {
      // Previously this would fail with ContentValidationError
      const result = validateTextContent('GOAL 🎯 ACHIEVED');

      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
    });

    it('should set emojisStripped flag when emojis are stripped', () => {
      const result = validateTextContent('PARTY 🎉 TIME');

      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
    });

    it('should not set emojisStripped flag when no emojis stripped', () => {
      const result = validateTextContent('HELLO WORLD');

      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(false);
    });

    it('should preserve color emojis in validation', () => {
      const result = validateTextContent('STATUS 🟩 OK');

      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(false);
      expect(result.invalidChars).toHaveLength(0);
    });

    it('should strip unsupported but preserve color emojis', () => {
      const result = validateTextContent('GOOD 🎯 BAD 🟥');

      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
      expect(result.invalidChars).toHaveLength(0);
    });
  });

  describe('validateLayoutContent with emoji stripping', () => {
    it('should pass layout validation after stripping unsupported emoji', () => {
      const layout: VestaboardLayout = {
        rows: [
          'TARGET 🎯 HIT',
          'B'.repeat(22),
          'C'.repeat(22),
          'D'.repeat(22),
          'E'.repeat(22),
          'F'.repeat(22),
        ],
      };

      const result = validateLayoutContent(layout);

      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
    });

    it('should preserve color emojis in layout validation', () => {
      const layout: VestaboardLayout = {
        rows: [
          'STATUS 🟩 OK',
          'B'.repeat(22),
          'C'.repeat(22),
          'D'.repeat(22),
          'E'.repeat(22),
          'F'.repeat(22),
        ],
      };

      const result = validateLayoutContent(layout);

      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(false);
    });
  });

  describe('validateGeneratorOutput with emoji stripping', () => {
    it('should pass text mode validation after stripping unsupported emoji', () => {
      const content: GeneratedContent = {
        text: 'TARGET 🎯 HIT',
        outputMode: 'text',
      };

      // Previously this would throw ContentValidationError
      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
    });

    it('should pass layout mode validation after stripping unsupported emoji', () => {
      const content: GeneratedContent = {
        text: 'Layout content',
        outputMode: 'layout',
        layout: {
          rows: [
            'PARTY 🎉 TIME',
            'B'.repeat(22),
            'C'.repeat(22),
            'D'.repeat(22),
            'E'.repeat(22),
            'F'.repeat(22),
          ],
        },
      };

      const result = validateGeneratorOutput(content);

      expect(result.valid).toBe(true);
      expect(result.emojisStripped).toBe(true);
    });
  });
});
