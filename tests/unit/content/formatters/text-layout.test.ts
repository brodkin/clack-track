import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TextLayoutFormatter } from '@/content/formatters/text-layout';
import { textToLayout as realTextToLayout } from '@/api/vestaboard/character-converter';
import type { VestaboardContent } from '@/types/content';
import type { CharacterConverter } from '@/api/vestaboard/types';

describe('TextLayoutFormatter', () => {
  describe('constructor', () => {
    it('should create formatter with default converter', () => {
      const formatter = new TextLayoutFormatter();
      expect(formatter).toBeInstanceOf(TextLayoutFormatter);
    });

    it('should accept custom converter via constructor', () => {
      const mockConverter: CharacterConverter = {
        textToLayout: jest.fn().mockReturnValue(
          Array(6)
            .fill(null)
            .map(() => Array(22).fill(0))
        ),
      };

      const formatter = new TextLayoutFormatter(mockConverter);
      formatter.format({ text: 'TEST' });

      expect(mockConverter.textToLayout).toHaveBeenCalled();
    });
  });

  describe('format', () => {
    let formatter: TextLayoutFormatter;

    beforeEach(() => {
      formatter = new TextLayoutFormatter();
    });

    it('should return VestaboardLayout with rows and characterCodes', () => {
      const content: VestaboardContent = { text: 'HELLO' };

      const layout = formatter.format(content);

      expect(layout).toHaveProperty('rows');
      expect(layout).toHaveProperty('characterCodes');
      expect(Array.isArray(layout.rows)).toBe(true);
      expect(Array.isArray(layout.characterCodes)).toBe(true);
    });

    it('should return 6 rows', () => {
      const content: VestaboardContent = { text: 'TEST' };

      const layout = formatter.format(content);

      expect(layout.rows).toHaveLength(6);
    });

    it('should return rows of 22 characters each', () => {
      const content: VestaboardContent = { text: 'TEST' };

      const layout = formatter.format(content);

      layout.rows.forEach(row => {
        expect(row).toHaveLength(22);
      });
    });

    it('should return 6x22 character code array', () => {
      const content: VestaboardContent = { text: 'TEST' };

      const layout = formatter.format(content);

      expect(layout.characterCodes).toHaveLength(6);
      layout.characterCodes!.forEach(row => {
        expect(row).toHaveLength(22);
      });
    });

    it('should convert text to uppercase', () => {
      const content: VestaboardContent = { text: 'hello world' };

      const layout = formatter.format(content);

      // All rows should contain only uppercase letters and spaces
      layout.rows.forEach(row => {
        expect(row).toBe(row.toUpperCase());
      });
    });

    it('should handle empty text', () => {
      const content: VestaboardContent = { text: '' };

      const layout = formatter.format(content);

      expect(layout.rows).toHaveLength(6);
      layout.rows.forEach(row => {
        expect(row.trim()).toBe('');
      });
    });

    it('should handle content with null text', () => {
      const content = {} as VestaboardContent;

      const layout = formatter.format(content);

      expect(layout.rows).toHaveLength(6);
    });
  });

  describe('text centering', () => {
    let formatter: TextLayoutFormatter;

    beforeEach(() => {
      formatter = new TextLayoutFormatter();
    });

    it('should center short text horizontally', () => {
      const content: VestaboardContent = { text: 'HI' };

      const layout = formatter.format(content);

      // Find the row with content
      const contentRow = layout.rows.find(row => row.trim() !== '');
      expect(contentRow).toBeDefined();

      // "HI" (2 chars) centered in 22 chars: 10 spaces + HI + 10 spaces
      const leadingSpaces = contentRow!.length - contentRow!.trimStart().length;
      expect(leadingSpaces).toBe(10);
    });

    it('should center single line text vertically', () => {
      const content: VestaboardContent = { text: 'SINGLE LINE' };

      const layout = formatter.format(content);

      // 1 line in 6 rows: should be at row 2 or 3 (0-indexed)
      const nonEmptyRowIndices = layout.rows
        .map((row, idx) => (row.trim() !== '' ? idx : -1))
        .filter(idx => idx >= 0);

      expect(nonEmptyRowIndices.length).toBe(1);
      expect(nonEmptyRowIndices[0]).toBeGreaterThanOrEqual(2);
      expect(nonEmptyRowIndices[0]).toBeLessThanOrEqual(3);
    });

    it('should center multiple lines vertically', () => {
      const content: VestaboardContent = { text: 'LINE ONE\nLINE TWO' };

      const layout = formatter.format(content);

      const nonEmptyRowIndices = layout.rows
        .map((row, idx) => (row.trim() !== '' ? idx : -1))
        .filter(idx => idx >= 0);

      // 2 lines in 6 rows: should start at row 2 (with padding of 2)
      expect(nonEmptyRowIndices.length).toBe(2);
      expect(nonEmptyRowIndices[0]).toBe(2);
    });
  });

  describe('text wrapping', () => {
    let formatter: TextLayoutFormatter;

    beforeEach(() => {
      formatter = new TextLayoutFormatter();
    });

    it('should wrap long text at word boundaries', () => {
      const content: VestaboardContent = {
        text: 'THIS IS A VERY LONG MESSAGE THAT NEEDS WRAPPING',
      };

      const layout = formatter.format(content);

      const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
      expect(nonEmptyRows.length).toBeGreaterThan(1);
    });

    it('should not break words in the middle', () => {
      const content: VestaboardContent = { text: 'HELLO WORLD TESTING' };

      const layout = formatter.format(content);

      // Check that no row ends with a partial word followed by continuation
      const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
      nonEmptyRows.forEach(row => {
        const trimmed = row.trim();
        // Each row should contain complete words only
        expect(trimmed.split(' ').every(word => word.length > 0)).toBe(true);
      });
    });

    it('should truncate words longer than row width', () => {
      const content: VestaboardContent = { text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ12345' };

      const layout = formatter.format(content);

      layout.rows.forEach(row => {
        expect(row.length).toBe(22);
      });
    });

    it('should handle explicit newlines', () => {
      const content: VestaboardContent = { text: 'LINE ONE\nLINE TWO\nLINE THREE' };

      const layout = formatter.format(content);

      const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
      expect(nonEmptyRows.length).toBe(3);
    });

    it('should limit to 6 rows maximum', () => {
      const content: VestaboardContent = {
        text: 'ROW1\nROW2\nROW3\nROW4\nROW5\nROW6\nROW7\nROW8',
      };

      const layout = formatter.format(content);

      expect(layout.rows).toHaveLength(6);
    });
  });

  describe('character code generation', () => {
    let formatter: TextLayoutFormatter;
    let mockConverter: jest.Mocked<CharacterConverter>;

    beforeEach(() => {
      mockConverter = {
        textToLayout: jest.fn().mockReturnValue(
          Array(6)
            .fill(null)
            .map(() => Array(22).fill(0))
        ),
      };
      formatter = new TextLayoutFormatter(mockConverter);
    });

    it('should call converter with formatted text', () => {
      const content: VestaboardContent = { text: 'HELLO' };

      formatter.format(content);

      expect(mockConverter.textToLayout).toHaveBeenCalled();
      const calledWith = mockConverter.textToLayout.mock.calls[0][0];
      expect(calledWith).toContain('HELLO');
    });

    it('should pass all 6 rows to converter', () => {
      const content: VestaboardContent = { text: 'TEST' };

      formatter.format(content);

      const calledWith = mockConverter.textToLayout.mock.calls[0][0];
      const lines = calledWith.split('\n');
      expect(lines).toHaveLength(6);
    });

    it('should return character codes from converter', () => {
      const expectedCodes = Array(6)
        .fill(null)
        .map((_, i) =>
          Array(22)
            .fill(null)
            .map((_, j) => i * 22 + j)
        );
      mockConverter.textToLayout.mockReturnValue(expectedCodes);

      const content: VestaboardContent = { text: 'TEST' };
      const layout = formatter.format(content);

      expect(layout.characterCodes).toEqual(expectedCodes);
    });
  });

  describe('integration with real converter', () => {
    let formatter: TextLayoutFormatter;

    beforeEach(() => {
      // Use real converter for integration verification
      formatter = new TextLayoutFormatter({ textToLayout: realTextToLayout });
    });

    it('should produce matching rows and character codes', () => {
      const content: VestaboardContent = { text: 'HELLO' };

      const layout = formatter.format(content);

      // Verify that character codes match the text rows
      expect(layout.characterCodes).toBeDefined();
      expect(layout.characterCodes).toHaveLength(6);
    });

    it('should convert "TEST" to correct codes', () => {
      const content: VestaboardContent = { text: 'TEST' };

      const layout = formatter.format(content);

      // T=20, E=5, S=19, T=20
      const expectedCodes = [20, 5, 19, 20];

      // Find the row with content
      const contentRowIdx = layout.rows.findIndex(row => row.includes('TEST'));
      expect(contentRowIdx).toBeGreaterThanOrEqual(0);

      // Extract the codes for "TEST" from character codes
      const codeRow = layout.characterCodes![contentRowIdx];
      const startIdx = codeRow.findIndex(code => code !== 0);

      const actualCodes = codeRow.slice(startIdx, startIdx + 4);
      expect(actualCodes).toEqual(expectedCodes);
    });

    it('should handle special characters correctly', () => {
      const content: VestaboardContent = { text: 'HELLO! HOW ARE YOU?' };

      const layout = formatter.format(content);

      // ! = 37, ? = 60
      expect(layout.characterCodes).toBeDefined();

      // Flatten and check for special character codes
      const flatCodes = layout.characterCodes!.flat();
      expect(flatCodes).toContain(37); // !
      expect(flatCodes).toContain(60); // ?
    });
  });
});
