import { ContentModel, ContentRecord } from '../models/index.js';

export class ContentRepository {
  private model: ContentModel;

  constructor(model: ContentModel) {
    this.model = model;
  }

  async saveContent(content: Omit<ContentRecord, 'id'>): Promise<ContentRecord> {
    return this.model.create(content);
  }

  async getLatestContent(): Promise<ContentRecord | null> {
    const contents = await this.model.findLatest(1);
    return contents[0] || null;
  }

  async getContentHistory(limit: number = 20): Promise<ContentRecord[]> {
    return this.model.findLatest(limit);
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
