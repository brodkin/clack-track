import { OpenAIClient } from '@/api/ai/openai';
import { AIGenerationRequest, ToolDefinition } from '@/types/ai';
import {
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
  AIProviderError,
  OverloadedError,
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

    it('should throw OverloadedError when API returns 529 status', async () => {
      const error = new Error('Service is overloaded') as Error & {
        status: number;
        error: unknown;
      };
      error.status = 529;
      error.error = { message: 'Service temporarily overloaded' };

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(OverloadedError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'OpenAI',
        statusCode: 529,
      });
    });

    it('should throw OverloadedError when API returns 503 status', async () => {
      const error = new Error('Service unavailable') as Error & { status: number; error: unknown };
      error.status = 503;
      error.error = { message: 'Service temporarily unavailable' };

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(OverloadedError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'OpenAI',
        statusCode: 503,
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

  describe('tool calling', () => {
    const weatherTool: ToolDefinition = {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'The temperature unit',
          },
        },
        required: ['location'],
      },
    };

    const timeTool: ToolDefinition = {
      name: 'get_time',
      description: 'Get the current time for a timezone',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'The IANA timezone, e.g. America/Los_Angeles',
          },
        },
        required: ['timezone'],
      },
    };

    describe('passing tools to API', () => {
      it('should pass tools array to chat.completions.create when provided', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.singleToolCall as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
        };

        await client.generate(request);

        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [
              {
                type: 'function',
                function: {
                  name: 'get_weather',
                  description: 'Get the current weather for a location',
                  parameters: weatherTool.parameters,
                },
              },
            ],
          })
        );
      });

      it('should not include tools in API call when not provided', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.chatCompletion.success as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Generate a motivational quote.',
        };

        await client.generate(request);

        const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
        expect(callArgs).not.toHaveProperty('tools');
      });

      it('should pass multiple tools when provided', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.multipleToolCalls as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather and time in San Francisco?',
          tools: [weatherTool, timeTool],
        };

        await client.generate(request);

        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: expect.arrayContaining([
              expect.objectContaining({
                type: 'function',
                function: expect.objectContaining({ name: 'get_weather' }),
              }),
              expect.objectContaining({
                type: 'function',
                function: expect.objectContaining({ name: 'get_time' }),
              }),
            ]),
          })
        );
      });
    });

    describe('parsing tool_calls from response', () => {
      it('should parse single tool call from response', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.singleToolCall as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
        };

        const response = await client.generate(request);

        expect(response.toolCalls).toBeDefined();
        expect(response.toolCalls).toHaveLength(1);
        expect(response.toolCalls![0]).toEqual({
          id: 'call_abc123',
          name: 'get_weather',
          arguments: { location: 'San Francisco', unit: 'fahrenheit' },
        });
      });

      it('should parse multiple tool calls from response', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.multipleToolCalls as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather and time in San Francisco?',
          tools: [weatherTool, timeTool],
        };

        const response = await client.generate(request);

        expect(response.toolCalls).toBeDefined();
        expect(response.toolCalls).toHaveLength(2);
        expect(response.toolCalls![0]).toEqual({
          id: 'call_def456',
          name: 'get_weather',
          arguments: { location: 'San Francisco' },
        });
        expect(response.toolCalls![1]).toEqual({
          id: 'call_ghi789',
          name: 'get_time',
          arguments: { timezone: 'America/Los_Angeles' },
        });
      });

      it('should include both text and tool calls when present', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.toolCallWithText as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in New York?',
          tools: [weatherTool],
        };

        const response = await client.generate(request);

        expect(response.text).toBe("I'll check the weather for you.");
        expect(response.toolCalls).toBeDefined();
        expect(response.toolCalls).toHaveLength(1);
        expect(response.toolCalls![0].name).toBe('get_weather');
      });

      it('should return empty text when content is null and tool calls present', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.singleToolCall as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
        };

        const response = await client.generate(request);

        expect(response.text).toBe('');
        expect(response.toolCalls).toBeDefined();
      });

      it('should not include toolCalls when response has no tool_calls', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.chatCompletion.success as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Generate a motivational quote.',
        };

        const response = await client.generate(request);

        expect(response.toolCalls).toBeUndefined();
      });
    });

    describe('handling finish_reason', () => {
      it('should return finish_reason "tool_calls" when model wants to call tools', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.singleToolCall as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
        };

        const response = await client.generate(request);

        expect(response.finishReason).toBe('tool_calls');
      });

      it('should return finish_reason "stop" for normal text responses', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.chatCompletion.success as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Generate a motivational quote.',
        };

        const response = await client.generate(request);

        expect(response.finishReason).toBe('stop');
      });
    });

    describe('multi-turn tool conversations', () => {
      it('should include tool results in messages when provided', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.afterToolResult as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
          toolResults: [
            {
              toolCallId: 'call_abc123',
              content: '{"temperature": 72, "condition": "sunny"}',
            },
          ],
        };

        await client.generate(request);

        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: 'What is the weather in San Francisco?' },
              {
                role: 'tool',
                tool_call_id: 'call_abc123',
                content: '{"temperature": 72, "condition": "sunny"}',
              },
            ]),
          })
        );
      });

      it('should include multiple tool results when provided', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.afterToolResult as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather and time in San Francisco?',
          tools: [weatherTool, timeTool],
          toolResults: [
            {
              toolCallId: 'call_def456',
              content: '{"temperature": 72, "condition": "sunny"}',
            },
            {
              toolCallId: 'call_ghi789',
              content: '{"time": "10:30 AM", "timezone": "PST"}',
            },
          ],
        };

        await client.generate(request);

        const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
        const toolMessages = callArgs.messages.filter((m: { role: string }) => m.role === 'tool');
        expect(toolMessages).toHaveLength(2);
      });

      it('should handle tool result with error flag', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.afterToolResult as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
          toolResults: [
            {
              toolCallId: 'call_abc123',
              content: 'Error: Unable to fetch weather data',
              isError: true,
            },
          ],
        };

        await client.generate(request);

        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              {
                role: 'tool',
                tool_call_id: 'call_abc123',
                content: 'Error: Unable to fetch weather data',
              },
            ]),
          })
        );
      });

      it('should return text response after tool results are processed', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue(
          openaiFixtures.toolCalling.afterToolResult as never
        );

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
          toolResults: [
            {
              toolCallId: 'call_abc123',
              content: '{"temperature": 72, "condition": "sunny"}',
            },
          ],
        };

        const response = await client.generate(request);

        expect(response.text).toBe(
          'The current weather in San Francisco is 72°F and sunny. Perfect day to enjoy the outdoors!'
        );
        expect(response.finishReason).toBe('stop');
        expect(response.toolCalls).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle empty arguments in tool call', async () => {
        const emptyArgsResponse = {
          ...openaiFixtures.toolCalling.singleToolCall,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_empty',
                    type: 'function',
                    function: {
                      name: 'no_args_tool',
                      arguments: '{}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        };

        mockOpenAI.chat.completions.create.mockResolvedValue(emptyArgsResponse as never);

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Call the tool',
          tools: [
            {
              name: 'no_args_tool',
              description: 'A tool with no arguments',
              parameters: { type: 'object', properties: {} },
            },
          ],
        };

        const response = await client.generate(request);

        expect(response.toolCalls).toHaveLength(1);
        expect(response.toolCalls![0].arguments).toEqual({});
      });

      it('should handle malformed JSON in tool arguments gracefully', async () => {
        const malformedArgsResponse = {
          ...openaiFixtures.toolCalling.singleToolCall,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_malformed',
                    type: 'function',
                    function: {
                      name: 'get_weather',
                      arguments: '{invalid json}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        };

        mockOpenAI.chat.completions.create.mockResolvedValue(malformedArgsResponse as never);

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather?',
          tools: [weatherTool],
        };

        // Should throw an error for malformed JSON
        await expect(client.generate(request)).rejects.toThrow();
      });

      it('should throw AIProviderError when response has no valid choice', async () => {
        const noChoiceResponse = {
          ...openaiFixtures.chatCompletion.success,
          choices: [],
        };

        mockOpenAI.chat.completions.create.mockResolvedValue(noChoiceResponse as never);

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Generate content.',
        };

        await expect(client.generate(request)).rejects.toThrow('Invalid response from OpenAI');
      });

      it('should throw AIProviderError for unsupported tool call type', async () => {
        const customToolCallResponse = {
          ...openaiFixtures.toolCalling.singleToolCall,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_custom',
                    type: 'custom_tool', // Unsupported type
                    custom_property: 'value',
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        };

        mockOpenAI.chat.completions.create.mockResolvedValue(customToolCallResponse as never);

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Call the tool',
          tools: [weatherTool],
        };

        await expect(client.generate(request)).rejects.toThrow(
          'Unsupported tool call type: custom_tool'
        );
      });
    });
  });
});
