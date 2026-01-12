/**
 * OpenAI Test Fixtures Validation
 *
 * This test suite validates the structure and content of OpenAI API response fixtures.
 * These fixtures are used throughout the test suite to mock OpenAI API responses.
 */

import openaiResponses from '@tests/fixtures/openai-responses.json';

describe('OpenAI Fixtures', () => {
  describe('successful chat completion response', () => {
    test('should have valid structure', () => {
      const response = openaiResponses.chatCompletion.success;

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('object', 'chat.completion');
      expect(response).toHaveProperty('created');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('choices');
      expect(response).toHaveProperty('usage');
    });

    test('should have realistic token counts', () => {
      const response = openaiResponses.chatCompletion.success;

      expect(response.usage.prompt_tokens).toBeGreaterThan(0);
      expect(response.usage.completion_tokens).toBeGreaterThan(0);
      expect(response.usage.total_tokens).toBe(
        response.usage.prompt_tokens + response.usage.completion_tokens
      );
    });

    test('should have valid choice structure', () => {
      const response = openaiResponses.chatCompletion.success;

      expect(response.choices).toHaveLength(1);
      expect(response.choices[0]).toHaveProperty('index', 0);
      expect(response.choices[0]).toHaveProperty('message');
      expect(response.choices[0]).toHaveProperty('finish_reason', 'stop');
      expect(response.choices[0].message).toHaveProperty('role', 'assistant');
      expect(response.choices[0].message).toHaveProperty('content');
      expect(response.choices[0].message.content).toBeTruthy();
    });
  });

  describe('error responses', () => {
    test('should have rate limit error (429)', () => {
      const error = openaiResponses.errors.rateLimit;

      expect(error).toHaveProperty('error');
      expect(error.error).toHaveProperty('message');
      expect(error.error).toHaveProperty('type', 'rate_limit_exceeded');
      expect(error.error).toHaveProperty('code', 'rate_limit_exceeded');
    });

    test('should have authentication error (401)', () => {
      const error = openaiResponses.errors.authentication;

      expect(error).toHaveProperty('error');
      expect(error.error).toHaveProperty('message');
      expect(error.error).toHaveProperty('type', 'invalid_request_error');
      expect(error.error).toHaveProperty('code', 'invalid_api_key');
    });

    test('should have invalid request error (400)', () => {
      const error = openaiResponses.errors.invalidRequest;

      expect(error).toHaveProperty('error');
      expect(error.error).toHaveProperty('message');
      expect(error.error).toHaveProperty('type', 'invalid_request_error');
    });
  });

  describe('model list response', () => {
    test('should have valid structure', () => {
      const response = openaiResponses.models.list;

      expect(response).toHaveProperty('object', 'list');
      expect(response).toHaveProperty('data');
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('should include GPT-4 models', () => {
      const response = openaiResponses.models.list;
      const modelIds = response.data.map((model: { id: string }) => model.id);

      // Verify GPT-4 base model exists (flexible to account for version updates)
      expect(modelIds.some(id => id.startsWith('gpt-4'))).toBe(true);

      // Verify at least one GPT-4 variant exists (handles model deprecation/updates)
      const gpt4Variants = modelIds.filter(id => id.startsWith('gpt-4'));
      expect(gpt4Variants.length).toBeGreaterThan(0);
    });

    test('should have valid model objects', () => {
      const response = openaiResponses.models.list;
      const model = response.data[0];

      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('object', 'model');
      expect(model).toHaveProperty('created');
      expect(model).toHaveProperty('owned_by');
    });
  });

  describe('content examples', () => {
    test('should have weather summary example', () => {
      const example = openaiResponses.contentExamples.weather;

      expect(example).toHaveProperty('choices');
      expect(example.choices[0].message.content).toBeTruthy();
    });

    test('should have news brief example', () => {
      const example = openaiResponses.contentExamples.news;

      expect(example).toHaveProperty('choices');
      expect(example.choices[0].message.content).toBeTruthy();
    });

    test('all content examples should fit Vestaboard constraints (132 chars)', () => {
      const examples = [
        openaiResponses.contentExamples.weather,
        openaiResponses.contentExamples.news,
      ];

      examples.forEach(example => {
        const content = example.choices[0].message.content;
        expect(content.length).toBeLessThanOrEqual(132);
      });
    });
  });
});
