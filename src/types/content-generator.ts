/**
 * Content Generator Type Definitions
 *
 * This module defines the core types for the content generation system,
 * including generator interfaces, context structures, and registration metadata.
 *
 * @module types/content-generator
 */

import type { VestaboardLayout } from './content.js';
import type { PersonalityDimensions } from '../content/personality/dimensions.js';
import type { ContentData } from './content-data.js';

/**
 * Result of a content generator validation check.
 *
 * @interface GeneratorValidationResult
 * @property {boolean} valid - Whether the validation passed
 * @property {string[]} [errors] - Optional array of validation error messages
 *
 * @example
 * ```typescript
 * const validResult: GeneratorValidationResult = { valid: true };
 * const invalidResult: GeneratorValidationResult = {
 *   valid: false,
 *   errors: ['Missing API key', 'Invalid configuration']
 * };
 * ```
 */
export interface GeneratorValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Optional array of validation error messages */
  errors?: string[];
}

/**
 * Context information provided to content generators for creating content.
 *
 * Contains all necessary information for a generator to produce appropriate
 * content based on the update type, timing, and any triggering events.
 *
 * @interface GenerationContext
 * @property {'major' | 'minor'} updateType - Type of update being performed
 * @property {Date} timestamp - When generation was requested
 * @property {Record<string, unknown>} [eventData] - Optional event data from Home Assistant or triggers
 * @property {GeneratedContent} [previousContent] - Optional last successful content for minor updates
 *
 * @example
 * ```typescript
 * // Major update with event data
 * const majorContext: GenerationContext = {
 *   updateType: 'major',
 *   timestamp: new Date(),
 *   eventData: {
 *     event_type: 'person.arrived',
 *     entity_id: 'person.john'
 *   }
 * };
 *
 * // Minor update preserving previous content
 * const minorContext: GenerationContext = {
 *   updateType: 'minor',
 *   timestamp: new Date(),
 *   previousContent: {
 *     text: 'Previous motivational quote',
 *     outputMode: 'text'
 *   }
 * };
 *
 * // Major update with custom personality dimensions
 * const customPersonalityContext: GenerationContext = {
 *   updateType: 'major',
 *   timestamp: new Date(),
 *   personality: {
 *     mood: 'sassy',
 *     energyLevel: 'high',
 *     humorStyle: 'dry wit',
 *     obsession: 'overpriced coffee'
 *   }
 * };
 * ```
 */
export interface GenerationContext {
  /** Type of update: major (full refresh) or minor (time/weather only) */
  updateType: 'major' | 'minor';
  /** When generation was requested */
  timestamp: Date;
  /** Optional event data from Home Assistant or other triggers */
  eventData?: Record<string, unknown>;
  /** Optional last successful content, used for minor updates to preserve main content */
  previousContent?: GeneratedContent;
  /**
   * Optional personality dimensions for content generation.
   * If not provided, random dimensions will be generated automatically.
   */
  personality?: PersonalityDimensions;
  /**
   * Optional pre-fetched content data (weather, colors, etc.)
   * Provided by ContentDataProvider before generation to avoid duplicate fetches.
   */
  data?: ContentData;
}

/**
 * Metadata about content generation.
 *
 * Contains information about how the content was generated, including
 * AI model details and the prompts used for generation.
 *
 * @interface GenerationMetadata
 * @property {string} [model] - AI model identifier used for generation
 * @property {string} [tier] - Model tier (light/medium/heavy)
 * @property {string} [provider] - AI provider name (openai/anthropic)
 * @property {number} [tokensUsed] - Number of tokens consumed
 * @property {boolean} [failedOver] - Whether failover to alternate provider occurred
 * @property {string} [primaryError] - Error message from primary provider (if failover occurred)
 * @property {string} [systemPrompt] - System prompt sent to the AI provider
 * @property {string} [userPrompt] - User prompt sent to the AI provider
 *
 * @example
 * ```typescript
 * const metadata: GenerationMetadata = {
 *   model: 'gpt-4o',
 *   tier: 'medium',
 *   provider: 'openai',
 *   tokensUsed: 150,
 *   systemPrompt: 'You are a helpful assistant...',
 *   userPrompt: 'Generate a motivational quote about...'
 * };
 * ```
 */
