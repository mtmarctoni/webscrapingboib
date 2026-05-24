import type { AppConfig } from "../../config/environment.js";
import { matchCustomers } from "../../domain/matchers/customerMatcher.js";
import { matchKeywords } from "../../domain/matchers/keywordMatcher.js";
import type { BoibState, ScrapeResult } from "../../domain/models/boib.js";
import { createEmptyBoibState } from "../../domain/models/boib.js";
import { parseBulletin, parseDocList, parseSectionMenu } from "../../domain/parsers/boibParser.js";
import { composeEmail } from "../../infrastructure/email/template.js";
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
  return (
    typeof state === "object" &&
    state !== null &&
    typeof (state as BoibState).linkUltimoBoletin === "string"
  );
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
  const previousState = isValidBoibState(raw) ? raw : createEmptyBoibState();

  // Fetch latest BOIB
  logger.info("Fetching latest BOIB info");
  const bulletinRes = await http.get(config.baseUrl);
  const meta = parseBulletin(assertString(bulletinRes.data, "BOIB bulletin page"), config.baseUrl);

  // Check if new
  if (meta.linkUltimoBoletin === previousState.linkUltimoBoletin) {
    logger.info("No new BOIB available");
    logger.info(`${meta.ultimoBoletin}\n`);
    logger.info("Exiting...");
    return {
      success: true,
      state: { ...previousState, ultimoBoletin: meta.ultimoBoletin },
      downloadedPdfPaths: [],
      numMatches: 0,
      emailSent: false,
    };
  }

  logger.info("New BOIB available!");
  logger.info(meta.ultimoBoletin);

  // Populate state with bulletin metadata
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

  // Fetch doc lists for each section
  for (const section of sections) {
    const docRes = await http.get(section.link);
    const docs = parseDocList(
      assertString(docRes.data, "BOIB doc list"),
      section.id,
      config.allowedDomain,
      config.allowedDomain,
    );
    section.docList = docs;
  }
  state.sectionLinks = sections;

  // Match keywords across all docs
  const allDocs = sections.flatMap((s) => s.docList);
  const filteredDocs = matchKeywords(allDocs, config.wordsToSearch);

  if (filteredDocs.length === 0) {
    logger.info("No documents found matching these search criteria");
  } else {
    logger.info(`${filteredDocs.length} BOIBs found`);
  }

  const downloadedPdfPaths: string[] = [];
  let numMatches = 0;
  let emailSent = false;

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

    for (const link of pdfLinks) {
      try {
        const data = await http.getBuffer(link, config.maxPdfSize);
        if (!fs.validatePdf(data)) {
          spinner.warn(`Skipping non-PDF content from ${link}`);
          continue;
        }
        const fileName = link.split("/").pop() || `boib_${Date.now()}.pdf`;
        const filePath = resolveSafePath(folderPath, fileName);
        if (!filePath) {
          spinner.warn(`Skipping potentially unsafe path: ${fileName}`);
          continue;
        }
        await fs.writeFile(filePath, data);
        spinner.text = `Downloaded ${fileName}`;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        spinner.warn(`Failed to download ${link}: ${message}`);
      }
    }
    spinner.succeed("Download completed");

    // Collect downloaded paths
    try {
      const files = await fs.readdir(folderPath);
      for (const file of files) {
        if (file.endsWith(".pdf")) {
          downloadedPdfPaths.push(`${folderPath}/${file}`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Could not list files in download folder: ${message}`);
    }

    // Match customers in HTML docs
    logger.info(
      `Looking for ${config.customers.length} customer(s) in ${htmlLinks.length} document(s)`,
    );
    for (const link of htmlLinks) {
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
          state.customersMatched.push(matchStr);
          logger.info(`Match found: ${matchStr}`);
          numMatches++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Error fetching ${link}: ${message}`);
      }
    }
    logger.info(`Found ${numMatches} match(es)`);
  }

  state.numMatches = numMatches;

  // Save state
  logger.info("Writing data to database");
  await fs.writeJson(config.stateFile, state);
  logger.info("Data saved");

  // Send email
  if (config.sendEmail && config.smtp.recipients.length > 0) {
    const result: ScrapeResult = {
      success: true,
      state,
      downloadedPdfPaths,
      numMatches,
      emailSent: false,
    };
    const mail = composeEmail(result, {
      smtp: config.smtp,
      wordsToSearch: config.wordsToSearch,
      customers: config.customers,
    });
    logger.info(`Sending email to ${config.smtp.recipients.join(", ")}`);
    await email.send(mail);
    emailSent = true;
  }

  return {
    success: true,
    state,
    downloadedPdfPaths,
    numMatches,
    emailSent,
  };
}
