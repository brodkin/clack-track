import OpenAI from 'openai';
import {
  AIProvider,
  AIGenerationRequest,
  AIGenerationResponse,
  ToolDefinition,
  ToolCall,
} from '../../types/ai.js';
import {
  AIProviderError,
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
  OverloadedError,
} from '../../types/errors.js';

export class OpenAIClient implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4.1') {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey,
    });
    this.model = model;
  }

  async generate(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    try {
      // Build messages array
      const messages = this.buildMessages(request);

      // Build the API request parameters
      const apiParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model: this.model,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
      };

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        apiParams.tools = this.convertTools(request.tools);
      }

      const response = await this.client.chat.completions.create(apiParams);

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new AIProviderError('Invalid response from OpenAI', 'OpenAI');
      }

      // Build the response
      const result: AIGenerationResponse = {
        text: choice.message.content || '',
        model: response.model,
        tokensUsed: response.usage?.total_tokens,
        finishReason: choice.finish_reason || undefined,
      };

      // Parse tool calls if present
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        result.toolCalls = this.parseToolCalls(choice.message.tool_calls);
      }

      return result;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Build the messages array for the API request
   */
  private buildMessages(request: AIGenerationRequest): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ];

    // Add tool results if provided (for multi-turn conversations)
    if (request.toolResults && request.toolResults.length > 0) {
      for (const toolResult of request.toolResults) {
        messages.push({
          role: 'tool',
          tool_call_id: toolResult.toolCallId,
          content: toolResult.content,
        });
      }
    }

    return messages;
  }

  /**
   * Convert internal tool definitions to OpenAI tool format
   */
  private convertTools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        // Cast through unknown to satisfy OpenAI's strict FunctionParameters type
        // Our ToolParameterSchema is compatible but uses a union type for 'type'
        parameters: tool.parameters as unknown as OpenAI.FunctionParameters,
      },
    }));
  }

  /**
   * Parse tool calls from OpenAI response
   */
  private parseToolCalls(toolCalls: OpenAI.ChatCompletionMessageToolCall[]): ToolCall[] {
    return toolCalls.map(tc => {
      // Type guard: ensure this is a function tool call (not a custom tool call)
      if (tc.type !== 'function') {
        throw new AIProviderError(`Unsupported tool call type: ${tc.type}`, 'OpenAI');
      }
      return {
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      };
    });
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  private handleError(error: unknown): never {
    const err = error as {
      status?: number;
      statusCode?: number;
      message?: string;
      error?: unknown;
    };
    const statusCode = err.status || err.statusCode;
    const message = err.message || 'Unknown error occurred';

    // Check error status code for specific error types
    if (statusCode === 429) {
      throw new RateLimitError(message, 'OpenAI', err as Error, statusCode);
    }

    if (statusCode === 401 || statusCode === 403) {
      throw new AuthenticationError(message, 'OpenAI', err as Error, statusCode);
    }

    if (statusCode === 400) {
      throw new InvalidRequestError(message, 'OpenAI', err as Error, statusCode);
    }

    if (statusCode === 529 || statusCode === 503) {
      throw new OverloadedError(message, 'OpenAI', err as Error, statusCode);
    }

    // Generic error for other cases
    throw new AIProviderError(message, 'OpenAI', err as Error, statusCode);
  }
}
