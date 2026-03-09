/**
 * Unit tests for auth CLI commands
 *
 * Tests the auth:invite command functionality with mocked dependencies.
 * Uses TDD methodology.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.mock('@/storage/knex', () => ({
  getKnexInstance: jest.fn().mockReturnValue({
    // Return a minimal knex-like object
  }),
  closeKnexInstance: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/storage/models/magic-link', () => ({
  MagicLinkModel: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/storage/repositories/magic-link-repo', () => ({
  MagicLinkRepository: jest.fn().mockImplementation(() => ({})),
}));

// Create a mock generate function that can be controlled per test
let mockGenerate: jest.Mock;

jest.mock('@/auth/magic-link-service', () => {
  return {
    MagicLinkService: jest.fn().mockImplementation(() => ({
      generate: (...args: unknown[]) => mockGenerate(...args),
    })),
    MagicLinkError: class MagicLinkError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'MagicLinkError';
      }
    },
  };
});

describe('authInviteCommand', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Set up the default mock generate function
    mockGenerate = jest.fn().mockResolvedValue({
      id: 1,
      token: 'a'.repeat(64),
      email: 'test@example.com',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      usedAt: null,
      createdBy: null,
      createdAt: new Date(),
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('email validation', () => {
    it('should reject invalid email format', async () => {
      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'not-an-email' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(errorOutput).toMatch(/invalid email/i);
    });

    it('should reject email without @ symbol', async () => {
      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'userexample.com' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(errorOutput).toMatch(/invalid email/i);
    });

    it('should reject email without domain', async () => {
      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'user@' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(errorOutput).toMatch(/invalid email/i);
    });

    it('should accept valid email format', async () => {
      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'valid@example.com' });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(mockGenerate).toHaveBeenCalledWith('valid@example.com', null);
    });
  });

  describe('successful magic link generation', () => {
    it('should output magic link information', async () => {
      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'user@example.com' });

      const output = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('Magic Link Generated');
      expect(output).toContain('user@example.com');
      expect(output).toContain('/register?token=');
    });

    it('should include token in registration URL', async () => {
      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'user@example.com' });

      const output = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toMatch(/register\?token=[a-f0-9]{64}/i);
    });

    it('should show expiration date', async () => {
      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'user@example.com' });

      const output = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('Expires:');
    });
  });

  describe('base URL handling', () => {
    let originalBaseUrl: string | undefined;
    let originalPort: string | undefined;
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
      originalBaseUrl = process.env.BASE_URL;
      originalPort = process.env.WEB_SERVER_PORT;
      originalNodeEnv = process.env.NODE_ENV;
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
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });

    it('should use BASE_URL when set', async () => {
      process.env.BASE_URL = 'https://myapp.example.com';

      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'user@example.com' });

      const output = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('https://myapp.example.com/register?token=');
    });

    it('should use localhost with WEB_SERVER_PORT in production mode', async () => {
      delete process.env.BASE_URL;
      process.env.NODE_ENV = 'production';
      process.env.WEB_SERVER_PORT = '4000';

      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'user@example.com' });

      const output = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('http://localhost:4000/register?token=');
    });

    it('should default to VITE_PORT (3000) in development mode', async () => {
      delete process.env.BASE_URL;
      delete process.env.VITE_PORT;
      process.env.NODE_ENV = 'development';

      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'user@example.com' });

      const output = consoleLogSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('http://localhost:3000/register?token=');
    });
  });

  describe('error handling', () => {
    it('should handle MagicLinkError gracefully', async () => {
      // Override the mock to throw MagicLinkError
      mockGenerate = jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('Failed to create magic link'), { name: 'MagicLinkError' })
        );

      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'user@example.com' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(errorOutput).toContain('Failed to create magic link');
    });

    it('should handle generic errors gracefully', async () => {
      // Override the mock to throw generic error
      mockGenerate = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const { authInviteCommand } = await import('@/cli/commands/auth');
      await authInviteCommand({ email: 'user@example.com' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(errorOutput).toMatch(/failed|error/i);
    });
  });
});
