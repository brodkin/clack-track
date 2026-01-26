import { Knex } from 'knex';

/**
 * Represents a magic link record for user registration invites
 * Magic links are single-use tokens sent via email to invite new users
 */
export interface MagicLinkRecord {
  id: number;
  token: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdBy: number | null;
  createdAt: Date;
}

/**
 * Input data for creating a new magic link
 */
export interface CreateMagicLinkInput {
  token: string;
  email: string;
  expiresAt: Date;
  createdBy: number | null;
}

/**
 * MagicLinkModel handles database operations for magic link tokens
 * Used for user registration invites with single-use, expiring tokens
 */
export class MagicLinkModel {
  constructor(private knex: Knex) {}

  /**
   * Convert JavaScript Date to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
   * MySQL DATETIME does not support ISO format with 'T' separator or milliseconds
   */
  private toMySQLDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  /**
   * Create a new magic link record in the database
   *
   * @param data - Magic link creation data
   * @returns The created magic link record
   * @throws Error if token is duplicate or database operation fails
   */
  async create(data: CreateMagicLinkInput): Promise<MagicLinkRecord> {
    const now = new Date();

    const [id] = await this.knex('magic_links').insert({
      token: data.token,
      email: data.email,
      expires_at: this.toMySQLDateTime(data.expiresAt),
      used_at: null,
      created_by: data.createdBy,
      created_at: this.toMySQLDateTime(now),
    });

    if (!id) {
      throw new Error('Failed to create magic link record');
    }

    return {
      id,
      token: data.token,
      email: data.email,
      expiresAt: data.expiresAt,
      usedAt: null,
      createdBy: data.createdBy,
      createdAt: now,
    };
  }

  /**
   * Find a magic link by its token
   * Only returns the link if it is:
   * - Not expired (expires_at > now)
   * - Not already used (used_at is null)
   *
   * @param token - The magic link token to find
   * @returns The magic link record or null if not found/expired/used
   */
  async findByToken(token: string): Promise<MagicLinkRecord | null> {
    const now = new Date();

    const row = await this.knex('magic_links')
      .select('*')
      .where('token', token)
      .whereNull('used_at')
      .where('expires_at', '>', this.toMySQLDateTime(now))
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToMagicLinkRecord(row);
  }

  /**
   * Find a magic link by its ID
   * Returns the link regardless of expiration or usage status
   *
   * @param id - The magic link ID
   * @returns The magic link record or null if not found
   */
  async findById(id: number): Promise<MagicLinkRecord | null> {
    const row = await this.knex('magic_links').select('*').where('id', id).first();

    if (!row) {
      return null;
    }

    return this.mapRowToMagicLinkRecord(row);
  }

  /**
   * Mark a magic link as used by setting the used_at timestamp
   * This enforces single-use behavior
   *
   * @param id - The magic link ID to mark as used
   * @returns The updated magic link record or null if not found
   */
  async markUsed(id: number): Promise<MagicLinkRecord | null> {
    const now = new Date();

    await this.knex('magic_links')
      .where('id', id)
      .update({
        used_at: this.toMySQLDateTime(now),
      });

    return this.findById(id);
  }

  /**
   * Delete all expired magic links from the database
   * Useful for periodic cleanup to prevent table bloat
   *
   * @returns Number of records deleted
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();

    const deletedCount = await this.knex('magic_links')
      .where('expires_at', '<', this.toMySQLDateTime(now))
      .del();

    return deletedCount;
  }

  /**
   * Find all magic links for a given email address
   * Returns ALL links (including expired and used) for audit purposes
   * Results ordered by creation date descending (newest first), with ID as tiebreaker
   *
   * @param email - Email address to search for
   * @returns Array of magic link records for the email
   */
  async findByEmail(email: string): Promise<MagicLinkRecord[]> {
    const rows = await this.knex('magic_links')
      .select('*')
      .where('email', email)
      .orderBy([
        { column: 'created_at', order: 'desc' },
        { column: 'id', order: 'desc' },
      ]);

    return rows.map(row => this.mapRowToMagicLinkRecord(row));
  }

  /**
   * Delete all unused magic links for a given email address
   * Used for revoking pending invites
   *
   * @param email - Email address to revoke links for
   * @returns Number of records deleted
   */
  async deleteUnusedByEmail(email: string): Promise<number> {
    const deletedCount = await this.knex('magic_links')
      .where('email', email)
      .whereNull('used_at')
      .del();

    return deletedCount;
  }

  /**
   * Map a database row to a MagicLinkRecord object
   */
  private mapRowToMagicLinkRecord(row: Record<string, unknown>): MagicLinkRecord {
    return {
      id: row.id as number,
      token: row.token as string,
      email: row.email as string,
      expiresAt: new Date(row.expires_at as string),
      usedAt: row.used_at ? new Date(row.used_at as string) : null,
      createdBy: row.created_by as number | null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
