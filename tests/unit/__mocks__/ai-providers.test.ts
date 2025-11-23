/**
 * AI Provider Mocks Test Suite
 *
 * This test suite validates the shared AI provider mock factories.
 * These mocks are used to test AI-dependent features without making real API calls.
 */

import { createMockOpenAIClient, createMockAnthropicClient } from '@tests/__mocks__/ai-providers';
import type { AIProvider, AIGenerationRequest } from '@/types/ai.js';

describe('AI Provider Mocks', () => {
  describe('createMockOpenAIClient', () => {
    test('should create a mock client with generate method', () => {
      const mockClient = createMockOpenAIClient();

      expect(mockClient).toHaveProperty('generate');
      expect(mockClient).toHaveProperty('validateConnection');
      expect(typeof mockClient.generate).toBe('function');
      expect(typeof mockClient.validateConnection).toBe('function');
    });

    test('should return successful response by default', async () => {
      const mockClient = createMockOpenAIClient();

      const request: AIGenerationRequest = {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Generate motivational content.',
        maxTokens: 100,
        temperature: 0.7,
      };

      const response = await mockClient.generate(request);

      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('tokensUsed');
      expect(response).toHaveProperty('finishReason');
      expect(response.text).toBeTruthy();
      expect(response.model).toContain('gpt');
    });

    test('should validate connection successfully by default', async () => {
      const mockClient = createMockOpenAIClient();
      const isValid = await mockClient.validateConnection();

      expect(isValid).toBe(true);
    });

    test('should support failure mode', async () => {
      const mockClient = createMockOpenAIClient({ shouldFail: true });

      const request: AIGenerationRequest = {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Generate content.',
      };

      await expect(mockClient.generate(request)).rejects.toThrow();
    });

    test('should support custom response configuration', async () => {
      const customText = 'CUSTOM RESPONSE TEXT';
      const mockClient = createMockOpenAIClient({
        responseText: customText,
      });

      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'User',
      };

      const response = await mockClient.generate(request);
      expect(response.text).toBe(customText);
    });

    test('should support custom model configuration', async () => {
      const customModel = 'gpt-4-custom';
      const mockClient = createMockOpenAIClient({
        model: customModel,
      });

      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'User',
      };

      const response = await mockClient.generate(request);
      expect(response.model).toBe(customModel);
    });

    test('should support connection validation failure', async () => {
      const mockClient = createMockOpenAIClient({
        connectionValid: false,
      });

      const isValid = await mockClient.validateConnection();
      expect(isValid).toBe(false);
    });

    test('should conform to AIProvider interface', () => {
      const mockClient: AIProvider = createMockOpenAIClient();

      expect(mockClient).toHaveProperty('generate');
      expect(mockClient).toHaveProperty('validateConnection');
    });
  });

  describe('createMockAnthropicClient', () => {
    test('should create a mock client with generate method', () => {
      const mockClient = createMockAnthropicClient();

      expect(mockClient).toHaveProperty('generate');
      expect(mockClient).toHaveProperty('validateConnection');
      expect(typeof mockClient.generate).toBe('function');
      expect(typeof mockClient.validateConnection).toBe('function');
    });

    test('should return successful response by default', async () => {
      const mockClient = createMockAnthropicClient();

      const request: AIGenerationRequest = {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Generate motivational content.',
        maxTokens: 100,
        temperature: 0.7,
      };

      const response = await mockClient.generate(request);

      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('tokensUsed');
      expect(response).toHaveProperty('finishReason');
      expect(response.text).toBeTruthy();
      expect(response.model).toContain('claude');
    });

    test('should validate connection successfully by default', async () => {
      const mockClient = createMockAnthropicClient();
      const isValid = await mockClient.validateConnection();

      expect(isValid).toBe(true);
    });

    test('should support failure mode', async () => {
      const mockClient = createMockAnthropicClient({ shouldFail: true });

      const request: AIGenerationRequest = {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Generate content.',
      };

      await expect(mockClient.generate(request)).rejects.toThrow();
    });

    test('should support custom response configuration', async () => {
      const customText = 'ANTHROPIC CUSTOM TEXT';
      const mockClient = createMockAnthropicClient({
        responseText: customText,
      });

      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'User',
      };

      const response = await mockClient.generate(request);
      expect(response.text).toBe(customText);
    });

    test('should support custom model configuration', async () => {
      const customModel = 'claude-3-opus-20240229';
      const mockClient = createMockAnthropicClient({
        model: customModel,
      });

      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'User',
      };

      const response = await mockClient.generate(request);
      expect(response.model).toBe(customModel);
    });

    test('should support connection validation failure', async () => {
      const mockClient = createMockAnthropicClient({
        connectionValid: false,
      });

      const isValid = await mockClient.validateConnection();
      expect(isValid).toBe(false);
    });

    test('should conform to AIProvider interface', () => {
      const mockClient: AIProvider = createMockAnthropicClient();

      expect(mockClient).toHaveProperty('generate');
      expect(mockClient).toHaveProperty('validateConnection');
    });
  });

  describe('Mock Interoperability', () => {
    test('both mocks should have consistent interface', async () => {
      const openaiMock = createMockOpenAIClient();
      const anthropicMock = createMockAnthropicClient();

      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'User',
      };

      const openaiResponse = await openaiMock.generate(request);
      const anthropicResponse = await anthropicMock.generate(request);

      // Both should have same response structure
      expect(openaiResponse).toMatchObject({
        text: expect.any(String),
        model: expect.any(String),
        tokensUsed: expect.any(Number),
        finishReason: expect.any(String),
      });

      expect(anthropicResponse).toMatchObject({
        text: expect.any(String),
        model: expect.any(String),
        tokensUsed: expect.any(Number),
        finishReason: expect.any(String),
      });
    });

    test('both mocks should support AIProvider type', () => {
      const providers: AIProvider[] = [createMockOpenAIClient(), createMockAnthropicClient()];

      providers.forEach(provider => {
        expect(provider.generate).toBeDefined();
        expect(provider.validateConnection).toBeDefined();
      });
    });
  });
});
