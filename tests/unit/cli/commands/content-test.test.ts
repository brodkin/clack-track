/**
 * Tests for content:test CLI command
 *
 * Tests the dry-run content generator testing functionality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { contentTestCommand } from '../../../../src/cli/commands/content-test.js';
import { ContentRegistry } from '../../../../src/content/registry/content-registry.js';
import { FrameDecorator } from '../../../../src/content/frame/frame-decorator.js';
import type {
  ContentGenerator,
  GeneratedContent,
} from '../../../../src/types/content-generator.js';

// Mock FrameDecorator
jest.mock('../../../../src/content/frame/frame-decorator.js');

describe('content:test command', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let registry: ContentRegistry;

  beforeEach(() => {
    // Reset registry before each test
    ContentRegistry.reset();
    registry = ContentRegistry.getInstance();

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Mock FrameDecorator
    (FrameDecorator as jest.Mock).mockImplementation(() => ({
      decorate: jest.fn().mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      }),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    ContentRegistry.reset();
  });

  describe('when no generator ID is provided', () => {
    it('should list all available generators', async () => {
      // Arrange - Register test generators
      const mockGen1: ContentGenerator = {
        generate: jest.fn(),
      };
      const mockGen2: ContentGenerator = {
        generate: jest.fn(),
      };

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGen1
      );

      registry.register(
        {
          id: 'news-summary',
          name: 'News Summary Generator',
          priority: 2,
          modelTier: 2,
        },
        mockGen2
      );

      // Act
      await contentTestCommand({});

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available generators:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('motivational'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('news-summary'));
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });

  describe('when invalid generator ID is provided', () => {
    it('should show error and list available generators', async () => {
      // Arrange - Register one generator
      const mockGen: ContentGenerator = {
        generate: jest.fn(),
      };

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGen
      );

      // Act
      await contentTestCommand({ generatorId: 'invalid-id' });

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generator "invalid-id" not found')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available generators:'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('when valid generator ID is provided', () => {
    it('should generate content and display results', async () => {
      // Arrange
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'TEST CONTENT',
          outputMode: 'text',
          metadata: {
            generatedAt: new Date('2025-01-01T12:00:00Z'),
            generatorId: 'motivational',
          },
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'motivational' });

      // Assert
      expect(mockGenerator.generate).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TEST CONTENT'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Character count:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Line count:'));
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should apply frame when --with-frame flag is provided', async () => {
      // Arrange
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'TEST CONTENT',
          outputMode: 'text',
          metadata: {
            generatedAt: new Date('2025-01-01T12:00:00Z'),
            generatorId: 'motivational',
          },
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      const mockDecorate = jest.fn().mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      (FrameDecorator as jest.Mock).mockImplementation(() => ({
        decorate: mockDecorate,
      }));

      // Act
      await contentTestCommand({ generatorId: 'motivational', withFrame: true });

      // Assert
      expect(mockDecorate).toHaveBeenCalledWith('TEST CONTENT', expect.any(Date));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('FRAME PREVIEW'));
    });

    it('should handle generation errors gracefully', async () => {
      // Arrange
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockRejectedValue(new Error('Generation failed')),
      };

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'motivational' });

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to test content generator'),
        expect.any(Error)
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show timing information', async () => {
      // Arrange
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                text: 'TEST CONTENT',
                outputMode: 'text',
                metadata: {
                  generatedAt: new Date('2025-01-01T12:00:00Z'),
                  generatorId: 'motivational',
                },
              } as GeneratedContent);
            }, 100);
          });
        }),
      };

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'motivational' });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Generation time:.*ms/));
    });

    it('should validate character count and line count', async () => {
      // Arrange
      const testText = 'LINE ONE\nLINE TWO\nLINE THREE';
      const expectedCharCount = testText.length; // 28
      const expectedLineCount = testText.split('\n').length; // 3

      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: testText,
          outputMode: 'text',
          metadata: {
            generatedAt: new Date('2025-01-01T12:00:00Z'),
            generatorId: 'motivational',
          },
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'motivational' });

      // Assert
      // Check that console.log was called with messages containing these strings
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain(`Character count: ${expectedCharCount}`);
      expect(allOutput).toContain(`Line count: ${expectedLineCount}`);
    });
  });

  describe('when generator returns layout mode', () => {
    it('should handle layout output mode', async () => {
      // Arrange
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          layout: [[1, 2, 3]],
          outputMode: 'layout',
          metadata: {
            generatedAt: new Date('2025-01-01T12:00:00Z'),
            generatorId: 'ascii-art',
          },
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'ascii-art',
          name: 'ASCII Art Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'ascii-art' });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Output mode: layout'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Layout:'));
    });
  });
});
