/**
 * Dimension Substitutor
 *
 * Substitutes dimension constraints (maxChars, maxLines) into system prompt
 * template variables. Used to make Vestaboard display constraints configurable
 * rather than hardcoded in prompts.
 *
 * @module content/dimension-substitutor
 */

import { resolveTemplateVariables } from './personality/template-resolver.js';

/**
 * Options for dimension substitution.
 */
export interface DimensionOptions {
  /** Maximum characters per line (default: 21 for Vestaboard) */
  maxChars?: number;
  /** Maximum number of lines (default: 5 for content area) */
  maxLines?: number;
}

/**
 * Resolved dimension values with all fields present.
 */
export interface DimensionDefaults {
  maxChars: number;
  maxLines: number;
}

/**
 * Default dimension values for Vestaboard display.
 * - maxChars: 21 (22 total columns, minus 1 for frame/margin)
 * - maxLines: 5 (6 total rows, minus 1 for info bar)
 */
const DEFAULT_DIMENSIONS: DimensionDefaults = {
  maxChars: 21,
  maxLines: 5,
};

/**
 * Substitutes dimension template variables in prompt templates.
 *
 * Replaces {{maxChars}} and {{maxLines}} placeholders with configured
 * or default values. Works alongside other template variables which
 * are preserved for later resolution.
 *
 * @example
 * ```typescript
 * const substitutor = new DimensionSubstitutor();
 *
 * // Using defaults
 * const prompt = substitutor.substitute('Max {{maxChars}} chars, {{maxLines}} lines');
 * // 'Max 21 chars, 5 lines'
 *
 * // With custom values
 * const custom = substitutor.substitute('{{maxChars}} limit', { maxChars: 15 });
 * // '15 limit'
 * ```
 */
export class DimensionSubstitutor {
  private readonly defaults: DimensionDefaults;

  /**
   * Creates a new DimensionSubstitutor.
   *
   * @param defaultOverrides - Override default dimension values for all substitutions
   */
  constructor(defaultOverrides?: DimensionOptions) {
    this.defaults = {
      ...DEFAULT_DIMENSIONS,
      ...defaultOverrides,
    };
  }

  /**
   * Substitutes dimension variables in a template string.
   *
   * Replaces {{maxChars}} and {{maxLines}} with their values.
   * Other template variables (like {{mood}}) are preserved.
   *
   * @param template - Template string with {{maxChars}} and/or {{maxLines}} placeholders
   * @param options - Optional per-call dimension overrides
   * @returns Template with dimension variables substituted
   */
  substitute(template: string, options?: DimensionOptions): string {
    const dimensions = {
      ...this.defaults,
      ...options,
    };

    return resolveTemplateVariables(template, {
      maxChars: dimensions.maxChars,
      maxLines: dimensions.maxLines,
    });
  }

  /**
   * Returns the default dimension values.
   *
   * @returns Object with maxChars and maxLines defaults
   */
  getDefaults(): DimensionDefaults {
    return { ...this.defaults };
  }
}
