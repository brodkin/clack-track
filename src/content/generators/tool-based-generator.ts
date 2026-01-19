/**
 * Tool-Based Generator Wrapper
 *
 * Wraps existing AIPromptGenerator subclasses to enable tool-based content
 * generation with the submit_content tool. Implements a multi-turn conversation
 * loop where the LLM can iteratively refine content based on validation feedback.
 *
 * Key features:
 * - Injects submit_content tool into generation requests
 * - Processes tool calls and feeds validation results back to LLM
 * - Loop protection with configurable max attempts
 * - Exhaustion strategies: throw error or use last submission with truncation
 *
 * @module content/generators/tool-based-generator
 *
 * @example
 * ```typescript
 * // Wrap an existing generator
 * const wrapped = ToolBasedGenerator.wrap(motivationalGenerator, {
 *   aiProvider: openaiClient,
 *   maxAttempts: 3,
 *   exhaustionStrategy: 'use-last',
 * });
 *
 * // Generate content with tool-based validation
 * const content = await wrapped.generate(context);
 * ```
 */

import type { AIProvider, AIGenerationRequest, ToolResult } from '../../types/ai.js';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
  GenerationMetadata,
} from '../../types/content-generator.js';
import {
  submitContentToolDefinition,
  executeSubmitContent,
  type SubmitContentResult,
} from '../tools/submit-content.js';
import { VESTABOARD } from '../../config/constants.js';

/**
 * Exhaustion strategy when max attempts are reached without valid content.
 *
 * - 'throw': Throw an error to trigger P3 fallback in orchestrator
 * - 'use-last': Use the last submission with content truncation
 */
export type ExhaustionStrategy = 'throw' | 'use-last';

/**
 * Configuration options for the ToolBasedGenerator wrapper.
 */
export interface ToolBasedGeneratorOptions {
  /**
   * The AI provider to use for generation with tool support.
   * This provider will receive tool definitions and process tool calls.
   */
  aiProvider: AIProvider;

  /**
   * Maximum number of submission attempts before giving up.
   * Each attempt represents one tool call cycle.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Strategy to use when max attempts are exhausted without valid content.
   * - 'throw': Throw error for P3 fallback
   * - 'use-last': Force-accept last submission with truncation
   * @default 'throw'
   */
  exhaustionStrategy?: ExhaustionStrategy;
}

/**
 * Resolved options with defaults applied.
 */
interface ResolvedOptions {
  aiProvider: AIProvider;
  maxAttempts: number;
  exhaustionStrategy: ExhaustionStrategy;
}

/**
 * Extended metadata for tool-based generation.
 */
interface ToolBasedMetadata extends GenerationMetadata {
  /** Number of tool call attempts made */
  toolAttempts: number;
  /** Whether the final content was accepted by validation */
  toolAccepted: boolean;
  /** Whether max attempts were exhausted */
  toolExhausted?: boolean;
  /** Whether content was force-accepted due to exhaustion */
  toolForceAccepted?: boolean;
}

/**
 * Wrapper that adds tool-based generation capability to existing generators.
 *
 * The wrapper intercepts the generate() call, adds the submit_content tool
 * to the AI request, and manages the multi-turn conversation loop:
 *
 * 1. Initial prompt sent to LLM with submit_content tool
 * 2. LLM calls submit_content with generated content
 * 3. Content validated, result sent back to LLM
 * 4. If rejected, LLM can retry with improved content
 * 5. Loop continues until acceptance or max attempts reached
 *
 * @implements {ContentGenerator}
 */
export class ToolBasedGenerator implements ContentGenerator {
  private readonly baseGenerator: ContentGenerator;
  private readonly options: ResolvedOptions;

  /**
   * Creates a new ToolBasedGenerator instance.
   * Use the static wrap() method for cleaner instantiation.
   *
   * @param baseGenerator - The generator to wrap
   * @param options - Configuration options
   */
  private constructor(baseGenerator: ContentGenerator, options: ResolvedOptions) {
    this.baseGenerator = baseGenerator;
    this.options = options;
  }

  /**
   * Wraps an existing generator with tool-based generation capability.
   *
   * @param generator - The content generator to wrap
   * @param options - Configuration options
   * @returns A new ToolBasedGenerator instance
   *
   * @example
   * ```typescript
   * const wrapped = ToolBasedGenerator.wrap(existingGenerator, {
   *   aiProvider: openaiClient,
   *   maxAttempts: 5,
   *   exhaustionStrategy: 'use-last',
   * });
   * ```
   */
  static wrap(generator: ContentGenerator, options: ToolBasedGeneratorOptions): ToolBasedGenerator {
    const resolved: ResolvedOptions = {
      aiProvider: options.aiProvider,
      maxAttempts: options.maxAttempts ?? 3,
      exhaustionStrategy: options.exhaustionStrategy ?? 'throw',
    };

    return new ToolBasedGenerator(generator, resolved);
  }

