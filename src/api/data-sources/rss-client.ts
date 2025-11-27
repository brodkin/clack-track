/**
 * RSS Client for fetching and parsing RSS feeds
 * Uses rss-parser library for reliable RSS/Atom feed parsing
 */

import Parser from 'rss-parser';

export interface RSSItem {
  title: string;
  link: string;
  pubDate: Date;
  contentSnippet?: string;
  source: string;
}

export interface RSSFeed {
  title: string;
  items: RSSItem[];
}

export class RSSClient {
  private parser: Parser;
  private timeout: number;

  constructor(timeout: number = 10000) {
    this.parser = new Parser({
      timeout: timeout,
    });
    this.timeout = timeout;
  }

  /**
   * Validate URL to prevent SSRF attacks
   * @param url - URL to validate
   * @throws Error if URL is not allowed (non-HTTP protocol or private/internal address)
   */
  private validateUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Protocol whitelist: only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Protocol not allowed: ${parsed.protocol}`);
    }

    // Normalize hostname for case-insensitive comparison
    const hostname = parsed.hostname.toLowerCase();

    // IPv6 addresses start with '[' in hostname
    if (hostname.startsWith('[')) {
      this.validateIPv6(hostname);
      return;
    }

    // IPv4 and hostname validation
    // Block localhost
    if (hostname === 'localhost') {
      throw new Error('URL not allowed: private/internal address (localhost)');
    }

    // Block 0.0.0.0 (unspecified address)
    if (hostname === '0.0.0.0') {
      throw new Error('URL not allowed: private/internal address (0.0.0.0)');
    }

    // Block cloud metadata endpoint (AWS, GCP, Azure, DigitalOcean)
    if (hostname === '169.254.169.254') {
      throw new Error('URL not allowed: cloud metadata endpoint blocked');
    }

    // Check for private IP ranges using IP address patterns
    // 127.x.x.x (loopback)
    if (hostname.startsWith('127.')) {
      throw new Error('URL not allowed: private/internal address (loopback 127.x.x.x)');
    }

    // 10.x.x.x (private class A)
    if (hostname.startsWith('10.')) {
      throw new Error('URL not allowed: private/internal address (10.x.x.x)');
    }

    // 192.168.x.x (private class C)
    if (hostname.startsWith('192.168.')) {
      throw new Error('URL not allowed: private/internal address (192.168.x.x)');
    }

    // 172.16.x.x - 172.31.x.x (private class B)
    const match172 = hostname.match(/^172\.(\d+)\./);
    if (match172) {
      const secondOctet = parseInt(match172[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        throw new Error('URL not allowed: private/internal address (172.16-31.x.x)');
      }
    }

    // 169.254.x.x (link-local)
    if (hostname.startsWith('169.254.')) {
      throw new Error('URL not allowed: link-local address (169.254.x.x)');
    }
  }

  /**
   * Validate IPv6 addresses to prevent SSRF attacks
   * @param hostname - Hostname with brackets (e.g., "[::1]")
   * @throws Error if IPv6 address is not allowed
   */
  private validateIPv6(hostname: string): void {
    // Remove brackets and normalize
    const ipv6 = hostname.slice(1, -1).toLowerCase();

    // Block IPv6 localhost (::1 and expanded form)
    if (ipv6 === '::1' || ipv6 === '0:0:0:0:0:0:0:1') {
      throw new Error('URL not allowed: IPv6 localhost');
    }

    // Block IPv6 unique local addresses (fc00::/7)
    // This includes fc00:: through fdff::
    if (ipv6.startsWith('fc') || ipv6.startsWith('fd')) {
      throw new Error('URL not allowed: IPv6 private address');
    }

    // Block IPv6 link-local addresses (fe80::/10)
    // This includes fe80:: through febf::
    if (
      ipv6.startsWith('fe8') ||
      ipv6.startsWith('fe9') ||
      ipv6.startsWith('fea') ||
      ipv6.startsWith('feb')
    ) {
      throw new Error('URL not allowed: IPv6 link-local address');
    }

    // Block IPv4-mapped IPv6 addresses for private ranges
    // Format: ::ffff:x.x.x.x or ::ffff:xxxx:xxxx (Node.js converts to hex)
    if (ipv6.startsWith('::ffff:')) {
      const remainder = ipv6.slice(7);

      // Check if it's in dotted-decimal format (x.x.x.x)
      if (remainder.includes('.')) {
        // Validate as IPv4
        if (
          remainder.startsWith('127.') ||
          remainder.startsWith('10.') ||
          remainder.startsWith('192.168.') ||
          remainder === '0.0.0.0'
        ) {
          throw new Error('URL not allowed: IPv4-mapped private address');
        }

        // Check 172.16-31.x.x range
        const match172 = remainder.match(/^172\.(\d+)\./);
        if (match172) {
          const secondOctet = parseInt(match172[1], 10);
          if (secondOctet >= 16 && secondOctet <= 31) {
            throw new Error('URL not allowed: IPv4-mapped private address');
          }
        }

        // Check link-local 169.254.x.x
        if (remainder.startsWith('169.254.')) {
          throw new Error('URL not allowed: IPv4-mapped private address');
        }
      } else {
        // Node.js URL parser converts IPv4 to hex (e.g., ::ffff:7f00:1)
        // Block common private ranges in hex format
        // 127.0.0.0/8 -> 7f00:0000 to 7fff:ffff
        if (remainder.startsWith('7f')) {
          throw new Error('URL not allowed: IPv4-mapped private address');
        }
        // 10.0.0.0/8 -> 0a00:0000 to 0aff:ffff
        if (remainder.startsWith('a') || remainder.startsWith('0a')) {
          throw new Error('URL not allowed: IPv4-mapped private address');
        }
        // 192.168.0.0/16 -> c0a8:0000 to c0a8:ffff
        if (remainder.startsWith('c0a8')) {
          throw new Error('URL not allowed: IPv4-mapped private address');
        }
        // 172.16.0.0/12 -> ac10:0000 to ac1f:ffff
        const hexMatch = remainder.match(/^ac1([0-9a-f])/);
        if (hexMatch) {
          const thirdNibble = parseInt(hexMatch[1], 16);
          if (thirdNibble <= 0xf) {
            throw new Error('URL not allowed: IPv4-mapped private address');
          }
        }
        // 169.254.0.0/16 -> a9fe:0000 to a9fe:ffff
        if (remainder.startsWith('a9fe')) {
          throw new Error('URL not allowed: IPv4-mapped private address');
        }
        // 0.0.0.0 -> 0:0 or 0000:0000
        if (remainder === '0:0' || remainder === '0000:0000') {
          throw new Error('URL not allowed: IPv4-mapped private address');
        }
      }
    }
  }

  /**
   * Sanitize URL for logging by removing query parameters
   * @param url - URL to sanitize
   * @returns Sanitized URL without query parameters
   */
  private sanitizeUrlForLogging(url: string): string {
    try {
      const parsed = new URL(url);
      // Return URL without query parameters or hash
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
      // If URL parsing fails, return a generic message
      return '[invalid URL]';
    }
  }

  /**
   * Fetch and parse a single RSS feed
   * @param url - RSS feed URL
   * @returns Parsed feed with title and items
   * @throws Error on network failure, parse errors, timeout, or URL validation failure
   */
  async fetchFeed(url: string): Promise<RSSFeed> {
    // Validate URL to prevent SSRF attacks
    this.validateUrl(url);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${this.timeout}ms`));
        }, this.timeout);
      });

      // Race between fetch and timeout
      // Disable automatic redirect following to prevent SSRF via redirects
      const response = await Promise.race([fetch(url, { redirect: 'manual' }), timeoutPromise]);

      // Handle redirects manually
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (!location) {
          throw new Error('Redirect response has no Location header');
        }

        // Validate redirect target before following
        this.validateUrl(location);

        // Follow the redirect (single hop only to prevent redirect loops)
        const redirectResponse = await Promise.race([
          fetch(location, { redirect: 'manual' }),
          timeoutPromise,
        ]);

        // Reject multiple redirects to prevent redirect loops
        if (redirectResponse.status >= 300 && redirectResponse.status < 400) {
          throw new Error('Multiple redirects not allowed');
        }

        if (!redirectResponse.ok) {
          throw new Error(`HTTP ${redirectResponse.status} ${redirectResponse.statusText}`);
        }

        const xml = await redirectResponse.text();
        const feed = await this.parser.parseString(xml);

        const feedTitle = feed.title || 'Untitled Feed';

        return {
          title: feedTitle,
          items: (feed.items || []).map(item => ({
            title: item.title || 'Untitled',
            link: item.link || '',
            pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
            contentSnippet: item.contentSnippet,
            source: feedTitle,
          })),
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const xml = await response.text();
      const feed = await this.parser.parseString(xml);

      const feedTitle = feed.title || 'Untitled Feed';

      return {
        title: feedTitle,
        items: (feed.items || []).map(item => ({
          title: item.title || 'Untitled',
          link: item.link || '',
          pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          contentSnippet: item.contentSnippet,
          source: feedTitle,
        })),
      };
    } catch (error) {
      // Re-throw to allow caller to handle errors
      throw error;
    }
  }

  /**
   * Aggregate and sort items from multiple RSS feeds
   * @param urls - Array of RSS feed URLs
   * @param limit - Optional maximum number of items to return
   * @returns Sorted array of items (newest first), empty array on all failures
   */
  async getLatestItems(urls: string[], limit?: number): Promise<RSSItem[]> {
    if (urls.length === 0) {
      return [];
    }

    const allItems: RSSItem[] = [];

    // Fetch all feeds, handling failures gracefully
    const feedPromises = urls.map(async url => {
      try {
        const feed = await this.fetchFeed(url);
        return feed.items;
      } catch (error) {
        // Log error but don't throw - allow other feeds to succeed
        // Sanitize URL to prevent exposure of sensitive query parameters
        const sanitizedUrl = this.sanitizeUrlForLogging(url);
        console.error(`Failed to fetch feed ${sanitizedUrl}:`, error);
        return [];
      }
    });

    const feedResults = await Promise.all(feedPromises);

    // Flatten all items
    for (const items of feedResults) {
      allItems.push(...items);
    }

    // Sort by publication date descending (newest first)
    allItems.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    // Apply limit if specified
    if (limit !== undefined) {
      return allItems.slice(0, limit);
    }

    return allItems;
  }
}
