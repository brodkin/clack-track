import { Knex } from 'knex';

/**
 * Represents a rejection reason for a validation attempt
 * Used to track why content failed validation during tool-based generation
 */
export interface RejectionReason {
  attempt: number;
  reason: string;
  timestamp?: string;
}

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
  // Validation attempt tracking for tool-based content generation
  validationAttempts?: number;
  rejectionReasons?: RejectionReason[];
  // Output mode tracking for frame decoration
  // 'text' = needs frame decoration, 'layout' = raw characterCodes (no frame)
  outputMode?: 'text' | 'layout' | null;
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
  private static readonly SELECT_FIELDS = [
    'id',
    'text',
    'type',
    'generatedAt',
    'sentAt',
    'aiProvider',
    'metadata',
    'status',
    'generatorId',
    'generatorName',
    'priority',
    'aiModel',
    'modelTier',
    'failedOver',
    'primaryProvider',
    'primaryError',
    'errorType',
    'errorMessage',
    'tokensUsed',
    'validationAttempts',
    'rejectionReasons',
    'outputMode',
  ];

  constructor(private knex: Knex) {}

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
    const rejectionReasonsJson = content.rejectionReasons
      ? JSON.stringify(content.rejectionReasons)
      : null;

    // Determine outputMode: use provided value, null if explicitly null, or default to 'text'
    const outputMode =
      content.outputMode === null
        ? null
        : content.outputMode !== undefined
          ? content.outputMode
          : 'text';

    const [id] = await this.knex('content').insert({
      text: content.text,
      type: content.type,
      generatedAt: this.toMySQLDateTime(content.generatedAt),
      sentAt: content.sentAt ? this.toMySQLDateTime(content.sentAt) : null,
      aiProvider: content.aiProvider,
      metadata: metadataJson,
      status: content.status || 'success',
      generatorId: content.generatorId || null,
      generatorName: content.generatorName || null,
      priority: content.priority !== undefined ? content.priority : null,
      aiModel: content.aiModel || null,
      modelTier: content.modelTier || null,
      failedOver: content.failedOver !== undefined ? content.failedOver : null,
      primaryProvider: content.primaryProvider || null,
      primaryError: content.primaryError || null,
      errorType: content.errorType || null,
      errorMessage: content.errorMessage || null,
      tokensUsed: content.tokensUsed !== undefined ? content.tokensUsed : null,
      validationAttempts: content.validationAttempts !== undefined ? content.validationAttempts : 0,
      rejectionReasons: rejectionReasonsJson,
      outputMode: outputMode,
    });

    if (!id) {
      throw new Error('Failed to create content record');
    }

    return {
      id: id,
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
      validationAttempts: content.validationAttempts ?? 0,
      rejectionReasons: content.rejectionReasons,
      outputMode: outputMode,
    };
  }

  /**
   * Find a content record by ID
   */
  async findById(id: number): Promise<ContentRecord | null> {
    const row = await this.knex('content')
      .select(ContentModel.SELECT_FIELDS)
      .where('id', id)
      .first();

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
    const rows = await this.knex('content')
      .select(ContentModel.SELECT_FIELDS)
      .orderBy('generatedAt', 'desc')
      .limit(safeLimit);

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Find content records by type (major or minor updates)
   */
  async findByType(type: 'major' | 'minor', limit: number = 10): Promise<ContentRecord[]> {
    const safeLimit = this.safeLimit(limit);
    const rows = await this.knex('content')
      .select(ContentModel.SELECT_FIELDS)
      .where('type', type)
      .orderBy('generatedAt', 'desc')
      .limit(safeLimit);

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Find the most recent successfully sent content
   */
  async findLatestSent(): Promise<ContentRecord | null> {
    const row = await this.knex('content')
      .select(ContentModel.SELECT_FIELDS)
      .whereNotNull('sentAt')
      .orderBy('sentAt', 'desc')
      .first();

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

    await this.knex('content')
      .where('id', id)
      .update({
        sentAt: this.toMySQLDateTime(now),
      });

    return this.findById(id);
  }

  /**
   * Delete old content records (older than specified days)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deletedCount = await this.knex('content')
      .where('generatedAt', '<', this.toMySQLDateTime(cutoffDate))
      .del();

    return deletedCount;
  }

  /**
   * Find content records by status (success or failed)
   */
  async findByStatus(status: 'success' | 'failed', limit: number = 10): Promise<ContentRecord[]> {
    const safeLimit = this.safeLimit(limit);
    const rows = await this.knex('content')
      .select(ContentModel.SELECT_FIELDS)
      .where('status', status)
      .orderBy('generatedAt', 'desc')
      .limit(safeLimit);

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Find all failed content records (convenience method)
   */
  async findFailures(limit: number = 10): Promise<ContentRecord[]> {
    return this.findByStatus('failed', limit);
  }

  private mapRowToContentRecord(row: Record<string, unknown>): ContentRecord {
    let metadata: Record<string, unknown> | undefined;
    try {
      const metadataStr = row.metadata as string | null;
      if (metadataStr) {
        metadata = JSON.parse(metadataStr);
      }
    } catch {
      // If metadata parsing fails, leave it undefined
    }

    let rejectionReasons: RejectionReason[] | undefined;
    try {
      const rejectionReasonsStr = row.rejectionReasons as string | null;
      if (rejectionReasonsStr) {
        rejectionReasons = JSON.parse(rejectionReasonsStr);
      }
    } catch {
      // If rejectionReasons parsing fails, leave it undefined
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
      validationAttempts:
        row.validationAttempts !== null && row.validationAttempts !== undefined
          ? (row.validationAttempts as number)
          : 0,
      rejectionReasons,
      outputMode:
        row.outputMode === null
          ? null
          : row.outputMode !== undefined
            ? (row.outputMode as 'text' | 'layout')
            : 'text',
    };
  }

  /**
   * Find the latest content records for a specific generator
   * Ordered by generatedAt descending (newest first)
   *
   * @param generatorId - The generator ID to filter by
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Content records for the specified generator, newest first
   */
  async findByGeneratorIdLatest(generatorId: string, limit: number = 10): Promise<ContentRecord[]> {
    const safeLimit = this.safeLimit(limit);
    const rows = await this.knex('content')
      .select(ContentModel.SELECT_FIELDS)
      .where('generatorId', generatorId)
      .orderBy('generatedAt', 'desc')
      .limit(safeLimit);

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Find content records with validation attempts above threshold
   * Useful for analytics and debugging tool-based generation
   *
   * @param threshold - Minimum number of attempts to filter by
   * @param limit - Maximum number of records to return (default: 100)
   * @returns Records with validationAttempts greater than threshold
   */
  async findWithHighAttempts(threshold: number, limit: number = 100): Promise<ContentRecord[]> {
    const safeLimit = this.safeLimit(limit);
    const rows = await this.knex('content')
      .select(ContentModel.SELECT_FIELDS)
      .where('validationAttempts', '>', threshold)
      .orderBy('validationAttempts', 'desc')
      .limit(safeLimit);

    return rows.map(row => this.mapRowToContentRecord(row));
  }

  /**
   * Calculate average validation attempts across all records
   * Useful for monitoring tool-based content generation efficiency
   *
   * @returns Average number of validation attempts (rounded to nearest integer)
   */
  async getAverageValidationAttempts(): Promise<number> {
    const result = await this.knex('content').avg('validationAttempts as avgAttempts').first();

    if (!result || result.avgAttempts === null) {
      return 0;
    }

    return Math.round(Number(result.avgAttempts));
  }
}
