/**
 * Test Mocks Index
 *
 * Central export point for all test mock utilities.
 * Import mocks from this index for convenience.
 *
 * @example
 * ```typescript
 * import { createMockOpenAIClient, createMockAnthropicClient } from '@tests/__mocks__';
 * ```
 */

export {
  createMockOpenAIClient,
  createMockAnthropicClient,
  isAIProvider,
  type MockAIProviderOptions,
} from './ai-providers.js';

export {
  createMockConnection,
  createMockAuth,
  mockGetStates,
  mockCallService,
  mockCreateConnection,
  triggerMockEvent,
  isConnection,
  type MockHomeAssistantOptions,
} from './home-assistant.js';
