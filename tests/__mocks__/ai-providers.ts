/**
 * Shared AI Provider Mocks
 *
 * This module provides factory functions for creating mock AI provider clients
 * that conform to the AIProvider interface. These mocks are used throughout
 * the test suite to simulate AI API responses without making real network calls.
 *
 * @module ai-providers
 */

import type { AIProvider, AIGenerationRequest, AIGenerationResponse } from '@/types/ai.js';

/**
 * Configuration options for mock AI provider behavior
 */
export interface MockAIProviderOptions {
  /**
   * Whether the mock should simulate API failures
   * @default false
   */
  shouldFail?: boolean;

  /**
   * Custom text content to return in generate() responses
   * @default 'MOCK AI RESPONSE\nGENERATED CONTENT'
   */
  responseText?: string;

  /**
   * Model identifier to return in responses
   * @default 'gpt-4-0613' for OpenAI, 'claude-sonnet-4-20250514' for Anthropic
   */
  model?: string;

  /**
   * Whether validateConnection() should return true
   * @default true
   */
  connectionValid?: boolean;

  /**
   * Custom token count for usage metrics
   * @default 100
   */
  tokensUsed?: number;

  /**
   * Finish reason for generation completion
   * @default 'stop'
   */
  finishReason?: string;
}

/**
 * Creates a mock OpenAI API client for testing
 *
 * Returns a mock implementation of the AIProvider interface that simulates
 * OpenAI GPT model responses. Supports configurable success/failure modes
 * and custom response content.
 *
 * @param options - Configuration options for mock behavior
 * @returns Mock AIProvider instance configured for OpenAI responses
 *
 * @example
 * ```typescript
 * // Create a successful mock
 * const mockClient = createMockOpenAIClient();
 * const response = await mockClient.generate({
 *   systemPrompt: 'You are helpful',
 *   userPrompt: 'Generate content'
 * });
 * console.log(response.text); // 'MOCK AI RESPONSE\nGENERATED CONTENT'
 *
 * // Create a failing mock
 * const failingClient = createMockOpenAIClient({ shouldFail: true });
 * await failingClient.generate({ ... }); // Throws error
 *
 * // Create a custom response mock
 * const customClient = createMockOpenAIClient({
 *   responseText: 'Custom content',
 *   model: 'gpt-4-turbo'
 * });
 * ```
 */
export function createMockOpenAIClient(options: MockAIProviderOptions = {}): AIProvider {
  const {
    shouldFail = false,
    responseText = 'MOCK AI RESPONSE\nGENERATED CONTENT',
    model = 'gpt-4-0613',
    connectionValid = true,
    tokensUsed = 100,
    finishReason = 'stop',
  } = options;

  return {
    /**
     * Mock implementation of AI content generation
     *
     * Simulates OpenAI API response with configurable behavior.
     * If shouldFail is true, throws an error. Otherwise returns
     * a successful response with configured or default values.
     *
     * @param _request - AI generation request parameters (not used in mock implementation)
     * @returns Promise resolving to mock AI response
     * @throws Error if shouldFail option is true
     */
    async generate(_request: AIGenerationRequest): Promise<AIGenerationResponse> {
      if (shouldFail) {
        throw new Error('Mock OpenAI API Error: Rate limit exceeded or authentication failed');
      }

      return {
        text: responseText,
        model: model,
        tokensUsed: tokensUsed,
        finishReason: finishReason,
      };
    },

    /**
     * Mock implementation of connection validation
     *
     * Simulates API connection check. Returns the configured
     * connectionValid value (default: true).
     *
     * @returns Promise resolving to connection validity status
     */
    async validateConnection(): Promise<boolean> {
      return connectionValid;
    },
  };
}

/**
 * Creates a mock Anthropic API client for testing
 *
 * Returns a mock implementation of the AIProvider interface that simulates
 * Anthropic Claude model responses. Supports configurable success/failure modes
 * and custom response content.
 *
 * @param options - Configuration options for mock behavior
 * @returns Mock AIProvider instance configured for Anthropic responses
 *
 * @example
 * ```typescript
 * // Create a successful mock
 * const mockClient = createMockAnthropicClient();
 * const response = await mockClient.generate({
 *   systemPrompt: 'You are helpful',
 *   userPrompt: 'Generate content'
 * });
 * console.log(response.text); // 'MOCK AI RESPONSE\nGENERATED CONTENT'
 *
 * // Create a failing mock
 * const failingClient = createMockAnthropicClient({ shouldFail: true });
 * await failingClient.generate({ ... }); // Throws error
 *
 * // Create a custom response mock
 * const customClient = createMockAnthropicClient({
 *   responseText: 'Custom Claude response',
 *   model: 'claude-3-opus-20240229'
 * });
 * ```
 */
export function createMockAnthropicClient(options: MockAIProviderOptions = {}): AIProvider {
  const {
    shouldFail = false,
    responseText = 'MOCK AI RESPONSE\nGENERATED CONTENT',
    model = 'claude-sonnet-4-20250514',
    connectionValid = true,
    tokensUsed = 100,
    finishReason = 'end_turn',
  } = options;

  return {
    /**
     * Mock implementation of AI content generation
     *
     * Simulates Anthropic API response with configurable behavior.
     * If shouldFail is true, throws an error. Otherwise returns
     * a successful response with configured or default values.
     *
     * @param _request - AI generation request parameters (not used in mock implementation)
     * @returns Promise resolving to mock AI response
     * @throws Error if shouldFail option is true
     */
    async generate(_request: AIGenerationRequest): Promise<AIGenerationResponse> {
      if (shouldFail) {
        throw new Error('Mock Anthropic API Error: Rate limit exceeded or authentication failed');
      }

      return {
        text: responseText,
        model: model,
        tokensUsed: tokensUsed,
        finishReason: finishReason,
      };
    },

    /**
     * Mock implementation of connection validation
     *
     * Simulates API connection check. Returns the configured
     * connectionValid value (default: true).
     *
     * @returns Promise resolving to connection validity status
     */
    async validateConnection(): Promise<boolean> {
      return connectionValid;
    },
  };
}

/**
 * Type guard to check if an object implements the AIProvider interface
 *
 * @param obj - Object to check
 * @returns True if object has generate and validateConnection methods
 */
export function isAIProvider(obj: unknown): obj is AIProvider {
  return (
    !!obj &&
    typeof (obj as Record<string, unknown>).generate === 'function' &&
    typeof (obj as Record<string, unknown>).validateConnection === 'function'
  );
}
