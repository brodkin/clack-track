import { VestaboardHTTPClient } from './http-client.js';
import { VestaboardClientImpl } from './client.js';
import type { VestaboardClient, VestaboardClientConfig } from './types.js';

/**
 * Factory function to create a VestaboardClient instance
 *
 * @param config - Client configuration
 * @returns VestaboardClient instance
 */
export function createVestaboardClient(config: VestaboardClientConfig): VestaboardClient {
  const httpClient = new VestaboardHTTPClient({
    apiKey: config.apiKey,
    baseUrl: config.apiUrl,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  return new VestaboardClientImpl(httpClient);
}

// Export errors
export * from './errors.js';

// Export character converter functions
export * from './character-converter.js';

// Export types
export type {
  AnimationStrategy,
  AnimationOptions,
  VestaboardClientConfig,
  VestaboardClient,
} from './types.js';
