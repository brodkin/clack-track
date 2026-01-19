import type { GeneratedContent } from './content-generator.js';

export interface VestaboardContent {
  text: string;
  layout?: VestaboardLayout;
  metadata?: {
    generatedAt: Date;
    aiProvider?: string;
    updateType: 'major' | 'minor';
  };
}

export interface VestaboardLayout {
  rows: string[];
  characterCodes?: number[][];
}

export interface ContentGenerationContext {
  type: 'major' | 'minor';
  eventData?: Record<string, unknown>;
  previousContent?: VestaboardContent;
  dataSources?: {
    rss?: unknown[];
    weather?: unknown;
    news?: unknown[];
  };
}

/**
 * Block reasons for when content generation is blocked
 * - 'master_circuit_off' - Master circuit is OFF, blocking all updates
 * - 'provider_unavailable' - All AI providers are unavailable (circuits open)
 */
export type BlockReason = 'master_circuit_off' | 'provider_unavailable';

/**
 * Circuit state information for diagnostics
 */
export interface CircuitStateInfo {
  /** Whether the master circuit is enabled (true = ON, false = OFF) */
  master: boolean;
  /** Provider circuit ID that was checked (if applicable) */
  provider?: string;
}

/**
 * Result from ContentOrchestrator.generateAndSend()
 *
 * Provides structured information about the generation outcome including
 * success/failure status, blocking reasons, and circuit state.
 *
 * @interface OrchestratorResult
 * @property {boolean} success - Whether content was successfully generated and sent
 * @property {GeneratedContent} [content] - The generated content (when successful)
 * @property {boolean} [blocked] - Whether generation was blocked by circuit breaker
 * @property {BlockReason} [blockReason] - Reason for blocking (when blocked)
 * @property {CircuitStateInfo} [circuitState] - Circuit state at time of check
 *
 * @example
 * ```typescript
 * // Successful generation
 * const result: OrchestratorResult = {
 *   success: true,
 *   content: { text: 'Hello world', outputMode: 'text' }
 * };
 *
 * // Blocked by master circuit
 * const blockedResult: OrchestratorResult = {
 *   success: false,
 *   blocked: true,
 *   blockReason: 'master_circuit_off',
 *   circuitState: { master: false }
 * };
 * ```
 */
export interface OrchestratorResult {
  /** Whether content was successfully generated and sent */
  success: boolean;
  /** The generated content (when successful) */
  content?: GeneratedContent;
  /** Whether generation was blocked by circuit breaker */
  blocked?: boolean;
  /** Reason for blocking (when blocked) */
  blockReason?: BlockReason;
  /** Circuit state at time of check */
  circuitState?: CircuitStateInfo;
}
