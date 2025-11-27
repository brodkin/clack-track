/**
 * Static Fallback Generator
 *
 * P3 (lowest priority) content generator that reads static .txt files from a directory
 * and returns random content when all other generators fail.
 *
 * This generator provides a reliable fallback mechanism by serving pre-written
 * content stored in text files, ensuring the Vestaboard always has something to display
 * even when AI services are unavailable or all other content sources have failed.
 *
 * @module content/generators/static-fallback-generator
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
} from '../../types/content-generator.js';

/**
 * StaticFallbackGenerator - P3 fallback content from static text files.
 *
 * Reads .txt files from a configured directory and returns random content
 * when invoked. Used as the last resort when all other content generators fail.
 *
 * @implements {ContentGenerator}
 *
 * @example
 * ```typescript
 * // Default directory (prompts/static/)
 * const fallback = new StaticFallbackGenerator();
 *
 * // Custom directory
 * const customFallback = new StaticFallbackGenerator('custom/fallback/path');
 *
 * // Validate before use
 * const validation = fallback.validate();
 * if (!validation.valid) {
 *   console.error('Fallback not ready:', validation.errors);
 * }
 *
 * // Generate content
 * const content = await fallback.generate({
 *   updateType: 'major',
 *   timestamp: new Date()
 * });
 * ```
 */
export class StaticFallbackGenerator implements ContentGenerator {
  private readonly fallbackDirectory: string;

  /**
   * Create a new StaticFallbackGenerator.
   *
   * @param {string} fallbackDirectory - Directory containing .txt fallback files
   *                                      (defaults to 'prompts/static')
   */
  constructor(fallbackDirectory: string = 'prompts/static') {
    this.fallbackDirectory = fallbackDirectory;
  }

  /**
   * Validate that the fallback directory exists and contains .txt files.
   *
   * This is an asynchronous validation check that verifies the generator
   * can successfully produce content when needed.
   *
   * @returns {Promise<GeneratorValidationResult>} Validation result with any errors
   *
   * @example
   * ```typescript
   * const generator = new StaticFallbackGenerator();
   * const result = await generator.validate();
   *
   * if (result.valid) {
   *   console.log('Fallback generator ready');
   * } else {
   *   console.error('Validation failed:', result.errors);
   * }
   * ```
   */
  async validate(): Promise<GeneratorValidationResult> {
    const errors: string[] = [];

    if (!this.fallbackDirectory || this.fallbackDirectory.trim() === '') {
      errors.push('Fallback directory path is empty');
      return {
        valid: false,
        errors,
      };
    }

    try {
      // Check that directory exists and is readable
      const files = await fs.readdir(this.fallbackDirectory);

      // Filter for .txt files only
      const txtFiles = files.filter(file => file.endsWith('.txt'));

      if (txtFiles.length === 0) {
        errors.push(`No .txt files found in fallback directory: ${this.fallbackDirectory}`);
      }
    } catch {
      // Error details not needed - we just need to report directory is not accessible
      errors.push(`Fallback directory not accessible: ${this.fallbackDirectory}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate content by reading a random .txt file from the fallback directory.
   *
   * Selects a random .txt file from the configured directory and returns its
   * contents as static fallback content. The content is trimmed of whitespace
   * and returned with metadata about the source.
   *
   * @param {GenerationContext} _context - Generation context (unused for static content)
   * @returns {Promise<GeneratedContent>} Generated fallback content
   * @throws {Error} If directory doesn't exist, has no .txt files, or file read fails
   *
   * @example
   * ```typescript
   * const generator = new StaticFallbackGenerator();
   * const content = await generator.generate({
   *   updateType: 'major',
   *   timestamp: new Date()
   * });
   *
   * console.log('Fallback content:', content.text);
   * console.log('Source directory:', content.metadata?.directory);
   * ```
   */
  async generate(_context: GenerationContext): Promise<GeneratedContent> {
    // Read all files in the directory
    const files = await fs.readdir(this.fallbackDirectory);

    // Filter for .txt files only
    const txtFiles = files.filter(file => file.endsWith('.txt'));

    if (txtFiles.length === 0) {
      throw new Error(`No .txt files found in fallback directory: ${this.fallbackDirectory}`);
    }

    // Select a random .txt file
    const randomIndex = Math.floor(Math.random() * txtFiles.length);
    const selectedFile = txtFiles[randomIndex];

    // Read the file content
    const filePath = join(this.fallbackDirectory, selectedFile);
    const content = await fs.readFile(filePath, 'utf-8');

    // Return as generated content
    return {
      text: content.trim(),
      outputMode: 'text',
      metadata: {
        source: 'static-fallback',
        directory: this.fallbackDirectory,
        file: selectedFile,
      },
    };
  }
}
