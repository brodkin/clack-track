/**
 * Register Notifications Module
 *
 * Provides registration function for P0 Home Assistant notification generators.
 *
 * @module content/registry/register-notifications
 */

import type { ContentGenerator, ContentRegistration } from '../../types/content-generator.js';
import { ContentPriority, ModelTier } from '../../types/content-generator.js';
import type { ContentRegistry } from './content-registry.js';

/**
 * Factory interface for creating notification generators.
 *
 * @interface NotificationGeneratorFactory
 * @property {function} create - Creates a notification generator for a given event pattern
 *
 * @example
 * ```typescript
 * const factory: NotificationGeneratorFactory = {
 *   create: (eventPattern: string, displayName: string) => {
 *     return new HANotificationGenerator(eventPattern, displayName);
 *   }
 * };
 * ```
 */
export interface NotificationGeneratorFactory {
  /**
   * Create a notification generator for a specific event pattern.
   *
   * @param {RegExp} eventPattern - Regular expression pattern for matching Home Assistant events
   * @param {string} displayName - Human-readable name for the generator
   * @returns {ContentGenerator} Content generator instance
   */
  create(eventPattern: RegExp, displayName: string): ContentGenerator;
}

/**
 * Notification configuration entry.
 *
 * @interface NotificationConfig
 * @private
 */
interface NotificationConfig {
  /** Unique identifier for the notification type */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** RegExp pattern for matching Home Assistant entity IDs */
  pattern: RegExp;
}

/**
 * Default P0 notification configurations for Home Assistant events.
 *
 * These are the highest priority content generators (P0) that trigger
 * immediately when matching Home Assistant events occur.
 *
 * @constant
 * @private
 */
const NOTIFICATION_CONFIGS: NotificationConfig[] = [
  {
    id: 'ha-notification-door',
    displayName: 'Door Notification',
    pattern: /^binary_sensor\..*_door$/,
  },
  {
    id: 'ha-notification-person',
    displayName: 'Person Notification',
    pattern: /^person\..*$/,
  },
  {
    id: 'ha-notification-motion',
    displayName: 'Motion Notification',
    pattern: /^binary_sensor\..*_motion$/,
  },
  {
    id: 'ha-notification-garage',
    displayName: 'Garage Notification',
    pattern: /^cover\..*garage.*$/i,
  },
];

/**
 * Register P0 Home Assistant notification generators.
 *
 * Registers default notification generators for common Home Assistant events:
 * - Door events (binary_sensor.*_door)
 * - Person arrival (person.*)
 * - Motion detection (binary_sensor.*_motion)
 * - Garage events (cover.*garage*)
 *
 * All notification generators are registered with:
 * - Priority: P0 (NOTIFICATION) - highest priority, preempts all other content
 * - Model Tier: LIGHT - fast, cheap models for quick notifications
 * - Apply Frame: false - immediate display without time/weather frame
 * - Tags: ['notification', 'home-assistant']
 *
 * @param {ContentRegistry} registry - Content registry singleton instance
 * @param {NotificationGeneratorFactory} notificationGeneratorFactory - Factory for creating notification generators
 *
 * @example
 * ```typescript
 * import { ContentRegistry } from './content-registry.js';
 * import { registerNotifications } from './register-notifications.js';
 * import { HANotificationGeneratorFactory } from '../generators/ha-notification-factory.js';
 *
 * const registry = ContentRegistry.getInstance();
 * const factory = new HANotificationGeneratorFactory();
 *
 * registerNotifications(registry, factory);
 *
 * // Find door notification generator
 * const doorGen = registry.getById('ha-notification-door');
 *
 * // Find generators matching a specific event
 * const handlers = registry.getByEventPattern('binary_sensor.front_door');
 * ```
 */
export function registerNotifications(
  registry: ContentRegistry,
  notificationGeneratorFactory: NotificationGeneratorFactory
): void {
  NOTIFICATION_CONFIGS.forEach(config => {
    // Create generator instance via factory
    const generator = notificationGeneratorFactory.create(config.pattern, config.displayName);

    // Build registration metadata
    const registration: ContentRegistration = {
      id: config.id,
      name: config.displayName,
      priority: ContentPriority.NOTIFICATION,
      modelTier: ModelTier.LIGHT,
      applyFrame: false,
      eventTriggerPattern: config.pattern,
      tags: ['notification', 'home-assistant'],
    };

    // Register with the content registry
    registry.register(registration, generator);
  });
}
