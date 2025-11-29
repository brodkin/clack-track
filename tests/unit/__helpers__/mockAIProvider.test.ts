/**
 * Tests for Mock AI Provider Factory
 *
 * Validates that mock AI provider helpers create proper mocks with correct
 * behavior for testing various scenarios including success, failure, and
 * specific error types that trigger failover.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  createMockAIProvider,
  createFailingProvider,
  createRateLimitedProvider,
  createAuthFailedProvider,
  createInvalidRequestProvider,
  createMockProviderWithConnection,
} from '@tests/__helpers__/mockAIProvider';
import type { AIGenerationRequest } from '@/types/ai';
import {
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
} from '@/types/errors';

describe('mockAIProvider', () => {
  describe('createMockAIProvider', () => {
    it('should create a basic mock provider with default response', async () => {
      const provider = createMockAIProvider();

      const request: AIGenerationRequest = {
        systemPrompt: 'test system',
        userPrompt: 'test user',
      };

      const response = await provider.generate(request);

      expect(response.text).toBe('MOCK AI RESPONSE');
      expect(response.model).toBe('mock-model');
      expect(response.tokensUsed).toBe(30);
      expect(response.finishReason).toBe('stop');
    });

    it('should create provider with custom response', async () => {
      const provider = createMockAIProvider({
        response: {
          text: 'CUSTOM RESPONSE',
          model: 'custom-model',
          tokensUsed: 100,
        },
      });

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      const response = await provider.generate(request);

      expect(response.text).toBe('CUSTOM RESPONSE');
      expect(response.model).toBe('custom-model');
      expect(response.tokensUsed).toBe(100);
    });

    it('should merge custom response with defaults', async () => {
      const provider = createMockAIProvider({
        response: {
          text: 'CUSTOM TEXT',
        },
      });

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      const response = await provider.generate(request);

      expect(response.text).toBe('CUSTOM TEXT');
      expect(response.model).toBe('mock-model'); // Default
      expect(response.tokensUsed).toBe(30); // Default
    });

    it('should create failing provider when shouldFail is true', async () => {
      const testError = new Error('Test failure');
      const provider = createMockAIProvider({
        shouldFail: true,
        failureError: testError,
      });

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      await expect(provider.generate(request)).rejects.toThrow('Test failure');
    });

    it('should have jest.fn() spies for generate and validateConnection', () => {
      const provider = createMockAIProvider();

      expect(jest.isMockFunction(provider.generate)).toBe(true);
      expect(jest.isMockFunction(provider.validateConnection)).toBe(true);
    });

    it('should return valid connection by default', async () => {
      const provider = createMockAIProvider();
      const valid = await provider.validateConnection();

      expect(valid).toBe(true);
    });

    it('should return invalid connection when configured', async () => {
      const provider = createMockAIProvider({
        connectionValid: false,
      });

      const valid = await provider.validateConnection();

      expect(valid).toBe(false);
    });
  });

  describe('createFailingProvider', () => {
    it('should create provider that throws specified error', async () => {
      const customError = new Error('Custom error message');
      const provider = createFailingProvider(customError);

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      await expect(provider.generate(request)).rejects.toThrow('Custom error message');
    });

    it('should throw the exact error instance provided', async () => {
      const customError = new Error('Test error');
      const provider = createFailingProvider(customError);

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      await expect(provider.generate(request)).rejects.toBe(customError);
    });
  });

  describe('createRateLimitedProvider', () => {
    it('should create provider that throws RateLimitError', async () => {
      const provider = createRateLimitedProvider();

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      await expect(provider.generate(request)).rejects.toThrow(RateLimitError);
    });

    it('should include provider name in error', async () => {
      const provider = createRateLimitedProvider('openai');

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      try {
        await provider.generate(request);
        fail('Should have thrown RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        if (error instanceof RateLimitError) {
          expect(error.provider).toBe('openai');
        }
      }
    });

    it('should use default provider name when not specified', async () => {
      const provider = createRateLimitedProvider();

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      try {
        await provider.generate(request);
        fail('Should have thrown RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        if (error instanceof RateLimitError) {
          expect(error.provider).toBe('mock-provider');
        }
      }
    });
  });

  describe('createAuthFailedProvider', () => {
    it('should create provider that throws AuthenticationError', async () => {
      const provider = createAuthFailedProvider();

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      await expect(provider.generate(request)).rejects.toThrow(AuthenticationError);
    });

    it('should include provider name in error', async () => {
      const provider = createAuthFailedProvider('anthropic');

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      try {
        await provider.generate(request);
        fail('Should have thrown AuthenticationError');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        if (error instanceof AuthenticationError) {
          expect(error.provider).toBe('anthropic');
        }
      }
    });
  });

  describe('createInvalidRequestProvider', () => {
    it('should create provider that throws InvalidRequestError', async () => {
      const provider = createInvalidRequestProvider();

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      await expect(provider.generate(request)).rejects.toThrow(InvalidRequestError);
    });

    it('should include provider name in error', async () => {
      const provider = createInvalidRequestProvider('test-provider');

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      try {
        await provider.generate(request);
        fail('Should have thrown InvalidRequestError');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRequestError);
        if (error instanceof InvalidRequestError) {
          expect(error.provider).toBe('test-provider');
        }
      }
    });
  });

  describe('createMockProviderWithConnection', () => {
    it('should create provider with valid connection', async () => {
      const provider = createMockProviderWithConnection(true);
      const valid = await provider.validateConnection();

      expect(valid).toBe(true);
    });

    it('should create provider with invalid connection', async () => {
      const provider = createMockProviderWithConnection(false);
      const valid = await provider.validateConnection();

      expect(valid).toBe(false);
    });

    it('should still generate responses normally', async () => {
      const provider = createMockProviderWithConnection(true);

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      const response = await provider.generate(request);

      expect(response.text).toBe('MOCK AI RESPONSE');
    });
  });

  describe('spy functionality', () => {
    it('should allow checking if generate was called', async () => {
      const provider = createMockAIProvider();

      const request: AIGenerationRequest = {
        systemPrompt: 'system',
        userPrompt: 'user',
      };

      await provider.generate(request);

      expect(provider.generate).toHaveBeenCalledTimes(1);
      expect(provider.generate).toHaveBeenCalledWith(request);
    });

    it('should allow checking if validateConnection was called', async () => {
      const provider = createMockAIProvider();

      await provider.validateConnection();

      expect(provider.validateConnection).toHaveBeenCalledTimes(1);
    });

    it('should allow resetting mock history', async () => {
      const provider = createMockAIProvider();
      const generateMock = provider.generate as jest.MockedFunction<typeof provider.generate>;

      const request: AIGenerationRequest = {
        systemPrompt: 'test',
        userPrompt: 'test',
      };

      await provider.generate(request);
      expect(generateMock).toHaveBeenCalledTimes(1);

      generateMock.mockClear();
      expect(generateMock).toHaveBeenCalledTimes(0);
    });
  });
});