export interface GenerationMetadata {
  /** AI model identifier used for generation */
  model?: string;
  /** Model tier (light/medium/heavy) */
  tier?: string;
  /** AI provider name (openai/anthropic) */
  provider?: string;
  /** Number of tokens consumed */
  tokensUsed?: number;
  /** Whether failover to alternate provider occurred */
  failedOver?: boolean;
  /** Error message from primary provider (if failover occurred) */
  primaryError?: string;
  /** System prompt sent to the AI provider */
  systemPrompt?: string;
  /** User prompt sent to the AI provider */
  userPrompt?: string;
  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * Content generated by a content generator.
 *
 * Represents the output from a content generation process, including both
 * the raw text and optional pre-formatted layout for Vestaboard display.
 *
 * @interface GeneratedContent
 * @property {string} text - Plain text content
 * @property {'text' | 'layout'} outputMode - Whether AI returned text or layout
 * @property {VestaboardLayout} [layout] - Optional pre-formatted layout for direct display
 * @property {GenerationMetadata} [metadata] - Optional metadata about generation
 *
 * @example
 * ```typescript
 * // Text-only content (will be formatted later)
 * const textContent: GeneratedContent = {
 *   text: 'Stay focused and keep moving forward!',
 *   outputMode: 'text'
 * };
 *
 * // Pre-formatted layout content with metadata including prompts
 * const layoutContent: GeneratedContent = {
 *   text: 'Formatted message',
 *   outputMode: 'layout',
 *   layout: {
 *     rows: ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6']
 *   },
 *   metadata: {
 *     model: 'gpt-4o',
 *     tier: 'medium',
 *     provider: 'openai',
 *     tokensUsed: 150,
 *     systemPrompt: 'You are a helpful assistant...',
 *     userPrompt: 'Generate a motivational quote...'
 *   }
 * };
 * ```
 */
export interface GeneratedContent {
  /** Plain text content */
  text: string;
  /** Whether the AI returned text (needs formatting) or layout (pre-formatted) */
  outputMode: 'text' | 'layout';
  /** Optional pre-formatted layout for direct Vestaboard display */
  layout?: VestaboardLayout;
  /** Optional metadata about generation (model, prompts, etc.) */
  metadata?: GenerationMetadata;
}

/**
 * Interface for content generators that produce Vestaboard content.
 *
 * Content generators implement this interface to provide AI-powered or
 * static content generation capabilities.
 *
 * @interface ContentGenerator
 *
 * @example
 * ```typescript
 * class MotivationalQuoteGenerator implements ContentGenerator {
 *   async generate(context: GenerationContext): Promise<GeneratedContent> {
 *     const quote = await this.fetchQuote();
 *     return {
 *       text: quote,
 *       outputMode: 'text'
 *     };
 *   }
 *
 *   validate(): GeneratorValidationResult {
 *     if (!this.apiKey) {
 *       return {
 *         valid: false,
 *         errors: ['Missing API key']
 *       };
 *     }
 *     return { valid: true };
 *   }
 * }
 * ```
 */
export interface ContentGenerator {
  /**
   * Generate content based on the provided context.
   *
   * @param {GenerationContext} context - Context information for content generation
   * @returns {Promise<GeneratedContent>} Generated content with text and optional layout
   *
   * @example
   * ```typescript
   * const content = await generator.generate({
   *   updateType: 'major',
   *   timestamp: new Date()
   * });
   * ```
   */
  generate(context: GenerationContext): Promise<GeneratedContent>;

