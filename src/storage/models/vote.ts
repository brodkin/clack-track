import { Knex } from 'knex';
import { parseMySQLDateTime } from '@/storage/parse-datetime.js';

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
  constructor(private knex: Knex) {}

  /**
   * Create a new vote record in the database
   */
  async create(vote: Omit<Vote, 'id' | 'created_at'>): Promise<Vote> {
    const now = new Date();

    const [id] = await this.knex('votes').insert({
      content_id: vote.content_id,
      vote_type: vote.vote_type,
      userAgent: vote.userAgent || null,
      ipAddress: vote.ipAddress || null,
    });

    if (!id) {
      throw new Error('Failed to create vote record');
    }

    return {
      id: id,
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
    const rows = await this.knex('votes')
      .select('id', 'content_id', 'vote_type', 'created_at', 'userAgent', 'ipAddress')
      .where('content_id', contentId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc');

    return rows.map(row => this.mapRowToVote(row));
  }

  /**
   * Get overall vote statistics across all content
   */
  async getStats(): Promise<{ good: number; bad: number; ratio: number }> {
    const rows = await this.knex('votes').select('vote_type');

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
    const row = await this.knex('votes')
      .select('id', 'content_id', 'vote_type', 'created_at', 'userAgent', 'ipAddress')
      .where('id', id)
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToVote(row);
  }

  /**
   * Delete all votes for a specific content
   */
  async deleteByContentId(contentId: number): Promise<number> {
    const deletedCount = await this.knex('votes').where('content_id', contentId).del();
    return deletedCount;
  }

  private mapRowToVote(row: Record<string, unknown>): Vote {
    return {
      id: row.id as number,
      content_id: row.content_id as number,
      vote_type: row.vote_type as 'good' | 'bad',
      created_at: parseMySQLDateTime(row.created_at as string),
      userAgent: row.userAgent as string | undefined,
      ipAddress: row.ipAddress as string | undefined,
    };
  }
}
