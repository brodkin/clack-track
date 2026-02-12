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

export interface WikipediaAPIResponse {
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

export class WikipediaClient {
  private readonly baseUrl = 'https://en.wikipedia.org/api/rest_v1';
  private readonly userAgent = 'ClackTrack/1.0 (Vestaboard Display Content)';

  /**
   * Fetch a random Wikipedia article summary.
   * Returns only the intro/lead section for token optimization.
   *
   * @param maxLength - Maximum characters to return from extract (default: 800)
   * @returns WikipediaArticle with title, extract, and URL
   * @throws Error if API request fails
   */
  async getRandomArticleSummary(maxLength: number = 800): Promise<WikipediaArticle> {
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

      const data = (await response.json()) as WikipediaAPIResponse;

      // Truncate extract if it exceeds maxLength
      let extract = data.extract || '';
      if (extract.length > maxLength) {
        // Find the last complete sentence within maxLength
        const truncated = extract.substring(0, maxLength);
        const lastPeriod = truncated.lastIndexOf('.');
        const lastQuestion = truncated.lastIndexOf('?');
        const lastExclamation = truncated.lastIndexOf('!');
        const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

        if (lastSentenceEnd > 0) {
          extract = truncated.substring(0, lastSentenceEnd + 1);
        } else {
          // No sentence boundary found, truncate with ellipsis
          extract = truncated + '...';
        }
      }

      return {
        title: data.title,
        extract,
        description: data.description,
        url: data.content_urls.desktop.page,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch random Wikipedia article: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate Wikipedia API connectivity.
   * @returns true if API is accessible
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.getRandomArticleSummary(100); // Fetch small summary for validation
      return true;
    } catch {
      return false;
    }
  }
}
