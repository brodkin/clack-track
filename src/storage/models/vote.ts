import { Database, DatabaseRow } from '../database.js';

export interface Vote {
  id: number;
  content_id: number;
  vote_type: 'good' | 'bad';
  created_at: Date;
  userAgent?: string;
  ipAddress?: string;
}

// Maintain backward compatibility with old interface name
export type VoteRecord = Vote;

/**
 * VoteModel handles database operations for vote records
 * Manages user feedback (good/bad) on generated content
 */
export class VoteModel {
  constructor(private db: Database) {}

  /**
   * Create a new vote record in the database
   */
  async create(vote: Omit<Vote, 'id' | 'created_at'>): Promise<Vote> {
    const now = new Date();

    const result = await this.db.run(
      'INSERT INTO votes (content_id, vote_type, userAgent, ipAddress) VALUES (?, ?, ?, ?)',
      [vote.content_id, vote.vote_type, vote.userAgent || null, vote.ipAddress || null]
    );

    if (!result.lastID) {
      throw new Error('Failed to create vote record');
    }

    return {
      id: result.lastID,
      content_id: vote.content_id,
      vote_type: vote.vote_type,
      created_at: now,
      userAgent: vote.userAgent,
      ipAddress: vote.ipAddress,
    };
  }

  /**
   * Find all votes for a specific content piece
   */
  async findByContentId(contentId: number): Promise<Vote[]> {
    const rows = await this.db.all(
      'SELECT id, content_id, vote_type, created_at, userAgent, ipAddress FROM votes WHERE content_id = ? ORDER BY created_at DESC',
      [contentId]
    );

    return rows.map(row => this.mapRowToVote(row));
  }

  /**
   * Get overall vote statistics across all content
   */
  async getStats(): Promise<{ good: number; bad: number; ratio: number }> {
    const rows = await this.db.all('SELECT vote_type FROM votes', []);

    const good = rows.filter(row => row.vote_type === 'good').length;
    const bad = rows.filter(row => row.vote_type === 'bad').length;
    const total = good + bad;
    const ratio = total > 0 ? good / total : 0;

    return { good, bad, ratio };
  }

  /**
   * Find a vote by ID
   */
  async findById(id: number): Promise<Vote | null> {
    const row = await this.db.get(
      'SELECT id, content_id, vote_type, created_at, userAgent, ipAddress FROM votes WHERE id = ?',
      [id]
    );

    if (!row) {
      return null;
    }

    return this.mapRowToVote(row);
  }

  /**
   * Delete all votes for a specific content
   */
  async deleteByContentId(contentId: number): Promise<number> {
    const result = await this.db.run('DELETE FROM votes WHERE content_id = ?', [contentId]);
    return result.changes || 0;
  }

  private mapRowToVote(row: DatabaseRow): Vote {
    return {
      id: row.id as number,
      content_id: row.content_id as number,
      vote_type: row.vote_type as 'good' | 'bad',
      created_at: new Date(row.created_at as string),
      userAgent: row.userAgent as string | undefined,
      ipAddress: row.ipAddress as string | undefined,
    };
  }
}
