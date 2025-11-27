/**
 * Base class for P0 notification generators triggered by Home Assistant events.
 *
 * Provides a foundation for content generators that respond to specific Home Assistant
 * events (e.g., person arrived, door opened) with immediate, high-priority notifications.
 * These are P0 (NOTIFICATION priority) generators that interrupt any other content.
 *
 * @module content/generators/notification-generator
 */

import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
} from '@/types/content-generator.js';

/**
 * Abstract base class for Home Assistant event-triggered notifications.
 *
 * Implements the ContentGenerator interface with specialized behavior for P0 priority
 * notifications. Subclasses define an event pattern to match specific Home Assistant
 * event types and implement formatNotification() to convert event data into display text.
 *
 * @abstract
 * @implements {ContentGenerator}
 *
 * @example
 * ```typescript
 * class PersonArrivedNotification extends NotificationGenerator {
 *   protected eventPattern = /^person\.arrived$/;
 *
 *   protected formatNotification(eventData: Record<string, unknown>): string {
 *     const personName = (eventData.entity_id as string)?.split('.')[1] || 'Someone';
 *     return `Welcome home, ${personName}!`;
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * class DoorNotification extends NotificationGenerator {
 *   protected eventPattern = /^(door\.opened|door\.closed)$/;
 *
 *   protected formatNotification(eventData: Record<string, unknown>): string {
 *     const eventType = eventData.event_type as string;
 *     const action = eventType?.includes('opened') ? 'opened' : 'closed';
 *     const doorName = (eventData.entity_id as string)?.split('.')[1] || 'door';
 *     return `The ${doorName} was ${action}`;
 *   }
 * }
 * ```
 */
export abstract class NotificationGenerator implements ContentGenerator {
  /**
   * Regular expression pattern to match Home Assistant event types.
   *
   * This pattern is tested against the event_type field in event data to determine
   * if this generator should handle the event. Use simple patterns like /^person\.arrived$/
   * or compound patterns like /^(door\.opened|door\.closed)$/.
   *
   * @abstract
   * @protected
   *
   * @example
   * ```typescript
   * // Simple pattern
   * protected eventPattern = /^person\.arrived$/;
   *
   * // Compound pattern
   * protected eventPattern = /^(door\.opened|door\.closed|window\.opened)$/;
   * ```
   */
  protected abstract eventPattern: RegExp;

  /**
   * Format notification text from Home Assistant event data.
   *
   * Subclasses implement this method to convert raw event data into human-readable
   * notification text suitable for Vestaboard display. The implementation should
   * extract relevant fields from eventData and format them appropriately.
   *
   * @abstract
   * @protected
   * @param {Record<string, unknown>} eventData - Home Assistant event payload
   * @returns {string} Formatted notification text for display
   *
   * @example
   * ```typescript
   * protected formatNotification(eventData: Record<string, unknown>): string {
   *   const personName = (eventData.entity_id as string)?.split('.')[1] || 'Someone';
   *   return `Welcome home, ${personName}!`;
   * }
   * ```
   */
  protected abstract formatNotification(eventData: Record<string, unknown>): string;

  /**
   * Check if a given event type matches this generator's pattern.
   *
   * Utility method for testing whether a specific Home Assistant event type
   * would trigger this notification generator. Useful for orchestration logic
   * to route events to the appropriate generator.
   *
   * @param {string} eventType - Home Assistant event type (e.g., 'person.arrived')
   * @returns {boolean} True if event type matches the pattern, false otherwise
   *
   * @example
   * ```typescript
   * const generator = new PersonArrivedNotification();
   * generator.matchesEvent('person.arrived'); // true
   * generator.matchesEvent('person.left'); // false
   * ```
   */
  matchesEvent(eventType: string): boolean {
    return this.eventPattern.test(eventType);
  }

  /**
   * Validate the generator configuration.
   *
   * Checks that the eventPattern is a valid RegExp instance. Subclasses can
   * override this method to add additional validation (e.g., required configuration,
   * API keys, etc.).
   *
   * @returns {GeneratorValidationResult} Validation result with any errors
   *
   * @example
   * ```typescript
   * const generator = new PersonArrivedNotification();
   * const result = generator.validate();
   * if (!result.valid) {
   *   console.error('Validation failed:', result.errors);
   * }
   * ```
   */
  validate(): GeneratorValidationResult {
    if (!(this.eventPattern instanceof RegExp)) {
      return {
        valid: false,
        errors: ['eventPattern must be a valid RegExp instance'],
      };
    }

    return { valid: true };
  }

  /**
   * Generate notification content from Home Assistant event data.
   *
   * Extracts eventData from the generation context and delegates to the
   * abstract formatNotification() method to produce the notification text.
   * Returns formatted content ready for Vestaboard display.
   *
   * @param {GenerationContext} context - Context information including event data
   * @returns {Promise<GeneratedContent>} Generated notification content
   * @throws {Error} If eventData is missing from context
   *
   * @example
   * ```typescript
   * const generator = new PersonArrivedNotification();
   * const context = {
   *   updateType: 'major',
   *   timestamp: new Date(),
   *   eventData: {
   *     event_type: 'person.arrived',
   *     entity_id: 'person.john'
   *   }
   * };
   *
   * const content = await generator.generate(context);
   * // content.text: 'Welcome home, john!'
   * // content.outputMode: 'text'
   * ```
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Extract event data from context
    if (!context.eventData) {
      throw new Error('NotificationGenerator requires eventData in context');
    }

    // Delegate to abstract formatNotification method
    const notificationText = this.formatNotification(context.eventData);

    // Return formatted content
    return {
      text: notificationText,
      outputMode: 'text',
    };
  }
}
