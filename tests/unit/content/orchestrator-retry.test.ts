/**
 * Tests for orchestrator retry logic with alternate provider fallback
 *
 * Test scenarios:
 * 1. Preferred provider succeeds → return result
 * 2. Preferred rate limited → alternate succeeds → return result
 * 3. Preferred auth error → alternate succeeds → return result
 * 4. Preferred fails with non-retryable error → throw immediately
 * 5. Both fail with retryable errors → throw last error
 * 6. Preferred succeeds after alternate fails (no retry needed)
 * 7. Both fail with different retryable errors → throw alternate error
 */

import { generateWithRetry } from '@/content/orchestrator-retry';
import { RateLimitError, AuthenticationError, InvalidRequestError } from '@/types/errors';
import type { AIProvider } from '@/types/ai';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
} from '@/types/content-generator';

describe('generateWithRetry', () => {
  let mockGenerator: ContentGenerator;
  let mockPreferredProvider: AIProvider;
  let mockAlternateProvider: AIProvider;
  let mockContext: GenerationContext;

  beforeEach(() => {
    // Mock context
    mockContext = {
      updateType: 'major',
      timestamp: new Date('2025-01-15T10:00:00Z'),
    };

    // Mock generator
    mockGenerator = {
      generate: jest.fn(),
      validate: jest.fn(),
    };

    // Mock providers
    mockPreferredProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };

    mockAlternateProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    };
  });

  describe('Scenario 1: Preferred provider succeeds', () => {
    it('should return result from preferred provider on success', async () => {
      const expectedContent: GeneratedContent = {
        text: 'Success from preferred',
        outputMode: 'text',
      };

      (mockGenerator.generate as jest.Mock).mockResolvedValue(expectedContent);

      const result = await generateWithRetry(
        mockGenerator,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result).toEqual(expectedContent);
      expect(mockGenerator.generate).toHaveBeenCalledWith(mockContext);
      expect(mockGenerator.generate).toHaveBeenCalledTimes(1);
    });

    it('should not call alternate provider if preferred succeeds', async () => {
      const expectedContent: GeneratedContent = {
        text: 'Success from preferred',
        outputMode: 'text',
      };

      (mockGenerator.generate as jest.Mock).mockResolvedValue(expectedContent);

      await generateWithRetry(
        mockGenerator,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      // Verify alternate provider was never used
      expect(mockAlternateProvider.generate).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 2: Preferred rate limited → alternate succeeds', () => {
    it('should retry with alternate provider on RateLimitError', async () => {
      const rateLimitError = new RateLimitError('Rate limit exceeded', 'openai');

      const expectedContent: GeneratedContent = {
        text: 'Success from alternate',
        outputMode: 'text',
      };

      // First call fails with rate limit, second succeeds
      (mockGenerator.generate as jest.Mock)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(expectedContent);

      const result = await generateWithRetry(
        mockGenerator,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result).toEqual(expectedContent);
      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
    });

    it('should pass context to generator on retry', async () => {
      const rateLimitError = new RateLimitError('Rate limit exceeded', 'openai');

      const expectedContent: GeneratedContent = {
        text: 'Success from alternate',
        outputMode: 'text',
      };

      (mockGenerator.generate as jest.Mock)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(expectedContent);

      await generateWithRetry(
        mockGenerator,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      // Verify context passed to both attempts
      expect(mockGenerator.generate).toHaveBeenNthCalledWith(1, mockContext);
      expect(mockGenerator.generate).toHaveBeenNthCalledWith(2, mockContext);
    });
  });

  describe('Scenario 3: Preferred auth error → alternate succeeds', () => {
    it('should retry with alternate provider on AuthenticationError', async () => {
      const authError = new AuthenticationError('Invalid API key', 'openai');

      const expectedContent: GeneratedContent = {
        text: 'Success from alternate',
        outputMode: 'text',
      };

      (mockGenerator.generate as jest.Mock)
        .mockRejectedValueOnce(authError)
        .mockResolvedValueOnce(expectedContent);

      const result = await generateWithRetry(
        mockGenerator,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result).toEqual(expectedContent);
      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scenario 4: Preferred fails with non-retryable error → throw immediately', () => {
    it('should throw InvalidRequestError immediately without retry', async () => {
      const invalidRequestError = new InvalidRequestError('Invalid parameters', 'openai');

      (mockGenerator.generate as jest.Mock).mockRejectedValue(invalidRequestError);

      await expect(
        generateWithRetry(mockGenerator, mockContext, mockPreferredProvider, mockAlternateProvider)
      ).rejects.toThrow(InvalidRequestError);

      // Should only be called once (no retry)
      expect(mockGenerator.generate).toHaveBeenCalledTimes(1);
    });

    it('should throw generic Error immediately without retry', async () => {
      const genericError = new Error('Something went wrong');

      (mockGenerator.generate as jest.Mock).mockRejectedValue(genericError);

      await expect(
        generateWithRetry(mockGenerator, mockContext, mockPreferredProvider, mockAlternateProvider)
      ).rejects.toThrow('Something went wrong');

      expect(mockGenerator.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 5: Both fail with retryable errors → throw last error', () => {
    it('should throw alternate error when both providers rate limited', async () => {
      const preferredError = new RateLimitError('Preferred rate limit exceeded', 'openai');

      const alternateError = new RateLimitError('Alternate rate limit exceeded', 'anthropic');

      (mockGenerator.generate as jest.Mock)
        .mockRejectedValueOnce(preferredError)
        .mockRejectedValueOnce(alternateError);

      await expect(
        generateWithRetry(mockGenerator, mockContext, mockPreferredProvider, mockAlternateProvider)
      ).rejects.toThrow('Alternate rate limit exceeded');

      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
    });

    it('should throw alternate error when both providers have auth errors', async () => {
      const preferredError = new AuthenticationError('Preferred auth failed', 'openai');

      const alternateError = new AuthenticationError('Alternate auth failed', 'anthropic');

      (mockGenerator.generate as jest.Mock)
        .mockRejectedValueOnce(preferredError)
        .mockRejectedValueOnce(alternateError);

      await expect(
        generateWithRetry(mockGenerator, mockContext, mockPreferredProvider, mockAlternateProvider)
      ).rejects.toThrow('Alternate auth failed');

      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scenario 6: Different retryable errors', () => {
    it('should throw alternate error when preferred has rate limit, alternate has auth error', async () => {
      const preferredError = new RateLimitError('Preferred rate limit exceeded', 'openai');

      const alternateError = new AuthenticationError('Alternate auth failed', 'anthropic');

      (mockGenerator.generate as jest.Mock)
        .mockRejectedValueOnce(preferredError)
        .mockRejectedValueOnce(alternateError);

      await expect(
        generateWithRetry(mockGenerator, mockContext, mockPreferredProvider, mockAlternateProvider)
      ).rejects.toThrow('Alternate auth failed');

      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
    });

    it('should throw alternate error when preferred has auth error, alternate has rate limit', async () => {
      const preferredError = new AuthenticationError('Preferred auth failed', 'openai');

      const alternateError = new RateLimitError('Alternate rate limit exceeded', 'anthropic');

      (mockGenerator.generate as jest.Mock)
        .mockRejectedValueOnce(preferredError)
        .mockRejectedValueOnce(alternateError);

      await expect(
        generateWithRetry(mockGenerator, mockContext, mockPreferredProvider, mockAlternateProvider)
      ).rejects.toThrow('Alternate rate limit exceeded');

      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle null/undefined context gracefully', async () => {
      const expectedContent: GeneratedContent = {
        text: 'Success',
        outputMode: 'text',
      };

      (mockGenerator.generate as jest.Mock).mockResolvedValue(expectedContent);

      const result = await generateWithRetry(
        mockGenerator,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result).toEqual(expectedContent);
    });

    it('should preserve error details when rethrowing', async () => {
      const preferredError = new RateLimitError(
        'Preferred rate limit exceeded',
        'openai',
        undefined,
        429
      );

      const alternateError = new RateLimitError(
        'Alternate rate limit exceeded',
        'anthropic',
        undefined,
        429
      );

      (mockGenerator.generate as jest.Mock)
        .mockRejectedValueOnce(preferredError)
        .mockRejectedValueOnce(alternateError);

      try {
        await generateWithRetry(
          mockGenerator,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        );
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).provider).toBe('anthropic');
        expect((error as RateLimitError).statusCode).toBe(429);
      }
    });
  });
});
