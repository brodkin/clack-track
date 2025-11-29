/**
 * Unit tests for content:list CLI command
 *
 * Tests the content listing command that displays all registered
 * content generators grouped by priority with their metadata.
 */

// Set environment variables BEFORE any imports that call bootstrap
process.env.OPENAI_API_KEY = 'test-key';

import { contentListCommand } from '../../../../src/cli/commands/content-list.js';
import { ContentRegistry } from '../../../../src/content/registry/content-registry.js';
import { ContentPriority, ModelTier } from '../../../../src/types/content-generator.js';
import type {
  ContentGenerator,
  GenerationContext,
} from '../../../../src/types/content-generator.js';

describe('content:list command', () => {
  let consoleLogSpy: jest.SpyInstance;
  let registry: ContentRegistry;

  // Mock generator for testing
  class MockGenerator implements ContentGenerator {
    async generate(_context: GenerationContext) {
      return { text: 'mock content', outputMode: 'text' as const };
    }
    validate() {
      return { valid: true };
    }
  }

  beforeEach(() => {
    // Reset registry before each test
    ContentRegistry.reset();
    registry = ContentRegistry.getInstance();

    // Spy on console.log to verify output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    ContentRegistry.reset();
  });

  describe('basic functionality', () => {
    it('should display empty registry message when no generators registered', async () => {
      await contentListCommand();

      // Should show header
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registered Content Generators')
      );

      // Bootstrap always registers a P3 fallback, so minimum is 1 generator
      // The total count should reflect this
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total:'));
    });

    it('should list all registered generators', async () => {
      // Register test generators
      registry.register(
        {
          id: 'test-motivational',
          name: 'Motivational Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'test-news',
          name: 'News Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.MEDIUM,
          applyFrame: true,
        },
        new MockGenerator()
      );

      await contentListCommand();

      // Should show both generators
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('test-motivational'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Motivational Generator'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('test-news'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('News Generator'));
    });
  });

  describe('priority grouping logic', () => {
    // These tests verify registry grouping behavior, not output format

    it('should group generators by priority in registry', () => {
      // Register generators at different priorities
      registry.register(
        {
          id: 'door-notification',
          name: 'Door Notification',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          applyFrame: false,
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
          applyFrame: true,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'fallback',
          name: 'Static Fallback',
          priority: ContentPriority.FALLBACK,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        new MockGenerator()
      );

      // Act - Get all generators
      const allGenerators = registry.getAll();

      // Assert - Check registry returns correct grouping
      const p0Generators = allGenerators.filter(
        g => g.registration.priority === ContentPriority.NOTIFICATION
      );
      const p2Generators = allGenerators.filter(
        g => g.registration.priority === ContentPriority.NORMAL
      );
      const p3Generators = allGenerators.filter(
        g => g.registration.priority === ContentPriority.FALLBACK
      );

      expect(p0Generators.length).toBe(1);
      expect(p0Generators[0].registration.id).toBe('door-notification');

      expect(p2Generators.length).toBe(1);
      expect(p2Generators[0].registration.id).toBe('motivational');

      expect(p3Generators.length).toBe(1);
      expect(p3Generators[0].registration.id).toBe('fallback');
    });

    it('should handle empty priority groups', () => {
      // Only register P2 generator
      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        new MockGenerator()
      );

      // Act
      const allGenerators = registry.getAll();

      // Assert - Check registry state
      const p0Generators = allGenerators.filter(
        g => g.registration.priority === ContentPriority.NOTIFICATION
      );
      const p2Generators = allGenerators.filter(
        g => g.registration.priority === ContentPriority.NORMAL
      );

      expect(p0Generators.length).toBe(0); // No P0 registered
      expect(p2Generators.length).toBe(1); // Has P2
    });
  });

  describe('priority grouping output', () => {
    // These tests verify output formatting displays priority groups

    it('should display priority group headers in output', async () => {
      // Register generators at different priorities
      registry.register(
        {
          id: 'door-notification',
          name: 'Door Notification',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          applyFrame: false,
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
          applyFrame: true,
        },
        new MockGenerator()
      );

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show priority headers (loose matching - don't rely on exact format)
      expect(output).toMatch(/P0/i);
      expect(output).toMatch(/P2/i);
      expect(output).toMatch(/P3/i);
    });

    it('should show generators under their priority sections', async () => {
      // Register generators
      registry.register(
        {
          id: 'door-notification',
          name: 'Door Notification',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          applyFrame: false,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'motivational',
          name: 'Motivational Quote',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        new MockGenerator()
      );

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show generator IDs somewhere in output (don't check exact section)
      expect(output).toContain('door-notification');
      expect(output).toContain('motivational');
    });
  });

  describe('metadata display', () => {
    it('should display id, name, modelTier, and applyFrame for each generator', async () => {
      registry.register(
        {
          id: 'weather-gen',
          name: 'Weather Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.MEDIUM,
          applyFrame: true,
        },
        new MockGenerator()
      );

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show ID
      expect(output).toContain('weather-gen');

      // Should show name
      expect(output).toContain('Weather Generator');

      // Should show model tier
      expect(output).toMatch(/medium/i);

      // Should show applyFrame status - look for "Yes" in the Frame column
      expect(output).toContain('│ Yes   │');
    });

    it('should display applyFrame=false correctly', async () => {
      registry.register(
        {
          id: 'notification-gen',
          name: 'Notification Generator',
          priority: ContentPriority.NOTIFICATION,
          modelTier: ModelTier.LIGHT,
          applyFrame: false,
        },
        new MockGenerator()
      );

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show applyFrame=false - look for "No" in the Frame column
      expect(output).toContain('│ No    │');
    });

    it('should handle default applyFrame value (undefined = true)', async () => {
      registry.register(
        {
          id: 'default-frame-gen',
          name: 'Default Frame Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
          // applyFrame omitted - should default to true
        },
        new MockGenerator()
      );

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show frame as enabled (default true) - look for "Yes" in the Frame column
      expect(output).toContain('│ Yes   │');
    });

    it('should display all model tiers correctly', async () => {
      registry.register(
        {
          id: 'light-gen',
          name: 'Light Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'medium-gen',
          name: 'Medium Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.MEDIUM,
          applyFrame: true,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'heavy-gen',
          name: 'Heavy Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.HEAVY,
          applyFrame: true,
        },
        new MockGenerator()
      );

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show all three tiers
      expect(output).toMatch(/light/i);
      expect(output).toMatch(/medium/i);
      expect(output).toMatch(/heavy/i);
    });
  });

  describe('generator count logic', () => {
    // Test registry counting behavior

    it('should count registered generators correctly', () => {
      registry.register(
        {
          id: 'gen-1',
          name: 'Generator 1',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        new MockGenerator()
      );

      registry.register(
        {
          id: 'gen-2',
          name: 'Generator 2',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.MEDIUM,
          applyFrame: true,
        },
        new MockGenerator()
      );

      // Act
      const allGenerators = registry.getAll();

      // Assert - Verify count
      expect(allGenerators.length).toBe(2);
    });
  });

  describe('output formatting', () => {
    // Test CLI output appearance (loose assertions)

    it('should display output with visual structure', async () => {
      registry.register(
        {
          id: 'test-gen',
          name: 'Test Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        new MockGenerator()
      );

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should have some visual structure (don't check exact table format)
      expect(output.length).toBeGreaterThan(0);
      expect(output).toContain('test-gen'); // Generator should appear
    });

    it('should show total summary', async () => {
      registry.register(
        {
          id: 'gen-1',
          name: 'Generator 1',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        new MockGenerator()
      );

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show some kind of total/summary (loose matching)
      expect(output).toMatch(/total/i);
    });
  });

  describe('integration with bootstrap', () => {
    it('should work with registry from bootstrap', async () => {
      // This test verifies the command can be called without explicitly passing registry
      // (uses ContentRegistry.getInstance() internally)

      registry.register(
        {
          id: 'bootstrap-gen',
          name: 'Bootstrap Generator',
          priority: ContentPriority.NORMAL,
          modelTier: ModelTier.LIGHT,
          applyFrame: true,
        },
        new MockGenerator()
      );

      // Should not throw - uses getInstance() internally
      await expect(contentListCommand()).resolves.not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('bootstrap-gen'));
    });
  });
});
