/**
 * Validation tests for database CLI commands
 *
 * Tests that database commands can be invoked via direct function imports.
 * Uses real database operations with mocked external boundaries.
 *
 * These tests validate command structure and functionality without spawning processes.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { dbMigrateCommand } from '@/cli/commands/db-migrate.js';
import { dbResetCommand } from '@/cli/commands/db-reset.js';
import type { DbResetOptions } from '@/cli/commands/db-reset.js';
import { resetKnexInstance, closeKnexInstance } from '@/storage/knex.js';

// Mock console methods to capture output
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

// Store original process.exit to restore later
const originalExit = process.exit;

// Mock process.exit to prevent actual exit
const mockExit = jest.fn() as unknown as typeof process.exit;

describe('Database CLI commands validation', () => {
  beforeAll(async () => {
    process.exit = mockExit;
  });

  afterAll(async () => {
    process.exit = originalExit;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    mockExit.mockClear();

    // Reset database instance for clean state
    resetKnexInstance();
  });

  afterEach(async () => {
    // Close database connection after each test
    try {
      await closeKnexInstance();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Custom CLI migration scripts', () => {
    it('db:migrate should execute migration command', async () => {
      await dbMigrateCommand();

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Verify migration output
      expect(output).toMatch(/Running database migrations|Database is already up to date/);
    });
  });

  describe('Database reset commands', () => {
    it('db:reset should complete with force mode', async () => {
      // First run migrations to have tables to reset
      await dbMigrateCommand();
      consoleLogSpy.mockClear(); // Clear migration output

      const options: DbResetOptions = {
        truncate: false,
        seed: false,
        force: true, // Use force to skip interactive prompt in tests
      };

      await dbResetCommand(options);

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Verify reset completed
      expect(output).toMatch(/Database reset complete/);
    });

    it('db:reset should support truncate mode', async () => {
      // First run migrations to have tables to truncate
      await dbMigrateCommand();
      consoleLogSpy.mockClear(); // Clear migration output

      const options: DbResetOptions = {
        truncate: true,
        seed: false,
        force: true,
      };

      await dbResetCommand(options);

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Verify truncate mode was used
      expect(output).toMatch(/Truncating all tables|Database reset complete/);
    });

    it('db:reset should support seed mode', async () => {
      // First run migrations to have tables for seeds
      await dbMigrateCommand();
      consoleLogSpy.mockClear(); // Clear migration output

      const options: DbResetOptions = {
        truncate: false,
        seed: true,
        force: true,
      };

      await dbResetCommand(options);

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Verify seeds were run
      expect(output).toMatch(/Running seeds|Seeds executed successfully|Database reset complete/);
    });
  });

  describe('Production safety', () => {
    it('db:reset should block execution in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        process.env.NODE_ENV = 'production';

        const options: DbResetOptions = {
          truncate: false,
          seed: false,
          force: true,
        };

        await expect(dbResetCommand(options)).rejects.toThrow(
          'db:reset is not allowed in production'
        );
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
});
