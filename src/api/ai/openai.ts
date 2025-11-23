import OpenAI from 'openai';
import { AIProvider, AIGenerationRequest, AIGenerationResponse } from '../../types/ai.js';
import {
  AIProviderError,
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
} from '../../types/errors.js';

export class OpenAIClient implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4-turbo-preview') {
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
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new AIProviderError('Invalid response from OpenAI', 'OpenAI');
      }

      return {
        text: choice.message.content || '',
        model: response.model,
        tokensUsed: response.usage?.total_tokens,
        finishReason: choice.finish_reason || undefined,
      };
    } catch (error) {
      this.handleError(error);
    }
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

    // Generic error for other cases
    throw new AIProviderError(message, 'OpenAI', err as Error, statusCode);
  }
}
