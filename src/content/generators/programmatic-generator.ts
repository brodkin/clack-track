/**
 * Base class for programmatic (non-AI) content generators.
 *
 * Provides a foundation for content generators that create content through
 * algorithmic or static means rather than AI inference. Examples include
 * static messages, calculated values, or templated content.
 *
 * @module content/generators/programmatic-generator
 */

import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
} from '@/types/content-generator.js';

/**
 * Abstract base class for non-AI content generation.
 *
 * Implements the ContentGenerator interface with sensible defaults for
 * programmatic generators. Subclasses must implement the generate() method
 * to produce content, and may optionally override validate() for custom
 * validation logic.
 *
 * @abstract
 * @implements {ContentGenerator}
 *
 * @example
 * ```typescript
 * class TimeDisplayGenerator extends ProgrammaticGenerator {
 *   async generate(context: GenerationContext): Promise<GeneratedContent> {
 *     const time = context.timestamp.toLocaleTimeString();
 *     return {
 *       text: `Current time: ${time}`,
 *       outputMode: 'text'
 *     };
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * class ConfigurableGenerator extends ProgrammaticGenerator {
 *   constructor(private config: GeneratorConfig) {
 *     super();
 *   }
 *
 *   validate(): GeneratorValidationResult {
 *     if (!this.config.apiKey) {
 *       return {
 *         valid: false,
 *         errors: ['Missing API key in configuration']
 *       };
 *     }
 *     return { valid: true };
 *   }
 *
 *   async generate(context: GenerationContext): Promise<GeneratedContent> {
 *     // Implementation using this.config
 *     return { text: 'Generated content', outputMode: 'text' };
 *   }
 * }
 * ```
 */
export abstract class ProgrammaticGenerator implements ContentGenerator {
  /**
   * Default validation implementation that always returns valid.
   *
   * Programmatic generators typically don't require external dependencies
   * or configuration, so the default implementation assumes the generator
   * is always ready to use. Subclasses can override this method to implement
   * custom validation logic (e.g., checking for required configuration).
   *
   * @returns {Promise<GeneratorValidationResult>} Always returns { valid: true }
   *
   * @example
   * ```typescript
   * // Default behavior (no override)
   * const generator = new SimpleGenerator();
   * const result = await generator.validate();
   * // result: { valid: true }
   * ```
   *
   * @example
   * ```typescript
   * // Custom validation (override)
   * class ApiGenerator extends ProgrammaticGenerator {
   *   async validate(): Promise<GeneratorValidationResult> {
   *     if (!process.env.API_KEY) {
   *       return {
   *         valid: false,
   *         errors: ['API_KEY environment variable not set']
   *       };
   *     }
   *     return { valid: true };
   *   }
   *
   *   async generate(context: GenerationContext): Promise<GeneratedContent> {
   *     // Implementation
   *   }
   * }
   * ```
   */
  async validate(): Promise<GeneratorValidationResult> {
    return { valid: true };
  }

  /**
   * Generate content based on the provided context.
   *
   * This is an abstract method that must be implemented by all subclasses.
   * The implementation should use the context information (timestamp, update type,
   * event data) to produce appropriate content for the Vestaboard display.
   *
   * @abstract
   * @param {GenerationContext} context - Context information for content generation
   * @returns {Promise<GeneratedContent>} Generated content with text and optional layout
   *
   * @example
   * ```typescript
   * class StaticMessageGenerator extends ProgrammaticGenerator {
   *   async generate(context: GenerationContext): Promise<GeneratedContent> {
   *     return {
   *       text: 'Welcome Home!',
   *       outputMode: 'text'
   *     };
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * class DynamicGenerator extends ProgrammaticGenerator {
   *   async generate(context: GenerationContext): Promise<GeneratedContent> {
   *     const hour = context.timestamp.getHours();
   *     const greeting = hour < 12 ? 'Good Morning' : 'Good Afternoon';
   *
   *     return {
   *       text: greeting,
   *       outputMode: 'text',
   *       metadata: {
   *         generatedAt: context.timestamp.toISOString(),
   *         updateType: context.updateType
   *       }
   *     };
   *   }
   * }
   * ```
   */
  abstract generate(context: GenerationContext): Promise<GeneratedContent>;
}
