/**
 * Content Registry Module
 *
 * Provides a singleton registry for managing content generators with
 * registration, lookup, and filtering capabilities.
 *
 * @module content/registry/content-registry
 */

import type {
  ContentGenerator,
  ContentRegistration,
  ContentPriority,
} from '../../types/content-generator.js';

/**
 * Registered generator entry combining registration metadata and generator instance.
 *
 * @interface RegisteredGenerator
 * @property {ContentRegistration} registration - Generator registration metadata
 * @property {ContentGenerator} generator - The content generator instance
 *
 * @example
 * ```typescript
 * const registered: RegisteredGenerator = {
 *   registration: {
 *     id: 'motivational-quote',
 *     name: 'Motivational Quote Generator',
 *     priority: ContentPriority.NORMAL,
 *     modelTier: ModelTier.LIGHT
 *   },
 *   generator: new MotivationalQuoteGenerator()
 * };
 * ```
 */
export interface RegisteredGenerator {
  /** Generator registration metadata */
  registration: ContentRegistration;
  /** The content generator instance */
  generator: ContentGenerator;
}

/**
 * Singleton registry for managing content generators.
 *
 * Provides centralized registration and lookup for all content generators
 * in the system. Supports filtering by priority, event patterns, and ID.
 *
 * @class ContentRegistry
 *
 * @example
 * ```typescript
 * // Get singleton instance
 * const registry = ContentRegistry.getInstance();
 *
 * // Register a generator
 * registry.register({
 *   id: 'motivational-quote',
 *   name: 'Motivational Quote Generator',
 *   priority: ContentPriority.NORMAL,
 *   modelTier: ModelTier.LIGHT
 * }, new MotivationalQuoteGenerator());
 *
 * // Find generators by priority
 * const normalGenerators = registry.getByPriority(ContentPriority.NORMAL);
 *
 * // Find generators matching an event
 * const doorHandlers = registry.getByEventPattern('door.opened');
 * ```
 */
export class ContentRegistry {
  /** Singleton instance */
  private static instance: ContentRegistry | null = null;

  /** Map of generator ID to registered generator */
  private generators: Map<string, RegisteredGenerator> = new Map();

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {}

  /**
   * Get the singleton instance of ContentRegistry.
   *
   * @returns {ContentRegistry} The singleton registry instance
   *
   * @example
   * ```typescript
   * const registry = ContentRegistry.getInstance();
   * ```
   */
  public static getInstance(): ContentRegistry {
    if (!ContentRegistry.instance) {
      ContentRegistry.instance = new ContentRegistry();
    }
    return ContentRegistry.instance;
  }

  /**
   * Reset the singleton instance.
   *
   * **FOR TESTING ONLY** - Clears the singleton and all registered generators.
   * Use this in test cleanup to ensure isolation between tests.
   *
   * @example
   * ```typescript
   * afterEach(() => {
   *   ContentRegistry.reset();
   * });
   * ```
   */
  public static reset(): void {
    if (ContentRegistry.instance) {
      ContentRegistry.instance.generators.clear();
    }
    ContentRegistry.instance = null;
  }

  /**
   * Register a content generator.
   *
   * @param {ContentRegistration} registration - Generator registration metadata
   * @param {ContentGenerator} generator - The content generator instance
   * @throws {Error} If a generator with the same ID is already registered
   *
   * @example
   * ```typescript
   * registry.register({
   *   id: 'motivational-quote',
   *   name: 'Motivational Quote Generator',
   *   priority: ContentPriority.NORMAL,
   *   modelTier: ModelTier.LIGHT
   * }, new MotivationalQuoteGenerator());
   * ```
   */
  public register(registration: ContentRegistration, generator: ContentGenerator): void {
    if (this.generators.has(registration.id)) {
      throw new Error(`Generator with ID "${registration.id}" is already registered`);
    }

    this.generators.set(registration.id, {
      registration,
      generator,
    });
  }

  /**
   * Unregister a content generator.
   *
   * @param {string} id - The generator ID to unregister
   * @returns {boolean} True if the generator was removed, false if not found
   *
   * @example
   * ```typescript
   * const removed = registry.unregister('motivational-quote');
   * if (removed) {
   *   console.log('Generator removed successfully');
   * }
   * ```
   */
  public unregister(id: string): boolean {
    return this.generators.delete(id);
  }

  /**
   * Get all registered generators.
   *
   * @returns {RegisteredGenerator[]} Array of all registered generators
   *
   * @example
   * ```typescript
   * const allGenerators = registry.getAll();
   * console.log(`Total generators: ${allGenerators.length}`);
   * ```
   */
  public getAll(): RegisteredGenerator[] {
    return Array.from(this.generators.values());
  }

  /**
   * Get a registered generator by ID.
   *
   * @param {string} id - The generator ID to lookup
   * @returns {RegisteredGenerator | undefined} The registered generator or undefined if not found
   *
   * @example
   * ```typescript
   * const generator = registry.getById('motivational-quote');
   * if (generator) {
   *   const content = await generator.generator.generate(context);
   * }
   * ```
   */
  public getById(id: string): RegisteredGenerator | undefined {
    return this.generators.get(id);
  }

  /**
   * Get all generators with a specific priority level.
   *
   * @param {ContentPriority} priority - The priority level to filter by (P0, P2, P3)
   * @returns {RegisteredGenerator[]} Array of generators matching the priority
   *
   * @example
   * ```typescript
   * // Get all P0 notification generators
   * const notificationGens = registry.getByPriority(ContentPriority.NOTIFICATION);
   *
   * // Get all P2 normal content generators
   * const normalGens = registry.getByPriority(ContentPriority.NORMAL);
   * ```
   */
  public getByPriority(priority: ContentPriority): RegisteredGenerator[] {
    return Array.from(this.generators.values()).filter(
      registered => registered.registration.priority === priority
    );
  }

  /**
   * Get all generators whose event trigger pattern matches the given event.
   *
   * Only returns generators that have an eventTriggerPattern defined and
   * where that pattern matches the provided event string.
   *
   * @param {string} event - The event string to match against (e.g., 'door.opened')
   * @returns {RegisteredGenerator[]} Array of generators with matching event patterns
   *
   * @example
   * ```typescript
   * // Find all generators that handle door events
   * const doorHandlers = registry.getByEventPattern('door.opened');
   *
   * // Find all generators that handle person events
   * const personHandlers = registry.getByEventPattern('person.arrived');
   * ```
   */
  public getByEventPattern(event: string): RegisteredGenerator[] {
    return Array.from(this.generators.values()).filter(registered => {
      const pattern = registered.registration.eventTriggerPattern;
      return pattern && pattern.test(event);
    });
  }
}
