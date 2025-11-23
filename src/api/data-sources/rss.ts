import { RSSFeed, RSSItem } from '../../types/data-sources.js';

export class RSSClient {
  async fetchFeed(_feedUrl: string): Promise<RSSFeed> {
    void _feedUrl;
    // TODO: Implement RSS feed fetching
    throw new Error('Not implemented');
  }

  async getLatestItems(_feedUrl: string, _limit: number = 10): Promise<RSSItem[]> {
    void _feedUrl;
    void _limit;
    // TODO: Implement latest items fetching
    return [];
  }
}
