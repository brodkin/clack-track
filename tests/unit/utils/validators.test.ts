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

    it('should reject text with line exceeding 21 characters', () => {
      const longLine = 'A'.repeat(22);
      const content: GeneratedContent = {
        text: `SHORT\n${longLine}`,
        outputMode: 'text',
      };

      expect(() => validateGeneratorOutput(content)).toThrow(
        /text mode line \d+ exceeds 21 characters/
      );
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

  it('should return detailed error for line too long', () => {
    const longLine = 'A'.repeat(22);
    const result = validateTextContent(longLine);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/line \d+ exceeds 21 characters/);
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
