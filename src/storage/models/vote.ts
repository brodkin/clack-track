export interface VoteRecord {
  id: string;
  contentId: string;
  vote: 'good' | 'bad';
  votedAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export class VoteModel {
  // TODO: Implement database model methods
  async create(_vote: Omit<VoteRecord, 'id' | 'votedAt'>): Promise<VoteRecord> {
    void _vote;
    throw new Error('Not implemented');
  }

  async findByContentId(_contentId: string): Promise<VoteRecord[]> {
    void _contentId;
    throw new Error('Not implemented');
  }

  async getStats(): Promise<{ good: number; bad: number; ratio: number }> {
    throw new Error('Not implemented');
  }
}
