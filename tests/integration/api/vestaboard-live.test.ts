import 'dotenv/config';
import { describe, it, expect, beforeAll } from '@jest/globals';
import { createVestaboardClient } from '@/api/vestaboard/index';
import { layoutToText } from '@/api/vestaboard/character-converter';
import type { VestaboardClient } from '@/api/vestaboard/client';

/**
 * Live Vestaboard Integration Tests
 *
 * These tests send real messages to an actual Vestaboard device.
 * Skipped by default - enable with: VESTABOARD_LIVE_TEST=true
 *
 * Required environment variables:
 *   - VESTABOARD_LOCAL_API_KEY
 *   - VESTABOARD_LOCAL_API_URL
 */

const SKIP_LIVE = process.env.VESTABOARD_LIVE_TEST !== 'true';

(SKIP_LIVE ? describe.skip : describe)('Vestaboard Live Integration', () => {
  let client: VestaboardClient;

  beforeAll(() => {
    const apiKey = process.env.VESTABOARD_LOCAL_API_KEY;
    const apiUrl = process.env.VESTABOARD_LOCAL_API_URL;

    if (!apiKey || !apiUrl) {
      throw new Error(
        'Missing VESTABOARD_LOCAL_API_KEY or VESTABOARD_LOCAL_API_URL environment variables'
      );
    }

    client = createVestaboardClient({ apiKey, apiUrl });
  });

  it('should validate connection to Vestaboard', async () => {
    const { connected, latencyMs } = await client.validateConnection();

    expect(connected).toBe(true);
    expect(latencyMs).toBeGreaterThan(0);
    expect(latencyMs).toBeLessThan(5000); // Should respond within 5 seconds
    console.log(`Connection validated: ${latencyMs}ms latency`);
  });

  it('should send text message to Vestaboard', async () => {
    await client.sendText('LIVE TEST\nFROM JEST');

    // If no error thrown, message was sent successfully
    expect(true).toBe(true);
    console.log('Text message sent successfully');
  });

  it('should read current message from Vestaboard', async () => {
    const layout = await client.readMessage();

    expect(layout).toHaveLength(6);
    expect(layout[0]).toHaveLength(22);

    const text = layoutToText(layout);
    console.log('Current display:', text.replace(/\n/g, ' | '));
  });

  it('should send layout with character codes', async () => {
    // Create a simple layout with "HI" centered
    const layout = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // HI
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    await client.sendLayout(layout);
    console.log('Layout sent successfully');
  });

  it('should handle authentication errors', async () => {
    const badClient = createVestaboardClient({
      apiKey: 'invalid-api-key',
      apiUrl: process.env.VESTABOARD_LOCAL_API_URL!,
      maxRetries: 0,
    });

    await expect(badClient.sendText('TEST')).rejects.toThrow('Authentication failed');
  });
});
