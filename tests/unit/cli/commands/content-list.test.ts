/**
 * Unit tests for content:list CLI command
 *
 * Tests the content listing command that displays all registered
 * content generators grouped by priority with their metadata.
 */

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

  describe('priority grouping', () => {
    it('should group generators by priority level', async () => {
      // Register P0 notification generator
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

      // Register P2 normal generator
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

      // Register P3 fallback generator
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

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show priority group headers
      expect(output).toMatch(/P0.*NOTIFICATION/i);
      expect(output).toMatch(/P2.*NORMAL/i);
      expect(output).toMatch(/P3.*FALLBACK/i);

      // Should show generators under correct priority groups
      // P0 section should contain door-notification
      const p0Section = output.match(/P0.*?(?=P2|P3|Total:|$)/s)?.[0] || '';
      expect(p0Section).toContain('door-notification');

      // P2 section should contain motivational
      const p2Section = output.match(/P2.*?(?=P3|Total:|$)/s)?.[0] || '';
      expect(p2Section).toContain('motivational');

      // P3 section should contain fallback
      const p3Section = output.match(/P3.*?(?=Total:|$)/s)?.[0] || '';
      expect(p3Section).toContain('fallback');
    });

    it('should show empty priority groups when no generators for that priority', async () => {
      // Only register P2 generator (P3 fallback is auto-registered by bootstrap)
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

      // Should show all priority groups
      expect(output).toMatch(/P0.*NOTIFICATION/i);
      expect(output).toMatch(/P2.*NORMAL/i);
      expect(output).toMatch(/P3.*FALLBACK/i);

      // P0 should indicate no generators
      const p0Section = output.match(/P0.*?(?=P2)/s)?.[0] || '';
      expect(p0Section).toMatch(/none|0|empty/i);

      // P3 now has a static-fallback generator from bootstrap, so it should NOT be empty
      const p3Section = output.match(/P3.*?(?=Total:|$)/s)?.[0] || '';
      expect(p3Section).toContain('static-fallback');
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

  describe('formatting', () => {
    it('should display output in table format', async () => {
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

      // Should have some kind of table structure (borders, columns, etc.)
      // Looking for common table characters or column alignment
      expect(output).toMatch(/[│|─-]/); // Table borders
    });

    it('should show total count at the end', async () => {
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

      await contentListCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show total count (bootstrap adds core generators, so total > 2)
      // Just verify the Total line is present with some number
      expect(output).toMatch(/total:\s*\d+\s*generators?/i);
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
