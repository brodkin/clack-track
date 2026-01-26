import { Knex } from 'knex';

/**
 * Represents a WebAuthn credential record in the database
 * Stores public key credentials for passkey authentication
 */
export interface CredentialRecord {
  id: number;
  userId: number;
  credentialId: string; // Base64 encoded WebAuthn credential ID
  publicKey: string; // Base64 encoded COSE public key
  counter: number; // Signature counter for replay attack prevention
  deviceType?: string; // 'platform' or 'cross-platform'
  name?: string; // Human-readable name for the credential
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * CredentialModel handles database operations for WebAuthn credential records
 * Manages passkey credentials including counter updates for replay attack prevention
 */
export class CredentialModel {
  /**
   * Standard SELECT fields for credential records (snake_case matches DB schema)
   */
  private static readonly SELECT_FIELDS = [
    'id',
    'user_id',
    'credential_id',
    'public_key',
    'counter',
    'device_type',
    'name',
    'created_at',
    'last_used_at',
  ];

  constructor(private knex: Knex) {}

  /**
   * Convert JavaScript Date to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
   * MySQL DATETIME does not support ISO format with 'T' separator or milliseconds
   */
  private toMySQLDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  /**
   * Create a new credential record in the database
   *
   * @param credential - Credential data (without id)
   * @returns The created credential record with generated id
   */
  async create(credential: Omit<CredentialRecord, 'id'>): Promise<CredentialRecord> {
    const [id] = await this.knex('credentials').insert({
      user_id: credential.userId,
      credential_id: credential.credentialId,
      public_key: credential.publicKey,
      counter: credential.counter ?? 0,
      device_type: credential.deviceType || null,
      name: credential.name || null,
      created_at: this.toMySQLDateTime(credential.createdAt),
      last_used_at: credential.lastUsedAt ? this.toMySQLDateTime(credential.lastUsedAt) : null,
    });

    if (!id) {
      throw new Error('Failed to create credential record');
    }

    return {
      id,
      userId: credential.userId,
      credentialId: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter ?? 0,
      deviceType: credential.deviceType,
      name: credential.name,
      createdAt: credential.createdAt,
      lastUsedAt: credential.lastUsedAt ?? null,
    };
  }

  /**
   * Find a credential record by its WebAuthn credential ID
   * This is the primary lookup method for authentication
   *
   * @param credentialId - Base64 encoded credential ID
   * @returns The credential record or null if not found
   */
  async findByCredentialId(credentialId: string): Promise<CredentialRecord | null> {
    const row = await this.knex('credentials')
      .select(CredentialModel.SELECT_FIELDS)
      .where('credential_id', credentialId)
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToCredentialRecord(row);
  }

  /**
   * Find a credential record by its database ID
   *
   * @param id - Database primary key
   * @returns The credential record or null if not found
   */
  async findById(id: number): Promise<CredentialRecord | null> {
    const row = await this.knex('credentials')
      .select(CredentialModel.SELECT_FIELDS)
      .where('id', id)
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToCredentialRecord(row);
  }

  /**
   * Find all credentials for a specific user
   * Returns credentials ordered by createdAt descending (newest first)
   *
   * @param userId - The user's database ID
   * @returns Array of credential records for the user
   */
  async findByUserId(userId: number): Promise<CredentialRecord[]> {
    const rows = await this.knex('credentials')
      .select(CredentialModel.SELECT_FIELDS)
      .where('user_id', userId)
      .orderBy('created_at', 'desc');

    return rows.map(row => this.mapRowToCredentialRecord(row));
  }

  /**
   * Update the signature counter for a credential
   * Used during authentication to prevent replay attacks
   *
   * @param id - Credential database ID
   * @param counter - New counter value (must be greater than current)
   * @returns Updated credential record or null if not found
   */
  async updateCounter(id: number, counter: number): Promise<CredentialRecord | null> {
    const affected = await this.knex('credentials').where('id', id).update({ counter });

    if (affected === 0) {
      return null;
    }

    return this.findById(id);
  }

  /**
   * Update the last used timestamp for a credential
   * Call this after successful authentication
   *
   * @param id - Credential database ID
   * @param lastUsedAt - Timestamp of last use
   * @returns Updated credential record or null if not found
   */
  async updateLastUsed(id: number, lastUsedAt: Date): Promise<CredentialRecord | null> {
    const affected = await this.knex('credentials')
      .where('id', id)
      .update({ last_used_at: this.toMySQLDateTime(lastUsedAt) });

    if (affected === 0) {
      return null;
    }

    return this.findById(id);
  }

  /**
   * Update the name of a credential
   * Allows users to rename their passkeys for easier identification
   *
   * @param id - Credential database ID
   * @param name - New name for the credential
   * @returns true if updated, false if not found
   */
  async updateName(id: number, name: string): Promise<boolean> {
    const affected = await this.knex('credentials').where('id', id).update({ name });

    return affected > 0;
  }

  /**
   * Delete a credential by ID
   *
   * @param id - Credential database ID
   * @returns true if deleted, false if not found
   */
  async delete(id: number): Promise<boolean> {
    const deleted = await this.knex('credentials').where('id', id).del();

    return deleted > 0;
  }

  /**
   * Delete all credentials for a user
   * Typically used when deleting a user account
   *
   * @param userId - User database ID
   * @returns Number of credentials deleted
   */
  async deleteByUserId(userId: number): Promise<number> {
    return await this.knex('credentials').where('user_id', userId).del();
  }

  /**
   * Count credentials for a user
   * Useful for UI display and validation
   *
   * @param userId - User database ID
   * @returns Number of credentials for the user
   */
  async countByUserId(userId: number): Promise<number> {
    const result = await this.knex('credentials')
      .where('user_id', userId)
      .count('id as count')
      .first();

    return Number(result?.count ?? 0);
  }

  /**
   * Map a database row to a CredentialRecord
   * Reads snake_case columns from DB, maps to camelCase interface
   */
  private mapRowToCredentialRecord(row: Record<string, unknown>): CredentialRecord {
    return {
      id: row.id as number,
      userId: row.user_id as number,
      credentialId: row.credential_id as string,
      publicKey: row.public_key as string,
      counter: row.counter as number,
      deviceType: row.device_type as string | undefined,
      name: row.name as string | undefined,
      createdAt: new Date(row.created_at as string),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : null,
    };
  }
}
