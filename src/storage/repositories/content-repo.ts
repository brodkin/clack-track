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
}
