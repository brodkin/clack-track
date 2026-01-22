/**
 * ContentRepository - Repository pattern for content persistence
 *
 * Wraps ContentModel with graceful error handling following fire-and-forget pattern.
 * Database errors are logged but don't block content delivery.
 *
 * @module storage/repositories
 */

import { ContentModel, ContentRecord } from '../models/index.js';

/**
 * Repository for content records with graceful degradation
 *
 * All methods handle database errors gracefully:
 * - save() operations log errors but don't throw (fire-and-forget)
 * - fetch operations return empty arrays on errors
 * - Application continues to function without database
 *
 * @example
 * ```typescript
 * const repository = new ContentRepository(contentModel);
 *
 * // Fire-and-forget save (never throws)
 * await repository.save({
 *   text: 'Hello World',
 *   type: 'major',
 *   generatedAt: new Date(),
 *   sentAt: new Date(),
 *   aiProvider: 'openai'
 * });
 *
 * // Graceful fetch (returns [] on error)
 * const latest = await repository.findLatest(10);
 * ```
 */
export class ContentRepository {
  private model: ContentModel;

  constructor(model: ContentModel) {
    this.model = model;
  }

  /**
   * Save content record to database
   * Fire-and-forget pattern - logs errors but never throws
   *
   * @param content - Content record data (without id)
   * @returns Promise<void> - Always resolves, even on error
   */
  async save(content: Omit<ContentRecord, 'id'>): Promise<void> {
    try {
      await this.model.create(content);
    } catch (error) {
      console.warn('Failed to save content to database:', error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Find latest content records (newest first)
   *
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Promise<ContentRecord[]> - Records or empty array on error
   */
  async findLatest(limit: number = 10): Promise<ContentRecord[]> {
    try {
      return await this.model.findLatest(limit);
    } catch (error) {
      console.warn('Failed to fetch latest content from database:', error);
      return [];
    }
  }

  /**
   * Find content records by status
   *
   * @param status - Status filter ('success' | 'failed')
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Promise<ContentRecord[]> - Records or empty array on error
   */
  async findByStatus(status: 'success' | 'failed', limit: number = 10): Promise<ContentRecord[]> {
    try {
      return await this.model.findByStatus(status, limit);
    } catch (error) {
      console.warn(`Failed to fetch content by status (${status}):`, error);
      return [];
    }
  }

  /**
   * Find all failed content records
   * Convenience method for failure analysis
   *
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Promise<ContentRecord[]> - Failed records or empty array on error
   */
  async findFailures(limit: number = 10): Promise<ContentRecord[]> {
    try {
      return await this.model.findFailures(limit);
    } catch (error) {
      console.warn('Failed to fetch failures from database:', error);
      return [];
    }
  }

  /**
   * Find the latest content records for a specific generator
   * Ordered by generatedAt descending (newest first)
   *
   * @param generatorId - The generator ID to filter by
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Promise<ContentRecord[]> - Records or empty array on error
   */
  async findLatestByGenerator(generatorId: string, limit: number = 10): Promise<ContentRecord[]> {
    try {
      return await this.model.findByGeneratorIdLatest(generatorId, limit);
    } catch (error) {
      console.warn(`Failed to fetch content by generator (${generatorId}):`, error);
      return [];
    }
  }

  // Legacy methods for backward compatibility
  async saveContent(content: Omit<ContentRecord, 'id'>): Promise<ContentRecord | null> {
    try {
      return await this.model.create(content);
    } catch (error) {
      console.warn('Failed to save content to database:', error);
      return null;
    }
  }

  async getLatestContent(): Promise<ContentRecord | null> {
    try {
      const contents = await this.model.findLatest(1);
      return contents[0] || null;
    } catch (error) {
      console.warn('Failed to fetch latest content:', error);
      return null;
    }
  }

  async getContentHistory(limit: number = 20): Promise<ContentRecord[]> {
    try {
      return await this.model.findLatest(limit);
    } catch (error) {
      console.warn('Failed to fetch content history:', error);
      return [];
    }
  }

  /**
   * Clean up old content records to maintain retention policy
   * Deletes records older than the specified retention period
   *
   * @param retentionDays - Number of days to retain records (default: 90)
   * @returns Number of records deleted
   */
  async cleanupOldRecords(retentionDays: number = 90): Promise<number> {
    try {
      const deleted = await this.model.deleteOlderThan(retentionDays);
      if (deleted > 0) {
        console.log(
          `Retention cleanup: deleted ${deleted} records older than ${retentionDays} days`
        );
      }
      return deleted;
    } catch (error) {
      console.warn('Retention cleanup failed:', error instanceof Error ? error.message : error);
      return 0;
    }
  }
}
