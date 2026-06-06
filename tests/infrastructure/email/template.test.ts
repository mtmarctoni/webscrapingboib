import { describe, expect, it } from "vitest";
import type { ScrapeResult } from "../../../src/domain/models/boib.js";
import { composeEmail, composeNoNewBoibEmail } from "../../../src/infrastructure/email/template.js";

const BASE_CONFIG = {
  smtp: { user: "bot@example.com", recipients: ["me@example.com"] },
  wordsToSearch: ["contracte", "licitacio"],
  customers: ["Acme Corp", "Beta SL"],
  matchedDocs: [],
};

const RESULT_NO_MATCHES: ScrapeResult = {
  success: true,
  state: {
    ultimoBoletin: "BOIB núm. 123 — 15 de gener de 2024",
    isExtraordinary: false,
    idBoib: "2024",
    idAnualBoib: "123",
    dateLastBoib: "2024-01-15",
    linkUltimoBoletin: "https://www.caib.es/eboibfront/ca/2024/2024",
    customersMatched: [],
    sectionLinks: [],
    numMatches: 0,
    processedRssGuids: [],
  },
  downloadedPdfPaths: [],
  bulletinCount: 1,
  emailSent: false,
  sectionErrors: [],
};

const RESULT_WITH_MATCHES: ScrapeResult = {
  success: true,
  state: {
    ultimoBoletin: "BOIB núm. 456 — 1 de febrer de 2024",
    isExtraordinary: false,
    idBoib: "2024",
    idAnualBoib: "456",
    dateLastBoib: "2024-02-01",
    linkUltimoBoletin: "https://www.caib.es/eboibfront/ca/2024/2024",
    customersMatched: ["Acme Corp"],
    sectionLinks: [],
    numMatches: 1,
    processedRssGuids: [],
  },
  downloadedPdfPaths: ["/tmp/pdfs/doc1.pdf", "/tmp/pdfs/doc2.pdf"],
  bulletinCount: 2,
  emailSent: false,
  sectionErrors: [],
};

const RESULT_MULTI_BULLETIN: ScrapeResult = {
  success: true,
  state: {
    ultimoBoletin: "BOIB núm. 789 — 5 de març de 2024",
    isExtraordinary: false,
    idBoib: "2024",
    idAnualBoib: "789",
    dateLastBoib: "2024-03-05",
    linkUltimoBoletin: "https://www.caib.es/eboibfront/ca/2024/2024",
    customersMatched: [],
    sectionLinks: [],
    numMatches: 0,
    processedRssGuids: [],
  },
  downloadedPdfPaths: ["/tmp/pdfs/doc3.pdf"],
  bulletinCount: 3,
  emailSent: false,
  sectionErrors: [],
};

describe("composeNoNewBoibEmail", () => {
  it("returns EmailContent with correct structure", () => {
    const email = composeNoNewBoibEmail(BASE_CONFIG, "2024-01-15T10:00:00Z");
    expect(email).toHaveProperty("from", "bot@example.com");
    expect(email).toHaveProperty("to", "me@example.com");
    expect(email.subject).toContain("No new issues available");
    expect(email.text).toContain("Last checked: 2024-01-15T10:00:00Z");
    expect(email.attachments).toEqual([]);
  });

  it("sanitizes newlines from the lastChecked string", () => {
    const email = composeNoNewBoibEmail(BASE_CONFIG, "2024-01-15\n10:00:00");
    expect(email.text).not.toContain("\n2024-01-15");
    expect(email.text).toContain("2024-01-15 10:00:00");
  });
});

