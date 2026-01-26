/**
 * CredentialRepository - Repository pattern for WebAuthn credential persistence
 *
 * Wraps CredentialModel with graceful error handling following fire-and-forget pattern.
 * Database errors are logged but don't block authentication flows.
 *
 * @module storage/repositories
 */

import { CredentialModel, CredentialRecord } from '../models/credential.js';

/**
 * Repository for WebAuthn credential records with graceful degradation
 *
 * All methods handle database errors gracefully:
 * - save() operations return null on error
 * - fetch operations return null or empty arrays on errors
 * - Application continues to function without database
 *
 * @example
 * ```typescript
 * const repository = new CredentialRepository(credentialModel);
 *
 * // Save a new credential
 * const credential = await repository.save({
 *   userId: 1,
 *   credentialId: 'base64-encoded-id',
 *   publicKey: 'base64-encoded-key',
 *   counter: 0,
 *   createdAt: new Date(),
 * });
 *
 * // Find by credential ID during authentication
 * const found = await repository.findByCredentialId('base64-encoded-id');
 *
 * // Record successful authentication (updates counter and lastUsedAt)
 * await repository.recordAuthentication(found.id, newCounter);
 * ```
 */
export class CredentialRepository {
  private model: CredentialModel;

  constructor(model: CredentialModel) {
    this.model = model;
  }

  /**
   * Save a new credential record to database
   *
   * @param credential - Credential record data (without id)
   * @returns Created credential record or null on error
   */
  async save(credential: Omit<CredentialRecord, 'id'>): Promise<CredentialRecord | null> {
    try {
      return await this.model.create(credential);
    } catch (error) {
      console.warn('Failed to save credential to database:', error);
      return null;
    }
  }

  /**
   * Find a credential by its WebAuthn credential ID
   * Primary lookup method for authentication
   *
   * @param credentialId - Base64 encoded credential ID
   * @returns Credential record or null if not found/error
   */
  async findByCredentialId(credentialId: string): Promise<CredentialRecord | null> {
    try {
      return await this.model.findByCredentialId(credentialId);
    } catch (error) {
      console.warn('Failed to find credential by credentialId:', error);
      return null;
    }
  }

  /**
   * Find all credentials for a user
   *
   * @param userId - User database ID
   * @returns Array of credential records (empty on error)
   */
  async findByUserId(userId: number): Promise<CredentialRecord[]> {
    try {
      return await this.model.findByUserId(userId);
    } catch (error) {
      console.warn('Failed to find credentials by userId:', error);
      return [];
    }
  }

  /**
   * Find a credential by its database ID
   *
   * @param id - Credential database ID
   * @returns Credential record or null if not found/error
   */
  async findById(id: number): Promise<CredentialRecord | null> {
    try {
      return await this.model.findById(id);
    } catch (error) {
      console.warn('Failed to find credential by id:', error);
      return null;
    }
  }

  /**
   * Update the signature counter for a credential
   * Must be called after each successful authentication
   *
   * @param id - Credential database ID
   * @param counter - New counter value
   * @returns Updated credential or null on error
   */
  async updateCounter(id: number, counter: number): Promise<CredentialRecord | null> {
    try {
      return await this.model.updateCounter(id, counter);
    } catch (error) {
      console.warn('Failed to update credential counter:', error);
      return null;
    }
  }

  /**
   * Update the name of a credential
   *
   * @param id - Credential database ID
   * @param name - New name for the credential
   * @returns true if updated, false on error or not found
   */
  async updateName(id: number, name: string): Promise<boolean> {
    try {
      return await this.model.updateName(id, name);
    } catch (error) {
      console.warn('Failed to update credential name:', error);
      return false;
    }
  }

  /**
   * Update the last used timestamp for a credential
   *
   * @param id - Credential database ID
   * @param lastUsedAt - Timestamp of last use
   * @returns Updated credential or null on error
   */
  async updateLastUsed(id: number, lastUsedAt: Date): Promise<CredentialRecord | null> {
    try {
      return await this.model.updateLastUsed(id, lastUsedAt);
    } catch (error) {
      console.warn('Failed to update credential lastUsedAt:', error);
      return null;
    }
  }

  /**
   * Delete a credential by ID
   *
   * @param id - Credential database ID
   * @returns true if deleted, false on error or not found
   */
  async delete(id: number): Promise<boolean> {
    try {
      return await this.model.delete(id);
    } catch (error) {
      console.warn('Failed to delete credential:', error);
      return false;
    }
  }

  /**
   * Delete all credentials for a user
   *
   * @param userId - User database ID
   * @returns Number of credentials deleted (0 on error)
   */
  async deleteByUserId(userId: number): Promise<number> {
    try {
      return await this.model.deleteByUserId(userId);
    } catch (error) {
      console.warn('Failed to delete credentials by userId:', error);
      return 0;
    }
  }

  /**
   * Count credentials for a user
   *
   * @param userId - User database ID
   * @returns Number of credentials (0 on error)
   */
  async countByUserId(userId: number): Promise<number> {
    try {
      return await this.model.countByUserId(userId);
    } catch (error) {
      console.warn('Failed to count credentials:', error);
      return 0;
    }
  }

  /**
   * Record a successful authentication
   * Updates both counter and lastUsedAt in a single logical operation
   *
   * @param id - Credential database ID
   * @param newCounter - New signature counter value
   * @returns Updated credential or null on error
   */
  async recordAuthentication(id: number, newCounter: number): Promise<CredentialRecord | null> {
    try {
      // Update counter first (critical for replay attack prevention)
      const updated = await this.model.updateCounter(id, newCounter);
      if (!updated) {
        return null;
      }

      // Then update last used timestamp
      return await this.model.updateLastUsed(id, new Date());
    } catch (error) {
      console.warn('Failed to record authentication:', error);
      return null;
    }
  }
}
