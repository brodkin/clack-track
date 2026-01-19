// =============================================================================
// Tool Calling Types
// =============================================================================

/**
 * JSON Schema compatible parameter schema for tool definitions.
 * Follows the JSON Schema specification used by OpenAI and Anthropic APIs.
 */
export interface ToolParameterSchema {
  /** The type of the schema (typically 'object' for tool parameters) */
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  /** Description of the parameter */
  description?: string;
  /** Properties when type is 'object' */
  properties?: Record<string, ToolParameterProperty>;
  /** Required property names when type is 'object' */
  required?: string[];
  /** Item schema when type is 'array' */
  items?: ToolParameterProperty;
  /** Allowed values for enum types */
  enum?: (string | number | boolean)[];
}

/**
 * Individual property definition within a tool parameter schema.
 * Supports nested objects, arrays, and primitive types.
 */
export interface ToolParameterProperty {
  /** The type of the property */
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  /** Description of the property */
  description?: string;
  /** Properties when type is 'object' (nested objects) */
  properties?: Record<string, ToolParameterProperty>;
  /** Required property names when type is 'object' */
  required?: string[];
  /** Item schema when type is 'array' */
  items?: ToolParameterProperty;
  /** Allowed values for enum types */
  enum?: (string | number | boolean)[];
}

/**
 * Definition of a tool that can be called by the AI model.
 * Compatible with OpenAI's function calling and Anthropic's tool use APIs.
 */
export interface ToolDefinition {
  /** Unique name of the tool (e.g., 'get_weather', 'submit_vestaboard_content') */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema defining the expected parameters */
  parameters: ToolParameterSchema;
}

/**
 * Represents a tool invocation requested by the AI model.
 * The AI model returns this when it wants to call a tool.
 */
export interface ToolCall {
  /** Unique identifier for this tool call (used to match results) */
  id: string;
  /** Name of the tool to invoke */
  name: string;
  /** Arguments to pass to the tool (parsed from JSON) */
  arguments: Record<string, unknown>;
}

/**
 * Result of executing a tool call, sent back to the AI model.
 * Used in multi-turn conversations where tool results inform the next response.
 */
export interface ToolResult {
  /** ID of the tool call this result corresponds to */
  toolCallId: string;
  /** The result content (typically a string, but could be structured data) */
  content: string;
  /** Whether this result represents an error */
  isError?: boolean;
}

// =============================================================================
// AI Generation Types
// =============================================================================

export interface AIGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
  /** Optional tools available for the AI to call */
  tools?: ToolDefinition[];
  /** Optional tool results from previous tool calls (for multi-turn tool use) */
  toolResults?: ToolResult[];
}

export interface AIGenerationResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  finishReason?: string;
  /** Optional tool calls requested by the AI model */
  toolCalls?: ToolCall[];
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
