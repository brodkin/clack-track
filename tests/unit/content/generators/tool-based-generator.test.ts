/**
 * ToolBasedGenerator Test Suite
 *
 * Tests the tool-based generation wrapper that adds submit_content tool
 * capability to existing AIPromptGenerator subclasses with loop protection.
 *
 * @module tests/unit/content/generators/tool-based-generator
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ToolBasedGenerator } from '@/content/generators/tool-based-generator.js';
import type {
  AIProvider,
  AIGenerationRequest,
  AIGenerationResponse,
  ToolCall,
} from '@/types/ai.js';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
} from '@/types/content-generator.js';

/**
 * Mock AIPromptGenerator for testing.
 * Does NOT call AI provider directly - returns prompts in metadata for wrapper to use.
 * This simulates a real generator that provides prompts for the wrapper.
 */
class MockAIPromptGenerator implements ContentGenerator {
  private systemPrompt: string;
  private userPrompt: string;

  constructor(systemPrompt = 'System prompt', userPrompt = 'User prompt') {
    this.systemPrompt = systemPrompt;
    this.userPrompt = userPrompt;
  }

  async generate(_context: GenerationContext): Promise<GeneratedContent> {
    // Return prompts in metadata for the wrapper to use
    // Real AIPromptGenerator would call AI, but wrapper intercepts this pattern
    return {
      text: '',
      outputMode: 'text',
      metadata: {
        systemPrompt: this.systemPrompt,
        userPrompt: this.userPrompt,
        provider: 'mock',
      },
    };
  }

  async validate(): Promise<GeneratorValidationResult> {
    return { valid: true };
  }
}

/**
 * Creates a mock AI provider with configurable tool call behavior.
 */
function createMockAIProvider(options: {
  responses: Array<{
    text?: string;
    toolCalls?: ToolCall[];
    finishReason?: string;
  }>;
}): AIProvider & { generateCalls: AIGenerationRequest[] } {
  let callIndex = 0;
  const generateCalls: AIGenerationRequest[] = [];

  return {
    generateCalls,
    async generate(request: AIGenerationRequest): Promise<AIGenerationResponse> {
      generateCalls.push(request);
      const response =
        options.responses[callIndex] || options.responses[options.responses.length - 1];
      callIndex++;

      return {
        text: response.text || '',
        model: 'mock-model',
        tokensUsed: 50,
        finishReason: response.finishReason || (response.toolCalls ? 'tool_calls' : 'stop'),
        toolCalls: response.toolCalls,
      };
    },
    async validateConnection(): Promise<boolean> {
      return true;
    },
  };
}

