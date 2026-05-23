import { validateEnvironment } from "./modules/global.js";
import { wait, writeDataBase } from "./services/utils.js";
import { sendEmailWithAttachments } from "./services/emailService.js";
import { searchForCustomers } from "./services/customerService.js";
import { downloadPdfs } from "./services/pdfService.js";
import {
  getDocLists,
  getLastBoib,
  getSectionLinks,
  getSpecificBoib,
  readDataBase,
} from "./services/boibService.js";
import {
  wordsToSearch,
  sendEmailBool,
  lastBoibInfoFile,
  lastBoibInfo,
  previousBoibInfo,
} from "./modules/global.js";

const main = async (): Promise<void> => {
  console.log("----------");
  console.log(new Date(Date.now()));

  try {
    validateEnvironment();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Configuration error: ${message}`);
    console.error("Please check your .env file and ensure all required variables are set.");
    process.exit(1);
  }

  try {
    await readDataBase(lastBoibInfoFile);
    await getLastBoib();

    if (lastBoibInfo.linkUltimoBoletin === previousBoibInfo.linkUltimoBoletin) {
      console.log("No new BOIB available");
      console.log(`${lastBoibInfo.ultimoBoletin}\n`);
      console.log("Exiting...");
      console.log("----------");
      await wait(1000);
      process.exit(0);
    }

    console.log("New BOIB available!");
    console.log(lastBoibInfo.ultimoBoletin);

    await getSectionLinks(lastBoibInfo.linkUltimoBoletin);
    for (const section of lastBoibInfo.sectionLinks) {
      await getDocLists(section.link);
    }

    const filteredList = getSpecificBoib(wordsToSearch);
    if (filteredList.length !== 0) {
      const pdfLinks = filteredList.map((x) => x.downloadPdfLink);
      const htmlLinks = filteredList.map((x) => x.htmlLink);
      await downloadPdfs(pdfLinks);
      await searchForCustomers(htmlLinks);
    }

    await writeDataBase();

    if (sendEmailBool) {
      await sendEmailWithAttachments();
    }

    console.log("----------");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Fatal error: ${message}`);

    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }

    try {
      await writeDataBase();
    } catch {
      console.error("Could not save data to database before exit");
    }

    process.exit(1);
  }
};

main();