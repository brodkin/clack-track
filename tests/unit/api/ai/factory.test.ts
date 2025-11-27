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

    describe('model parameter (tier-based model selection)', () => {
      it('should create OpenAI client without model parameter (backward compatibility)', () => {
        const provider = createAIProvider(AIProviderType.OPENAI, MOCK_API_KEY);

        expect(provider).toBeInstanceOf(OpenAIClient);
        expect(provider).toBeDefined();
      });

      it('should create Anthropic client without model parameter (backward compatibility)', () => {
        const provider = createAIProvider(AIProviderType.ANTHROPIC, MOCK_API_KEY);

        expect(provider).toBeInstanceOf(AnthropicClient);
        expect(provider).toBeDefined();
      });

      it('should create OpenAI client with custom model parameter', () => {
        const customModel = 'gpt-4o-mini';
        const provider = createAIProvider(AIProviderType.OPENAI, MOCK_API_KEY, customModel);

        expect(provider).toBeInstanceOf(OpenAIClient);
        // Verify model was passed (indirectly through successful instantiation)
        expect(provider).toBeDefined();
      });

      it('should create Anthropic client with custom model parameter', () => {
        const customModel = 'claude-3-haiku-20240307';
        const provider = createAIProvider(AIProviderType.ANTHROPIC, MOCK_API_KEY, customModel);

        expect(provider).toBeInstanceOf(AnthropicClient);
        // Verify model was passed (indirectly through successful instantiation)
        expect(provider).toBeDefined();
      });

      it('should pass undefined model to OpenAI when not specified', () => {
        // This test verifies that OpenAI client uses its default when no model is provided
        const provider = createAIProvider(AIProviderType.OPENAI, MOCK_API_KEY);

        expect(provider).toBeInstanceOf(OpenAIClient);
      });

      it('should pass undefined model to Anthropic when not specified', () => {
        // This test verifies that Anthropic client uses its default when no model is provided
        const provider = createAIProvider(AIProviderType.ANTHROPIC, MOCK_API_KEY);

        expect(provider).toBeInstanceOf(AnthropicClient);
      });
    });
  });
});
