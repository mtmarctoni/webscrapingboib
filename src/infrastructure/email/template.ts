import type { ScrapeResult } from "../../domain/models/boib.js";

function sanitizeForEmail(text: string): string {
  return text.replace(/[\r\n]/g, " ").trim();
}

export interface EmailContent {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; path: string }[];
}

export function composeEmail(result: ScrapeResult, config: { smtp: { user: string; recipients: string[] }; wordsToSearch: string[]; customers: string[] }): EmailContent {
  let emailBody = `\nAuto-generated notification.\n`;

  if (result.downloadedPdfPaths.length === 0) {
    emailBody += `\n\nNo BOIBs found matching the following search criteria:\n\n`;
    for (const word of config.wordsToSearch) {
      emailBody += `  - ${sanitizeForEmail(word)}\n`;
    }
  } else {
    emailBody += `\nAttached are the ${result.downloadedPdfPaths.length} BOIB(s) found matching the following search criteria:\n\n`;
    for (const word of config.wordsToSearch) {
      emailBody += `  - ${sanitizeForEmail(word)}\n`;
    }
    emailBody += `\n`;

    if (result.numMatches === 0) {
      emailBody += `No matches found with the provided customer names:\n\n`;
      for (const customer of config.customers) {
        emailBody += `  - ${sanitizeForEmail(customer)}\n`;
      }
      emailBody += `\n`;
    } else {
      emailBody += `*** ALERT *** ${result.numMatches} match(es) found with the provided customer names:\n\n`;
      for (const customer of config.customers) {
        emailBody += `  - ${sanitizeForEmail(customer)}\n`;
      }
      emailBody += `\n`;
    }
  }

  emailBody += `\nHave a good day.\n\nMarc de DocsEE\nDocumentacion Eficiente y Eficaz\n`;

  const attachments = result.downloadedPdfPaths.map((filePath) => ({
    filename: filePath.split("/").pop() || `attachment_${Date.now()}.pdf`,
    path: filePath,
  }));

  return {
    from: config.smtp.user,
    to: config.smtp.recipients.join(", "),
    subject: `[NUEVO BOIB] ${sanitizeForEmail(result.state.ultimoBoletin)}`,
    text: emailBody,
    attachments,
  };
}
