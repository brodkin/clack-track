/**
 * Anthropic Test Fixtures Validation
 *
 * This test suite validates the structure and content of Anthropic API response fixtures.
 * These fixtures are used throughout the test suite to mock Anthropic Claude API responses.
 */

import anthropicResponses from '@tests/fixtures/anthropic-responses.json';

describe('Anthropic Fixtures', () => {
  describe('successful message response', () => {
    test('should have valid structure', () => {
      const response = anthropicResponses.message.success;

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('type', 'message');
      expect(response).toHaveProperty('role', 'assistant');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('stop_reason');
      expect(response).toHaveProperty('usage');
    });

    test('should have realistic token counts', () => {
      const response = anthropicResponses.message.success;

      expect(response.usage.input_tokens).toBeGreaterThan(0);
      expect(response.usage.output_tokens).toBeGreaterThan(0);
    });

    test('should have valid content structure', () => {
      const response = anthropicResponses.message.success;

      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.content[0]).toHaveProperty('text');
      expect(response.content[0].text).toBeTruthy();
    });

    test('should use Claude Sonnet 4 model', () => {
      const response = anthropicResponses.message.success;

      expect(response.model).toContain('claude');
      expect(response.model).toContain('sonnet');
    });
  });

  describe('error responses', () => {
    test('should have rate limit error (429)', () => {
      const error = anthropicResponses.errors.rateLimit;

      expect(error).toHaveProperty('type', 'error');
      expect(error).toHaveProperty('error');
      expect(error.error).toHaveProperty('type', 'rate_limit_error');
      expect(error.error).toHaveProperty('message');
    });

    test('should have authentication error (401)', () => {
      const error = anthropicResponses.errors.authentication;

      expect(error).toHaveProperty('type', 'error');
      expect(error).toHaveProperty('error');
      expect(error.error).toHaveProperty('type', 'authentication_error');
      expect(error.error).toHaveProperty('message');
    });

    test('should have invalid request error (400)', () => {
      const error = anthropicResponses.errors.invalidRequest;

      expect(error).toHaveProperty('type', 'error');
      expect(error).toHaveProperty('error');
      expect(error.error).toHaveProperty('type', 'invalid_request_error');
      expect(error.error).toHaveProperty('message');
    });
  });

  describe('model validation response', () => {
    test('should have valid model information', () => {
      const response = anthropicResponses.models.validation;

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('type', 'message');
      expect(response).toHaveProperty('model');
    });
  });

  describe('content examples', () => {
    test('should have weather summary example', () => {
      const example = anthropicResponses.contentExamples.weather;

      expect(example).toHaveProperty('content');
      expect(example.content[0].text).toBeTruthy();
    });

    test('should have news brief example', () => {
      const example = anthropicResponses.contentExamples.news;

      expect(example).toHaveProperty('content');
      expect(example.content[0].text).toBeTruthy();
    });

    test('all content examples should fit Vestaboard constraints (132 chars)', () => {
      const examples = [
        anthropicResponses.contentExamples.weather,
        anthropicResponses.contentExamples.news,
      ];

      examples.forEach(example => {
        const content = example.content[0].text;
        expect(content.length).toBeLessThanOrEqual(132);
      });
    });

    test('all content examples should have consistent response structure', () => {
      const examples = [
        anthropicResponses.contentExamples.weather,
        anthropicResponses.contentExamples.news,
      ];

      examples.forEach(example => {
        expect(example).toHaveProperty('id');
        expect(example).toHaveProperty('type', 'message');
        expect(example).toHaveProperty('role', 'assistant');
        expect(example).toHaveProperty('model');
        expect(example).toHaveProperty('usage');
      });
    });
  });
});
