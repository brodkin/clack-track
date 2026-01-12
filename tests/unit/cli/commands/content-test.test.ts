/**
 * Tests for content:test CLI command
 *
 * Tests the dry-run content generator testing functionality.
 */

// Set environment variables BEFORE any imports that call bootstrap
process.env.OPENAI_API_KEY = 'test-key';
process.env.VESTABOARD_LOCAL_API_KEY = 'test-vestaboard-key';
process.env.VESTABOARD_LOCAL_API_URL = 'http://localhost:7000';

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { BootstrapResult } from '../../../../src/bootstrap.js';
import type { CronScheduler } from '../../../../src/scheduler/cron.js';

// Mock bootstrap module BEFORE importing the command
jest.mock('../../../../src/bootstrap.js');

import { contentTestCommand } from '../../../../src/cli/commands/content-test.js';
import * as bootstrapModule from '../../../../src/bootstrap.js';
import { ContentRegistry } from '../../../../src/content/registry/content-registry.js';
import { FrameDecorator } from '../../../../src/content/frame/frame-decorator.js';
import type {
  ContentGenerator,
  GeneratedContent,
} from '../../../../src/types/content-generator.js';
import { validateTextContent } from '../../../../src/utils/validators.js';

// Mock FrameDecorator
jest.mock('../../../../src/content/frame/frame-decorator.js');

