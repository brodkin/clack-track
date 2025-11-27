/**
 * Mock RSS feed fixtures for testing
 */

export const MOCK_RSS_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Tech News</title>
    <link>https://example.com</link>
    <description>Tech news feed</description>
    <item>
      <title>Breaking: AI Advances</title>
      <link>https://example.com/article1</link>
      <pubDate>Wed, 27 Nov 2025 10:00:00 GMT</pubDate>
      <description>Major breakthrough in AI research announced today.</description>
    </item>
    <item>
      <title>New Framework Released</title>
      <link>https://example.com/article2</link>
      <pubDate>Wed, 27 Nov 2025 09:00:00 GMT</pubDate>
      <description>Popular framework gets major update with new features.</description>
    </item>
  </channel>
</rss>`;

export const MOCK_RSS_FEED_2_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Business Updates</title>
    <link>https://business.example.com</link>
    <description>Business news</description>
    <item>
      <title>Market Analysis</title>
      <link>https://business.example.com/market</link>
      <pubDate>Wed, 27 Nov 2025 11:00:00 GMT</pubDate>
      <description>Stock market shows positive trends.</description>
    </item>
  </channel>
</rss>`;

export const INVALID_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Broken Feed
    <!-- Missing closing tags -->
</rss>`;

export const EMPTY_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
    <link>https://empty.example.com</link>
    <description>No items here</description>
  </channel>
</rss>`;
