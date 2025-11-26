import { Database, DatabaseRow } from '../database.js';

export interface VoteRecord {
  id: number;
  contentId: string;
  vote: 'good' | 'bad';
  votedAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * VoteModel handles database operations for vote records
 * Manages user feedback (good/bad) on generated content
 */
export class VoteModel {
  constructor(private db: Database) {}

  /**
   * Create a new vote record in the database
   */
  async create(vote: Omit<VoteRecord, 'id' | 'votedAt'>): Promise<VoteRecord> {
    const now = new Date();

    const result = await this.db.run(
      'INSERT INTO votes (contentId, vote, votedAt, userAgent, ipAddress) VALUES (?, ?, ?, ?, ?)',
      [vote.contentId, vote.vote, now.toISOString(), vote.userAgent || null, vote.ipAddress || null]
    );

    if (!result.lastID) {
      throw new Error('Failed to create vote record');
    }

    return {
      id: result.lastID,
      contentId: vote.contentId,
      vote: vote.vote,
      votedAt: now,
      userAgent: vote.userAgent,
      ipAddress: vote.ipAddress,
    };
  }

  /**
   * Find all votes for a specific content piece
   */
  async findByContentId(contentId: string): Promise<VoteRecord[]> {
    const rows = await this.db.all(
      'SELECT id, contentId, vote, votedAt, userAgent, ipAddress FROM votes WHERE contentId = ? ORDER BY votedAt DESC',
      [contentId]
    );

    return rows.map(row => this.mapRowToVoteRecord(row));
  }

  /**
   * Get overall vote statistics across all content
   */
  async getStats(): Promise<{ good: number; bad: number; ratio: number }> {
    const rows = await this.db.all('SELECT vote FROM votes', []);

    const good = rows.filter(row => row.vote === 'good').length;
    const bad = rows.filter(row => row.vote === 'bad').length;
    const total = good + bad;
    const ratio = total > 0 ? good / total : 0;

    return { good, bad, ratio };
  }

  /**
   * Find a vote by ID
   */
  async findById(id: number): Promise<VoteRecord | null> {
    const row = await this.db.get(
      'SELECT id, contentId, vote, votedAt, userAgent, ipAddress FROM votes WHERE id = ?',
      [id]
    );

    if (!row) {
      return null;
    }

    return this.mapRowToVoteRecord(row);
  }

  /**
   * Delete all votes for a specific content
   */
  async deleteByContentId(contentId: string): Promise<number> {
    const result = await this.db.run('DELETE FROM votes WHERE contentId = ?', [contentId]);
    return result.changes || 0;
  }

  private mapRowToVoteRecord(row: DatabaseRow): VoteRecord {
    return {
      id: row.id as number,
      contentId: row.contentId as string,
      vote: row.vote as 'good' | 'bad',
      votedAt: new Date(row.votedAt as string),
      userAgent: row.userAgent as string | undefined,
      ipAddress: row.ipAddress as string | undefined,
    };
  }
}
