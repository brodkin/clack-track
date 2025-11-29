/**
 * Unit tests for NotificationGenerator abstract base class.
 *
 * Tests the abstract base class for P0 (NOTIFICATION priority) Home Assistant
 * event-triggered notifications, verifying event pattern matching, notification
 * formatting, and integration with the ContentGenerator interface.
 */

import { describe, expect, it } from '@jest/globals';
import type { GenerationContext } from '@/types/content-generator';
import { NotificationGenerator } from '@/content/generators/notification-generator';

/**
 * Concrete test implementation of NotificationGenerator for person arrival events.
 * Used to test abstract class behavior since abstract classes cannot be instantiated directly.
 */
class TestPersonArrivedNotification extends NotificationGenerator {
  protected eventPattern = /^person\.arrived$/;

  protected formatNotification(eventData: Record<string, unknown>): string {
    const personName = (eventData.entity_id as string)?.split('.')[1] || 'Someone';
    return `Welcome home, ${personName}!`;
  }
}

/**
 * Concrete implementation for door event notifications with compound pattern.
 */
class TestDoorNotification extends NotificationGenerator {
  protected eventPattern = /^(door\.opened|door\.closed)$/;

  protected formatNotification(eventData: Record<string, unknown>): string {
    const eventType = eventData.event_type as string;
    const action = eventType?.includes('opened') ? 'opened' : 'closed';
    const doorName = (eventData.entity_id as string)?.split('.')[1] || 'door';
    return `The ${doorName} was ${action}`;
  }
}

/**
 * Implementation with invalid pattern (simulate runtime validation failure).
 */
class InvalidPatternNotification extends NotificationGenerator {
  // Override with a getter that returns a malformed RegExp-like object
  get eventPattern(): RegExp {
    return null as unknown as RegExp; // Type assertion to bypass compile-time check
  }

  protected formatNotification(_eventData: Record<string, unknown>): string {
    return 'Invalid notification';
  }
}

