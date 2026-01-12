/**
 * FrameDecorator - Post-generation decoration service for Vestaboard frames
 *
 * Wraps the existing generateFrame() function with optional dependency injection
 * for HomeAssistantClient (weather data) and AIProvider (color bar generation).
 *
 * Design Patterns:
 * - Dependency Inversion Principle: Depends on abstractions (interfaces), not concrete types
 * - Single Responsibility: Focused on decorating frames with time/weather data
 * - Graceful Degradation: Functions without dependencies, degrades features gracefully
 *
 * @example
 * ```typescript
 * // Minimal usage (no dependencies)
 * const decorator = new FrameDecorator();
 * const result = await decorator.decorate('HELLO WORLD');
 *
 * // With dependencies for full features
 * const decorator = new FrameDecorator({
 *   homeAssistant: haClient,
 *   aiProvider: openAIClient
 * });
 * const result = await decorator.decorate('CONTENT', new Date());
 * ```
 */

import { generateFrame, type FrameResult, type FrameOptions } from './frame-generator.js';
import type { HomeAssistantClient } from '../../api/data-sources/home-assistant.js';
import type { AIProvider } from '../../types/ai.js';
import type { ContentData } from '../../types/content-data.js';
import type { GeneratorFormatOptions } from '../../types/content-generator.js';

/**
 * Configuration options for FrameDecorator
 */
export interface FrameDecoratorConfig {
  /** Optional HomeAssistantClient for weather data (graceful degradation if unavailable) */
  homeAssistant?: HomeAssistantClient;
  /** Optional AIProvider for seasonal color bar generation (graceful degradation if unavailable) */
  aiProvider?: AIProvider;
}

/**
 * FrameDecorator service for wrapping generateFrame() with optional dependencies
 */
export class FrameDecorator {
  private homeAssistant?: HomeAssistantClient;
  private aiProvider?: AIProvider;

  /**
   * Create a new FrameDecorator instance
   *
   * @param config - Optional configuration with HomeAssistantClient and/or AIProvider
   */
  constructor(config?: FrameDecoratorConfig) {
    this.homeAssistant = config?.homeAssistant;
    this.aiProvider = config?.aiProvider;
  }

  /**
   * Decorate text content into a complete Vestaboard frame
   *
   * Wraps the existing generateFrame() function, passing through optional dependencies
   * for weather data and color bar generation. Gracefully degrades if dependencies
   * are unavailable or throw errors.
   *
   * @param text - Content text to display (will be word-wrapped and formatted)
   * @param dateTime - Optional date/time for info bar (defaults to current time)
   * @param contentData - Optional pre-fetched content data (weather, colors) to avoid duplicate fetches
   * @param formatOptions - Optional formatting options (alignment, wordWrap) from generator registration
   * @returns FrameResult with 6×22 layout and any warnings
   *
   * @example
   * ```typescript
   * const decorator = new FrameDecorator({ homeAssistant: haClient });
   * const result = await decorator.decorate('HELLO WORLD');
   * console.log(result.layout); // 6×22 array ready for Vestaboard
   * console.log(result.warnings); // Any warnings from processing
   * ```
   */
  async decorate(
    text: string,
    dateTime?: Date,
    contentData?: ContentData,
    formatOptions?: GeneratorFormatOptions
  ): Promise<FrameResult> {
    try {
      // Prepare options for generateFrame
      const options: FrameOptions = {
        text,
        homeAssistant: this.homeAssistant,
        aiProvider: this.aiProvider,
        dateTime: dateTime,
        weather: contentData?.weather,
        colorBar: contentData?.colorBar,
        formatOptions,
      };

      // Call existing generateFrame function with optional dependencies
      const result = await generateFrame(options);

      return result;
    } catch (error) {
      // Graceful degradation: if generateFrame fails entirely, return minimal frame
      // This should rarely happen as generateFrame has its own error handling
      const fallbackResult: FrameResult = {
        layout: this.createFallbackLayout(text),
        warnings: [
          `Frame generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };

      return fallbackResult;
    }
  }

  /**
   * Create a minimal fallback layout in case generateFrame fails
   * This ensures we always return a valid 6×22 frame even in catastrophic failures
   */
  private createFallbackLayout(text: string): number[][] {
    // Create a 6×22 grid filled with spaces (code 0)
    const layout: number[][] = [];

    for (let row = 0; row < 6; row++) {
      const rowData: number[] = [];
      for (let col = 0; col < 22; col++) {
        rowData.push(0); // Space character code
      }
      layout.push(rowData);
    }

    // Attempt to show first line of text in row 0 (basic fallback)
    const firstLine = text.substring(0, 22).toUpperCase();
    for (let i = 0; i < firstLine.length && i < 22; i++) {
      const char = firstLine[i];
      // Simple ASCII code mapping for fallback (A=1, B=2, etc.)
      const code = this.charToSimpleCode(char);
      layout[0][i] = code;
    }

    return layout;
  }

  /**
   * Simple character to code conversion for fallback layout
   * Uses basic mapping: A=1, B=2, ..., Z=26, space=0
   */
  private charToSimpleCode(char: string): number {
    if (char === ' ') return 0;
    const upperChar = char.toUpperCase();
    const code = upperChar.charCodeAt(0);

    // A-Z range
    if (code >= 65 && code <= 90) {
      return code - 64; // A=1, B=2, ..., Z=26
    }

    // Default to space for unsupported characters
    return 0;
  }
}
