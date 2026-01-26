/**
 * Auth CLI Commands
 *
 * Commands for authentication operations like generating magic link invites.
 * Uses lightweight initialization (database only) - does not start
 * web server, scheduler, or Home Assistant client.
 *
 * @module cli/commands/auth
 */

import { getKnexInstance, closeKnexInstance } from '../../storage/knex.js';
import { MagicLinkModel } from '../../storage/models/magic-link.js';
import { MagicLinkRepository } from '../../storage/repositories/magic-link-repo.js';
import { MagicLinkService, MagicLinkError } from '../../auth/magic-link-service.js';

/**
 * Options for auth:invite command
 */
export interface AuthInviteOptions {
  email: string;
}

/**
 * Simple email validation regex
 * Checks for basic email format: something@something.something
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get the base URL for registration links
 * Uses BASE_URL env var, or falls back to localhost with appropriate port.
 * In development, frontend runs on VITE_PORT (default 3000).
 * In production, frontend is served by the web server on WEB_SERVER_PORT.
 */
function getBaseUrl(): string {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  // In development, use Vite's port (frontend dev server)
  // In production, use web server port (serves both frontend and API)
  const isDev = process.env.NODE_ENV !== 'production';
  const port = isDev
    ? process.env.VITE_PORT || '3000'
    : process.env.WEB_SERVER_PORT || process.env.PORT || '4000';
  return `http://localhost:${port}`;
}

/**
 * Auth invite command - generates a magic link for user registration
 *
 * Creates a secure, single-use token that can be used to invite a new user
 * to register. The token is embedded in a URL that should be sent to the user.
 *
 * Uses lightweight initialization (database only) - does not start
 * web server, scheduler, or Home Assistant client.
 *
 * @param options - Command options containing email address
 *
 * @example
 * ```bash
 * npm run auth:invite -- --email newuser@example.com
 * ```
 */
export async function authInviteCommand(options: AuthInviteOptions): Promise<void> {
  // Validate email format
  if (!isValidEmail(options.email)) {
    console.error(`Error: Invalid email format: ${options.email}`);
    console.error('Usage: npm run auth:invite -- --email user@example.com');
    return;
  }

  const knex = getKnexInstance();

  try {
    // Create service with lightweight dependencies
    const magicLinkModel = new MagicLinkModel(knex);
    const magicLinkRepository = new MagicLinkRepository(magicLinkModel);
    const magicLinkService = new MagicLinkService(magicLinkRepository);

    // Generate the magic link
    const magicLink = await magicLinkService.generate(options.email, null);

    // Build the registration URL
    const baseUrl = getBaseUrl();
    const registrationUrl = `${baseUrl}/register?token=${magicLink.token}`;

    // Output the result
    console.log('');
    console.log('='.repeat(70));
    console.log('                    Magic Link Generated');
    console.log('='.repeat(70));
    console.log('');
    console.log(`  Email:    ${options.email}`);
    console.log(`  Expires:  ${magicLink.expiresAt.toLocaleString()}`);
    console.log('');
    console.log('  Registration URL:');
    console.log(`  ${registrationUrl}`);
    console.log('');
    console.log('='.repeat(70));
    console.log('');
  } catch (error) {
    if (error instanceof MagicLinkError) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error: Failed to generate magic link');
      console.error(error instanceof Error ? error.message : String(error));
    }
  } finally {
    await closeKnexInstance();
  }
}
