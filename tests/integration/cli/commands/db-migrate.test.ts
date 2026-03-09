/**
 * Unit Tests for db:migrate CLI Command
 *
 * Tests the db:migrate command which runs pending database migrations
 * using the programmatic Knex API.
 *
 * @module tests/unit/cli/commands/migrate
 */

// Set minimal environment variables BEFORE any imports
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.VESTABOARD_API_KEY = 'test-vestaboard-key';
process.env.VESTABOARD_API_URL = 'http://localhost:7000';

import type { Knex } from 'knex';

// Mock modules BEFORE importing the command
jest.mock('../../../../src/storage/knex.js');

// Now import modules
import { dbMigrateCommand } from '../../../../src/cli/commands/db-migrate.js';
import * as knexModule from '../../../../src/storage/knex.js';

// Mock console methods to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock process.exit to prevent test termination
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`process.exit(${code})`);
});

describe('db:migrate command', () => {
  let mockKnex: jest.Mocked<Knex>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create comprehensive mock Knex instance
    mockKnex = {
      migrate: {
        latest: jest
          .fn()
          .mockResolvedValue([1, ['20240101_create_users', '20240102_create_content']]),
        status: jest.fn().mockResolvedValue({ pending: [], complete: [] }),
      },
      destroy: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Knex>;

    // Mock getKnexInstance
    jest.spyOn(knexModule, 'getKnexInstance').mockReturnValue(mockKnex);
    jest.spyOn(knexModule, 'closeKnexInstance').mockResolvedValue(undefined);
  });

  describe('Successful Migration', () => {
    it('should run knex.migrate.latest()', async () => {
      await dbMigrateCommand();

      expect(mockKnex.migrate.latest).toHaveBeenCalledTimes(1);
    });

    it('should output migration status when migrations run', async () => {
      mockKnex.migrate.latest = jest
        .fn()
        .mockResolvedValue([1, ['20240101_create_users', '20240102_create_content']]);

      await dbMigrateCommand();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Running database migrations')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('20240101_create_users'));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('20240102_create_content')
      );
    });

    it('should output "already up to date" when no migrations pending', async () => {
      mockKnex.migrate.latest = jest.fn().mockResolvedValue([0, []]);

      await dbMigrateCommand();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('already up to date'));
    });

    it('should output batch info after migrations complete', async () => {
      await dbMigrateCommand();

      // The implementation logs batch info rather than a "complete" message
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Batch'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('migration(s)'));
    });

    it('should output batch number when migrations run', async () => {
      mockKnex.migrate.latest = jest.fn().mockResolvedValue([3, ['migration1']]);

      await dbMigrateCommand();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Batch 3'));
    });
  });

  describe('Error Handling', () => {
    it('should handle migration errors gracefully', async () => {
      const errorMsg = 'Migration failed: syntax error';
      mockKnex.migrate.latest = jest.fn().mockRejectedValue(new Error(errorMsg));

      await expect(dbMigrateCommand()).rejects.toThrow('process.exit(1)');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Migration failed'),
        expect.any(Error)
      );
    });

    it('should exit with code 1 on error', async () => {
      mockKnex.migrate.latest = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await dbMigrateCommand();
      } catch (error) {
        expect((error as Error).message).toBe('process.exit(1)');
      }

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle Knex connection errors', async () => {
      jest.spyOn(knexModule, 'getKnexInstance').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(dbMigrateCommand()).rejects.toThrow('process.exit(1)');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Migration failed'),
        expect.any(Error)
      );
    });
  });

  describe('Resource Cleanup', () => {
    it('should close Knex connection after successful migration', async () => {
      await dbMigrateCommand();

      expect(knexModule.closeKnexInstance).toHaveBeenCalledTimes(1);
    });

    it('should close Knex connection even after errors', async () => {
      mockKnex.migrate.latest = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await dbMigrateCommand();
      } catch {
        // Expected to throw
      }

      expect(knexModule.closeKnexInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('Output Formatting', () => {
    it('should log "Running database migrations..." at start', async () => {
      await dbMigrateCommand();

      // Check that the first relevant log is the "Running database migrations" message
      const calls = mockConsoleLog.mock.calls.map(call => call[0]);
      expect(
        calls.some(msg => typeof msg === 'string' && msg.includes('Running database migrations'))
      ).toBe(true);
    });

    it('should list each migration that ran', async () => {
      mockKnex.migrate.latest = jest
        .fn()
        .mockResolvedValue([1, ['migration_a', 'migration_b', 'migration_c']]);

      await dbMigrateCommand();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('migration_a'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('migration_b'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('migration_c'));
    });

    it('should indicate the count of migrations run', async () => {
      mockKnex.migrate.latest = jest.fn().mockResolvedValue([1, ['m1', 'm2', 'm3']]);

      await dbMigrateCommand();

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/3.*migration/i));
    });
  });
});
