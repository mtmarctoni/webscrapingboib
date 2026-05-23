import axios from "axios";
import * as cheerio from "cheerio";
import { customers, lastBoibInfo, HTTP_TIMEOUT, MAX_CONTENT_LENGTH, isAllowedUrl, domainUrl } from "../modules/global.js";
import type { SectionLink, DocListItem } from "../types/boibInfo.js";

export const searchForCustomers = async (links: string[]): Promise<void> => {
  console.log(`Looking for ${customers.length} customer(s) in ${links.length} document(s)`);
  let localNumMatches = 0;
  for (const link of links) {
    const safeLink = link.startsWith("/") ? domainUrl + link : link;
    if (!isAllowedUrl(safeLink)) {
      console.warn(`Skipping disallowed URL: ${safeLink}`);
      continue;
    }
    let docObj: DocListItem | undefined;
    for (const sectionLink of lastBoibInfo.sectionLinks as SectionLink[]) {
      for (const obj of sectionLink.docList as DocListItem[]) {
        if (obj.htmlLink === link) {
          docObj = obj;
        }
      }
    }
    try {
      const res = await axios.get(safeLink, {
        timeout: HTTP_TIMEOUT,
        maxContentLength: MAX_CONTENT_LENGTH,
        maxBodyLength: MAX_CONTENT_LENGTH,
      });
      const $ = cheerio.load(res.data);
      const tables = $("table");
      tables.each((tableIdx, table) => {
        const rows = $(table).find("tr");
        rows.each((rowIdx, row) => {
          const cells = $(row).find("td");
          cells.each((cellIdx, cell) => {
            const cellText = $(cell).text();
            for (const customer of customers) {
              if (cellText.toLowerCase().includes(customer.toLowerCase())) {
                localNumMatches++;
                const match = `PDF ${docObj?.id ?? ""} -> Table ${tableIdx + 1}, row ${rowIdx + 1}, cell ${cellIdx + 1}: ${cellText.trim()}`;
                lastBoibInfo.customersMatched.push(match);
                console.log(`Match found: ${match}`);
              }
            }
          });
        });
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error fetching ${safeLink}: ${message}`);
    }
  }
  lastBoibInfo.numMatches = localNumMatches;
  console.log(`Found ${localNumMatches} match(es)`);
};
