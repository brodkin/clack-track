import { AnthropicClient } from '@/api/ai/anthropic';
import { AIGenerationRequest } from '@/types/ai';
import {
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
  AIProviderError,
} from '@/types/errors';
import Anthropic from '@anthropic-ai/sdk';
import { anthropicFixtures } from '@tests/fixtures/index';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  const MOCK_API_KEY = 'sk-ant-test-12345';
  let mockAnthropic: jest.Mocked<Anthropic>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock Anthropic instance
    mockAnthropic = {
      messages: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<Anthropic>;

    // Mock the Anthropic constructor
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropic);

    client = new AnthropicClient(MOCK_API_KEY);
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect(Anthropic).toHaveBeenCalledWith({
        apiKey: MOCK_API_KEY,
      });
    });

    it('should throw error when API key is missing', () => {
      expect(() => new AnthropicClient('')).toThrow('Anthropic API key is required');
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
      mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.message.success as never);

      const response = await client.generate(request);

      expect(response).toEqual({
        text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
        model: 'claude-sonnet-4-20250514',
        tokensUsed: 118,
        finishReason: 'end_turn',
      });
    });

    it('should call Anthropic API with correct parameters', async () => {
      mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.message.success as never);

      await client.generate(request);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-5-20250929',
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Generate a motivational quote.' }],
        max_tokens: 100,
        temperature: 0.7,
      });
    });

    it('should use default model when not specified', async () => {
      mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.message.success as never);

      await client.generate(request);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
        })
      );
    });

    it('should use custom model when specified', async () => {
      const clientWithModel = new AnthropicClient(MOCK_API_KEY, 'claude-3-opus-20240229');
      mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.message.success as never);

      await clientWithModel.generate(request);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-opus-20240229',
        })
      );
    });

    it('should throw RateLimitError when rate limit is exceeded', async () => {
      const error = new Error('Rate limit exceeded') as Error & {
        status: number;
        error: { type: string; message: string };
      };
      error.status = 429;
      error.error = {
        type: 'rate_limit_error',
        message: anthropicFixtures.errors.rateLimit.error.message,
      };

      mockAnthropic.messages.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(RateLimitError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'Anthropic',
        statusCode: 429,
      });
    });

    it('should throw AuthenticationError when API key is invalid', async () => {
      const error = new Error('Invalid API key') as Error & {
        status: number;
        error: { type: string; message: string };
      };
      error.status = 401;
      error.error = {
        type: 'authentication_error',
        message: anthropicFixtures.errors.authentication.error.message,
      };

      mockAnthropic.messages.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(AuthenticationError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'Anthropic',
        statusCode: 401,
      });
    });

    it('should throw InvalidRequestError when request is invalid', async () => {
      const error = new Error('Invalid parameter') as Error & {
        status: number;
        error: { type: string; message: string };
      };
      error.status = 400;
      error.error = {
        type: 'invalid_request_error',
        message: anthropicFixtures.errors.invalidRequest.error.message,
      };

      mockAnthropic.messages.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(InvalidRequestError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'Anthropic',
        statusCode: 400,
      });
    });

    it('should throw generic AIProviderError for other errors', async () => {
      const error = new Error('Unknown error') as Error & { status: number };
      error.status = 500;

      mockAnthropic.messages.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(AIProviderError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'Anthropic',
        statusCode: 500,
      });
    });

    it('should handle missing usage data gracefully', async () => {
      const responseWithoutUsage = {
        ...anthropicFixtures.message.success,
        usage: undefined,
      };

      mockAnthropic.messages.create.mockResolvedValue(responseWithoutUsage as never);

      const response = await client.generate(request);

      expect(response.tokensUsed).toBeUndefined();
    });

    it('should extract text from content array correctly', async () => {
      mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.message.success as never);

      const response = await client.generate(request);

      expect(response.text).toBe(
        'Success is not final, failure is not fatal: it is the courage to continue that counts.'
      );
    });
  });

  describe('validateConnection', () => {
    it('should return true when connection is valid', async () => {
      mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.models.validation as never);

      const result = await client.validateConnection();

      expect(result).toBe(true);
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test connection' }],
      });
    });

    it('should return false when authentication fails', async () => {
      const error = new Error('Invalid API key') as Error & { status: number };
      error.status = 401;

      mockAnthropic.messages.create.mockRejectedValue(error);

      const result = await client.validateConnection();

      expect(result).toBe(false);
    });

    it('should return false when rate limit is exceeded', async () => {
      const error = new Error('Rate limit exceeded') as Error & { status: number };
      error.status = 429;

      mockAnthropic.messages.create.mockRejectedValue(error);

      const result = await client.validateConnection();

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('Network error'));

      const result = await client.validateConnection();

      expect(result).toBe(false);
    });
  });
});
