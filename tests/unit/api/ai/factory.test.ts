import { createAIProvider, AIProviderType } from '@/api/ai/index';
import { OpenAIClient } from '@/api/ai/openai';
import { AnthropicClient } from '@/api/ai/anthropic';

describe('AI Provider Factory', () => {
  const MOCK_API_KEY = 'test-api-key-12345';

  describe('createAIProvider', () => {
    it('should throw error for invalid provider type', () => {
      // @ts-expect-error - Testing invalid type
      expect(() => createAIProvider('invalid', MOCK_API_KEY)).toThrow();
    });

    it('should pass API key to OpenAI client constructor and validate it', () => {
      // Valid key should succeed
      const provider = createAIProvider(AIProviderType.OPENAI, MOCK_API_KEY);
      expect(provider).toBeInstanceOf(OpenAIClient);

      // Empty key should fail validation in constructor
      expect(() => createAIProvider(AIProviderType.OPENAI, '')).toThrow(
        'OpenAI API key is required'
      );

      // Whitespace-only key should fail validation
      expect(() => createAIProvider(AIProviderType.OPENAI, '   ')).toThrow(
        'OpenAI API key is required'
      );
    });

    it('should pass API key to Anthropic client constructor and validate it', () => {
      // Valid key should succeed
      const provider = createAIProvider(AIProviderType.ANTHROPIC, MOCK_API_KEY);
      expect(provider).toBeInstanceOf(AnthropicClient);

      // Empty key should fail validation in constructor
      expect(() => createAIProvider(AIProviderType.ANTHROPIC, '')).toThrow(
        'Anthropic API key is required'
      );

      // Whitespace-only key should fail validation
      expect(() => createAIProvider(AIProviderType.ANTHROPIC, '   ')).toThrow(
        'Anthropic API key is required'
      );
    });

    describe('model parameter (tier-based model selection)', () => {
      it('should create OpenAI client with custom model parameter', () => {
        const customModel = 'gpt-4o-mini';
        const provider = createAIProvider(AIProviderType.OPENAI, MOCK_API_KEY, customModel);

        expect(provider).toBeInstanceOf(OpenAIClient);
        // Verify client was instantiated successfully with custom model
        expect(provider).toHaveProperty('generate');
        expect(provider).toHaveProperty('validateConnection');
      });

      it('should create Anthropic client with custom model parameter', () => {
        const customModel = 'claude-3-haiku-20240307';
        const provider = createAIProvider(AIProviderType.ANTHROPIC, MOCK_API_KEY, customModel);

        expect(provider).toBeInstanceOf(AnthropicClient);
        // Verify client was instantiated successfully with custom model
        expect(provider).toHaveProperty('generate');
        expect(provider).toHaveProperty('validateConnection');
      });
    });
  });
});
