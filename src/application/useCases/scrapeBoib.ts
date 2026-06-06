import { BOIB_RSS_URL } from "../../config/constants.js";
import type { AppConfig } from "../../config/environment.js";
import { matchCustomers } from "../../domain/matchers/customerMatcher.js";
import { matchKeywords, parseKeywords } from "../../domain/matchers/keywordMatcher.js";
import type {
  BoibState,
  DocListItem,
  ScrapeResult,
  SectionError,
} from "../../domain/models/boib.js";
import { createEmptyBoibState } from "../../domain/models/boib.js";
import { parseDocList, parseSectionMenu } from "../../domain/parsers/boibParser.js";
import { bulletinMetadataFromRssItem, parseRss } from "../../domain/parsers/rssParser.js";
import { composeEmail, composeNoNewBoibEmail } from "../../infrastructure/email/template.js";
import type { EmailTransport } from "../../infrastructure/email/transport.js";
import type { HttpClient } from "../../infrastructure/http/client.js";
import type { Logger } from "../../infrastructure/logger.js";
import type { FileSystem } from "../../infrastructure/storage/fileSystem.js";
import { buildDownloadFolderName, resolveSafePath } from "../../infrastructure/storage/paths.js";

function assertString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string response from ${context}, got ${typeof value}`);
  }
  return value;
}

function isValidBoibState(state: unknown): state is BoibState {
  if (typeof state !== "object" || state === null) {
    return false;
  }
  const s = state as BoibState;
  return (
    typeof s.ultimoBoletin === "string" &&
    typeof s.linkUltimoBoletin === "string" &&
    typeof s.idBoib === "string" &&
    typeof s.idAnualBoib === "string" &&
    typeof s.dateLastBoib === "string" &&
    typeof s.numMatches === "number"
  );
}

async function withConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    await Promise.allSettled(batch.map(fn));
  }
}

export interface Dependencies {
  http: HttpClient;
  fs: FileSystem;
  email: EmailTransport;
  logger: Logger;
}

export async function runScrape(config: AppConfig, deps: Dependencies): Promise<ScrapeResult> {
  const { http, fs, email, logger } = deps;

  // Load previous state
  logger.info("Loading previous state...");
  const raw = await fs.readJson<BoibState>(config.stateFile);
  if (raw === null) {
    logger.warn("Previous state not found or corrupted. Starting from empty state.");
  }
  const previousState = isValidBoibState(raw)
    ? { ...createEmptyBoibState(), ...raw }
    : createEmptyBoibState();

  // Fetch RSS feed
  logger.info("Fetching RSS feed...");
  const rssRes = await http.get(BOIB_RSS_URL);
  const rssItems = parseRss(assertString(rssRes.data, "BOIB RSS feed"));

  if (rssItems.length === 0) {
    throw new Error("No items found in RSS feed");
  }

  // Filter out already-processed items
  const processedGuids = new Set(previousState.processedRssGuids ?? []);
  let newItems = rssItems.filter((item) => !processedGuids.has(item.guid));

  // First run with no prior bulletin: only process the latest item
  if (newItems.length > 0 && !previousState.linkUltimoBoletin) {
    const first = newItems[0];
    if (first) {
      newItems = [first];
    }
  }

  // Process oldest first for chronological order
  newItems.reverse();

  // No new bulletins
  if (newItems.length === 0) {
    logger.info("No new BOIB available");
    logger.info(`${rssItems[0]?.title ?? ""}\n`);

    let emailSent = false;

    if (config.sendEmail && config.notifyNoMatch && config.smtp.recipients.length > 0) {
      const mail = composeNoNewBoibEmail(
        { smtp: config.smtp },
        previousState.ultimoBoletin || (rssItems[0]?.title ?? ""),
      );
      logger.info(`Sending no-new-BOIB notification to ${config.smtp.recipients.join(", ")}`);
      await email.send(mail);
      emailSent = true;
    }

    logger.info("Exiting...");
    return {
      success: true,
      state: { ...previousState },
      downloadedPdfPaths: [],
      emailSent,
      sectionErrors: [],
      bulletinCount: 0,
    };
  }

  logger.info(`${newItems.length} new BOIB(s) available`);

  // Accumulators across all bulletins
  const allDownloadedPdfPaths: string[] = [];
  let totalMatches = 0;
  const allSectionErrors: SectionError[] = [];
  const allCustomersMatched: string[] = [];
  const allMatchedDocs: DocListItem[] = [];
  let lastBulletinState: BoibState = previousState;

  for (const [i, item] of newItems.entries()) {
    const meta = bulletinMetadataFromRssItem(item);
    logger.info(`Processing (${i + 1}/${newItems.length}): ${meta.ultimoBoletin}`);

    const state: BoibState = {
      ...createEmptyBoibState(),
      ...meta,
    };

    // Fetch section links
    const sectionRes = await http.get(state.linkUltimoBoletin);
    const { sections, isExtraordinary } = parseSectionMenu(
      assertString(sectionRes.data, "BOIB section menu"),
      config.allowedDomain,
    );
    state.isExtraordinary = isExtraordinary;
    logger.info(isExtraordinary ? "BOIB Extraordinari" : "BOIB ordinari");

    // Fetch doc lists for each section concurrently
    const sectionErrors: SectionError[] = [];
    const sectionResults = await Promise.allSettled(
      sections.map(async (section) => {
        const docRes = await http.get(section.link);
        const docs = parseDocList(assertString(docRes.data, "BOIB doc list"), config.allowedDomain);
        section.docList = docs;
      }),
    );
    for (const [j, result] of sectionResults.entries()) {
      const section = sections[j];
      if (!section || result.status === "fulfilled") continue;
      const message =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      logger.warn(`Failed to fetch section "${section.titulo}": ${message}`);
      sectionErrors.push({
        title: section.titulo,
        url: section.link,
        message,
        bulletin: meta.ultimoBoletin,
      });
    }
    allSectionErrors.push(...sectionErrors);
    state.sectionLinks = sections;

    // Match keywords across all docs
    const allDocs = sections.flatMap((s) => s.docList);
    const keywords = parseKeywords(config.wordsToSearch);
    const matchedDocs = matchKeywords(allDocs, keywords);
    const seen = new Set<string>();
    const filteredDocs = matchedDocs.filter((doc) => {
      if (doc.downloadPdfLink) {
        if (seen.has(doc.downloadPdfLink)) {
          return false;
        }
        seen.add(doc.downloadPdfLink);
      }
      return true;
    });

    if (filteredDocs.length === 0) {
      logger.info("No documents found matching these search criteria");
    } else {
      const deduped = matchedDocs.length - filteredDocs.length;
      if (deduped > 0) {
        logger.info(`${filteredDocs.length} unique BOIBs found (${deduped} duplicates removed)`);
      } else {
        logger.info(`${filteredDocs.length} BOIBs found`);
      }
    }

    allMatchedDocs.push(...filteredDocs);

    if (filteredDocs.length > 0) {
      const pdfLinks = filteredDocs.map((d) => d.downloadPdfLink).filter(Boolean);
      const htmlLinks = filteredDocs.map((d) => d.htmlLink).filter(Boolean);

      // Download PDFs
      const folderPath = buildDownloadFolderName(
        state.idAnualBoib,
        state.dateLastBoib,
        config.pdfDownloadFolder,
      );
      await fs.mkdir(folderPath);

      const spinner = logger.spinner(`Downloading PDFs to:\n${folderPath}`);
      spinner.start();

      await withConcurrencyLimit(pdfLinks, 5, async (link) => {
        try {
          const data = await http.getBuffer(link, config.maxPdfSize);
          if (!fs.validatePdf(data)) {
            logger.warn(`Skipping non-PDF content from ${link}`);
            return;
          }
          const baseName = link.split("/").pop() || `boib_${Date.now()}`;
          const fileName = baseName.endsWith(".pdf") ? baseName : `${baseName}.pdf`;
          const filePath = resolveSafePath(folderPath, fileName);
          if (!filePath) {
            logger.warn(`Skipping potentially unsafe path: ${fileName}`);
            return;
          }
          await fs.writeFile(filePath, data);
          allDownloadedPdfPaths.push(filePath);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn(`Failed to download ${link}: ${message}`);
        }
      });
      spinner.succeed("Download completed");

      // Match customers in HTML docs concurrently
      logger.info(
        `Looking for ${config.customers.length} customer(s) in ${htmlLinks.length} document(s)`,
      );
      await Promise.allSettled(
        htmlLinks.map(async (link) => {
          try {
            const res = await http.get(link);
            const doc = filteredDocs.find((d) => d.htmlLink === link);
            const matches = matchCustomers(
              assertString(res.data, "BOIB HTML doc"),
              config.customers,
              doc?.id ?? "",
            );
            for (const match of matches) {
              const matchStr = `PDF ${match.docId} -> Table ${match.tableIndex}, row ${match.rowIndex}, cell ${match.cellIndex}: ${match.cellText}`;
              allCustomersMatched.push(matchStr);
              logger.info(`Match found: ${matchStr}`);
              totalMatches++;
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`Error fetching ${link}: ${message}`);
          }
        }),
      );
    }
    logger.info(`Found ${totalMatches} match(es) so far`);

    // Track this GUID as processed
    processedGuids.add(item.guid);

    // Save intermediate state for partial progress
    await fs.writeJson(config.stateFile, {
      ...state,
      customersMatched: [...allCustomersMatched],
      numMatches: totalMatches,
      processedRssGuids: [...processedGuids],
    });

    lastBulletinState = state;
  }

  // Build final saved state
  const finalState: BoibState = {
    ...lastBulletinState,
    customersMatched: allCustomersMatched,
    numMatches: totalMatches,
    processedRssGuids: [...processedGuids],
  };

  // Save state
  logger.info("Writing data to database");
  await fs.writeJson(config.stateFile, finalState);
  logger.info("Data saved");

  // Send email
  let emailSent = false;
  if (config.sendEmail && config.smtp.recipients.length > 0) {
    const result: ScrapeResult = {
      success: true,
      state: finalState,
      downloadedPdfPaths: allDownloadedPdfPaths,
      emailSent: false,
      sectionErrors: allSectionErrors,
      bulletinCount: newItems.length,
    };
    const mail = composeEmail(result, {
      smtp: config.smtp,
      wordsToSearch: config.wordsToSearch,
      customers: config.customers,
      matchedDocs: allMatchedDocs,
    });
    logger.info(`Sending email to ${config.smtp.recipients.join(", ")}`);
    await email.send(mail);
    emailSent = true;
  }

  return {
    success: true,
    state: finalState,
    downloadedPdfPaths: allDownloadedPdfPaths,
    emailSent,
    sectionErrors: allSectionErrors,
    bulletinCount: newItems.length,
  };
}