describe('ToolBasedGenerator', () => {
  describe('wrap()', () => {
    it('should create a wrapped generator from an existing generator', () => {
      const mockProvider = createMockAIProvider({
        responses: [{ text: 'HELLO WORLD' }],
      });
      const baseGenerator = new MockAIPromptGenerator();

      const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

      expect(wrapped).toBeInstanceOf(ToolBasedGenerator);
    });

    it('should accept optional maxAttempts configuration', () => {
      const mockProvider = createMockAIProvider({
        responses: [{ text: 'HELLO WORLD' }],
      });
      const baseGenerator = new MockAIPromptGenerator();

      const wrapped = ToolBasedGenerator.wrap(baseGenerator, {
        aiProvider: mockProvider,
        maxAttempts: 5,
      });

      expect(wrapped).toBeInstanceOf(ToolBasedGenerator);
    });

    it('should accept exhaustionStrategy configuration', () => {
      const mockProvider = createMockAIProvider({
        responses: [{ text: 'HELLO WORLD' }],
      });
      const baseGenerator = new MockAIPromptGenerator();

      const wrapped = ToolBasedGenerator.wrap(baseGenerator, {
        aiProvider: mockProvider,
        exhaustionStrategy: 'use-last',
      });

      expect(wrapped).toBeInstanceOf(ToolBasedGenerator);
    });
  });

  describe('generate()', () => {
    let context: GenerationContext;

    beforeEach(() => {
      context = {
        updateType: 'major',
        timestamp: new Date('2025-01-15T10:00:00Z'),
      };
    });

    describe('successful tool call flow', () => {
      it('should inject submit_content tool into the AI request', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'submit_content',
                  arguments: { content: 'HELLO WORLD' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        await wrapped.generate(context);

        expect(mockProvider.generateCalls[0].tools).toBeDefined();
        expect(mockProvider.generateCalls[0].tools).toHaveLength(1);
        expect(mockProvider.generateCalls[0].tools![0].name).toBe('submit_content');
      });

      it('should return content when AI calls submit_content with valid content', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'submit_content',
                  arguments: { content: 'HELLO WORLD' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        const result = await wrapped.generate(context);

        expect(result.text).toBe('HELLO WORLD');
        expect(result.outputMode).toBe('text');
      });

      it('should include attempt count in metadata', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'submit_content',
                  arguments: { content: 'HELLO WORLD' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        const result = await wrapped.generate(context);

        expect(result.metadata?.toolAttempts).toBe(1);
        expect(result.metadata?.toolAccepted).toBe(true);
      });
    });

    describe('multi-turn conversation with rejected content', () => {
      it('should feed rejection feedback back to LLM and retry', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            // First attempt: content too long (6 lines)
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'submit_content',
                  arguments: { content: 'LINE1\nLINE2\nLINE3\nLINE4\nLINE5\nLINE6' },
                },
              ],
            },
            // Second attempt: valid content
            {
              toolCalls: [
                {
                  id: 'call_2',
                  name: 'submit_content',
                  arguments: { content: 'VALID CONTENT' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        const result = await wrapped.generate(context);

        // Should have made 2 calls
        expect(mockProvider.generateCalls).toHaveLength(2);
        // Second call should include tool results from first rejection
        expect(mockProvider.generateCalls[1].toolResults).toBeDefined();
        expect(mockProvider.generateCalls[1].toolResults![0].toolCallId).toBe('call_1');
        // Final result should be the valid content
        expect(result.text).toBe('VALID CONTENT');
        expect(result.metadata?.toolAttempts).toBe(2);
      });

      it('should include actionable feedback in tool result for rejected content', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            // First attempt: invalid characters (~ is not supported on Vestaboard)
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'submit_content',
                  arguments: { content: 'Hello ~World!' },
                },
              ],
            },
            // Second attempt: valid content
            {
              toolCalls: [
                {
                  id: 'call_2',
                  name: 'submit_content',
                  arguments: { content: 'HELLO WORLD' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        await wrapped.generate(context);

        // Check that tool result contains feedback
        const toolResult = mockProvider.generateCalls[1].toolResults![0];
        expect(toolResult.content).toContain('accepted');
        expect(toolResult.isError).toBeFalsy();
      });
    });

    describe('loop protection', () => {
      it('should respect maxAttempts limit (default 3)', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            // All attempts fail validation (6 lines each time)
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'submit_content',
                  arguments: { content: 'L1\nL2\nL3\nL4\nL5\nL6' },
                },
              ],
            },
            {
              toolCalls: [
                {
                  id: 'call_2',
                  name: 'submit_content',
                  arguments: { content: 'L1\nL2\nL3\nL4\nL5\nL6' },
                },
              ],
            },
            {
              toolCalls: [
                {
                  id: 'call_3',
                  name: 'submit_content',
                  arguments: { content: 'L1\nL2\nL3\nL4\nL5\nL6' },
                },
              ],
            },
            {
              toolCalls: [
                {
                  id: 'call_4',
                  name: 'submit_content',
                  arguments: { content: 'SHOULD NOT REACH' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        // Default strategy is 'throw', so this should throw
        await expect(wrapped.generate(context)).rejects.toThrow();

        // Should have made exactly 3 attempts
        expect(mockProvider.generateCalls).toHaveLength(3);
      });

      it('should respect custom maxAttempts configuration', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            // 5 failed attempts
            ...Array(5).fill({
              toolCalls: [
                {
                  id: 'call_x',
                  name: 'submit_content',
                  arguments: { content: 'L1\nL2\nL3\nL4\nL5\nL6' },
                },
              ],
            }),
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, {
          aiProvider: mockProvider,
          maxAttempts: 5,
        });

        await expect(wrapped.generate(context)).rejects.toThrow();

        // Should have made exactly 5 attempts
        expect(mockProvider.generateCalls).toHaveLength(5);
      });
    });

    describe('exhaustion strategies', () => {
      describe('throw strategy (default)', () => {
        it('should throw error when max attempts exhausted', async () => {
          const mockProvider = createMockAIProvider({
            responses: [
              {
                toolCalls: [
                  {
                    id: 'call_1',
                    name: 'submit_content',
                    arguments: { content: 'L1\nL2\nL3\nL4\nL5\nL6' },
                  },
                ],
              },
              {
                toolCalls: [
                  {
                    id: 'call_2',
                    name: 'submit_content',
                    arguments: { content: 'L1\nL2\nL3\nL4\nL5\nL6' },
                  },
                ],
              },
              {
                toolCalls: [
                  {
                    id: 'call_3',
                    name: 'submit_content',
                    arguments: { content: 'L1\nL2\nL3\nL4\nL5\nL6' },
                  },
                ],
              },
            ],
          });
          const baseGenerator = new MockAIPromptGenerator();
          const wrapped = ToolBasedGenerator.wrap(baseGenerator, {
            aiProvider: mockProvider,
            exhaustionStrategy: 'throw',
          });

          await expect(wrapped.generate(context)).rejects.toThrow(/max.*attempts.*exhausted/i);
        });

        it('should include attempt count in error message', async () => {
          const mockProvider = createMockAIProvider({
            responses: Array(3).fill({
              toolCalls: [
                {
                  id: 'call_x',
                  name: 'submit_content',
                  arguments: { content: 'L1\nL2\nL3\nL4\nL5\nL6' },
                },
              ],
            }),
          });
          const baseGenerator = new MockAIPromptGenerator();
          const wrapped = ToolBasedGenerator.wrap(baseGenerator, {
            aiProvider: mockProvider,
            exhaustionStrategy: 'throw',
          });

          await expect(wrapped.generate(context)).rejects.toThrow(/3/);
        });
      });

      describe('use-last strategy', () => {
        it('should return last submission with truncation when max attempts exhausted', async () => {
          const mockProvider = createMockAIProvider({
            responses: Array(3).fill({
              toolCalls: [
                {
                  id: 'call_x',
                  name: 'submit_content',
                  arguments: { content: 'LINE1\nLINE2\nLINE3\nLINE4\nLINE5\nLINE6' },
                },
              ],
            }),
          });
          const baseGenerator = new MockAIPromptGenerator();
          const wrapped = ToolBasedGenerator.wrap(baseGenerator, {
            aiProvider: mockProvider,
            exhaustionStrategy: 'use-last',
          });

          const result = await wrapped.generate(context);

          // Should truncate to 5 lines (framed max)
          const lines = result.text.split('\n');
          expect(lines.length).toBeLessThanOrEqual(5);
          expect(result.metadata?.toolAccepted).toBe(false);
          expect(result.metadata?.toolExhausted).toBe(true);
          expect(result.metadata?.toolAttempts).toBe(3);
        });

        it('should mark content as force-accepted in metadata', async () => {
          const mockProvider = createMockAIProvider({
            responses: Array(3).fill({
              toolCalls: [
                {
                  id: 'call_x',
                  name: 'submit_content',
                  arguments: { content: 'L1\nL2\nL3\nL4\nL5\nL6' },
                },
              ],
            }),
          });
          const baseGenerator = new MockAIPromptGenerator();
          const wrapped = ToolBasedGenerator.wrap(baseGenerator, {
            aiProvider: mockProvider,
            exhaustionStrategy: 'use-last',
          });

          const result = await wrapped.generate(context);

          expect(result.metadata?.toolForceAccepted).toBe(true);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle AI returning text without tool call on first attempt', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            // AI returns text directly instead of using tool
            { text: 'DIRECT TEXT RESPONSE', finishReason: 'stop' },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        const result = await wrapped.generate(context);

        // Should use the direct text response
        expect(result.text).toBe('DIRECT TEXT RESPONSE');
        expect(result.metadata?.toolAttempts).toBe(0);
        expect(result.metadata?.directResponse).toBe(true);
      });

      it('should handle AI calling unknown tool', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'unknown_tool',
                  arguments: { foo: 'bar' },
                },
              ],
            },
            // After error, AI calls correct tool
            {
              toolCalls: [
                {
                  id: 'call_2',
                  name: 'submit_content',
                  arguments: { content: 'HELLO' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        const result = await wrapped.generate(context);

        // Should have retried after unknown tool error
        expect(mockProvider.generateCalls).toHaveLength(2);
        expect(result.text).toBe('HELLO');
      });

      it('should handle empty content submission', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'submit_content',
                  arguments: { content: '' },
                },
              ],
            },
            {
              toolCalls: [
                {
                  id: 'call_2',
                  name: 'submit_content',
                  arguments: { content: 'VALID CONTENT' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        const result = await wrapped.generate(context);

        // Should have rejected empty content and retried
        expect(mockProvider.generateCalls).toHaveLength(2);
        expect(result.text).toBe('VALID CONTENT');
      });

      it('should preserve base generator metadata', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'submit_content',
                  arguments: { content: 'HELLO' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        const result = await wrapped.generate(context);

        expect(result.metadata?.model).toBe('mock-model');
      });
    });

    describe('content case conversion', () => {
      it('should convert lowercase content to uppercase for Vestaboard', async () => {
        const mockProvider = createMockAIProvider({
          responses: [
            {
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'submit_content',
                  arguments: { content: 'hello world' },
                },
              ],
            },
          ],
        });
        const baseGenerator = new MockAIPromptGenerator();
        const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

        const result = await wrapped.generate(context);

        expect(result.text).toBe('HELLO WORLD');
      });
    });
  });

  describe('validate()', () => {
    it('should delegate validation to base generator', async () => {
      const mockProvider = createMockAIProvider({
        responses: [{ text: 'TEST' }],
      });
      const baseGenerator = new MockAIPromptGenerator();
      const validateSpy = jest.spyOn(baseGenerator, 'validate');
      const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

      await wrapped.validate();

      expect(validateSpy).toHaveBeenCalled();
    });

    it('should return validation result from base generator', async () => {
      const mockProvider = createMockAIProvider({
        responses: [{ text: 'TEST' }],
      });
      const baseGenerator = new MockAIPromptGenerator();
      jest.spyOn(baseGenerator, 'validate').mockResolvedValue({
        valid: false,
        errors: ['Missing prompt file'],
      });
      const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

      const result = await wrapped.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing prompt file');
    });
  });

  describe('getOptions()', () => {
    it('should return current configuration', () => {
      const mockProvider = createMockAIProvider({
        responses: [{ text: 'TEST' }],
      });
      const baseGenerator = new MockAIPromptGenerator();
      const wrapped = ToolBasedGenerator.wrap(baseGenerator, {
        aiProvider: mockProvider,
        maxAttempts: 5,
        exhaustionStrategy: 'use-last',
      });

      const options = wrapped.getOptions();

      expect(options.maxAttempts).toBe(5);
      expect(options.exhaustionStrategy).toBe('use-last');
    });

    it('should return default values when not configured', () => {
      const mockProvider = createMockAIProvider({
        responses: [{ text: 'TEST' }],
      });
      const baseGenerator = new MockAIPromptGenerator();
      const wrapped = ToolBasedGenerator.wrap(baseGenerator, { aiProvider: mockProvider });

      const options = wrapped.getOptions();

      expect(options.maxAttempts).toBe(3);
      expect(options.exhaustionStrategy).toBe('throw');
    });
  });
});
