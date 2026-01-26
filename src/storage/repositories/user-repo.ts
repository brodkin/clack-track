/**
 * UserRepository - Repository pattern for user persistence
 *
 * Wraps UserModel with graceful error handling following fire-and-forget pattern.
 * Database errors are logged but don't block application flow.
 *
 * @module storage/repositories
 */

import { UserModel, UserRecord, CreateUserInput, UpdateUserInput } from '../models/user.js';

/**
 * Repository for user records with graceful degradation
 *
 * All methods handle database errors gracefully:
 * - save() operations log errors but don't throw (fire-and-forget)
 * - fetch operations return null/empty arrays on errors
 * - Application continues to function without database
 *
 * @example
 * ```typescript
 * const repository = new UserRepository(userModel);
 *
 * // Fire-and-forget save (never throws)
 * await repository.save({ email: 'user@example.com', name: 'John' });
 *
 * // Graceful fetch (returns null on error)
 * const user = await repository.findByEmail('user@example.com');
 * ```
 */
export class UserRepository {
  private model: UserModel;

  constructor(model: UserModel) {
    this.model = model;
  }

  /**
   * Save user record to database
   * Fire-and-forget pattern - logs errors but never throws
   *
   * @param input - User data to save
   * @returns Promise<void> - Always resolves, even on error
   */
  async save(input: CreateUserInput): Promise<void> {
    try {
      await this.model.create(input);
    } catch (error) {
      console.warn('Failed to save user to database:', error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Find a user by their ID
   *
   * @param id - User ID
   * @returns Promise<UserRecord | null> - User or null on error/not found
   */
  async findById(id: number): Promise<UserRecord | null> {
    try {
      return await this.model.findById(id);
    } catch (error) {
      console.warn('Failed to find user by ID:', error);
      return null;
    }
  }

  /**
   * Find a user by their email address
   *
   * @param email - Email address
   * @returns Promise<UserRecord | null> - User or null on error/not found
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    try {
      return await this.model.findByEmail(email);
    } catch (error) {
      console.warn('Failed to find user by email:', error);
      return null;
    }
  }

  /**
   * Update an existing user
   *
   * @param id - User ID to update
   * @param input - Fields to update
   * @returns Promise<UserRecord | null> - Updated user or null on error/not found
   */
  async update(id: number, input: UpdateUserInput): Promise<UserRecord | null> {
    try {
      return await this.model.update(id, input);
    } catch (error) {
      console.warn('Failed to update user:', error);
      return null;
    }
  }

  /**
   * Delete a user by their ID
   *
   * @param id - User ID to delete
   * @returns Promise<boolean> - true if deleted, false on error/not found
   */
  async delete(id: number): Promise<boolean> {
    try {
      return await this.model.delete(id);
    } catch (error) {
      console.warn('Failed to delete user:', error);
      return false;
    }
  }

  /**
   * Find all users with optional limit
   *
   * @param limit - Maximum number of users to return
   * @returns Promise<UserRecord[]> - Users or empty array on error
   */
  async findAll(limit?: number): Promise<UserRecord[]> {
    try {
      return await this.model.findAll(limit);
    } catch (error) {
      console.warn('Failed to find all users:', error);
      return [];
    }
  }

  /**
   * Count total number of users
   *
   * @returns Promise<number> - User count or 0 on error
   */
  async count(): Promise<number> {
    try {
      return await this.model.count();
    } catch (error) {
      console.warn('Failed to count users:', error);
      return 0;
    }
  }

  /**
   * Check if an email address is already in use
   *
   * @param email - Email address to check
   * @returns Promise<boolean> - true if exists, false on error/not found
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      return await this.model.emailExists(email);
    } catch (error) {
      console.warn('Failed to check email existence:', error);
      return false;
    }
  }

  // Legacy method for backwards compatibility
  /**
   * Create a user and return the record
   * Unlike save(), this returns the created user or null on error
   *
   * @param input - User data to create
   * @returns Promise<UserRecord | null> - Created user or null on error
   */
  async createUser(input: CreateUserInput): Promise<UserRecord | null> {
    try {
      return await this.model.create(input);
    } catch (error) {
      console.warn('Failed to create user:', error);
      return null;
    }
  }

  /**
   * Get or create a user by email
   * If user exists, returns existing record
   * If not, creates a new user with optional name
   *
   * @param email - Email address
   * @param name - Optional name for new user
   * @returns Promise<UserRecord | null> - User or null on error
   */
  async getOrCreateByEmail(email: string, name?: string): Promise<UserRecord | null> {
    try {
      // Try to find existing user
      const existing = await this.model.findByEmail(email);
      if (existing) {
        return existing;
      }

      // Create new user
      return await this.model.create({ email, name: name ?? null });
    } catch (error) {
      console.warn('Failed to get or create user:', error);
      return null;
    }
  }
}