describe('NotificationGenerator', () => {
  describe('eventPattern property', () => {
    it('should accept simple event type patterns', () => {
      const generator = new TestPersonArrivedNotification();
      expect(generator.eventPattern).toEqual(/^person\.arrived$/);
    });

    it('should accept compound event type patterns', () => {
      const generator = new TestDoorNotification();
      expect(generator.eventPattern).toEqual(/^(door\.opened|door\.closed)$/);
    });
  });

  describe('matchesEvent() helper method', () => {
    it('should return true for matching event types', () => {
      const generator = new TestPersonArrivedNotification();
      expect(generator.matchesEvent('person.arrived')).toBe(true);
    });

    it('should return false for non-matching event types', () => {
      const generator = new TestPersonArrivedNotification();
      expect(generator.matchesEvent('person.left')).toBe(false);
      expect(generator.matchesEvent('door.opened')).toBe(false);
    });

    it('should match compound patterns correctly', () => {
      const generator = new TestDoorNotification();
      expect(generator.matchesEvent('door.opened')).toBe(true);
      expect(generator.matchesEvent('door.closed')).toBe(true);
      expect(generator.matchesEvent('door.locked')).toBe(false);
    });

    it('should be case-sensitive by default', () => {
      const generator = new TestPersonArrivedNotification();
      expect(generator.matchesEvent('Person.Arrived')).toBe(false);
      expect(generator.matchesEvent('PERSON.ARRIVED')).toBe(false);
    });

    it('should handle empty strings', () => {
      const generator = new TestPersonArrivedNotification();
      expect(generator.matchesEvent('')).toBe(false);
    });
  });

  describe('validate() method', () => {
    it('should return valid for valid RegExp patterns', async () => {
      const generator = new TestPersonArrivedNotification();
      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate compound patterns', async () => {
      const generator = new TestDoorNotification();
      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect invalid RegExp patterns', async () => {
      const generator = new InvalidPatternNotification();
      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('eventPattern must be a valid RegExp instance');
    });
  });

  describe('generate() method', () => {
    describe('with valid event data', () => {
      it('should extract eventData from context and format notification', async () => {
        const generator = new TestPersonArrivedNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T12:00:00Z'),
          eventData: {
            event_type: 'person.arrived',
            entity_id: 'person.john',
          },
        };

        const content = await generator.generate(context);

        expect(content.text).toBe('Welcome home, john!');
        expect(content.outputMode).toBe('text');
      });

      it('should handle door open events', async () => {
        const generator = new TestDoorNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T12:00:00Z'),
          eventData: {
            event_type: 'door.opened',
            entity_id: 'door.front_door',
          },
        };

        const content = await generator.generate(context);

        expect(content.text).toBe('The front_door was opened');
        expect(content.outputMode).toBe('text');
      });

      it('should handle door closed events', async () => {
        const generator = new TestDoorNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T12:00:00Z'),
          eventData: {
            event_type: 'door.closed',
            entity_id: 'door.garage',
          },
        };

        const content = await generator.generate(context);

        expect(content.text).toBe('The garage was closed');
        expect(content.outputMode).toBe('text');
      });

      it('should return GeneratedContent with correct structure', async () => {
        const generator = new TestPersonArrivedNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T12:00:00Z'),
          eventData: {
            event_type: 'person.arrived',
            entity_id: 'person.sarah',
          },
        };

        const content = await generator.generate(context);

        expect(content).toHaveProperty('text');
        expect(content).toHaveProperty('outputMode');
        expect(typeof content.text).toBe('string');
        expect(content.text.length).toBeGreaterThan(0);
      });

      it('should use text outputMode for notifications', async () => {
        const generator = new TestPersonArrivedNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
          eventData: {
            event_type: 'person.arrived',
            entity_id: 'person.alex',
          },
        };

        const content = await generator.generate(context);

        expect(content.outputMode).toBe('text');
      });
    });

    describe('with missing or invalid event data', () => {
      it('should throw error when eventData is missing', async () => {
        const generator = new TestPersonArrivedNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
          // No eventData property
        };

        await expect(generator.generate(context)).rejects.toThrow(
          'NotificationGenerator requires eventData in context'
        );
      });

      it('should throw error when eventData is null', async () => {
        const generator = new TestPersonArrivedNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
          eventData: undefined,
        };

        await expect(generator.generate(context)).rejects.toThrow(
          'NotificationGenerator requires eventData in context'
        );
      });

      it('should handle empty eventData object gracefully', async () => {
        const generator = new TestPersonArrivedNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
          eventData: {},
        };

        const content = await generator.generate(context);

        // Should still call formatNotification with empty object
        expect(content.text).toBe('Welcome home, Someone!');
      });

      it('should handle missing entity_id in event data', async () => {
        const generator = new TestPersonArrivedNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
          eventData: {
            event_type: 'person.arrived',
            // No entity_id
          },
        };

        const content = await generator.generate(context);

        // Implementation should handle missing entity_id
        expect(content.text).toBe('Welcome home, Someone!');
      });
    });

    describe('event type validation', () => {
      it('should NOT validate event type in generate() method', async () => {
        const generator = new TestPersonArrivedNotification();
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date(),
          eventData: {
            event_type: 'door.opened', // Wrong event type for this generator
            entity_id: 'door.front',
          },
        };

        // Should still generate content (validation happens at orchestration level)
        const content = await generator.generate(context);
        expect(content.text).toBeDefined();
      });
    });
  });

  describe('ContentGenerator interface compliance', () => {
    it('should have async generate method', async () => {
      const generator = new TestPersonArrivedNotification();
      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date(),
        eventData: {
          event_type: 'person.arrived',
          entity_id: 'person.test',
        },
      };

      const result = generator.generate(context);

      // Should return a Promise
      expect(result).toBeInstanceOf(Promise);

      // Promise should resolve to GeneratedContent
      const content = await result;
      expect(content).toHaveProperty('text');
      expect(content).toHaveProperty('outputMode');
    });

    it('should have synchronous validate method', async () => {
      const generator = new TestPersonArrivedNotification();

      const result = await generator.validate();

      // Should return immediately (not a Promise)
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toHaveProperty('valid');
    });
  });

  describe('SOLID principles', () => {
    it('should follow Single Responsibility Principle (pattern matching + formatting)', () => {
      const generator = new TestPersonArrivedNotification();

      // Pattern matching responsibility
      expect(generator.matchesEvent('person.arrived')).toBe(true);
    });

    it('should follow Open/Closed Principle (extensible via subclasses)', () => {
      // Base class is closed for modification but open for extension
      const personGenerator = new TestPersonArrivedNotification();
      const doorGenerator = new TestDoorNotification();

      // Both extend the base class with different behavior
      expect(personGenerator.eventPattern).not.toEqual(doorGenerator.eventPattern);
      expect(personGenerator).toBeInstanceOf(NotificationGenerator);
      expect(doorGenerator).toBeInstanceOf(NotificationGenerator);
    });
  });
});
