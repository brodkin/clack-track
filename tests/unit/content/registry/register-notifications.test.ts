/**
 * Tests for registerNotifications function
 *
 * Validates that P0 Home Assistant notification generators are properly
 * registered with correct patterns, priorities, and metadata.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { registerNotifications } from '../../../../src/content/registry/register-notifications.js';
import { ContentRegistry } from '../../../../src/content/registry/content-registry.js';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
} from '../../../../src/types/content-generator.js';
import { ContentPriority, ModelTier } from '../../../../src/types/content-generator.js';

/**
 * Mock content generator for testing
 */
class MockNotificationGenerator implements ContentGenerator {
  async generate(_context: GenerationContext): Promise<GeneratedContent> {
    return {
      text: 'Mock notification',
      outputMode: 'text',
    };
  }

  validate(): GeneratorValidationResult {
    return { valid: true };
  }
}

/**
 * Mock factory interface matching the expected signature
 */
interface NotificationGeneratorFactory {
  create(eventPattern: string, displayName: string): ContentGenerator;
}

describe('registerNotifications', () => {
  let registry: ContentRegistry;
  let mockFactory: NotificationGeneratorFactory;
  let mockGenerator: ContentGenerator;
  let factoryCreateSpy: Mock;

  beforeEach(() => {
    // Reset registry singleton before each test
    ContentRegistry.reset();
    registry = ContentRegistry.getInstance();

    // Create mock generator
    mockGenerator = new MockNotificationGenerator();

    // Create mock factory with spy
    factoryCreateSpy = jest
      .fn<(eventPattern: string, displayName: string) => ContentGenerator>()
      .mockReturnValue(mockGenerator);
    mockFactory = {
      create: factoryCreateSpy,
    };
  });

  it('should register 4 notification generators', () => {
    registerNotifications(registry, mockFactory);

    const allGenerators = registry.getAll();
    expect(allGenerators).toHaveLength(4);
  });

  it('should register all generators with P0 NOTIFICATION priority', () => {
    registerNotifications(registry, mockFactory);

    const notificationGenerators = registry.getByPriority(ContentPriority.NOTIFICATION);
    expect(notificationGenerators).toHaveLength(4);
  });

  it('should register all generators with LIGHT model tier', () => {
    registerNotifications(registry, mockFactory);

    const allGenerators = registry.getAll();
    allGenerators.forEach(registered => {
      expect(registered.registration.modelTier).toBe(ModelTier.LIGHT);
    });
  });

  it('should register all generators with applyFrame=false', () => {
    registerNotifications(registry, mockFactory);

    const allGenerators = registry.getAll();
    allGenerators.forEach(registered => {
      expect(registered.registration.applyFrame).toBe(false);
    });
  });

  it('should register all generators with notification and home-assistant tags', () => {
    registerNotifications(registry, mockFactory);

    const allGenerators = registry.getAll();
    allGenerators.forEach(registered => {
      expect(registered.registration.tags).toContain('notification');
      expect(registered.registration.tags).toContain('home-assistant');
    });
  });

  it('should register door notification with correct pattern', () => {
    registerNotifications(registry, mockFactory);

    const doorGenerator = registry.getById('ha-notification-door');
    expect(doorGenerator).toBeDefined();
    expect(doorGenerator?.registration.name).toBe('Door Notification');
    expect(doorGenerator?.registration.eventTriggerPattern).toEqual(/^binary_sensor\..*_door$/);
  });

  it('should register person notification with correct pattern', () => {
    registerNotifications(registry, mockFactory);

    const personGenerator = registry.getById('ha-notification-person');
    expect(personGenerator).toBeDefined();
    expect(personGenerator?.registration.name).toBe('Person Notification');
    expect(personGenerator?.registration.eventTriggerPattern).toEqual(/^person\..*$/);
  });

  it('should register motion notification with correct pattern', () => {
    registerNotifications(registry, mockFactory);

    const motionGenerator = registry.getById('ha-notification-motion');
    expect(motionGenerator).toBeDefined();
    expect(motionGenerator?.registration.name).toBe('Motion Notification');
    expect(motionGenerator?.registration.eventTriggerPattern).toEqual(/^binary_sensor\..*_motion$/);
  });

  it('should register garage notification with correct pattern', () => {
    registerNotifications(registry, mockFactory);

    const garageGenerator = registry.getById('ha-notification-garage');
    expect(garageGenerator).toBeDefined();
    expect(garageGenerator?.registration.name).toBe('Garage Notification');
    expect(garageGenerator?.registration.eventTriggerPattern).toEqual(/^cover\..*garage.*$/i);
  });

  it('should call factory with correct parameters for door notification', () => {
    registerNotifications(registry, mockFactory);

    expect(factoryCreateSpy).toHaveBeenCalledWith(
      '/^binary_sensor\\..*_door$/',
      'Door Notification'
    );
  });

  it('should call factory with correct parameters for person notification', () => {
    registerNotifications(registry, mockFactory);

    expect(factoryCreateSpy).toHaveBeenCalledWith('/^person\\..*$/', 'Person Notification');
  });

  it('should call factory with correct parameters for motion notification', () => {
    registerNotifications(registry, mockFactory);

    expect(factoryCreateSpy).toHaveBeenCalledWith(
      '/^binary_sensor\\..*_motion$/',
      'Motion Notification'
    );
  });

  it('should call factory with correct parameters for garage notification', () => {
    registerNotifications(registry, mockFactory);

    expect(factoryCreateSpy).toHaveBeenCalledWith('/^cover\\..*garage.*$/i', 'Garage Notification');
  });

  it('should call factory exactly 4 times', () => {
    registerNotifications(registry, mockFactory);

    expect(factoryCreateSpy).toHaveBeenCalledTimes(4);
  });

  describe('Event pattern matching', () => {
    beforeEach(() => {
      registerNotifications(registry, mockFactory);
    });

    it('should match door sensor events', () => {
      const matches = registry.getByEventPattern('binary_sensor.front_door');
      expect(matches).toHaveLength(1);
      expect(matches[0].registration.id).toBe('ha-notification-door');
    });

    it('should match person events', () => {
      const matches = registry.getByEventPattern('person.john');
      expect(matches).toHaveLength(1);
      expect(matches[0].registration.id).toBe('ha-notification-person');
    });

    it('should match motion sensor events', () => {
      const matches = registry.getByEventPattern('binary_sensor.hallway_motion');
      expect(matches).toHaveLength(1);
      expect(matches[0].registration.id).toBe('ha-notification-motion');
    });

    it('should match garage cover events case-insensitively', () => {
      const matches1 = registry.getByEventPattern('cover.main_garage');
      expect(matches1).toHaveLength(1);
      expect(matches1[0].registration.id).toBe('ha-notification-garage');

      const matches2 = registry.getByEventPattern('cover.main_GARAGE');
      expect(matches2).toHaveLength(1);
      expect(matches2[0].registration.id).toBe('ha-notification-garage');
    });

    it('should not match unrelated events', () => {
      const matches = registry.getByEventPattern('light.living_room');
      expect(matches).toHaveLength(0);
    });
  });
});
