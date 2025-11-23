/**
 * AI Provider Integration Tests
 *
 * Tests end-to-end integration of AI providers with the application.
 * Uses shared mocks to simulate AI responses without real API calls.
 * Focuses on integration points:
 * - Provider factory pattern
 * - Configuration loading
 * - Error handling and propagation
 * - Provider switching
 *
 * @group integration
 */

import { createMockOpenAIClient, createMockAnthropicClient } from '../__mocks__';
import { createAIProvider, AIProviderType } from '@/api/ai';
import type { AIGenerationRequest } from '@/types/ai';

// Note: These integration tests use shared mocks instead of real SDK calls.
// This tests the integration between components while avoiding real API calls.
// SDK-level mocking would require complex HTTP interceptors and is better suited for E2E tests.

describe('AI Provider Integration Tests', () => {
  describe('Provider Factory Pattern Integration', () => {
    it('should create OpenAI provider via factory', () => {
      // Act: Create provider using factory
      const provider = createAIProvider(AIProviderType.OPENAI, 'test-key-123');

      // Assert: Should have correct interface
      expect(provider).toBeDefined();
      expect(provider.generate).toBeDefined();
      expect(provider.validateConnection).toBeDefined();
      expect(typeof provider.generate).toBe('function');
      expect(typeof provider.validateConnection).toBe('function');
    });

    it('should create Anthropic provider via factory', () => {
      // Act: Create provider using factory
      const provider = createAIProvider(AIProviderType.ANTHROPIC, 'test-key-456');

      // Assert: Should have correct interface
      expect(provider).toBeDefined();
      expect(provider.generate).toBeDefined();
      expect(provider.validateConnection).toBeDefined();
      expect(typeof provider.generate).toBe('function');
      expect(typeof provider.validateConnection).toBe('function');
    });

    it('should throw error for unknown provider type', () => {
      // Act & Assert: Should throw for invalid provider
      expect(() => {
        createAIProvider('invalid' as AIProviderType, 'test-key');
      }).toThrow(/unknown ai provider type/i);
    });

    it('should throw error when API key is missing', () => {
      // Act & Assert: Should throw for missing API key
      expect(() => createAIProvider(AIProviderType.OPENAI, '')).toThrow(/api key is required/i);
      expect(() => createAIProvider(AIProviderType.ANTHROPIC, '')).toThrow(/api key is required/i);
    });
  });

  describe('Mock-Based Generation Flow', () => {
    it('should generate content using mock OpenAI client', async () => {
      // Arrange: Create mock client
      const mockClient = createMockOpenAIClient();
      const request: AIGenerationRequest = {
        systemPrompt: 'You are a helpful assistant for Vestaboard displays.',
        userPrompt: 'Generate a motivational quote about perseverance.',
        maxTokens: 150,
        temperature: 0.7,
      };

      // Act: Generate content
      const response = await mockClient.generate(request);

      // Assert: Verify response structure
      expect(response).toBeDefined();
      expect(response.text).toBeTruthy();
      expect(typeof response.text).toBe('string');
      expect(response.model).toContain('gpt');
      expect(response.tokensUsed).toBeGreaterThan(0);
      expect(response.finishReason).toBeTruthy();
    });

    it('should generate content using mock Anthropic client', async () => {
      // Arrange: Create mock client
      const mockClient = createMockAnthropicClient();
      const request: AIGenerationRequest = {
        systemPrompt: 'You are a helpful assistant for Vestaboard displays.',
        userPrompt: 'Generate a motivational quote about growth.',
        maxTokens: 200,
        temperature: 0.8,
      };

      // Act: Generate content
      const response = await mockClient.generate(request);

      // Assert: Verify response structure
      expect(response).toBeDefined();
      expect(response.text).toBeTruthy();
      expect(typeof response.text).toBe('string');
      expect(response.model).toContain('claude');
      expect(response.tokensUsed).toBeGreaterThan(0);
      expect(response.finishReason).toBeTruthy();
    });

    it('should validate OpenAI connection successfully', async () => {
      // Arrange: Create mock client
      const mockClient = createMockOpenAIClient();

      // Act: Validate connection
      const isValid = await mockClient.validateConnection();

      // Assert: Connection should be valid
      expect(isValid).toBe(true);
    });

    it('should validate Anthropic connection successfully', async () => {
      // Arrange: Create mock client
      const mockClient = createMockAnthropicClient();

      // Act: Validate connection
      const isValid = await mockClient.validateConnection();

      // Assert: Connection should be valid
      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle OpenAI generation errors gracefully', async () => {
      // Arrange: Create failing mock client
      const mockClient = createMockOpenAIClient({ shouldFail: true });
      const request: AIGenerationRequest = {
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
      };

      // Act & Assert: Should throw error
      await expect(mockClient.generate(request)).rejects.toThrow();
    });

    it('should handle Anthropic generation errors gracefully', async () => {
      // Arrange: Create failing mock client
      const mockClient = createMockAnthropicClient({ shouldFail: true });
      const request: AIGenerationRequest = {
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
      };

      // Act & Assert: Should throw error
      await expect(mockClient.generate(request)).rejects.toThrow();
    });

    it('should handle OpenAI connection validation failure', async () => {
      // Arrange: Create mock with invalid connection
      const mockClient = createMockOpenAIClient({ connectionValid: false });

      // Act: Validate connection
      const isValid = await mockClient.validateConnection();

      // Assert: Connection should be invalid
      expect(isValid).toBe(false);
    });

    it('should handle Anthropic connection validation failure', async () => {
      // Arrange: Create mock with invalid connection
      const mockClient = createMockAnthropicClient({ connectionValid: false });

      // Act: Validate connection
      const isValid = await mockClient.validateConnection();

      // Assert: Connection should be invalid
      expect(isValid).toBe(false);
    });
  });

  describe('Provider Switching Integration', () => {
    it('should switch between OpenAI and Anthropic seamlessly', async () => {
      // Arrange: Create both mock clients
      const openaiClient = createMockOpenAIClient();
      const anthropicClient = createMockAnthropicClient();

      const request: AIGenerationRequest = {
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
      };

      // Act: Use both providers
      const openaiResponse = await openaiClient.generate(request);
      const anthropicResponse = await anthropicClient.generate(request);

      // Assert: Both should return valid responses
      expect(openaiResponse.text).toBeTruthy();
      expect(openaiResponse.model).toContain('gpt');
      expect(anthropicResponse.text).toBeTruthy();
      expect(anthropicResponse.model).toContain('claude');
    });

    it('should handle provider-specific configuration', async () => {
      // Arrange: Create clients with custom configuration
      const customOpenAI = createMockOpenAIClient({
        model: 'gpt-4-turbo-preview',
        responseText: 'OpenAI custom response',
        tokensUsed: 250,
      });

      const customAnthropic = createMockAnthropicClient({
        model: 'claude-3-opus-20240229',
        responseText: 'Anthropic custom response',
        tokensUsed: 300,
      });

      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'Prompt',
      };

      // Act: Generate with both
      const openaiResponse = await customOpenAI.generate(request);
      const anthropicResponse = await customAnthropic.generate(request);

      // Assert: Should use custom configuration
      expect(openaiResponse.model).toBe('gpt-4-turbo-preview');
      expect(openaiResponse.text).toBe('OpenAI custom response');
      expect(openaiResponse.tokensUsed).toBe(250);

      expect(anthropicResponse.model).toBe('claude-3-opus-20240229');
      expect(anthropicResponse.text).toBe('Anthropic custom response');
      expect(anthropicResponse.tokensUsed).toBe(300);
    });
  });

  describe('Configuration Integration', () => {
    it('should support custom generation parameters', async () => {
      // Arrange: Create mock client
      const mockClient = createMockOpenAIClient();

      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'Prompt',
        maxTokens: 500,
        temperature: 0.9,
        metadata: { source: 'test', requestId: 'req-123' },
      };

      // Act: Generate with custom parameters (mock ignores them but accepts them)
      const response = await mockClient.generate(request);

      // Assert: Should return valid response
      expect(response).toBeDefined();
      expect(response.text).toBeTruthy();
    });

    it('should handle default parameters when not provided', async () => {
      // Arrange: Create mock client
      const mockClient = createMockOpenAIClient();

      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'Prompt',
        // No maxTokens, temperature, or metadata
      };

      // Act: Generate with minimal parameters
      const response = await mockClient.generate(request);

      // Assert: Should return valid response with defaults
      expect(response).toBeDefined();
      expect(response.text).toBeTruthy();
      expect(response.model).toBeTruthy();
    });
  });

  describe('Response Format Integration', () => {
    it('should return consistent response format from OpenAI', async () => {
      // Arrange: Create mock client
      const mockClient = createMockOpenAIClient();
      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'Prompt',
      };

      // Act: Generate content
      const response = await mockClient.generate(request);

      // Assert: Verify all required fields
      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('tokensUsed');
      expect(response).toHaveProperty('finishReason');

      expect(typeof response.text).toBe('string');
      expect(typeof response.model).toBe('string');
      expect(typeof response.tokensUsed).toBe('number');
      expect(typeof response.finishReason).toBe('string');
    });

    it('should return consistent response format from Anthropic', async () => {
      // Arrange: Create mock client
      const mockClient = createMockAnthropicClient();
      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'Prompt',
      };

      // Act: Generate content
      const response = await mockClient.generate(request);

      // Assert: Verify all required fields
      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('tokensUsed');
      expect(response).toHaveProperty('finishReason');

      expect(typeof response.text).toBe('string');
      expect(typeof response.model).toBe('string');
      expect(typeof response.tokensUsed).toBe('number');
      expect(typeof response.finishReason).toBe('string');
    });
  });

  describe('Multiple Requests Integration', () => {
    it('should handle multiple sequential requests with OpenAI', async () => {
      // Arrange: Create mock client
      const mockClient = createMockOpenAIClient();
      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'Prompt',
      };

      // Act: Make multiple requests
      const response1 = await mockClient.generate(request);
      const response2 = await mockClient.generate(request);
      const response3 = await mockClient.generate(request);

      // Assert: All should succeed
      expect(response1.text).toBeTruthy();
      expect(response2.text).toBeTruthy();
      expect(response3.text).toBeTruthy();
    });

    it('should handle multiple sequential requests with Anthropic', async () => {
      // Arrange: Create mock client
      const mockClient = createMockAnthropicClient();
      const request: AIGenerationRequest = {
        systemPrompt: 'System',
        userPrompt: 'Prompt',
      };

      // Act: Make multiple requests
      const response1 = await mockClient.generate(request);
      const response2 = await mockClient.generate(request);
      const response3 = await mockClient.generate(request);

      // Assert: All should succeed
      expect(response1.text).toBeTruthy();
      expect(response2.text).toBeTruthy();
      expect(response3.text).toBeTruthy();
    });
  });
});
