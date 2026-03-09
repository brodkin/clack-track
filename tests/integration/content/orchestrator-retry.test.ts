/**
 * Tests for orchestrator retry logic with multi-attempt strategy and exponential backoff
 *
 * Test scenarios:
 * 1. Success on first attempt (preferred provider)
 * 2. Success on second attempt (preferred provider, after retry)
 * 3. Success on third attempt (alternate provider, after provider swap)
 * 4. Success on fourth attempt (alternate provider, after retry)
 * 5. All attempts exhausted → throw aggregated error
 * 6. Non-retryable error → throw immediately without retry
 * 7. Exponential backoff verification
 * 8. Error aggregation with metadata
 * 9. Generator factory enables true provider swapping
 * 10. Configurable retry parameters
 * 11. OverloadedError is retryable
 * 12. AuthenticationError is NOT retryable
 */

import { generateWithRetry } from '@/content/orchestrator-retry';
import {
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
  OverloadedError,
} from '@/types/errors';
import type { AIProvider } from '@/types/ai';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
} from '@/types/content-generator';
import type { CircuitBreakerService } from '@/services/circuit-breaker-service';

// Mock sleep function to control timing in tests
jest.mock('@/utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

import { sleep } from '@/utils/sleep';

describe('generateWithRetry', () => {
  let mockPreferredProvider: AIProvider;
  let mockAlternateProvider: AIProvider;
  let mockContext: GenerationContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock context
    mockContext = {
      updateType: 'major',
      timestamp: new Date('2025-01-15T10:00:00Z'),
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

  describe('Scenario 1: Success on first attempt (preferred provider)', () => {
    it('should return result from preferred provider on first attempt', async () => {
      const expectedContent: GeneratedContent = {
        text: 'Success from preferred attempt 1',
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(expectedContent),
        validate: jest.fn(),
      };

      const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

      const result = await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result.text).toBe(expectedContent.text);
      expect(result.outputMode).toBe(expectedContent.outputMode);
      expect(result.metadata?.failover).toBeDefined();
      expect(generatorFactory).toHaveBeenCalledTimes(1);
      expect(generatorFactory).toHaveBeenCalledWith(mockPreferredProvider);
      expect(mockGenerator.generate).toHaveBeenCalledWith(mockContext);
      expect(mockGenerator.generate).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 2: Success on second attempt (preferred provider, after retry)', () => {
    it('should retry with same provider and succeed on second attempt', async () => {
      const expectedContent: GeneratedContent = {
        text: 'Success from preferred attempt 2',
        outputMode: 'text',
      };

      const mockGenerator1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new RateLimitError('Rate limit', 'openai')),
        validate: jest.fn(),
      };

      const mockGenerator2: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(expectedContent),
        validate: jest.fn(),
      };

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(mockGenerator1)
        .mockReturnValueOnce(mockGenerator2);

      const result = await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result.text).toBe(expectedContent.text);
      expect(result.outputMode).toBe(expectedContent.outputMode);
      expect(result.metadata?.failover).toBeDefined();
      expect(generatorFactory).toHaveBeenCalledTimes(2);
      expect(generatorFactory).toHaveBeenNthCalledWith(1, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(2, mockPreferredProvider);
      expect(sleep).toHaveBeenCalledTimes(1);
      expect(sleep).toHaveBeenCalledWith(1000); // 1s backoff
    });
  });

  describe('Scenario 3: Success on third attempt (alternate provider, after swap)', () => {
    it('should swap to alternate provider and succeed on first alternate attempt', async () => {
      const expectedContent: GeneratedContent = {
        text: 'Success from alternate attempt 1',
        outputMode: 'text',
      };

      const preferredGenerator1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new RateLimitError('Rate limit 1', 'openai')),
        validate: jest.fn(),
      };

      const preferredGenerator2: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new OverloadedError('Overloaded', 'openai')),
        validate: jest.fn(),
      };

      const alternateGenerator1: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(expectedContent),
        validate: jest.fn(),
      };

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(preferredGenerator1)
        .mockReturnValueOnce(preferredGenerator2)
        .mockReturnValueOnce(alternateGenerator1);

      const result = await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result.text).toBe(expectedContent.text);
      expect(result.outputMode).toBe(expectedContent.outputMode);
      expect(result.metadata?.failover).toBeDefined();
      expect(generatorFactory).toHaveBeenCalledTimes(3);
      expect(generatorFactory).toHaveBeenNthCalledWith(1, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(2, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(3, mockAlternateProvider); // Provider swap!
      expect(sleep).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenNthCalledWith(1, 1000); // 1s backoff
      expect(sleep).toHaveBeenNthCalledWith(2, 2000); // 2s backoff
    });
  });

  describe('Scenario 4: Success on fourth attempt (alternate provider, after retry)', () => {
    it('should retry with alternate provider and succeed on second alternate attempt', async () => {
      const expectedContent: GeneratedContent = {
        text: 'Success from alternate attempt 2',
        outputMode: 'text',
      };

      const preferredGen1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new RateLimitError('Rate 1', 'openai')),
        validate: jest.fn(),
      };

      const preferredGen2: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new OverloadedError('Overload 1', 'openai')),
        validate: jest.fn(),
      };

      const alternateGen1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new RateLimitError('Rate 2', 'anthropic')),
        validate: jest.fn(),
      };

      const alternateGen2: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(expectedContent),
        validate: jest.fn(),
      };

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(preferredGen1)
        .mockReturnValueOnce(preferredGen2)
        .mockReturnValueOnce(alternateGen1)
        .mockReturnValueOnce(alternateGen2);

      const result = await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result.text).toBe(expectedContent.text);
      expect(result.outputMode).toBe(expectedContent.outputMode);
      expect(result.metadata?.failover).toBeDefined();
      expect(generatorFactory).toHaveBeenCalledTimes(4);
      expect(generatorFactory).toHaveBeenNthCalledWith(1, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(2, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(3, mockAlternateProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(4, mockAlternateProvider);
      expect(sleep).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenNthCalledWith(1, 1000); // 1s
      expect(sleep).toHaveBeenNthCalledWith(2, 2000); // 2s
      expect(sleep).toHaveBeenNthCalledWith(3, 4000); // 4s
    });
  });

  describe('Scenario 5: All attempts exhausted → throw aggregated error', () => {
    it('should throw aggregated error when all 4 attempts fail', async () => {
      const preferredGen1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new RateLimitError('Pref error 1', 'openai')),
        validate: jest.fn(),
      };

      const preferredGen2: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new OverloadedError('Pref error 2', 'openai')),
        validate: jest.fn(),
      };

      const alternateGen1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new RateLimitError('Alt error 1', 'anthropic')),
        validate: jest.fn(),
      };

      const alternateGen2: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(new OverloadedError('Alt error 2', 'anthropic')),
        validate: jest.fn(),
      };

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(preferredGen1)
        .mockReturnValueOnce(preferredGen2)
        .mockReturnValueOnce(alternateGen1)
        .mockReturnValueOnce(alternateGen2);

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        )
      ).rejects.toThrow('All retry attempts exhausted');

      expect(generatorFactory).toHaveBeenCalledTimes(4);
      expect(sleep).toHaveBeenCalledTimes(3);
    });

    it('should include all failed attempts in aggregated error', async () => {
      const error1 = new RateLimitError('Error 1', 'openai');
      const error2 = new OverloadedError('Error 2', 'openai');
      const error3 = new RateLimitError('Error 3', 'anthropic');
      const error4 = new OverloadedError('Error 4', 'anthropic');

      const generators = [error1, error2, error3, error4].map(err => ({
        generate: jest.fn().mockRejectedValue(err),
        validate: jest.fn(),
      }));

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(generators[0])
        .mockReturnValueOnce(generators[1])
        .mockReturnValueOnce(generators[2])
        .mockReturnValueOnce(generators[3]);

      try {
        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        );
        fail('Should have thrown error');
      } catch (error) {
        const retryError = error as {
          message: string;
          attempts: Array<{ provider: string; attempt: number; error: Error }>;
        };
        expect(retryError.message).toContain('All retry attempts exhausted');
        expect(retryError.attempts).toHaveLength(4);
        expect(retryError.attempts[0].provider).toBe('openai');
        expect(retryError.attempts[0].attempt).toBe(1);
        expect(retryError.attempts[0].error).toBe(error1);
        expect(retryError.attempts[1].attempt).toBe(2);
        expect(retryError.attempts[2].provider).toBe('anthropic');
        expect(retryError.attempts[2].attempt).toBe(1);
        expect(retryError.attempts[3].attempt).toBe(2);
      }
    });
  });

  describe('Scenario 6: Non-retryable error → throw immediately', () => {
    it('should throw InvalidRequestError immediately without retry', async () => {
      const invalidError = new InvalidRequestError('Invalid params', 'openai');

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(invalidError),
        validate: jest.fn(),
      };

      const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        )
      ).rejects.toThrow('Invalid params');

      expect(generatorFactory).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('should throw generic Error immediately without retry', async () => {
      const genericError = new Error('Unexpected error');

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(genericError),
        validate: jest.fn(),
      };

      const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        )
      ).rejects.toThrow('Unexpected error');

      expect(generatorFactory).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('should NOT retry AuthenticationError (not retryable)', async () => {
      const authError = new AuthenticationError('Invalid API key', 'openai');

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(authError),
        validate: jest.fn(),
      };

      const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        )
      ).rejects.toThrow('Invalid API key');

      expect(generatorFactory).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 7: Exponential backoff verification', () => {
    it('should apply exponential backoff: 1s, 2s, 4s', async () => {
      const generators = [1, 2, 3, 4].map(() => ({
        generate: jest.fn().mockRejectedValue(new RateLimitError('Rate limit', 'provider')),
        validate: jest.fn(),
      }));

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(generators[0])
        .mockReturnValueOnce(generators[1])
        .mockReturnValueOnce(generators[2])
        .mockReturnValueOnce(generators[3]);

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        )
      ).rejects.toThrow();

      expect(sleep).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenNthCalledWith(1, 1000); // 1000ms × 2^0 = 1s
      expect(sleep).toHaveBeenNthCalledWith(2, 2000); // 1000ms × 2^1 = 2s
      expect(sleep).toHaveBeenNthCalledWith(3, 4000); // 1000ms × 2^2 = 4s
    });

    it('should use custom backoff configuration', async () => {
      const generators = [1, 2, 3].map(() => ({
        generate: jest.fn().mockRejectedValue(new RateLimitError('Rate limit', 'provider')),
        validate: jest.fn(),
      }));

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(generators[0])
        .mockReturnValueOnce(generators[1])
        .mockReturnValueOnce(generators[2]);

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {
            attemptsPerProvider: 1, // Only 1 attempt per provider
            backoffBaseMs: 500, // 500ms base
            backoffMultiplier: 3, // 3x multiplier
          }
        )
      ).rejects.toThrow();

      expect(generatorFactory).toHaveBeenCalledTimes(2); // 1 per provider
      expect(sleep).toHaveBeenCalledTimes(1);
      expect(sleep).toHaveBeenNthCalledWith(1, 500); // 500ms × 3^0 = 500ms
    });
  });

  describe('Scenario 8: Error aggregation with metadata', () => {
    it('should collect timestamp for each failed attempt', async () => {
      const generators = [1, 2, 3, 4].map(() => ({
        generate: jest.fn().mockRejectedValue(new RateLimitError('Error', 'provider')),
        validate: jest.fn(),
      }));

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(generators[0])
        .mockReturnValueOnce(generators[1])
        .mockReturnValueOnce(generators[2])
        .mockReturnValueOnce(generators[3]);

      const beforeTime = new Date();

      try {
        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        );
        fail('Should have thrown');
      } catch (error) {
        const afterTime = new Date();
        const retryError = error as {
          attempts: Array<{ timestamp: Date }>;
        };
        expect(retryError.attempts).toHaveLength(4);
        retryError.attempts.forEach(attempt => {
          expect(attempt.timestamp).toBeInstanceOf(Date);
          expect(attempt.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
          expect(attempt.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });
      }
    });

    it('should include provider names in error aggregation', async () => {
      const error1 = new RateLimitError('Error 1', 'openai');
      const error2 = new RateLimitError('Error 2', 'anthropic');

      const gen1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(error1),
        validate: jest.fn(),
      };

      const gen2: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(error1),
        validate: jest.fn(),
      };

      const gen3: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(error2),
        validate: jest.fn(),
      };

      const gen4: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(error2),
        validate: jest.fn(),
      };

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(gen1)
        .mockReturnValueOnce(gen2)
        .mockReturnValueOnce(gen3)
        .mockReturnValueOnce(gen4);

      try {
        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        );
        fail('Should have thrown');
      } catch (error) {
        const retryError = error as {
          attempts: Array<{ provider: string }>;
        };
        expect(retryError.attempts[0].provider).toBe('openai');
        expect(retryError.attempts[1].provider).toBe('openai');
        expect(retryError.attempts[2].provider).toBe('anthropic');
        expect(retryError.attempts[3].provider).toBe('anthropic');
      }
    });
  });

  describe('Scenario 9: Generator factory enables true provider swapping', () => {
    it('should call factory with preferred provider for first 2 attempts', async () => {
      const generators = [1, 2, 3, 4].map(() => ({
        generate: jest.fn().mockRejectedValue(new RateLimitError('Error', 'provider')),
        validate: jest.fn(),
      }));

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(generators[0])
        .mockReturnValueOnce(generators[1])
        .mockReturnValueOnce(generators[2])
        .mockReturnValueOnce(generators[3]);

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        )
      ).rejects.toThrow();

      expect(generatorFactory).toHaveBeenNthCalledWith(1, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(2, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(3, mockAlternateProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(4, mockAlternateProvider);
    });

    it('should create new generator instance for each attempt', async () => {
      const generators = [1, 2, 3].map(() => ({
        generate: jest.fn().mockRejectedValue(new OverloadedError('Error', 'provider')),
        validate: jest.fn(),
      }));

      const finalGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue({ text: 'Success', outputMode: 'text' }),
        validate: jest.fn(),
      };

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(generators[0])
        .mockReturnValueOnce(generators[1])
        .mockReturnValueOnce(generators[2])
        .mockReturnValueOnce(finalGenerator);

      await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      // Each generator instance should be called exactly once
      expect(generators[0].generate).toHaveBeenCalledTimes(1);
      expect(generators[1].generate).toHaveBeenCalledTimes(1);
      expect(generators[2].generate).toHaveBeenCalledTimes(1);
      expect(finalGenerator.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 10: Configurable retry parameters', () => {
    it('should respect custom attemptsPerProvider', async () => {
      const generators = Array(6)
        .fill(null)
        .map(() => ({
          generate: jest.fn().mockRejectedValue(new RateLimitError('Error', 'provider')),
          validate: jest.fn(),
        }));

      const generatorFactory = jest.fn();
      generators.forEach(gen => generatorFactory.mockReturnValueOnce(gen));

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {
            attemptsPerProvider: 3, // 3 attempts per provider = 6 total
          }
        )
      ).rejects.toThrow();

      expect(generatorFactory).toHaveBeenCalledTimes(6);
      expect(generatorFactory).toHaveBeenNthCalledWith(1, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(2, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(3, mockPreferredProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(4, mockAlternateProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(5, mockAlternateProvider);
      expect(generatorFactory).toHaveBeenNthCalledWith(6, mockAlternateProvider);
    });

    it('should use default values when config not provided', async () => {
      const generators = [1, 2, 3, 4].map(() => ({
        generate: jest.fn().mockRejectedValue(new RateLimitError('Error', 'provider')),
        validate: jest.fn(),
      }));

      const generatorFactory = jest.fn();
      generators.forEach(gen => generatorFactory.mockReturnValueOnce(gen));

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
          // No config provided - should use defaults
        )
      ).rejects.toThrow();

      expect(generatorFactory).toHaveBeenCalledTimes(4); // Default: 2 per provider
      expect(sleep).toHaveBeenNthCalledWith(1, 1000); // Default: 1000ms base
      expect(sleep).toHaveBeenNthCalledWith(2, 2000); // Default: 2x multiplier
      expect(sleep).toHaveBeenNthCalledWith(3, 4000);
    });
  });

  describe('Scenario 11: OverloadedError is retryable', () => {
    it('should include multiple provider names in RetryExhaustedError message', async () => {
      const generators = [1, 2, 3, 4].map(() => ({
        generate: jest.fn().mockRejectedValue(new RateLimitError('Error', 'provider')),
        validate: jest.fn(),
      }));

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(generators[0])
        .mockReturnValueOnce(generators[1])
        .mockReturnValueOnce(generators[2])
        .mockReturnValueOnce(generators[3]);

      try {
        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        );
        fail('Should have thrown');
      } catch (error) {
        const retryError = error as Error;
        expect(retryError.message).toContain('All retry attempts exhausted');
        expect(retryError.message).toContain('4 attempts');
        expect(retryError.name).toBe('RetryExhaustedError');
      }
    });
  });

  describe('Scenario 11: OverloadedError is retryable', () => {
    it('should retry on OverloadedError', async () => {
      const overloadedError = new OverloadedError('Service overloaded', 'openai');

      const gen1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(overloadedError),
        validate: jest.fn(),
      };

      const gen2: ContentGenerator = {
        generate: jest.fn().mockResolvedValue({ text: 'Success', outputMode: 'text' }),
        validate: jest.fn(),
      };

      const generatorFactory = jest.fn().mockReturnValueOnce(gen1).mockReturnValueOnce(gen2);

      const result = await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result.text).toBe('Success');
      expect(generatorFactory).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('should include OverloadedError in retryable error check', async () => {
      const errors = [
        new RateLimitError('Rate limit', 'openai'),
        new OverloadedError('Overloaded', 'openai'),
        new RateLimitError('Rate limit', 'anthropic'),
        new OverloadedError('Overloaded', 'anthropic'),
      ];

      const generators = errors.map(err => ({
        generate: jest.fn().mockRejectedValue(err),
        validate: jest.fn(),
      }));

      const generatorFactory = jest.fn();
      generators.forEach(gen => generatorFactory.mockReturnValueOnce(gen));

      await expect(
        generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        )
      ).rejects.toThrow('All retry attempts exhausted');

      // All 4 retryable errors should have been attempted
      expect(generatorFactory).toHaveBeenCalledTimes(4);
    });
  });

  describe('Scenario 12: Failover metadata tracking', () => {
    it('should include failover metadata on first attempt success', async () => {
      const expectedContent: GeneratedContent = {
        text: 'Success on first try',
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(expectedContent),
        validate: jest.fn(),
      };

      const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

      const result = await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result.metadata?.failover).toBeDefined();
      expect(result.metadata?.failover?.totalAttempts).toBe(1);
      expect(result.metadata?.failover?.preferredAttempts).toBe(1);
      expect(result.metadata?.failover?.alternateAttempts).toBe(0);
      expect(result.metadata?.failover?.failedOver).toBe(false);
      expect(result.metadata?.failover?.primaryProvider).toBe('openai');
      expect(result.metadata?.failover?.finalProvider).toBe('openai');
      expect(result.metadata?.failover?.errors).toEqual([]);
      expect(result.metadata?.failover?.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should track failed attempts in metadata', async () => {
      const error1 = new RateLimitError('Rate limit 1', 'openai');
      const expectedContent: GeneratedContent = {
        text: 'Success on retry',
        outputMode: 'text',
      };

      const gen1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(error1),
        validate: jest.fn(),
      };

      const gen2: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(expectedContent),
        validate: jest.fn(),
      };

      const generatorFactory = jest.fn().mockReturnValueOnce(gen1).mockReturnValueOnce(gen2);

      const result = await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result.metadata?.failover).toBeDefined();
      expect(result.metadata?.failover?.totalAttempts).toBe(2);
      expect(result.metadata?.failover?.preferredAttempts).toBe(2);
      expect(result.metadata?.failover?.alternateAttempts).toBe(0);
      expect(result.metadata?.failover?.failedOver).toBe(false);
      expect(result.metadata?.failover?.errors).toHaveLength(1);
      expect(result.metadata?.failover?.errors[0]).toEqual({
        provider: 'openai',
        attempt: 1,
        error: 'Rate limit 1',
      });
    });

    it('should track failover to alternate provider', async () => {
      const error1 = new RateLimitError('Rate limit 1', 'openai');
      const error2 = new RateLimitError('Rate limit 2', 'openai');
      const expectedContent: GeneratedContent = {
        text: 'Success on alternate',
        outputMode: 'text',
      };

      const gen1: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(error1),
        validate: jest.fn(),
      };

      const gen2: ContentGenerator = {
        generate: jest.fn().mockRejectedValue(error2),
        validate: jest.fn(),
      };

      const gen3: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(expectedContent),
        validate: jest.fn(),
      };

      const generatorFactory = jest
        .fn()
        .mockReturnValueOnce(gen1)
        .mockReturnValueOnce(gen2)
        .mockReturnValueOnce(gen3);

      const result = await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );

      expect(result.metadata?.failover).toBeDefined();
      expect(result.metadata?.failover?.totalAttempts).toBe(3);
      expect(result.metadata?.failover?.preferredAttempts).toBe(2);
      expect(result.metadata?.failover?.alternateAttempts).toBe(1);
      expect(result.metadata?.failover?.failedOver).toBe(true);
      expect(result.metadata?.failover?.primaryProvider).toBe('openai');
      expect(result.metadata?.failover?.finalProvider).toBe('anthropic');
      expect(result.metadata?.failover?.errors).toHaveLength(2);
      expect(result.metadata?.failover?.errors[0]).toEqual({
        provider: 'openai',
        attempt: 1,
        error: 'Rate limit 1',
      });
      expect(result.metadata?.failover?.errors[1]).toEqual({
        provider: 'openai',
        attempt: 2,
        error: 'Rate limit 2',
      });
    });

    it('should track total duration in metadata', async () => {
      const expectedContent: GeneratedContent = {
        text: 'Success',
        outputMode: 'text',
      };

      const mockGenerator: ContentGenerator = {
        generate: jest.fn().mockResolvedValue(expectedContent),
        validate: jest.fn(),
      };

      const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

      const startTime = Date.now();
      const result = await generateWithRetry(
        generatorFactory,
        mockContext,
        mockPreferredProvider,
        mockAlternateProvider
      );
      const endTime = Date.now();

      expect(result.metadata?.failover?.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.failover?.totalDurationMs).toBeLessThanOrEqual(
        endTime - startTime + 100
      );
    });

    it('should include all errors when all attempts fail', async () => {
      const error1 = new RateLimitError('Error 1', 'openai');
      const error2 = new RateLimitError('Error 2', 'openai');
      const error3 = new RateLimitError('Error 3', 'anthropic');
      const error4 = new RateLimitError('Error 4', 'anthropic');

      const generators = [error1, error2, error3, error4].map(err => ({
        generate: jest.fn().mockRejectedValue(err),
        validate: jest.fn(),
      }));

      const generatorFactory = jest.fn();
      generators.forEach(gen => generatorFactory.mockReturnValueOnce(gen));

      try {
        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        );
        fail('Should have thrown');
      } catch (error) {
        const retryError = error as {
          attempts: Array<{ provider: string; attempt: number; error: Error }>;
        };
        expect(retryError.attempts).toHaveLength(4);
        // Verify all errors are captured in RetryExhaustedError
        expect(retryError.attempts[0].error.message).toBe('Error 1');
        expect(retryError.attempts[1].error.message).toBe('Error 2');
        expect(retryError.attempts[2].error.message).toBe('Error 3');
        expect(retryError.attempts[3].error.message).toBe('Error 4');
      }
    });
  });

  describe('Circuit Breaker Integration', () => {
    let mockCircuitBreaker: jest.Mocked<CircuitBreakerService>;

    beforeEach(() => {
      mockCircuitBreaker = {
        recordProviderFailure: jest.fn().mockResolvedValue(undefined),
        recordProviderSuccess: jest.fn().mockResolvedValue(undefined),
        isProviderAvailable: jest.fn().mockResolvedValue(true),
        getProviderStatus: jest.fn().mockResolvedValue({
          circuitId: 'PROVIDER_OPENAI',
          state: 'on',
          failureCount: 0,
          successCount: 0,
          failureThreshold: 5,
          lastFailureAt: null,
          lastSuccessAt: null,
          stateChangedAt: null,
          canAttempt: true,
          resetTimeoutMs: 300000,
        }),
        initialize: jest.fn().mockResolvedValue(undefined),
        isCircuitOpen: jest.fn().mockResolvedValue(false),
        setCircuitState: jest.fn().mockResolvedValue(undefined),
        getCircuitStatus: jest.fn().mockResolvedValue(null),
        getAllCircuits: jest.fn().mockResolvedValue([]),
        getCircuitsByType: jest.fn().mockResolvedValue([]),
        resetProviderCircuit: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<CircuitBreakerService>;
    });

    describe('backward compatibility', () => {
      it('should work without circuitBreaker parameter (backward compatible)', async () => {
        const expectedContent: GeneratedContent = {
          text: 'Success without circuit breaker',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        // No circuitBreaker passed - should work fine
        const result = await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
        );

        expect(result.text).toBe(expectedContent.text);
        expect(generatorFactory).toHaveBeenCalledTimes(1);
      });

      it('should not call circuit breaker methods when not provided', async () => {
        const error = new RateLimitError('Rate limited', 'openai');
        const expectedContent: GeneratedContent = {
          text: 'Success on retry',
          outputMode: 'text',
        };

        const gen1: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error),
          validate: jest.fn(),
        };

        const gen2: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValueOnce(gen1).mockReturnValueOnce(gen2);

        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider
          // No circuitBreaker
        );

        // Circuit breaker methods should not be called
        expect(mockCircuitBreaker.recordProviderFailure).not.toHaveBeenCalled();
        expect(mockCircuitBreaker.recordProviderSuccess).not.toHaveBeenCalled();
      });
    });

    describe('recordProviderFailure on retryable errors', () => {
      it('should call recordProviderFailure on RateLimitError', async () => {
        const error = new RateLimitError('Rate limited', 'openai');
        const expectedContent: GeneratedContent = {
          text: 'Success on retry',
          outputMode: 'text',
        };

        const gen1: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error),
          validate: jest.fn(),
        };

        const gen2: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValueOnce(gen1).mockReturnValueOnce(gen2);

        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(mockCircuitBreaker.recordProviderFailure).toHaveBeenCalledTimes(1);
        expect(mockCircuitBreaker.recordProviderFailure).toHaveBeenCalledWith(
          'PROVIDER_OPENAI',
          error
        );
      });

      it('should call recordProviderFailure on OverloadedError', async () => {
        const error = new OverloadedError('Service overloaded', 'anthropic');
        const expectedContent: GeneratedContent = {
          text: 'Success',
          outputMode: 'text',
        };

        const gen1: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error),
          validate: jest.fn(),
        };

        const gen2: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        // Set up provider with getName to return 'anthropic'
        const anthropicProvider: AIProvider = {
          ...mockAlternateProvider,
          getName: () => 'anthropic',
        };

        const generatorFactory = jest.fn().mockReturnValueOnce(gen1).mockReturnValueOnce(gen2);

        await generateWithRetry(
          generatorFactory,
          mockContext,
          anthropicProvider, // preferred = anthropic
          mockPreferredProvider,
          {},
          mockCircuitBreaker
        );

        expect(mockCircuitBreaker.recordProviderFailure).toHaveBeenCalledTimes(1);
        expect(mockCircuitBreaker.recordProviderFailure).toHaveBeenCalledWith(
          'PROVIDER_ANTHROPIC',
          error
        );
      });

      it('should call recordProviderFailure for each failed attempt', async () => {
        const error1 = new RateLimitError('Error 1', 'openai');
        const error2 = new OverloadedError('Error 2', 'openai');
        const error3 = new RateLimitError('Error 3', 'anthropic');

        const gen1: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error1),
          validate: jest.fn(),
        };

        const gen2: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error2),
          validate: jest.fn(),
        };

        const gen3: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error3),
          validate: jest.fn(),
        };

        const gen4: ContentGenerator = {
          generate: jest.fn().mockResolvedValue({ text: 'Success', outputMode: 'text' }),
          validate: jest.fn(),
        };

        const generatorFactory = jest
          .fn()
          .mockReturnValueOnce(gen1)
          .mockReturnValueOnce(gen2)
          .mockReturnValueOnce(gen3)
          .mockReturnValueOnce(gen4);

        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(mockCircuitBreaker.recordProviderFailure).toHaveBeenCalledTimes(3);
        expect(mockCircuitBreaker.recordProviderFailure).toHaveBeenNthCalledWith(
          1,
          'PROVIDER_OPENAI',
          error1
        );
        expect(mockCircuitBreaker.recordProviderFailure).toHaveBeenNthCalledWith(
          2,
          'PROVIDER_OPENAI',
          error2
        );
        expect(mockCircuitBreaker.recordProviderFailure).toHaveBeenNthCalledWith(
          3,
          'PROVIDER_ANTHROPIC',
          error3
        );
      });
    });

    describe('recordProviderSuccess on success', () => {
      it('should call recordProviderSuccess on successful generation', async () => {
        const expectedContent: GeneratedContent = {
          text: 'Success',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(mockCircuitBreaker.recordProviderSuccess).toHaveBeenCalledTimes(1);
        expect(mockCircuitBreaker.recordProviderSuccess).toHaveBeenCalledWith('PROVIDER_OPENAI');
      });

      it('should call recordProviderSuccess with correct provider after failover', async () => {
        const error1 = new RateLimitError('Error 1', 'openai');
        const error2 = new RateLimitError('Error 2', 'openai');
        const expectedContent: GeneratedContent = {
          text: 'Success on alternate',
          outputMode: 'text',
        };

        const gen1: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error1),
          validate: jest.fn(),
        };

        const gen2: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error2),
          validate: jest.fn(),
        };

        const gen3: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest
          .fn()
          .mockReturnValueOnce(gen1)
          .mockReturnValueOnce(gen2)
          .mockReturnValueOnce(gen3);

        await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(mockCircuitBreaker.recordProviderSuccess).toHaveBeenCalledTimes(1);
        expect(mockCircuitBreaker.recordProviderSuccess).toHaveBeenCalledWith('PROVIDER_ANTHROPIC');
      });
    });

    describe('isProviderAvailable - skip provider when circuit is OPEN', () => {
      it('should skip preferred provider when its circuit is OPEN', async () => {
        // OpenAI circuit is OPEN (unavailable)
        mockCircuitBreaker.isProviderAvailable.mockImplementation(async (circuitId: string) => {
          if (circuitId === 'PROVIDER_OPENAI') return false;
          return true;
        });

        const expectedContent: GeneratedContent = {
          text: 'Success from alternate',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        const result = await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(result.text).toBe(expectedContent.text);
        // Should skip preferred provider and go directly to alternate
        expect(generatorFactory).toHaveBeenCalledWith(mockAlternateProvider);
        // Should have checked availability
        expect(mockCircuitBreaker.isProviderAvailable).toHaveBeenCalledWith('PROVIDER_OPENAI');
      });

      it('should skip alternate provider when its circuit is OPEN', async () => {
        // First attempt fails with rate limit
        const error = new RateLimitError('Rate limited', 'openai');

        // Anthropic circuit is OPEN after first failure round
        let openaiAttempts = 0;
        mockCircuitBreaker.isProviderAvailable.mockImplementation(async (circuitId: string) => {
          if (circuitId === 'PROVIDER_OPENAI') {
            openaiAttempts++;
            return openaiAttempts <= 2; // Available for first 2 attempts
          }
          if (circuitId === 'PROVIDER_ANTHROPIC') return false; // Never available
          return true;
        });

        const gen1: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error),
          validate: jest.fn(),
        };

        const gen2: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValueOnce(gen1).mockReturnValueOnce(gen2);

        // Should exhaust attempts and throw because alternate is unavailable
        await expect(
          generateWithRetry(
            generatorFactory,
            mockContext,
            mockPreferredProvider,
            mockAlternateProvider,
            {},
            mockCircuitBreaker
          )
        ).rejects.toThrow();

        // Should have checked Anthropic availability but not used it
        expect(mockCircuitBreaker.isProviderAvailable).toHaveBeenCalledWith('PROVIDER_ANTHROPIC');
      });

      it('should handle both providers being OPEN', async () => {
        // Both circuits are OPEN (unavailable)
        mockCircuitBreaker.isProviderAvailable.mockResolvedValue(false);

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue({ text: 'Never called', outputMode: 'text' }),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        // Should throw immediately since no providers are available
        await expect(
          generateWithRetry(
            generatorFactory,
            mockContext,
            mockPreferredProvider,
            mockAlternateProvider,
            {},
            mockCircuitBreaker
          )
        ).rejects.toThrow();

        // Generator should never be called since both providers are unavailable
        expect(generatorFactory).not.toHaveBeenCalled();
      });
    });

    describe('half_open state allows one attempt', () => {
      it('should allow attempt when circuit is in half_open state', async () => {
        // Provider is in half_open - isProviderAvailable returns true
        mockCircuitBreaker.isProviderAvailable.mockResolvedValue(true);
        mockCircuitBreaker.getProviderStatus.mockResolvedValue({
          circuitId: 'PROVIDER_OPENAI',
          state: 'half_open',
          failureCount: 0,
          successCount: 0,
          failureThreshold: 5,
          lastFailureAt: null,
          lastSuccessAt: null,
          stateChangedAt: null,
          canAttempt: true,
          resetTimeoutMs: 300000,
        });

        const expectedContent: GeneratedContent = {
          text: 'Success in half_open',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        const result = await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(result.text).toBe(expectedContent.text);
        expect(mockCircuitBreaker.recordProviderSuccess).toHaveBeenCalledWith('PROVIDER_OPENAI');
      });
    });

    describe('failoverMetadata includes circuit information', () => {
      it('should include circuitTripped: false when no circuit was tripped', async () => {
        const expectedContent: GeneratedContent = {
          text: 'Success',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        mockCircuitBreaker.getProviderStatus
          .mockResolvedValueOnce({
            circuitId: 'PROVIDER_OPENAI',
            state: 'on',
            failureCount: 0,
            successCount: 0,
            failureThreshold: 5,
            lastFailureAt: null,
            lastSuccessAt: null,
            stateChangedAt: null,
            canAttempt: true,
            resetTimeoutMs: 300000,
          })
          .mockResolvedValueOnce({
            circuitId: 'PROVIDER_ANTHROPIC',
            state: 'on',
            failureCount: 0,
            successCount: 0,
            failureThreshold: 5,
            lastFailureAt: null,
            lastSuccessAt: null,
            stateChangedAt: null,
            canAttempt: true,
            resetTimeoutMs: 300000,
          });

        const result = await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(result.metadata?.failover?.circuitTripped).toBe(false);
        expect(result.metadata?.failover?.circuitStates).toEqual({
          PROVIDER_OPENAI: 'on',
          PROVIDER_ANTHROPIC: 'on',
        });
      });

      it('should include circuitTripped: true when a circuit was skipped due to OPEN state', async () => {
        // OpenAI circuit is OPEN
        mockCircuitBreaker.isProviderAvailable.mockImplementation(async (circuitId: string) => {
          if (circuitId === 'PROVIDER_OPENAI') return false;
          return true;
        });

        mockCircuitBreaker.getProviderStatus
          .mockResolvedValueOnce({
            circuitId: 'PROVIDER_OPENAI',
            state: 'off',
            failureCount: 5,
            successCount: 0,
            failureThreshold: 5,
            lastFailureAt: new Date().toISOString(),
            lastSuccessAt: null,
            stateChangedAt: new Date().toISOString(),
            canAttempt: false,
            resetTimeoutMs: 300000,
          })
          .mockResolvedValueOnce({
            circuitId: 'PROVIDER_ANTHROPIC',
            state: 'on',
            failureCount: 0,
            successCount: 0,
            failureThreshold: 5,
            lastFailureAt: null,
            lastSuccessAt: null,
            stateChangedAt: null,
            canAttempt: true,
            resetTimeoutMs: 300000,
          });

        const expectedContent: GeneratedContent = {
          text: 'Success from alternate',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        const result = await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(result.metadata?.failover?.circuitTripped).toBe(true);
        expect(result.metadata?.failover?.circuitStates).toEqual({
          PROVIDER_OPENAI: 'off',
          PROVIDER_ANTHROPIC: 'on',
        });
      });

      it('should include half_open state in circuitStates', async () => {
        mockCircuitBreaker.getProviderStatus
          .mockResolvedValueOnce({
            circuitId: 'PROVIDER_OPENAI',
            state: 'half_open',
            failureCount: 0,
            successCount: 1,
            failureThreshold: 5,
            lastFailureAt: null,
            lastSuccessAt: new Date().toISOString(),
            stateChangedAt: new Date().toISOString(),
            canAttempt: true,
            resetTimeoutMs: 300000,
          })
          .mockResolvedValueOnce({
            circuitId: 'PROVIDER_ANTHROPIC',
            state: 'on',
            failureCount: 0,
            successCount: 0,
            failureThreshold: 5,
            lastFailureAt: null,
            lastSuccessAt: null,
            stateChangedAt: null,
            canAttempt: true,
            resetTimeoutMs: 300000,
          });

        const expectedContent: GeneratedContent = {
          text: 'Success',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        const result = await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(result.metadata?.failover?.circuitStates).toEqual({
          PROVIDER_OPENAI: 'half_open',
          PROVIDER_ANTHROPIC: 'on',
        });
      });
    });

    describe('graceful degradation', () => {
      it('should proceed normally when circuit breaker check fails (fail-open)', async () => {
        // Circuit breaker throws error
        mockCircuitBreaker.isProviderAvailable.mockRejectedValue(new Error('DB connection failed'));

        const expectedContent: GeneratedContent = {
          text: 'Success despite circuit breaker error',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        // Should still work - fail-open
        const result = await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(result.text).toBe(expectedContent.text);
        expect(generatorFactory).toHaveBeenCalledTimes(1);
      });

      it('should continue when recordProviderFailure throws', async () => {
        mockCircuitBreaker.recordProviderFailure.mockRejectedValue(new Error('DB write failed'));

        const error = new RateLimitError('Rate limited', 'openai');
        const expectedContent: GeneratedContent = {
          text: 'Success on retry',
          outputMode: 'text',
        };

        const gen1: ContentGenerator = {
          generate: jest.fn().mockRejectedValue(error),
          validate: jest.fn(),
        };

        const gen2: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValueOnce(gen1).mockReturnValueOnce(gen2);

        // Should still work despite recordProviderFailure throwing
        const result = await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(result.text).toBe(expectedContent.text);
      });

      it('should continue when recordProviderSuccess throws', async () => {
        mockCircuitBreaker.recordProviderSuccess.mockRejectedValue(new Error('DB write failed'));

        const expectedContent: GeneratedContent = {
          text: 'Success',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        // Should still work despite recordProviderSuccess throwing
        const result = await generateWithRetry(
          generatorFactory,
          mockContext,
          mockPreferredProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        expect(result.text).toBe(expectedContent.text);
      });
    });

    describe('provider name to circuit ID mapping', () => {
      it('should map provider getName() to circuit ID', async () => {
        const openaiProvider: AIProvider = {
          ...mockPreferredProvider,
          getName: () => 'openai',
        };

        const anthropicProvider: AIProvider = {
          ...mockAlternateProvider,
          getName: () => 'anthropic',
        };

        const expectedContent: GeneratedContent = {
          text: 'Success',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        await generateWithRetry(
          generatorFactory,
          mockContext,
          openaiProvider,
          anthropicProvider,
          {},
          mockCircuitBreaker
        );

        expect(mockCircuitBreaker.isProviderAvailable).toHaveBeenCalledWith('PROVIDER_OPENAI');
        expect(mockCircuitBreaker.recordProviderSuccess).toHaveBeenCalledWith('PROVIDER_OPENAI');
      });

      it('should use default circuit ID when getName() is not available', async () => {
        // Provider without getName method
        const noNameProvider: AIProvider = {
          generate: jest.fn(),
          validateConnection: jest.fn(),
          // No getName method
        };

        const expectedContent: GeneratedContent = {
          text: 'Success',
          outputMode: 'text',
        };

        const mockGenerator: ContentGenerator = {
          generate: jest.fn().mockResolvedValue(expectedContent),
          validate: jest.fn(),
        };

        const generatorFactory = jest.fn().mockReturnValue(mockGenerator);

        await generateWithRetry(
          generatorFactory,
          mockContext,
          noNameProvider,
          mockAlternateProvider,
          {},
          mockCircuitBreaker
        );

        // Should default to PROVIDER_OPENAI for preferred provider
        expect(mockCircuitBreaker.isProviderAvailable).toHaveBeenCalledWith('PROVIDER_OPENAI');
        expect(mockCircuitBreaker.recordProviderSuccess).toHaveBeenCalledWith('PROVIDER_OPENAI');
      });
    });
  });
});
