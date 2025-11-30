/**
 * Vestaboard Client Integration Tests
 *
 * Tests the full text → character codes → HTTP flow with:
 * - Real character converter (production implementation)
 * - Mock HTTP client (no network calls)
 *
 * This validates that:
 * 1. Text is correctly converted to Vestaboard character codes
 * 2. Character codes are correctly sent to the HTTP client
 * 3. Error handling flows through properly
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { VestaboardClientImpl } from '@/api/vestaboard/client';
import { textToLayout, charToCode } from '@/api/vestaboard/character-converter';
import type { VestaboardHTTPClient } from '@/api/vestaboard/http-client';
import type { CharacterConverter } from '@/api/vestaboard/types';

describe('Vestaboard Client Integration (Real Converter + Mock HTTP)', () => {
  let mockHttpClient: jest.Mocked<VestaboardHTTPClient>;
  let realConverter: CharacterConverter;
  let client: VestaboardClientImpl;

  beforeEach(() => {
    // Mock HTTP client - no real network calls
    mockHttpClient = {
      post: jest.fn().mockResolvedValue(undefined),
      postWithAnimation: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
    } as jest.Mocked<VestaboardHTTPClient>;

    // Real converter - production implementation
    realConverter = {
      textToLayout,
    };

    // Client with real converter and mock HTTP
    client = new VestaboardClientImpl(mockHttpClient, realConverter);
  });

  describe('sendText with real converter', () => {
    it('should convert "HELLO WORLD" to correct character codes', async () => {
      await client.sendText('HELLO WORLD');

      expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // Verify 6x22 structure
      expect(sentLayout).toHaveLength(6);
      sentLayout.forEach(row => expect(row).toHaveLength(22));

      // "HELLO WORLD" should be centered
      // H=8, E=5, L=12, L=12, O=15, space=0, W=23, O=15, R=18, L=12, D=4
      const expectedChars = [8, 5, 12, 12, 15, 0, 23, 15, 18, 12, 4];

      // Find the row with content (should be in middle due to vertical centering)
      const contentRow = sentLayout.find(row => row.some(code => code !== 0));
      expect(contentRow).toBeDefined();

      // Extract non-zero content and verify character codes
      const contentStart = contentRow!.findIndex(code => code !== 0);
      const actualChars = contentRow!.slice(contentStart, contentStart + expectedChars.length);
      expect(actualChars).toEqual(expectedChars);
    });

    it('should handle lowercase text (auto-uppercase)', async () => {
      await client.sendText('hello');

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // Find content row
      const contentRow = sentLayout.find(row => row.some(code => code !== 0));
      expect(contentRow).toBeDefined();

      // Verify H, E, L, L, O codes (same as uppercase)
      const expectedChars = [8, 5, 12, 12, 15];
      const contentStart = contentRow!.findIndex(code => code !== 0);
      const actualChars = contentRow!.slice(contentStart, contentStart + expectedChars.length);
      expect(actualChars).toEqual(expectedChars);
    });

    it('should handle multi-line text with newlines', async () => {
      await client.sendText('LINE ONE\nLINE TWO');

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // Find rows with content
      const contentRows = sentLayout.filter(row => row.some(code => code !== 0));

      // Should have exactly 2 content rows
      expect(contentRows.length).toBe(2);
    });

    it('should center text horizontally', async () => {
      await client.sendText('HI');

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // Find the content row
      const contentRow = sentLayout.find(row => row.some(code => code !== 0));
      expect(contentRow).toBeDefined();

      // "HI" is 2 chars, should be padded to center in 22-char row
      // Padding: (22-2)/2 = 10 spaces on left
      const firstNonZeroIndex = contentRow!.findIndex(code => code !== 0);
      expect(firstNonZeroIndex).toBe(10);
    });

    it('should center text vertically', async () => {
      await client.sendText('SINGLE LINE');

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // 1 line of content, 6 rows total
      // Vertical padding: (6-1)/2 = 2 (row index 2 or 3)
      const contentRowIndex = sentLayout.findIndex(row => row.some(code => code !== 0));
      expect(contentRowIndex).toBeGreaterThanOrEqual(2);
      expect(contentRowIndex).toBeLessThanOrEqual(3);
    });

    it('should handle empty text', async () => {
      await client.sendText('');

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // All codes should be 0 (blank)
      sentLayout.forEach(row => {
        row.forEach(code => expect(code).toBe(0));
      });
    });

    it('should handle special characters', async () => {
      await client.sendText('TEST! 123?');

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // Find content row
      const contentRow = sentLayout.find(row => row.some(code => code !== 0));
      expect(contentRow).toBeDefined();

      // Verify character codes present
      // ! = 37, ? = 60, 1 = 27, 2 = 28, 3 = 29
      expect(contentRow!.some(code => code === charToCode('!'))).toBe(true);
      expect(contentRow!.some(code => code === charToCode('?'))).toBe(true);
      expect(contentRow!.some(code => code === charToCode('1'))).toBe(true);
    });

    it('should replace unsupported characters with blanks', async () => {
      // ^ and { are not in Vestaboard character set
      await client.sendText('A^B{C');

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // Find content row
      const contentRow = sentLayout.find(row => row.some(code => code !== 0));
      expect(contentRow).toBeDefined();

      // A, B, C should be present (1, 2, 3)
      // Unsupported chars converted to 0
      const contentStart = contentRow!.findIndex(code => code !== 0);
      const content = contentRow!.slice(contentStart, contentStart + 5);

      expect(content[0]).toBe(1); // A
      expect(content[1]).toBe(0); // ^
      expect(content[2]).toBe(2); // B
      expect(content[3]).toBe(0); // {
      expect(content[4]).toBe(3); // C
    });

    it('should wrap long lines at word boundaries', async () => {
      // Create text longer than 22 chars
      const longText = 'THIS IS A VERY LONG MESSAGE THAT WRAPS';

      await client.sendText(longText);

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // Should have multiple content rows due to wrapping
      const contentRows = sentLayout.filter(row => row.some(code => code !== 0));
      expect(contentRows.length).toBeGreaterThan(1);
    });

    it('should truncate words longer than row width', async () => {
      // Word longer than 22 characters
      const longWord = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      await client.sendText(longWord);

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // Each row should be exactly 22 chars
      sentLayout.forEach(row => {
        expect(row).toHaveLength(22);
      });
    });

    it('should handle maximum 6 rows', async () => {
      const manyLines = 'LINE 1\nLINE 2\nLINE 3\nLINE 4\nLINE 5\nLINE 6\nLINE 7\nLINE 8';

      await client.sendText(manyLines);

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // Should have exactly 6 rows (content truncated)
      expect(sentLayout).toHaveLength(6);
    });
  });

  describe('sendLayout (direct character codes)', () => {
    it('should send layout directly without conversion', async () => {
      const layout = [
        [8, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // HI
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];

      await client.sendLayout(layout);

      expect(mockHttpClient.post).toHaveBeenCalledWith(layout);
    });

    it('should send color codes in layout', async () => {
      // Color codes: RED=63, BLUE=67
      const layout = [
        [63, 63, 63, 63, 63, 67, 67, 67, 67, 67, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];

      await client.sendLayout(layout);

      expect(mockHttpClient.post).toHaveBeenCalledWith(layout);
    });
  });

  describe('sendLayoutWithAnimation', () => {
    const layout = [
      [8, 5, 12, 12, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    it('should send layout with animation options', async () => {
      await client.sendLayoutWithAnimation(layout, { strategy: 'column' });

      expect(mockHttpClient.postWithAnimation).toHaveBeenCalledWith(layout, { strategy: 'column' });
    });

    it('should support all animation strategies', async () => {
      const strategies = [
        'column',
        'reverse-column',
        'edges-to-center',
        'row',
        'diagonal',
        'random',
      ] as const;

      for (const strategy of strategies) {
        mockHttpClient.postWithAnimation.mockClear();

        await client.sendLayoutWithAnimation(layout, { strategy });

        expect(mockHttpClient.postWithAnimation).toHaveBeenCalledWith(layout, { strategy });
      }
    });
  });

  describe('error propagation', () => {
    it('should propagate HTTP client errors through sendText', async () => {
      const testError = new Error('Network failure');
      mockHttpClient.post.mockRejectedValueOnce(testError);

      await expect(client.sendText('TEST')).rejects.toThrow('Network failure');
    });

    it('should propagate HTTP client errors through sendLayout', async () => {
      const layout = Array(6)
        .fill(null)
        .map(() => Array(22).fill(0));
      const testError = new Error('Server error');
      mockHttpClient.post.mockRejectedValueOnce(testError);

      await expect(client.sendLayout(layout)).rejects.toThrow('Server error');
    });

    it('should propagate HTTP client errors through sendLayoutWithAnimation', async () => {
      const layout = Array(6)
        .fill(null)
        .map(() => Array(22).fill(0));
      const testError = new Error('Animation failed');
      mockHttpClient.postWithAnimation.mockRejectedValueOnce(testError);

      await expect(client.sendLayoutWithAnimation(layout, { strategy: 'column' })).rejects.toThrow(
        'Animation failed'
      );
    });
  });

  describe('character code accuracy fixtures', () => {
    // Verify exact character codes for specific characters
    const characterCodeFixtures = [
      { char: ' ', code: 0 },
      { char: 'A', code: 1 },
      { char: 'Z', code: 26 },
      { char: '0', code: 36 },
      { char: '1', code: 27 },
      { char: '9', code: 35 },
      { char: '!', code: 37 },
      { char: '@', code: 38 },
      { char: '#', code: 39 },
      { char: '$', code: 40 },
      { char: '-', code: 44 },
      { char: '+', code: 46 },
      { char: ':', code: 50 },
      { char: "'", code: 52 },
      { char: '"', code: 53 },
      { char: ',', code: 55 },
      { char: '.', code: 56 },
      { char: '?', code: 60 },
    ];

    it.each(characterCodeFixtures)('should convert "$char" to code $code', ({ char, code }) => {
      expect(charToCode(char)).toBe(code);
    });

    it('should produce correct layout for "GOOD MORNING"', async () => {
      await client.sendText('GOOD MORNING');

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // G=7, O=15, O=15, D=4, space=0, M=13, O=15, R=18, N=14, I=9, N=14, G=7
      const expected = [7, 15, 15, 4, 0, 13, 15, 18, 14, 9, 14, 7];

      const contentRow = sentLayout.find(row => row.some(code => code !== 0));
      expect(contentRow).toBeDefined();

      const contentStart = contentRow!.findIndex(code => code !== 0);
      const actual = contentRow!.slice(contentStart, contentStart + expected.length);
      expect(actual).toEqual(expected);
    });

    it('should produce correct layout for motivational quote', async () => {
      const quote = 'BE THE CHANGE';

      await client.sendText(quote);

      const sentLayout = mockHttpClient.post.mock.calls[0][0] as number[][];

      // B=2, E=5, space=0, T=20, H=8, E=5, space=0, C=3, H=8, A=1, N=14, G=7, E=5
      const expected = [2, 5, 0, 20, 8, 5, 0, 3, 8, 1, 14, 7, 5];

      const contentRow = sentLayout.find(row => row.some(code => code !== 0));
      expect(contentRow).toBeDefined();

      const contentStart = contentRow!.findIndex(code => code !== 0);
      const actual = contentRow!.slice(contentStart, contentStart + expected.length);
      expect(actual).toEqual(expected);
    });
  });
});
