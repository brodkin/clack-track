import { OpenAIClient } from '@/api/ai/openai';
import { AIGenerationRequest } from '@/types/ai';
import {
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
  AIProviderError,
} from '@/types/errors';
import OpenAI from 'openai';
import { openaiFixtures } from '@tests/fixtures/index';

// Mock the OpenAI SDK
jest.mock('openai');

describe('OpenAIClient', () => {
  let client: OpenAIClient;
  const MOCK_API_KEY = 'sk-test-12345';
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      models: {
        list: jest.fn(),
      },
    } as unknown as jest.Mocked<OpenAI>;

    // Mock the OpenAI constructor
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    client = new OpenAIClient(MOCK_API_KEY);
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: MOCK_API_KEY,
      });
    });

    it('should throw error when API key is missing', () => {
      expect(() => new OpenAIClient('')).toThrow('OpenAI API key is required');
    });
  });

  describe('generate', () => {
    const request: AIGenerationRequest = {
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Generate a motivational quote.',
      maxTokens: 100,
      temperature: 0.7,
    };

    it('should generate content successfully', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(
        openaiFixtures.chatCompletion.success as never
      );

      const response = await client.generate(request);

      expect(response).toEqual({
        text: 'The future belongs to those who believe in the beauty of their dreams. Make today count!',
        model: 'gpt-4-0613',
        tokensUsed: 107,
        finishReason: 'stop',
      });
    });

    it('should call OpenAI API with correct parameters', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(
        openaiFixtures.chatCompletion.success as never
      );

      await client.generate(request);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Generate a motivational quote.' },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });
    });

    it('should use default model when not specified', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(
        openaiFixtures.chatCompletion.success as never
      );

      await client.generate(request);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4.1',
        })
      );
    });

    it('should use custom model when specified', async () => {
      const clientWithModel = new OpenAIClient(MOCK_API_KEY, 'gpt-4');
      mockOpenAI.chat.completions.create.mockResolvedValue(
        openaiFixtures.chatCompletion.success as never
      );

      await clientWithModel.generate(request);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
        })
      );
    });

    it('should throw RateLimitError when rate limit is exceeded', async () => {
      const error = new Error('Rate limit exceeded') as Error & { status: number; error: unknown };
      error.status = 429;
      error.error = openaiFixtures.errors.rateLimit.error;

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(RateLimitError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'OpenAI',
        statusCode: 429,
      });
    });

    it('should throw AuthenticationError when API key is invalid', async () => {
      const error = new Error('Invalid API key') as Error & { status: number; error: unknown };
      error.status = 401;
      error.error = openaiFixtures.errors.authentication.error;

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(AuthenticationError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'OpenAI',
        statusCode: 401,
      });
    });

    it('should throw InvalidRequestError when request is invalid', async () => {
      const error = new Error('Invalid parameter') as Error & { status: number; error: unknown };
      error.status = 400;
      error.error = openaiFixtures.errors.invalidRequest.error;

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(InvalidRequestError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'OpenAI',
        statusCode: 400,
      });
    });

    it('should throw generic AIProviderError for other errors', async () => {
      const error = new Error('Unknown error') as Error & { status: number };
      error.status = 500;

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(AIProviderError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'OpenAI',
        statusCode: 500,
      });
    });

    it('should handle missing usage data gracefully', async () => {
      const responseWithoutUsage = {
        ...openaiFixtures.chatCompletion.success,
        usage: undefined,
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(responseWithoutUsage as never);

      const response = await client.generate(request);

      expect(response.tokensUsed).toBeUndefined();
    });
  });

  describe('validateConnection', () => {
    it('should return true when connection is valid', async () => {
      mockOpenAI.models.list.mockResolvedValue(openaiFixtures.models.list as never);

      const result = await client.validateConnection();

      expect(result).toBe(true);
      expect(mockOpenAI.models.list).toHaveBeenCalled();
    });

    it('should return false when authentication fails', async () => {
      const error = new Error('Invalid API key') as Error & { status: number };
      error.status = 401;

      mockOpenAI.models.list.mockRejectedValue(error);

      const result = await client.validateConnection();

      expect(result).toBe(false);
    });

    it('should return false when rate limit is exceeded', async () => {
      const error = new Error('Rate limit exceeded') as Error & { status: number };
      error.status = 429;

      mockOpenAI.models.list.mockRejectedValue(error);

      const result = await client.validateConnection();

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockOpenAI.models.list.mockRejectedValue(new Error('Network error'));

      const result = await client.validateConnection();

      expect(result).toBe(false);
    });
  });
});
