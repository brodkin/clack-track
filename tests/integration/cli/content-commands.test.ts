/**
 * Integration tests for content CLI commands
 * Tests that content generators can be invoked via CLI
 */

import { execSync } from 'child_process';
import { describe, it, expect } from '@jest/globals';

interface ExecSyncErrorWithMessage extends Error {
  message: string;
}

describe('Content CLI commands integration', () => {
  const worktreePath = process.cwd();

  describe('pattern-art generator', () => {
    it('should successfully test pattern-art generator', () => {
      try {
        const output = execSync('npm run content:test pattern-art', {
          cwd: worktreePath,
          encoding: 'utf-8',
          stdio: 'pipe',
          env: {
            ...process.env,
            // Ensure required environment variables are set
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
            VESTABOARD_LOCAL_API_KEY: process.env.VESTABOARD_LOCAL_API_KEY || 'test-key',
            VESTABOARD_LOCAL_API_URL:
              process.env.VESTABOARD_LOCAL_API_URL || 'http://localhost:7000',
          },
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
          env: {
            ...process.env,
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
            VESTABOARD_LOCAL_API_KEY: process.env.VESTABOARD_LOCAL_API_KEY || 'test-key',
            VESTABOARD_LOCAL_API_URL:
              process.env.VESTABOARD_LOCAL_API_URL || 'http://localhost:7000',
          },
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
          env: {
            ...process.env,
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
            VESTABOARD_LOCAL_API_KEY: process.env.VESTABOARD_LOCAL_API_KEY || 'test-key',
            VESTABOARD_LOCAL_API_URL:
              process.env.VESTABOARD_LOCAL_API_URL || 'http://localhost:7000',
          },
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
});
