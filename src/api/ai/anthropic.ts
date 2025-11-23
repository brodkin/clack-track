import { AIProvider, AIGenerationRequest, AIGenerationResponse } from '../../types/ai.js';

export class AnthropicClient implements AIProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(_request: AIGenerationRequest): Promise<AIGenerationResponse> {
    void _request;
    // TODO: Implement Anthropic API integration
    throw new Error('Not implemented');
  }

  async validateConnection(): Promise<boolean> {
    // TODO: Implement connection validation
    return false;
  }
}
