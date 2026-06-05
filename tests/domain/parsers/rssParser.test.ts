import { describe, expect, it } from "vitest";
import type { RssItem } from "../../../src/domain/models/rss.js";
import { bulletinMetadataFromRssItem, parseRss } from "../../../src/domain/parsers/rssParser.js";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BOIB</title>
    <link>https://www.caib.es/eboibfront/index.do?lang=ca</link>
    <description>El Butlletí Oficial del Govern les Illes Balears</description>
    <item>
      <title>BOIB Núm 070/2026</title>
      <link>https://www.caib.es/eboibfront/ca/2026/12283</link>
      <pubDate>Thu, 04 Jun 2026 06:30:00 GMT</pubDate>
      <guid>https://www.caib.es/eboibfront/ca/2026/12283</guid>
    </item>
    <item>
      <title>BOIB Núm 069/2026</title>
      <link>https://www.caib.es/eboibfront/ca/2026/12282</link>
      <pubDate>Tue, 02 Jun 2026 06:30:00 GMT</pubDate>
      <guid>https://www.caib.es/eboibfront/ca/2026/12282</guid>
    </item>
    <item>
      <title>BOIB Núm 068/2026</title>
      <link>https://www.caib.es/eboibfront/ca/2026/12281</link>
      <pubDate>Sat, 30 May 2026 06:30:00 GMT</pubDate>
      <guid>https://www.caib.es/eboibfront/ca/2026/12281</guid>
    </item>
  </channel>
</rss>`;

const RSS_WITH_EXTRA_NAMESPACES = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     version="2.0">
  <channel>
    <title>BOIB</title>
    <link>https://www.caib.es/eboibfront/index.do?lang=ca</link>
    <description>El Butlletí Oficial del Govern les Illes Balears</description>
    <item>
      <title>BOIB Núm 001/2026</title>
      <link>https://www.caib.es/eboibfront/ca/2026/12001</link>
      <description />
      <pubDate>Mon, 05 Jan 2026 06:30:00 GMT</pubDate>
      <guid>https://www.caib.es/eboibfront/ca/2026/12001</guid>
      <dc:creator>CAIB</dc:creator>
      <dc:date>2026-01-05T06:30:00Z</dc:date>
    </item>
  </channel>
</rss>`;

describe("parseRss", () => {
  it("parses multiple RSS items", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items).toHaveLength(3);
  });

  it("extracts title from each item", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items[0]?.title).toBe("BOIB Núm 070/2026");
    expect(items[1]?.title).toBe("BOIB Núm 069/2026");
    expect(items[2]?.title).toBe("BOIB Núm 068/2026");
  });

  it("extracts link from each item", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items[0]?.link).toBe("https://www.caib.es/eboibfront/ca/2026/12283");
    expect(items[1]?.link).toBe("https://www.caib.es/eboibfront/ca/2026/12282");
  });

  it("parses pubDate into Date objects", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items[0]?.pubDate).toBeInstanceOf(Date);
    expect(items[0]?.pubDate.toISOString()).toBe("2026-06-04T06:30:00.000Z");
    expect(items[2]?.pubDate.toISOString()).toBe("2026-05-30T06:30:00.000Z");
  });

  it("extracts guid, falling back to link", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items[0]?.guid).toBe("https://www.caib.es/eboibfront/ca/2026/12283");
  });

  it("handles RSS with namespace declarations (real-world format)", () => {
    const items = parseRss(RSS_WITH_EXTRA_NAMESPACES);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("BOIB Núm 001/2026");
    expect(items[0]?.link).toBe("https://www.caib.es/eboibfront/ca/2026/12001");
  });

  it("returns empty array for empty XML", () => {
    const items = parseRss("");
    expect(items).toEqual([]);
  });

  it("returns empty array for malformed XML", () => {
    const items = parseRss("not xml at all");
    expect(items).toEqual([]);
  });

  it("returns empty array for XML without RSS items", () => {
    const items = parseRss("<root><notAnItem>hello</notAnItem></root>");
    expect(items).toEqual([]);
  });

  it("returns empty array for RSS channel without items", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Empty Channel</title>
  </channel>
</rss>`;
    const items = parseRss(xml);
    expect(items).toEqual([]);
  });

  it("skips items missing title or link", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Has link</title>
      <link>https://example.com/1</link>
      <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    </item>
    <item>
      <link>https://example.com/2</link>
      <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>No link</title>
      <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
    const items = parseRss(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Has link");
  });

  it("skips items with unparseable pubDate", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Bad date</title>
      <link>https://example.com/1</link>
      <pubDate>not a date</pubDate>
    </item>
    <item>
      <title>Good date</title>
      <link>https://example.com/2</link>
      <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
    const items = parseRss(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Good date");
  });
});

describe("bulletinMetadataFromRssItem", () => {
  it("creates BulletinMetadata from a standard RSS item", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items).toHaveLength(3);
    const meta = bulletinMetadataFromRssItem(items[0] as RssItem);

    expect(meta.ultimoBoletin).toBe("BOIB Núm 070/2026");
    expect(meta.linkUltimoBoletin).toBe("https://www.caib.es/eboibfront/ca/2026/12283");
    expect(meta.idBoib).toBe("2026");
    expect(meta.idAnualBoib).toBe("070");
    expect(meta.dateLastBoib).toBe("2026-06-04");
    expect(meta.isExtraordinary).toBe(false);
  });

  it("creates metadata for a second RSS item (chronological order)", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items).toHaveLength(3);
    const meta = bulletinMetadataFromRssItem(items[1] as RssItem);

    expect(meta.ultimoBoletin).toBe("BOIB Núm 069/2026");
    expect(meta.idBoib).toBe("2026");
    expect(meta.idAnualBoib).toBe("069");
    expect(meta.dateLastBoib).toBe("2026-06-02");
  });

  it("handles items with namespace declarations", () => {
    const items = parseRss(RSS_WITH_EXTRA_NAMESPACES);
    expect(items).toHaveLength(1);
    const meta = bulletinMetadataFromRssItem(items[0] as RssItem);

    expect(meta.ultimoBoletin).toBe("BOIB Núm 001/2026");
    expect(meta.idBoib).toBe("2026");
    expect(meta.idAnualBoib).toBe("001");
    expect(meta.dateLastBoib).toBe("2026-01-05");
  });
});
