import type { ScrapeResult } from "../../domain/models/boib.js";

function sanitizeForEmail(text: string): string {
  return text.replace(/[\r\n]/g, " ").trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface EmailContent {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments: { filename: string; path: string }[];
}

export function composeNoNewBoibEmail(
  config: {
    smtp: { user: string; recipients: string[] };
  },
  lastChecked: string,
): EmailContent {
  return {
    from: config.smtp.user,
    to: config.smtp.recipients.join(", "),
    subject: `[BOIB] No new issues available`,
    text: `\nAuto-generated notification.\n\nNo new BOIB available.\nLast checked: ${sanitizeForEmail(lastChecked)}\nThe scraper will check again on the next run.\n\nHave a good day.\n\nMarc de DocsEE\nDocumentacion Eficiente y Eficaz\n`,
    attachments: [],
  };
}

function composeHtmlBody(
  result: ScrapeResult,
  config: {
    wordsToSearch: string[];
    customers: string[];
  },
): string {
  const rows: string[] = [];
  rows.push(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #1a1a1a; margin: 0; padding: 0; background: #f4f4f4;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
<div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
<div style="background: #1a365d; color: #fff; padding: 24px 32px;">
<h1 style="margin: 0; font-size: 18px; font-weight: 600;">[NUEVO BOIB]</h1>
<p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">${escapeHtml(result.state.ultimoBoletin)}</p>
</div>
<div style="padding: 24px 32px;">`);

  if (result.downloadedPdfPaths.length === 0) {
    rows.push(`<p style="color: #666;">No BOIBs found matching the following search criteria:</p>
<ul style="color: #666;">`);
    for (const word of config.wordsToSearch) {
      rows.push(`<li>${escapeHtml(word)}</li>`);
    }
    rows.push(`</ul>`);
  } else {
    rows.push(
      `<p><strong>${result.downloadedPdfPaths.length}</strong> BOIB(s) found matching your criteria:</p>`,
    );

    if (result.numMatches > 0) {
      rows.push(`<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin-bottom: 16px; border-radius: 4px;">
<p style="margin: 0; font-weight: 600; color: #856404;">*** ALERT *** ${result.numMatches} match(es) found with the provided customer names:</p>
<p style="margin: 4px 0 0; color: #856404;">${config.customers.map((c) => escapeHtml(c)).join(", ")}</p>
</div>`);
    }

    rows.push(`<table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
<thead>
<tr style="background: #f8f9fa;">
<th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #dee2e6; font-size: 12px; text-transform: uppercase; color: #666;">#</th>
<th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #dee2e6; font-size: 12px; text-transform: uppercase; color: #666;">Description</th>
<th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #dee2e6; font-size: 12px; text-transform: uppercase; color: #666;">Links</th>
</tr>
</thead>
<tbody>`);
    for (const [i, section] of result.state.sectionLinks.entries()) {
      for (const [j, doc] of section.docList.entries()) {
        rows.push(`<tr style="border-bottom: 1px solid #eee;">
<td style="padding: 8px 12px; vertical-align: top; color: #999; font-size: 12px;">${i + 1}-${j + 1}</td>
<td style="padding: 8px 12px; vertical-align: top;">${escapeHtml(doc.description)}</td>
<td style="padding: 8px 12px; vertical-align: top; white-space: nowrap;">
${doc.downloadPdfLink ? `<a href="${escapeHtml(doc.downloadPdfLink)}" style="color: #2563eb; text-decoration: none; margin-right: 8px;">PDF</a>` : ""}
${doc.htmlLink ? `<a href="${escapeHtml(doc.htmlLink)}" style="color: #2563eb; text-decoration: none;">HTML</a>` : ""}
</td>
</tr>`);
      }
    }
    rows.push(`</tbody>
</table>`);
  }

  rows.push(`</div>
<div style="background: #f8f9fa; padding: 16px 32px; border-top: 1px solid #dee2e6;">
<p style="margin: 0; font-size: 12px; color: #666;">Have a good day.</p>
<p style="margin: 2px 0 0; font-size: 12px; color: #666;">Marc de DocsEE &mdash; Documentaci&oacute;n Eficiente y Eficaz</p>
</div>
</div>
</div>
</body>
</html>`);
  return rows.join("\n");
}

export function composeEmail(
  result: ScrapeResult,
  config: {
    smtp: { user: string; recipients: string[] };
    wordsToSearch: string[];
    customers: string[];
  },
): EmailContent {
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
    html: composeHtmlBody(result, config),
    attachments,
  };
}
