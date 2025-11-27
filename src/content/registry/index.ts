/**
 * Content Registry Module
 *
 * This module provides the content generator registration and selection system
 * for the Clack Track application.
 *
 * Core Components:
 * - ContentRegistry: Singleton registry for managing content generators
 * - ContentSelector: Priority-based generator selection (P0/P2/P3)
 * - registerCoreContent: Registers built-in P2/P3 generators
 * - registerNotifications: Registers P0 Home Assistant notification generators
 *
 * @module content/registry
 *
 * @example
 * ```typescript
 * import {
 *   ContentRegistry,
 *   ContentSelector,
 *   registerCoreContent,
 *   registerNotifications
 * } from './content/registry/index.js';
 *
 * // Get registry instance
 * const registry = ContentRegistry.getInstance();
 *
 * // Register core content generators
 * registerCoreContent(registry, coreGenerators);
 *
 * // Register notification generators
 * registerNotifications(registry, notificationFactory);
 *
 * // Create selector and select content
 * const selector = new ContentSelector(registry);
 * const generator = selector.select(context);
 * ```
 */

// Core registry singleton
export { ContentRegistry, type RegisteredGenerator } from './content-registry.js';

// Priority-based selection
export { ContentSelector } from './content-selector.js';

// Registration functions
export { registerCoreContent, type CoreGenerators } from './register-core.js';
export {
  registerNotifications,
  type NotificationGeneratorFactory,
} from './register-notifications.js';