describe('content:test command', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let registry: ContentRegistry;
  let bootstrapSpy: jest.SpyInstance;
  let mockScheduler: jest.Mocked<CronScheduler>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset registry before each test
    ContentRegistry.reset();
    registry = ContentRegistry.getInstance();

    // Create mock scheduler
    mockScheduler = {
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as jest.Mocked<CronScheduler>;

    // Mock bootstrap function to return minimal BootstrapResult
    bootstrapSpy = jest.spyOn(bootstrapModule, 'bootstrap').mockResolvedValue({
      orchestrator: {} as BootstrapResult['orchestrator'],
      eventHandler: null,
      scheduler: mockScheduler,
      registry: registry,
      haClient: null,
      database: null,
    } as BootstrapResult);

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
    bootstrapSpy.mockRestore();
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
    }, 10000); // Increase timeout for frame decoration async operation

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

  describe('validation logic', () => {
    // These tests verify the validator behavior directly, not CLI output

    it('should validate content with correct line count', () => {
      // Arrange - Valid content: 3 lines, max 15 chars per line
      const validText = 'LINE ONE\nLINE TWO\nLINE THREE';

      // Act
      const result = validateTextContent(validText);

      // Assert - Check validator logic directly
      expect(result.valid).toBe(true);
      expect(result.lineCount).toBe(3);
      expect(result.invalidChars).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should detect too many lines (exceeds 5 line limit)', () => {
      // Arrange - Invalid content: 6 lines
      const invalidText = 'LINE 1\nLINE 2\nLINE 3\nLINE 4\nLINE 5\nLINE 6';

      // Act
      const result = validateTextContent(invalidText);

      // Assert - Check validator detects violation
      expect(result.valid).toBe(false);
      expect(result.lineCount).toBe(6);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('5 lines');
    });

    it('should detect line too long that exceeds 5 lines after wrapping', () => {
      // Arrange - Invalid content: line exceeds 21 chars AND wraps to >5 lines
      // Pre-validation wrapping salvages slightly long lines, but fails if result >5 lines
      const invalidText =
        'LINE 1\nLINE 2\nLINE 3\nLINE 4\nTHIS LINE IS WAY TOO LONG FOR VESTABOARD AND WILL WRAP';

      // Act
      const result = validateTextContent(invalidText);

      // Assert - Check validator detects violation after wrapping
      expect(result.valid).toBe(false);
      expect(result.wrappingApplied).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('5 lines');
    });

    it('should detect invalid characters', () => {
      // Arrange - Invalid content: characters not supported by Vestaboard
      // Note: lowercase letters are valid (uppercased before validation)
      // Use characters that are truly invalid like ™, €, or emoji
      const invalidText = 'HELLO™WORLD';

      // Act
      const result = validateTextContent(invalidText);

      // Assert - Check validator detects invalid chars
      expect(result.valid).toBe(false);
      expect(result.invalidChars.length).toBeGreaterThan(0);
      expect(result.invalidChars).toContain('™');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should pass validation for valid content', () => {
      // Arrange - Valid uppercase text
      const validText = 'VALID TEXT';

      // Act
      const result = validateTextContent(validText);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.lineCount).toBe(1);
      expect(result.invalidChars).toEqual([]);
    });
  });

  describe('validation output formatting', () => {
    // These tests verify CLI displays validation results correctly
    // Use loose assertions that won't break on formatting changes

    it('should display validation pass status in output', async () => {
      // Arrange
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

      // Assert - Check output contains key indicators (loose matching)
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('VALIDATION RESULT');
      expect(allOutput).toMatch(/PASSED/); // Don't rely on exact format
    });

    it('should display validation fail status in output', async () => {
      // Arrange - Invalid content: too many lines
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

      // Assert - Check output contains failure indicator
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('VALIDATION RESULT');
      expect(allOutput).toMatch(/FAILED/);
    });

    it('should display validation metrics in output', async () => {
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

      // Assert - Check key metrics are present (don't check exact format)
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('Lines:');
      expect(allOutput).toContain('Max line length:');
      expect(allOutput).toContain('Invalid characters:');
    });
  });

  describe('edge case error handling', () => {
    // These tests target specific uncovered error paths

    it('should handle HA connection failure when --with-frame flag is used', async () => {
      // Arrange - Set HA environment variables to trigger connection attempt
      const originalHaUrl = process.env.HA_URL;
      const originalHaToken = process.env.HA_TOKEN;
      process.env.HA_URL = 'http://localhost:8123';
      process.env.HA_TOKEN = 'test-ha-token';

      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'TEST CONTENT',
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-ha-fail',
          name: 'Test HA Fail Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Mock HomeAssistantClient to fail on connect
      const { HomeAssistantClient } =
        await import('../../../../src/api/data-sources/home-assistant.js');
      jest
        .spyOn(HomeAssistantClient.prototype, 'connect')
        .mockRejectedValue(new Error('Connection failed'));

      const mockDecorate = jest.fn().mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      (FrameDecorator as jest.Mock).mockImplementation(() => ({
        decorate: mockDecorate,
      }));

      // Act
      await contentTestCommand({ generatorId: 'test-ha-fail', withFrame: true });

      // Assert - Should log warning about HA connection failure (lines 171-172)
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('Home Assistant connection failed');

      // Cleanup
      process.env.HA_URL = originalHaUrl;
      process.env.HA_TOKEN = originalHaToken;
    });

    it('should handle AI provider creation failure when --with-frame flag is used', async () => {
      // Arrange - Set AI keys to trigger creation attempt
      const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
      const originalOpenAiKey = process.env.OPENAI_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'TEST CONTENT',
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-ai-fail',
          name: 'Test AI Fail Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Mock createAIProvider to fail for both providers
      const createAIProviderSpy = jest
        .spyOn(await import('../../../../src/api/ai/index.js'), 'createAIProvider')
        .mockImplementation(() => {
          throw new Error('Provider creation failed');
        });

      const mockDecorate = jest.fn().mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      (FrameDecorator as jest.Mock).mockImplementation(() => ({
        decorate: mockDecorate,
      }));

      // Act - Should not throw despite AI provider failures (lines 182-183, 189-192)
      await contentTestCommand({ generatorId: 'test-ai-fail', withFrame: true });

      // Assert - Command should complete successfully without AI provider
      expect(mockDecorate).toHaveBeenCalled();

      // Cleanup
      createAIProviderSpy.mockRestore();
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    });

    it('should display warnings from frame decoration', async () => {
      // Arrange
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'TEST CONTENT',
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-warnings',
          name: 'Test Warnings Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Mock FrameDecorator to return warnings (lines 204-205)
      const mockDecorate = jest.fn().mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: ['Warning 1: Weather unavailable', 'Warning 2: Color bar failed'],
      });

      (FrameDecorator as jest.Mock).mockImplementation(() => ({
        decorate: mockDecorate,
      }));

      // Act
      await contentTestCommand({ generatorId: 'test-warnings', withFrame: true });

      // Assert - Should display warnings
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('Warnings:');
      expect(allOutput).toContain('Warning 1: Weather unavailable');
      expect(allOutput).toContain('Warning 2: Color bar failed');
    });

    it('should display user prompt for layout mode generators', async () => {
      // Arrange
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          layout: {
            rows: ['ROW 1', 'ROW 2', 'ROW 3', 'ROW 4', 'ROW 5', 'ROW 6'],
          },
          outputMode: 'layout',
          metadata: {
            userPrompt: 'Generate layout with custom pattern',
            generatedAt: new Date('2025-01-01T12:00:00Z'),
          },
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-layout-prompt',
          name: 'Test Layout Prompt Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-layout-prompt' });

      // Assert - Should display user prompt for layout mode (lines 217-220)
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('USER PROMPT SENT TO LLM');
      expect(allOutput).toContain('Generate layout with custom pattern');
    });

    it('should handle bootstrap HA client disconnect error gracefully', async () => {
      // Arrange
      const mockHaClient = {
        disconnect: jest.fn().mockRejectedValue(new Error('Disconnect failed')),
      };

      // Update bootstrap mock to return HA client
      bootstrapSpy.mockResolvedValue({
        orchestrator: {} as BootstrapResult['orchestrator'],
        eventHandler: null,
        scheduler: mockScheduler,
        registry: registry,
        haClient: mockHaClient as unknown as HomeAssistantClient,
        database: null,
      } as BootstrapResult);

      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'TEST CONTENT',
          outputMode: 'text',
        } as unknown as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-ha-disconnect',
          name: 'Test HA Disconnect Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Act - Should not throw despite disconnect error (lines 262-263)
      await contentTestCommand({ generatorId: 'test-ha-disconnect' });

      // Assert - Command should complete successfully
      expect(mockHaClient.disconnect).toHaveBeenCalled();
      expect(mockScheduler.stop).toHaveBeenCalled();
    });

    it('should handle unknown priority level in getPriorityLabel', async () => {
      // Arrange - Register generator with non-standard priority (lines 286, 290-292)
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'TEST CONTENT',
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-unknown-priority',
          name: 'Test Unknown Priority Generator',
          priority: 5, // Non-standard priority
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-unknown-priority' });

      // Assert - Should display P5 for priority 5
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('P5');
    });

    it('should display P0-NOTIFICATION for priority 0 generators', async () => {
      // Arrange - Register P0 generator (line 286)
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'NOTIFICATION',
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-p0',
          name: 'Test P0 Generator',
          priority: 0, // P0 priority
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-p0' });

      // Assert - Should display P0-NOTIFICATION
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('P0-NOTIFICATION');
    });

    it('should display P3-FALLBACK for priority 3 generators', async () => {
      // Arrange - Register P3 generator (line 290)
      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'FALLBACK CONTENT',
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-p3',
          name: 'Test P3 Generator',
          priority: 3, // P3 priority
          modelTier: 1,
        },
        mockGenerator
      );

      // Act
      await contentTestCommand({ generatorId: 'test-p3' });

      // Assert - Should display P3-FALLBACK
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const allOutput = calls.join('\n');
      expect(allOutput).toContain('P3-FALLBACK');
    });

    it('should handle local HA client disconnect error when --with-frame flag is used', async () => {
      // Arrange - Set HA environment variables and make disconnect fail
      const originalHaUrl = process.env.HA_URL;
      const originalHaToken = process.env.HA_TOKEN;
      process.env.HA_URL = 'http://localhost:8123';
      process.env.HA_TOKEN = 'test-ha-token';

      const mockGenerator: jest.Mocked<ContentGenerator> = {
        generate: jest.fn().mockResolvedValue({
          text: 'TEST CONTENT',
          outputMode: 'text',
        } as GeneratedContent),
      };

      registry.register(
        {
          id: 'test-local-ha-disconnect',
          name: 'Test Local HA Disconnect Generator',
          priority: 2,
          modelTier: 1,
        },
        mockGenerator
      );

      // Mock HomeAssistantClient to succeed on connect but fail on disconnect
      const mockDisconnect = jest.fn().mockRejectedValue(new Error('Disconnect failed'));
      const mockConnect = jest.fn().mockResolvedValue(undefined);

      // Mock the constructor to create a client that fails on disconnect
      const MockedHomeAssistantClient = jest.fn().mockImplementation(() => {
        return {
          connect: mockConnect,
          disconnect: mockDisconnect,
        };
      });

      // Replace the HomeAssistantClient in the module
      const haModule = await import('../../../../src/api/data-sources/home-assistant.js');
      jest
        .spyOn(haModule, 'HomeAssistantClient')
        .mockImplementation(
          MockedHomeAssistantClient as unknown as typeof haModule.HomeAssistantClient
        );

      const mockDecorate = jest.fn().mockResolvedValue({
        layout: [[1, 2, 3]],
        warnings: [],
      });

      (FrameDecorator as jest.Mock).mockImplementation(() => ({
        decorate: mockDecorate,
      }));

      // Act - Should not throw despite disconnect error (lines 271-272)
      await contentTestCommand({ generatorId: 'test-local-ha-disconnect', withFrame: true });

      // Assert - Command should complete successfully
      expect(mockConnect).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled(); // Disconnect was attempted

      // Cleanup
      process.env.HA_URL = originalHaUrl;
      process.env.HA_TOKEN = originalHaToken;
    });
  });
});
