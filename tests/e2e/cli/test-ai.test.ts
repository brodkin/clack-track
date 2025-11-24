/**
 * E2E Tests for test-ai CLI Command
 *
 * Tests the complete workflow of the test-ai command including:
 * - Provider selection logic
 * - Console output formatting
 * - Error handling and reporting
 * - Multiple provider testing
 *
 * These tests use mocked AI providers to avoid real API calls.
 */

import { testAICommand } from '../../../src/cli/commands/test-ai.js';
import { createMockOpenAIClient, createMockAnthropicClient } from '../../__mocks__/ai-providers.js';
import * as aiIndex from '../../../src/api/ai/index.js';
import { AIProviderType } from '../../../src/api/ai/index.js';

describe('CLI test-ai Command E2E', () => {
  const originalEnv = process.env;
  let consoleOutput: string[] = [];
  let consoleErrors: string[] = [];

  beforeEach(() => {
    // Preserve original environment
    process.env = { ...originalEnv };

    // Clear output arrays
    consoleOutput = [];
    consoleErrors = [];

    // Mock console methods to capture output
    jest.spyOn(console, 'log').mockImplementation((msg: string) => {
      consoleOutput.push(String(msg));
    });

    jest.spyOn(console, 'error').mockImplementation((msg: string) => {
      consoleErrors.push(String(msg));
    });
  });

  afterEach(() => {
    // Restore original environment and console
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Provider Selection', () => {
    it('should test OpenAI when provider is openai', async () => {
      process.env.AI_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'test-key-openai';

      // Mock the factory to return our mock client
      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(type => {
        if (type === AIProviderType.OPENAI) {
          return createMockOpenAIClient({
            responseText: 'OpenAI test response',
            model: 'gpt-4-turbo-preview',
          });
        }
        throw new Error('Unexpected provider type');
      });

      await testAICommand({ provider: 'openai' });

      const output = consoleOutput.join('\n');
      expect(output).toContain('OpenAI');
      expect(output).toMatch(/Connection.*successful/i);
      expect(output).toMatch(/Generation.*successful/i);
    });

    it('should test Anthropic when provider is anthropic', async () => {
      process.env.AI_PROVIDER = 'anthropic';
      process.env.ANTHROPIC_API_KEY = 'test-key-anthropic';

      // Mock the factory to return our mock client
      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(type => {
        if (type === AIProviderType.ANTHROPIC) {
          return createMockAnthropicClient({
            responseText: 'Anthropic test response',
            model: 'claude-3-5-sonnet-20241022',
          });
        }
        throw new Error('Unexpected provider type');
      });

      await testAICommand({ provider: 'anthropic' });

      const output = consoleOutput.join('\n');
      expect(output).toContain('Anthropic');
      expect(output).toMatch(/Connection.*successful/i);
      expect(output).toMatch(/Generation.*successful/i);
    });

    it('should test all providers when provider is all', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Mock the factory to return appropriate mock client
      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(type => {
        if (type === AIProviderType.OPENAI) {
          return createMockOpenAIClient({
            responseText: 'OpenAI response',
            model: 'gpt-4-turbo-preview',
          });
        }
        if (type === AIProviderType.ANTHROPIC) {
          return createMockAnthropicClient({
            responseText: 'Anthropic response',
            model: 'claude-3-5-sonnet-20241022',
          });
        }
        throw new Error('Unexpected provider type');
      });

      await testAICommand({ provider: 'all' });

      const output = consoleOutput.join('\n');
      expect(output).toContain('OpenAI');
      expect(output).toContain('Anthropic');
    });

    it('should reject invalid provider names', async () => {
      await testAICommand({ provider: 'invalid-provider' });

      const errors = consoleErrors.join('\n');
      expect(errors).toMatch(/Invalid provider/i);
      expect(errors).toContain('invalid-provider');
    });
  });

  describe('Output Formatting', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';

      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(() =>
        createMockOpenAIClient({
          responseText: 'Test response',
          model: 'gpt-4-turbo-preview',
        })
      );
    });

    it('should display success symbols for passing tests', async () => {
      await testAICommand({ provider: 'openai' });

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/✓/); // Success symbol
      expect(output).toMatch(/Connection.*successful/i);
      expect(output).toMatch(/Generation.*successful/i);
    });

    it('should display performance metrics', async () => {
      await testAICommand({ provider: 'openai' });

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/\d+ms/); // Timing metric
      expect(output).toContain('Model:');
      expect(output).toContain('Tokens:');
    });

    it('should display formatted response with box drawing', async () => {
      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(() =>
        createMockOpenAIClient({
          responseText: 'Multi-line\ntest\nresponse',
          model: 'gpt-4-turbo-preview',
        })
      );

      await testAICommand({ provider: 'openai' });

      const output = consoleOutput.join('\n');
      expect(output).toContain('┌'); // Box top
      expect(output).toContain('│'); // Box sides
      expect(output).toContain('└'); // Box bottom
    });

    it('should display model information', async () => {
      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(() =>
        createMockOpenAIClient({
          responseText: 'Test',
          model: 'gpt-4-turbo-preview',
        })
      );

      await testAICommand({ provider: 'openai' });

      const output = consoleOutput.join('\n');
      expect(output).toContain('Model: gpt-4-turbo-preview');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing API keys gracefully', async () => {
      process.env.AI_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;

      await testAICommand({ provider: 'openai' });

      const errors = consoleErrors.join('\n');
      expect(errors).toMatch(/API key not found/i);
      expect(errors).toContain('OPENAI_API_KEY');
    });

    it('should continue with remaining providers if one fails', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      delete process.env.ANTHROPIC_API_KEY; // Missing Anthropic key

      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(type => {
        if (type === AIProviderType.OPENAI) {
          return createMockOpenAIClient({
            responseText: 'OpenAI response',
            model: 'gpt-4-turbo-preview',
          });
        }
        throw new Error('No API key');
      });

      await testAICommand({ provider: 'all' });

      const output = consoleOutput.join('\n');
      const errors = consoleErrors.join('\n');

      // Should still test OpenAI successfully
      expect(output).toContain('OpenAI');
      expect(output).toMatch(/Connection.*successful/i);

      // Should show error for Anthropic
      expect(errors).toMatch(/API key not found/i);
    });

    it('should handle connection validation failures', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(() =>
        createMockOpenAIClient({
          connectionValid: false,
        })
      );

      await testAICommand({ provider: 'openai' });

      const output = consoleOutput.join('\n');
      const errors = consoleErrors.join('\n');

      expect(output).toContain('Connection failed');
      expect(errors).toMatch(/Error testing OpenAI/i);
    });

    it('should handle generation failures', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(() =>
        createMockOpenAIClient({
          shouldFail: true,
        })
      );

      await testAICommand({ provider: 'openai' });

      const errors = consoleErrors.join('\n');
      expect(errors).toMatch(/Error testing OpenAI/i);
      expect(errors).toMatch(/Mock OpenAI API Error/i);
    });
  });

  describe('Custom Prompts', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';

      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(() =>
        createMockOpenAIClient({
          responseText: 'Custom prompt response',
          model: 'gpt-4-turbo-preview',
        })
      );
    });

    it('should accept custom prompts', async () => {
      await testAICommand({
        provider: 'openai',
        interactive: true,
        customPrompt: 'Tell me a joke',
      });

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Generation.*successful/i);
    });

    it('should use default prompt when custom prompt not provided', async () => {
      await testAICommand({ provider: 'openai' });

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Generation.*successful/i);
    });
  });

  describe('Integration with Multiple Providers', () => {
    it('should handle testing both providers sequentially', async () => {
      process.env.OPENAI_API_KEY = 'test-openai';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic';

      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(type => {
        if (type === AIProviderType.OPENAI) {
          return createMockOpenAIClient({
            responseText: 'OpenAI response',
            model: 'gpt-4-turbo-preview',
          });
        }
        return createMockAnthropicClient({
          responseText: 'Anthropic response',
          model: 'claude-3-5-sonnet-20241022',
        });
      });

      await testAICommand({ provider: 'all' });

      const output = consoleOutput.join('\n');

      // Verify both providers were tested
      expect(output).toContain('OpenAI');
      expect(output).toContain('Anthropic');

      // Verify both passed
      const matches = output.match(/Connection.*successful/gi);
      expect(matches).toHaveLength(2);
    });

    it('should complete testing even if first provider fails', async () => {
      process.env.OPENAI_API_KEY = 'test-openai';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic';

      let callCount = 0;
      jest.spyOn(aiIndex, 'createAIProvider').mockImplementation(type => {
        callCount++;
        if (type === AIProviderType.OPENAI) {
          return createMockOpenAIClient({
            shouldFail: true,
          });
        }
        return createMockAnthropicClient({
          responseText: 'Anthropic success',
          model: 'claude-3-5-sonnet-20241022',
        });
      });

      await testAICommand({ provider: 'all' });

      const output = consoleOutput.join('\n');
      const errors = consoleErrors.join('\n');

      // Both providers should be attempted
      expect(callCount).toBe(2);

      // OpenAI should show error
      expect(errors).toMatch(/Mock OpenAI API Error/i);

      // Anthropic should succeed
      expect(output).toContain('Anthropic');
      expect(output).toMatch(/Connection.*successful/i);
    });
  });
});
