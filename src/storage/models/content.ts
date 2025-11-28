import { Database, DatabaseRow } from '../database.js';

export interface ContentRecord {
  id: number;
  text: string;
  type: 'major' | 'minor';
  generatedAt: Date;
  sentAt: Date | null;
  aiProvider: string;
  metadata?: Record<string, unknown>;
  // New fields for success/failure tracking and generator metadata
  status?: 'success' | 'failed'; // Optional with default 'success'
  generatorId?: string;
  generatorName?: string;
  priority?: number;
  aiModel?: string;
  modelTier?: string;
  failedOver?: boolean;
  primaryProvider?: string;
  primaryError?: string;
  errorType?: string;
  errorMessage?: string;
  tokensUsed?: number;
}

/**
 * ContentModel handles database operations for content records
 * Manages generated content (major/minor updates) sent to Vestaboard
 */
export class ContentModel {
  /**
   * Standard SELECT fields for content records
   * Includes all columns from the enhanced schema
   */
  private static readonly SELECT_FIELDS = `
    id, text, type, generatedAt, sentAt, aiProvider, metadata,
    status, generatorId, generatorName, priority, aiModel, modelTier,
    failedOver, primaryProvider, primaryError, errorType, errorMessage, tokensUsed
  `.trim();

  constructor(private db: Database) {}

  /**
   * Validate and sanitize LIMIT clause value to prevent SQL injection
   * Ensures limit is a safe positive integer within reasonable bounds
   * @param limit - User-provided limit value
   * @returns Safe integer value between 1 and 1000
   */
  private safeLimit(limit: number): number {
    return Math.max(1, Math.min(Math.floor(Number(limit) || 10), 1000));
  }

  /**
   * Convert JavaScript Date to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
   * MySQL DATETIME does not support ISO format with 'T' separator or milliseconds
   */
  private toMySQLDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  /**
   * Create a new content record in the database
   */
  async create(content: Omit<ContentRecord, 'id'>): Promise<ContentRecord> {
    const metadataJson = content.metadata ? JSON.stringify(content.metadata) : null;

    const result = await this.db.run(
      `INSERT INTO content (
        text, type, generatedAt, sentAt, aiProvider, metadata,
        status, generatorId, generatorName, priority, aiModel, modelTier,
        failedOver, primaryProvider, primaryError, errorType, errorMessage, tokensUsed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        content.text,
        content.type,
        this.toMySQLDateTime(content.generatedAt),
        content.sentAt ? this.toMySQLDateTime(content.sentAt) : null,
        content.aiProvider,
        metadataJson,
        content.status || 'success',
        content.generatorId || null,
        content.generatorName || null,
        content.priority !== undefined ? content.priority : null,
        content.aiModel || null,
        content.modelTier || null,
        content.failedOver !== undefined ? content.failedOver : null,
        content.primaryProvider || null,
        content.primaryError || null,
        content.errorType || null,
        content.errorMessage || null,
        content.tokensUsed !== undefined ? content.tokensUsed : null,
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
      status: content.status || 'success',
      generatorId: content.generatorId,
      generatorName: content.generatorName,
      priority: content.priority,
      aiModel: content.aiModel,
      modelTier: content.modelTier,
      failedOver: content.failedOver,
      primaryProvider: content.primaryProvider,
      primaryError: content.primaryError,
      errorType: content.errorType,
      errorMessage: content.errorMessage,
      tokensUsed: content.tokensUsed,
    };
  }

  /**
   * Find a content record by ID
   */
  async findById(id: number): Promise<ContentRecord | null> {
    const row = await this.db.get(
      `SELECT ${ContentModel.SELECT_FIELDS} FROM content WHERE id = ?`,
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
    const safeLimit = this.safeLimit(limit);
    const rows = await this.db.all(
      `SELECT ${ContentModel.SELECT_FIELDS} FROM content ORDER BY generatedAt DESC LIMIT ${safeLimit}`,
      []
    );

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Find content records by type (major or minor updates)
   */
  async findByType(type: 'major' | 'minor', limit: number = 10): Promise<ContentRecord[]> {
    const safeLimit = this.safeLimit(limit);
    const rows = await this.db.all(
      `SELECT ${ContentModel.SELECT_FIELDS} FROM content WHERE type = ? ORDER BY generatedAt DESC LIMIT ${safeLimit}`,
      [type]
    );

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Find the most recent successfully sent content
   */
  async findLatestSent(): Promise<ContentRecord | null> {
    const row = await this.db.get(
      `SELECT ${ContentModel.SELECT_FIELDS} FROM content WHERE sentAt IS NOT NULL ORDER BY sentAt DESC LIMIT 1`,
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
    const now = new Date();

    await this.db.run('UPDATE content SET sentAt = ? WHERE id = ?', [
      this.toMySQLDateTime(now),
      id,
    ]);

    return this.findById(id);
  }

  /**
   * Delete old content records (older than specified days)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.db.run('DELETE FROM content WHERE generatedAt < ?', [
      this.toMySQLDateTime(cutoffDate),
    ]);
    return result.changes || 0;
  }

  /**
   * Find content records by status (success or failed)
   */
  async findByStatus(status: 'success' | 'failed', limit: number = 10): Promise<ContentRecord[]> {
    const safeLimit = this.safeLimit(limit);
    const rows = await this.db.all(
      `SELECT ${ContentModel.SELECT_FIELDS} FROM content WHERE status = ? ORDER BY generatedAt DESC LIMIT ${safeLimit}`,
      [status]
    );

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Find all failed content records (convenience method)
   */
  async findFailures(limit: number = 10): Promise<ContentRecord[]> {
    return this.findByStatus('failed', limit);
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
      status: (row.status as 'success' | 'failed') || 'success',
      generatorId: row.generatorId as string | undefined,
      generatorName: row.generatorName as string | undefined,
      priority:
        row.priority !== null && row.priority !== undefined ? (row.priority as number) : undefined,
      aiModel: row.aiModel as string | undefined,
      modelTier: row.modelTier as string | undefined,
      failedOver:
        row.failedOver !== null && row.failedOver !== undefined
          ? Boolean(row.failedOver)
          : undefined,
      primaryProvider: row.primaryProvider as string | undefined,
      primaryError: row.primaryError as string | undefined,
      errorType: row.errorType as string | undefined,
      errorMessage: row.errorMessage as string | undefined,
      tokensUsed:
        row.tokensUsed !== null && row.tokensUsed !== undefined
          ? (row.tokensUsed as number)
          : undefined,
    };
  }
}
