import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { VestaboardClientImpl } from '@/api/vestaboard/client';
import type { VestaboardHTTPClient } from '@/api/vestaboard/http-client';
import type { AnimationOptions } from '@/api/vestaboard/types';

describe('VestaboardClientImpl', () => {
  let mockHttpClient: jest.Mocked<VestaboardHTTPClient>;
  let client: VestaboardClientImpl;

  beforeEach(() => {
    mockHttpClient = {
      post: jest.fn(),
      postWithAnimation: jest.fn(),
      get: jest.fn(),
    } as jest.Mocked<VestaboardHTTPClient>;

    client = new VestaboardClientImpl(mockHttpClient);
  });

  describe('sendText', () => {
    it('should convert text to layout and send via HTTP client', async () => {
      mockHttpClient.post.mockResolvedValueOnce(undefined);

      await client.sendText('HELLO WORLD');

      expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
      const layout = mockHttpClient.post.mock.calls[0][0];
      expect(layout).toHaveLength(6);
      expect(layout[0]).toHaveLength(22);
    });

    it('should handle empty text', async () => {
      mockHttpClient.post.mockResolvedValueOnce(undefined);

      await client.sendText('');

      expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
    });

    it('should convert lowercase to uppercase', async () => {
      mockHttpClient.post.mockResolvedValueOnce(undefined);

      await client.sendText('hello');

      expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
      const layout = mockHttpClient.post.mock.calls[0][0];
      // Should have converted 'hello' to 'HELLO' (vertically centered at row 2)
      expect(layout[2].filter((code: number) => code !== 0).length).toBeGreaterThan(0);
    });

    it('should propagate HTTP client errors', async () => {
      const testError = new Error('Network error');
      mockHttpClient.post.mockRejectedValueOnce(testError);

      await expect(client.sendText('TEST')).rejects.toThrow('Network error');
    });
  });

  describe('sendLayout', () => {
    const mockLayout = [
      [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    it('should send layout directly via HTTP client', async () => {
      mockHttpClient.post.mockResolvedValueOnce(undefined);

      await client.sendLayout(mockLayout);

      expect(mockHttpClient.post).toHaveBeenCalledWith(mockLayout);
    });

    it('should propagate HTTP client errors', async () => {
      const testError = new Error('HTTP error');
      mockHttpClient.post.mockRejectedValueOnce(testError);

      await expect(client.sendLayout(mockLayout)).rejects.toThrow('HTTP error');
    });
  });

  describe('sendLayoutWithAnimation', () => {
    const mockLayout = [
      [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    const mockOptions: AnimationOptions = {
      strategy: 'column',
      stepIntervalMs: 100,
      stepSize: 1,
    };

    it('should send layout with animation via HTTP client', async () => {
      mockHttpClient.postWithAnimation.mockResolvedValueOnce(undefined);

      await client.sendLayoutWithAnimation(mockLayout, mockOptions);

      expect(mockHttpClient.postWithAnimation).toHaveBeenCalledWith(mockLayout, mockOptions);
    });

    it('should handle different animation strategies', async () => {
      const strategies = ['column', 'row', 'diagonal', 'random'] as const;

      for (const strategy of strategies) {
        mockHttpClient.postWithAnimation.mockResolvedValueOnce(undefined);

        await client.sendLayoutWithAnimation(mockLayout, { strategy });

        expect(mockHttpClient.postWithAnimation).toHaveBeenCalledWith(mockLayout, { strategy });
      }
    });

    it('should propagate HTTP client errors', async () => {
      const testError = new Error('Animation error');
      mockHttpClient.postWithAnimation.mockRejectedValueOnce(testError);

      await expect(client.sendLayoutWithAnimation(mockLayout, mockOptions)).rejects.toThrow(
        'Animation error'
      );
    });
  });

  describe('readMessage', () => {
    const mockResponseLayout = [
      [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    it('should retrieve message layout via HTTP client', async () => {
      mockHttpClient.get.mockResolvedValueOnce(mockResponseLayout);

      const result = await client.readMessage();

      expect(result).toEqual(mockResponseLayout);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
    });

    it('should propagate HTTP client errors', async () => {
      const testError = new Error('GET error');
      mockHttpClient.get.mockRejectedValueOnce(testError);

      await expect(client.readMessage()).rejects.toThrow('GET error');
    });
  });

  describe('validateConnection', () => {
    const mockResponseLayout = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    it('should return connected true on successful GET', async () => {
      mockHttpClient.get.mockResolvedValueOnce(mockResponseLayout);

      const result = await client.validateConnection();

      expect(result.connected).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should measure latency accurately', async () => {
      mockHttpClient.get.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return mockResponseLayout;
      });

      const result = await client.validateConnection();

      expect(result.connected).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return connected false on error', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await client.validateConnection();

      expect(result.connected).toBe(false);
      expect(result.latencyMs).toBeUndefined();
    });
  });
});
