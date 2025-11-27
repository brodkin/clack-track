/**
 * RSS feeds with missing/partial data for testing fallback values
 */

export const PARTIAL_FEED_NO_TITLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <link>https://example.com</link>
    <description>Feed without title</description>
    <item>
      <link>https://example.com/article1</link>
      <pubDate>Wed, 27 Nov 2025 10:00:00 GMT</pubDate>
      <description>Article content</description>
    </item>
  </channel>
</rss>`;

export const PARTIAL_ITEMS_MISSING_FIELDS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>Feed with partial items</description>
    <item>
      <description>Item with no title, link, or pubDate</description>
    </item>
    <item>
      <title>Item with title only</title>
    </item>
  </channel>
</rss>`;
