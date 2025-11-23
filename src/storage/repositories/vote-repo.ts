import { VoteModel, VoteRecord } from '../models/index.js';

export class VoteRepository {
  private model: VoteModel;

  constructor(model: VoteModel) {
    this.model = model;
  }

  async submitVote(
    contentId: string,
    vote: 'good' | 'bad',
    metadata?: Record<string, string>
  ): Promise<VoteRecord> {
    return this.model.create({
      contentId,
      vote,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
    });
  }

  async getVotesByContent(contentId: string): Promise<VoteRecord[]> {
    return this.model.findByContentId(contentId);
  }

  async getOverallStats(): Promise<{ good: number; bad: number; ratio: number }> {
    return this.model.getStats();
  }
}
