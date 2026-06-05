import { beforeEach, describe, expect, it, vi } from "vitest";
import { runScrape } from "../../../src/application/useCases/scrapeBoib.js";
import type { AppConfig } from "../../../src/config/environment.js";
import type { EmailTransport } from "../../../src/infrastructure/email/transport.js";
import type { HttpClient } from "../../../src/infrastructure/http/client.js";
import type { Logger } from "../../../src/infrastructure/logger.js";
import type { FileSystem } from "../../../src/infrastructure/storage/fileSystem.js";

const BASE_URL = "https://www.caib.es/eboibfront/ca";
const ALLOWED_DOMAIN = "https://www.caib.es";
const LINK_LATEST = `${BASE_URL}/2026/2026`;

function makeConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    baseUrl: BASE_URL,
    allowedDomain: ALLOWED_DOMAIN,
    wordsToSearch: ["test"],
    customers: [],
    smtp: {
      host: "smtp.test.com",
      port: 465,
      secure: true,
      user: "user@test.com",
      pass: "secret",
      recipients: [],
    },
    stateFile: "lastBoibInfo.json",
    pdfDownloadFolder: "BOIBpdfs",
    sendEmail: false,
    notifyNoMatch: false,
    httpTimeout: 15000,
    maxContentLength: 50 * 1024 * 1024,
    maxPdfSize: 10 * 1024 * 1024,
    ...overrides,
  };
}

function makeDeps() {
  const http: HttpClient = {
    get: vi.fn() as unknown as HttpClient["get"],
    getBuffer: vi.fn() as unknown as HttpClient["getBuffer"],
  };
  const fs: FileSystem = {
    readJson: vi.fn() as unknown as FileSystem["readJson"],
    writeJson: vi.fn() as unknown as FileSystem["writeJson"],
    mkdir: vi.fn() as unknown as FileSystem["mkdir"],
    readdir: vi.fn() as unknown as FileSystem["readdir"],
    writeFile: vi.fn() as unknown as FileSystem["writeFile"],
    validatePdf: vi.fn() as unknown as FileSystem["validatePdf"],
  };
  const email: EmailTransport = {
    verify: vi.fn() as unknown as EmailTransport["verify"],
    send: vi.fn() as unknown as EmailTransport["send"],
  };
  const logger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    spinner: vi.fn().mockReturnValue({ start: vi.fn(), succeed: vi.fn(), fail: vi.fn() }),
  };
  return { http, fs, email, logger };
}

const BULLETIN_HTML = `
  <div class="ultimoBoletin">
    <div class="caja whitebg">
      <p><a href="/eboibfront/2026/12345">BOIB núm. 12345 — 15 de maig de 2026</a></p>
    </div>
  </div>
`;

const SECTION_MENU_HTML = `
  <div class="primerosHijos">
    <li><a href="/section-1/">section 1</a></li>
    <li><a href="/section-2/">section 2</a></li>
  </div>
`;

const DOC_LIST_HTML = `
  <div class="llistat">
    <ul class="resolucions">
      <p>Resolution about test funding</p>
      <p class="registre">REG 111 - 2026</p>
      <a href="/eboibfront/pdf/111">PDF</a>
      <a href="/doc/111">HTML</a>
    </ul>
  </div>
`;

