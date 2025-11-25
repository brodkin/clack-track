import { Database, DatabaseRow } from '../database.js';

export interface ContentRecord {
  id: number;
  text: string;
  type: 'major' | 'minor';
  generatedAt: Date;
  sentAt: Date | null;
  aiProvider: string;
  metadata?: Record<string, unknown>;
}

/**
 * ContentModel handles database operations for content records
 * Manages generated content (major/minor updates) sent to Vestaboard
 */
export class ContentModel {
  constructor(private db: Database) {}

  /**
   * Create a new content record in the database
   */
  async create(content: Omit<ContentRecord, 'id'>): Promise<ContentRecord> {
    const metadataJson = content.metadata ? JSON.stringify(content.metadata) : null;

    const result = await this.db.run(
      'INSERT INTO content (text, type, generatedAt, sentAt, aiProvider, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [
        content.text,
        content.type,
        content.generatedAt.toISOString(),
        content.sentAt ? content.sentAt.toISOString() : null,
        content.aiProvider,
        metadataJson,
      ]
    );

    if (!result.lastID) {
      throw new Error('Failed to create content record');
    }

    return {
      id: result.lastID,
      text: content.text,
      type: content.type,
      generatedAt: content.generatedAt,
      sentAt: content.sentAt,
      aiProvider: content.aiProvider,
      metadata: content.metadata,
    };
  }

  /**
   * Find a content record by ID
   */
  async findById(id: number): Promise<ContentRecord | null> {
    const row = await this.db.get(
      'SELECT id, text, type, generatedAt, sentAt, aiProvider, metadata FROM content WHERE id = ?',
      [id]
    );

    if (!row) {
      return null;
    }

    return this.mapRowToContentRecord(row);
  }

  /**
   * Find the latest content records (newest first)
   */
  async findLatest(limit: number = 10): Promise<ContentRecord[]> {
    const rows = await this.db.all(
      'SELECT id, text, type, generatedAt, sentAt, aiProvider, metadata FROM content ORDER BY generatedAt DESC LIMIT ?',
      [limit]
    );

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Find content records by type (major or minor updates)
   */
  async findByType(type: 'major' | 'minor', limit: number = 10): Promise<ContentRecord[]> {
    const rows = await this.db.all(
      'SELECT id, text, type, generatedAt, sentAt, aiProvider, metadata FROM content WHERE type = ? ORDER BY generatedAt DESC LIMIT ?',
      [type, limit]
    );

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Find the most recent successfully sent content
   */
  async findLatestSent(): Promise<ContentRecord | null> {
    const row = await this.db.get(
      'SELECT id, text, type, generatedAt, sentAt, aiProvider, metadata FROM content WHERE sentAt IS NOT NULL ORDER BY sentAt DESC LIMIT 1',
      []
    );

    if (!row) {
      return null;
    }

    return this.mapRowToContentRecord(row);
  }

  /**
   * Update sent timestamp for a content record
   */
  async markSent(id: number): Promise<ContentRecord | null> {
    const now = new Date().toISOString();

    await this.db.run('UPDATE content SET sentAt = ? WHERE id = ?', [now, id]);

    return this.findById(id);
  }

  /**
   * Delete old content records (older than specified days)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.db.run('DELETE FROM content WHERE generatedAt < ?', [
      cutoffDate.toISOString(),
    ]);
    return result.changes || 0;
  }

  private mapRowToContentRecord(row: DatabaseRow): ContentRecord {
    let metadata: Record<string, unknown> | undefined;
    try {
      const metadataStr = row.metadata as string | null;
      if (metadataStr) {
        metadata = JSON.parse(metadataStr);
      }
    } catch {
      // If metadata parsing fails, leave it undefined
    }

    return {
      id: row.id as number,
      text: row.text as string,
      type: row.type as 'major' | 'minor',
      generatedAt: new Date(row.generatedAt as string),
      sentAt: row.sentAt ? new Date(row.sentAt as string) : null,
      aiProvider: row.aiProvider as string,
      metadata,
    };
  }
}
