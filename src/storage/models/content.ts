export interface ContentRecord {
  id: string;
  text: string;
  type: 'major' | 'minor';
  generatedAt: Date;
  sentAt: Date | null;
  aiProvider: string;
  metadata?: Record<string, unknown>;
}

export class ContentModel {
  // TODO: Implement database model methods
  async create(_content: Omit<ContentRecord, 'id'>): Promise<ContentRecord> {
    void _content;
    throw new Error('Not implemented');
  }

  async findById(_id: string): Promise<ContentRecord | null> {
    void _id;
    throw new Error('Not implemented');
  }

  async findLatest(_limit: number = 10): Promise<ContentRecord[]> {
    void _limit;
    throw new Error('Not implemented');
  }

  async findByType(_type: 'major' | 'minor', _limit: number = 10): Promise<ContentRecord[]> {
    void _type;
    void _limit;
    throw new Error('Not implemented');
  }
}
