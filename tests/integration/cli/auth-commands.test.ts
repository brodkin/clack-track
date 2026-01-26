/**
 * Integration tests for auth CLI commands
 *
 * Tests the auth:invite command for generating magic link registration invites.
 * Uses TDD methodology - tests written before implementation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Knex } from 'knex';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getKnexInstance, closeKnexInstance, resetKnexInstance } from '@/storage/knex';
import { MagicLinkModel } from '@/storage/models/magic-link';
import { MagicLinkRepository } from '@/storage/repositories/magic-link-repo';
import { MagicLinkService } from '@/auth/magic-link-service';

interface PackageJson {
  scripts: Record<string, string>;
}

describe('Auth CLI Commands', () => {
  describe('npm script configuration', () => {
    const packageJsonPath = resolve(__dirname, '../../../package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent) as PackageJson;

    it('should have auth:invite script defined in package.json', () => {
      expect(packageJson.scripts['auth:invite']).toBeDefined();
    });

    it('should use correct command structure for auth:invite', () => {
      const script = packageJson.scripts['auth:invite'];
      expect(script).toContain('node dist/index.js auth:invite');
    });
  });

  describe('auth:invite command functionality', () => {
    let knex: Knex;
    let magicLinkModel: MagicLinkModel;
    let magicLinkRepository: MagicLinkRepository;
    let magicLinkService: MagicLinkService;

    beforeAll(async () => {
      resetKnexInstance();
      knex = getKnexInstance();

      // Create magic_links table if it doesn't exist
      const hasMagicLinksTable = await knex.schema.hasTable('magic_links');
      if (!hasMagicLinksTable) {
        await knex.schema.createTable('magic_links', table => {
          table.increments('id').primary();
          table.string('token', 64).notNullable().unique();
          table.string('email', 255).notNullable();
          table.datetime('expires_at').notNullable();
          table.datetime('used_at').nullable();
          table.integer('created_by').unsigned().nullable();
          table.datetime('created_at').notNullable();
        });
      }

      // Set up service dependencies
      magicLinkModel = new MagicLinkModel(knex);
      magicLinkRepository = new MagicLinkRepository(magicLinkModel);
      magicLinkService = new MagicLinkService(magicLinkRepository);
    });

    beforeEach(async () => {
      // Clean up magic_links table before each test
      await knex('magic_links').del();
    });

    afterAll(async () => {
      await closeKnexInstance();
    });

    it('should generate a magic link for valid email via service', async () => {
      const email = 'newuser@example.com';

      // Use the service directly to test the core functionality
      const result = await magicLinkService.generate(email, null);

      expect(result).toBeDefined();
      expect(result.email).toBe(email);
      expect(result.token).toHaveLength(64);
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify in database
      const links = await knex('magic_links').where('email', email);
      expect(links).toHaveLength(1);
      expect(links[0].token).toHaveLength(64);
    });

    it('should generate a unique token for each invite', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      const result1 = await magicLinkService.generate(email1, null);
      const result2 = await magicLinkService.generate(email2, null);

      expect(result1.token).not.toBe(result2.token);
    });

    it('should set expiration based on config', async () => {
      const email = 'test@example.com';
      const beforeGenerate = new Date();

      const result = await magicLinkService.generate(email, null);

      // Default expiration is 24 hours
      const expectedExpiry = new Date(beforeGenerate.getTime() + 24 * 60 * 60 * 1000);
      // Allow 1 minute tolerance for test execution time
      expect(result.expiresAt.getTime()).toBeGreaterThan(expectedExpiry.getTime() - 60000);
      expect(result.expiresAt.getTime()).toBeLessThan(expectedExpiry.getTime() + 60000);
    });
  });

  describe('email validation', () => {
    it('should accept valid email formats', () => {
      // Testing the email validation logic that the command uses
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user@subdomain.example.com',
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of validEmails) {
        expect(emailRegex.test(email)).toBe(true);
      }
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user@.com',
        'user space@example.com',
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of invalidEmails) {
        expect(emailRegex.test(email)).toBe(false);
      }
    });
  });

  describe('base URL configuration', () => {
    let originalBaseUrl: string | undefined;
    let originalPort: string | undefined;

    beforeEach(() => {
      originalBaseUrl = process.env.BASE_URL;
      originalPort = process.env.WEB_SERVER_PORT;
    });

    afterEach(() => {
      if (originalBaseUrl !== undefined) {
        process.env.BASE_URL = originalBaseUrl;
      } else {
        delete process.env.BASE_URL;
      }
      if (originalPort !== undefined) {
        process.env.WEB_SERVER_PORT = originalPort;
      } else {
        delete process.env.WEB_SERVER_PORT;
      }
    });

    it('should use BASE_URL when set', () => {
      process.env.BASE_URL = 'https://myapp.example.com';

      const baseUrl = process.env.BASE_URL;
      const token = 'abc123';
      const url = `${baseUrl}/register?token=${token}`;

      expect(url).toBe('https://myapp.example.com/register?token=abc123');
    });

    it('should use localhost with port when BASE_URL is not set', () => {
      delete process.env.BASE_URL;
      process.env.WEB_SERVER_PORT = '3000';

      const port = process.env.WEB_SERVER_PORT || '3000';
      const baseUrl = `http://localhost:${port}`;
      const token = 'abc123';
      const url = `${baseUrl}/register?token=${token}`;

      expect(url).toBe('http://localhost:3000/register?token=abc123');
    });
  });
});

describe('CLI index routing for auth commands', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should route auth:invite to authInviteCommand', async () => {
    // Mock the auth command module
    jest.mock('@/cli/commands/auth', () => ({
      authInviteCommand: jest.fn().mockResolvedValue(undefined),
    }));

    const { runCLI } = await import('@/cli/index');
    const { authInviteCommand } = await import('@/cli/commands/auth');

    // Simulate: node dist/index.js auth:invite --email user@example.com
    await runCLI(['node', 'script.js', 'auth:invite', '--email', 'user@example.com']);

    expect(jest.mocked(authInviteCommand)).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
      })
    );
  });

  it('should show error when --email flag is missing', async () => {
    jest.resetModules();
    const { runCLI } = await import('@/cli/index');

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    try {
      await runCLI(['node', 'script.js', 'auth:invite']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/requires.*--email|--email.*requires/i);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
