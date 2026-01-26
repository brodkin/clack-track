/**
 * MagicLinkService - Service layer for magic link token management
 *
 * Provides a clean interface for generating and validating magic link tokens
 * used for user registration invites. Delegates persistence to MagicLinkRepository.
 *
 * Features:
 * - Secure token generation (via repository's crypto.randomBytes)
 * - Configurable expiration (env var or constructor config)
 * - Single-use token enforcement (validated and consumed atomically)
 * - Graceful error handling with descriptive error messages
 *
 * @module auth
 */

import { MagicLinkRepository } from '../storage/repositories/magic-link-repo.js';
import { MagicLinkRecord } from '../storage/models/magic-link.js';

/**
 * Custom error class for magic link operations
 */
export class MagicLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MagicLinkError';
  }
}

/**
 * Configuration options for MagicLinkService
 */
export interface MagicLinkServiceConfig {
  /**
   * Number of hours until magic links expire
   * Default: 24 hours (or MAGIC_LINK_EXPIRY_HOURS env var)
   */
  expirationHours?: number;
}

/**
 * Default expiration in hours if not configured
 */
const DEFAULT_EXPIRATION_HOURS = 24;

/**
 * MagicLinkService
 *
 * Service layer for managing magic link tokens used in user registration invites.
 * Wraps the MagicLinkRepository with business logic and validation.
 *
 * @example
 * ```typescript
 * const repository = new MagicLinkRepository(magicLinkModel);
 * const service = new MagicLinkService(repository);
 *
 * // Generate a magic link for a new user
 * const magicLink = await service.generate('newuser@example.com', adminUserId);
 * console.log(`Send this link: /register?token=${magicLink.token}`);
 *
 * // When user clicks the link, validate and get email
 * try {
 *   const email = await service.validate(token);
 *   // Token was valid - proceed with registration for this email
 * } catch (error) {
 *   // Token was invalid, expired, or already used
 * }
 * ```
 */
export class MagicLinkService {
  private readonly repository: MagicLinkRepository;
  private readonly expirationHours: number;

  /**
   * Create a MagicLinkService instance
   *
   * @param repository - MagicLinkRepository for persistence operations
   * @param config - Optional configuration (expiration hours)
   */
  constructor(repository: MagicLinkRepository, config?: MagicLinkServiceConfig) {
    this.repository = repository;
    this.expirationHours = this.resolveExpirationHours(config);
  }

  /**
   * Resolve expiration hours from config, env var, or default
   *
   * Priority:
   * 1. Config value (if provided)
   * 2. MAGIC_LINK_EXPIRY_HOURS env var (if valid number)
   * 3. Default (24 hours)
   */
  private resolveExpirationHours(config?: MagicLinkServiceConfig): number {
    // Priority 1: Config value
    if (config?.expirationHours !== undefined) {
      return config.expirationHours;
    }

    // Priority 2: Environment variable
    const envValue = process.env.MAGIC_LINK_EXPIRY_HOURS;
    if (envValue !== undefined) {
      const parsed = parseInt(envValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    // Priority 3: Default
    return DEFAULT_EXPIRATION_HOURS;
  }

  /**
   * Generate a new magic link token for user registration
   *
   * Creates a secure, single-use token that expires after the configured time.
   * The token should be embedded in a registration URL and sent to the user.
   *
   * @param email - Email address of the user to invite
   * @param createdBy - User ID of the admin creating the invite (optional)
   * @returns The created magic link record with token
   * @throws MagicLinkError if creation fails
   *
   * @example
   * ```typescript
   * const invite = await service.generate('newuser@example.com', adminId);
   * const registrationUrl = `${baseUrl}/register?token=${invite.token}`;
   * await sendEmail(invite.email, registrationUrl);
   * ```
   */
  async generate(email: string, createdBy: number | null = null): Promise<MagicLinkRecord> {
    const result = await this.repository.createInvite(email, createdBy, this.expirationHours);

    if (!result) {
      throw new MagicLinkError('Failed to create magic link');
    }

    return result;
  }

  /**
   * Validate a magic link token and return the associated email
   *
   * This method:
   * 1. Checks if the token exists
   * 2. Verifies it hasn't expired
   * 3. Ensures it hasn't been used before
   * 4. Marks it as used (single-use enforcement)
   *
   * @param token - The magic link token to validate
   * @returns The email address associated with the token
   * @throws MagicLinkError if token is invalid, expired, or already used
   *
   * @example
   * ```typescript
   * try {
   *   const email = await service.validate(tokenFromUrl);
   *   // Create user account with this email
   *   await userService.createUser({ email });
   * } catch (error) {
   *   // Show error to user: "This link is invalid or has expired"
   * }
   * ```
   */
  async validate(token: string): Promise<string> {
    const result = await this.repository.validateAndConsume(token);

    if (!result) {
      throw new MagicLinkError('Invalid or expired magic link');
    }

    return result.email;
  }

  /**
   * Peek at a magic link token without consuming it
   *
   * This method checks if a token is valid and returns the associated email,
   * but does NOT mark it as used. Use this for preview/validation endpoints
   * where you need to show the email but the actual registration hasn't happened yet.
   *
   * @param token - The magic link token to peek at
   * @returns The email address associated with the token
   * @throws MagicLinkError if token is invalid, expired, or already used
   *
   * @example
   * ```typescript
   * try {
   *   const email = await service.peek(tokenFromUrl);
   *   // Show email in registration form
   * } catch (error) {
   *   // Redirect to login or show error
   * }
   * ```
   */
  async peek(token: string): Promise<string> {
    const result = await this.repository.peek(token);

    if (!result) {
      throw new MagicLinkError('Invalid or expired magic link');
    }

    return result.email;
  }

  /**
   * Check if an email has a valid (unused, unexpired) invite pending
   *
   * Useful for preventing duplicate invites or showing status in admin UI.
   *
   * @param email - Email address to check
   * @returns true if a valid invite exists, false otherwise
   */
  async hasValidInvite(email: string): Promise<boolean> {
    return this.repository.hasValidInvite(email);
  }

  /**
   * Revoke all pending invites for an email address
   *
   * Used when an admin wants to cancel invites before they're used.
   *
   * @param email - Email address to revoke invites for
   * @returns Number of invites revoked
   */
  async revokeForEmail(email: string): Promise<number> {
    return this.repository.revokeForEmail(email);
  }

  /**
   * Clean up expired magic links from the database
   *
   * Should be called periodically (e.g., daily cron job) to prevent table bloat.
   *
   * @returns Number of expired links deleted
   */
  async cleanupExpired(): Promise<number> {
    return this.repository.cleanupExpired();
  }
}
