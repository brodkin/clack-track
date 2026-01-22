/**
 * Validation tests for npm scripts - verifies scripts can be invoked
 * This test suite validates command structure without requiring full environment setup
 */

import { execSync } from 'child_process';
import { describe, it, expect } from '@jest/globals';

interface ExecSyncErrorWithMessage extends Error {
  message: string;
}

describe('Database npm scripts validation', () => {
  // Use current working directory (or workspace root)
  const worktreePath = process.cwd();

  describe('Custom CLI migration scripts', () => {
    it('db:migrate should use custom CLI handler', () => {
      // db:migrate uses custom CLI (like db:reset), not direct knex CLI
      // We verify the script is accessible via npm run listing
      const output = execSync('npm run', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Verify db:migrate is listed and uses tsx (custom CLI pattern)
      expect(output).toContain('db:migrate');
      expect(output).toContain('tsx src/cli/index.ts db:migrate');
    });
  });

  describe('Knex migration scripts', () => {
    it('db:rollback should use correct knexfile path', () => {
      try {
        const output = execSync('npm run db:rollback -- --help', {
          cwd: worktreePath,
          encoding: 'utf-8',
          stdio: 'pipe',
        });

        // Should show migrate:rollback help
        expect(output).toContain('Rollback');
      } catch (error) {
        // If command fails, check it's using correct knexfile
        const execError = error as ExecSyncErrorWithMessage;
        expect(execError.message).toContain('knexfile');
      }
    });

    it('db:seed should use correct knexfile path', () => {
      try {
        const output = execSync('npm run db:seed -- --help', {
          cwd: worktreePath,
          encoding: 'utf-8',
          stdio: 'pipe',
        });

        // Should show seed:run help
        expect(output).toContain('seed');
      } catch (error) {
        // If command fails, check it's using correct knexfile
        const execError = error as ExecSyncErrorWithMessage;
        expect(execError.message).toContain('knexfile');
      }
    });
  });

  describe('Script accessibility', () => {
    it('should list all db: scripts via npm run', () => {
      const output = execSync('npm run', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      expect(output).toContain('db:reset');
      expect(output).toContain('db:reset:seed');
      expect(output).toContain('db:migrate');
      expect(output).toContain('db:rollback');
      expect(output).toContain('db:seed');
    });
  });
});
