import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIGenerationRequest, AIGenerationResponse } from '../../types/ai.js';
import {
  AIProviderError,
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
} from '../../types/errors.js';

export class AnthropicClient implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
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
      const response = await this.client.messages.create({
        model: this.model,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
        max_tokens: request.maxTokens || 1024,
        temperature: request.temperature,
      });

      // Extract text from content array
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new AIProviderError('Invalid response from Anthropic', 'Anthropic');
      }

      return {
        text: textContent.text,
        model: response.model,
        tokensUsed: response.usage
          ? response.usage.input_tokens + response.usage.output_tokens
          : undefined,
        finishReason: response.stop_reason || undefined,
      };
    } catch (error) {
      this.handleError(error);
    }
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

    // Generic error for other cases
    throw new AIProviderError(message, 'Anthropic', err as Error, statusCode);
  }
}
