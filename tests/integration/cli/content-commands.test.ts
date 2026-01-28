/**
 * Integration tests for content CLI commands
 *
 * Tests content generators via direct function imports (no process spawning).
 * Uses real ContentRegistry, bootstrap pattern, and mocked external boundaries.
 *
 * ## Generator Types and Test Requirements
 *
 * | Generator Type | External Dependencies | Test Mode |
 * |----------------|----------------------|-----------|
 * | Programmatic   | None                 | Always run |
 * | AI-powered     | OpenAI/Anthropic API | Requires LIVE_INTEGRATION_TEST=true |
 *
 * ## Environment Variables
 *
 * - `LIVE_INTEGRATION_TEST=true` - Required to run tests for AI-powered generators
 * - `OPENAI_API_KEY` - Required for AI tests (uses test-key fallback for programmatic)
 * - `VESTABOARD_LOCAL_API_KEY` - API key for Vestaboard (uses test-key fallback)
 * - `VESTABOARD_LOCAL_API_URL` - Vestaboard API URL (uses localhost fallback)
 *
 * ## Adding New Generator Tests
 *
 * When adding tests for AI-powered generators (haiku, weather-focus, etc.):
 * 1. Use the `describeIfLive` helper to conditionally run the test suite
 * 2. Document the external dependencies in the test description
 *
 * @example
 * ```typescript
 * // For AI-powered generators that need real API credentials:
 * describeIfLive('haiku generator (requires AI API)', () => {
 *   it('should generate haiku content', async () => {
 *     await contentTestCommand({ generatorId: 'haiku' });
 *   });
 * });
 * ```
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { contentTestCommand } from '@/cli/commands/content-test.js';
import type { ContentTestOptions } from '@/cli/commands/content-test.js';
import { ContentRegistry } from '@/content/registry/content-registry.js';
import { resetKnexInstance, getKnexInstance, closeKnexInstance } from '@/storage/knex.js';
import type { Knex } from 'knex';

// Mock console methods to capture output
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

// Store original process.exit to restore later
const originalExit = process.exit;

// Mock process.exit to prevent actual exit
const mockExit = jest.fn() as unknown as typeof process.exit;

/**
 * Check if live integration tests are enabled.
 * Live tests require real external API credentials.
 */
const isLiveTestEnabled = process.env.LIVE_INTEGRATION_TEST === 'true';

/**
 * Conditional describe for tests requiring live API connections.
 * Use this for AI-powered generators that need real OpenAI/Anthropic credentials.
 */
const describeIfLive = isLiveTestEnabled ? describe : describe.skip;

/**
 * Standard environment variables for CLI execution.
 * Uses fallback values for programmatic generators that don't need real credentials.
 */
function setupTestEnv(): void {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
  process.env.VESTABOARD_LOCAL_API_KEY = process.env.VESTABOARD_LOCAL_API_KEY || 'test-key';
  process.env.VESTABOARD_LOCAL_API_URL =
    process.env.VESTABOARD_LOCAL_API_URL || 'http://localhost:7000';
}

describe('Content CLI commands integration', () => {
  let knex: Knex;

  beforeAll(async () => {
    setupTestEnv();
    process.exit = mockExit;

    // Setup database
    resetKnexInstance();
    knex = getKnexInstance();

    // Run migrations to create tables
    await knex.migrate.latest();
  });

  afterAll(async () => {
    process.exit = originalExit;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Cleanup database
    try {
      await knex.migrate.rollback(undefined, true);
      await closeKnexInstance();
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    mockExit.mockClear();

    // Clear ContentRegistry singleton between tests to prevent "already registered" errors
    ContentRegistry.reset();
  });

  /**
   * Programmatic generators - Always run (no external API dependencies)
   *
   * pattern-art: Generates mathematical visual patterns locally without AI
   */
  describe('pattern-art generator (programmatic - no external APIs)', () => {
    it('should successfully test pattern-art generator', async () => {
      const options: ContentTestOptions = {
        generatorId: 'pattern-art',
      };

      await contentTestCommand(options);

      // Collect all console.log output
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Verify output contains expected content
      expect(output).toContain('Testing generator: Mathematical Pattern Generator');
      expect(output).toContain('ID: pattern-art');
      expect(output).toContain('Priority: P2-NORMAL');
      expect(output).toContain('VALIDATION RESULT');
      expect(output).toContain('Status:');
      expect(output).toContain('Output mode: layout');
      expect(output).toContain('Preview:');
      expect(output).toContain('Test completed successfully');
    });

    it('should generate valid 6x22 pattern layout', async () => {
      const options: ContentTestOptions = {
        generatorId: 'pattern-art',
      };

      await contentTestCommand(options);

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Verify it uses layout mode (characterCodes output)
      expect(output).toContain('Output mode: layout');

      // Verify the preview shows 6 rows (pattern box has 6 content rows)
      const lines = output.split('\n');
      const previewStart = lines.findIndex(line => line.includes('Preview:'));
      expect(previewStart).toBeGreaterThan(-1);

      // Count rows between box characters (│...│)
      const previewRows = lines
        .slice(previewStart)
        .filter(line => line.includes('│') && !line.includes('┌') && !line.includes('└'));
      expect(previewRows.length).toBe(6);
    });

    it('should produce valid color codes (approved Vestaboard colors)', async () => {
      const options: ContentTestOptions = {
        generatorId: 'pattern-art',
      };

      await contentTestCommand(options);

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Verify validation passed (no invalid characters)
      expect(output).toContain('VALIDATION RESULT');
      expect(output).toMatch(/Invalid characters:\s*none/i);

      // Verify completion message
      expect(output).toContain('Test completed successfully');
    });
  });

  /**
   * AI-powered generators - Require LIVE_INTEGRATION_TEST=true
   *
   * These tests execute real CLI commands that call OpenAI/Anthropic APIs.
   * They are skipped by default to prevent CI failures without API credentials.
   *
   * To run locally with real credentials:
   *   LIVE_INTEGRATION_TEST=true npm run test:integration -- --testPathPatterns="content-commands"
   */
  describeIfLive('AI-powered generators (requires LIVE_INTEGRATION_TEST=true)', () => {
    // Placeholder for future AI generator tests
    // When adding tests for haiku, weather-focus, news-summary, etc.,
    // place them in this describe block.
    //
    // Example:
    // it('should generate haiku content', async () => {
    //   await contentTestCommand({ generatorId: 'haiku' });
    //   const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
    //   expect(output).toContain('Test completed successfully');
    // });

    it.skip('placeholder - add AI generator tests here', () => {
      // This is a placeholder to document the pattern for AI generator tests
      expect(true).toBe(true);
    });
  });
});
