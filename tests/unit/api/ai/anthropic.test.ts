import { AnthropicClient } from '@/api/ai/anthropic';
import { AIGenerationRequest, ToolDefinition, ToolResult } from '@/types/ai';
import {
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
  AIProviderError,
  OverloadedError,
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

    it('should throw OverloadedError when API returns 529 status', async () => {
      const error = new Error('Service is overloaded') as Error & {
        status: number;
        error: { type: string; message: string };
      };
      error.status = 529;
      error.error = {
        type: 'overloaded_error',
        message: 'Service is temporarily overloaded',
      };

      mockAnthropic.messages.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(OverloadedError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'Anthropic',
        statusCode: 529,
      });
    });

    it('should throw OverloadedError when error type is overloaded_error', async () => {
      const error = new Error('Service is overloaded') as Error & {
        error: { type: string; message: string };
      };
      error.error = {
        type: 'overloaded_error',
        message: 'Service is temporarily overloaded',
      };

      mockAnthropic.messages.create.mockRejectedValue(error);

      await expect(client.generate(request)).rejects.toThrow(OverloadedError);
      await expect(client.generate(request)).rejects.toMatchObject({
        provider: 'Anthropic',
        statusCode: 529,
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

  describe('tool calling', () => {
    const weatherTool: ToolDefinition = {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g., San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature unit',
          },
        },
        required: ['location'],
      },
    };

    const submitContentTool: ToolDefinition = {
      name: 'submit_vestaboard_content',
      description: 'Submit content to display on the Vestaboard',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The content to display (max 132 characters)',
          },
        },
        required: ['content'],
      },
    };

    describe('passing tools to API', () => {
      it('should pass tools array to messages.create() when provided', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.singleToolUse as never
        );

        await client.generate(request);

        expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [
              {
                name: 'get_weather',
                description: 'Get the current weather for a location',
                input_schema: {
                  type: 'object',
                  properties: {
                    location: {
                      type: 'string',
                      description: 'The city and state, e.g., San Francisco, CA',
                    },
                    unit: {
                      type: 'string',
                      enum: ['celsius', 'fahrenheit'],
                      description: 'Temperature unit',
                    },
                  },
                  required: ['location'],
                },
              },
            ],
          })
        );
      });

      it('should pass multiple tools when provided', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Get the weather and display it.',
          tools: [weatherTool, submitContentTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.singleToolUse as never
        );

        await client.generate(request);

        expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: expect.arrayContaining([
              expect.objectContaining({ name: 'get_weather' }),
              expect.objectContaining({ name: 'submit_vestaboard_content' }),
            ]),
          })
        );
      });

      it('should not include tools parameter when no tools provided', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Generate a motivational quote.',
        };

        mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.message.success as never);

        await client.generate(request);

        const callArgs = mockAnthropic.messages.create.mock.calls[0][0];
        expect(callArgs).not.toHaveProperty('tools');
      });
    });

    describe('parsing tool_use content blocks', () => {
      it('should parse single tool_use content block from response', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.singleToolUse as never
        );

        const response = await client.generate(request);

        expect(response.toolCalls).toBeDefined();
        expect(response.toolCalls).toHaveLength(1);
        expect(response.toolCalls![0]).toEqual({
          id: 'toolu_01A2B3C4D5E6F7G8H9I0J1K2L',
          name: 'get_weather',
          arguments: {
            location: 'San Francisco, CA',
            unit: 'fahrenheit',
          },
        });
      });

      it('should parse multiple tool_use content blocks from response', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Get weather for NYC and LA',
          tools: [weatherTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.multipleToolUses as never
        );

        const response = await client.generate(request);

        expect(response.toolCalls).toBeDefined();
        expect(response.toolCalls).toHaveLength(2);
        expect(response.toolCalls![0].name).toBe('get_weather');
        expect(response.toolCalls![0].arguments).toEqual({
          location: 'New York, NY',
          unit: 'fahrenheit',
        });
        expect(response.toolCalls![1].name).toBe('get_weather');
        expect(response.toolCalls![1].arguments).toEqual({
          location: 'Los Angeles, CA',
          unit: 'fahrenheit',
        });
      });

      it('should handle response with both text and tool_use blocks', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather?',
          tools: [weatherTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.textAndToolUse as never
        );

        const response = await client.generate(request);

        expect(response.text).toBe("I'll check the weather for you.");
        expect(response.toolCalls).toBeDefined();
        expect(response.toolCalls).toHaveLength(1);
        expect(response.toolCalls![0].name).toBe('get_weather');
      });

      it('should return empty text when response only contains tool_use', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Get the weather.',
          tools: [weatherTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.toolUseOnly as never
        );

        const response = await client.generate(request);

        expect(response.text).toBe('');
        expect(response.toolCalls).toBeDefined();
        expect(response.toolCalls).toHaveLength(1);
      });
    });

    describe('stop_reason handling', () => {
      it('should set finishReason to "tool_use" when model requests tool use', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather?',
          tools: [weatherTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.singleToolUse as never
        );

        const response = await client.generate(request);

        expect(response.finishReason).toBe('tool_use');
      });

      it('should set finishReason to "end_turn" for normal text responses', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Say hello.',
        };

        mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.message.success as never);

        const response = await client.generate(request);

        expect(response.finishReason).toBe('end_turn');
      });

      it('should not include toolCalls when response is end_turn without tool_use blocks', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Say hello.',
          tools: [weatherTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.textResponseWithTools as never
        );

        const response = await client.generate(request);

        expect(response.finishReason).toBe('end_turn');
        expect(response.toolCalls).toBeUndefined();
      });
    });

    describe('multi-turn tool conversations', () => {
      it('should include tool_result in messages when toolResults provided', async () => {
        const toolResults: ToolResult[] = [
          {
            toolCallId: 'toolu_01A2B3C4D5E6F7G8H9I0J1K2L',
            content: '{"temperature": 72, "condition": "sunny", "humidity": 45}',
          },
        ];

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in San Francisco?',
          tools: [weatherTool],
          toolResults,
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.afterToolResult as never
        );

        await client.generate(request);

        expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              { role: 'user', content: 'What is the weather in San Francisco?' },
              {
                role: 'assistant',
                content: [
                  {
                    type: 'tool_use',
                    id: 'toolu_01A2B3C4D5E6F7G8H9I0J1K2L',
                    name: 'get_weather',
                    input: {},
                  },
                ],
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: 'toolu_01A2B3C4D5E6F7G8H9I0J1K2L',
                    content: '{"temperature": 72, "condition": "sunny", "humidity": 45}',
                  },
                ],
              },
            ]),
          })
        );
      });

      it('should handle multiple tool results in conversation', async () => {
        const toolResults: ToolResult[] = [
          {
            toolCallId: 'toolu_01NYC123',
            content: '{"temperature": 65, "condition": "cloudy"}',
          },
          {
            toolCallId: 'toolu_01LA456',
            content: '{"temperature": 78, "condition": "sunny"}',
          },
        ];

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Compare weather in NYC and LA',
          tools: [weatherTool],
          toolResults,
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.afterMultipleToolResults as never
        );

        await client.generate(request);

        const callArgs = mockAnthropic.messages.create.mock.calls[0][0];
        const messages = callArgs.messages;

        // Should have user message, assistant tool_use, and user tool_results
        expect(messages.length).toBeGreaterThanOrEqual(3);

        // Find the tool_result messages
        const toolResultMessages = messages.filter(
          (m: { role: string; content: unknown }) =>
            m.role === 'user' &&
            Array.isArray(m.content) &&
            m.content.some((c: { type: string }) => c.type === 'tool_result')
        );
        expect(toolResultMessages.length).toBeGreaterThanOrEqual(1);
      });

      it('should handle tool result with error flag', async () => {
        const toolResults: ToolResult[] = [
          {
            toolCallId: 'toolu_01ERROR123',
            content: 'Error: Location not found',
            isError: true,
          },
        ];

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather in Atlantis?',
          tools: [weatherTool],
          toolResults,
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.afterErrorToolResult as never
        );

        await client.generate(request);

        expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'tool_result',
                    tool_use_id: 'toolu_01ERROR123',
                    content: 'Error: Location not found',
                    is_error: true,
                  }),
                ]),
              }),
            ]),
          })
        );
      });

      it('should return final text response after tool results processed', async () => {
        const toolResults: ToolResult[] = [
          {
            toolCallId: 'toolu_01A2B3C4D5E6F7G8H9I0J1K2L',
            content: '{"temperature": 72, "condition": "sunny"}',
          },
        ];

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather?',
          tools: [weatherTool],
          toolResults,
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.afterToolResult as never
        );

        const response = await client.generate(request);

        expect(response.text).toBe(
          'The weather in San Francisco is sunny with a temperature of 72°F.'
        );
        expect(response.finishReason).toBe('end_turn');
        expect(response.toolCalls).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle tool with complex nested parameters', async () => {
        const complexTool: ToolDefinition = {
          name: 'create_event',
          description: 'Create a calendar event',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Event title' },
              attendees: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
            },
            required: ['title'],
          },
        };

        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Create a meeting.',
          tools: [complexTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.message.success as never);

        await client.generate(request);

        expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [
              {
                name: 'create_event',
                description: 'Create a calendar event',
                input_schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Event title' },
                    attendees: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          email: { type: 'string' },
                          name: { type: 'string' },
                        },
                      },
                    },
                  },
                  required: ['title'],
                },
              },
            ],
          })
        );
      });

      it('should preserve existing request parameters when adding tools', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'What is the weather?',
          maxTokens: 500,
          temperature: 0.5,
          tools: [weatherTool],
        };

        mockAnthropic.messages.create.mockResolvedValue(
          anthropicFixtures.toolCalling.singleToolUse as never
        );

        await client.generate(request);

        expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            max_tokens: 500,
            temperature: 0.5,
            tools: expect.any(Array),
          })
        );
      });

      it('should handle empty tools array gracefully', async () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Hello',
          tools: [],
        };

        mockAnthropic.messages.create.mockResolvedValue(anthropicFixtures.message.success as never);

        await client.generate(request);

        const callArgs = mockAnthropic.messages.create.mock.calls[0][0];
        // Empty tools array should not be passed to API
        expect(callArgs.tools).toBeUndefined();
      });
    });
  });
});
