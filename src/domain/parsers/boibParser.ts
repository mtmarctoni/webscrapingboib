import * as cheerio from "cheerio";
import { MONTHS } from "../../config/constants.js";
import type { DocListItem, SectionLink } from "../models/boib.js";

function requireMatchGroup(match: RegExpMatchArray, index: number): string {
  const value = match[index];
  if (value === undefined) {
    throw new Error("Internal error: missing capture group in regex");
  }
  return value;
}

/**
 * Metadata extracted from the BOIB bulletin index page.
 */
export interface BulletinMetadata {
  ultimoBoletin: string;
  idBoib: string;
  idAnualBoib: string;
  dateLastBoib: string;
  linkUltimoBoletin: string;
  isExtraordinary: boolean;
}

/**
 * Parses the BOIB bulletin index page to extract metadata about the latest bulletin.
 * @param html - The HTML content of the BOIB index page
 * @param baseUrl - The base URL for constructing absolute links
 * @returns Bulletin metadata including ID, date, and link
 * @throws {Error} When the bulletin link cannot be found or the date format is unparseable
 */
export function parseBulletin(html: string, baseUrl: string): BulletinMetadata {
  const $ = cheerio.load(html);
  const ultimoBoletin = $("div.ultimoBoletin div.caja.whitebg p a")
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const subLinkUltimoBoletin = $("div.ultimoBoletin div.caja.whitebg p a").attr("href");

  if (!subLinkUltimoBoletin) {
    throw new Error("Could not find bulletin link on the BOIB page");
  }

  const idUltimoBoletin = subLinkUltimoBoletin.split("/").reverse()[1] ?? "";

  const bulletinRegex =
    /BOIB\s+núm\.\s+(\d+)\s*(?:[—-]|de)\s*(\d{1,2})\s+de\s+(\S+)\s+de\s+(\d{4})/;
  const match = ultimoBoletin.match(bulletinRegex);

  if (!match) {
    throw new Error(`Could not parse bulletin text: "${ultimoBoletin}"`);
  }

  const idAnualBoib = requireMatchGroup(match, 1);
  const dayStr = requireMatchGroup(match, 2).padStart(2, "0");
  const monthName = requireMatchGroup(match, 3);
  const yearStr = requireMatchGroup(match, 4);

  const monthNum = MONTHS.indexOf(monthName) + 1;
  if (monthNum === 0) {
    throw new Error(`Unknown month "${monthName}" in bulletin text: "${ultimoBoletin}"`);
  }
  const monthStr = String(monthNum).padStart(2, "0");

  const dateLastBoib = `${yearStr}-${monthStr}-${dayStr}`;

  return {
    ultimoBoletin,
    idBoib: idUltimoBoletin,
    idAnualBoib,
    dateLastBoib,
    linkUltimoBoletin: `${baseUrl}/${yearStr}/${idUltimoBoletin}`,
    isExtraordinary: false,
  };
}

/**
 * Result of parsing the section menu, containing section links and whether
 * the bulletin is an extraordinary edition.
 */
export interface SectionMenuResult {
  sections: SectionLink[];
  isExtraordinary: boolean;
}

/**
 * Parses the section menu HTML to extract navigation links for each section.
 * Detects if the bulletin is an extraordinary edition.
 * @param html - The HTML content of the section menu page
 * @param domainUrl - The domain URL for constructing absolute section links
 * @returns Section links and extraordinary flag
 */
export function parseSectionMenu(html: string, domainUrl: string): SectionMenuResult {
  const $ = cheerio.load(html);
  const isExtraordinary = $("a.fijo p").last().text().includes("Extraordinari");
  const $sectionMenuHtml = cheerio.load($(".primerosHijos").prop("outerHTML") ?? "<div></div>");
  const sections: SectionLink[] = [];

  $sectionMenuHtml("li").each((i, elem) => {
    const href = $sectionMenuHtml(elem).find("a").attr("href") ?? "";
    const link = domainUrl.concat(href);
    const titulo = link.split("/").reverse()[1]?.replace(/-/g, " ") ?? "";
    sections.push({
      id: i,
      titulo,
      link,
      docList: [],
    });
  });

  return { sections, isExtraordinary };
}

/**
 * Parses the document list HTML to extract individual document items with
 * their PDF download links and descriptions.
 * @param html - The HTML content of the document list page
 * @param _sectionId - Section identifier (unused, reserved for future use)
 * @param domainUrl - The domain URL for constructing absolute document links
 * @param _allowedDomain - Allowed domain for link filtering (unused, reserved for future use)
 * @returns Array of parsed document list items
 */
export function parseDocList(
  html: string,
  _sectionId: number,
  domainUrl: string,
  _allowedDomain: string,
): DocListItem[] {
  const $ = cheerio.load(html);
  const docs: DocListItem[] = [];
  const llistatElement = $(".llistat");

  if (!llistatElement.length) {
    return docs;
  }

  const $docList = cheerio.load(llistatElement.prop("outerHTML") ?? "<div></div>");

  $docList("ul.resolucions").each((_j, elems) => {
    const pdfEntries: Array<{
      link: string;
      id: string;
      description: string;
    }> = [];
    const htmlLinks: string[] = [];

    $docList(elems)
      .find("a")
      .each((_i, elem) => {
        const link = $docList(elem).attr("href") ?? "";
        if (link.startsWith("/eboibfront/pdf/")) {
          const description = $docList(elem)
            .parents("ul.resolucions")
            .first()
            .find("p")
            .first()
            .text();
          const idText = $docList(elem)
            .parents("ul.resolucions")
            .first()
            .find("p.registre")
            .first()
            .text()
            .trim();
          const id = idText.split("-")[0]?.split(" ").reverse()[1] ?? "";
          const fullLink = domainUrl + link;

          pdfEntries.push({ link: fullLink, id, description });
        } else if (!link.endsWith("xml") && !link.endsWith("rdf")) {
          const safeLink = link.startsWith("/") ? domainUrl + link : link;
          htmlLinks.push(safeLink);
        }
      });

    for (const [i, entry] of pdfEntries.entries()) {
      docs.push({
        id: entry.id,
        description: entry.description,
        downloadPdfLink: entry.link,
        htmlLink: htmlLinks[i] ?? "",
      });
    }
  });

  return docs;
}
