import { describe, it, expect } from '@jest/globals';
import {
  VestaboardError,
  VestaboardAuthenticationError,
  VestaboardConnectionError,
  VestaboardValidationError,
  VestaboardTimeoutError,
  VestaboardRateLimitError,
  VestaboardServerError,
} from '@/api/vestaboard/errors';

describe('Vestaboard Errors', () => {
  describe('VestaboardError', () => {
    it('should extend Error', () => {
      const error = new VestaboardError('test message');
      expect(error).toBeInstanceOf(Error);
    });

    it('should set message correctly', () => {
      const error = new VestaboardError('test message');
      expect(error.message).toBe('test message');
    });

    it('should set name to VestaboardError', () => {
      const error = new VestaboardError('test');
      expect(error.name).toBe('VestaboardError');
    });

    it('should have isRetryable as false by default', () => {
      const error = new VestaboardError('test');
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('VestaboardAuthenticationError', () => {
    it('should extend VestaboardError', () => {
      const error = new VestaboardAuthenticationError('auth failed');
      expect(error).toBeInstanceOf(VestaboardError);
    });

    it('should set name correctly', () => {
      const error = new VestaboardAuthenticationError('auth failed');
      expect(error.name).toBe('VestaboardAuthenticationError');
    });

    it('should not be retryable', () => {
      const error = new VestaboardAuthenticationError('auth failed');
      expect(error.isRetryable).toBe(false);
    });

    it('should store status code', () => {
      const error = new VestaboardAuthenticationError('auth failed', 401);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('VestaboardConnectionError', () => {
    it('should extend VestaboardError', () => {
      const error = new VestaboardConnectionError('connection failed');
      expect(error).toBeInstanceOf(VestaboardError);
    });

    it('should set name correctly', () => {
      const error = new VestaboardConnectionError('connection failed');
      expect(error.name).toBe('VestaboardConnectionError');
    });

    it('should be retryable', () => {
      const error = new VestaboardConnectionError('connection failed');
      expect(error.isRetryable).toBe(true);
    });
  });

  describe('VestaboardValidationError', () => {
    it('should extend VestaboardError', () => {
      const error = new VestaboardValidationError('invalid input');
      expect(error).toBeInstanceOf(VestaboardError);
    });

    it('should set name correctly', () => {
      const error = new VestaboardValidationError('invalid input');
      expect(error.name).toBe('VestaboardValidationError');
    });

    it('should not be retryable', () => {
      const error = new VestaboardValidationError('invalid input');
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('VestaboardTimeoutError', () => {
    it('should extend VestaboardError', () => {
      const error = new VestaboardTimeoutError('request timeout');
      expect(error).toBeInstanceOf(VestaboardError);
    });

    it('should set name correctly', () => {
      const error = new VestaboardTimeoutError('request timeout');
      expect(error.name).toBe('VestaboardTimeoutError');
    });

    it('should be retryable', () => {
      const error = new VestaboardTimeoutError('request timeout');
      expect(error.isRetryable).toBe(true);
    });
  });

  describe('VestaboardRateLimitError', () => {
    it('should extend VestaboardError', () => {
      const error = new VestaboardRateLimitError('rate limit exceeded');
      expect(error).toBeInstanceOf(VestaboardError);
    });

    it('should set name correctly', () => {
      const error = new VestaboardRateLimitError('rate limit exceeded');
      expect(error.name).toBe('VestaboardRateLimitError');
    });

    it('should be retryable', () => {
      const error = new VestaboardRateLimitError('rate limit exceeded');
      expect(error.isRetryable).toBe(true);
    });

    it('should store retryAfter value', () => {
      const error = new VestaboardRateLimitError('rate limit exceeded', 60);
      expect(error.retryAfter).toBe(60);
    });

    it('should default retryAfter to undefined', () => {
      const error = new VestaboardRateLimitError('rate limit exceeded');
      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('VestaboardServerError', () => {
    it('should extend VestaboardError', () => {
      const error = new VestaboardServerError('server error');
      expect(error).toBeInstanceOf(VestaboardError);
    });

    it('should set name correctly', () => {
      const error = new VestaboardServerError('server error');
      expect(error.name).toBe('VestaboardServerError');
    });

    it('should be retryable', () => {
      const error = new VestaboardServerError('server error');
      expect(error.isRetryable).toBe(true);
    });

    it('should store status code', () => {
      const error = new VestaboardServerError('server error', 503);
      expect(error.statusCode).toBe(503);
    });
  });
});
