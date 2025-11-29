import type { VestaboardHTTPClient } from './http-client.js';
import type { VestaboardClient, AnimationOptions, CharacterConverter } from './types.js';

/**
 * VestaboardClient implementation using dependency injection
 */
export class VestaboardClientImpl implements VestaboardClient {
  constructor(
    private readonly httpClient: VestaboardHTTPClient,
    private readonly converter: CharacterConverter
  ) {}

  /**
   * Send text to the Vestaboard
   * Automatically converts text to uppercase and formats to 6x22 layout
   *
   * @param text - Text to send (can include \n for line breaks)
   */
  async sendText(text: string): Promise<void> {
    const layout = this.converter.textToLayout(text);
    await this.httpClient.post(layout);
  }

  /**
   * Send a custom layout to the Vestaboard
   *
   * @param layout - 6x22 array of character codes
   */
  async sendLayout(layout: number[][]): Promise<void> {
    await this.httpClient.post(layout);
  }

  /**
   * Send a layout with animation to the Vestaboard
   *
   * @param layout - 6x22 array of character codes
   * @param options - Animation configuration
   */
  async sendLayoutWithAnimation(layout: number[][], options: AnimationOptions): Promise<void> {
    await this.httpClient.postWithAnimation(layout, options);
  }

  /**
   * Read the current message from the Vestaboard
   *
   * @returns 6x22 array of character codes
   */
  async readMessage(): Promise<number[][]> {
    return await this.httpClient.get();
  }

  /**
   * Validate connection to the Vestaboard
   * Measures latency by timing a GET request
   *
   * @returns Connection status and latency
   */
  async validateConnection(): Promise<{ connected: boolean; latencyMs?: number }> {
    try {
      const startTime = Date.now();
      await this.httpClient.get();
      const latencyMs = Date.now() - startTime;

      return { connected: true, latencyMs };
    } catch {
      return { connected: false };
    }
  }
}
