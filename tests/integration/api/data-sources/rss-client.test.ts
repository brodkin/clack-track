/**
 * Tests for RSSClient
 * Testing strategy: Mock HTTP responses, validate parsing, error handling
 */

import { RSSClient } from '@/api/data-sources/rss-client';
import {
  MOCK_RSS_FEED_XML,
  MOCK_RSS_FEED_2_XML,
  INVALID_RSS_XML,
  EMPTY_RSS_XML,
} from '../../../__mocks__/rss-feeds';
import {
  PARTIAL_FEED_NO_TITLE,
  PARTIAL_ITEMS_MISSING_FIELDS,
} from '../../../__mocks__/rss-feeds-partial';

// Mock the fetch API
global.fetch = jest.fn();

describe('RSSClient', () => {
  let client: RSSClient;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new RSSClient();
  });

  describe('constructor', () => {
    it('should create instance with default timeout', () => {
      const defaultClient = new RSSClient();
      expect(defaultClient).toBeInstanceOf(RSSClient);
    });

    it('should create instance with custom timeout', () => {
      const customClient = new RSSClient(5000);
      expect(customClient).toBeInstanceOf(RSSClient);
    });
  });

  describe('fetchFeed', () => {
    it('should fetch and parse a valid RSS feed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => MOCK_RSS_FEED_XML,
      } as Response);

      const feed = await client.fetchFeed('https://example.com/feed.xml');

      expect(feed.title).toBe('Test Tech News');
      expect(feed.items).toHaveLength(2);
      expect(feed.items[0].title).toBe('Breaking: AI Advances');
      expect(feed.items[0].link).toBe('https://example.com/article1');
      expect(feed.items[0].pubDate).toBeDefined();
      expect(feed.items[0].contentSnippet).toBe(
        'Major breakthrough in AI research announced today.'
      );
      expect(feed.items[0].source).toBe('Test Tech News');
    });

    it('should handle feed with no items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => EMPTY_RSS_XML,
      } as Response);

      const feed = await client.fetchFeed('https://empty.example.com/feed.xml');

      expect(feed.title).toBe('Empty Feed');
      expect(feed.items).toHaveLength(0);
    });

    it('should use fallback title when feed has no title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => PARTIAL_FEED_NO_TITLE,
      } as Response);

      const feed = await client.fetchFeed('https://notitle.example.com/feed.xml');

      expect(feed.title).toBe('Untitled Feed');
      expect(feed.items).toHaveLength(1);
      expect(feed.items[0].source).toBe('Untitled Feed');
    });

    it('should use fallback values for items with missing fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => PARTIAL_ITEMS_MISSING_FIELDS,
      } as Response);

      const feed = await client.fetchFeed('https://partial.example.com/feed.xml');

      expect(feed.items).toHaveLength(2);

      // First item: no title, link, or pubDate
      expect(feed.items[0].title).toBe('Untitled');
      expect(feed.items[0].link).toBe('');
      expect(feed.items[0].pubDate).toBeInstanceOf(Date);
      expect(feed.items[0].source).toBe('Test Feed');

      // Second item: title only
      expect(feed.items[1].title).toBe('Item with title only');
      expect(feed.items[1].link).toBe('');
      expect(feed.items[1].pubDate).toBeInstanceOf(Date);
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.fetchFeed('https://example.com/feed.xml')).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle malformed RSS XML gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => INVALID_RSS_XML,
      } as Response);

      // rss-parser may parse malformed XML and return partial data
      // or throw an error - either behavior is acceptable
      try {
        const feed = await client.fetchFeed('https://broken.example.com/feed.xml');
        // If parsing succeeds, ensure we got some basic structure
        expect(feed).toHaveProperty('title');
        expect(feed).toHaveProperty('items');
        expect(Array.isArray(feed.items)).toBe(true);
      } catch (error) {
        // If parsing fails, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });

    it('should timeout after configured duration', async () => {
      const shortTimeoutClient = new RSSClient(100);

      // Mock a delayed response
      mockFetch.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  text: async () => MOCK_RSS_FEED_XML,
                } as Response),
              500
            );
          })
      );

      await expect(
        shortTimeoutClient.fetchFeed('https://slow.example.com/feed.xml')
      ).rejects.toThrow(/timeout/i);
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(client.fetchFeed('https://example.com/missing.xml')).rejects.toThrow(
        /404.*Not Found/i
      );
    });
  });

  describe('getLatestItems', () => {
    it('should aggregate items from multiple feeds', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_XML,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_2_XML,
        } as Response);

      const items = await client.getLatestItems([
        'https://example.com/feed1.xml',
        'https://business.example.com/feed2.xml',
      ]);

      expect(items).toHaveLength(3);
      expect(items[0].title).toBe('Market Analysis'); // Newest first
      expect(items[1].title).toBe('Breaking: AI Advances');
      expect(items[2].title).toBe('New Framework Released');
    });

    it('should limit items when limit is specified', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_XML,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_2_XML,
        } as Response);

      const items = await client.getLatestItems(
        ['https://example.com/feed1.xml', 'https://business.example.com/feed2.xml'],
        2
      );

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Market Analysis'); // Newest first
      expect(items[1].title).toBe('Breaking: AI Advances');
    });

    it('should return empty array when no feeds provided', async () => {
      const items = await client.getLatestItems([]);
      expect(items).toEqual([]);
    });

    it('should gracefully handle feed failures and return available items', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_XML,
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_2_XML,
        } as Response);

      const items = await client.getLatestItems([
        'https://example.com/feed1.xml',
        'https://failing.example.com/feed2.xml',
        'https://business.example.com/feed3.xml',
      ]);

      // Should get 2 items from feed1 + 1 item from feed3 (feed2 failed)
      expect(items).toHaveLength(3);
      expect(items.some(item => item.title === 'Breaking: AI Advances')).toBe(true);
      expect(items.some(item => item.title === 'Market Analysis')).toBe(true);
    });

    it('should return empty array when all feeds fail', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const items = await client.getLatestItems([
        'https://failing1.example.com/feed.xml',
        'https://failing2.example.com/feed.xml',
      ]);

      expect(items).toEqual([]);
    });

    it('should sort items by publication date descending', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_XML,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_2_XML,
        } as Response);

      const items = await client.getLatestItems([
        'https://example.com/feed1.xml',
        'https://business.example.com/feed2.xml',
      ]);

      // Market Analysis (11:00) should be first, then Breaking (10:00), then New Framework (09:00)
      expect(items[0].title).toBe('Market Analysis');
      expect(items[1].title).toBe('Breaking: AI Advances');
      expect(items[2].title).toBe('New Framework Released');
    });
  });

  describe('SSRF Protection', () => {
    describe('URL format validation', () => {
      it('should reject invalid URL format', async () => {
        await expect(client.fetchFeed('not-a-valid-url')).rejects.toThrow(/invalid url format/i);
      });

      it('should reject malformed URL with spaces', async () => {
        await expect(client.fetchFeed('http://example com/feed.xml')).rejects.toThrow(
          /invalid url format/i
        );
      });
    });

    describe('Protocol validation', () => {
      it('should allow http:// protocol', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_XML,
        } as Response);

        await expect(client.fetchFeed('http://example.com/feed.xml')).resolves.toBeDefined();
      });

      it('should allow https:// protocol', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_XML,
        } as Response);

        await expect(client.fetchFeed('https://example.com/feed.xml')).resolves.toBeDefined();
      });

      it('should reject file:// protocol', async () => {
        await expect(client.fetchFeed('file:///etc/passwd')).rejects.toThrow(
          /protocol not allowed/i
        );
      });

      it('should reject ftp:// protocol', async () => {
        await expect(client.fetchFeed('ftp://example.com/feed.xml')).rejects.toThrow(
          /protocol not allowed/i
        );
      });

      it('should reject data: URLs', async () => {
        await expect(client.fetchFeed('data:text/plain,test')).rejects.toThrow(
          /protocol not allowed/i
        );
      });

      it('should reject javascript: URLs', async () => {
        await expect(client.fetchFeed('javascript:alert(1)')).rejects.toThrow(
          /protocol not allowed/i
        );
      });
    });

    describe('Private IP blocking', () => {
      it('should reject localhost hostname', async () => {
        await expect(client.fetchFeed('http://localhost/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject 127.0.0.1 (loopback)', async () => {
        await expect(client.fetchFeed('http://127.0.0.1/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject 127.x.x.x range', async () => {
        await expect(client.fetchFeed('http://127.1.2.3/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject 10.x.x.x range (private class A)', async () => {
        await expect(client.fetchFeed('http://10.0.0.1/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
        await expect(client.fetchFeed('http://10.255.255.255/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject 192.168.x.x range (private class C)', async () => {
        await expect(client.fetchFeed('http://192.168.1.1/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
        await expect(client.fetchFeed('http://192.168.255.255/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject 172.16.x.x - 172.31.x.x range (private class B)', async () => {
        await expect(client.fetchFeed('http://172.16.0.1/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
        await expect(client.fetchFeed('http://172.20.10.5/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
        await expect(client.fetchFeed('http://172.31.255.255/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject cloud metadata endpoint (169.254.169.254)', async () => {
        await expect(client.fetchFeed('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
          /not allowed.*metadata/i
        );
      });

      it('should reject link-local 169.254.x.x range', async () => {
        await expect(client.fetchFeed('http://169.254.1.1/feed.xml')).rejects.toThrow(
          /not allowed/i
        );
      });

      it('should allow public IP addresses', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_XML,
        } as Response);

        // 8.8.8.8 is Google DNS (public)
        await expect(client.fetchFeed('http://8.8.8.8/feed.xml')).resolves.toBeDefined();
      });

      it('should allow 172.x.x.x outside private range (172.15 and 172.32)', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            text: async () => MOCK_RSS_FEED_XML,
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            text: async () => MOCK_RSS_FEED_XML,
          } as Response);

        // 172.15.x.x (before private range) - allowed
        await expect(client.fetchFeed('http://172.15.0.1/feed.xml')).resolves.toBeDefined();

        // 172.32.x.x (after private range) - allowed
        await expect(client.fetchFeed('http://172.32.0.1/feed.xml')).resolves.toBeDefined();
      });
    });

    describe('Edge cases and bypasses', () => {
      it('should reject localhost with port', async () => {
        await expect(client.fetchFeed('http://localhost:8080/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject 0.0.0.0 (unspecified address)', async () => {
        await expect(client.fetchFeed('http://0.0.0.0/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject uppercase hostname variants', async () => {
        await expect(client.fetchFeed('http://LOCALHOST/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject mixed case hostname variants', async () => {
        await expect(client.fetchFeed('http://LocAlHost/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });
    });

    describe('IPv6 SSRF Protection', () => {
      it('should reject IPv6 localhost (::1)', async () => {
        await expect(client.fetchFeed('http://[::1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 localhost/i
        );
      });

      it('should reject IPv6 localhost expanded form', async () => {
        await expect(client.fetchFeed('http://[0:0:0:0:0:0:0:1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 localhost/i
        );
      });

      it('should reject IPv6 unique local addresses (fc00::/7)', async () => {
        await expect(client.fetchFeed('http://[fc00::1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 private/i
        );
        await expect(client.fetchFeed('http://[fd12:3456:789a::1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 private/i
        );
      });

      it('should reject IPv6 link-local addresses (fe80::/10)', async () => {
        await expect(client.fetchFeed('http://[fe80::1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 link-local/i
        );
        await expect(client.fetchFeed('http://[fe80::5054:ff:fe12:3456]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 link-local/i
        );
        await expect(client.fetchFeed('http://[fe90::1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 link-local/i
        );
        await expect(client.fetchFeed('http://[fea0::1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 link-local/i
        );
        await expect(client.fetchFeed('http://[feb0::1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 link-local/i
        );
      });

      it('should reject IPv4-mapped IPv6 addresses for loopback', async () => {
        await expect(client.fetchFeed('http://[::ffff:127.0.0.1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv4.*mapped.*private/i
        );
        await expect(client.fetchFeed('http://[::ffff:127.1.2.3]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv4.*mapped.*private/i
        );
      });

      it('should reject IPv4-mapped IPv6 addresses for private ranges', async () => {
        await expect(client.fetchFeed('http://[::ffff:192.168.1.1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv4.*mapped.*private/i
        );
        await expect(client.fetchFeed('http://[::ffff:10.0.0.1]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv4.*mapped.*private/i
        );
      });

      it('should reject IPv4-mapped IPv6 addresses for unspecified address', async () => {
        await expect(client.fetchFeed('http://[::ffff:0.0.0.0]/feed.xml')).rejects.toThrow(
          /not allowed.*ipv4.*mapped.*private/i
        );
      });

      it('should allow public IPv6 addresses', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_XML,
        } as Response);

        // 2001:4860:4860::8888 is Google Public DNS
        await expect(
          client.fetchFeed('http://[2001:4860:4860::8888]/feed.xml')
        ).resolves.toBeDefined();
      });

      it('should allow IPv4-mapped IPv6 addresses for public IPs', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => MOCK_RSS_FEED_XML,
        } as Response);

        // ::ffff:8.8.8.8 is IPv4-mapped Google DNS (public)
        await expect(client.fetchFeed('http://[::ffff:8.8.8.8]/feed.xml')).resolves.toBeDefined();
      });
    });

    describe('HTTP Redirect SSRF Protection', () => {
      it('should reject redirects to localhost', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 301,
          statusText: 'Moved Permanently',
          headers: new Headers({ Location: 'http://localhost/admin' }),
        } as Response);

        await expect(client.fetchFeed('https://evil.com/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject redirects to private IP addresses', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 302,
          statusText: 'Found',
          headers: new Headers({ Location: 'http://192.168.1.1/feed.xml' }),
        } as Response);

        await expect(client.fetchFeed('https://evil.com/feed.xml')).rejects.toThrow(
          /not allowed.*private/i
        );
      });

      it('should reject redirects to cloud metadata endpoint', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 301,
          statusText: 'Moved Permanently',
          headers: new Headers({ Location: 'http://169.254.169.254/latest/meta-data' }),
        } as Response);

        await expect(client.fetchFeed('https://evil.com/feed.xml')).rejects.toThrow(
          /not allowed.*metadata/i
        );
      });

      it('should reject redirects to IPv6 localhost', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 301,
          statusText: 'Moved Permanently',
          headers: new Headers({ Location: 'http://[::1]/feed.xml' }),
        } as Response);

        await expect(client.fetchFeed('https://evil.com/feed.xml')).rejects.toThrow(
          /not allowed.*ipv6 localhost/i
        );
      });

      it('should reject redirects to file:// protocol', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 301,
          statusText: 'Moved Permanently',
          headers: new Headers({ Location: 'file:///etc/passwd' }),
        } as Response);

        await expect(client.fetchFeed('https://evil.com/feed.xml')).rejects.toThrow(
          /protocol not allowed/i
        );
      });

      it('should follow valid redirects to public URLs', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 301,
            statusText: 'Moved Permanently',
            headers: new Headers({ Location: 'https://example.com/new-feed.xml' }),
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            text: async () => MOCK_RSS_FEED_XML,
          } as Response);

        const feed = await client.fetchFeed('https://oldsite.com/feed.xml');
        expect(feed.title).toBe('Test Tech News');
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should handle redirects without Location header gracefully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 301,
          statusText: 'Moved Permanently',
          headers: new Headers({}),
        } as Response);

        await expect(client.fetchFeed('https://broken-redirect.com/feed.xml')).rejects.toThrow(
          /redirect.*no location/i
        );
      });

      it('should prevent redirect loops by limiting to single hop', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 301,
            statusText: 'Moved Permanently',
            headers: new Headers({ Location: 'https://example.com/redirect2' }),
          } as Response)
          .mockResolvedValueOnce({
            ok: false,
            status: 301,
            statusText: 'Moved Permanently',
            headers: new Headers({ Location: 'https://example.com/redirect3' }),
          } as Response);

        await expect(client.fetchFeed('https://example.com/feed.xml')).rejects.toThrow(
          /multiple.*redirect/i
        );
      });
    });

    describe('Error message sanitization', () => {
      it('should not expose sensitive URL parameters in error messages', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        // Spy on console.error to check logged messages
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await client.getLatestItems(['http://example.com/feed.xml?apikey=SECRET123&token=ABC']);

        // Check that console.error was called
        expect(consoleErrorSpy).toHaveBeenCalled();

        // Verify that the logged message doesn't contain sensitive parameters
        const loggedMessage = consoleErrorSpy.mock.calls[0][0] as string;
        expect(loggedMessage).not.toContain('SECRET123');
        expect(loggedMessage).not.toContain('token=ABC');

        consoleErrorSpy.mockRestore();
      });

      it('should handle invalid URLs gracefully in error logging', async () => {
        // This will trigger URL validation error before fetch
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await client.getLatestItems(['not-a-valid-url-at-all']);

        // Check that console.error was called
        expect(consoleErrorSpy).toHaveBeenCalled();

        // Verify that error was logged with sanitized message
        const loggedMessage = consoleErrorSpy.mock.calls[0][0] as string;
        expect(loggedMessage).toContain('[invalid URL]');

        consoleErrorSpy.mockRestore();
      });
    });
  });
});
