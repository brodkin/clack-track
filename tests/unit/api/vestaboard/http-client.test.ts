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

/**
 * Helper to run a promise with fake timers, advancing timers until the promise settles.
 * This properly handles the async retry loop with fake timers.
 */
async function runWithFakeTimers<T>(promise: Promise<T>): Promise<T> {
  let settled = false;
  let result: T;
  let error: unknown;

  promise
    .then(r => {
      result = r;
      settled = true;
    })
    .catch(e => {
      error = e;
      settled = true;
    });

  // Keep advancing timers until the promise settles
  while (!settled) {
    await jest.advanceTimersByTimeAsync(100);
  }

  if (error) {
    throw error;
  }
  return result!;
}

describe('VestaboardHTTPClient', () => {
  let client: VestaboardHTTPClient;
  const mockApiKey = 'test-api-key';
  const mockBaseUrl = 'http://vestaboard.local:7000';

  beforeEach(() => {
    // Use fake timers for deterministic timer testing (avoids real delays in retry logic)
    jest.useFakeTimers();
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
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default baseUrl if not provided', () => {
      const defaultClient = new VestaboardHTTPClient({ apiKey: mockApiKey });

      // Verify default baseUrl is set to the expected constant
      expect(defaultClient['baseUrl']).toBe('http://vestaboard.local:7000');
    });

    it('should use default timeout if not provided', () => {
      const defaultClient = new VestaboardHTTPClient({ apiKey: mockApiKey });

      // Verify default timeout is set to 5000ms
      expect(defaultClient['timeoutMs']).toBe(5000);
    });

    it('should use default maxRetries if not provided', () => {
      const defaultClient = new VestaboardHTTPClient({ apiKey: mockApiKey });

      // Verify default maxRetries is 2 (allowing 3 total attempts: initial + 2 retries)
      expect(defaultClient['maxRetries']).toBe(2);
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
        text: () => Promise.resolve(''),
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
        text: () => Promise.resolve(''),
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

      await expect(runWithFakeTimers(client.post(mockLayout))).rejects.toThrow(
        VestaboardRateLimitError
      );
    });

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
        await runWithFakeTimers(client.post(mockLayout));
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(VestaboardRateLimitError);
        expect((error as VestaboardRateLimitError).retryAfter).toBe(120);
      }
    });

    it('should throw VestaboardServerError on 500+', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(runWithFakeTimers(client.post(mockLayout))).rejects.toThrow(
        VestaboardServerError
      );
    });

    it('should throw VestaboardTimeoutError on timeout', async () => {
      mockFetch.mockRejectedValue(new Error('The operation was aborted'));

      await expect(runWithFakeTimers(client.post(mockLayout))).rejects.toThrow(
        VestaboardTimeoutError
      );
    });

    it('should throw VestaboardConnectionError on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(runWithFakeTimers(client.post(mockLayout))).rejects.toThrow(
        VestaboardConnectionError
      );
    });

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
          text: () => Promise.resolve(''),
          status: 200,
        });

      await runWithFakeTimers(client.post(mockLayout));

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff between retries', async () => {
      // All calls fail - will exhaust 4 attempts (initial + 3 retries, since maxRetries=3)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      let settled = false;
      let caughtError: unknown;
      const promise = client.post(mockLayout);

      // Track when promise settles
      promise.catch(e => {
        caughtError = e;
        settled = true;
      });

      // Verify fetch is called once initially
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // First retry delay: 1000ms (1000 * 2^0)
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second retry delay: 2000ms (1000 * 2^1)
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Third retry delay: 4000ms (1000 * 2^2)
      await jest.advanceTimersByTimeAsync(4000);
      expect(mockFetch).toHaveBeenCalledTimes(4);

      // Wait for promise to settle
      while (!settled) {
        await jest.advanceTimersByTimeAsync(100);
      }

      expect(caughtError).toBeInstanceOf(VestaboardServerError);
    });

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
        timeoutMs: 50000,
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(runWithFakeTimers(limitedClient.post(mockLayout))).rejects.toThrow(
        VestaboardServerError
      );

      // Initial attempt + 2 retries = 3 total
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw VestaboardAuthenticationError when response body contains "invalid api key"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () => Promise.resolve('invalid api key'),
      } as Response);

      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardAuthenticationError);
    });

    it('should throw VestaboardAuthenticationError when response body contains "INVALID API KEY" (case-insensitive)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () => Promise.resolve('INVALID API KEY - please check your credentials'),
      } as Response);

      await expect(client.post(mockLayout)).rejects.toThrow(VestaboardAuthenticationError);
    });

    it('should throw generic Error on 400 Bad Request', async () => {
      // Generic errors are retryable, so all attempts will fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(runWithFakeTimers(client.post(mockLayout))).rejects.toThrow(
        'HTTP error 400: Bad Request'
      );
    });

    it('should throw generic Error on 404 Not Found', async () => {
      // Generic errors are retryable, so all attempts will fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(runWithFakeTimers(client.post(mockLayout))).rejects.toThrow(
        'HTTP error 404: Not Found'
      );
    });

    it('should handle non-Error exceptions and wrap them in VestaboardConnectionError', async () => {
      mockFetch.mockRejectedValue('string error not an Error object');

      try {
        await runWithFakeTimers(client.post(mockLayout));
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(VestaboardConnectionError);
        expect((error as Error).message).toBe('Unknown connection error');
      }
    });
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
        text: () => Promise.resolve(''),
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
        text: () => Promise.resolve(''),
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
          text: () => Promise.resolve(''),
          status: 200,
        });

        await client.postWithAnimation(mockLayout, { strategy });

        const callArgs = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        const body = JSON.parse(callArgs[1].body);
        expect(body.strategy).toBe(strategy);
      }
    });

    it('should throw VestaboardAuthenticationError on 401 in postWithAnimation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(client.postWithAnimation(mockLayout, mockOptions)).rejects.toThrow(
        VestaboardAuthenticationError
      );
    });

    it('should throw VestaboardAuthenticationError on 403 in postWithAnimation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as Response);

      await expect(client.postWithAnimation(mockLayout, mockOptions)).rejects.toThrow(
        VestaboardAuthenticationError
      );
    });

    it('should throw VestaboardRateLimitError on 429 in postWithAnimation', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '60' : null),
        },
      } as Response);

      await expect(
        runWithFakeTimers(client.postWithAnimation(mockLayout, mockOptions))
      ).rejects.toThrow(VestaboardRateLimitError);
    });

    it('should throw VestaboardServerError on 500+ in postWithAnimation', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      await expect(
        runWithFakeTimers(client.postWithAnimation(mockLayout, mockOptions))
      ).rejects.toThrow(VestaboardServerError);
    });

    it('should throw VestaboardAuthenticationError when animation response body contains "invalid api key"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () => Promise.resolve('invalid api key'),
      } as Response);

      await expect(client.postWithAnimation(mockLayout, mockOptions)).rejects.toThrow(
        VestaboardAuthenticationError
      );
    });

    it('should throw VestaboardTimeoutError on timeout in postWithAnimation', async () => {
      mockFetch.mockRejectedValue(new Error('The operation was aborted'));

      await expect(
        runWithFakeTimers(client.postWithAnimation(mockLayout, mockOptions))
      ).rejects.toThrow(VestaboardTimeoutError);
    });

    it('should throw VestaboardConnectionError on network failure in postWithAnimation', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        runWithFakeTimers(client.postWithAnimation(mockLayout, mockOptions))
      ).rejects.toThrow(VestaboardConnectionError);
    });
  });

  describe('executeWithRetry edge cases', () => {
    const mockLayout = [
      [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    it('should execute timeout callback when request takes too long', async () => {
      const shortTimeoutClient = new VestaboardHTTPClient({
        apiKey: mockApiKey,
        baseUrl: mockBaseUrl,
        timeoutMs: 100,
        maxRetries: 0,
      });

      // Simulate a slow response that triggers timeout
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('The operation was aborted'));
            }, 200);
          })
      );

      await expect(runWithFakeTimers(shortTimeoutClient.post(mockLayout))).rejects.toThrow(
        VestaboardTimeoutError
      );
    });

    it('should execute exponential backoff delay callback on retries', async () => {
      // Force retries with server errors
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
          status: 200,
        });

      const promise = client.post(mockLayout);

      // Verify first retry is attempted after 1000ms delay
      expect(mockFetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify second retry is attempted after 2000ms delay
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      await promise;
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
        text: () => Promise.resolve(''),
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
        text: () => Promise.resolve(''),
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
          text: () => Promise.resolve(''),
          status: 200,
          json: async () => mockResponseLayout,
        });

      const result = await runWithFakeTimers(client.get());

      expect(result).toEqual(mockResponseLayout);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle wrapped message format { message: [[...]] }', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
        status: 200,
        json: async () => ({ message: mockResponseLayout }),
      } as Response);

      const result = await client.get();

      expect(result).toEqual(mockResponseLayout);
    });

    it('should handle flat array format (backward compatibility)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
        status: 200,
        json: async () => mockResponseLayout,
      } as Response);

      const result = await client.get();

      expect(result).toEqual(mockResponseLayout);
    });
  });
});
