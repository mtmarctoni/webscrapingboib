import {
  emailUser,
  emailRecipients,
  downloadedPdfPaths,
  numMatches,
  lastBoibInfo,
  wordsToSearch,
  customers,
  transporter,
} from "../modules/global.js";
import type { Attachment } from "nodemailer";

function sanitizeForEmail(text: string): string {
  return text.replace(/[\r\n]/g, " ").trim();
}

export const sendEmailWithAttachments = async (): Promise<void> => {
  let emailBody = `\nAuto-generated notification.\n`;

  if (downloadedPdfPaths.length === 0) {
    emailBody += `\n\nNo BOIBs found matching the following search criteria:\n\n`;
    for (const word of wordsToSearch) {
      emailBody += `  - ${sanitizeForEmail(word)}\n`;
    }
  } else {
    emailBody += `\nAttached are the ${downloadedPdfPaths.length} BOIB(s) found matching the following search criteria:\n\n`;
    for (const word of wordsToSearch) {
      emailBody += `  - ${sanitizeForEmail(word)}\n`;
    }
    emailBody += `\n`;

    if (numMatches === 0) {
      emailBody += `No matches found with the provided customer names:\n\n`;
      for (const customer of customers) {
        emailBody += `  - ${sanitizeForEmail(customer)}\n`;
      }
      emailBody += `\n`;
    } else {
      emailBody += `*** ALERT *** ${numMatches} match(es) found with the provided customer names:\n\n`;
      for (const customer of customers) {
        emailBody += `  - ${sanitizeForEmail(customer)}\n`;
      }
      emailBody += `\n`;
    }
  }

  emailBody += `\nHave a good day.\n\nMarc de DocsEE\nDocumentacion Eficiente y Eficaz\n`;

  const attachments: Attachment[] = downloadedPdfPaths.map((filePath: string) => ({
    filename: filePath.split("/").pop() || `attachment_${Date.now()}.pdf`,
    path: filePath,
  }));

  const mailOptions = {
    from: emailUser,
    to: emailRecipients.join(", "),
    subject: `[NUEVO BOIB] ${sanitizeForEmail(lastBoibInfo.ultimoBoletin)}`,
    text: emailBody,
    attachments,
  };

  console.log(`Sending email to ${emailRecipients.join(", ")}`);
  await transporter.sendMail(mailOptions);
};