describe("composeEmail", () => {
  it("produces plain text body with no downloads", () => {
    const email = composeEmail(RESULT_NO_MATCHES, {
      ...BASE_CONFIG,
      matchedDocs: [],
    });
    expect(email.text).toContain("No BOIBs found");
    expect(email.text).toContain("contracte");
    expect(email.text).toContain("licitacio");
  });

  it("produces plain text body with downloaded PDFs and no matches", () => {
    const email = composeEmail(RESULT_MULTI_BULLETIN, {
      ...BASE_CONFIG,
      matchedDocs: [],
    });
    expect(email.text).toContain("1 BOIB(s) found");
    expect(email.text).toContain("No matches found");
    expect(email.text).toContain("Acme Corp");
    expect(email.text).toContain("Beta SL");
  });

  it("includes ALERT banner when customer matches found", () => {
    const email = composeEmail(RESULT_WITH_MATCHES, {
      ...BASE_CONFIG,
      matchedDocs: [
        {
          id: "1",
          description: "Resolution about Acme contract",
          downloadPdfLink: "https://www.caib.es/eboibfront/pdf/1",
          htmlLink: "https://www.caib.es/doc/1",
        },
      ],
    });
    expect(email.text).toContain("2 BOIB(s) found");
    expect(email.text).toContain("ALERT");
    expect(email.text).toContain("1 match(es) found");
  });

  it("uses multi-bulletin subject when bulletinCount > 1", () => {
    const email = composeEmail(RESULT_MULTI_BULLETIN, {
      ...BASE_CONFIG,
      matchedDocs: [],
    });
    expect(email.subject).toBe("[NUEVO BOIB] 3 new bulletins");
  });

  it("uses bulletin name in subject when single bulletin", () => {
    const email = composeEmail(RESULT_NO_MATCHES, {
      ...BASE_CONFIG,
      matchedDocs: [],
    });
    expect(email.subject).toBe("[NUEVO BOIB] BOIB núm. 123 — 15 de gener de 2024");
  });

  it("generates HTML body", () => {
    const email = composeEmail(RESULT_WITH_MATCHES, {
      ...BASE_CONFIG,
      matchedDocs: [
        {
          id: "1",
          description: "Resolution about Acme contract",
          downloadPdfLink: "https://www.caib.es/eboibfront/pdf/1",
          htmlLink: "https://www.caib.es/doc/1",
        },
      ],
    });
    const html = email.html as string;
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("ALERT");
  });

  it("attaches downloaded PDFs", () => {
    const email = composeEmail(RESULT_WITH_MATCHES, {
      ...BASE_CONFIG,
      matchedDocs: [],
    });
    expect(email.attachments).toHaveLength(2);
    expect(email.attachments[0]?.filename).toBe("doc1.pdf");
    expect(email.attachments[1]?.filename).toBe("doc2.pdf");
  });

  it("creates attachment with fallback filename when path has no slash", () => {
    const result: ScrapeResult = {
      ...RESULT_WITH_MATCHES,
      downloadedPdfPaths: ["doc_only.pdf"],
    };
    const email = composeEmail(result, {
      ...BASE_CONFIG,
      matchedDocs: [],
    });
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments[0]?.filename).toBe("doc_only.pdf");
  });

  it("escapes HTML special characters in descriptions", () => {
    const email = composeEmail(RESULT_WITH_MATCHES, {
      ...BASE_CONFIG,
      matchedDocs: [
        {
          id: "1",
          description: "Contract <test> & more",
          downloadPdfLink: "https://www.caib.es/eboibfront/pdf/1",
          htmlLink: "",
        },
      ],
    });
    const html = email.html as string;
    expect(html).toContain("&lt;test&gt;");
    expect(html).toContain("&amp; more");
  });

  it("renders no-match HTML with criteria list", () => {
    const email = composeEmail(RESULT_NO_MATCHES, {
      ...BASE_CONFIG,
      matchedDocs: [],
    });
    const html = email.html as string;
    expect(html).toContain("No BOIBs found matching");
    expect(html).toContain("contracte");
    expect(html).toContain("licitacio");
  });

  it("renders matches table with PDF and HTML links", () => {
    const email = composeEmail(RESULT_WITH_MATCHES, {
      ...BASE_CONFIG,
      matchedDocs: [
        {
          id: "1",
          description: "Resolution about Acme contract",
          downloadPdfLink: "https://www.caib.es/eboibfront/pdf/1",
          htmlLink: "https://www.caib.es/doc/1",
        },
      ],
    });
    const html = email.html as string;
    expect(html).toContain(">PDF<");
    expect(html).toContain(">HTML<");
  });

  it("renders table row without HTML link when htmlLink is empty", () => {
    const email = composeEmail(RESULT_WITH_MATCHES, {
      ...BASE_CONFIG,
      matchedDocs: [
        {
          id: "1",
          description: "PDF only doc",
          downloadPdfLink: "https://www.caib.es/eboibfront/pdf/1",
          htmlLink: "",
        },
      ],
    });
    const html = email.html as string;
    expect(html).toContain(">PDF<");
    expect(html).not.toContain(">HTML<");
  });
});
