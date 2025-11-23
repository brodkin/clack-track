/**
 * Mock Index Exports Test
 *
 * Validates that the mock index file exports all necessary utilities
 * and that they can be imported through the convenience index.
 */

import { createMockOpenAIClient, createMockAnthropicClient, isAIProvider } from '@tests/__mocks__';

describe('Mock Index Exports', () => {
  test('should export createMockOpenAIClient', () => {
    expect(createMockOpenAIClient).toBeDefined();
    expect(typeof createMockOpenAIClient).toBe('function');
  });

  test('should export createMockAnthropicClient', () => {
    expect(createMockAnthropicClient).toBeDefined();
    expect(typeof createMockAnthropicClient).toBe('function');
  });

  test('should export isAIProvider type guard', () => {
    expect(isAIProvider).toBeDefined();
    expect(typeof isAIProvider).toBe('function');
  });

  test('isAIProvider should validate mock clients', () => {
    const openaiMock = createMockOpenAIClient();
    const anthropicMock = createMockAnthropicClient();

    expect(isAIProvider(openaiMock)).toBe(true);
    expect(isAIProvider(anthropicMock)).toBe(true);
  });

  test('isAIProvider should reject non-provider objects', () => {
    expect(isAIProvider({})).toBe(false);
    expect(isAIProvider(null)).toBe(false);
    expect(isAIProvider({ generate: 'not a function' })).toBe(false);
  });
});
