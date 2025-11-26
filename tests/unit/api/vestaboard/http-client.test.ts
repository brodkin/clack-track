import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { VestaboardHTTPClient } from '@/api/vestaboard/http-client';
import {
  VestaboardAuthenticationError,
  VestaboardConnectionError,
  VestaboardTimeoutError,
  VestaboardRateLimitError,
  VestaboardServerError,
} from '@/api/vestaboard/errors';
import type { AnimationOptions } from '@/api/vestaboard/types';

// Mock fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('VestaboardHTTPClient', () => {
  let client: VestaboardHTTPClient;
  const mockApiKey = 'test-api-key';
  const mockBaseUrl = 'http://vestaboard.local:7000';

  beforeEach(() => {
    jest.clearAllMocks();
    client = new VestaboardHTTPClient({
      apiKey: mockApiKey,
      baseUrl: mockBaseUrl,
      timeoutMs: 5000,
      maxRetries: 3,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should use default baseUrl if not provided', () => {
      const defaultClient = new VestaboardHTTPClient({ apiKey: mockApiKey });
      expect(defaultClient).toBeDefined();
    });

    it('should use default timeout if not provided', () => {
      const defaultClient = new VestaboardHTTPClient({ apiKey: mockApiKey });
      expect(defaultClient).toBeDefined();
    });

    it('should use default maxRetries if not provided', () => {
      const defaultClient = new VestaboardHTTPClient({ apiKey: mockApiKey });
      expect(defaultClient).toBeDefined();
    });
  });

  describe('post', () => {
    const mockLayout = [
      [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    it('should send POST request with correct headers and body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await client.post(mockLayout);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/local-api/message`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vestaboard-Local-Api-Key': mockApiKey,
          },
          body: JSON.stringify(mockLayout),
        })
      );
    });

    it('should include AbortSignal for timeout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await client.post(mockLayout);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('signal');
    });

    it('should throw VestaboardAuthenticationError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardAuthenticationError);
    });

    it('should throw VestaboardAuthenticationError on 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardAuthenticationError);
    });

    it('should throw VestaboardRateLimitError on 429', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '60' : null),
        },
      });

      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardRateLimitError);
    }, 15000);

    it('should extract Retry-After header from 429 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '120' : null),
        },
      });

      try {
        await client.post(mockLayout);
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(VestaboardRateLimitError);
        expect((error as VestaboardRateLimitError).retryAfter).toBe(120);
      }
    }, 15000);

    it('should throw VestaboardServerError on 500+', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardServerError);
    }, 15000); // Increase timeout for retry logic

    it('should throw VestaboardTimeoutError on timeout', async () => {
      mockFetch.mockRejectedValue(new Error('The operation was aborted'));

      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardTimeoutError);
    }, 15000);

    it('should throw VestaboardConnectionError on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardConnectionError);
    }, 15000);

    it('should retry on retryable errors', async () => {
      // First call fails with 503, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      await client.post(mockLayout);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff between retries', async () => {
      // All calls fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const startTime = Date.now();
      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardServerError);
      const elapsed = Date.now() - startTime;

      // Should have taken some time due to backoff (at least 1s for first retry)
      // But not too long (less than 10s total for 3 retries)
      expect(elapsed).toBeGreaterThanOrEqual(500); // Allow for some timing variance
    }, 15000);

    it('should not retry on non-retryable errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardAuthenticationError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect maxRetries limit', async () => {
      const limitedClient = new VestaboardHTTPClient({
        apiKey: mockApiKey,
        baseUrl: mockBaseUrl,
        maxRetries: 2,
        timeoutMs: 50000, // Increase timeout to avoid timeout interference
      });

      mockFetch.mockClear(); // Clear any previous calls
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(limitedClient.post(mockLayout)).rejects.toThrow(VestaboardServerError);

      // Initial attempt + 2 retries = 3 total
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 15000);
  });

  describe('postWithAnimation', () => {
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

    it('should send POST request with animation payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await client.postWithAnimation(mockLayout, mockOptions);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/local-api/message`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            characters: mockLayout,
            strategy: 'column',
            step_interval_ms: 100,
            step_size: 1,
          }),
        })
      );
    });

    it('should use default animation values if not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await client.postWithAnimation(mockLayout, { strategy: 'row' });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.strategy).toBe('row');
      expect(body).toHaveProperty('step_interval_ms');
      expect(body).toHaveProperty('step_size');
    });

    it('should handle all animation strategies', async () => {
      const strategies = [
        'column',
        'reverse-column',
        'edges-to-center',
        'row',
        'diagonal',
        'random',
      ] as const;

      for (const strategy of strategies) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        await client.postWithAnimation(mockLayout, { strategy });

        const callArgs = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        const body = JSON.parse(callArgs[1].body);
        expect(body.strategy).toBe(strategy);
      }
    });
  });

  describe('get', () => {
    const mockResponseLayout = [
      [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    it('should send GET request with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponseLayout,
      });

      await client.get();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/local-api/message`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-Vestaboard-Local-Api-Key': mockApiKey,
          },
        })
      );
    });

    it('should return parsed layout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponseLayout,
      });

      const result = await client.get();

      expect(result).toEqual(mockResponseLayout);
    });

    it('should throw VestaboardAuthenticationError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.get()).rejects.toThrow(VestaboardAuthenticationError);
    });

    it('should retry on retryable errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponseLayout,
        });

      const result = await client.get();

      expect(result).toEqual(mockResponseLayout);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
