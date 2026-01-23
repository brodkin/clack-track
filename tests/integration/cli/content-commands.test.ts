/**
 * Integration tests for content CLI commands
 *
 * Tests that content generators can be invoked via CLI using real npm commands.
 * These tests execute actual CLI commands via execSync, bypassing Jest mocks.
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
 *   it('should generate haiku content', () => { ... });
 * });
 * ```
 */

import { execSync } from 'child_process';
import { describe, it, expect } from '@jest/globals';

interface ExecSyncErrorWithMessage extends Error {
  message: string;
}

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
function getTestEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Fallback values work for programmatic generators
    // AI generators will fail with these unless LIVE_INTEGRATION_TEST=true and real keys provided
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
    VESTABOARD_LOCAL_API_KEY: process.env.VESTABOARD_LOCAL_API_KEY || 'test-key',
    VESTABOARD_LOCAL_API_URL: process.env.VESTABOARD_LOCAL_API_URL || 'http://localhost:7000',
  };
}

describe('Content CLI commands integration', () => {
  const worktreePath = process.cwd();

  /**
   * Programmatic generators - Always run (no external API dependencies)
   *
   * pattern-art: Generates mathematical visual patterns locally without AI
   */
  describe('pattern-art generator (programmatic - no external APIs)', () => {
    it('should successfully test pattern-art generator', () => {
      try {
        const output = execSync('npm run content:test pattern-art', {
          cwd: worktreePath,
          encoding: 'utf-8',
          stdio: 'pipe',
          env: getTestEnv(),
        });

        // Verify output contains expected content
        expect(output).toContain('Testing generator: Mathematical Pattern Generator');
        expect(output).toContain('ID: pattern-art');
        expect(output).toContain('Priority: P2-NORMAL');
        expect(output).toContain('VALIDATION RESULT');
        expect(output).toContain('Status:');
        expect(output).toContain('Output mode: layout');
        expect(output).toContain('Preview:');
        expect(output).toContain('Test completed successfully');
      } catch (error) {
        const execError = error as ExecSyncErrorWithMessage;
        // If command fails, fail the test with the error message
        throw new Error(`content:test pattern-art failed: ${execError.message}`);
      }
    });

    it('should generate valid 6x22 pattern layout', () => {
      try {
        const output = execSync('npm run content:test pattern-art', {
          cwd: worktreePath,
          encoding: 'utf-8',
          stdio: 'pipe',
          env: getTestEnv(),
        });

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
      } catch (error) {
        const execError = error as ExecSyncErrorWithMessage;
        throw new Error(`Layout validation failed: ${execError.message}`);
      }
    });

    it('should produce valid color codes (approved Vestaboard colors)', () => {
      try {
        const output = execSync('npm run content:test pattern-art', {
          cwd: worktreePath,
          encoding: 'utf-8',
          stdio: 'pipe',
          env: getTestEnv(),
        });

        // Verify validation passed (no invalid characters)
        expect(output).toContain('VALIDATION RESULT');
        expect(output).toMatch(/Invalid characters:\s*none/i);
        // Verify completion message
        expect(output).toContain('Test completed successfully');
      } catch (error) {
        const execError = error as ExecSyncErrorWithMessage;
        throw new Error(`Color code validation failed: ${execError.message}`);
      }
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
    // it('should generate haiku content', () => {
    //   const output = execSync('npm run content:test haiku', {
    //     cwd: worktreePath,
    //     encoding: 'utf-8',
    //     stdio: 'pipe',
    //     env: getTestEnv(),
    //   });
    //   expect(output).toContain('Test completed successfully');
    // });

    it.skip('placeholder - add AI generator tests here', () => {
      // This is a placeholder to document the pattern for AI generator tests
      expect(true).toBe(true);
    });
  });
});
