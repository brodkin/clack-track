/**
 * Tests for content:test CLI command
 *
 * Tests the dry-run content generator testing functionality.
 */

// Set environment variables BEFORE any imports that call bootstrap
process.env.OPENAI_API_KEY = 'test-key';

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
          id: 'test-generator-2',
          name: 'Test Generator 2',
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
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('test-generator-2'));
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
          text: 'LAYOUT CONTENT',
          layout: {
            rows: ['ROW 1', 'ROW 2', 'ROW 3', 'ROW 4', 'ROW 5', 'ROW 6'],
          },
          outputMode: 'layout',
          metadata: {
            generatedAt: new Date('2025-01-01T12:00:00Z'),
            generatorId: 'test-layout-gen',
          },
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-layout-gen',
          name: 'Test Layout Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-layout-gen' });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Output mode: layout'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Preview:'));
    });
  });

  describe('user prompt display', () => {
    it('should display user prompt when available from AI generator', async () => {
      // Arrange
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'MOTIVATIONAL QUOTE',
          outputMode: 'text',
          metadata: {
            userPrompt: 'Generate a motivational quote about persistence',
            systemPrompt: 'You are a motivational quote generator',
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
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('USER PROMPT SENT TO LLM');
      expect(allOutput).toContain('Generate a motivational quote about persistence');
    });

    it('should not display user prompt section when not available', async () => {
      // Arrange
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'PROGRAMMATIC CONTENT',
          outputMode: 'text',
          metadata: {
            generatedAt: new Date('2025-01-01T12:00:00Z'),
          },
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'static-content',
          name: 'Static Content Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'static-content' });

      // Assert
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).not.toContain('USER PROMPT SENT TO LLM');
    });
  });

  describe('validation result display', () => {
    it('should display validation pass status for valid content', async () => {
      // Arrange - Valid content: 3 lines, max 15 chars per line
      const validText = 'LINE ONE\nLINE TWO\nLINE THREE';
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: validText,
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-valid',
          name: 'Valid Content Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-valid' });

      // Assert
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('VALIDATION RESULT');
      expect(allOutput).toMatch(/Status:.*PASSED/);
      expect(allOutput).toMatch(/Lines:.*3\/5/);
      expect(allOutput).toMatch(/Max line length:.*\d+\/21/);
      expect(allOutput).toContain('Invalid characters: none');
    });

    it('should display validation fail status for content with too many lines', async () => {
      // Arrange - Invalid content: 6 lines (exceeds 5 line limit for framed mode)
      const invalidText = 'LINE 1\nLINE 2\nLINE 3\nLINE 4\nLINE 5\nLINE 6';
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: invalidText,
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-invalid-lines',
          name: 'Invalid Lines Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-invalid-lines' });

      // Assert
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('VALIDATION RESULT');
      expect(allOutput).toMatch(/Status:.*FAILED/);
      expect(allOutput).toMatch(/Lines:.*6\/5/);
    });

    it('should display validation fail status for content with line too long', async () => {
      // Arrange - Invalid content: line exceeds 21 char limit
      const invalidText = 'THIS LINE IS WAY TOO LONG FOR VESTABOARD';
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: invalidText,
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-invalid-length',
          name: 'Invalid Length Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-invalid-length' });

      // Assert
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('VALIDATION RESULT');
      expect(allOutput).toMatch(/Status:.*FAILED/);
      expect(allOutput).toMatch(/Max line length:.*\d+\/21/);
    });

    it('should display validation fail status for content with invalid characters', async () => {
      // Arrange - Invalid content: contains lowercase and special chars
      const invalidText = 'hello@world';
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: invalidText,
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-invalid-chars',
          name: 'Invalid Chars Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-invalid-chars' });

      // Assert
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('VALIDATION RESULT');
      expect(allOutput).toMatch(/Status:.*FAILED/);
      expect(allOutput).toMatch(/Invalid characters:/);
      expect(allOutput).not.toContain('Invalid characters: none');
    });

    it('should display validation metrics even when validation passes', async () => {
      // Arrange
      const validText = 'VALID TEXT';
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: validText,
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-metrics',
          name: 'Metrics Test Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-metrics' });

      // Assert
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('Lines:');
      expect(allOutput).toContain('Max line length:');
      expect(allOutput).toContain('Invalid characters:');
    });
  });
});
