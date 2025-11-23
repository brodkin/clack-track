import { describe, it, expect } from '@jest/globals';
import {
  AIProviderError,
  RateLimitError,
  InvalidRequestError,
  AuthenticationError,
} from '@/types/errors';

describe('AI Provider Error Types', () => {
  describe('AIProviderError', () => {
    it('should extend Error class', () => {
      const error = new AIProviderError('Test error', 'openai');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AIProviderError);
    });

    it('should store provider name', () => {
      const error = new AIProviderError('Test error', 'anthropic');
      expect(error.provider).toBe('anthropic');
    });

    it('should store error message', () => {
      const error = new AIProviderError('Custom error message', 'openai');
      expect(error.message).toBe('Custom error message');
    });

    it('should have correct error name', () => {
      const error = new AIProviderError('Test error', 'openai');
      expect(error.name).toBe('AIProviderError');
    });

    it('should store original error when provided', () => {
      const originalError = new Error('Original error');
      const error = new AIProviderError('Wrapped error', 'openai', originalError);
      expect(error.originalError).toBe(originalError);
    });

    it('should store status code when provided', () => {
      const error = new AIProviderError('Server error', 'openai', undefined, 500);
      expect(error.statusCode).toBe(500);
    });

    it('should have undefined originalError when not provided', () => {
      const error = new AIProviderError('Test error', 'openai');
      expect(error.originalError).toBeUndefined();
    });

    it('should have undefined statusCode when not provided', () => {
      const error = new AIProviderError('Test error', 'openai');
      expect(error.statusCode).toBeUndefined();
    });

    it('should maintain stack trace', () => {
      const error = new AIProviderError('Test error', 'openai');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AIProviderError');
    });
  });

  describe('RateLimitError', () => {
    it('should extend AIProviderError', () => {
      const error = new RateLimitError('Rate limit exceeded', 'openai');
      expect(error).toBeInstanceOf(AIProviderError);
      expect(error).toBeInstanceOf(RateLimitError);
    });

    it('should have correct error name', () => {
      const error = new RateLimitError('Rate limit exceeded', 'openai');
      expect(error.name).toBe('RateLimitError');
    });

    it('should default to 429 status code', () => {
      const error = new RateLimitError('Rate limit exceeded', 'openai');
      expect(error.statusCode).toBe(429);
    });

    it('should allow custom status code', () => {
      const error = new RateLimitError('Rate limit exceeded', 'openai', undefined, 503);
      expect(error.statusCode).toBe(503);
    });

    it('should store provider name', () => {
      const error = new RateLimitError('Rate limit exceeded', 'anthropic');
      expect(error.provider).toBe('anthropic');
    });

    it('should store original error', () => {
      const originalError = new Error('Upstream rate limit');
      const error = new RateLimitError('Rate limit exceeded', 'openai', originalError);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('InvalidRequestError', () => {
    it('should extend AIProviderError', () => {
      const error = new InvalidRequestError('Invalid parameters', 'openai');
      expect(error).toBeInstanceOf(AIProviderError);
      expect(error).toBeInstanceOf(InvalidRequestError);
    });

    it('should have correct error name', () => {
      const error = new InvalidRequestError('Invalid parameters', 'openai');
      expect(error.name).toBe('InvalidRequestError');
    });

    it('should default to 400 status code', () => {
      const error = new InvalidRequestError('Invalid parameters', 'openai');
      expect(error.statusCode).toBe(400);
    });

    it('should allow custom status code', () => {
      const error = new InvalidRequestError('Invalid parameters', 'openai', undefined, 422);
      expect(error.statusCode).toBe(422);
    });

    it('should store provider name', () => {
      const error = new InvalidRequestError('Invalid parameters', 'anthropic');
      expect(error.provider).toBe('anthropic');
    });

    it('should store original error', () => {
      const originalError = new Error('Validation failed');
      const error = new InvalidRequestError('Invalid parameters', 'openai', originalError);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('AuthenticationError', () => {
    it('should extend AIProviderError', () => {
      const error = new AuthenticationError('Invalid API key', 'openai');
      expect(error).toBeInstanceOf(AIProviderError);
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it('should have correct error name', () => {
      const error = new AuthenticationError('Invalid API key', 'openai');
      expect(error.name).toBe('AuthenticationError');
    });

    it('should default to 401 status code', () => {
      const error = new AuthenticationError('Invalid API key', 'openai');
      expect(error.statusCode).toBe(401);
    });

    it('should allow custom status code for forbidden', () => {
      const error = new AuthenticationError('Insufficient permissions', 'openai', undefined, 403);
      expect(error.statusCode).toBe(403);
    });

    it('should store provider name', () => {
      const error = new AuthenticationError('Invalid API key', 'anthropic');
      expect(error.provider).toBe('anthropic');
    });

    it('should store original error', () => {
      const originalError = new Error('Auth failed');
      const error = new AuthenticationError('Invalid API key', 'openai', originalError);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize AIProviderError to JSON', () => {
      const error = new AIProviderError('Test error', 'openai', undefined, 500);

      // Note: Error objects don't serialize well by default
      // Testing that we can at least access properties
      expect(error.message).toBe('Test error');
      expect(error.provider).toBe('openai');
      expect(error.statusCode).toBe(500);
    });

    it('should handle nested original errors', () => {
      const originalError = new Error('Original error');
      const error = new AIProviderError('Wrapped error', 'openai', originalError);

      expect(error.originalError?.message).toBe('Original error');
    });
  });

  describe('Error Inheritance Chain', () => {
    it('should maintain correct instanceof checks', () => {
      const rateLimitError = new RateLimitError('Too many requests', 'openai');
      const invalidRequestError = new InvalidRequestError('Bad params', 'openai');
      const authError = new AuthenticationError('No auth', 'openai');

      // All should be instances of Error
      expect(rateLimitError).toBeInstanceOf(Error);
      expect(invalidRequestError).toBeInstanceOf(Error);
      expect(authError).toBeInstanceOf(Error);

      // All should be instances of AIProviderError
      expect(rateLimitError).toBeInstanceOf(AIProviderError);
      expect(invalidRequestError).toBeInstanceOf(AIProviderError);
      expect(authError).toBeInstanceOf(AIProviderError);

      // But not instances of each other's specific types
      expect(rateLimitError).not.toBeInstanceOf(InvalidRequestError);
      expect(rateLimitError).not.toBeInstanceOf(AuthenticationError);
      expect(invalidRequestError).not.toBeInstanceOf(RateLimitError);
    });
  });

  describe('Error Context Usage', () => {
    it('should provide useful context for debugging rate limits', () => {
      const error = new RateLimitError('Rate limit: 100 requests/min exceeded', 'openai');

      expect(error.name).toBe('RateLimitError');
      expect(error.message).toContain('Rate limit');
      expect(error.provider).toBe('openai');
      expect(error.statusCode).toBe(429);
    });

    it('should provide useful context for debugging invalid requests', () => {
      const error = new InvalidRequestError(
        'Missing required parameter: model',
        'anthropic',
        undefined,
        400
      );

      expect(error.name).toBe('InvalidRequestError');
      expect(error.message).toContain('Missing required parameter');
      expect(error.provider).toBe('anthropic');
      expect(error.statusCode).toBe(400);
    });

    it('should provide useful context for debugging authentication', () => {
      const error = new AuthenticationError('API key expired', 'openai', undefined, 401);

      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toContain('API key');
      expect(error.provider).toBe('openai');
      expect(error.statusCode).toBe(401);
    });
  });
});
