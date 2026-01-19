import { describe, it, expect } from '@jest/globals';
import type {
  AIGenerationRequest,
  AIGenerationResponse,
  AIProvider,
  AIConfig,
  ToolDefinition,
  ToolCall,
  ToolResult,
  ToolParameterSchema,
} from '@/types/ai';

describe('AI Types', () => {
  describe('Existing Types (Backwards Compatibility)', () => {
    describe('AIGenerationRequest', () => {
      it('should accept minimal required fields', () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant',
          userPrompt: 'Hello, world!',
        };

        expect(request.systemPrompt).toBe('You are a helpful assistant');
        expect(request.userPrompt).toBe('Hello, world!');
      });

      it('should accept all optional fields', () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'System prompt',
          userPrompt: 'User prompt',
          maxTokens: 1000,
          temperature: 0.7,
          metadata: { key: 'value' },
        };

        expect(request.maxTokens).toBe(1000);
        expect(request.temperature).toBe(0.7);
        expect(request.metadata).toEqual({ key: 'value' });
      });

      it('should accept request without tools (backwards compatible)', () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'Test',
          userPrompt: 'Test',
        };

        expect(request.tools).toBeUndefined();
      });
    });

    describe('AIGenerationResponse', () => {
      it('should accept minimal required fields', () => {
        const response: AIGenerationResponse = {
          text: 'Generated content',
          model: 'gpt-4',
        };

        expect(response.text).toBe('Generated content');
        expect(response.model).toBe('gpt-4');
      });

      it('should accept all optional fields', () => {
        const response: AIGenerationResponse = {
          text: 'Generated content',
          model: 'claude-3',
          tokensUsed: 500,
          finishReason: 'stop',
        };

        expect(response.tokensUsed).toBe(500);
        expect(response.finishReason).toBe('stop');
      });

      it('should accept response without toolCalls (backwards compatible)', () => {
        const response: AIGenerationResponse = {
          text: 'Content',
          model: 'gpt-4',
        };

        expect(response.toolCalls).toBeUndefined();
      });
    });

    describe('AIProvider', () => {
      it('should define generate method signature', () => {
        const mockProvider: AIProvider = {
          generate: async (_request: AIGenerationRequest) => ({
            text: 'Response',
            model: 'test-model',
          }),
          validateConnection: async () => true,
        };

        expect(typeof mockProvider.generate).toBe('function');
        expect(typeof mockProvider.validateConnection).toBe('function');
      });

      it('should allow optional getName method', () => {
        const mockProvider: AIProvider = {
          generate: async () => ({ text: '', model: '' }),
          validateConnection: async () => true,
          getName: () => 'test-provider',
        };

        expect(mockProvider.getName?.()).toBe('test-provider');
      });
    });

    describe('AIConfig', () => {
      it('should accept minimal required fields', () => {
        const config: AIConfig = {
          provider: 'openai',
          apiKey: 'sk-test-key',
        };

        expect(config.provider).toBe('openai');
        expect(config.apiKey).toBe('sk-test-key');
      });

      it('should accept all optional fields', () => {
        const config: AIConfig = {
          provider: 'anthropic',
          apiKey: 'sk-test-key',
          defaultModel: 'claude-3',
          maxTokens: 2000,
          temperature: 0.5,
        };

        expect(config.defaultModel).toBe('claude-3');
        expect(config.maxTokens).toBe(2000);
        expect(config.temperature).toBe(0.5);
      });
    });
  });

  describe('Tool Calling Types', () => {
    describe('ToolParameterSchema', () => {
      it('should define JSON Schema compatible structure', () => {
        const schema: ToolParameterSchema = {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The name' },
            age: { type: 'number' },
          },
          required: ['name'],
        };

        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
        expect(schema.required).toContain('name');
      });

      it('should support nested object schemas', () => {
        const schema: ToolParameterSchema = {
          type: 'object',
          properties: {
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
              },
            },
          },
        };

        expect(schema.properties?.address).toBeDefined();
      });

      it('should support array schemas', () => {
        const schema: ToolParameterSchema = {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        };

        expect(schema.properties?.tags?.type).toBe('array');
        expect(schema.properties?.tags?.items).toBeDefined();
      });

      it('should support enum values', () => {
        const schema: ToolParameterSchema = {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'active', 'completed'],
            },
          },
        };

        expect(schema.properties?.status?.enum).toEqual(['pending', 'active', 'completed']);
      });
    });

    describe('ToolDefinition', () => {
      it('should define tool with name, description, and parameters', () => {
        const tool: ToolDefinition = {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' },
              units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
            },
            required: ['location'],
          },
        };

        expect(tool.name).toBe('get_weather');
        expect(tool.description).toBe('Get current weather for a location');
        expect(tool.parameters.type).toBe('object');
        expect(tool.parameters.properties?.location).toBeDefined();
      });

      it('should allow tool without parameters', () => {
        const tool: ToolDefinition = {
          name: 'get_current_time',
          description: 'Get the current time',
          parameters: {
            type: 'object',
            properties: {},
          },
        };

        expect(tool.name).toBe('get_current_time');
        expect(tool.parameters.properties).toEqual({});
      });

      it('should support Vestaboard content submission tool', () => {
        const tool: ToolDefinition = {
          name: 'submit_vestaboard_content',
          description: 'Submit content to display on Vestaboard',
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Content to display (max 132 chars, 6 rows x 22 cols)',
              },
              row1: { type: 'string', description: 'First row content' },
              row2: { type: 'string', description: 'Second row content' },
              row3: { type: 'string', description: 'Third row content' },
              row4: { type: 'string', description: 'Fourth row content' },
              row5: { type: 'string', description: 'Fifth row content' },
              row6: { type: 'string', description: 'Sixth row content' },
            },
            required: ['content'],
          },
        };

        expect(tool.name).toBe('submit_vestaboard_content');
        expect(tool.parameters.required).toContain('content');
      });
    });

    describe('ToolCall', () => {
      it('should define tool call with id, name, and arguments', () => {
        const toolCall: ToolCall = {
          id: 'call_abc123',
          name: 'get_weather',
          arguments: { location: 'Seattle', units: 'celsius' },
        };

        expect(toolCall.id).toBe('call_abc123');
        expect(toolCall.name).toBe('get_weather');
        expect(toolCall.arguments).toEqual({ location: 'Seattle', units: 'celsius' });
      });

      it('should support empty arguments object', () => {
        const toolCall: ToolCall = {
          id: 'call_xyz789',
          name: 'get_current_time',
          arguments: {},
        };

        expect(toolCall.arguments).toEqual({});
      });

      it('should support nested argument values', () => {
        const toolCall: ToolCall = {
          id: 'call_nested',
          name: 'complex_tool',
          arguments: {
            nested: {
              key: 'value',
              array: [1, 2, 3],
            },
          },
        };

        expect(toolCall.arguments.nested).toBeDefined();
      });
    });

    describe('ToolResult', () => {
      it('should define tool result with call id and content', () => {
        const result: ToolResult = {
          toolCallId: 'call_abc123',
          content: 'Weather in Seattle: 55F, Cloudy',
        };

        expect(result.toolCallId).toBe('call_abc123');
        expect(result.content).toBe('Weather in Seattle: 55F, Cloudy');
      });

      it('should support error results', () => {
        const result: ToolResult = {
          toolCallId: 'call_xyz789',
          content: 'Error: Location not found',
          isError: true,
        };

        expect(result.isError).toBe(true);
        expect(result.content).toContain('Error');
      });

      it('should default isError to undefined (falsy)', () => {
        const result: ToolResult = {
          toolCallId: 'call_success',
          content: 'Success response',
        };

        expect(result.isError).toBeUndefined();
      });
    });

    describe('AIGenerationRequest with Tools', () => {
      it('should accept tools array in request', () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'You are a helpful assistant with tools',
          userPrompt: 'What is the weather in Seattle?',
          tools: [
            {
              name: 'get_weather',
              description: 'Get weather for a location',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
                required: ['location'],
              },
            },
          ],
        };

        expect(request.tools).toHaveLength(1);
        expect(request.tools?.[0].name).toBe('get_weather');
      });

      it('should accept multiple tools', () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'Multi-tool assistant',
          userPrompt: 'Help me',
          tools: [
            {
              name: 'tool_a',
              description: 'First tool',
              parameters: { type: 'object', properties: {} },
            },
            {
              name: 'tool_b',
              description: 'Second tool',
              parameters: { type: 'object', properties: {} },
            },
          ],
        };

        expect(request.tools).toHaveLength(2);
      });

      it('should accept toolResults for multi-turn tool use', () => {
        const request: AIGenerationRequest = {
          systemPrompt: 'Assistant',
          userPrompt: 'Continue from tool results',
          toolResults: [
            {
              toolCallId: 'call_abc123',
              content: 'Tool execution result',
            },
          ],
        };

        expect(request.toolResults).toHaveLength(1);
        expect(request.toolResults?.[0].toolCallId).toBe('call_abc123');
      });
    });

    describe('AIGenerationResponse with Tool Calls', () => {
      it('should include toolCalls when LLM invokes tools', () => {
        const response: AIGenerationResponse = {
          text: '', // May be empty when using tools
          model: 'gpt-4',
          toolCalls: [
            {
              id: 'call_abc123',
              name: 'get_weather',
              arguments: { location: 'Seattle' },
            },
          ],
          finishReason: 'tool_calls',
        };

        expect(response.toolCalls).toHaveLength(1);
        expect(response.toolCalls?.[0].id).toBe('call_abc123');
        expect(response.finishReason).toBe('tool_calls');
      });

      it('should support multiple tool calls in one response', () => {
        const response: AIGenerationResponse = {
          text: '',
          model: 'claude-3',
          toolCalls: [
            {
              id: 'call_1',
              name: 'get_weather',
              arguments: { location: 'Seattle' },
            },
            {
              id: 'call_2',
              name: 'get_time',
              arguments: { timezone: 'PST' },
            },
          ],
        };

        expect(response.toolCalls).toHaveLength(2);
      });

      it('should support response with both text and tool calls', () => {
        const response: AIGenerationResponse = {
          text: 'Let me check the weather for you.',
          model: 'gpt-4',
          toolCalls: [
            {
              id: 'call_weather',
              name: 'get_weather',
              arguments: { location: 'Seattle' },
            },
          ],
        };

        expect(response.text).toBeTruthy();
        expect(response.toolCalls).toHaveLength(1);
      });
    });
  });

  describe('Type Safety', () => {
    it('should enforce ToolDefinition name as string', () => {
      const tool: ToolDefinition = {
        name: 'valid_name',
        description: 'A tool',
        parameters: { type: 'object', properties: {} },
      };

      // TypeScript would catch if name was not a string
      expect(typeof tool.name).toBe('string');
    });

    it('should enforce ToolCall id as string', () => {
      const call: ToolCall = {
        id: 'unique_id',
        name: 'tool',
        arguments: {},
      };

      expect(typeof call.id).toBe('string');
    });

    it('should enforce ToolResult toolCallId as string', () => {
      const result: ToolResult = {
        toolCallId: 'call_id',
        content: 'result',
      };

      expect(typeof result.toolCallId).toBe('string');
    });
  });
});
