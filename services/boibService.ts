import axios, { AxiosResponse } from "axios";
import https from "https";
import fs from "fs/promises";
import sfs from "fs";
import * as cheerio from "cheerio";
import {
  domainUrl,
  url,
  months,
  lastBoibInfo,
  previousBoibInfo,
  HTTP_TIMEOUT,
  MAX_CONTENT_LENGTH,
  isAllowedUrl,
} from "../modules/global.js";
import type { BoibInfo, SectionLink, DocListItem } from "../types/boibInfo.js";

class BoibError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoibError";
  }
}

export const resetInfo = (): BoibInfo => ({
  ultimoBoletin: "",
  isExtraordinary: false,
  idBoib: "",
  idAnualBoib: "",
  dateLastBoib: "",
  linkUltimoBoletin: "",
  customersMatched: [],
  sectionLinks: [],
  numMatches: 0,
});

const SECURE_AXIOS_OPTIONS = {
  timeout: HTTP_TIMEOUT,
  maxContentLength: MAX_CONTENT_LENGTH,
  maxBodyLength: MAX_CONTENT_LENGTH,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
  },
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: true }),
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3, delayMs: number = 2000): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new BoibError(`Failed after ${maxRetries} retries: ${lastError?.message ?? "unknown error"}`);
}

export const readDataBase = async (lastBoibInfoFile: string): Promise<void> => {
  if (!sfs.existsSync(lastBoibInfoFile)) {
    console.log("JSON file does not exist. Creating a new one...");
    Object.assign(lastBoibInfo, resetInfo());
    await fs.writeFile(lastBoibInfoFile, JSON.stringify(lastBoibInfo, null, 2), "utf8");
    console.log(`File ${lastBoibInfoFile} created.`);
  } else {
    const res = await fs.readFile(lastBoibInfoFile, "utf8");
    if (!res) {
      console.log("JSON file is empty.");
      Object.assign(lastBoibInfo, resetInfo());
    } else {
      const data = JSON.parse(res);
      Object.assign(previousBoibInfo, data);
      Object.assign(lastBoibInfo, resetInfo());
      console.log("Data loaded from database");
    }
  }
};

export const getLastBoib = async (): Promise<void> => {
  console.log("Fetching latest BOIB info");
  const res: AxiosResponse = await withRetry(async () => axios.get(url, SECURE_AXIOS_OPTIONS));
  const $ = cheerio.load(res.data);
  const ultimoBoletin = $("div.ultimoBoletin div.caja.whitebg p a")
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const subLinkUltimoBoletin = $("div.ultimoBoletin div.caja.whitebg p a").attr("href");
  if (!subLinkUltimoBoletin) {
    throw new BoibError("Could not find bulletin link on the BOIB page");
  }
  const anoUltimoBoletin = ultimoBoletin.match(/(\d{4})$/)?.[0] ?? "";
  const idUltimoBoletin = subLinkUltimoBoletin.split("/").reverse()[1] ?? "";
  const wordsLastBoib = ultimoBoletin.split(" ");
  const idAnualBoib = wordsLastBoib[6] ?? "";
  const monthName = wordsLastBoib[9] ?? "";
  let monthNumber: number = months.indexOf(monthName) + 1;
  if (monthNumber === 0) {
    console.warn(`Could not parse month "${monthName}" from bulletin text, defaulting to 01`);
    monthNumber = 1;
  }
  const monthStr = monthNumber < 10 ? "0" + monthNumber : String(monthNumber);
  const dayStr = wordsLastBoib[7] ?? "01";
  const stringDatelastBoib = `${wordsLastBoib[11] ?? ""}-${monthStr}-${dayStr}`;
  const dateLastBoib = new Date(stringDatelastBoib).toString();
  lastBoibInfo.ultimoBoletin = ultimoBoletin;
  lastBoibInfo.idBoib = idUltimoBoletin;
  lastBoibInfo.idAnualBoib = idAnualBoib;
  lastBoibInfo.dateLastBoib = dateLastBoib;
  lastBoibInfo.linkUltimoBoletin = `${url}/${anoUltimoBoletin}/${idUltimoBoletin}`;
};

export const getSectionLinks = async (link: string): Promise<void> => {
  if (!isAllowedUrl(link)) {
    throw new BoibError(`Blocked disallowed URL: ${link}`);
  }
  try {
    const response = await axios.get(link, SECURE_AXIOS_OPTIONS);
    const $ = cheerio.load(response.data);
    lastBoibInfo.isExtraordinary = $("a.fijo p")
      .last()
      .text()
      .includes("Extraordinari");
    lastBoibInfo.isExtraordinary
      ? console.log("BOIB Extraordinari")
      : console.log("BOIB ordinari");
    const $sectionMenuHtml = cheerio.load($(".primerosHijos").prop("outerHTML") ?? "<div></div>");
    $sectionMenuHtml("li").each((i, elem) => {
      const href = $sectionMenuHtml(elem).find("a").attr("href") ?? "";
      const link_1 = domainUrl.concat(href);
      const sectionObject: SectionLink = {
        id: i,
        titulo: link_1.split("/").reverse()[1]?.replace(/-/g, " ") ?? "",
        link: link_1,
        docList: [],
      };
      lastBoibInfo.sectionLinks.push(sectionObject);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new BoibError(`Error fetching section links: ${message}`);
  }
};

export const getDocLists = async (sectionLink: string): Promise<void> => {
  const sectionObject = lastBoibInfo.sectionLinks.find(
    (obj: SectionLink) => obj.link === sectionLink
  );
  if (!sectionObject) {
    throw new BoibError(`Section not found for link: ${sectionLink}`);
  }
  const response = await axios.get(sectionLink, SECURE_AXIOS_OPTIONS);
  const $ = cheerio.load(response.data);
  const llistatElement = $(".llistat");
  if (llistatElement.length) {
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
            if (isAllowedUrl(fullLink)) {
              docListObject.downloadPdfLink = fullLink;
            } else {
              console.warn(`Skipping disallowed PDF URL: ${fullLink}`);
            }
            docListObject.description = description;
            docListObject.id = id;
          } else if (!link.endsWith("xml") && !link.endsWith("rdf")) {
            if (isAllowedUrl(link) || link.startsWith("/")) {
              docListObject.htmlLink = link.startsWith("/") ? domainUrl + link : link;
            } else {
              console.warn(`Skipping disallowed HTML URL: ${link}`);
            }
          } else {
            lastBoibInfo.sectionLinks[sectionObject.id]!.docList.push(
              docListObject
            );
          }
        });
    });
  } else {
    console.log(
      `Element with class 'llistat' not found at ${sectionLink}`
    );
  }
};

export const getSpecificBoib = (wordsToSearch: string[]): DocListItem[] => {
  console.log(`\nSearching for documents containing:\n${wordsToSearch}\n`);
  const filteredList = lastBoibInfo.sectionLinks.flatMap((section: SectionLink) => {
    return section.docList.filter((doc: DocListItem) => {
      return wordsToSearch.some((word: string) =>
        doc.description.toLowerCase().includes(word.toLowerCase())
      );
    });
  });
  if (filteredList.length === 0) {
    console.log("No documents found matching these search criteria\n");
    return [];
  } else {
    console.log(`${filteredList.length} BOIBs found`);
    return filteredList;
  }
};