  /**
   * Validate the generator configuration and dependencies.
   *
   * @returns {Promise<GeneratorValidationResult>} Validation result with any errors
   *
   * @example
   * ```typescript
   * const result = await generator.validate();
   * if (!result.valid) {
   *   console.error('Generator validation failed:', result.errors);
   * }
   * ```
   */
  validate(): Promise<GeneratorValidationResult>;
}

/**
 * Content priority levels for generator scheduling and execution.
 *
 * Lower numeric values represent higher priority. P0 (NOTIFICATION) preempts
 * all other content, while P3 (FALLBACK) is only used when other generators fail.
 *
 * @enum {number}
 *
 * @example
 * ```typescript
 * // Immediate notification for important events
 * const notification = ContentPriority.NOTIFICATION; // 0 (P0)
 *
 * // Standard content generation
 * const normal = ContentPriority.NORMAL; // 2 (P2)
 *
 * // Static fallback when AI fails
 * const fallback = ContentPriority.FALLBACK; // 3 (P3)
 *
 * // Priority comparison
 * if (notification < normal) {
 *   console.log('Notifications preempt normal content');
 * }
 * ```
 */
export enum ContentPriority {
  /** P0 - Immediate interrupts from Home Assistant events (highest priority) */
  NOTIFICATION = 0,
  /** P2 - Standard content generation (normal priority) */
  NORMAL = 2,
  /** P3 - Static fallback content when AI generation fails (lowest priority) */
  FALLBACK = 3,
}

/**
 * AI model performance tiers for content generation.
 *
 * Different content types may require different model capabilities.
 * Light models are fast and cheap, heavy models are more powerful.
 *
 * @enum {string}
 *
 * @example
 * ```typescript
 * // Fast, cheap models for simple content
 * const light = ModelTier.LIGHT; // 'light' (gpt-4.1-nano, haiku-4.5)
 *
 * // Balanced models for standard content
 * const medium = ModelTier.MEDIUM; // 'medium' (gpt-4.1-mini, sonnet-4.5)
 *
 * // Powerful models for complex content
 * const heavy = ModelTier.HEAVY; // 'heavy' (gpt-4.1, opus-4.5)
 * ```
 */
export enum ModelTier {
  /** Fast, cheap models (gpt-4.1-nano, claude-haiku-4.5) */
  LIGHT = 'light',
  /** Balanced models (gpt-4.1-mini, claude-sonnet-4.5) */
  MEDIUM = 'medium',
  /** Powerful models (gpt-4.1, claude-opus-4.5) */
  HEAVY = 'heavy',
}

/**
 * Registration metadata for a content generator.
 *
 * Describes a content generator's identity, capabilities, and behavior
 * in the content generation system.
 *
 * @interface ContentRegistration
 * @property {string} id - Unique identifier for the generator
 * @property {string} name - Human-readable name
 * @property {ContentPriority} priority - Default priority level for scheduling
 * @property {ModelTier} modelTier - AI model tier to use for generation
 * @property {boolean} [applyFrame=true] - Whether to apply time/weather frame around content
 * @property {RegExp} [eventTriggerPattern] - Optional pattern for P0 event matching
 * @property {string[]} [tags] - Optional categorization tags
 *
 * @example
 * ```typescript
 * // Standard content generator with frame
 * const motivationalReg: ContentRegistration = {
 *   id: 'motivational-quote',
 *   name: 'Motivational Quote Generator',
 *   priority: ContentPriority.NORMAL,
 *   modelTier: ModelTier.LIGHT,
 *   applyFrame: true, // Default: add time/weather frame
 *   tags: ['motivational', 'daily']
 * };
 *
 * // Event-triggered notification without frame
 * const doorNotification: ContentRegistration = {
 *   id: 'door-notification',
 *   name: 'Door Event Notification',
 *   priority: ContentPriority.NOTIFICATION,
 *   modelTier: ModelTier.LIGHT,
 *   applyFrame: false, // No frame for immediate notifications
 *   eventTriggerPattern: /^door\.(opened|closed)$/,
 *   tags: ['security', 'notification']
 * };
 *
 * // Static fallback content
 * const fallbackReg: ContentRegistration = {
 *   id: 'fallback-message',
 *   name: 'Static Fallback',
 *   priority: ContentPriority.FALLBACK,
 *   modelTier: ModelTier.LIGHT,
 *   tags: ['fallback', 'static']
 * };
 * ```
 */
export interface ContentRegistration {
  /** Unique identifier for the generator (e.g., 'motivational-quote') */
  id: string;
  /** Human-readable name (e.g., 'Motivational Quote Generator') */
  name: string;
  /** Default priority level for scheduling (lower = higher priority) */
  priority: ContentPriority;
  /** AI model tier to use (light/medium/heavy) */
  modelTier: ModelTier;
  /**
   * Whether to apply time/weather frame around generated content.
   * Defaults to true if not specified.
   */
  applyFrame?: boolean;
  /**
   * Optional RegExp pattern for matching P0 notification events.
   * When an event matches this pattern, this generator will be triggered immediately.
   */
  eventTriggerPattern?: RegExp;
  /**
   * Optional categorization tags for filtering and organization.
   */
  tags?: string[];
}
