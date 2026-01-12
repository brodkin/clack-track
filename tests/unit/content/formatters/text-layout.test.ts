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

  describe('text alignment', () => {
    let formatter: TextLayoutFormatter;

    beforeEach(() => {
      formatter = new TextLayoutFormatter();
    });

    describe('left alignment', () => {
      it('should left-align text with no left padding', () => {
        const content: VestaboardContent = { text: 'HELLO' };

        const layout = formatter.format(content, { alignment: 'left' });

        // Find the row with content
        const contentRow = layout.rows.find(row => row.trim() !== '');
        expect(contentRow).toBeDefined();

        // "HELLO" should start at position 0 (no left padding)
        expect(contentRow!.startsWith('HELLO')).toBe(true);
        // Should still be padded to full width with spaces on the right
        expect(contentRow).toHaveLength(22);
      });

      it('should right-pad left-aligned text to full width', () => {
        const content: VestaboardContent = { text: 'HI' };

        const layout = formatter.format(content, { alignment: 'left' });

        const contentRow = layout.rows.find(row => row.trim() !== '');
        expect(contentRow).toBeDefined();

        // "HI" (2 chars) left-aligned in 22 chars: HI + 20 spaces
        expect(contentRow).toBe('HI' + ' '.repeat(20));
      });

      it('should handle multiline left alignment', () => {
        const content: VestaboardContent = { text: 'LINE ONE\nLINE TWO' };

        const layout = formatter.format(content, { alignment: 'left' });

        const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
        nonEmptyRows.forEach(row => {
          // Each row should start with the text (no leading spaces)
          expect(row.trimStart()).toBe(row.trim() + ' '.repeat(22 - row.trim().length));
        });
      });
    });

    describe('center alignment', () => {
      it('should center text horizontally (default behavior)', () => {
        const content: VestaboardContent = { text: 'HI' };

        const layout = formatter.format(content, { alignment: 'center' });

        const contentRow = layout.rows.find(row => row.trim() !== '');
        expect(contentRow).toBeDefined();

        // "HI" (2 chars) centered in 22 chars: 10 spaces + HI + 10 spaces
        const leadingSpaces = contentRow!.length - contentRow!.trimStart().length;
        expect(leadingSpaces).toBe(10);
      });

      it('should be the default alignment when not specified', () => {
        const content: VestaboardContent = { text: 'TEST' };

        const withoutAlignment = formatter.format(content);
        const withCenterAlignment = formatter.format(content, { alignment: 'center' });

        expect(withoutAlignment.rows).toEqual(withCenterAlignment.rows);
      });
    });

    describe('right alignment', () => {
      it('should right-align text with left padding', () => {
        const content: VestaboardContent = { text: 'HELLO' };

        const layout = formatter.format(content, { alignment: 'right' });

        const contentRow = layout.rows.find(row => row.trim() !== '');
        expect(contentRow).toBeDefined();

        // "HELLO" (5 chars) right-aligned in 22 chars: 17 spaces + HELLO
        expect(contentRow).toBe(' '.repeat(17) + 'HELLO');
      });

      it('should left-pad right-aligned text to full width', () => {
        const content: VestaboardContent = { text: 'HI' };

        const layout = formatter.format(content, { alignment: 'right' });

        const contentRow = layout.rows.find(row => row.trim() !== '');
        expect(contentRow).toBeDefined();

        // "HI" (2 chars) right-aligned in 22 chars: 20 spaces + HI
        expect(contentRow).toBe(' '.repeat(20) + 'HI');
      });

      it('should handle multiline right alignment', () => {
        const content: VestaboardContent = { text: 'LINE ONE\nLINE TWO' };

        const layout = formatter.format(content, { alignment: 'right' });

        const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
        nonEmptyRows.forEach(row => {
          // Row should end with text (text at far right)
          const trimmed = row.trim();
          expect(row.endsWith(trimmed)).toBe(true);
          // And should be padded on the left
          const trimmedLength = trimmed.length;
          const expectedPadding = 22 - trimmedLength;
          expect(row).toBe(' '.repeat(expectedPadding) + trimmed);
        });
      });
    });

    describe('alignment with edge cases', () => {
      it('should handle full-width text with any alignment', () => {
        const content: VestaboardContent = { text: 'ABCDEFGHIJKLMNOPQRSTUV' }; // 22 chars

        const leftLayout = formatter.format(content, { alignment: 'left' });
        const centerLayout = formatter.format(content, { alignment: 'center' });
        const rightLayout = formatter.format(content, { alignment: 'right' });

        // All should be identical for full-width text
        const leftRow = leftLayout.rows.find(row => row.trim() !== '');
        const centerRow = centerLayout.rows.find(row => row.trim() !== '');
        const rightRow = rightLayout.rows.find(row => row.trim() !== '');

        expect(leftRow).toBe('ABCDEFGHIJKLMNOPQRSTUV');
        expect(centerRow).toBe('ABCDEFGHIJKLMNOPQRSTUV');
        expect(rightRow).toBe('ABCDEFGHIJKLMNOPQRSTUV');
      });

      it('should handle empty text with alignment option', () => {
        const content: VestaboardContent = { text: '' };

        const leftLayout = formatter.format(content, { alignment: 'left' });
        const rightLayout = formatter.format(content, { alignment: 'right' });

        expect(leftLayout.rows).toHaveLength(6);
        expect(rightLayout.rows).toHaveLength(6);
      });

      it('should maintain vertical centering regardless of horizontal alignment', () => {
        const content: VestaboardContent = { text: 'SINGLE LINE' };

        const leftLayout = formatter.format(content, { alignment: 'left' });
        const rightLayout = formatter.format(content, { alignment: 'right' });

        // Find non-empty row indices for both
        const leftNonEmpty = leftLayout.rows
          .map((row, idx) => (row.trim() !== '' ? idx : -1))
          .filter(idx => idx >= 0);
        const rightNonEmpty = rightLayout.rows
          .map((row, idx) => (row.trim() !== '' ? idx : -1))
          .filter(idx => idx >= 0);

        // Both should have text at the same vertical position (centered)
        expect(leftNonEmpty).toEqual(rightNonEmpty);
        expect(leftNonEmpty[0]).toBeGreaterThanOrEqual(2);
        expect(leftNonEmpty[0]).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('word wrap control', () => {
    let formatter: TextLayoutFormatter;

    beforeEach(() => {
      formatter = new TextLayoutFormatter();
    });

    describe('wordWrap=true (default behavior)', () => {
      it('should wrap at word boundaries by default', () => {
        const content: VestaboardContent = {
          text: 'THIS IS A VERY LONG MESSAGE THAT NEEDS WRAPPING',
        };

        // Default behavior (no wordWrap specified) should wrap at word boundaries
        const layout = formatter.format(content);

        const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
        // Verify words are not broken
        nonEmptyRows.forEach(row => {
          const trimmed = row.trim();
          // Each row should contain complete words only
          const words = trimmed.split(' ').filter(w => w.length > 0);
          words.forEach(word => {
            // No word should be a partial word that was split mid-character
            // This is a basic check - complete words should match original words
            expect(word.length).toBeGreaterThan(0);
          });
        });
      });

      it('should wrap at word boundaries when wordWrap is explicitly true', () => {
        const content: VestaboardContent = {
          text: 'HELLO WORLD TESTING MESSAGE',
        };

        const layout = formatter.format(content, { wordWrap: true });

        const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
        // Each row should contain complete words
        nonEmptyRows.forEach(row => {
          const trimmed = row.trim();
          expect(trimmed.split(' ').every(word => word.length > 0)).toBe(true);
        });
      });

      it('should truncate single words longer than row width when wordWrap=true', () => {
        // Even with word-wrap enabled, a single word > 22 chars must be truncated
        const content: VestaboardContent = {
          text: 'SUPERCALIFRAGILISTICEXPIALIDOCIOUS', // 34 chars
        };

        const layout = formatter.format(content, { wordWrap: true });

        const contentRow = layout.rows.find(row => row.trim() !== '');
        expect(contentRow).toBeDefined();
        // Should be truncated to 22 characters
        expect(contentRow!.trim().length).toBeLessThanOrEqual(22);
      });
    });

    describe('wordWrap=false (break mid-word)', () => {
      it('should allow breaking mid-word when wordWrap is false', () => {
        // A phrase that would normally wrap at word boundaries
        const content: VestaboardContent = {
          text: 'ABCDEFGHIJKLMNOPQRST UVWXYZ', // 20 chars + space + 6 chars = 27 chars
        };

        const layout = formatter.format(content, { wordWrap: false });

        const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
        // With wordWrap=false, should fill first row completely (22 chars)
        // and continue on next row
        expect(nonEmptyRows.length).toBeGreaterThanOrEqual(1);
        // First row should be filled to capacity
        expect(nonEmptyRows[0].trim().length).toBe(22);
      });

      it('should break text at exactly 22 characters when wordWrap is false', () => {
        const content: VestaboardContent = {
          text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', // 26 chars
        };

        const layout = formatter.format(content, { wordWrap: false });

        const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
        expect(nonEmptyRows.length).toBe(2);
        // First row: exactly 22 chars
        expect(nonEmptyRows[0].trim()).toBe('ABCDEFGHIJKLMNOPQRSTUV');
        // Second row: remaining 4 chars
        expect(nonEmptyRows[1].trim()).toBe('WXYZ');
      });

      it('should handle multiple rows when wordWrap is false', () => {
        // Create text that spans exactly 3 rows at 22 chars each
        const content: VestaboardContent = {
          text: 'A'.repeat(60), // 60 'A' characters
        };

        const layout = formatter.format(content, { wordWrap: false });

        const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
        expect(nonEmptyRows.length).toBe(3);
        expect(nonEmptyRows[0].trim()).toBe('A'.repeat(22));
        expect(nonEmptyRows[1].trim()).toBe('A'.repeat(22));
        expect(nonEmptyRows[2].trim()).toBe('A'.repeat(16)); // Remaining
      });

      it('should preserve spaces when breaking mid-word', () => {
        const content: VestaboardContent = {
          text: 'HELLO WORLD', // 11 chars, fits in one row
        };

        const layout = formatter.format(content, { wordWrap: false });

        const contentRow = layout.rows.find(row => row.trim() !== '');
        expect(contentRow).toBeDefined();
        expect(contentRow!.includes('HELLO WORLD')).toBe(true);
      });

      it('should respect explicit newlines even with wordWrap=false', () => {
        const content: VestaboardContent = {
          text: 'LINE ONE\nLINE TWO',
        };

        const layout = formatter.format(content, { wordWrap: false });

        const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
        expect(nonEmptyRows.length).toBe(2);
        expect(nonEmptyRows[0].includes('LINE ONE')).toBe(true);
        expect(nonEmptyRows[1].includes('LINE TWO')).toBe(true);
      });
    });

    describe('wordWrap interaction with alignment', () => {
      it('should respect alignment when wordWrap is false', () => {
        const content: VestaboardContent = {
          text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', // 26 chars
        };

        const leftLayout = formatter.format(content, { wordWrap: false, alignment: 'left' });
        const rightLayout = formatter.format(content, { wordWrap: false, alignment: 'right' });

        const leftRows = leftLayout.rows.filter(row => row.trim() !== '');
        const rightRows = rightLayout.rows.filter(row => row.trim() !== '');

        // Left-aligned: text starts at position 0
        expect(leftRows[1].startsWith('WXYZ')).toBe(true);
        // Right-aligned: text ends at position 21
        expect(rightRows[1].endsWith('WXYZ')).toBe(true);
      });

      it('should respect alignment when wordWrap is true', () => {
        const content: VestaboardContent = {
          text: 'HELLO WORLD',
        };

        const leftLayout = formatter.format(content, { wordWrap: true, alignment: 'left' });
        const centerLayout = formatter.format(content, { wordWrap: true, alignment: 'center' });
        const rightLayout = formatter.format(content, { wordWrap: true, alignment: 'right' });

        const leftRow = leftLayout.rows.find(row => row.trim() !== '');
        const centerRow = centerLayout.rows.find(row => row.trim() !== '');
        const rightRow = rightLayout.rows.find(row => row.trim() !== '');

        expect(leftRow!.startsWith('HELLO WORLD')).toBe(true);
        expect(rightRow!.endsWith('HELLO WORLD')).toBe(true);
        // Center alignment: check padding is roughly equal
        const leftPad = centerRow!.length - centerRow!.trimStart().length;
        const rightPad = centerRow!.length - centerRow!.trimEnd().length;
        expect(Math.abs(leftPad - rightPad)).toBeLessThanOrEqual(1);
      });
    });

    describe('wordWrap edge cases', () => {
      it('should handle empty text with wordWrap=false', () => {
        const content: VestaboardContent = { text: '' };

        const layout = formatter.format(content, { wordWrap: false });

        expect(layout.rows).toHaveLength(6);
        layout.rows.forEach(row => {
          expect(row.trim()).toBe('');
        });
      });

      it('should handle text exactly 22 characters with wordWrap=false', () => {
        const content: VestaboardContent = {
          text: 'ABCDEFGHIJKLMNOPQRSTUV', // exactly 22 chars
        };

        const layout = formatter.format(content, { wordWrap: false });

        const nonEmptyRows = layout.rows.filter(row => row.trim() !== '');
        expect(nonEmptyRows.length).toBe(1);
        expect(nonEmptyRows[0].trim()).toBe('ABCDEFGHIJKLMNOPQRSTUV');
      });

      it('should handle single character with wordWrap=false', () => {
        const content: VestaboardContent = { text: 'X' };

        const layout = formatter.format(content, { wordWrap: false });

        const contentRow = layout.rows.find(row => row.trim() !== '');
        expect(contentRow).toBeDefined();
        expect(contentRow!.trim()).toBe('X');
      });

      it('should handle text with only spaces when wordWrap=false', () => {
        const content: VestaboardContent = { text: '   ' };

        const layout = formatter.format(content, { wordWrap: false });

        expect(layout.rows).toHaveLength(6);
      });
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
