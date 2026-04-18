/**
 * Tests for WikipediaClient
 *
 * Test coverage:
 * - Successful fetch returns formatted WikipediaArticle
 * - Extract truncation at sentence boundaries (., ?, !)
 * - Extract truncation with ellipsis when no sentence boundary
 * - Quality filter skips disambiguation, stub, and "List of..." articles
 * - Quality filter falls back to last roll when all attempts are low-quality
 * - User-Agent header sent on every request
 * - HTTP errors throw
 * - Network errors throw
 * - validateConnection returns true/false based on API availability
 */

import { WikipediaClient } from '@/api/data-sources/wikipedia';

global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

/** Builds a valid /page/random/summary response body */
function buildResponse(overrides: Partial<Record<string, unknown>> = {}): unknown {
  return {
    type: 'standard',
    title: 'Octopus',
    displaytitle: 'Octopus',
    extract:
      'An octopus is a soft-bodied, eight-limbed mollusc of the order Octopoda. The order consists of some 300 species and is grouped within the class Cephalopoda, alongside squids, cuttlefish, and nautiloids. Like other cephalopods, an octopus is bilaterally symmetric with two eyes and a beaked mouth at the center of the eight limbs.',
    description: 'Soft-bodied eight-limbed mollusc',
    content_urls: {
      desktop: {
        page: 'https://en.wikipedia.org/wiki/Octopus',
      },
    },
    ...overrides,
  };
}

function mockJsonResponseOnce(body: unknown): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => body,
  } as Response);
}

describe('WikipediaClient', () => {
  let client: WikipediaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new WikipediaClient();
  });

  describe('getRandomArticleSummary()', () => {
    it('returns a formatted WikipediaArticle on success', async () => {
      mockJsonResponseOnce(buildResponse());

      const article = await client.getRandomArticleSummary();

      expect(article).toEqual({
        title: 'Octopus',
        extract: expect.stringContaining('octopus'),
        description: 'Soft-bodied eight-limbed mollusc',
        url: 'https://en.wikipedia.org/wiki/Octopus',
      });
    });

    it('requests the random summary endpoint with the User-Agent header', async () => {
      mockJsonResponseOnce(buildResponse());

      await client.getRandomArticleSummary();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://en.wikipedia.org/api/rest_v1/page/random/summary',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('ClackTrack'),
            Accept: 'application/json',
          }),
        })
      );
    });

    it('throws when the API returns a non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      await expect(client.getRandomArticleSummary()).rejects.toThrow(/503/);
    });

    it('wraps network errors in a descriptive message', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'));

      await expect(client.getRandomArticleSummary()).rejects.toThrow(
        /Failed to fetch random Wikipedia article: ECONNRESET/
      );
    });
  });

  describe('extract truncation', () => {
    /** Pads an extract to clear the MIN_EXTRACT_LENGTH quality filter (200 chars) */
    const padExtract = (prefix: string): string =>
      prefix + ' ' + 'X'.repeat(Math.max(0, 210 - prefix.length));

    it('truncates at the last period within maxLength', async () => {
      const extract = padExtract(
        'First sentence is here. Second sentence is also here. Third runs over the limit.'
      );
      mockJsonResponseOnce(buildResponse({ extract }));

      const article = await client.getRandomArticleSummary(55);

      expect(article.extract).toBe('First sentence is here. Second sentence is also here.');
    });

    it('truncates at a question mark when present', async () => {
      const extract = padExtract('Have you ever wondered? More filler text continues here.');
      mockJsonResponseOnce(buildResponse({ extract }));

      const article = await client.getRandomArticleSummary(40);

      expect(article.extract).toBe('Have you ever wondered?');
    });

    it('truncates at an exclamation mark when present', async () => {
      const extract = padExtract('What a shock! The rest of the story keeps going further.');
      mockJsonResponseOnce(buildResponse({ extract }));

      const article = await client.getRandomArticleSummary(30);

      expect(article.extract).toBe('What a shock!');
    });

    it('appends an ellipsis when no sentence boundary exists within maxLength', async () => {
      const extract = 'A'.repeat(1000);
      mockJsonResponseOnce(buildResponse({ extract }));

      const article = await client.getRandomArticleSummary(100);

      expect(article.extract).toBe('A'.repeat(100) + '...');
    });

    it('does not truncate when extract is shorter than maxLength', async () => {
      const extract = padExtract('Exactly one long sentence that fits under the cap.');
      mockJsonResponseOnce(buildResponse({ extract }));

      const article = await client.getRandomArticleSummary(800);

      expect(article.extract).toBe(extract);
    });
  });

  describe('quality filter', () => {
    it('skips disambiguation pages and returns the next standard article', async () => {
      mockJsonResponseOnce(buildResponse({ type: 'disambiguation', title: 'Mercury' }));
      mockJsonResponseOnce(buildResponse({ title: 'Octopus' }));

      const article = await client.getRandomArticleSummary();

      expect(article.title).toBe('Octopus');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('skips articles whose extract is below the minimum length', async () => {
      mockJsonResponseOnce(buildResponse({ extract: 'Tiny stub.' }));
      mockJsonResponseOnce(buildResponse({ title: 'Octopus' }));

      const article = await client.getRandomArticleSummary();

      expect(article.title).toBe('Octopus');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('skips "List of ..." articles', async () => {
      mockJsonResponseOnce(buildResponse({ title: 'List of minor planets' }));
      mockJsonResponseOnce(buildResponse({ title: 'Octopus' }));

      const article = await client.getRandomArticleSummary();

      expect(article.title).toBe('Octopus');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('gives up after 5 low-quality rolls and returns the last fetched article', async () => {
      for (let i = 0; i < 5; i++) {
        mockJsonResponseOnce(buildResponse({ type: 'disambiguation', title: `Bad ${i}` }));
      }

      const article = await client.getRandomArticleSummary();

      expect(article.title).toBe('Bad 4');
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('validateConnection()', () => {
    it('returns true when the API responds successfully', async () => {
      mockJsonResponseOnce(buildResponse());

      await expect(client.validateConnection()).resolves.toBe(true);
    });

    it('returns false when the API request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network down'));

      await expect(client.validateConnection()).resolves.toBe(false);
    });

    it('returns false when the API returns a non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      } as Response);

      await expect(client.validateConnection()).resolves.toBe(false);
    });
  });
});
