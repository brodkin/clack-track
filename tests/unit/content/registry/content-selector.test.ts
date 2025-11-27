/**
 * Tests for ContentSelector
 *
 * Validates priority-based content generator selection logic:
 * - P0 (NOTIFICATION): Event-triggered immediate notifications
 * - P2 (NORMAL): Standard content generation (random selection)
 * - P3 (FALLBACK): Static fallback when other generators unavailable
 *
 * @module tests/unit/content/registry/content-selector
 */

import { ContentSelector } from '../../../../src/content/registry/content-selector.js';
import { ContentRegistry } from '../../../../src/content/registry/content-registry.js';
import {
  ContentPriority,
  ModelTier,
  type GenerationContext,
  type ContentGenerator,
  type GeneratorValidationResult,
  type GeneratedContent,
} from '../../../../src/types/content-generator.js';

/**
 * Mock content generator for testing.
 */
class MockGenerator implements ContentGenerator {
  async generate(_context: GenerationContext): Promise<GeneratedContent> {
    return {
      text: 'Mock content',
      outputMode: 'text',
    };
  }

  validate(): GeneratorValidationResult {
    return { valid: true };
  }
}

describe('ContentSelector', () => {
  let registry: ContentRegistry;
  let selector: ContentSelector;

  beforeEach(() => {
    // Reset singleton registry before each test
    ContentRegistry.reset();
    registry = ContentRegistry.getInstance();
    selector = new ContentSelector(registry);
  });

  afterEach(() => {
    ContentRegistry.reset();
  });

  describe('constructor', () => {
    it('should accept ContentRegistry via dependency injection', () => {
      expect(() => new ContentSelector(registry)).not.toThrow();
    });
  });

  describe('select - P0 (NOTIFICATION) priority', () => {
    it('should return P0 generator when event matches trigger pattern', () => {
      // Arrange: Register P0 generator with event pattern
      registry.register(
        {
          id: 'door-notification',
          name: 'Door Event Notification',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^door\.(opened|closed)$/,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: {
          event_type: 'door.opened',
        },
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.registration.id).toBe('door-notification');
      expect(result?.registration.priority).toBe(ContentPriority.NOTIFICATION);
    });

    it('should return first matching P0 generator when multiple patterns match', () => {
      // Arrange: Register two P0 generators with overlapping patterns
      registry.register(
        {
          id: 'door-notification-1',
          name: 'Door Notification 1',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^door\./,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'door-notification-2',
          name: 'Door Notification 2',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^door\.opened$/,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: {
          event_type: 'door.opened',
        },
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.registration.priority).toBe(ContentPriority.NOTIFICATION);
      // First registered generator should match
      expect(['door-notification-1', 'door-notification-2']).toContain(result?.registration.id);
    });

    it('should skip P0 generators when event does not match pattern', () => {
      // Arrange: P0 with door pattern, P2 fallback
      registry.register(
        {
          id: 'door-notification',
          name: 'Door Notification',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^door\.(opened|closed)$/,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: {
          event_type: 'person.arrived', // Does not match door pattern
        },
      };

      // Act
      const result = selector.select(context);

      // Assert: Should fall through to P2
      expect(result).not.toBeNull();
      expect(result?.registration.id).toBe('motivational');
      expect(result?.registration.priority).toBe(ContentPriority.NORMAL);
    });

    it('should handle event_type from eventData', () => {
      // Arrange
      registry.register(
        {
          id: 'person-notification',
          name: 'Person Event',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^person\./,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: {
          event_type: 'person.arrived',
        },
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.registration.id).toBe('person-notification');
    });

    it('should handle entity_id from eventData when event_type missing', () => {
      // Arrange
      registry.register(
        {
          id: 'entity-notification',
          name: 'Entity Event',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^sensor\.temperature/,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: {
          entity_id: 'sensor.temperature_living_room',
        },
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.registration.id).toBe('entity-notification');
    });

    it('should skip P0 when eventData missing', () => {
      // Arrange
      registry.register(
        {
          id: 'door-notification',
          name: 'Door Notification',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^door\./,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        // No eventData
      };

      // Act
      const result = selector.select(context);

      // Assert: Should skip P0 and use P2
      expect(result).not.toBeNull();
      expect(result?.registration.id).toBe('motivational');
      expect(result?.registration.priority).toBe(ContentPriority.NORMAL);
    });

    it('should skip P0 when eventData has no event_type or entity_id', () => {
      // Arrange
      registry.register(
        {
          id: 'door-notification',
          name: 'Door Notification',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^door\./,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: {
          // Has eventData but missing both event_type and entity_id
          some_other_field: 'value',
        },
      };

      // Act
      const result = selector.select(context);

      // Assert: Should skip P0 and use P2
      expect(result).not.toBeNull();
      expect(result?.registration.id).toBe('motivational');
      expect(result?.registration.priority).toBe(ContentPriority.NORMAL);
    });
  });

  describe('select - P2 (NORMAL) priority', () => {
    it('should return random P2 generator when no P0 match', () => {
      // Arrange: Register multiple P2 generators
      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'news',
          name: 'News Summary',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.MEDIUM,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(['motivational', 'news']).toContain(result?.registration.id);
    });

    it('should randomly select from P2 generators', () => {
      // Arrange: Register 3 P2 generators
      registry.register(
        {
          id: 'gen-1',
          name: 'Generator 1',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'gen-2',
          name: 'Generator 2',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'gen-3',
          name: 'Generator 3',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      // Mock Math.random to return deterministic values
      const originalRandom = Math.random;
      const randomValues = [0.1, 0.5, 0.9]; // Test different selections
      let callCount = 0;

      Math.random = jest.fn(() => randomValues[callCount++ % randomValues.length]);

      try {
        // Act: Call select multiple times
        const results = [
          selector.select(context),
          selector.select(context),
          selector.select(context),
        ];

        // Assert: Should select different generators based on random values
        expect(results[0]?.registration.id).toBe('gen-1'); // 0.1 * 3 = 0.3 -> index 0
        expect(results[1]?.registration.id).toBe('gen-2'); // 0.5 * 3 = 1.5 -> index 1
        expect(results[2]?.registration.id).toBe('gen-3'); // 0.9 * 3 = 2.7 -> index 2
      } finally {
        // Restore original Math.random
        Math.random = originalRandom;
      }
    });

    it('should return only P2 generator when only one available', () => {
      // Arrange
      registry.register(
        {
          id: 'single-gen',
          name: 'Single Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.registration.id).toBe('single-gen');
    });
  });

  describe('select - P3 (FALLBACK) priority', () => {
    it('should return P3 generator when no P2 generators available', () => {
      // Arrange: Only P3 generator registered
      registry.register(
        {
          id: 'fallback',
          name: 'Static Fallback',
          priority: ContentPriority.FALLBACK,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.registration.id).toBe('fallback');
      expect(result?.registration.priority).toBe(ContentPriority.FALLBACK);
    });

    it('should return first P3 generator when multiple P3 available', () => {
      // Arrange: Register multiple P3 generators
      registry.register(
        {
          id: 'fallback-1',
          name: 'Fallback 1',
          priority: ContentPriority.FALLBACK,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'fallback-2',
          name: 'Fallback 2',
          priority: ContentPriority.FALLBACK,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.registration.priority).toBe(ContentPriority.FALLBACK);
      // Should return first P3 (deterministic, not random)
      expect(['fallback-1', 'fallback-2']).toContain(result?.registration.id);
    });

    it('should prefer P2 over P3 when both available', () => {
      // Arrange
      registry.register(
        {
          id: 'normal-gen',
          name: 'Normal Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'fallback-gen',
          name: 'Fallback Generator',
          priority: ContentPriority.FALLBACK,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      // Act
      const result = selector.select(context);

      // Assert: Should select P2, not P3
      expect(result).not.toBeNull();
      expect(result?.registration.id).toBe('normal-gen');
      expect(result?.registration.priority).toBe(ContentPriority.NORMAL);
    });
  });

  describe('select - No generators available', () => {
    it('should return null when no generators registered', () => {
      // Arrange: Empty registry
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when only P0 generators exist but no event match', () => {
      // Arrange: Only P0 generators, but event doesn't match
      registry.register(
        {
          id: 'door-notification',
          name: 'Door Notification',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^door\./,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: {
          event_type: 'person.arrived', // Does not match
        },
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('select - Mixed priority scenarios', () => {
    it('should follow priority order: P0 > P2 > P3', () => {
      // Arrange: Register all priority levels
      registry.register(
        {
          id: 'p0-notification',
          name: 'P0 Notification',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          eventTriggerPattern: /^door\./,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'p2-normal',
          name: 'P2 Normal',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'p3-fallback',
          name: 'P3 Fallback',
          priority: ContentPriority.FALLBACK,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      // Act & Assert: P0 wins when event matches
      const p0Context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: { event_type: 'door.opened' },
      };
      const p0Result = selector.select(p0Context);
      expect(p0Result?.registration.id).toBe('p0-notification');

      // Act & Assert: P2 wins when no event
      const p2Context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };
      const p2Result = selector.select(p2Context);
      expect(p2Result?.registration.id).toBe('p2-normal');
    });

    it('should use P3 only when P0 and P2 unavailable', () => {
      // Arrange: Only P3 available
      registry.register(
        {
          id: 'p3-fallback',
          name: 'P3 Fallback',
          priority: ContentPriority.FALLBACK,
          modelTier: ModelTier.LIGHT,
        },
        new MockGenerator()
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
      };

      // Act
      const result = selector.select(context);

      // Assert
      expect(result?.registration.id).toBe('p3-fallback');
    });
  });
});
