export interface AIGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface AIGenerationResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  finishReason?: string;
}

export interface AIProvider {
  generate(request: AIGenerationRequest): Promise<AIGenerationResponse>;
  validateConnection(): Promise<boolean>;
  /** Get the provider name (e.g., 'openai', 'anthropic') for circuit breaker tracking */
  getName?(): string;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
}
