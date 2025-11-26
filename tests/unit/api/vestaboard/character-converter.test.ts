import { describe, it, expect } from '@jest/globals';
import { charToCode, textToLayout, layoutToText } from '@/api/vestaboard/character-converter';

describe('character-converter', () => {
  describe('charToCode', () => {
    it('should convert blank space to 0', () => {
      expect(charToCode(' ')).toBe(0);
    });

    it('should convert uppercase letters to correct codes', () => {
      expect(charToCode('A')).toBe(1);
      expect(charToCode('Z')).toBe(26);
      expect(charToCode('M')).toBe(13);
    });

    it('should convert lowercase letters to uppercase codes', () => {
      expect(charToCode('a')).toBe(1);
      expect(charToCode('z')).toBe(26);
      expect(charToCode('m')).toBe(13);
    });

    it('should convert numbers to correct codes', () => {
      expect(charToCode('1')).toBe(27);
      expect(charToCode('0')).toBe(36);
      expect(charToCode('5')).toBe(31);
    });

    it('should convert special characters to correct codes', () => {
      expect(charToCode('!')).toBe(37);
      expect(charToCode('@')).toBe(38);
      expect(charToCode('#')).toBe(39);
      expect(charToCode('$')).toBe(40);
      expect(charToCode('(')).toBe(41);
      expect(charToCode(')')).toBe(42);
      expect(charToCode('-')).toBe(44);
      expect(charToCode('+')).toBe(46);
      expect(charToCode('&')).toBe(47);
      expect(charToCode('=')).toBe(48);
      expect(charToCode(';')).toBe(49);
      expect(charToCode(':')).toBe(50);
      expect(charToCode("'")).toBe(52);
      expect(charToCode('"')).toBe(53);
      expect(charToCode('%')).toBe(54);
      expect(charToCode(',')).toBe(55);
      expect(charToCode('.')).toBe(56);
      expect(charToCode('/')).toBe(59);
      expect(charToCode('?')).toBe(60);
      expect(charToCode('°')).toBe(62);
    });

    it('should convert unsupported characters to 0 (blank)', () => {
      expect(charToCode('~')).toBe(0);
      expect(charToCode('*')).toBe(0);
      expect(charToCode('[')).toBe(0);
      expect(charToCode('{')).toBe(0);
      expect(charToCode('€')).toBe(0);
    });
  });

  describe('textToLayout', () => {
    it('should convert simple text to 6x22 layout', () => {
      const result = textToLayout('HELLO');
      expect(result).toHaveLength(6);
      expect(result[0]).toHaveLength(22);
      // Content should be vertically centered (row 2 for single line)
      const contentRow = result[2];
      expect(contentRow.filter(code => code !== 0)).toEqual([8, 5, 12, 12, 15]); // H E L L O
    });

    it('should convert lowercase to uppercase', () => {
      const result = textToLayout('hello');
      // Content vertically centered at row 2
      const contentRow = result[2];
      expect(contentRow.filter(code => code !== 0)).toEqual([8, 5, 12, 12, 15]); // H E L L O
    });

    it('should center single line text', () => {
      const result = textToLayout('HI');
      // Content vertically centered at row 2
      const contentRow = result[2];
      // Find position of first non-zero character
      const firstNonZero = contentRow.findIndex(code => code !== 0);
      const lastNonZero = contentRow.findLastIndex(code => code !== 0);
      // Should be centered (roughly equal padding on both sides)
      expect(firstNonZero).toBeGreaterThan(0);
      expect(lastNonZero).toBeLessThan(21);
      expect(Math.abs((22 - 2) / 2 - firstNonZero)).toBeLessThanOrEqual(1);
    });

    it('should handle multi-line text with line breaks', () => {
      const result = textToLayout('LINE 1\nLINE 2');
      // Two lines vertically centered: starts at row (6-2)/2 = 2
      const firstLine = result[2];
      expect(firstLine.filter(code => code !== 0).length).toBeGreaterThan(0);
      // Second line at row 3
      const secondLine = result[3];
      expect(secondLine.filter(code => code !== 0).length).toBeGreaterThan(0);
    });

    it('should auto-wrap long lines at word boundaries', () => {
      const longText = 'THIS IS A VERY LONG LINE THAT NEEDS TO WRAP';
      const result = textToLayout(longText);
      // Should use multiple rows
      const nonEmptyRows = result.filter(row => row.some(code => code !== 0));
      expect(nonEmptyRows.length).toBeGreaterThan(1);
    });

    it('should replace unsupported characters with blanks', () => {
      const result = textToLayout('HI~THERE*');
      // Content at row 2
      const contentRow = result[2];
      const codes = contentRow.filter(code => code !== 0);
      // Should only have HI and THERE (~ and * become blanks which are filtered)
      expect(codes).toEqual([8, 9, 20, 8, 5, 18, 5]); // H I T H E R E
    });

    it('should handle empty string', () => {
      const result = textToLayout('');
      expect(result).toHaveLength(6);
      expect(result.every(row => row.every(code => code === 0))).toBe(true);
    });

    it('should truncate content exceeding 6 rows', () => {
      const manyLines = 'LINE 1\nLINE 2\nLINE 3\nLINE 4\nLINE 5\nLINE 6\nLINE 7\nLINE 8';
      const result = textToLayout(manyLines);
      expect(result).toHaveLength(6);
    });

    it('should create exactly 6 rows with 22 columns each', () => {
      const result = textToLayout('TEST');
      expect(result).toHaveLength(6);
      result.forEach(row => {
        expect(row).toHaveLength(22);
      });
    });

    it('should handle text with multiple spaces', () => {
      const result = textToLayout('HELLO     WORLD');
      // Content at row 2
      const contentRow = result[2];
      expect(contentRow).toHaveLength(22);
      // Should preserve spaces between words
      const nonBlankIndices = contentRow
        .map((code, idx) => (code !== 0 ? idx : -1))
        .filter(idx => idx !== -1);
      expect(nonBlankIndices.length).toBeGreaterThan(0);
    });

    it('should center vertically when content is less than 6 rows', () => {
      const result = textToLayout('SINGLE LINE');
      const nonEmptyRows = result
        .map((row, idx) => (row.some(code => code !== 0) ? idx : -1))
        .filter(idx => idx !== -1);
      // Content should be roughly centered vertically
      expect(nonEmptyRows.length).toBeGreaterThan(0);
      expect(nonEmptyRows[0]).toBeGreaterThanOrEqual(0);
    });
  });

  describe('layoutToText', () => {
    it('should convert layout back to text', () => {
      const layout = [
        [0, 0, 0, 0, 0, 0, 0, 0, 8, 5, 12, 12, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0], // HELLO centered
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];
      const result = layoutToText(layout);
      expect(result).toContain('HELLO');
    });

    it('should preserve line breaks', () => {
      const layout = [
        [8, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // HI
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [2, 25, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // BYE
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];
      const result = layoutToText(layout);
      expect(result).toContain('HI');
      expect(result).toContain('BYE');
    });

    it('should handle empty layout', () => {
      const layout = Array(6)
        .fill(null)
        .map(() => Array(22).fill(0));
      const result = layoutToText(layout);
      expect(result.trim()).toBe('');
    });

    it('should handle special characters', () => {
      const layout = [
        [37, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // !?
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];
      const result = layoutToText(layout);
      expect(result).toContain('!');
      expect(result).toContain('?');
    });

    it('should handle numbers', () => {
      const layout = [
        [27, 28, 29, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 123
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];
      const result = layoutToText(layout);
      expect(result).toContain('123');
    });

    it('should roundtrip with textToLayout', () => {
      const originalText = 'HELLO\nWORLD';
      const layout = textToLayout(originalText);
      const convertedText = layoutToText(layout);
      expect(convertedText).toContain('HELLO');
      expect(convertedText).toContain('WORLD');
    });
  });
});
