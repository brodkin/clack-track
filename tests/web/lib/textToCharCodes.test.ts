/**
 * textToCharCodes Utility Tests
 *
 * Tests for converting text strings to Vestaboard character code grids
 */

import { describe, it, expect } from '@jest/globals';
import { textToCharacterCodes, emptyGrid } from '@/web/frontend/lib/textToCharCodes';

describe('textToCharCodes Utility', () => {
  describe('textToCharacterCodes', () => {
    it('should convert single character to code', () => {
      const result = textToCharacterCodes('A');
      expect(result[0][0]).toBe(1); // A = 1
    });

    it('should convert uppercase letters correctly', () => {
      const result = textToCharacterCodes('ABCZ');
      expect(result[0][0]).toBe(1); // A
      expect(result[0][1]).toBe(2); // B
      expect(result[0][2]).toBe(3); // C
      expect(result[0][3]).toBe(26); // Z
    });

    it('should convert lowercase to uppercase codes', () => {
      const result = textToCharacterCodes('abc');
      expect(result[0][0]).toBe(1); // a -> A
      expect(result[0][1]).toBe(2); // b -> B
      expect(result[0][2]).toBe(3); // c -> C
    });

    it('should convert numbers correctly', () => {
      const result = textToCharacterCodes('0123456789');
      expect(result[0][0]).toBe(36); // 0
      expect(result[0][1]).toBe(27); // 1
      expect(result[0][2]).toBe(28); // 2
      expect(result[0][9]).toBe(35); // 9
    });

    it('should convert common symbols', () => {
      const result = textToCharacterCodes('!@#$');
      expect(result[0][0]).toBe(37); // !
      expect(result[0][1]).toBe(38); // @
      expect(result[0][2]).toBe(39); // #
      expect(result[0][3]).toBe(40); // $
    });

    it('should convert punctuation', () => {
      const result = textToCharacterCodes('.,:;');
      expect(result[0][0]).toBe(56); // .
      expect(result[0][1]).toBe(55); // ,
      expect(result[0][2]).toBe(50); // :
      expect(result[0][3]).toBe(49); // ;
    });

    it('should convert spaces to 0', () => {
      const result = textToCharacterCodes('A B');
      expect(result[0][0]).toBe(1); // A
      expect(result[0][1]).toBe(0); // space
      expect(result[0][2]).toBe(2); // B
    });

    it('should return 0 for unsupported characters', () => {
      const result = textToCharacterCodes('~'); // Unsupported
      expect(result[0][0]).toBe(0);
    });

    it('should return a 6x22 grid', () => {
      const result = textToCharacterCodes('Test');
      expect(result.length).toBe(6);
      result.forEach(row => {
        expect(row.length).toBe(22);
      });
    });

    it('should handle multiline text', () => {
      const result = textToCharacterCodes('LINE1\nLINE2');
      // First row starts with L (12), I (9), N (14), E (5), 1 (27)
      expect(result[0][0]).toBe(12); // L
      expect(result[0][1]).toBe(9); // I
      expect(result[0][2]).toBe(14); // N
      expect(result[0][3]).toBe(5); // E
      expect(result[0][4]).toBe(27); // 1

      // Second row starts with L (12), I (9), N (14), E (5), 2 (28)
      expect(result[1][0]).toBe(12); // L
      expect(result[1][4]).toBe(28); // 2
    });

    it('should pad short lines with zeros', () => {
      const result = textToCharacterCodes('HI');
      expect(result[0][0]).toBe(8); // H
      expect(result[0][1]).toBe(9); // I
      expect(result[0][2]).toBe(0); // padding
      expect(result[0][21]).toBe(0); // last column is padding
    });

    it('should truncate lines longer than 22 characters', () => {
      const longLine = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 26 chars
      const result = textToCharacterCodes(longLine);
      expect(result[0].length).toBe(22);
      expect(result[0][21]).toBe(22); // V is the 22nd character
    });

    it('should only use first 6 lines', () => {
      const text = 'LINE1\nLINE2\nLINE3\nLINE4\nLINE5\nLINE6\nLINE7';
      const result = textToCharacterCodes(text);
      expect(result.length).toBe(6);
      // Row 5 (0-indexed) should be LINE6
      expect(result[5][4]).toBe(32); // 6
    });

    it('should convert special Vestaboard characters', () => {
      const result = textToCharacterCodes('°');
      expect(result[0][0]).toBe(62); // degree symbol
    });

    it('should handle empty string', () => {
      const result = textToCharacterCodes('');
      expect(result.length).toBe(6);
      expect(result[0].every(code => code === 0)).toBe(true);
    });
  });

  describe('emptyGrid', () => {
    it('should return a 6x22 grid', () => {
      const result = emptyGrid();
      expect(result.length).toBe(6);
      result.forEach(row => {
        expect(row.length).toBe(22);
      });
    });

    it('should fill all cells with 0', () => {
      const result = emptyGrid();
      result.forEach(row => {
        row.forEach(cell => {
          expect(cell).toBe(0);
        });
      });
    });

    it('should return a new array each time', () => {
      const result1 = emptyGrid();
      const result2 = emptyGrid();
      expect(result1).not.toBe(result2);
    });
  });
});
