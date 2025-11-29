import { VestaboardHTTPClient } from './http-client.js';
import { VestaboardClientImpl } from './client.js';
import { textToLayout } from './character-converter.js';
import type { VestaboardClient, VestaboardClientConfig, CharacterConverter } from './types.js';

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

  const converter: CharacterConverter = {
    textToLayout,
  };

  return new VestaboardClientImpl(httpClient, converter);
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
  CharacterConverter,
} from './types.js';
