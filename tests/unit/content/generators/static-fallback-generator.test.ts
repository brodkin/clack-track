/**
 * Unit Tests for StaticFallbackGenerator
 *
 * Tests the P3 fallback content generator that reads static .txt files
 * from a directory and returns random content when all other generators fail.
 *
 * @module tests/unit/content/generators/static-fallback-generator
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { StaticFallbackGenerator } from '@/content/generators/static-fallback-generator';
import type { GenerationContext } from '@/types/content-generator';

// Mock fs/promises
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    readFile: jest.fn(),
    access: jest.fn(),
  },
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('StaticFallbackGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default directory path', () => {
      const generator = new StaticFallbackGenerator();
      expect(generator).toBeInstanceOf(StaticFallbackGenerator);
    });

    it('should create instance with custom directory path', () => {
      const generator = new StaticFallbackGenerator('custom/fallback/path');
      expect(generator).toBeInstanceOf(StaticFallbackGenerator);
    });
  });

  describe('validate()', () => {
    it('should return valid when directory path is provided', () => {
      const generator = new StaticFallbackGenerator('prompts/static');
      const result = generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return valid with default directory path', () => {
      const generator = new StaticFallbackGenerator();
      const result = generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when directory path is empty string', () => {
      const generator = new StaticFallbackGenerator('');
      const result = generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toContain('empty');
    });

    it('should return invalid when directory path is whitespace only', () => {
      const generator = new StaticFallbackGenerator('   ');
      const result = generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toContain('empty');
    });
  });

  describe('generate()', () => {
    const mockContext: GenerationContext = {
      updateType: 'major',
      timestamp: new Date('2025-11-27T10:00:00Z'),
    };

    it('should generate content from a random .txt file', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue([
        'fallback1.txt',
        'fallback2.txt',
        'README.md', // Should be ignored
      ] as string[]);
      mockedFs.readFile.mockResolvedValue('Static fallback message content');

      const generator = new StaticFallbackGenerator('prompts/static');
      const content = await generator.generate(mockContext);

      expect(content).toBeDefined();
      expect(content.text).toBe('Static fallback message content');
      expect(content.outputMode).toBe('text');
      expect(content.layout).toBeUndefined();
      expect(content.metadata).toBeDefined();
      expect(content.metadata?.source).toBe('static-fallback');
    });

    it('should only read .txt files and ignore other file types', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue([
        'fallback.txt',
        'README.md',
        'config.json',
        'image.png',
      ] as string[]);
      mockedFs.readFile.mockResolvedValue('Fallback content');

      const generator = new StaticFallbackGenerator('prompts/static');
      await generator.generate(mockContext);

      // Should only attempt to read the .txt file
      expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('fallback.txt'),
        'utf-8'
      );
    });

    it('should select different files on multiple calls (randomness)', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue([
        'fallback1.txt',
        'fallback2.txt',
        'fallback3.txt',
      ] as string[]);

      mockedFs.readFile.mockImplementation(async path => {
        if (path.toString().includes('fallback1.txt')) return 'Content 1';
        if (path.toString().includes('fallback2.txt')) return 'Content 2';
        if (path.toString().includes('fallback3.txt')) return 'Content 3';
        return 'Unknown';
      });

      const generator = new StaticFallbackGenerator('prompts/static');

      // Call generate multiple times and collect results
      const results = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const content = await generator.generate(mockContext);
        results.add(content.text);
      }

      // With 20 calls across 3 files, we should see at least 2 different files
      // (extremely unlikely to get the same file 20 times in a row)
      expect(results.size).toBeGreaterThanOrEqual(2);
    });

    it('should throw error when directory has no .txt files', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue(['README.md', 'config.json'] as string[]);

      const generator = new StaticFallbackGenerator('prompts/static');

      await expect(generator.generate(mockContext)).rejects.toThrow(
        'No .txt files found in fallback directory'
      );
    });

    it('should throw error when directory does not exist', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));
      mockedFs.readdir.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const generator = new StaticFallbackGenerator('nonexistent/path');

      await expect(generator.generate(mockContext)).rejects.toThrow();
    });

    it('should handle file read errors gracefully', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue(['fallback.txt'] as string[]);
      mockedFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const generator = new StaticFallbackGenerator('prompts/static');

      await expect(generator.generate(mockContext)).rejects.toThrow('Permission denied');
    });

    it('should trim whitespace from file content', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue(['fallback.txt'] as string[]);
      mockedFs.readFile.mockResolvedValue('  \n  Fallback message  \n\n  ');

      const generator = new StaticFallbackGenerator('prompts/static');
      const content = await generator.generate(mockContext);

      expect(content.text).toBe('Fallback message');
    });

    it('should include metadata about the fallback source', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue(['fallback.txt'] as string[]);
      mockedFs.readFile.mockResolvedValue('Fallback content');

      const generator = new StaticFallbackGenerator('prompts/static');
      const content = await generator.generate(mockContext);

      expect(content.metadata).toBeDefined();
      expect(content.metadata?.source).toBe('static-fallback');
      expect(content.metadata?.directory).toBe('prompts/static');
    });

    it('should work with both major and minor update types', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue(['fallback.txt'] as string[]);
      mockedFs.readFile.mockResolvedValue('Fallback message');

      const generator = new StaticFallbackGenerator('prompts/static');

      const majorContext: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };
      const majorContent = await generator.generate(majorContext);
      expect(majorContent.text).toBe('Fallback message');

      const minorContext: GenerationContext = {
        updateType: 'minor',
        timestamp: new Date(),
      };
      const minorContent = await generator.generate(minorContext);
      expect(minorContent.text).toBe('Fallback message');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle empty file content', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue(['empty.txt'] as string[]);
      mockedFs.readFile.mockResolvedValue('');

      const generator = new StaticFallbackGenerator('prompts/static');
      const content = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
      });

      // Empty file after trim should still return (empty string is valid)
      expect(content.text).toBe('');
    });

    it('should handle single .txt file in directory', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue(['only.txt'] as string[]);
      mockedFs.readFile.mockResolvedValue('Only fallback');

      const generator = new StaticFallbackGenerator('prompts/static');
      const content = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
      });

      expect(content.text).toBe('Only fallback');
    });

    it('should handle file paths with special characters', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readdir.mockResolvedValue(['fallback-special!@#.txt'] as string[]);
      mockedFs.readFile.mockResolvedValue('Special content');

      const generator = new StaticFallbackGenerator('prompts/static');
      const content = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
      });

      expect(content.text).toBe('Special content');
    });
  });
});
