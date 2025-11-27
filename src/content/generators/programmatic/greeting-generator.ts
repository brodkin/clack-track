/**
 * GreetingGenerator - Time-based greeting generator
 *
 * Generates greetings based on the time of day using context.timestamp.
 * No external dependencies required.
 *
 * Time-based greetings:
 * - 5am-12pm: "Good morning!"
 * - 12pm-5pm: "Good afternoon!"
 * - 5pm-9pm: "Good evening!"
 * - 9pm-5am: "Good night!"
 *
 * @module content/generators/programmatic/greeting-generator
 */

import { ProgrammaticGenerator } from '../programmatic-generator.js';
import type { GenerationContext, GeneratedContent } from '../../../types/content-generator.js';

/**
 * Generates time-based greetings for Vestaboard display.
 *
 * Uses the timestamp from GenerationContext to determine appropriate
 * greeting based on time of day. Simple, deterministic, no external deps.
 *
 * @extends ProgrammaticGenerator
 *
 * @example
 * ```typescript
 * const generator = new GreetingGenerator();
 *
 * const morningContext = {
 *   updateType: 'major' as const,
 *   timestamp: new Date('2024-01-15T09:00:00')
 * };
 *
 * const content = await generator.generate(morningContext);
 * // content.text: "Good morning!"
 * ```
 */
export class GreetingGenerator extends ProgrammaticGenerator {
  /**
   * Generate time-based greeting.
   *
   * Determines appropriate greeting based on hour from context.timestamp:
   * - Morning (5-11): "Good morning!"
   * - Afternoon (12-16): "Good afternoon!"
   * - Evening (17-20): "Good evening!"
   * - Night (21-4): "Good night!"
   *
   * @param {GenerationContext} context - Generation context with timestamp
   * @returns {Promise<GeneratedContent>} Generated greeting content
   *
   * @example
   * ```typescript
   * const generator = new GreetingGenerator();
   *
   * // Morning greeting
   * const result = await generator.generate({
   *   updateType: 'major',
   *   timestamp: new Date('2024-01-15T08:00:00')
   * });
   * // result.text: "Good morning!"
   *
   * // Evening greeting
   * const result2 = await generator.generate({
   *   updateType: 'major',
   *   timestamp: new Date('2024-01-15T19:00:00')
   * });
   * // result2.text: "Good evening!"
   * ```
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    const hour = context.timestamp.getHours();

    let greeting: string;

    if (hour >= 5 && hour < 12) {
      greeting = 'Good morning!';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon!';
    } else if (hour >= 17 && hour < 21) {
      greeting = 'Good evening!';
    } else {
      greeting = 'Good night!';
    }

    return {
      text: greeting,
      outputMode: 'text',
    };
  }
}
