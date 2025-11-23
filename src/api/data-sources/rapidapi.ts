import { RapidAPIConfig, RapidAPIResponse } from '../../types/data-sources.js';

export class RapidAPIClient {
  private config: RapidAPIConfig;

  constructor(config: RapidAPIConfig) {
    this.config = config;
  }

  async call<T = unknown>(
    _endpoint: string,
    _params?: Record<string, unknown>
  ): Promise<RapidAPIResponse<T>> {
    void _endpoint;
    void _params;
    // TODO: Implement RapidAPI integration
    throw new Error('Not implemented');
  }
}
