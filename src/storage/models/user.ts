import { Knex } from 'knex';
import { parseMySQLDateTime } from '../parse-datetime.js';

/**
 * Represents a user record in the database
 */
export interface UserRecord {
  id: number;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new user (id and timestamps are auto-generated)
 */
export interface CreateUserInput {
  email: string;
  name?: string | null;
}

/**
 * Input for updating an existing user (all fields optional)
 */
export interface UpdateUserInput {
  email?: string;
  name?: string | null;
}

/**
 * UserModel handles database operations for user records
 * Manages user accounts for authentication in Clack Track
 */
export class UserModel {
  /**
   * Standard SELECT fields for user records
   * Uses snake_case to match database column names
   */
  private static readonly SELECT_FIELDS = ['id', 'email', 'name', 'created_at', 'updated_at'];

  constructor(private knex: Knex) {}

  /**
   * Normalize email for consistent storage and lookup
   * - Trims whitespace
   * - Converts to lowercase
   */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Validate and sanitize LIMIT clause value to prevent SQL injection
   * Ensures limit is a safe positive integer within reasonable bounds
   * @param limit - User-provided limit value
   * @returns Safe integer value between 1 and 1000
   */
  private safeLimit(limit: number): number {
    return Math.max(1, Math.min(Math.floor(Number(limit) || 100), 1000));
  }

  /**
   * Map a database row to a UserRecord
   * Converts snake_case database columns to camelCase for TypeScript interface
   */
  private mapRowToUserRecord(row: Record<string, unknown>): UserRecord {
    return {
      id: row.id as number,
      email: row.email as string,
      name: (row.name as string) || null,
      createdAt: parseMySQLDateTime(row.created_at as string | Date),
      updatedAt: parseMySQLDateTime(row.updated_at as string | Date),
    };
  }

  /**
   * Create a new user record in the database
   * @param input - User data (email required, name optional)
   * @returns Created user record with generated ID and timestamps
   * @throws Error if email is already in use
   */
  async create(input: CreateUserInput): Promise<UserRecord> {
    const normalizedEmail = this.normalizeEmail(input.email);
    const now = new Date();

    const [id] = await this.knex('users').insert({
      email: normalizedEmail,
      name: input.name ?? null,
      created_at: now,
      updated_at: now,
    });

    if (!id) {
      throw new Error('Failed to create user record');
    }

    return {
      id: id,
      email: normalizedEmail,
      name: input.name ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Find a user by their ID
   * @param id - User ID
   * @returns User record or null if not found
   */
  async findById(id: number): Promise<UserRecord | null> {
    const row = await this.knex('users').select(UserModel.SELECT_FIELDS).where('id', id).first();

    if (!row) {
      return null;
    }

    return this.mapRowToUserRecord(row);
  }

  /**
   * Find a user by their email address
   * Email search is case-insensitive
   * @param email - Email address to search for
   * @returns User record or null if not found
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = this.normalizeEmail(email);

    const row = await this.knex('users')
      .select(UserModel.SELECT_FIELDS)
      .where('email', normalizedEmail)
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToUserRecord(row);
  }

  /**
   * Update an existing user record
   * @param id - User ID to update
   * @param input - Fields to update (email and/or name)
   * @returns Updated user record or null if not found
   * @throws Error if updating to an email that's already in use
   */
  async update(id: number, input: UpdateUserInput): Promise<UserRecord | null> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (input.email !== undefined) {
      updateData.email = this.normalizeEmail(input.email);
    }

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    await this.knex('users').where('id', id).update(updateData);

    return this.findById(id);
  }

  /**
   * Delete a user by their ID
   * @param id - User ID to delete
   * @returns true if user was deleted, false if not found
   */
  async delete(id: number): Promise<boolean> {
    const deletedCount = await this.knex('users').where('id', id).del();

    return deletedCount > 0;
  }

  /**
   * Find all users with optional limit
   * Results are ordered by createdAt descending (newest first)
   * @param limit - Maximum number of users to return (default: 100)
   * @returns Array of user records
   */
  async findAll(limit: number = 100): Promise<UserRecord[]> {
    const safeLimit = this.safeLimit(limit);

    const rows = await this.knex('users')
      .select(UserModel.SELECT_FIELDS)
      .orderBy('created_at', 'desc')
      .limit(safeLimit);

    return rows.map(row => this.mapRowToUserRecord(row));
  }

  /**
   * Count total number of users
   * @returns Total user count
   */
  async count(): Promise<number> {
    const result = await this.knex('users').count('id as count').first();

    if (!result || result.count === null) {
      return 0;
    }

    return Number(result.count);
  }

  /**
   * Check if an email address is already in use
   * @param email - Email address to check
   * @returns true if email exists, false otherwise
   */
  async emailExists(email: string): Promise<boolean> {
    const normalizedEmail = this.normalizeEmail(email);

    const row = await this.knex('users').select('id').where('email', normalizedEmail).first();

    return row !== undefined;
  }
}
