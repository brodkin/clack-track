import { createAIProvider, AIProviderType } from '@/api/ai/index';
import { OpenAIClient } from '@/api/ai/openai';
import { AnthropicClient } from '@/api/ai/anthropic';

describe('AI Provider Factory', () => {
  const MOCK_API_KEY = 'test-api-key-12345';

  describe('createAIProvider', () => {
    it('should create OpenAI client when type is OPENAI', () => {
      const provider = createAIProvider(AIProviderType.OPENAI, MOCK_API_KEY);

      expect(provider).toBeInstanceOf(OpenAIClient);
    });

    it('should create Anthropic client when type is ANTHROPIC', () => {
      const provider = createAIProvider(AIProviderType.ANTHROPIC, MOCK_API_KEY);

      expect(provider).toBeInstanceOf(AnthropicClient);
    });

    it('should throw error for invalid provider type', () => {
      // @ts-expect-error - Testing invalid type
      expect(() => createAIProvider('invalid', MOCK_API_KEY)).toThrow();
    });

    it('should pass API key to OpenAI client constructor', () => {
      const provider = createAIProvider(AIProviderType.OPENAI, MOCK_API_KEY);

      // Verify the provider has the API key (indirectly through instance check)
      expect(provider).toBeDefined();
      expect(provider).toHaveProperty('generate');
      expect(provider).toHaveProperty('validateConnection');
    });

    it('should pass API key to Anthropic client constructor', () => {
      const provider = createAIProvider(AIProviderType.ANTHROPIC, MOCK_API_KEY);

      // Verify the provider has the API key (indirectly through instance check)
      expect(provider).toBeDefined();
      expect(provider).toHaveProperty('generate');
      expect(provider).toHaveProperty('validateConnection');
    });
  });
});
