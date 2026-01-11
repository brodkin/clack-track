/**
 * Unit Tests for test-ai CLI Command
 *
 * Tests the test-ai command which validates AI provider connectivity
 * and performs basic generation tests.
 *
 * @module tests/unit/cli/commands/test-ai
 */

import {
  createMockOpenAIClient,
  createMockAnthropicClient,
} from '../../../__mocks__/ai-providers.js';
import type { AIProvider } from '../../../../src/types/ai.js';
import * as aiModule from '../../../../src/api/ai/index.js';

// Mock console methods to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Import module under test
import { testAICommand } from '../../../../src/cli/commands/test-ai.js';

describe('test-ai command', () => {
  let createAIProviderSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    createAIProviderSpy = jest.spyOn(aiModule, 'createAIProvider');

    // Default environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    createAIProviderSpy.mockRestore();
  });

  describe('Provider Selection', () => {
    it('should test OpenAI when provider is "openai"', async () => {
      const mockProvider = createMockOpenAIClient();
      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      expect(createAIProviderSpy).toHaveBeenCalledWith(
        aiModule.AIProviderType.OPENAI,
        'test-openai-key'
      );
      expect(createAIProviderSpy).toHaveBeenCalledTimes(1);
    });

    it('should test Anthropic when provider is "anthropic"', async () => {
      const mockProvider = createMockAnthropicClient();
      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'anthropic' });

      expect(createAIProviderSpy).toHaveBeenCalledWith(
        aiModule.AIProviderType.ANTHROPIC,
        'test-anthropic-key'
      );
      expect(createAIProviderSpy).toHaveBeenCalledTimes(1);
    });

    it('should test both providers when provider is "all"', async () => {
      const mockOpenAI = createMockOpenAIClient();
      const mockAnthropic = createMockAnthropicClient();

      createAIProviderSpy.mockReturnValueOnce(mockOpenAI).mockReturnValueOnce(mockAnthropic);

      await testAICommand({ provider: 'all' });

      expect(createAIProviderSpy).toHaveBeenCalledWith(
        aiModule.AIProviderType.OPENAI,
        'test-openai-key'
      );
      expect(createAIProviderSpy).toHaveBeenCalledWith(
        aiModule.AIProviderType.ANTHROPIC,
        'test-anthropic-key'
      );
      expect(createAIProviderSpy).toHaveBeenCalledTimes(2);
    });

    it('should default to "all" when no provider specified', async () => {
      const mockOpenAI = createMockOpenAIClient();
      const mockAnthropic = createMockAnthropicClient();

      createAIProviderSpy.mockReturnValueOnce(mockOpenAI).mockReturnValueOnce(mockAnthropic);

      await testAICommand({});

      expect(createAIProviderSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Connection Validation', () => {
    it('should validate connection and display success indicator for valid provider', async () => {
      const mockProvider = createMockOpenAIClient({ connectionValid: true });
      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      // Verify the command displays success indicator for valid connection
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      // Also verify provider name appears in output to confirm which provider was tested
      const consoleOutput = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n');
      expect(consoleOutput).toContain('OpenAI');
    });

    it('should handle failed connection validation', async () => {
      const mockProvider = createMockOpenAIClient({ connectionValid: false });
      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✗'));
    });

    it('should handle connection validation errors', async () => {
      const mockProvider: AIProvider = {
        async validateConnection() {
          throw new Error('Network error');
        },
        async generate() {
          throw new Error('Should not be called');
        },
      };

      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Error'));
    });
  });

  describe('Content Generation Test', () => {
    it('should generate test content successfully', async () => {
      const mockProvider = createMockOpenAIClient({
        responseText: 'Test response content',
        model: 'gpt-4-test',
        tokensUsed: 42,
      });
      const generateSpy = jest.spyOn(mockProvider, 'generate');

      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      expect(generateSpy).toHaveBeenCalledWith({
        systemPrompt: expect.stringContaining('test'),
        userPrompt: expect.stringContaining('connectivity'),
      });
    });

    it('should display generation metrics (tokens, model, timing)', async () => {
      const mockProvider = createMockOpenAIClient({
        model: 'gpt-4-turbo',
        tokensUsed: 150,
      });

      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      const consoleOutput = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n');

      expect(consoleOutput).toContain('gpt-4-turbo');
      expect(consoleOutput).toContain('150');
    });

    it('should handle generation failures gracefully', async () => {
      const mockProvider = createMockOpenAIClient({ shouldFail: true });
      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Error'));
    });
  });

  describe('Environment Configuration', () => {
    it('should use OPENAI_API_KEY from environment', async () => {
      process.env.OPENAI_API_KEY = 'custom-openai-key';

      const mockProvider = createMockOpenAIClient();
      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      expect(createAIProviderSpy).toHaveBeenCalledWith(
        aiModule.AIProviderType.OPENAI,
        'custom-openai-key'
      );
    });

    it('should use ANTHROPIC_API_KEY from environment', async () => {
      process.env.ANTHROPIC_API_KEY = 'custom-anthropic-key';

      const mockProvider = createMockAnthropicClient();
      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'anthropic' });

      expect(createAIProviderSpy).toHaveBeenCalledWith(
        aiModule.AIProviderType.ANTHROPIC,
        'custom-anthropic-key'
      );
    });

    it('should handle missing API key gracefully', async () => {
      delete process.env.OPENAI_API_KEY;

      await testAICommand({ provider: 'openai' });

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('API key not found'));
    });
  });

  describe('Output Formatting', () => {
    it('should display provider name in output', async () => {
      const mockProvider = createMockOpenAIClient();
      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      const consoleOutput = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n');

      expect(consoleOutput).toContain('OpenAI');
    });

    it('should use status symbols (✓, ✗) for results', async () => {
      const mockProvider = createMockOpenAIClient();
      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      const consoleOutput = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n');

      expect(consoleOutput).toMatch(/[✓✗]/);
    });

    it('should format response text readably', async () => {
      const mockProvider = createMockOpenAIClient({
        responseText: 'Multi-line\ntest\nresponse',
      });

      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      const consoleOutput = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n');

      expect(consoleOutput).toContain('Multi-line');
    });
  });

  describe('Interactive Mode', () => {
    it('should accept custom prompt in interactive mode', async () => {
      const mockProvider = createMockOpenAIClient();
      const generateSpy = jest.spyOn(mockProvider, 'generate');

      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({
        provider: 'openai',
        interactive: true,
        customPrompt: 'Custom test prompt',
      });

      expect(generateSpy).toHaveBeenCalledWith({
        systemPrompt: expect.any(String),
        userPrompt: 'Custom test prompt',
      });
    });

    it('should use default prompt when not in interactive mode', async () => {
      const mockProvider = createMockOpenAIClient();
      const generateSpy = jest.spyOn(mockProvider, 'generate');

      createAIProviderSpy.mockReturnValue(mockProvider);

      await testAICommand({ provider: 'openai' });

      expect(generateSpy).toHaveBeenCalledWith({
        systemPrompt: expect.any(String),
        userPrompt: expect.stringContaining('connectivity'),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid provider type', async () => {
      await testAICommand({ provider: 'invalid' });

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Invalid provider'));
    });

    it('should continue testing other providers if one fails', async () => {
      const failingProvider = createMockOpenAIClient({ shouldFail: true });
      const workingProvider = createMockAnthropicClient();

      createAIProviderSpy.mockReturnValueOnce(failingProvider).mockReturnValueOnce(workingProvider);

      await testAICommand({ provider: 'all' });

      // Should have attempted both providers
      expect(createAIProviderSpy).toHaveBeenCalledTimes(2);

      // Should show error for first provider
      expect(mockConsoleError).toHaveBeenCalled();

      // Should show success for second provider
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    });
  });
});
