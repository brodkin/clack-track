import Anthropic from '@anthropic-ai/sdk';
import type { Message, TextBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
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

/**
 * Anthropic tool definition format.
 * Anthropic uses 'input_schema' instead of 'parameters'.
 * Note: Anthropic SDK requires input_schema.type to be strictly 'object'.
 */
interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    description?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Type guard for text content blocks.
 */
function isTextBlock(block: { type: string }): block is TextBlock {
  return block.type === 'text';
}

/**
 * Type guard for tool_use content blocks.
 */
function isToolUseBlock(block: { type: string }): block is ToolUseBlock {
  return block.type === 'tool_use';
}

/**
 * Anthropic tool_result content block for multi-turn conversations.
 */
interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/**
 * Anthropic tool_use block for assistant messages in multi-turn conversations.
 */
interface AnthropicAssistantToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Message type for Anthropic API.
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicToolResultBlock[] | AnthropicAssistantToolUseBlock[];
}

export class AnthropicClient implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-5-20250929') {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey,
    });
    this.model = model;
  }

  async generate(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    try {
      // Build the messages array
      const messages = this.buildMessages(request);

      // Build the API request parameters
      const apiParams: {
        model: string;
        system: string;
        messages: AnthropicMessage[];
        max_tokens: number;
        temperature?: number;
        tools?: AnthropicTool[];
      } = {
        model: this.model,
        system: request.systemPrompt,
        messages,
        max_tokens: request.maxTokens || 1024,
        temperature: request.temperature,
      };

      // Add tools if provided and not empty
      if (request.tools && request.tools.length > 0) {
        apiParams.tools = this.convertTools(request.tools);
      }

      const response = await this.client.messages.create(apiParams);

      // Parse the response content blocks
      return this.parseResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Build the messages array for the API request.
   * Handles both simple requests and multi-turn tool conversations.
   */
  private buildMessages(request: AIGenerationRequest): AnthropicMessage[] {
    const messages: AnthropicMessage[] = [];

    // Always start with the user message
    messages.push({ role: 'user', content: request.userPrompt });

    // If we have tool results, we need to construct the conversation history
    if (request.toolResults && request.toolResults.length > 0) {
      // Add assistant message with tool_use blocks (placeholder for the previous turn)
      const toolUseBlocks: AnthropicAssistantToolUseBlock[] = request.toolResults.map(result => ({
        type: 'tool_use' as const,
        id: result.toolCallId,
        name: 'get_weather', // Default name, actual name is not stored in ToolResult
        input: {},
      }));
      messages.push({ role: 'assistant', content: toolUseBlocks });

      // Add user message with tool_result blocks
      const toolResultBlocks: AnthropicToolResultBlock[] = request.toolResults.map(result => {
        const block: AnthropicToolResultBlock = {
          type: 'tool_result',
          tool_use_id: result.toolCallId,
          content: result.content,
        };
        if (result.isError) {
          block.is_error = true;
        }
        return block;
      });
      messages.push({ role: 'user', content: toolResultBlocks });
    }

    return messages;
  }

  /**
   * Convert our ToolDefinition format to Anthropic's tool format.
   * Anthropic uses 'input_schema' instead of 'parameters'.
   * Note: Anthropic SDK requires input_schema.type to be strictly 'object'.
   */
  private convertTools(tools: ToolDefinition[]): AnthropicTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        description: tool.parameters.description,
        properties: tool.parameters.properties as Record<string, unknown> | undefined,
        required: tool.parameters.required,
      },
    }));
  }

  /**
   * Parse the Anthropic response and extract text, tool calls, and metadata.
   * Uses SDK's Message type which includes all content block types
   * (text, tool_use, thinking, redacted_thinking, server_tool_use, web_search_tool_result).
   */
  private parseResponse(response: Message): AIGenerationResponse {
    // Extract text content (may be empty if only tool_use blocks)
    // Filters out thinking, redacted_thinking, and other non-text blocks
    const textBlocks = response.content.filter(isTextBlock);
    const text = textBlocks.map(block => block.text).join('');

    // Extract tool_use content blocks
    const toolUseBlocks = response.content.filter(isToolUseBlock);

    // Build the response
    const result: AIGenerationResponse = {
      text,
      model: response.model,
      tokensUsed: response.usage
        ? response.usage.input_tokens + response.usage.output_tokens
        : undefined,
      finishReason: response.stop_reason || undefined,
    };

    // Add tool calls if present
    if (toolUseBlocks.length > 0) {
      result.toolCalls = toolUseBlocks.map(
        (block): ToolCall => ({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        })
      );
    }

    return result;
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Make a minimal request to validate the connection
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test connection' }],
      });
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
      error?: { type?: string; message?: string };
    };
    const statusCode = err.status || err.statusCode;
    const message = err.message || 'Unknown error occurred';

    // Check error type or status code for specific error types
    const errorType = err.error?.type;

    if (statusCode === 429 || errorType === 'rate_limit_error') {
      throw new RateLimitError(message, 'Anthropic', err as Error, statusCode || 429);
    }

    if (statusCode === 401 || statusCode === 403 || errorType === 'authentication_error') {
      throw new AuthenticationError(message, 'Anthropic', err as Error, statusCode || 401);
    }

    if (statusCode === 400 || errorType === 'invalid_request_error') {
      throw new InvalidRequestError(message, 'Anthropic', err as Error, statusCode || 400);
    }

    if (statusCode === 529 || errorType === 'overloaded_error') {
      throw new OverloadedError(message, 'Anthropic', err as Error, statusCode || 529);
    }

    // Generic error for other cases
    throw new AIProviderError(message, 'Anthropic', err as Error, statusCode);
  }
}
