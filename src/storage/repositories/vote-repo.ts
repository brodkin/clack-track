import { VoteModel, VoteRecord } from '../models/index.js';

export class VoteRepository {
  private model: VoteModel;

  constructor(model: VoteModel) {
    this.model = model;
  }

  async submitVote(
    contentId: number,
    vote: 'good' | 'bad',
    metadata?: Record<string, string>
  ): Promise<VoteRecord> {
    return this.model.create({
      content_id: contentId,
      vote_type: vote,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
    });
  }

  async getVotesByContent(contentId: number): Promise<VoteRecord[]> {
    return this.model.findByContentId(contentId);
  }

  async getOverallStats(): Promise<{ good: number; bad: number; ratio: number }> {
    return this.model.getStats();
  }
}