describe("runScrape", () => {
  let config: AppConfig;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    vi.resetAllMocks();
    config = makeConfig();
    deps = makeDeps();
  });

  it("returns early when no new bulletin is available", async () => {
    deps.fs.readJson = vi.fn().mockResolvedValue({
      linkUltimoBoletin: LINK_LATEST,
    }) as unknown as FileSystem["readJson"];
    deps.http.get = vi
      .fn()
      .mockResolvedValue({ data: BULLETIN_HTML }) as unknown as HttpClient["get"];

    const result = await runScrape(config, deps);

    expect(result.success).toBe(true);
    expect(result.downloadedPdfPaths).toEqual([]);
    expect(result.numMatches).toBe(0);
    expect(result.emailSent).toBe(false);
    expect(deps.http.get).toHaveBeenCalledTimes(1);
    expect(deps.http.get).toHaveBeenCalledWith(config.baseUrl);
    expect(deps.fs.writeJson).not.toHaveBeenCalled();
  });

  it("starts from empty state when state file is missing", async () => {
    deps.fs.readJson = vi.fn().mockResolvedValue(null) as unknown as FileSystem["readJson"];
    deps.http.get = vi
      .fn()
      .mockResolvedValue({ data: BULLETIN_HTML }) as unknown as HttpClient["get"];

    const result = await runScrape(config, deps);

    expect(result.success).toBe(true);
    expect(result.state.linkUltimoBoletin).toBe(LINK_LATEST);
  });

  it("starts from empty state when state file is corrupt", async () => {
    deps.fs.readJson = vi
      .fn()
      .mockResolvedValue({ linkUltimoBoletin: 42 }) as unknown as FileSystem["readJson"];
    deps.http.get = vi
      .fn()
      .mockResolvedValue({ data: BULLETIN_HTML }) as unknown as HttpClient["get"];

    const result = await runScrape(config, deps);

    expect(result.success).toBe(true);
    expect(result.state.linkUltimoBoletin).toBe(LINK_LATEST);
  });

  it("processes new bulletin, downloads PDFs for keyword matches, and saves state", async () => {
    deps.fs.readJson = vi.fn().mockResolvedValue({
      linkUltimoBoletin: "https://www.caib.es/eboibfront/ca/2026/99999",
    }) as unknown as FileSystem["readJson"];
    deps.http.get = vi.fn().mockImplementation(async (url: string) => {
      if (url === LINK_LATEST) {
        return { data: SECTION_MENU_HTML };
      }
      if (url.includes("section-1")) {
        return { data: DOC_LIST_HTML };
      }
      if (url.includes("section-2")) {
        return { data: '<div class="llistat"></div>' };
      }
      return { data: BULLETIN_HTML };
    }) as unknown as HttpClient["get"];
    deps.http.getBuffer = vi
      .fn()
      .mockResolvedValue(Buffer.from("%PDF-1.7\n...")) as unknown as HttpClient["getBuffer"];
    deps.fs.validatePdf = vi.fn().mockReturnValue(true) as unknown as FileSystem["validatePdf"];
    deps.fs.writeFile = vi.fn().mockResolvedValue(undefined) as unknown as FileSystem["writeFile"];
    deps.fs.mkdir = vi.fn().mockResolvedValue(undefined) as unknown as FileSystem["mkdir"];
    deps.fs.writeJson = vi.fn().mockResolvedValue(undefined) as unknown as FileSystem["writeJson"];

    const result = await runScrape(config, deps);

    expect(result.success).toBe(true);
    expect(result.downloadedPdfPaths).toHaveLength(1);
    expect(result.numMatches).toBe(0);
    expect(deps.fs.writeJson).toHaveBeenCalledWith(config.stateFile, expect.any(Object));
  });

  it("logs section errors without crashing when a section fetch fails", async () => {
    deps.fs.readJson = vi.fn().mockResolvedValue({
      linkUltimoBoletin: "https://www.caib.es/eboibfront/ca/2026/99999",
    }) as unknown as FileSystem["readJson"];
    deps.http.get = vi.fn().mockImplementation(async (url: string) => {
      if (url === LINK_LATEST) {
        return { data: SECTION_MENU_HTML };
      }
      if (url.includes("section-2")) {
        throw new Error("Connection timeout");
      }
      if (url.includes("section-1")) {
        return { data: DOC_LIST_HTML };
      }
      return { data: BULLETIN_HTML };
    }) as unknown as HttpClient["get"];
    deps.http.getBuffer = vi
      .fn()
      .mockResolvedValue(Buffer.from("%PDF-1.7\n...")) as unknown as HttpClient["getBuffer"];
    deps.fs.validatePdf = vi.fn().mockReturnValue(true) as unknown as FileSystem["validatePdf"];
    deps.fs.writeFile = vi.fn().mockResolvedValue(undefined) as unknown as FileSystem["writeFile"];
    deps.fs.mkdir = vi.fn().mockResolvedValue(undefined) as unknown as FileSystem["mkdir"];
    deps.fs.writeJson = vi.fn().mockResolvedValue(undefined) as unknown as FileSystem["writeJson"];

    const result = await runScrape(config, deps);

    expect(result.success).toBe(true);
    expect(result.sectionErrors).toHaveLength(1);
    const sectionError = result.sectionErrors[0] as { title: string; url: string; message: string };
    expect(sectionError.title).toBe("section 2");
    expect(sectionError.message).toContain("Connection timeout");
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch section"),
    );
    expect(result.downloadedPdfPaths).toHaveLength(1);
  });

  it("returns no matches when keyword does not match any doc", async () => {
    config = makeConfig({ wordsToSearch: ["nonexistent"] });
    deps.fs.readJson = vi.fn().mockResolvedValue({
      linkUltimoBoletin: "https://www.caib.es/eboibfront/ca/2026/99999",
    }) as unknown as FileSystem["readJson"];
    deps.http.get = vi.fn().mockImplementation(async (url: string) => {
      if (url === LINK_LATEST) {
        return { data: SECTION_MENU_HTML };
      }
      if (url.includes("section-1")) {
        return { data: DOC_LIST_HTML };
      }
      return { data: BULLETIN_HTML };
    }) as unknown as HttpClient["get"];

    const result = await runScrape(config, deps);

    expect(result.success).toBe(true);
    expect(result.downloadedPdfPaths).toEqual([]);
    expect(result.numMatches).toBe(0);
    expect(deps.fs.writeJson).toHaveBeenCalledWith(config.stateFile, expect.any(Object));
  });

  it("sends email when configured with recipients and matches", async () => {
    config = makeConfig({
      sendEmail: true,
      smtp: {
        host: "smtp.test.com",
        port: 465,
        secure: true,
        user: "user@test.com",
        pass: "secret",
        recipients: ["admin@test.com"],
      },
    });
    deps.fs.readJson = vi.fn().mockResolvedValue({
      linkUltimoBoletin: "https://www.caib.es/eboibfront/ca/2026/99999",
    }) as unknown as FileSystem["readJson"];
    deps.http.get = vi.fn().mockImplementation(async (url: string) => {
      if (url === LINK_LATEST) {
        return { data: SECTION_MENU_HTML };
      }
      if (url.includes("section-1")) {
        return { data: DOC_LIST_HTML };
      }
      if (url.includes("section-2")) {
        return { data: '<div class="llistat"></div>' };
      }
      return { data: BULLETIN_HTML };
    }) as unknown as HttpClient["get"];
    deps.http.getBuffer = vi
      .fn()
      .mockResolvedValue(Buffer.from("%PDF-1.7\n...")) as unknown as HttpClient["getBuffer"];
    deps.fs.validatePdf = vi.fn().mockReturnValue(true) as unknown as FileSystem["validatePdf"];
    deps.fs.writeFile = vi.fn().mockResolvedValue(undefined) as unknown as FileSystem["writeFile"];
    deps.fs.mkdir = vi.fn().mockResolvedValue(undefined) as unknown as FileSystem["mkdir"];
    deps.fs.writeJson = vi.fn().mockResolvedValue(undefined) as unknown as FileSystem["writeJson"];
    deps.email.send = vi.fn().mockResolvedValue(undefined) as unknown as EmailTransport["send"];

    let capturedSubject = "";
    let capturedAttachments: unknown[] = [];
    deps.email.send = vi
      .fn()
      .mockImplementation((content: { subject: string; attachments: unknown[] }) => {
        capturedSubject = content.subject;
        capturedAttachments = content.attachments;
      }) as unknown as EmailTransport["send"];

    const result = await runScrape(config, deps);

    expect(result.emailSent).toBe(true);
    expect(capturedSubject).toContain("NUEVO BOIB");
    expect(capturedAttachments).toHaveLength(1);
  });

  it("sends no-match notification when configured and no new bulletin", async () => {
    config = makeConfig({
      sendEmail: true,
      notifyNoMatch: true,
      smtp: {
        host: "smtp.test.com",
        port: 465,
        secure: true,
        user: "user@test.com",
        pass: "secret",
        recipients: ["admin@test.com"],
      },
    });
    deps.fs.readJson = vi.fn().mockResolvedValue({
      linkUltimoBoletin: LINK_LATEST,
    }) as unknown as FileSystem["readJson"];
    deps.http.get = vi
      .fn()
      .mockResolvedValue({ data: BULLETIN_HTML }) as unknown as HttpClient["get"];
    let capturedSubject = "";
    deps.email.send = vi.fn().mockImplementation((content: { subject: string }) => {
      capturedSubject = content.subject;
    }) as unknown as EmailTransport["send"];

    const result = await runScrape(config, deps);

    expect(result.emailSent).toBe(true);
    expect(capturedSubject).toContain("No new issues");
  });

  it("fails gracefully when bulletin page HTTP request fails", async () => {
    deps.fs.readJson = vi.fn().mockResolvedValue(null) as unknown as FileSystem["readJson"];
    deps.http.get = vi
      .fn()
      .mockRejectedValue(new Error("Network error")) as unknown as HttpClient["get"];

    await expect(runScrape(config, deps)).rejects.toThrow();
  });
});
