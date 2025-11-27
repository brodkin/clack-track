/**
 * Unit Tests for ContentRegistry Singleton
 *
 * Tests the ContentRegistry singleton class for managing content generator
 * registration, lookup, and filtering operations.
 */

import { ContentRegistry } from '@/content/registry/content-registry';
import {
  ContentPriority,
  ModelTier,
  type ContentGenerator,
  type ContentRegistration,
  type GenerationContext,
  type GeneratedContent,
  type GeneratorValidationResult,
} from '@/types/content-generator';

// Mock generator for testing
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

describe('ContentRegistry', () => {
  let registry: ContentRegistry;
  let mockGenerator: ContentGenerator;

  beforeEach(() => {
    // Reset singleton before each test
    ContentRegistry.reset();
    registry = ContentRegistry.getInstance();
    mockGenerator = new MockGenerator();
  });

  afterEach(() => {
    // Clean up singleton after each test
    ContentRegistry.reset();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple getInstance() calls', () => {
      const instance1 = ContentRegistry.getInstance();
      const instance2 = ContentRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after reset()', () => {
      const instance1 = ContentRegistry.getInstance();
      ContentRegistry.reset();
      const instance2 = ContentRegistry.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('register()', () => {
    it('should successfully register a generator', () => {
      const registration: ContentRegistration = {
        id: 'test-generator',
        name: 'Test Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      expect(() => {
        registry.register(registration, mockGenerator);
      }).not.toThrow();

      const result = registry.getById('test-generator');
      expect(result).toBeDefined();
      expect(result?.registration).toEqual(registration);
      expect(result?.generator).toBe(mockGenerator);
    });

    it('should throw error when registering duplicate ID', () => {
      const registration: ContentRegistration = {
        id: 'duplicate-id',
        name: 'First Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      registry.register(registration, mockGenerator);

      const duplicateRegistration: ContentRegistration = {
        id: 'duplicate-id',
        name: 'Second Generator',
        priority: ContentPriority.FALLBACK,
        modelTier: ModelTier.HEAVY,
      };

      expect(() => {
        registry.register(duplicateRegistration, new MockGenerator());
      }).toThrow('Generator with ID "duplicate-id" is already registered');
    });

    it('should register multiple generators with different IDs', () => {
      const reg1: ContentRegistration = {
        id: 'generator-1',
        name: 'Generator 1',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      const reg2: ContentRegistration = {
        id: 'generator-2',
        name: 'Generator 2',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.MEDIUM,
      };

      registry.register(reg1, mockGenerator);
      registry.register(reg2, new MockGenerator());

      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe('unregister()', () => {
    it('should return true when unregistering existing generator', () => {
      const registration: ContentRegistration = {
        id: 'test-generator',
        name: 'Test Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      registry.register(registration, mockGenerator);
      const result = registry.unregister('test-generator');

      expect(result).toBe(true);
      expect(registry.getById('test-generator')).toBeUndefined();
    });

    it('should return false when unregistering non-existent generator', () => {
      const result = registry.unregister('non-existent-id');
      expect(result).toBe(false);
    });

    it('should remove generator from all lookup methods', () => {
      const registration: ContentRegistration = {
        id: 'test-generator',
        name: 'Test Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      registry.register(registration, mockGenerator);
      registry.unregister('test-generator');

      expect(registry.getById('test-generator')).toBeUndefined();
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getByPriority(ContentPriority.NORMAL)).toHaveLength(0);
    });
  });

  describe('getAll()', () => {
    it('should return empty array when no generators registered', () => {
      const result = registry.getAll();
      expect(result).toEqual([]);
    });

    it('should return all registered generators', () => {
      const reg1: ContentRegistration = {
        id: 'generator-1',
        name: 'Generator 1',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      const reg2: ContentRegistration = {
        id: 'generator-2',
        name: 'Generator 2',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.MEDIUM,
      };

      const reg3: ContentRegistration = {
        id: 'generator-3',
        name: 'Generator 3',
        priority: ContentPriority.FALLBACK,
        modelTier: ModelTier.HEAVY,
      };

      registry.register(reg1, mockGenerator);
      registry.register(reg2, new MockGenerator());
      registry.register(reg3, new MockGenerator());

      const result = registry.getAll();
      expect(result).toHaveLength(3);
      expect(result.map(r => r.registration.id)).toEqual([
        'generator-1',
        'generator-2',
        'generator-3',
      ]);
    });
  });

  describe('getById()', () => {
    it('should return undefined for non-existent ID', () => {
      const result = registry.getById('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return registered generator by ID', () => {
      const registration: ContentRegistration = {
        id: 'test-generator',
        name: 'Test Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      registry.register(registration, mockGenerator);
      const result = registry.getById('test-generator');

      expect(result).toBeDefined();
      expect(result?.registration.id).toBe('test-generator');
      expect(result?.registration.name).toBe('Test Generator');
      expect(result?.generator).toBe(mockGenerator);
    });

    it('should return correct generator when multiple registered', () => {
      const reg1: ContentRegistration = {
        id: 'generator-1',
        name: 'Generator 1',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      const reg2: ContentRegistration = {
        id: 'generator-2',
        name: 'Generator 2',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.MEDIUM,
      };

      registry.register(reg1, mockGenerator);
      registry.register(reg2, new MockGenerator());

      const result = registry.getById('generator-2');
      expect(result?.registration.id).toBe('generator-2');
      expect(result?.registration.name).toBe('Generator 2');
    });
  });

  describe('getByPriority()', () => {
    beforeEach(() => {
      // Register generators with different priorities
      const p0reg: ContentRegistration = {
        id: 'notification-1',
        name: 'Notification Generator 1',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.LIGHT,
      };

      const p0reg2: ContentRegistration = {
        id: 'notification-2',
        name: 'Notification Generator 2',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.MEDIUM,
      };

      const p2reg: ContentRegistration = {
        id: 'normal-1',
        name: 'Normal Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      const p3reg: ContentRegistration = {
        id: 'fallback-1',
        name: 'Fallback Generator',
        priority: ContentPriority.FALLBACK,
        modelTier: ModelTier.LIGHT,
      };

      registry.register(p0reg, mockGenerator);
      registry.register(p0reg2, new MockGenerator());
      registry.register(p2reg, new MockGenerator());
      registry.register(p3reg, new MockGenerator());
    });

    it('should return empty array when no generators match priority', () => {
      ContentRegistry.reset();
      registry = ContentRegistry.getInstance();

      const result = registry.getByPriority(ContentPriority.NOTIFICATION);
      expect(result).toEqual([]);
    });

    it('should return all P0 (NOTIFICATION) generators', () => {
      const result = registry.getByPriority(ContentPriority.NOTIFICATION);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.registration.id)).toEqual(['notification-1', 'notification-2']);
    });

    it('should return all P2 (NORMAL) generators', () => {
      const result = registry.getByPriority(ContentPriority.NORMAL);
      expect(result).toHaveLength(1);
      expect(result[0].registration.id).toBe('normal-1');
    });

    it('should return all P3 (FALLBACK) generators', () => {
      const result = registry.getByPriority(ContentPriority.FALLBACK);
      expect(result).toHaveLength(1);
      expect(result[0].registration.id).toBe('fallback-1');
    });

    it('should only return generators with exact priority match', () => {
      const allGenerators = registry.getAll();
      const p0Generators = registry.getByPriority(ContentPriority.NOTIFICATION);
      const p2Generators = registry.getByPriority(ContentPriority.NORMAL);
      const p3Generators = registry.getByPriority(ContentPriority.FALLBACK);

      expect(allGenerators).toHaveLength(4);
      expect(p0Generators.length + p2Generators.length + p3Generators.length).toBe(4);
    });
  });

  describe('getByEventPattern()', () => {
    beforeEach(() => {
      // Register generators with different event patterns
      const doorReg: ContentRegistration = {
        id: 'door-events',
        name: 'Door Event Handler',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.LIGHT,
        eventTriggerPattern: /^door\.(opened|closed)$/,
      };

      const personReg: ContentRegistration = {
        id: 'person-events',
        name: 'Person Event Handler',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.LIGHT,
        eventTriggerPattern: /^person\.(arrived|left)$/,
      };

      const wildcardReg: ContentRegistration = {
        id: 'all-events',
        name: 'All Events Handler',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.LIGHT,
        eventTriggerPattern: /.*/,
      };

      const noPatternReg: ContentRegistration = {
        id: 'no-pattern',
        name: 'No Pattern Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
        // No eventTriggerPattern
      };

      registry.register(doorReg, mockGenerator);
      registry.register(personReg, new MockGenerator());
      registry.register(wildcardReg, new MockGenerator());
      registry.register(noPatternReg, new MockGenerator());
    });

    it('should return empty array when no patterns match event', () => {
      const result = registry.getByEventPattern('window.opened');
      expect(result).toHaveLength(1); // Only wildcard matches
      expect(result[0].registration.id).toBe('all-events');
    });

    it('should return generators matching door events', () => {
      const openedResult = registry.getByEventPattern('door.opened');
      expect(openedResult.length).toBeGreaterThanOrEqual(2); // door-events + wildcard

      const doorMatches = openedResult.filter(r => r.registration.id === 'door-events');
      expect(doorMatches).toHaveLength(1);
    });

    it('should return generators matching person events', () => {
      const arrivedResult = registry.getByEventPattern('person.arrived');
      expect(arrivedResult.length).toBeGreaterThanOrEqual(2); // person-events + wildcard

      const personMatches = arrivedResult.filter(r => r.registration.id === 'person-events');
      expect(personMatches).toHaveLength(1);
    });

    it('should support wildcard patterns', () => {
      const result = registry.getByEventPattern('any.random.event');
      expect(result.length).toBeGreaterThanOrEqual(1);

      const wildcardMatch = result.find(r => r.registration.id === 'all-events');
      expect(wildcardMatch).toBeDefined();
    });

    it('should not match generators without eventTriggerPattern', () => {
      const result = registry.getByEventPattern('door.opened');
      const noPatternMatch = result.find(r => r.registration.id === 'no-pattern');
      expect(noPatternMatch).toBeUndefined();
    });

    it('should support multiple generators matching same event', () => {
      const result = registry.getByEventPattern('door.opened');
      expect(result.length).toBeGreaterThanOrEqual(2); // At least door-events + wildcard
    });

    it('should return empty array when registry is empty', () => {
      ContentRegistry.reset();
      registry = ContentRegistry.getInstance();

      const result = registry.getByEventPattern('any.event');
      expect(result).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty registry for all getter methods', () => {
      expect(registry.getAll()).toEqual([]);
      expect(registry.getById('any-id')).toBeUndefined();
      expect(registry.getByPriority(ContentPriority.NORMAL)).toEqual([]);
      expect(registry.getByEventPattern('any.event')).toEqual([]);
    });

    it('should preserve registration metadata exactly as provided', () => {
      const registration: ContentRegistration = {
        id: 'test-gen',
        name: 'Test Generator',
        priority: ContentPriority.NOTIFICATION,
        modelTier: ModelTier.HEAVY,
        applyFrame: false,
        eventTriggerPattern: /^test\..+$/,
        tags: ['test', 'demo', 'unit-test'],
      };

      registry.register(registration, mockGenerator);
      const result = registry.getById('test-gen');

      expect(result?.registration).toEqual(registration);
      expect(result?.registration.applyFrame).toBe(false);
      expect(result?.registration.tags).toEqual(['test', 'demo', 'unit-test']);
      expect(result?.registration.eventTriggerPattern).toBeInstanceOf(RegExp);
    });

    it('should maintain separate instances of generators', () => {
      const gen1 = new MockGenerator();
      const gen2 = new MockGenerator();

      const reg1: ContentRegistration = {
        id: 'gen-1',
        name: 'Generator 1',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      const reg2: ContentRegistration = {
        id: 'gen-2',
        name: 'Generator 2',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
      };

      registry.register(reg1, gen1);
      registry.register(reg2, gen2);

      const result1 = registry.getById('gen-1');
      const result2 = registry.getById('gen-2');

      expect(result1?.generator).toBe(gen1);
      expect(result2?.generator).toBe(gen2);
      expect(result1?.generator).not.toBe(result2?.generator);
    });
  });
});
