/**
 * Comprehensive test suite for error handling utilities
 *
 * Tests custom error classes (AppError, ValidationError, APIError, NotFoundError),
 * error handling function, and retry logic utilities.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  AppError,
  ValidationError,
  APIError,
  NotFoundError,
  handleError,
  isRetryableError,
} from '@/utils/error-handler';

// Mock the logger module
jest.mock('@/utils/logger.js', () => ({
  error: jest.fn(),
}));

import { error as logError } from '@/utils/logger.js';

describe('AppError', () => {
  it('should create instance with message, code, and default status code', () => {
    const err = new AppError('Something went wrong', 'GENERIC_ERROR');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('Something went wrong');
    expect(err.code).toBe('GENERIC_ERROR');
    expect(err.statusCode).toBe(500); // Default
    expect(err.name).toBe('AppError');
    expect(err.metadata).toBeUndefined();
  });

  it('should create instance with custom status code', () => {
    const err = new AppError('Bad request', 'BAD_REQUEST', 400);

    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('should create instance with metadata', () => {
    const metadata = { userId: '123', action: 'login' };
    const err = new AppError('Auth failed', 'AUTH_ERROR', 401, metadata);

    expect(err.metadata).toEqual(metadata);
    expect(err.statusCode).toBe(401);
  });

  it('should preserve stack trace', () => {
    const err = new AppError('Test error', 'TEST_ERROR');

    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe('string');
  });
});

describe('ValidationError', () => {
  it('should create instance with validation-specific defaults', () => {
    const err = new ValidationError('Invalid input');

    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('Invalid input');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('ValidationError');
  });

  it('should create instance with metadata', () => {
    const metadata = { field: 'email', reason: 'invalid format' };
    const err = new ValidationError('Email validation failed', metadata);

    expect(err.metadata).toEqual(metadata);
    expect(err.statusCode).toBe(400);
  });

  it('should include metadata without overriding defaults', () => {
    const metadata = { fields: ['name', 'email'] };
    const err = new ValidationError('Multiple validation errors', metadata);

    expect(err.metadata).toEqual(metadata);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
  });
});

describe('APIError', () => {
  it('should create instance with API-specific defaults', () => {
    const err = new APIError('API timeout', 'openai');

    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(APIError);
    expect(err.message).toBe('API timeout');
    expect(err.code).toBe('API_ERROR');
    expect(err.statusCode).toBe(502);
    expect(err.name).toBe('APIError');
  });

  it('should include provider in metadata', () => {
    const err = new APIError('Connection failed', 'anthropic');

    expect(err.metadata).toEqual({ provider: 'anthropic' });
  });

  it('should merge provider with additional metadata', () => {
    const metadata = { endpoint: '/v1/messages', retryCount: 3 };
    const err = new APIError('Rate limited', 'openai', metadata);

    expect(err.metadata).toEqual({
      ...metadata,
      provider: 'openai',
    });
    expect(err.metadata?.provider).toBe('openai');
    expect(err.metadata?.endpoint).toBe('/v1/messages');
    expect(err.metadata?.retryCount).toBe(3);
  });

  it('should override provider if already in metadata', () => {
    const metadata = { provider: 'wrong-provider', status: 429 };
    const err = new APIError('Rate limit', 'correct-provider', metadata);

    // Provider parameter should take precedence
    expect(err.metadata?.provider).toBe('correct-provider');
    expect(err.metadata?.status).toBe(429);
  });
});

describe('NotFoundError', () => {
  it('should create instance with not-found-specific defaults', () => {
    const err = new NotFoundError('User');

    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.message).toBe('User not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('NotFoundError');
  });

  it('should format message correctly for different resources', () => {
    const userErr = new NotFoundError('User');
    const contentErr = new NotFoundError('Content');
    const generatorErr = new NotFoundError('Generator');

    expect(userErr.message).toBe('User not found');
    expect(contentErr.message).toBe('Content not found');
    expect(generatorErr.message).toBe('Generator not found');
  });

  it('should not include metadata', () => {
    const err = new NotFoundError('Resource');

    expect(err.metadata).toBeUndefined();
  });
});

describe('handleError', () => {
  const mockLogError = logError as jest.MockedFunction<typeof logError>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log AppError with code and metadata', () => {
    const metadata = { userId: '123' };
    const err = new AppError('Test error', 'TEST_CODE', 500, metadata);

    handleError(err);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('[TEST_CODE] Test error', metadata);
  });

  it('should log ValidationError with code and metadata', () => {
    const metadata = { field: 'email' };
    const err = new ValidationError('Invalid email', metadata);

    handleError(err);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('[VALIDATION_ERROR] Invalid email', metadata);
  });

  it('should log APIError with code and provider metadata', () => {
    const err = new APIError('Connection timeout', 'openai', { retryCount: 2 });

    handleError(err);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('[API_ERROR] Connection timeout', {
      retryCount: 2,
      provider: 'openai',
    });
  });

  it('should log NotFoundError with code but no metadata', () => {
    const err = new NotFoundError('User');

    handleError(err);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('[NOT_FOUND] User not found', undefined);
  });

  it('should log standard Error with stack trace', () => {
    const err = new Error('Standard error');

    handleError(err);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('Unexpected error: Standard error', {
      stack: err.stack,
    });
  });

  it('should log unknown errors as-is', () => {
    const unknownErr = { custom: 'error object' };

    handleError(unknownErr);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('Unknown error occurred', unknownErr);
  });

  it('should handle null error', () => {
    handleError(null);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('Unknown error occurred', null);
  });

  it('should handle undefined error', () => {
    handleError(undefined);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('Unknown error occurred', undefined);
  });

  it('should handle string error', () => {
    handleError('String error message');

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('Unknown error occurred', 'String error message');
  });

  it('should handle number error', () => {
    handleError(42);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('Unknown error occurred', 42);
  });

  it('should log AppError without metadata correctly', () => {
    const err = new AppError('No metadata error', 'NO_META');

    handleError(err);

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith('[NO_META] No metadata error', undefined);
  });
});

describe('isRetryableError', () => {
  it('should return true for APIError', () => {
    const err = new APIError('Timeout', 'openai');

    expect(isRetryableError(err)).toBe(true);
  });

  it('should return true for APIError with metadata', () => {
    const err = new APIError('Rate limited', 'anthropic', { status: 429 });

    expect(isRetryableError(err)).toBe(true);
  });

  it('should return false for ValidationError', () => {
    const err = new ValidationError('Invalid input');

    expect(isRetryableError(err)).toBe(false);
  });

  it('should return false for NotFoundError', () => {
    const err = new NotFoundError('User');

    expect(isRetryableError(err)).toBe(false);
  });

  it('should return false for generic AppError', () => {
    const err = new AppError('Generic error', 'GENERIC', 500);

    expect(isRetryableError(err)).toBe(false);
  });

  it('should return false for standard Error', () => {
    const err = new Error('Standard error');

    expect(isRetryableError(err)).toBe(false);
  });

  it('should return false for unknown error types', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError('string error')).toBe(false);
    expect(isRetryableError(42)).toBe(false);
    expect(isRetryableError({ custom: 'error' })).toBe(false);
  });
});

describe('Error inheritance chain', () => {
  it('should maintain proper instanceof relationships for ValidationError', () => {
    const err = new ValidationError('Test');

    expect(err instanceof ValidationError).toBe(true);
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('should maintain proper instanceof relationships for APIError', () => {
    const err = new APIError('Test', 'provider');

    expect(err instanceof APIError).toBe(true);
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('should maintain proper instanceof relationships for NotFoundError', () => {
    const err = new NotFoundError('Resource');

    expect(err instanceof NotFoundError).toBe(true);
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('should differentiate between error types', () => {
    const validationErr = new ValidationError('Test');
    const apiErr = new APIError('Test', 'provider');
    const notFoundErr = new NotFoundError('Resource');

    expect(validationErr instanceof APIError).toBe(false);
    expect(validationErr instanceof NotFoundError).toBe(false);

    expect(apiErr instanceof ValidationError).toBe(false);
    expect(apiErr instanceof NotFoundError).toBe(false);

    expect(notFoundErr instanceof ValidationError).toBe(false);
    expect(notFoundErr instanceof APIError).toBe(false);
  });
});
