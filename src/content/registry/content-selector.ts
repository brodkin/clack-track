/**
 * Content Selector Module
 *
 * Provides priority-based content generator selection with P0/P2/P3 logic:
 * - P0 (NOTIFICATION): Event-triggered immediate notifications
 * - P2 (NORMAL): Standard content generation with random selection
 * - P3 (FALLBACK): Static fallback when other generators unavailable
 *
 * @module content/registry/content-selector
 */

import type { GenerationContext } from '../../types/content-generator.js';
import { ContentPriority } from '../../types/content-generator.js';
import { ContentRegistry, type RegisteredGenerator } from './content-registry.js';

/**
 * Selects appropriate content generators based on priority and context.
 *
 * Implements a cascading selection strategy:
 * 1. P0 (NOTIFICATION): If event data exists, check for matching event patterns
 * 2. P2 (NORMAL): Select randomly from available normal-priority generators
 * 3. P3 (FALLBACK): Return first fallback generator if no P2 available
 * 4. Return null if no generators can be selected
 *
 * @class ContentSelector
 *
 * @example
 * ```typescript
 * const registry = ContentRegistry.getInstance();
 * const selector = new ContentSelector(registry);
 *
 * // P0 selection with event data
 * const notificationContext = {
 *   updateType: 'major',
 *   timestamp: new Date(),
 *   eventData: { event_type: 'door.opened' }
 * };
 * const p0Generator = selector.select(notificationContext);
 *
 * // P2 selection without event data
 * const normalContext = {
 *   updateType: 'major',
 *   timestamp: new Date()
 * };
 * const p2Generator = selector.select(normalContext);
 * ```
 */
export class ContentSelector {
  /**
   * Create a new ContentSelector.
   *
   * @param {ContentRegistry} registry - The content registry to select from
   *
   * @example
   * ```typescript
   * const registry = ContentRegistry.getInstance();
   * const selector = new ContentSelector(registry);
   * ```
   */
  constructor(private readonly registry: ContentRegistry) {}

  /**
   * Select a content generator based on context and priority rules.
   *
   * Priority selection order:
   * 1. **P0 (NOTIFICATION)**: If context.eventData exists, checks for generators
   *    with eventTriggerPattern matching the event. Returns first match.
   * 2. **P2 (NORMAL)**: If no P0 match, selects randomly from P2 generators.
   * 3. **P3 (FALLBACK)**: If no P2 available, returns first P3 generator.
   * 4. **null**: No generators available.
   *
   * Event matching logic:
   * - Extracts event identifier from eventData.event_type or eventData.entity_id
   * - Tests against each P0 generator's eventTriggerPattern regex
   * - First matching pattern wins
   *
   * @param {GenerationContext} context - Generation context with event data and timing
   * @returns {RegisteredGenerator | null} Selected generator or null if none available
   *
   * @example
   * ```typescript
   * // P0 selection with matching event
   * const result = selector.select({
   *   updateType: 'major',
   *   timestamp: new Date(),
   *   eventData: { event_type: 'door.opened' }
   * });
   * // Returns door notification generator if pattern matches
   *
   * // P2 selection (no event data)
   * const result = selector.select({
   *   updateType: 'major',
   *   timestamp: new Date()
   * });
   * // Returns random P2 generator
   *
   * // P3 fallback
   * const result = selector.select({
   *   updateType: 'major',
   *   timestamp: new Date()
   * });
   * // Returns first P3 if no P2 available
   * ```
   */
  public select(context: GenerationContext): RegisteredGenerator | null {
    // P0 (NOTIFICATION): Check for event-triggered notifications
    if (context.eventData) {
      const eventIdentifier = this.extractEventIdentifier(context.eventData);
      if (eventIdentifier) {
        const p0Generators = this.registry.getByPriority(ContentPriority.NOTIFICATION);

        for (const generator of p0Generators) {
          const pattern = generator.registration.eventTriggerPattern;
          if (pattern && pattern.test(eventIdentifier)) {
            return generator;
          }
        }
      }
    }

    // P2 (NORMAL): Random selection from normal-priority generators
    const p2Generators = this.registry.getByPriority(ContentPriority.NORMAL);
    if (p2Generators.length > 0) {
      const randomIndex = Math.floor(Math.random() * p2Generators.length);
      return p2Generators[randomIndex];
    }

    // P3 (FALLBACK): Return first fallback generator
    const p3Generators = this.registry.getByPriority(ContentPriority.FALLBACK);
    if (p3Generators.length > 0) {
      return p3Generators[0];
    }

    // No generators available
    return null;
  }

  /**
   * Extract event identifier from event data.
   *
   * Checks for event_type first, then falls back to entity_id.
   *
   * @private
   * @param {Record<string, unknown>} eventData - Event data object
   * @returns {string | null} Event identifier or null if not found
   */
  private extractEventIdentifier(eventData: Record<string, unknown>): string | null {
    if (typeof eventData.event_type === 'string') {
      return eventData.event_type;
    }
    if (typeof eventData.entity_id === 'string') {
      return eventData.entity_id;
    }
    return null;
  }
}
