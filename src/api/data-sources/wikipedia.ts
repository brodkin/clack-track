/**
 * Wikipedia API Client
 *
 * Fetches random article summaries from Wikipedia's REST API.
 * Uses the summary endpoint to get only the intro/lead section,
 * optimizing for token usage.
 */

export interface WikipediaArticle {
  title: string;
  extract: string; // Plain text summary (intro section only)
  description?: string; // Short description
  url: string;
}

interface WikipediaAPIResponse {
  type: string;
  title: string;
  displaytitle: string;
  extract: string;
  extract_html?: string;
  description?: string;
  content_urls: {
    desktop: {
      page: string;
    };
  };
}

/** Minimum extract length (chars) to consider an article "quality" */
const MIN_EXTRACT_LENGTH = 200;

/** How many times to re-roll when the random endpoint returns a low-quality article */
const MAX_QUALITY_RETRIES = 5;

export class WikipediaClient {
  private readonly baseUrl = 'https://en.wikipedia.org/api/rest_v1';
  private readonly userAgent = 'ClackTrack/1.0 (Vestaboard Display Content)';

  /**
   * Fetch a random Wikipedia article summary.
   *
   * Wikipedia's random endpoint routinely returns disambiguation pages,
   * list articles, and sub-stub topics that don't yield interesting facts.
   * This method re-rolls up to MAX_QUALITY_RETRIES times to skip those,
   * and falls back to the last fetched article if all rolls are low-quality.
   * Network/API errors are not retried — they throw immediately.
   *
   * @param maxLength - Maximum characters to return from extract (default: 800)
   * @returns WikipediaArticle with title, extract, and URL
   * @throws Error if API request fails
   */
  async getRandomArticleSummary(maxLength: number = 800): Promise<WikipediaArticle> {
    let lastResponse: WikipediaAPIResponse | null = null;

    for (let attempt = 0; attempt < MAX_QUALITY_RETRIES; attempt++) {
      const data = await this.fetchRandomSummary();
      lastResponse = data;
      if (this.isQualityArticle(data)) {
        return this.toArticle(data, maxLength);
      }
    }

    // All rolls returned low-quality articles; fall back to the most recent
    // rather than erroring, so the generator can still produce content.
    return this.toArticle(lastResponse as WikipediaAPIResponse, maxLength);
  }

  /**
   * Validate Wikipedia API connectivity.
   * @returns true if API is accessible
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.fetchRandomSummary();
      return true;
    } catch {
      return false;
    }
  }

  private async fetchRandomSummary(): Promise<WikipediaAPIResponse> {
    const url = `${this.baseUrl}/page/random/summary`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Wikipedia API returned ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as WikipediaAPIResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch random Wikipedia article: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Filters out disambiguation pages, list articles, and stub-length extracts
   * that tend to produce low-quality facts.
   */
  private isQualityArticle(data: WikipediaAPIResponse): boolean {
    if (data.type !== 'standard') return false;
    if (!data.extract || data.extract.length < MIN_EXTRACT_LENGTH) return false;
    if (/^list of /i.test(data.title ?? '')) return false;
    return true;
  }

  private toArticle(data: WikipediaAPIResponse, maxLength: number): WikipediaArticle {
    let extract = data.extract || '';
    if (extract.length > maxLength) {
      const truncated = extract.substring(0, maxLength);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('?'),
        truncated.lastIndexOf('!')
      );
      extract =
        lastSentenceEnd > 0 ? truncated.substring(0, lastSentenceEnd + 1) : truncated + '...';
    }

    return {
      title: data.title,
      extract,
      description: data.description,
      url: data.content_urls.desktop.page,
    };
  }
}
