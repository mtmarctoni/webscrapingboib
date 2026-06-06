import * as cheerio from "cheerio";
import type { RssItem } from "../models/rss.js";
import type { BulletinMetadata } from "./boibParser.js";

export function parseRss(xml: string): RssItem[] {
  const results: RssItem[] = [];

  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(xml, { xmlMode: true });
  } catch {
    return results;
  }

  const items = $("item");
  if (items.length === 0) {
    return results;
  }

  items.each((_, elem) => {
    const $item = $(elem);
    const title = $item.children("title").first().text().trim();
    const link = $item.children("link").first().text().trim();
    const guid = $item.children("guid").first().text().trim();
    const pubDateStr = $item.children("pubDate").first().text().trim();

    if (!title || !link) {
      return;
    }

    const pubDate = new Date(pubDateStr);
    const invalid = Number.isNaN(pubDate.getTime());
    if (invalid) {
      return;
    }

    results.push({ title, link, pubDate, guid: guid || link });
  });

  return results;
}

const TITLE_REGEX = /Núm\s+(\d+)\/(\d+)/;

export function bulletinMetadataFromRssItem(item: RssItem): BulletinMetadata {
  const url = new URL(item.link);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const year = pathParts.length >= 2 ? String(pathParts[pathParts.length - 2]) : "";
  const titleMatch = item.title.match(TITLE_REGEX);
  const idAnualBoib = titleMatch ? String(titleMatch[1]) : "";

  const dateStr = item.pubDate.toISOString().slice(0, 10);

  return {
    ultimoBoletin: item.title,
    idBoib: year,
    idAnualBoib,
    dateLastBoib: dateStr,
    linkUltimoBoletin: item.link,
    isExtraordinary: false,
  };
}
