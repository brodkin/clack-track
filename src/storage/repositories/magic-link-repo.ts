/**
 * MagicLinkRepository - Repository pattern for magic link token persistence
 *
 * Wraps MagicLinkModel with graceful error handling and token generation.
 * Provides high-level operations for creating and validating registration invites.
 *
 * @module storage/repositories
 */

import crypto from 'crypto';
import { MagicLinkModel, MagicLinkRecord } from '../models/magic-link.js';

/**
 * Repository for magic link tokens with graceful degradation
 *
 * All methods handle database errors gracefully:
 * - Create operations return null on errors
 * - Validation operations return null on errors
 * - Cleanup operations return 0 on errors
 *
 * @example
 * ```typescript
 * const repository = new MagicLinkRepository(magicLinkModel);
 *
 * // Create an invite link for a new user
 * const invite = await repository.createInvite('newuser@example.com', adminId);
 *
 * // Validate and consume a token (single-use)
 * const result = await repository.validateAndConsume(token);
 * if (result) {
 *   // Token valid, user can register
 * }
 *
 * // Cleanup expired links periodically
 * const deleted = await repository.cleanupExpired();
 * ```
 */
export class MagicLinkRepository {
  private model: MagicLinkModel;

  constructor(model: MagicLinkModel) {
    this.model = model;
  }

  /**
   * Generate a cryptographically secure random token
   * Uses crypto.randomBytes for security-critical token generation
   *
   * @param byteLength - Number of random bytes (default: 32 = 64 hex chars)
   * @returns Hexadecimal string token
   */
  static generateToken(byteLength: number = 32): string {
    return crypto.randomBytes(byteLength).toString('hex');
  }

  /**
   * Create a new magic link invite for a user
   * Generates a secure token and sets expiration
   *
   * @param email - Email address of the user to invite
   * @param createdBy - User ID of the admin creating the invite (optional)
   * @param expirationHours - Hours until the link expires (default: 24)
   * @returns The created magic link record or null on error
   */
  async createInvite(
    email: string,
    createdBy: number | null = null,
    expirationHours: number = 24
  ): Promise<MagicLinkRecord | null> {
    try {
      const token = MagicLinkRepository.generateToken();
      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

      return await this.model.create({
        token,
        email,
        expiresAt,
        createdBy,
      });
    } catch (error) {
      console.warn('Failed to create magic link:', error);
      return null;
    }
  }

  /**
   * Validate and consume a magic link token
   * Marks the token as used if valid, preventing reuse
   *
   * @param token - The magic link token to validate
   * @returns The magic link record with usedAt set, or null if invalid
   */
  async validateAndConsume(token: string): Promise<MagicLinkRecord | null> {
    try {
      // Find the token (only returns if valid, unused, and unexpired)
      const magicLink = await this.model.findByToken(token);

      if (!magicLink) {
        return null;
      }

      // Mark as used to enforce single-use
      return await this.model.markUsed(magicLink.id);
    } catch (error) {
      console.warn('Failed to validate magic link:', error);
      return null;
    }
  }

  /**
   * Peek at a magic link token without consuming it
   * Used to validate tokens and get email for display purposes
   *
   * @param token - The magic link token to peek at
   * @returns The magic link record if valid, or null if invalid/expired/used
   */
  async peek(token: string): Promise<MagicLinkRecord | null> {
    try {
      // Find the token (only returns if valid, unused, and unexpired)
      return await this.model.findByToken(token);
    } catch (error) {
      console.warn('Failed to peek magic link:', error);
      return null;
    }
  }

  /**
   * Find all magic links for an email address
   * Includes expired and used links for audit purposes
   *
   * @param email - Email address to search for
   * @returns Array of magic link records or empty array on error
   */
  async findByEmail(email: string): Promise<MagicLinkRecord[]> {
    try {
      return await this.model.findByEmail(email);
    } catch (error) {
      console.warn('Failed to find magic links by email:', error);
      return [];
    }
  }

  /**
   * Delete all expired magic links
   * Should be called periodically to clean up the database
   *
   * @returns Number of records deleted, 0 on error
   */
  async cleanupExpired(): Promise<number> {
    try {
      const deleted = await this.model.deleteExpired();
      console.log(`Magic link cleanup: deleted ${deleted} expired links`);
      return deleted;
    } catch (error) {
      console.warn('Magic link cleanup failed:', error instanceof Error ? error.message : error);
      return 0;
    }
  }

  /**
   * Revoke all unused magic links for an email address
   * Used when an admin wants to cancel pending invites
   *
   * @param email - Email address to revoke invites for
   * @returns Number of records deleted, 0 on error
   */
  async revokeForEmail(email: string): Promise<number> {
    try {
      return await this.model.deleteUnusedByEmail(email);
    } catch (error) {
      console.warn('Failed to revoke magic links:', error);
      return 0;
    }
  }

  /**
   * Check if an email has a valid (unused, unexpired) invite
   * Useful for preventing duplicate invites
   *
   * @param email - Email address to check
   * @returns true if a valid invite exists, false otherwise
   */
  async hasValidInvite(email: string): Promise<boolean> {
    try {
      const links = await this.model.findByEmail(email);
      const now = new Date();

      // Check if any link is valid (unused and unexpired)
      return links.some(link => link.usedAt === null && link.expiresAt > now);
    } catch (error) {
      console.warn('Failed to check for valid invite:', error);
      return false;
    }
  }
}