  /**
   * Generates content using the tool-based approach.
   *
   * The generation flow:
   * 1. Call base generator to get prompts (indirectly via AI provider)
   * 2. Add submit_content tool to the request
   * 3. Process tool calls from LLM response
   * 4. Validate content and feed result back if rejected
   * 5. Repeat until accepted or max attempts reached
   *
   * @param context - Generation context
   * @returns Generated content with tool-based metadata
   * @throws Error if max attempts exhausted and strategy is 'throw'
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Get the initial generation from base generator
    // This gives us the prompts and initial setup
    const baseResult = await this.baseGenerator.generate(context);

    // Use the system and user prompts from base generator metadata if available
    const systemPrompt = (baseResult.metadata?.systemPrompt as string) || '';
    const userPrompt = (baseResult.metadata?.userPrompt as string) || '';

    // Start the tool-based generation loop
    let attempts = 0;
    let lastSubmission: string | null = null;
    let lastValidationResult: SubmitContentResult | null = null;
    let conversationHistory: ToolResult[] = [];

    while (attempts < this.options.maxAttempts) {
      attempts++;

      // Build the request with tools
      const request: AIGenerationRequest = {
        systemPrompt,
        userPrompt,
        tools: [submitContentToolDefinition],
        ...(conversationHistory.length > 0 && { toolResults: conversationHistory }),
      };

      // Call AI provider
      const response = await this.options.aiProvider.generate(request);

      // Handle direct text response (no tool call) - enforce tool use
      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Instead of accepting direct text, ask AI to use the tool
        // We use a synthetic tool result to continue the conversation
        conversationHistory = [
          {
            toolCallId: 'enforce_tool_use',
            content: JSON.stringify({
              error:
                'You must use the submit_content tool to submit your content. Do not respond with plain text.',
              hint: 'Call submit_content with your generated content.',
            }),
            isError: true,
          },
        ];
        continue;
      }

      // Process tool calls
      const toolCall = response.toolCalls[0];

      // Handle unknown tool
      if (toolCall.name !== 'submit_content') {
        // Send error back to LLM
        conversationHistory = [
          {
            toolCallId: toolCall.id,
            content: JSON.stringify({
              error: `Unknown tool: ${toolCall.name}. Use submit_content to submit your content.`,
            }),
            isError: true,
          },
        ];
        continue;
      }

      // Extract and normalize content
      const rawContent = (toolCall.arguments.content as string) || '';
      const normalizedContent = rawContent.toUpperCase();
      lastSubmission = normalizedContent;

      // Execute the submit_content tool
      lastValidationResult = await executeSubmitContent({ content: normalizedContent });

      // If accepted, return the content
      if (lastValidationResult.accepted) {
        return {
          text: normalizedContent,
          outputMode: 'text',
          metadata: {
            ...baseResult.metadata,
            model: response.model,
            tokensUsed: response.tokensUsed,
            toolAttempts: attempts,
            toolAccepted: true,
          } as ToolBasedMetadata,
        };
      }

      // Content rejected - prepare feedback for next iteration
      conversationHistory = [
        {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            accepted: false,
            errors: lastValidationResult.errors,
            hint: lastValidationResult.hint,
            preview: lastValidationResult.preview,
          }),
          isError: false,
        },
      ];
    }

    // Max attempts exhausted - apply exhaustion strategy
    return this.handleExhaustion(
      lastSubmission,
      lastValidationResult,
      attempts,
      baseResult.metadata
    );
  }

  /**
   * Handles the case when max attempts are exhausted without valid content.
   *
   * @param lastSubmission - The last content submitted
   * @param lastValidationResult - The validation result from last attempt
   * @param attempts - Number of attempts made
   * @param baseMetadata - Metadata from base generator
   * @returns Generated content (for 'use-last' strategy)
   * @throws Error if strategy is 'throw'
   */
  private handleExhaustion(
    lastSubmission: string | null,
    lastValidationResult: SubmitContentResult | null,
    attempts: number,
    baseMetadata?: GenerationMetadata
  ): GeneratedContent {
    if (this.options.exhaustionStrategy === 'throw') {
      throw new Error(
        `Max submission attempts exhausted (${attempts}). ` +
          `Last validation errors: ${lastValidationResult?.errors?.join(', ') || 'unknown'}`
      );
    }

    // 'use-last' strategy: truncate content to fit
    const content = lastSubmission || '';
    const truncatedContent = this.truncateToFit(content);

    return {
      text: truncatedContent,
      outputMode: 'text',
      metadata: {
        ...baseMetadata,
        toolAttempts: attempts,
        toolAccepted: false,
        toolExhausted: true,
        toolForceAccepted: true,
      } as ToolBasedMetadata,
    };
  }

  /**
   * Truncates content to fit within Vestaboard framed constraints.
   * Preserves as much content as possible while ensuring valid display.
   *
   * @param content - The content to truncate
   * @returns Truncated content that fits display constraints
   */
  private truncateToFit(content: string): string {
    const lines = content.split('\n');

    // Truncate to max framed rows
    const truncatedLines = lines.slice(0, VESTABOARD.FRAMED_MAX_ROWS);

    // Truncate each line to max framed columns
    const finalLines = truncatedLines.map(line => line.slice(0, VESTABOARD.FRAMED_MAX_COLS));

    return finalLines.join('\n');
  }

  /**
   * Validates the wrapped generator.
   * Delegates to the base generator's validate() method.
   *
   * @returns Validation result from base generator
   */
  async validate(): Promise<GeneratorValidationResult> {
    return this.baseGenerator.validate();
  }

  /**
   * Returns the current configuration options.
   * Useful for debugging and testing.
   *
   * @returns Current options with defaults applied
   */
  getOptions(): { maxAttempts: number; exhaustionStrategy: ExhaustionStrategy } {
    return {
      maxAttempts: this.options.maxAttempts,
      exhaustionStrategy: this.options.exhaustionStrategy,
    };
  }
}
