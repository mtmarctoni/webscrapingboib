import * as cheerio from "cheerio";
import { MONTHS } from "../../config/constants.js";
import type { DocListItem, SectionLink } from "../models/boib.js";

export interface BulletinMetadata {
  ultimoBoletin: string;
  idBoib: string;
  idAnualBoib: string;
  dateLastBoib: string;
  linkUltimoBoletin: string;
  isExtraordinary: boolean;
}

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

  const anoUltimoBoletin = ultimoBoletin.match(/(\d{4})$/)?.[0] ?? "";
  const idUltimoBoletin = subLinkUltimoBoletin.split("/").reverse()[1] ?? "";
  const wordsLastBoib = ultimoBoletin.split(" ");
  const idAnualBoib = wordsLastBoib[6] ?? "";
  const monthName = wordsLastBoib[9] ?? "";
  let monthNumber = MONTHS.indexOf(monthName) + 1;
  if (monthNumber === 0) {
    monthNumber = 1;
  }
  const monthStr = monthNumber < 10 ? `0${monthNumber}` : String(monthNumber);
  const dayStr = wordsLastBoib[7] ?? "01";
  const stringDatelastBoib = `${wordsLastBoib[11] ?? ""}-${monthStr}-${dayStr}`;
  const dateLastBoib = new Date(stringDatelastBoib).toString();

  return {
    ultimoBoletin,
    idBoib: idUltimoBoletin,
    idAnualBoib,
    dateLastBoib,
    linkUltimoBoletin: `${baseUrl}/${anoUltimoBoletin}/${idUltimoBoletin}`,
    isExtraordinary: false,
  };
}

export interface SectionMenuResult {
  sections: SectionLink[];
  isExtraordinary: boolean;
}

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
    const docListObject: DocListItem = {
      id: "",
      htmlLink: "",
      description: "",
      downloadPdfLink: "",
    };

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

          docListObject.downloadPdfLink = fullLink;
          docListObject.description = description;
          docListObject.id = id;
        } else if (!link.endsWith("xml") && !link.endsWith("rdf")) {
          const safeLink = link.startsWith("/") ? domainUrl + link : link;
          docListObject.htmlLink = safeLink;
        }
      });

    if (docListObject.id || docListObject.description) {
      docs.push(docListObject);
    }
  });

  return docs;
}
